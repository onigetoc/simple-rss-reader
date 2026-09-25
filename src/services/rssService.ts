import { FeedItem, FeedMetadata, FeedResponse } from '../types';
import { isLikelyTrackingImage } from '../utils/imageFilter';

const STORAGE_FAVORITES_KEY = 'rss_viewer_favorites_v1';
const STORAGE_HISTORY_KEY = 'rss_viewer_history_v1';
const STORAGE_THEME_KEY = 'rss_viewer_theme_v1';
const STORAGE_FONT_SIZE_KEY = 'rss_viewer_font_size_v1';
const STORAGE_FEEDS_CACHE_KEY = 'rss_viewer_feeds_cache_v2';
const STORAGE_CACHE_TTL_KEY = 'rss_viewer_cache_ttl_v1';

export type ArticleFontSize = 'normal' | 'large';

export function toSafeString(val: any, fallback = ''): string {
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

export function toSafeStringArray(arr: any): string[] {
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

export function sanitizeFeedItem(item: any): FeedItem {
  if (!item || typeof item !== 'object') {
    return {
      id: String(Math.random()),
      title: 'Untitled',
      link: '',
    };
  }

  return {
    ...item,
    id: toSafeString(item.id, String(item.link || Math.random())),
    title: toSafeString(item.title, 'Untitled').trim(),
    link: toSafeString(item.link),
    pubDate: toSafeString(item.pubDate),
    isoDate: toSafeString(item.isoDate),
    creator: toSafeString(item.creator),
    author: toSafeString(item.author),
    content: toSafeString(item.content),
    contentSnippet: toSafeString(item.contentSnippet),
    description: toSafeString(item.description),
    categories: toSafeStringArray(item.categories),
    feedTitle: toSafeString(item.feedTitle),
    feedUrl: toSafeString(item.feedUrl),
    // Drop tracking pixels / spacers that some feeds expose as the item image.
    imageUrl: (() => {
      const raw = toSafeString(item.imageUrl) || undefined;
      return raw && !isLikelyTrackingImage(raw) ? raw : undefined;
    })(),
  };
}

/** True when an error comes from an aborted fetch (user pressed Stop). */
export function isAbortError(err: any): boolean {
  return err?.name === 'AbortError' || err?.code === 'ABORT_ERR';
}

export async function fetchFeed(url: string, signal?: AbortSignal): Promise<FeedResponse> {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error("Please enter a valid RSS feed URL.");
  }

  // 1. Primary: Try our backend Express API
  try {
    const res = await fetch(`/api/rss?url=${encodeURIComponent(trimmed)}`, { signal });
    if (res.ok) {
      const data = await res.json();
      const sanitizedItems = (data.items || []).map(sanitizeFeedItem);
      return {
        metadata: {
          ...data.metadata,
          title: toSafeString(data.metadata?.title, 'RSS Feed'),
          description: toSafeString(data.metadata?.description),
        },
        items: sanitizedItems,
      };
    } else {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 400) {
        throw new Error(errData.error || "Invalid or inaccessible feed URL.");
      }
      throw new Error(errData.error || `Server HTTP Error ${res.status}`);
    }
  } catch (backendError: any) {
    // The user pressed Stop: don't fall back to the proxy, just propagate.
    if (isAbortError(backendError)) throw backendError;

    console.warn('Backend /api/rss failed, trying client CORS proxy fallback:', backendError);

    // 2. Fallback: allorigins or corsproxy for static resilience
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(trimmed)}`;
      const proxyRes = await fetch(proxyUrl, { signal });
      if (!proxyRes.ok) {
        throw new Error(`Failed to retrieve feed via proxy (HTTP ${proxyRes.status})`);
      }
      const xmlText = await proxyRes.text();

      const domParser = new DOMParser();
      const doc = domParser.parseFromString(xmlText, 'text/xml');

      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        throw new Error("The returned content is not valid XML.");
      }

      const channel = doc.querySelector('channel') || doc.querySelector('feed');
      const channelTitle = channel?.querySelector('title')?.textContent || 'RSS Feed';
      const channelDesc = channel?.querySelector('description')?.textContent || '';
      const channelLink = channel?.querySelector('link')?.textContent || trimmed;

      const xmlItems = Array.from(doc.querySelectorAll('item, entry'));
      const items: FeedItem[] = xmlItems.map((el, idx) => {
        const title = el.querySelector('title')?.textContent || 'Untitled';
        let link = el.querySelector('link')?.textContent || '';
        if (!link && el.querySelector('link')) {
          link = el.querySelector('link')?.getAttribute('href') || '';
        }

        const pubDate =
          el.querySelector('pubDate')?.textContent ||
          el.querySelector('published')?.textContent ||
          el.querySelector('updated')?.textContent ||
          '';

        const creator =
          el.querySelector('author name')?.textContent ||
          el.querySelector('creator')?.textContent ||
          el.querySelector('author')?.textContent ||
          channelTitle;

        const description =
          el.querySelector('description')?.textContent ||
          el.querySelector('summary')?.textContent ||
          '';

        const content =
          el.querySelector('content\\:encoded, content')?.textContent || description;

        // Image extraction
        const enclosure = el.querySelector('enclosure');
        const enclosureUrl = enclosure?.getAttribute('url') || '';
        const enclosureType = enclosure?.getAttribute('type') || '';

        const mediaContent = el.querySelector('media\\:content, content');
        const mediaUrl = mediaContent?.getAttribute('url');

        let imageUrl = '';
        const acceptImage = (u?: string | null): u is string =>
          Boolean(u) && !isLikelyTrackingImage(u);

        if (
          acceptImage(enclosureUrl) &&
          (enclosureType.startsWith('image/') || /\.(jpe?g|png|webp|gif)/i.test(enclosureUrl))
        ) {
          imageUrl = enclosureUrl;
        } else if (acceptImage(mediaUrl)) {
          imageUrl = mediaUrl;
        } else {
          // Keep scanning for the first real image, skipping tracking pixels.
          const imgRegex = /<img[^>]+src=["'](https?:\/\/[^"'\s>]+)["']/gi;
          let imgMatch: RegExpExecArray | null;
          while ((imgMatch = imgRegex.exec(content || description)) !== null) {
            if (acceptImage(imgMatch[1])) {
              imageUrl = imgMatch[1];
              break;
            }
          }
        }

        const cleanSnippet = (description || content)
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 280);

        return {
          id: el.querySelector('guid, id')?.textContent || link || `client-${idx}-${Date.now()}`,
          title: title.trim(),
          link: link || trimmed,
          pubDate,
          creator,
          description,
          content,
          contentSnippet: cleanSnippet,
          imageUrl: imageUrl || undefined,
          feedTitle: channelTitle,
          feedUrl: trimmed,
        };
      });

      return {
        metadata: {
          title: channelTitle,
          description: channelDesc,
          link: channelLink,
          feedUrl: trimmed,
          itemCount: items.length,
        },
        items,
      };
    } catch (fallbackError: any) {
      if (isAbortError(fallbackError)) throw fallbackError;
      throw new Error(
        backendError.message || fallbackError.message || "Unable to load this RSS feed."
      );
    }
  }
}

// Local Storage Helpers
export function getSavedFavorites(): FeedItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_FAVORITES_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.map(sanitizeFeedItem) : [];
  } catch {
    return [];
  }
}

export function saveFavorite(item: FeedItem): FeedItem[] {
  try {
    const list = getSavedFavorites();
    const exists = list.some((fav) => fav.id === item.id || (fav.link && fav.link === item.link));
    let updated: FeedItem[];
    if (exists) {
      updated = list.filter((fav) => fav.id !== item.id && fav.link !== item.link);
    } else {
      updated = [{ ...item, savedAt: Date.now() }, ...list];
    }
    localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function removeFavorite(id: string): FeedItem[] {
  try {
    const list = getSavedFavorites();
    const updated = list.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function isItemFavorite(item: FeedItem, favorites: FeedItem[]): boolean {
  return favorites.some((fav) => fav.id === item.id || (fav.link && fav.link === item.link));
}

// History of viewed feeds
export interface FeedHistoryItem {
  url: string;
  title: string;
  timestamp: number;
}

export function getFeedHistory(): FeedHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToFeedHistory(url: string, title: string): FeedHistoryItem[] {
  try {
    const history = getFeedHistory().filter((h) => h.url !== url);
    const updated = [{ url, title, timestamp: Date.now() }, ...history].slice(0, 15);
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function removeFromHistory(url: string): FeedHistoryItem[] {
  try {
    const updated = getFeedHistory().filter((h) => h.url !== url);
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

// Theme storage
export function getStoredTheme(): 'dark' | 'light' {
  try {
    const stored = localStorage.getItem(STORAGE_THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return 'dark'; // Dark by default
  } catch {
    return 'dark';
  }
}

export function setStoredTheme(theme: 'dark' | 'light'): void {
  try {
    localStorage.setItem(STORAGE_THEME_KEY, theme);
  } catch {
    // ignore
  }
}

// Reader font size storage (persisted across sessions)
export function getStoredFontSize(): ArticleFontSize {
  try {
    const stored = localStorage.getItem(STORAGE_FONT_SIZE_KEY);
    if (stored === 'normal' || stored === 'large') return stored;
    return 'normal';
  } catch {
    return 'normal';
  }
}

export function setStoredFontSize(size: ArticleFontSize): void {
  try {
    localStorage.setItem(STORAGE_FONT_SIZE_KEY, size);
  } catch {
    // ignore
  }
}

// In-memory & Persistent Feeds Cache
export interface CachedFeedEntry {
  url: string;
  metadata: FeedMetadata;
  items: FeedItem[];
  updatedAt: number;
  /**
   * URL of the feed's website favicon (Google favicon service). Only the URL is
   * stored, never the image itself. `null` means no domain could be derived, in
   * which case the UI falls back to its own RSS icon.
   */
  faviconUrl?: string | null;
}

/**
 * Canonical form of a feed URL, used to detect feeds already held in memory.
 * Two URLs pointing at the same feed but differing only by a missing scheme,
 * a `www.` prefix, a trailing slash, a default port or query-parameter order
 * collapse to the same key. Returns an empty string for unusable input.
 */
export function normalizeFeedUrl(rawUrl?: string | null): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const isDefaultPort =
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443');
    const port = parsed.port && !isDefaultPort ? `:${parsed.port}` : '';
    const path = parsed.pathname.replace(/\/+$/, '');
    const query = Array.from(parsed.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return `${host}${port}${path}${query ? `?${query}` : ''}`;
  } catch {
    // Not a parseable URL: fall back to a trimmed, lower-cased comparison.
    return trimmed.replace(/\/+$/, '').toLowerCase();
  }
}

/**
 * Key of a feed already present in the in-memory cache that is equivalent to
 * `url` (same feed, possibly a different URL spelling), or null when absent.
 */
export function findCachedFeedKey(
  url: string,
  cache: Record<string, CachedFeedEntry>
): string | null {
  const target = normalizeFeedUrl(url);
  if (!target) return null;
  for (const key of Object.keys(cache)) {
    if (normalizeFeedUrl(key) === target) return key;
  }
  return null;
}

/** How long a cached feed is considered fresh before a network refresh is attempted. */
export const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;

/** Cache durations offered in Settings. The stored value is the `ms` field. */
export const CACHE_TTL_OPTIONS: ReadonlyArray<{ label: string; ms: number }> = [
  { label: '5 minutes', ms: 5 * 60 * 1000 },
  { label: '15 minutes', ms: 15 * 60 * 1000 },
  { label: '30 minutes (default)', ms: 30 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '3 hours', ms: 3 * 60 * 60 * 1000 },
  { label: '12 hours', ms: 12 * 60 * 60 * 1000 },
  { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
];

/**
 * Cache duration configured by the user (Settings tab), in milliseconds.
 * Falls back to {@link DEFAULT_CACHE_TTL_MS} when unset or invalid.
 */
export function getStoredCacheTtlMs(): number {
  try {
    const raw = localStorage.getItem(STORAGE_CACHE_TTL_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return DEFAULT_CACHE_TTL_MS;
  } catch {
    return DEFAULT_CACHE_TTL_MS;
  }
}

export function setStoredCacheTtlMs(ms: number): void {
  try {
    if (Number.isFinite(ms) && ms > 0) {
      localStorage.setItem(STORAGE_CACHE_TTL_KEY, String(ms));
    }
  } catch {
    // ignore
  }
}

export function getCachedFeeds(): Record<string, CachedFeedEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_FEEDS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const sanitized: Record<string, CachedFeedEntry> = {};
    for (const [key, entry] of Object.entries(parsed)) {
      if (entry && typeof entry === 'object') {
        const castEntry = entry as CachedFeedEntry;
        sanitized[key] = {
          ...castEntry,
          metadata: {
            ...castEntry.metadata,
            title: toSafeString(castEntry.metadata?.title, 'RSS Feed'),
            description: toSafeString(castEntry.metadata?.description),
          },
          items: Array.isArray(castEntry.items)
            ? castEntry.items.map(sanitizeFeedItem)
            : [],
        };
      }
    }
    // Collapse URLs that point at the same feed — e.g. entries saved before
    // URL normalization existed, or two spellings of the same URL — keeping the
    // most recently updated entry so a feed can never appear twice in memory.
    const deduped: Record<string, CachedFeedEntry> = {};
    const keptKeyByNormalized = new Map<string, string>();
    for (const [key, entry] of Object.entries(sanitized)) {
      const normalized = normalizeFeedUrl(key) || `raw:${key}`;
      const keptKey = keptKeyByNormalized.get(normalized);
      if (!keptKey) {
        keptKeyByNormalized.set(normalized, key);
        deduped[key] = entry;
      } else if ((entry.updatedAt || 0) > (deduped[keptKey].updatedAt || 0)) {
        delete deduped[keptKey];
        keptKeyByNormalized.set(normalized, key);
        deduped[key] = entry;
      }
    }

    // Persist the cleanup when duplicates were actually collapsed.
    if (Object.keys(deduped).length !== Object.keys(sanitized).length) {
      try {
        localStorage.setItem(STORAGE_FEEDS_CACHE_KEY, JSON.stringify(deduped));
      } catch {
        // Persisting is best-effort: keep serving the deduped entries in memory.
      }
    }

    return deduped;
  } catch {
    return {};
  }
}

/** Returns the cached entry for a URL (any equivalent spelling), or null. */
export function getCachedFeedEntry(url: string): CachedFeedEntry | null {
  if (!url) return null;
  const cache = getCachedFeeds();
  const key = findCachedFeedKey(url, cache);
  return key ? cache[key] : null;
}

/**
 * True when the cached entry is still inside the freshness window.
 * A missing entry (or one without a timestamp) is always considered stale.
 */
export function isCacheEntryFresh(
  entry: CachedFeedEntry | null | undefined,
  ttlMs: number = getStoredCacheTtlMs()
): boolean {
  if (!entry || !entry.updatedAt) return false;
  return Date.now() - entry.updatedAt < ttlMs;
}

// Set when the latest saveFeedToCache() could not persist (localStorage
// quota). The UI consumes it to warn the user instead of silently losing data.
let lastCachePersistFailed = false;

/** True once if the latest cache save failed to persist; resets on read. */
export function consumeCachePersistFailed(): boolean {
  const failed = lastCachePersistFailed;
  lastCachePersistFailed = false;
  return failed;
}

export function saveFeedToCache(
  url: string,
  metadata: FeedMetadata,
  items: FeedItem[]
): Record<string, CachedFeedEntry> {
  const persist = (candidate: Record<string, CachedFeedEntry>): boolean => {
    try {
      localStorage.setItem(STORAGE_FEEDS_CACHE_KEY, JSON.stringify(candidate));
      return true;
    } catch {
      return false;
    }
  };

  try {
    const cache = getCachedFeeds();
    cache[url] = {
      url,
      metadata,
      items: items.map((it) => ({
        ...it,
        feedTitle: it.feedTitle || metadata.title,
        // Always group items under their cache key so lookups (favicon, per-feed
        // filter) stay consistent even when the server normalized the URL.
        feedUrl: url,
      })),
      updatedAt: Date.now(),
      faviconUrl: getGoogleFaviconUrl(metadata?.link || url),
    };

    // Cap cache at 30 feeds to stay performant
    let working: Record<string, CachedFeedEntry> = cache;
    const keys = Object.keys(cache);
    if (keys.length > 30) {
      const sortedKeys = keys.sort((a, b) => cache[b].updatedAt - cache[a].updatedAt);
      const pruned: Record<string, CachedFeedEntry> = {};
      for (const k of sortedKeys.slice(0, 30)) {
        pruned[k] = cache[k];
      }
      working = pruned;
    }

    if (persist(working)) return working;

    // Persist failed (usually localStorage quota). Never delete existing
    // feeds to make room: a failed refresh must not wipe the cache — keep
    // everything for this session and let the UI warn the user instead. The
    // newest changes simply won't survive a reload until space is freed.
    lastCachePersistFailed = true;
    console.warn(
      'Feed cache storage full: keeping all feeds for this session only. Delete unused feeds to free space.'
    );
    return working;
  } catch (err) {
    console.warn('Failed to save feed cache:', err);
    try {
      return getCachedFeeds();
    } catch {
      return {};
    }
  }
}

export function removeFeedFromCache(url: string): Record<string, CachedFeedEntry> {
  try {
    const cache = getCachedFeeds();
    delete cache[url];
    localStorage.setItem(STORAGE_FEEDS_CACHE_KEY, JSON.stringify(cache));
    return cache;
  } catch {
    try {
      return getCachedFeeds();
    } catch {
      return {};
    }
  }
}

export function clearFeedsCache(): void {
  try {
    localStorage.removeItem(STORAGE_FEEDS_CACHE_KEY);
  } catch {}
}

// Google's favicon service always returns an image for a domain (falling back
// to a generic globe), which is far simpler and more reliable than parsing each
// site for <link rel="icon"> ourselves. Only the URL is stored, never the image.
const MULTI_PART_TLDS = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'net.uk', 'sch.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.nz', 'net.nz', 'org.nz', 'govt.nz',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'com.br', 'net.br', 'org.br', 'gov.br',
  'co.in', 'net.in', 'org.in', 'gov.in',
  'co.za', 'org.za', 'net.za',
  'com.mx', 'com.ar', 'com.tr', 'com.cn', 'com.hk', 'com.sg', 'com.tw',
  'co.kr', 'or.kr', 'co.id', 'co.th', 'com.my', 'com.ph', 'com.vn',
]);

/**
 * Reduce a hostname to its registrable domain so the favicon lookup targets the
 * site itself rather than a feed subdomain: `feeds.bbci.co.uk` → `bbci.co.uk`,
 * `www.theverge.com` → `theverge.com`. Bare hostnames and IPs are kept as-is.
 */
export function getRegistrableDomain(hostname: string): string {
  const host = (hostname || '').toLowerCase().replace(/^www\./, '');
  if (!host) return '';
  // IPv4 / IPv6: no domain to reduce.
  if (/^[\d.]+$/.test(host) || host.includes(':')) return host;

  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  if (MULTI_PART_TLDS.has(parts.slice(-2).join('.'))) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/**
 * Build the Google favicon URL for a feed's website. Returns null when no
 * usable domain can be derived.
 */
export function getGoogleFaviconUrl(siteUrl?: string | null): string | null {
  const seed = (siteUrl || '').trim();
  if (!seed) return null;

  let candidate = seed;
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;

  try {
    const domain = getRegistrableDomain(new URL(candidate).hostname);
    if (!domain) return null;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  } catch {
    return null;
  }
}

/**
 * Returns all articles from all cached feeds in memory,
 * deduplicated and sorted by date in descending order (newest first).
 */
export function getAllCachedItemsSorted(cache: Record<string, CachedFeedEntry>): FeedItem[] {
  const seenIds = new Set<string>();
  const merged: FeedItem[] = [];

  const feeds = Object.values(cache);
  for (const feed of feeds) {
    for (const item of feed.items) {
      const uniqueKey = item.id || item.link;
      if (!seenIds.has(uniqueKey)) {
        seenIds.add(uniqueKey);
        merged.push({
          ...item,
          feedTitle: item.feedTitle || feed.metadata?.title || 'RSS Feed',
          feedUrl: item.feedUrl || feed.url,
        });
      }
    }
  }

  // Parse dates robustly
  const parseTime = (dateStr?: string): number => {
    if (!dateStr) return 0;
    const t = new Date(dateStr).getTime();
    return isNaN(t) ? 0 : t;
  };

  // Sort descending: newest to oldest
  merged.sort((a, b) => {
    const timeA = parseTime(a.isoDate || a.pubDate);
    const timeB = parseTime(b.isoDate || b.pubDate);
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    // Secondary fallback: compare titles
    return a.title.localeCompare(b.title);
  });

  return merged;
}

