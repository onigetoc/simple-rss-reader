/**
 * YouTube helper for extracting video IDs and thumbnail URLs
 * Based on the YouTube thumbnail generator logic:
 * Uses https://img.youtube.com/vi/{videoId}/0.jpg (big) or 2.jpg (small)
 */

export const Youtube = {
  /**
   * Extracts the YouTube video ID from various URL formats or returns the ID if already clean
   */
  getId(url?: string | null): string | null {
    if (!url) return null;
    const trimmed = url.trim();

    // 1. URL with ?v= or &v= parameter (e.g. https://www.youtube.com/watch?v=F4rBAf1wbq4)
    const vMatch = trimmed.match(/[?&]v=([^&#]*)/);
    if (vMatch && vMatch[1]) {
      return vMatch[1];
    }

    // 2. YouTube Shorts (e.g. https://www.youtube.com/shorts/F4rBAf1wbq4)
    const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([^&#?]+)/);
    if (shortsMatch && shortsMatch[1]) {
      return shortsMatch[1];
    }

    // 3. Short URL (e.g. https://youtu.be/F4rBAf1wbq4)
    const shortMatch = trimmed.match(/youtu\.be\/([^&#?]+)/);
    if (shortMatch && shortMatch[1]) {
      return shortMatch[1];
    }

    // 4. Atom feed yt:video:ID (e.g. yt:video:F4rBAf1wbq4)
    const atomMatch = trimmed.match(/yt:video:([\w-]{11})/i);
    if (atomMatch && atomMatch[1]) {
      return atomMatch[1];
    }

    // 5. Embed URL (e.g. https://www.youtube.com/embed/F4rBAf1wbq4)
    const embedMatch = trimmed.match(/youtube\.com\/embed\/([^&#?]+)/);
    if (embedMatch && embedMatch[1]) {
      return embedMatch[1];
    }

    // 6. Path URL (e.g. https://www.youtube.com/v/F4rBAf1wbq4)
    const vPathMatch = trimmed.match(/youtube\.com\/v\/([^&#?]+)/);
    if (vPathMatch && vPathMatch[1]) {
      return vPathMatch[1];
    }

    // 7. Bare 11-char ID
    if (/^[\w-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    return null;
  },

  /**
   * Returns the YouTube thumbnail URL
   * @param url YouTube video URL or ID
   * @param size 'big' (0.jpg) or 'small' (2.jpg) or 'hq' (hqdefault.jpg)
   */
  thumb(
    url?: string | null,
    size: 'small' | 'big' | 'hq' | 'mq' | 'max' = 'big'
  ): string | null {
    if (!url) return null;
    const video = this.getId(url);
    if (!video) return null;

    if (size === 'small') {
      return `https://img.youtube.com/vi/${video}/2.jpg`;
    }
    if (size === 'hq') {
      return `https://img.youtube.com/vi/${video}/hqdefault.jpg`;
    }
    if (size === 'mq') {
      return `https://img.youtube.com/vi/${video}/mqdefault.jpg`;
    }
    if (size === 'max') {
      return `https://img.youtube.com/vi/${video}/maxresdefault.jpg`;
    }

    // Default 'big' -> 0.jpg
    return `https://img.youtube.com/vi/${video}/0.jpg`;
  },

  /**
   * Checks if an URL corresponds to a YouTube video
   */
  isYoutube(url?: string | null): boolean {
    return Boolean(this.getId(url));
  },
};
