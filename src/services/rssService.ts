import { FeedItem, FeedMetadata, FeedResponse } from '../types';

const STORAGE_FAVORITES_KEY = 'rss_viewer_favorites_v1';
const STORAGE_HISTORY_KEY = 'rss_viewer_history_v1';
const STORAGE_THEME_KEY = 'rss_viewer_theme_v1';

export async function fetchFeed(url: string): Promise<FeedResponse> {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error("Please enter a valid RSS feed URL.");
  }

  // 1. Primary: Try our backend Express API
  try {
    const res = await fetch(`/api/rss?url=${encodeURIComponent(trimmed)}`);
    if (res.ok) {
      const data = await res.json();
      return data;
    } else {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 400) {
        throw new Error(errData.error || "Invalid or inaccessible feed URL.");
      }
      throw new Error(errData.error || `Server HTTP Error ${res.status}`);
    }
  } catch (backendError: any) {
    console.warn('Backend /api/rss failed, trying client CORS proxy fallback:', backendError);

    // 2. Fallback: allorigins or corsproxy for static resilience
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(trimmed)}`;
      const proxyRes = await fetch(proxyUrl);
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
        if (enclosureType.startsWith('image/') || /\.(jpe?g|png|webp|gif)/i.test(enclosureUrl)) {
          imageUrl = enclosureUrl;
        } else if (mediaUrl) {
          imageUrl = mediaUrl;
        } else {
          const imgMatch = (content || description).match(/<img[^>]+src=["'](https?:\/\/[^"'\s>]+)["']/i);
          if (imgMatch && imgMatch[1]) {
            imageUrl = imgMatch[1];
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
    return raw ? JSON.parse(raw) : [];
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
    return 'dark'; // Dark par défaut as requested
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
