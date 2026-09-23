/**
 * Server-only helpers for turning Google URLs into the URLs users actually
 * want:
 *   - Google News RSS article links (`news.google.com/rss/articles/...`) are
 *     decoded to the publisher's original article URL.
 *   - Google redirect links (`google.com/url?q=...`) are unwrapped.
 *
 * Decoding needs network access and Node-only HTML parsing, so this module is
 * imported by `server.ts` only and must never be pulled into the client bundle.
 */
import { GoogleDecoder } from 'google-news-url-decoder';

// `news.google.com/rss/articles/<id>` is what Google News RSS feeds emit;
// `articles/<id>` and `read/<id>` are the web variants. All three carry the
// base64 payload the decoder understands.
const GOOGLE_NEWS_ARTICLE_RE =
  /^https?:\/\/news\.google\.com\/(?:rss\/articles|articles|read)\//i;

/** True when a URL is a Google News article redirect the decoder can handle. */
export function isGoogleNewsUrl(url?: string | null): boolean {
  return Boolean(url) && GOOGLE_NEWS_ARTICLE_RE.test(url!);
}

/**
 * Unwrap a Google redirect URL (`https://www.google.com/url?q=<target>`).
 * Returns the input unchanged when it is not a Google redirect.
 */
export function unwrapGoogleRedirectUrl(urlStr: string): string {
  if (!urlStr) return urlStr;
  try {
    const parsed = new URL(urlStr);
    if (
      parsed.hostname.includes('google.') &&
      (parsed.pathname === '/url' || parsed.pathname === '/url/')
    ) {
      const target = parsed.searchParams.get('q') || parsed.searchParams.get('url');
      if (target) return target;
    }
  } catch {
    // not a URL — return as-is
  }
  return urlStr;
}

const googleNewsDecoder = new GoogleDecoder();

// `decodeBatch()` sleeps 200–500 ms per URL to look human, so a 100-item Google
// News feed takes about a minute. Decoding with a small pool of parallel
// `decode()` calls finishes in a few seconds instead; a failure just falls back
// to the original Google News link, so throttling stays harmless.
const DECODE_CONCURRENCY = 8;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Replace Google News redirect links with the original article URLs, in place.
 * Items that are not Google News links — or that fail to decode — are left
 * untouched so the reader always keeps a usable link.
 */
export async function decodeGoogleNewsLinks<T extends { link?: string }>(
  items: T[]
): Promise<void> {
  const targets = items.filter((item) => isGoogleNewsUrl(item.link));
  if (targets.length === 0) return;

  try {
    const results = await mapWithConcurrency(targets, DECODE_CONCURRENCY, (item) =>
      googleNewsDecoder.decode(item.link!)
    );
    results.forEach((result, index) => {
      const target = targets[index];
      if (target && result?.status && result.decoded_url) {
        target.link = result.decoded_url;
      }
    });
  } catch {
    // Best-effort: keep the original Google News links when decoding fails.
  }
}
