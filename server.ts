import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import fastifyMiddie from '@fastify/middie';
import fastifyStatic from '@fastify/static';
import path from 'path';
import Parser from 'rss-parser';
import { createServer as createViteServer } from 'vite';
import { isLikelyTrackingImage } from './src/utils/imageFilter';
import { decodeGoogleNewsLinks, unwrapGoogleRedirectUrl } from './src/utils/googleNews';

interface CustomFeed {
  title?: string;
  description?: string;
  link?: string;
  image?: { url?: string } | string;
  lastBuildDate?: string;
}

interface CustomItem {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  creator?: string;
  author?: string;
  content?: string;
  contentSnippet?: string;
  description?: string;
  summary?: string;
  categories?: string[];
  enclosure?: { url: string; type?: string; length?: string };
  mediaContent?: any;
  mediaThumbnail?: any;
  mediaGroup?: any;
  contentEncoded?: string;
  guid?: string;
  id?: string;
}

// NOTE: feeds are fetched separately (see fetchFeedText) and only parseString is
// used, so rss-parser's HTTP options (headers, timeout) are intentionally omitted —
// they only apply to parseURL, which is never called.
const parser = new Parser<CustomFeed, CustomItem>({
  customFields: {
    feed: ['image', 'description'],
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['media:group', 'mediaGroup'],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator'],
      ['author', 'author'],
      ['description', 'description'],
      ['summary', 'summary'],
    ],
  },
});

/**
 * Minimum size for the image shown on a card. Smaller variants look pixelated
 * once stretched, so they are ignored when the feed also offers a bigger one.
 */
const MIN_CARD_IMAGE_WIDTH = 350;
const MIN_CARD_IMAGE_HEIGHT = 200;

interface ImageCandidate {
  url: string;
  width?: number;
  height?: number;
}

function toPositiveInt(value: unknown): number | undefined {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

/** Read an attribute from a raw HTML tag string (double, single or unquoted). */
function getAttribute(tag: string, name: string): string | undefined {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  );
  return match ? match[1] ?? match[2] ?? match[3] : undefined;
}

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif|svg|avif)(\?.*)?$/i.test(url);
}

/** Decode the HTML entities feeds often leave in `content:encoded` URLs. */
function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#0*38;/g, '&')
    .replace(/&amp;/gi, '&')
    .replace(/&#0*39;/g, "'")
    .replace(/&quot;/gi, '"');
}

/**
 * Best-effort dimensions for a candidate URL, from the `?w=`/`?h=`/`?resize=`
 * query params (WordPress/NASA dynamic images) or the WordPress `-1024x683`
 * filename suffix. Returns undefined when the size cannot be inferred.
 */
function getUrlDimensions(url: string): { width?: number; height?: number } {
  let width: number | undefined;
  let height: number | undefined;
  try {
    const parsed = new URL(url);
    width = toPositiveInt(
      parsed.searchParams.get('w') ||
        parsed.searchParams.get('width') ||
        parsed.searchParams.get('resize')
    );
    height = toPositiveInt(parsed.searchParams.get('h') || parsed.searchParams.get('height'));
  } catch {
    // Relative URLs never reach here: candidates require an absolute http(s) URL.
  }
  if (width === undefined || height === undefined) {
    const sized = url.match(/-(\d{2,5})x(\d{2,5})(?=\.(?:jpe?g|png|webp|gif|avif)(?:$|[?#]))/i);
    if (sized) {
      width = width ?? toPositiveInt(sized[1]);
      height = height ?? toPositiveInt(sized[2]);
    }
  }
  return { width, height };
}

/** True when a candidate's known dimensions fall below the card minimum. */
function isKnownTooSmall(candidate: ImageCandidate): boolean {
  return (
    (candidate.width !== undefined && candidate.width < MIN_CARD_IMAGE_WIDTH) ||
    (candidate.height !== undefined && candidate.height < MIN_CARD_IMAGE_HEIGHT)
  );
}

/**
 * Parse every <img> in a chunk of HTML into groups (one per tag, in document
 * order) so the lead image is preferred while each of its `srcset` variants
 * becomes a separate candidate.
 */
function extractContentImageGroups(html: string): ImageCandidate[][] {
  const groups: ImageCandidate[][] = [];
  const imgTag = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imgTag.exec(html)) !== null) {
    // Feeds frequently encode "&" as "&#038;" inside content:encoded. Decoding
    // it here keeps multi-parameter image URLs (w/h/fit) intact in the browser.
    const tag = decodeHtmlEntities(match[0]);
    const attrWidth = toPositiveInt(getAttribute(tag, 'width'));
    const attrHeight = toPositiveInt(getAttribute(tag, 'height'));
    const group: ImageCandidate[] = [];

    const srcset = getAttribute(tag, 'srcset') || getAttribute(tag, 'data-srcset');
    if (srcset) {
      for (const entry of srcset.split(',')) {
        const [url, descriptor] = entry.trim().split(/\s+/);
        if (!url || !/^https?:\/\//i.test(url)) continue;
        const dims = getUrlDimensions(url);
        const width =
          dims.width ??
          (descriptor && /^\d+w$/i.test(descriptor) ? toPositiveInt(descriptor) : undefined) ??
          attrWidth;
        group.push({ url, width, height: dims.height ?? attrHeight });
      }
    }

    const src = getAttribute(tag, 'src') || getAttribute(tag, 'data-src');
    if (src && /^https?:\/\//i.test(src)) {
      const dims = getUrlDimensions(src);
      group.push({ url: src, width: dims.width ?? attrWidth, height: dims.height ?? attrHeight });
    }

    if (group.length > 0) groups.push(group);
  }
  return groups;
}

/** Turn a Media RSS node (media:content / media:thumbnail) into candidates. */
function extractMediaImageCandidates(node: any): ImageCandidate[] {
  if (!node) return [];
  const entries = Array.isArray(node) ? node : [node];
  const candidates: ImageCandidate[] = [];
  for (const entry of entries) {
    const url = entry?.$?.url || entry?.url;
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) continue;
    const dims = getUrlDimensions(url);
    const width = toPositiveInt(entry?.$?.width ?? entry?.width) ?? dims.width;
    const height = toPositiveInt(entry?.$?.height ?? entry?.height) ?? dims.height;
    candidates.push({ url, width, height });
  }
  return candidates;
}

/**
 * Pick the smallest candidate that still renders crisply on a card
 * (>= 350x200). Returns undefined when no candidate declares a usable size,
 * so callers can fall back to the historical behaviour.
 */
function pickCardSizedImage(candidates: ImageCandidate[]): string | undefined {
  const qualifying = candidates.filter(
    (c) =>
      !isLikelyTrackingImage(c.url) &&
      c.width !== undefined &&
      c.height !== undefined &&
      c.width >= MIN_CARD_IMAGE_WIDTH &&
      c.height >= MIN_CARD_IMAGE_HEIGHT
  );
  if (qualifying.length === 0) return undefined;
  qualifying.sort((a, b) => a.width! * a.height! - b.width! * b.height!);
  return qualifying[0].url;
}

function extractFirstImage(item: CustomItem, rawHtml?: string): string | undefined {
  const contentToSearch = [
    item.contentEncoded,
    item.content,
    item.description,
    item.summary,
  ]
    .filter(Boolean)
    .join(' ');

  const contentGroups = contentToSearch ? extractContentImageGroups(contentToSearch) : [];
  const mediaContentImages = extractMediaImageCandidates(item.mediaContent);
  const mediaThumbnailImages = extractMediaImageCandidates(item.mediaThumbnail);

  const enclosureUrl =
    item.enclosure?.url &&
    !isLikelyTrackingImage(item.enclosure.url) &&
    (item.enclosure.type?.startsWith('image/') || isImageUrl(item.enclosure.url))
      ? item.enclosure.url
      : undefined;
  const enclosureImage: ImageCandidate | undefined = enclosureUrl
    ? { url: enclosureUrl, ...getUrlDimensions(enclosureUrl) }
    : undefined;

  // 1. Prefer the smallest source that is still large enough for a card. Feeds
  //    often expose the same photo at many widths (srcset, `?w=` params); using
  //    a 400px variant instead of a multi-megabyte original keeps decoding and
  //    scrolling cheap. The lead image is checked first, then media/enclosure.
  for (const group of contentGroups) {
    const best = pickCardSizedImage(group);
    if (best) return best;
  }
  const bestMedia = pickCardSizedImage(mediaContentImages);
  if (bestMedia) return bestMedia;
  const bestThumbnail = pickCardSizedImage(mediaThumbnailImages);
  if (bestThumbnail) return bestThumbnail;
  if (enclosureImage) {
    const bestEnclosure = pickCardSizedImage([enclosureImage]);
    if (bestEnclosure) return bestEnclosure;
  }

  // 2. No sized variant available: keep the historical precedence so nothing
  //    regresses for feeds that do not declare any dimensions. Candidates whose
  //    known size is below the card minimum are de-prioritised (a small image
  //    beats no image, but a decent one beats a tiny thumbnail).
  const usable = (c: ImageCandidate) => !isLikelyTrackingImage(c.url) && !isKnownTooSmall(c);

  if (enclosureImage && usable(enclosureImage)) return enclosureImage.url;

  const firstMediaContent = mediaContentImages.find(usable);
  if (firstMediaContent) return firstMediaContent.url;

  const firstThumbnail = mediaThumbnailImages.find(usable);
  if (firstThumbnail) return firstThumbnail.url;

  for (const group of contentGroups) {
    const first = group.find(usable);
    if (first) return first.url;
  }

  // 3. Last resort: accept a small thumbnail rather than showing no image at all.
  if (enclosureImage && !isLikelyTrackingImage(enclosureImage.url)) return enclosureImage.url;

  const anyMediaContent = mediaContentImages.find((c) => !isLikelyTrackingImage(c.url));
  if (anyMediaContent) return anyMediaContent.url;

  const anyThumbnail = mediaThumbnailImages.find((c) => !isLikelyTrackingImage(c.url));
  if (anyThumbnail) return anyThumbnail.url;

  for (const group of contentGroups) {
    const first = group.find((c) => !isLikelyTrackingImage(c.url));
    if (first) return first.url;
  }

  // 4. Check YouTube video thumbnail from link, ID, or content
  const ytId =
    extractYouTubeVideoId(item.link) ||
    extractYouTubeVideoId(item.id) ||
    (contentToSearch ? extractYouTubeVideoId(contentToSearch) : null);
  if (ytId) {
    return `https://img.youtube.com/vi/${ytId}/0.jpg`;
  }

  return undefined;
}

function extractYouTubeVideoId(str?: string | null): string | null {
  if (!str) return null;
  // Video IDs are always exactly 11 URL-safe chars; a bounded capture avoids
  // swallowing surrounding HTML when the link sits inside markup.
  const ID = '([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])';
  const vMatch = str.match(new RegExp('[?&]v=' + ID));
  if (vMatch && vMatch[1]) return vMatch[1];
  const shortsMatch = str.match(new RegExp('youtube\\.com/shorts/' + ID));
  if (shortsMatch && shortsMatch[1]) return shortsMatch[1];
  const shortMatch = str.match(new RegExp('youtu\\.be/' + ID));
  if (shortMatch && shortMatch[1]) return shortMatch[1];
  const atomMatch = str.match(/yt:video:([\w-]{11})(?![A-Za-z0-9_-])/i);
  if (atomMatch && atomMatch[1]) return atomMatch[1];
  const embedMatch = str.match(new RegExp('youtube\\.com/embed/' + ID));
  if (embedMatch && embedMatch[1]) return embedMatch[1];
  const vPathMatch = str.match(new RegExp('youtube\\.com/v/' + ID));
  if (vPathMatch && vPathMatch[1]) return vPathMatch[1];
  return null;
}

function extractVideo(item: CustomItem): string | undefined {
  // Check enclosure
  if (
    item.enclosure?.url &&
    (item.enclosure.type?.startsWith('video/') ||
      /\.(mp4|webm|m4v)(\?.*)?$/i.test(item.enclosure.url))
  ) {
    return item.enclosure.url;
  }

  // Check mediaContent for direct video files or streams
  if (Array.isArray(item.mediaContent) && item.mediaContent.length > 0) {
    for (const m of item.mediaContent) {
      const url = m?.$?.url || m?.url;
      const medium = m?.$?.medium || m?.medium;
      const type = m?.$?.type || m?.type;
      if (
        url &&
        (medium === 'video' ||
          type?.startsWith('video/') ||
          /\.(mp4|webm|m4v)(\?.*)?$/i.test(url))
      ) {
        return url;
      }
    }
  } else if (item.mediaContent) {
    const url = item.mediaContent?.$?.url || item.mediaContent?.url;
    const medium = item.mediaContent?.$?.medium || item.mediaContent?.medium;
    const type = item.mediaContent?.$?.type || item.mediaContent?.type;
    if (
      url &&
      (medium === 'video' ||
        type?.startsWith('video/') ||
        /\.(mp4|webm|m4v)(\?.*)?$/i.test(url))
    ) {
      return url;
    }
  }

  // Check YouTube in links, id, or content
  const contentToSearch = [item.contentEncoded, item.content, item.description]
    .filter(Boolean)
    .join(' ');

  const ytVideoId =
    extractYouTubeVideoId(item.link) ||
    extractYouTubeVideoId(item.id) ||
    (contentToSearch ? extractYouTubeVideoId(contentToSearch) : null);
  if (ytVideoId) {
    return `https://www.youtube.com/embed/${ytVideoId}`;
  }

  return undefined;
}

function toSafeString(val: any, fallback = ''): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (typeof val._ === 'string') return val._;
    if (typeof val.value === 'string') return val.value;
    if (typeof val.name === 'string') return val.name;
    if (typeof val['#text'] === 'string') return val['#text'];
    if (typeof val.$text === 'string') return val.$text;
    if (typeof val.title === 'string') return val.title;
  }
  return fallback;
}

function toSafeStringArray(arr: any): string[] {
  if (!arr) return [];
  const list = Array.isArray(arr) ? arr : [arr];
  return list
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        if (typeof item._ === 'string') return item._.trim();
        if (typeof item.value === 'string') return item.value.trim();
        if (typeof item.name === 'string') return item.name.trim();
        if (typeof item['#text'] === 'string') return item['#text'].trim();
        if (typeof item.$text === 'string') return item.$text.trim();
      }
      return '';
    })
    .filter(Boolean);
}

function extractAudio(item: CustomItem): string | undefined {
  if (
    item.enclosure?.url &&
    (item.enclosure.type?.startsWith('audio/') ||
      /\.(mp3|m4a|ogg|aac|wav)(\?.*)?$/i.test(item.enclosure.url))
  ) {
    return item.enclosure.url;
  }
  return undefined;
}

function cleanHtmlToSnippet(html?: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 320);
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
// Some feeds (e.g. politico.com) sit behind Cloudflare bot management that
// challenges a Node client pretending to be a browser (Chrome UA + Node's
// OpenSSL TLS = inconsistent fingerprint). Presenting as curl matches Node's
// OpenSSL TLS fingerprint, so the request passes the bot check.
const CURL_UA = 'curl/8.9.1';
const FEED_ACCEPT =
  'application/rss+xml, application/rdf+xml, application/atom+xml, application/xml, text/xml, */*;q=0.9';

// Hosts that answered 403 to a browser UA (Cloudflare bot management). Remembering
// them avoids sending a doomed request — and an extra Cloudflare challenge — on
// every refresh, which is what previously tripped the IP rate limit (error 1015).
const curlUaHosts = new Set<string>();

// DOM fetch Response, aliased so it cannot collide with a server reply type.
type FetchResponse = Awaited<ReturnType<typeof fetch>>;

// YouTube / Google feeds often answer 429 (rate limit) or time out, then work
// again hours later. Retry transient failures instead of failing at once.
const FETCH_MAX_ATTEMPTS = 3;
const FETCH_BASE_DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = 20000;
const FETCH_MAX_RETRY_AFTER_MS = 15000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Transient network failures worth retrying (reset connections, DNS, timeouts). */
function isRetryableNetworkError(err: any): boolean {
  const code =
    typeof err?.code === 'string'
      ? err.code
      : typeof err?.cause?.code === 'string'
      ? err.cause.code
      : '';
  return (
    err?.name === 'TimeoutError' ||
    err?.name === 'AbortError' ||
    [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EAI_AGAIN',
      'EPIPE',
      'UND_ERR_CONNECT_TIMEOUT',
      'UND_ERR_HEADERS_TIMEOUT',
      'UND_ERR_BODY_TIMEOUT',
    ].includes(code)
  );
}

/** Honor the server's Retry-After hint (seconds or HTTP date), capped. */
function getRetryAfterMs(response: FetchResponse): number {
  const raw = response.headers.get('retry-after');
  if (raw) {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, FETCH_MAX_RETRY_AFTER_MS);
    }
    const dateMs = Date.parse(raw);
    if (!Number.isNaN(dateMs)) {
      return Math.max(0, Math.min(dateMs - Date.now(), FETCH_MAX_RETRY_AFTER_MS));
    }
  }
  return 0;
}

async function fetchFeedText(url: string): Promise<string> {
  const host = new URL(url).host;
  const preferCurlUa = curlUaHosts.has(host);

  const request = (ua: string, signal: AbortSignal) =>
    fetch(url, {
      headers: { 'User-Agent': ua, Accept: FEED_ACCEPT },
      redirect: 'follow',
      signal,
    });

  const httpError = (status: number, statusText: string) =>
    new Error(`Failed to fetch feed (HTTP status: ${status} ${statusText})`);

  let lastError: any = null;
  for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: FetchResponse;
    try {
      response = await request(preferCurlUa ? CURL_UA : BROWSER_UA, controller.signal);
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < FETCH_MAX_ATTEMPTS && isRetryableNetworkError(err)) {
        await sleep(FETCH_BASE_DELAY_MS * attempt);
        continue;
      }
      throw err;
    }
    clearTimeout(timer);

    if (response.status === 403 && !preferCurlUa) {
      // Cloudflare-protected feed: retry once presenting as curl, and remember the
      // host so later fetches skip the browser UA entirely.
      const curlController = new AbortController();
      const curlTimer = setTimeout(() => curlController.abort(), FETCH_TIMEOUT_MS);
      try {
        response = await request(CURL_UA, curlController.signal);
      } finally {
        clearTimeout(curlTimer);
      }
      if (response.ok) curlUaHosts.add(host);
    }

    if (response.ok) return response.text();

    // Rate-limited or upstream hiccup: back off (honoring Retry-After) and retry.
    if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
      lastError = httpError(response.status, response.statusText);
      if (attempt < FETCH_MAX_ATTEMPTS) {
        await sleep(getRetryAfterMs(response) || FETCH_BASE_DELAY_MS * attempt);
        continue;
      }
    }

    throw httpError(response.status, response.statusText);
  }

  throw lastError ?? new Error('Failed to fetch feed.');
}

async function startServer() {
  const app = Fastify({ logger: false });
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3008;

  // API Route: RSS Feed Parser & Proxy
  app.get('/api/rss', async (request: FastifyRequest, reply: FastifyReply) => {
    const rawUrl = (request.query as { url?: string }).url;

    if (!rawUrl || typeof rawUrl !== 'string') {
      reply.code(400).send({ error: "The 'url' query parameter is required." });
      return;
    }

    let targetUrl = unwrapGoogleRedirectUrl(rawUrl.trim());
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
    // Unwrap again: a Google redirect URL only reveals its target once the
    // scheme is present (the bare `google.com/url?q=...` form has none).
    targetUrl = unwrapGoogleRedirectUrl(targetUrl);

    try {
      // Validate URL
      new URL(targetUrl);
    } catch {
      reply.code(400).send({ error: 'Invalid RSS feed URL.' });
      return;
    }

    try {
      const xmlText = await fetchFeedText(targetUrl);
      const parsed = await parser.parseString(xmlText);

      const feedImageUrl =
        typeof parsed.image === 'object' && parsed.image?.url
          ? parsed.image.url
          : typeof parsed.image === 'string'
          ? parsed.image
          : undefined;

      const items = (parsed.items || []).map((item, index) => {
        const id = toSafeString(
          item.guid || item.id || item.link,
          `item-${index}-${Date.now()}`
        );

        const imageUrl = extractFirstImage(item, xmlText);
        const videoUrl = extractVideo(item);
        const audioUrl = extractAudio(item);

        const rawContent = toSafeString(
          item.contentEncoded || item.content || item.description || ''
        );
        const snippet = toSafeString(
          item.contentSnippet || item.summary || cleanHtmlToSnippet(rawContent)
        );

        const title = toSafeString(item.title, 'Untitled').trim();
        const feedTitle = toSafeString(parsed.title, 'RSS Feed').trim();
        const creator = toSafeString(
          item.creator || item.author,
          feedTitle || undefined
        );
        const author = toSafeString(item.author || item.creator);
        const description = toSafeString(item.description);
        const categories = toSafeStringArray(item.categories);

        return {
          id: String(id),
          title,
          link: toSafeString(item.link, targetUrl),
          pubDate: toSafeString(item.pubDate || item.isoDate),
          isoDate: toSafeString(item.isoDate),
          creator,
          author,
          content: rawContent,
          contentSnippet: snippet,
          description,
          categories,
          imageUrl,
          videoUrl,
          audioUrl,
          enclosure: item.enclosure,
          feedTitle,
          feedUrl: targetUrl,
        };
      });

      // Google News RSS items point at news.google.com redirects; swap them for
      // the publisher's original article URL so links open the real source.
      await decodeGoogleNewsLinks(items);

      reply.send({
        metadata: {
          title: toSafeString(parsed.title, 'Unnamed RSS Feed'),
          description: toSafeString(parsed.description),
          link: toSafeString(parsed.link, targetUrl),
          feedUrl: targetUrl,
          lastBuildDate: toSafeString(parsed.lastBuildDate),
          imageUrl: feedImageUrl,
          itemCount: items.length,
        },
        items,
      });
    } catch (err: any) {
      console.error('Error fetching/parsing RSS feed:', err);
      reply.code(500).send({
        error:
          err.message ||
          'An error occurred while retrieving or parsing the RSS feed.',
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.send({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    // Fastify's underlying Node HTTP server is reused so Vite can attach its HMR
    // WebSocket to it. Sharing the same port (3008) avoids clashing with other
    // Vite dev servers that use Vite's default standalone HMR port (24678).
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: app.server },
      },
      appType: 'spa',
    });

    await app.register(fastifyMiddie);
    // Let Vite own every non-API request (assets, HMR client, index.html); the
    // `/api/*` routes stay on Fastify so Vite's SPA fallback cannot swallow them.
    app.use((req, res, next) => {
      if (req.url?.startsWith('/api/')) {
        next();
        return;
      }
      vite.middlewares(req, res, next);
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    await app.register(fastifyStatic, {
      root: distPath,
      // No catch-all route: unknown paths fall through to the SPA fallback below.
      wildcard: false,
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        reply.code(404).send({ error: 'Not found.' });
        return;
      }
      reply.sendFile('index.html');
    });
  }

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Server running on http://0.0.0.0:${PORT}`);
}

startServer();
