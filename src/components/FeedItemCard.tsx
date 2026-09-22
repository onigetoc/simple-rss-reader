import React, { useEffect, useState } from 'react';
import {
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Calendar,
  User,
  Share2,
  Check,
  Volume2,
  BookOpen,
  Play,
} from 'lucide-react';
import { FeedItem } from '../types';
import { Youtube } from '../utils/youtube';
import { isImageTooSmall, isLikelyTrackingImage } from '../utils/imageFilter';

interface FeedItemCardProps {
  item: FeedItem;
  isFavorite: boolean;
  onToggleFavorite: (item: FeedItem) => void;
  onSelectArticle: (item: FeedItem) => void;
  viewMode?: 'cards' | 'compact';
}

export const FeedItemCard: React.FC<FeedItemCardProps> = ({
  item,
  isFavorite,
  onToggleFavorite,
  onSelectArticle,
  viewMode = 'cards',
}) => {
  const [copied, setCopied] = useState(false);

  // Detect YouTube ID and thumbnails
  const ytVideoId =
    Youtube.getId(item.videoUrl) ||
    Youtube.getId(item.link) ||
    Youtube.getId(item.id);
  const isYoutube = Boolean(ytVideoId);
  const ytThumbBig = ytVideoId ? Youtube.thumb(ytVideoId, 'big') : null;
  const ytThumbSmall = ytVideoId ? Youtube.thumb(ytVideoId, 'small') : null;

  // Skip image URLs that are obviously tracking pixels / spacers.
  const feedImageCandidate =
    item.imageUrl && !isLikelyTrackingImage(item.imageUrl) ? item.imageUrl : undefined;

  // Measure the real image once the browser decodes it: a 1x1 tracking pixel
  // must never be stretched into a big black box. 'pending' until then.
  const [feedImageStatus, setFeedImageStatus] = useState<'pending' | 'ok' | 'bad'>(
    feedImageCandidate ? 'pending' : 'bad'
  );

  // Re-validate when the item's image URL changes (e.g. feed refresh in place).
  useEffect(() => {
    setFeedImageStatus(feedImageCandidate ? 'pending' : 'bad');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.imageUrl]);

  // Effective images (prioritize a validated feed image, or YouTube thumbnail)
  const validFeedImage = feedImageStatus === 'ok' ? feedImageCandidate : undefined;
  const effectiveImageUrl = validFeedImage || ytThumbBig;
  const compactImageUrl = validFeedImage || ytThumbSmall || ytThumbBig;

  // Invisible probe that loads the candidate image off-screen so its natural
  // dimensions can be checked without ever showing a stretched placeholder.
  const imageProbe =
    feedImageStatus === 'pending' && feedImageCandidate ? (
      <img
        src={feedImageCandidate}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        onLoad={(e) => {
          const { naturalWidth, naturalHeight } = e.currentTarget;
          setFeedImageStatus(isImageTooSmall(naturalWidth, naturalHeight) ? 'bad' : 'ok');
        }}
        onError={() => setFeedImageStatus('bad')}
        className="pointer-events-none absolute h-px w-px opacity-0"
      />
    ) : null;

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(item.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;

      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  const formattedDate = formatDate(item.pubDate);

  // Clean description or fallback
  const displaySnippet =
    item.contentSnippet ||
    (item.description
      ? item.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240)
      : item.content
      ? item.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240)
      : '');

  // COMPACT VIEW
  if (viewMode === 'compact') {
    return (
      <article
        id={`article-${item.id}`}
        onClick={() => onSelectArticle(item)}
        className="group relative flex items-center justify-between gap-4 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/70 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-amber-500/40 dark:hover:border-amber-500/40 transition-all cursor-pointer"
      >
        {imageProbe}
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {compactImageUrl && (
            <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-100 dark:bg-zinc-800">
              <img
                src={compactImageUrl}
                alt=""
                onError={() => setFeedImageStatus('bad')}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                loading="lazy"
              />
              {isYoutube && (
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs">
                    <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              {item.feedTitle && (
                <span className="font-semibold text-amber-600 dark:text-amber-400 truncate max-w-[150px]">
                  {item.feedTitle}
                </span>
              )}
              {formattedDate && <span>• {formattedDate}</span>}
              {item.creator && (
                <span className="hidden sm:inline truncate max-w-[130px]">
                  • {item.creator}
                </span>
              )}
            </div>

            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-amber-500 transition-colors">
              {item.title}
            </h3>

            {displaySnippet && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate line-clamp-1">
                {displaySnippet}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onToggleFavorite(item)}
            className={`p-1.5 rounded-lg transition-colors ${
              isFavorite
                ? 'text-amber-500 bg-amber-500/10'
                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
            title={isFavorite ? 'Remove from bookmarks' : 'Add to bookmarks'}
          >
            {isFavorite ? (
              <BookmarkCheck className="w-4 h-4 fill-current" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </button>

          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Open original article in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </article>
    );
  }

  // CARDS VIEW
  return (
    <article
      id={`article-${item.id}`}
      onClick={() => onSelectArticle(item)}
      className="group relative rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/80 shadow-xs hover:shadow-xl hover:border-amber-500/40 dark:hover:border-amber-500/30 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer"
    >
      {imageProbe}
      {/* Media Header: Image or YouTube Thumbnail */}
      {effectiveImageUrl ? (
        <div className="relative w-full aspect-16/9 overflow-hidden bg-zinc-900">
          <img
            src={effectiveImageUrl}
            alt={item.title}
            onError={() => setFeedImageStatus('bad')}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            referrerPolicy="no-referrer"
            loading="lazy"
          />

          {isYoutube ? (
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform duration-200">
                <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-1" />
              </div>

              <div className="absolute top-3 right-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-black/80 text-white backdrop-blur-xs border border-white/10 shadow-md">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  YouTube
                </span>
              </div>

              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-semibold drop-shadow-md">
                <span className="flex items-center gap-1.5 opacity-90">
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  Click to open & watch
                </span>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
              <span className="text-white text-xs font-semibold flex items-center gap-1.5 drop-shadow-md">
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                Click to read article
              </span>
            </div>
          )}
        </div>
      ) : item.videoUrl && !item.videoUrl.includes('youtube') ? (
        <div className="relative aspect-video bg-zinc-900 w-full overflow-hidden flex items-center justify-center text-zinc-400 text-xs">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-amber-500" />
            <span>Video clip included</span>
          </div>
        </div>
      ) : null}

      {/* Podcast Audio badge if present */}
      {item.audioUrl && (
        <div className="px-5 pt-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800/40">
            <Volume2 className="w-3 h-3" />
            Audio podcast episode included
          </span>
        </div>
      )}

      {/* Card Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2.5">
          {/* Metadata Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-2 flex-wrap">
              {item.feedTitle && (
                <span className="font-semibold text-amber-600 dark:text-amber-400/90 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded text-[11px] border border-amber-200/50 dark:border-amber-800/40">
                  {item.feedTitle}
                </span>
              )}
              {formattedDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formattedDate}
                </span>
              )}
              {item.creator && (
                <span className="flex items-center gap-1 max-w-[140px] truncate">
                  <User className="w-3 h-3" />
                  {item.creator}
                </span>
              )}
            </div>

            {/* Top Action Buttons (Stop Propagation to not trigger select article) */}
            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={handleCopyLink}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Copy link"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => onToggleFavorite(item)}
                className={`p-1 rounded-md transition-colors ${
                  isFavorite
                    ? 'text-amber-500 bg-amber-500/10'
                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
                title={isFavorite ? 'Remove from bookmarks' : 'Add to bookmarks'}
              >
                {isFavorite ? (
                  <BookmarkCheck className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Article Title: clicking opens article view */}
          <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 leading-snug tracking-tight group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
            {item.title}
          </h2>

          {/* Short Description */}
          {displaySnippet ? (
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300/90 leading-relaxed line-clamp-3">
              {displaySnippet}
            </p>
          ) : (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">
              No summary provided in this feed. Click to read full article.
            </p>
          )}
        </div>

        {/* Card Footer */}
        <div
          className="pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-3 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Read Article in App button */}
          <button
            type="button"
            onClick={() => onSelectArticle(item)}
            className="inline-flex items-center gap-1.5 font-semibold text-zinc-700 dark:text-zinc-300 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>Read here</span>
          </button>

          {/* Blank link to original external article */}
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors group/link ml-auto"
            title="Open original article in a new tab"
          >
            <span>Original source</span>
            <ExternalLink className="w-3.5 h-3.5 transform group-hover/link:translate-x-0.5 transition-transform" />
          </a>
        </div>
      </div>
    </article>
  );
};
