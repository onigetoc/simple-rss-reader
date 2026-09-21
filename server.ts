import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Parser from 'rss-parser';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 RSS-Viewer/1.0',
    Accept:
      'application/rss+xml, application/rdf+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8',
  },
  timeout: 15000,
});

function extractFirstImage(
  item: CustomItem,
  rawHtml?: string
): string | undefined {
  // 1. Direct enclosure image
  if (
    item.enclosure?.url &&
    (item.enclosure.type?.startsWith('image/') ||
      /\.(jpe?g|png|webp|gif|svg|avif)(\?.*)?$/i.test(item.enclosure.url))
  ) {
    return item.enclosure.url;
  }

  // 2. Media content
  if (Array.isArray(item.mediaContent) && item.mediaContent.length > 0) {
    for (const m of item.mediaContent) {
      const url = m?.$?.url || m?.url;
      const medium = m?.$?.medium || m?.medium;
      if (url && (medium === 'image' || /\.(jpe?g|png|webp|gif|svg|avif)(\?.*)?$/i.test(url))) {
        return url;
      }
    }
  } else if (item.mediaContent) {
    const url = item.mediaContent?.$?.url || item.mediaContent?.url;
    if (url) return url;
  }

  // 3. Media thumbnail
  if (Array.isArray(item.mediaThumbnail) && item.mediaThumbnail.length > 0) {
    const thumb = item.mediaThumbnail[0]?.$?.url || item.mediaThumbnail[0]?.url;
    if (thumb) return thumb;
  } else if (item.mediaThumbnail) {
    const thumb = item.mediaThumbnail?.$?.url || item.mediaThumbnail?.url;
    if (thumb) return thumb;
  }

  // 4. Regex extraction from content or description
  const contentToSearch = [
    item.contentEncoded,
    item.content,
    item.description,
    item.summary,
  ]
    .filter(Boolean)
    .join(' ');

  if (contentToSearch) {
    // Check standard src
    const imgMatch = contentToSearch.match(
      /<img[^>]+src=["'](https?:\/\/[^"'\s>]+)["']/i
    );
    if (imgMatch && imgMatch[1]) {
      if (!imgMatch[1].includes('feedburner') && !imgMatch[1].includes('/1x1.') && !imgMatch[1].includes('doubleclick')) {
        return imgMatch[1];
      }
    }

    // Check data-src or srcset
    const dataSrcMatch = contentToSearch.match(
      /<img[^>]+data-src=["'](https?:\/\/[^"'\s>]+)["']/i
    );
    if (dataSrcMatch && dataSrcMatch[1]) {
      return dataSrcMatch[1];
    }
  }

  // 5. Check YouTube video thumbnail from link, ID, or content
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
  const vMatch = str.match(/[?&]v=([^&#]*)/);
  if (vMatch && vMatch[1]) return vMatch[1];
  const shortsMatch = str.match(/youtube\.com\/shorts\/([^&#?]+)/);
  if (shortsMatch && shortsMatch[1]) return shortsMatch[1];
  const shortMatch = str.match(/youtu\.be\/([^&#?]+)/);
  if (shortMatch && shortMatch[1]) return shortMatch[1];
  const atomMatch = str.match(/yt:video:([\w-]{11})/i);
  if (atomMatch && atomMatch[1]) return atomMatch[1];
  const embedMatch = str.match(/youtube\.com\/embed\/([^&#?]+)/);
  if (embedMatch && embedMatch[1]) return embedMatch[1];
  const vPathMatch = str.match(/youtube\.com\/v\/([^&#?]+)/);
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: RSS Feed Parser & Proxy
  app.get('/api/rss', async (req: Request, res: Response) => {
    const rawUrl = req.query.url as string | undefined;

    if (!rawUrl || typeof rawUrl !== 'string') {
      res.status(400).json({ error: "The 'url' query parameter is required." });
      return;
    }

    let targetUrl = rawUrl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    try {
      // Validate URL
      new URL(targetUrl);
    } catch {
      res.status(400).json({ error: 'Invalid RSS feed URL.' });
      return;
    }

    try {
      // Fetch with node-fetch / native fetch first to get clean text with browser-like headers
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 RSS-Viewer/1.0',
          Accept:
            'application/rss+xml, application/rdf+xml, application/atom+xml, application/xml, text/xml, */*;q=0.9',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch feed (HTTP status: ${response.status} ${response.statusText})`
        );
      }

      const xmlText = await response.text();
      const parsed = await parser.parseString(xmlText);

      const feedImageUrl =
        typeof parsed.image === 'object' && parsed.image?.url
          ? parsed.image.url
          : typeof parsed.image === 'string'
          ? parsed.image
          : undefined;

      const items = (parsed.items || []).map((item, index) => {
        const id =
          item.guid ||
          item.id ||
          item.link ||
          `item-${index}-${Date.now()}`;

        const imageUrl = extractFirstImage(item, xmlText);
        const videoUrl = extractVideo(item);
        const audioUrl = extractAudio(item);

        const rawContent =
          item.contentEncoded || item.content || item.description || '';
        const snippet =
          item.contentSnippet ||
          item.summary ||
          cleanHtmlToSnippet(rawContent);

        return {
          id: String(id),
          title: (item.title || 'Untitled').trim(),
          link: item.link || targetUrl,
          pubDate: item.pubDate || item.isoDate,
          isoDate: item.isoDate,
          creator: item.creator || item.author || (parsed.title ? parsed.title : undefined),
          author: item.author || item.creator,
          content: rawContent,
          contentSnippet: snippet,
          description: item.description,
          categories: Array.isArray(item.categories) ? item.categories : [],
          imageUrl,
          videoUrl,
          audioUrl,
          enclosure: item.enclosure,
          feedTitle: parsed.title || 'RSS Feed',
          feedUrl: targetUrl,
        };
      });

      res.json({
        metadata: {
          title: parsed.title || 'Unnamed RSS Feed',
          description: parsed.description,
          link: parsed.link || targetUrl,
          feedUrl: targetUrl,
          lastBuildDate: parsed.lastBuildDate,
          imageUrl: feedImageUrl,
          itemCount: items.length,
        },
        items,
      });
    } catch (err: any) {
      console.error('Error fetching/parsing RSS feed:', err);
      res.status(500).json({
        error:
          err.message ||
          'An error occurred while retrieving or parsing the RSS feed.',
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
