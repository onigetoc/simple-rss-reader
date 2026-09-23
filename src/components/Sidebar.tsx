import React, { useState } from 'react';
import {
  Rss,
  Search,
  Bookmark,
  History,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Square,
  Trash2,
  Globe,
  Sun,
  Moon,
  Info,
  X,
  Layers,
  Newspaper,
} from 'lucide-react';
import { FeedItem, FeedMetadata } from '../types';
import { PRESET_FEEDS } from '../data/presets';
import { FeedHistoryItem, CachedFeedEntry } from '../services/rssService';
import { ConfirmDialog } from './ConfirmDialog';

interface SidebarProps {
  currentUrl: string;
  onUrlChange: (newUrl: string) => void;
  onSubmitUrl: (urlToSubmit: string) => void;
  isLoading: boolean;
  metadata: FeedMetadata | null;
  favorites: FeedItem[];
  history: FeedHistoryItem[];
  onSelectFeed: (url: string, updateInput?: boolean) => void;
  onRemoveHistory: (url: string) => void;
  activeTab: 'feed' | 'all-feeds' | 'favorites' | 'history' | 'presets';
  setActiveTab: (tab: 'feed' | 'all-feeds' | 'favorites' | 'history' | 'presets') => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onRefresh: () => void;
  onStop: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onOpenChromeHelp: () => void;
  cachedFeeds?: Record<string, CachedFeedEntry>;
  onClearCache?: () => void;
  onRemoveFeed?: (url: string) => void;
  onPreloadSamples?: () => void;
  className?: string;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUrl,
  onUrlChange,
  onSubmitUrl,
  isLoading,
  metadata,
  favorites,
  history,
  onSelectFeed,
  onRemoveHistory,
  activeTab,
  setActiveTab,
  theme,
  onToggleTheme,
  onRefresh,
  onStop,
  searchTerm,
  onSearchChange,
  onOpenChromeHelp,
  cachedFeeds = {},
  onClearCache,
  onRemoveFeed,
  onPreloadSamples,
  className = '',
  onCloseMobile,
}) => {
  const [feedSearch, setFeedSearch] = useState('');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const cachedFeedList = Object.values(cachedFeeds);
  const totalCachedArticles = cachedFeedList.reduce((acc, f) => acc + (f.items?.length || 0), 0);

  // Filter the "Loaded Feeds" list by feed title or URL.
  const normalizedFeedSearch = feedSearch.trim().toLowerCase();
  const filteredCachedFeedList = normalizedFeedSearch
    ? cachedFeedList.filter((f) => {
        const title = (f.metadata?.title || '').toLowerCase();
        return title.includes(normalizedFeedSearch) || f.url.toLowerCase().includes(normalizedFeedSearch);
      })
    : cachedFeedList;

  // Human-readable age of a cached feed ("just now", "12m ago", "2h ago").
  const formatCacheAge = (updatedAt?: number): string => {
    if (!updatedAt) return 'just now';
    const minutes = Math.floor((Date.now() - updatedAt) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUrl.trim()) {
      onSubmitUrl(currentUrl.trim());
      if (onCloseMobile) onCloseMobile();
    }
  };

  return (
    <aside
      id="sidebar-panel"
      className={`w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col h-full bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800/80 text-zinc-900 dark:text-zinc-100 ${className}`}
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <Rss className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
              RSS Viewer
            </h1>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Feed reader & URL gateway</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Primary RSS URL Input Box (Simplified, clean, intuitive) */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/50">
        <label
          htmlFor="rss-input"
          className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-2"
        >
          RSS Feed URL <span className="text-amber-500 lowercase font-normal">(or ?rss=URL)</span>
        </label>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <input
              id="rss-input"
              type="url"
              value={currentUrl}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="Paste or enter feed URL..."
              className="w-full text-sm pl-3 pr-8 py-2.5 rounded-lg bg-white dark:bg-zinc-800/90 border border-zinc-300 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
            />
            {currentUrl && (
              <button
                type="button"
                onClick={() => onUrlChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                title="Clear input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !currentUrl.trim()}
            className="flex-shrink-0 p-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-zinc-950 transition-colors shadow-xs cursor-pointer"
            title={isLoading ? 'Loading feed…' : 'Load feed'}
            aria-label="Load feed"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
          </button>

          {isLoading ? (
            <button
              type="button"
              onClick={onStop}
              className="flex-shrink-0 p-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 transition-colors cursor-pointer"
              title="Stop loading"
              aria-label="Stop loading"
            >
              <Square className="w-4 h-4" fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onRefresh}
              disabled={!currentUrl.trim()}
              className="flex-shrink-0 p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-700/60 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh feed from source"
              aria-label="Refresh feed from source"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800/80 text-xs px-1 pt-1 overflow-x-auto bg-zinc-50/60 dark:bg-zinc-900/30">
        <button
          type="button"
          onClick={() => setActiveTab('feed')}
          className={`py-2.5 px-2 font-medium flex items-center justify-center gap-1 border-b-2 transition-colors flex-shrink-0 cursor-pointer ${
            activeTab === 'feed'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Feed</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('all-feeds')}
          title="ALL Feeds (All in-memory RSS feeds sorted by date)"
          className={`py-2.5 px-2 font-medium flex items-center justify-center gap-1 border-b-2 transition-colors flex-shrink-0 cursor-pointer ${
            activeTab === 'all-feeds'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Newspaper className="w-3.5 h-3.5" />
          <span>ALL Feeds</span>
          {cachedFeedList.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px] font-bold">
              {cachedFeedList.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('favorites')}
          className={`py-2.5 px-2 font-medium flex items-center justify-center gap-1 border-b-2 transition-colors flex-shrink-0 cursor-pointer ${
            activeTab === 'favorites'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Favorites</span>
          {favorites.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[10px] font-bold">
              {favorites.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className={`py-2.5 px-2 font-medium flex items-center justify-center gap-1 border-b-2 transition-colors flex-shrink-0 cursor-pointer ${
            activeTab === 'presets'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Samples</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`py-2.5 px-2 font-medium flex items-center justify-center gap-1 border-b-2 transition-colors flex-shrink-0 cursor-pointer ${
            activeTab === 'history'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
              : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>History</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB: ALL FEEDS (IN-MEMORY AGGREGATION) */}
        {activeTab === 'all-feeds' && (
          <div className="space-y-4">
            {/* In-Memory Feed List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-0.5">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Loaded Feeds ({cachedFeedList.length})
                  {cachedFeedList.length > 0 && (
                    <span className="font-normal text-zinc-500 dark:text-zinc-400">
                      {' '}• {totalCachedArticles} article{totalCachedArticles === 1 ? '' : 's'}
                    </span>
                  )}
                </span>
                {cachedFeedList.length > 0 && onClearCache && (
                  <button
                    type="button"
                    onClick={() => setIsClearConfirmOpen(true)}
                    className="text-[11px] font-semibold text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1 transition-colors cursor-pointer"
                    title="Delete all feeds"
                    aria-label="Delete all feeds"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete All
                  </button>
                )}
              </div>

              {/* Quick search across the loaded feeds */}
              {cachedFeedList.length > 0 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={feedSearch}
                    onChange={(e) => setFeedSearch(e.target.value)}
                    placeholder="Search loaded feeds..."
                    className="w-full text-xs pl-8 pr-7 py-2 rounded-lg bg-white dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  />
                  {feedSearch && (
                    <button
                      type="button"
                      onClick={() => setFeedSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      title="Clear feed filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {cachedFeedList.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 text-xs space-y-3 bg-zinc-100 dark:bg-zinc-800/40 rounded-xl p-4 border border-zinc-200 dark:border-zinc-700/40">
                  <Newspaper className="w-7 h-7 mx-auto text-zinc-400 dark:text-zinc-500 opacity-50" />
                  <p>No feeds loaded in memory yet.</p>
                  {onPreloadSamples && (
                    <button
                      type="button"
                      onClick={onPreloadSamples}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs transition-colors cursor-pointer"
                    >
                      Preload Sample Feeds
                    </button>
                  )}
                </div>
              ) : filteredCachedFeedList.length === 0 ? (
                <div className="text-center py-5 px-3 text-zinc-500 text-xs bg-zinc-100 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700/40">
                  No loaded feed matches "{feedSearch}".
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCachedFeedList.map((f) => (
                    <div
                      key={f.url}
                      className="group p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          // Picking a feed from ALL Feeds loads it without overwriting the URL input.
                          onSelectFeed(f.url, false);
                          setActiveTab('feed');
                          if (onCloseMobile) onCloseMobile();
                        }}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate group-hover:text-amber-500 dark:group-hover:text-amber-400">
                          {f.metadata?.title || f.url}
                        </p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                          {f.items?.length || 0} articles
                          {f.updatedAt ? ` • cached ${formatCacheAge(f.updatedAt)}` : ''}
                        </p>
                      </button>

                      {onRemoveFeed && (
                        <button
                          type="button"
                          onClick={() => onRemoveFeed(f.url)}
                          className="flex-shrink-0 p-1.5 rounded-md text-zinc-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
                          title={`Remove "${f.metadata?.title || f.url}"`}
                          aria-label={`Remove ${f.metadata?.title || f.url}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}

                  {onPreloadSamples && (
                    <button
                      type="button"
                      onClick={onPreloadSamples}
                      className="w-full mt-2 py-2 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white text-xs border border-zinc-200 dark:border-zinc-700/60 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                      <span>Preload More Samples</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 1: CURRENT ACTIVE FEED */}
        {activeTab === 'feed' && (
          <div className="space-y-4">
            {metadata ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-bold text-zinc-900 dark:text-white leading-tight">
                      {metadata.title}
                    </h2>
                    <span className="text-[10px] font-semibold bg-zinc-200 dark:bg-zinc-700/80 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded-full flex-shrink-0">
                      {metadata.itemCount} articles
                    </span>
                  </div>

                  {metadata.description && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-3">
                      {metadata.description}
                    </p>
                  )}

                  {metadata.link && (
                    <a
                      href={metadata.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1"
                    >
                      <Globe className="w-3 h-3" />
                      Visit source website
                    </a>
                  )}
                </div>

                {/* Filter / Search within current feed */}
                <div>
                  <label
                    htmlFor="article-search-sidebar"
                    className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1"
                  >
                    Filter articles
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      id="article-search-sidebar"
                      type="text"
                      value={searchTerm}
                      onChange={(e) => onSearchChange(e.target.value)}
                      placeholder="Keyword, title, author..."
                      className="w-full text-xs pl-8 pr-7 py-2 rounded-lg bg-white dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => onSearchChange('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500 text-xs space-y-3">
                <Rss className="w-8 h-8 mx-auto opacity-30 text-amber-500" />
                <p>No feed loaded yet.</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Enter an RSS URL above or select a sample feed from the Samples tab.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FAVORITES */}
        {activeTab === 'favorites' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                Bookmarked Articles ({favorites.length})
              </span>
              <span className="text-[10px]">Saved locally</span>
            </div>

            {favorites.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs space-y-2">
                <Bookmark className="w-7 h-7 mx-auto opacity-30 text-amber-500" />
                <p>No favorite articles saved.</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Click the bookmark icon on any article card to save it here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {favorites.map((fav) => (
                  <div
                    key={fav.id}
                    className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex flex-col gap-1 text-left"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold truncate max-w-[170px]">
                        {fav.feedTitle || 'Feed'}
                      </span>
                      <a
                        href={fav.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        title="Open external article"
                      >
                        ↗
                      </a>
                    </div>
                    <a
                      href={fav.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:text-amber-600 dark:hover:text-amber-400 line-clamp-2"
                    >
                      {fav.title}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SAMPLES / PRESETS */}
        {activeTab === 'presets' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Select a ready-to-use popular feed:
            </p>
            <div className="space-y-2">
              {PRESET_FEEDS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    onSelectFeed(preset.url);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full p-2.5 rounded-lg text-left transition-all border cursor-pointer ${
                    currentUrl === preset.url
                      ? 'bg-amber-500/15 border-amber-500 text-amber-950 dark:text-white font-medium'
                      : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{preset.title}</span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium px-1.5 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-700/50">
                      {preset.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-1">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Recent Feeds</span>
              <span className="text-[10px]">{history.length} saved</span>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs space-y-2">
                <History className="w-7 h-7 mx-auto opacity-30 text-amber-500" />
                <p>No feed history yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <div
                    key={h.url}
                    className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectFeed(h.url);
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 truncate hover:text-amber-600 dark:hover:text-amber-400">
                        {h.title || h.url}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">{h.url}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveHistory(h.url)}
                      className="text-zinc-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                      title="Remove from history"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800/80 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
        <span>RSS Parser v3.13</span>
        <button
          type="button"
          onClick={onOpenChromeHelp}
          className="hover:text-amber-500 dark:hover:text-amber-400 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Info className="w-3.5 h-3.5" />
          Extension setup
        </button>
      </div>

      <ConfirmDialog
        isOpen={isClearConfirmOpen}
        destructive
        title="Delete all feeds?"
        message={
          <>
            This will permanently remove all <strong>{cachedFeedList.length}</strong> feed(s) and their{' '}
            <strong>{totalCachedArticles}</strong> cached article(s). This action cannot be undone.
          </>
        }
        confirmLabel="Delete All"
        cancelLabel="Cancel"
        onConfirm={() => {
          setIsClearConfirmOpen(false);
          onClearCache?.();
        }}
        onCancel={() => setIsClearConfirmOpen(false)}
      />
    </aside>
  );
};
