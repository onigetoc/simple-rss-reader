import React, { useEffect, useState, useMemo } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Share2,
  Check,
  Calendar,
  User,
  Volume2,
  Layers,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { FeedItem } from '../types';
import { Youtube } from '../utils/youtube';
import {
  ArticleFontSize,
  getStoredFontSize,
  setStoredFontSize,
} from '../services/rssService';

/**
 * Transforms article HTML so that every link opens in a new tab (_blank),
 * has secure rel="noopener noreferrer", and images don't leak referrers.
 */
function ensureBlankLinks(rawHtml?: string): string {
  if (!rawHtml) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    const links = doc.querySelectorAll('a');
    links.forEach((link) => {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
      if (!link.getAttribute('title')) {
        link.setAttribute('title', 'Opens in a new tab');
      }
    });

    const images = doc.querySelectorAll('img');
    images.forEach((img) => {
      img.setAttribute('loading', 'lazy');
      img.setAttribute('referrerpolicy', 'no-referrer');
    });

    return doc.body.innerHTML;
  } catch {
    return rawHtml.replace(
      /<a\b(?![^>]*\btarget=)([^>]*?)>/gi,
      '<a target="_blank" rel="noopener noreferrer"$1>'
    );
  }
}

interface ArticleReaderViewProps {
  article: FeedItem;
  onBack: () => void;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  nextTitle?: string;
  prevTitle?: string;
  isFavorite: boolean;
  onToggleFavorite: (item: FeedItem) => void;
  currentIndex: number;
  totalCount: number;
  fontSize?: ArticleFontSize;
  onFontSizeChange?: (size: ArticleFontSize) => void;
}

export const ArticleReaderView: React.FC<ArticleReaderViewProps> = ({
  article,
  onBack,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
  nextTitle,
  prevTitle,
  isFavorite,
  onToggleFavorite,
  currentIndex,
  totalCount,
  fontSize: propFontSize,
  onFontSizeChange,
}) => {
  const [copied, setCopied] = useState(false);
  // Default to stored font size preference so it is remembered across sessions
  const [internalFontSize, setInternalFontSize] = useState<ArticleFontSize>(() => getStoredFontSize());
  const currentFontSize = propFontSize ?? internalFontSize;

  const handleSetFontSize = (newSize: ArticleFontSize) => {
    setInternalFontSize(newSize);
    setStoredFontSize(newSize);
    if (onFontSizeChange) {
      onFontSizeChange(newSize);
    }
  };

  // Prepare article HTML with all links opening in target="_blank"
  const processedHtml = useMemo(() => {
    const raw = article.content || article.description || '';
    return ensureBlankLinks(raw);
  }, [article.content, article.description]);

  // Click delegation ensuring any link clicked opens in a new blank tab
  const handleArticleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    const link = target?.closest('a');
    if (link && link.href) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }
  };

  // Check YouTube video ID
  const ytVideoId =
    Youtube.getId(article.videoUrl) ||
    Youtube.getId(article.link) ||
    Youtube.getId(article.id);
  const effectiveVideoUrl = ytVideoId
    ? `https://www.youtube.com/embed/${ytVideoId}`
    : article.videoUrl;
  const isYoutubeThumbnail =
    article.imageUrl &&
    (article.imageUrl.includes('img.youtube.com') ||
      article.imageUrl.includes('ytimg.com') ||
      Boolean(ytVideoId));

  // Handle keyboard shortcuts (ArrowLeft, ArrowRight, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack();
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNext();
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        onPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasNext, hasPrev, onNext, onPrev, onBack]);

  // Scroll to top whenever article changes
  useEffect(() => {
    const mainContainer = document.getElementById('article-scroll-container');
    if (mainContainer) {
      mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [article.id]);

  const handleShare = () => {
    navigator.clipboard.writeText(article.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="relative flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden select-text">
      {/* Top Reader Navigation Bar */}
      <div className="h-14 flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800/80 px-4 sm:px-6 flex items-center justify-between gap-4 bg-white/90 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold transition-colors"
            title="Back to feed (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to feed</span>
          </button>

          <span className="text-xs text-zinc-400 dark:text-zinc-500 hidden sm:inline">
            Article {currentIndex + 1} of {totalCount}
          </span>
        </div>

        {/* Action icons & font size toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Font size toggle */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300">
            <button
              type="button"
              onClick={() => handleSetFontSize('normal')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                currentFontSize === 'normal'
                  ? 'bg-white dark:bg-zinc-900 text-amber-500 shadow-xs'
                  : 'hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
              title="Taille de texte normale (conservé en mémoire)"
              aria-label="Taille normale"
            >
              A
            </button>
            <button
              type="button"
              onClick={() => handleSetFontSize('large')}
              className={`px-2.5 py-1 rounded-md font-bold text-sm transition-colors ${
                currentFontSize === 'large'
                  ? 'bg-white dark:bg-zinc-900 text-amber-500 shadow-xs'
                  : 'hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
              title="Grossir le texte (conservé par défaut d'une session à l'autre)"
              aria-label="Grossir le texte"
            >
              A+
            </button>
          </div>

          {/* Bookmark */}
          <button
            type="button"
            onClick={() => onToggleFavorite(article)}
            className={`p-2 rounded-lg transition-colors border ${
              isFavorite
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
            title={isFavorite ? 'Remove from bookmarks' : 'Add to bookmarks'}
          >
            {isFavorite ? (
              <BookmarkCheck className="w-4 h-4 fill-current" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={handleShare}
            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            title="Copy article link"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-500" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </button>

          {/* External original article */}
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold transition-colors shadow-xs"
            title="Open original website in new tab"
          >
            <span>Original source</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* FLOATING PREVIOUS & NEXT NAVIGATION BUTTONS */}
      {hasPrev && (
        <button
          type="button"
          onClick={onPrev}
          className="fixed left-4 sm:left-6 md:left-88 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-zinc-900/90 text-white shadow-xl hover:bg-amber-500 hover:text-zinc-950 transition-all flex items-center justify-center border border-zinc-700 group focus:outline-hidden"
          title={`Previous article: ${prevTitle || ''} (←)`}
        >
          <ChevronLeft className="w-6 h-6 transform group-hover:-translate-x-0.5 transition-transform" />
          {prevTitle && (
            <span className="absolute left-14 bg-zinc-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-xl border border-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap max-w-xs truncate pointer-events-none hidden sm:block">
              {prevTitle}
            </span>
          )}
        </button>
      )}

      {hasNext && (
        <button
          type="button"
          onClick={onNext}
          className="fixed right-4 sm:right-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-zinc-900/90 text-white shadow-xl hover:bg-amber-500 hover:text-zinc-950 transition-all flex items-center justify-center border border-zinc-700 group focus:outline-hidden"
          title={`Next article: ${nextTitle || ''} (→)`}
        >
          <ChevronRight className="w-6 h-6 transform group-hover:translate-x-0.5 transition-transform" />
          {nextTitle && (
            <span className="absolute right-14 bg-zinc-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-xl border border-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap max-w-xs truncate pointer-events-none hidden sm:block">
              {nextTitle}
            </span>
          )}
        </button>
      )}

      {/* Main Reading Container */}
      <div
        id="article-scroll-container"
        className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-8"
      >
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Feed Title & Category Header */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            {article.feedTitle && (
              <span className="font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20">
                {article.feedTitle}
              </span>
            )}
            {article.categories && article.categories.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {article.categories.map((cat, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Article Main Headline */}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-zinc-950 dark:text-zinc-50 tracking-tight leading-tight">
            {article.title}
          </h1>

          {/* Article Meta row */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 border-y border-zinc-200 dark:border-zinc-800/80 py-3">
            {article.pubDate && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                {formatDate(article.pubDate)}
              </span>
            )}
            {article.creator && (
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-zinc-400" />
                {article.creator}
              </span>
            )}
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 ml-auto"
            >
              <span>Visit source website</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Hero Image if available (and not redundant with video player) */}
          {article.imageUrl && (!effectiveVideoUrl || !isYoutubeThumbnail) && (
            <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
              <img
                src={article.imageUrl}
                alt={article.title}
                className="w-full max-h-[500px] object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          {/* Video player if available */}
          {effectiveVideoUrl && (
            <div className="rounded-2xl overflow-hidden aspect-video bg-black shadow-lg">
              {effectiveVideoUrl.includes('youtube.com/embed') ? (
                <iframe
                  src={effectiveVideoUrl}
                  title={article.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={effectiveVideoUrl} controls className="w-full h-full" />
              )}
            </div>
          )}

          {/* Audio podcast player if available */}
          {article.audioUrl && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-zinc-900/90 border border-amber-200 dark:border-amber-900/40 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <Volume2 className="w-4 h-4" />
                <span>Podcast Episode / Audio Recording</span>
              </div>
              <audio src={article.audioUrl} controls className="w-full" />
            </div>
          )}

          {/* Full Article Content */}
          <div
            className={`prose prose-zinc dark:prose-invert max-w-none transition-all ${
              currentFontSize === 'large'
                ? 'text-lg sm:text-xl leading-relaxed [&_p]:text-lg sm:[&_p]:text-xl [&_p]:leading-relaxed [&_li]:text-lg sm:[&_li]:text-xl [&_div]:text-lg sm:[&_div]:text-xl'
                : 'text-base leading-relaxed [&_p]:text-base [&_p]:leading-relaxed [&_li]:text-base'
            } text-zinc-800 dark:text-zinc-200`}
          >
            {processedHtml ? (
              <div
                onClick={handleArticleContentClick}
                dangerouslySetInnerHTML={{ __html: processedHtml }}
                className={`space-y-4 [&_img]:rounded-xl [&_img]:max-w-full [&_img]:my-4 [&_a]:text-amber-600 dark:[&_a]:text-amber-400 [&_a]:underline hover:[&_a]:text-amber-700 dark:hover:[&_a]:text-amber-300 ${
                  currentFontSize === 'large'
                    ? 'text-lg sm:text-xl [&_p]:text-lg sm:[&_p]:text-xl [&_p]:leading-relaxed [&_li]:text-lg sm:[&_li]:text-xl [&_div]:text-lg sm:[&_div]:text-xl'
                    : 'text-base [&_p]:text-base [&_p]:leading-relaxed [&_li]:text-base'
                } break-words`}
              />
            ) : article.contentSnippet ? (
              <p
                className={`leading-relaxed text-zinc-700 dark:text-zinc-300 ${
                  currentFontSize === 'large' ? 'text-lg sm:text-xl leading-relaxed' : 'text-base'
                }`}
              >
                {article.contentSnippet}
              </p>
            ) : (
              <p className="italic text-zinc-400">
                No full content provided in the feed. Please consult the original article link below.
              </p>
            )}
          </div>

          {/* Bottom navigation & external link box */}
          <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to all articles</span>
            </button>

            <div className="flex items-center gap-3">
              {hasPrev && (
                <button
                  type="button"
                  onClick={onPrev}
                  className="px-3.5 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium transition-colors"
                >
                  ← Previous
                </button>
              )}
              {hasNext && (
                <button
                  type="button"
                  onClick={onNext}
                  className="px-3.5 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-medium transition-colors"
                >
                  Next →
                </button>
              )}
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <span>Full Article on Source</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
