import React, { useState } from 'react';
import { Rss } from 'lucide-react';

interface FeedFaviconProps {
  /** Favicon URL (Google favicon service), or null/undefined for the fallback. */
  faviconUrl?: string | null;
  /**
   * Sizing classes applied to both the image and the fallback icon.
   * Defaults to 16px; pass e.g. `w-4 h-4 sm:w-5 sm:h-5` to match a title.
   */
  className?: string;
  /** Colour of the fallback RSS icon. */
  fallbackClassName?: string;
  /**
   * Draw a subtle rounded plate behind the image. Useful on plain backgrounds
   * so transparent icons stay visible; turn off inside a coloured badge.
   */
  withPlate?: boolean;
}

/**
 * Feed favicon with a graceful fallback: when the URL is missing or the image
 * fails to load, the Lucide RSS icon is shown instead.
 */
export const FeedFavicon: React.FC<FeedFaviconProps> = ({
  faviconUrl,
  className = 'w-4 h-4',
  fallbackClassName = 'text-amber-500',
  withPlate = true,
}) => {
  const [hasError, setHasError] = useState(false);

  if (faviconUrl && !hasError) {
    return (
      <img
        src={faviconUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setHasError(true)}
        className={`flex-shrink-0 rounded-sm object-contain ${
          withPlate ? 'bg-white/60 dark:bg-zinc-700/40' : ''
        } ${className}`}
      />
    );
  }

  return <Rss className={`flex-shrink-0 ${className} ${fallbackClassName}`} />;
};
