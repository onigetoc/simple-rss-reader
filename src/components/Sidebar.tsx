import React, { useState } from 'react';
import {
  Rss,
  Search,
  Bookmark,
  History,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Globe,
  Sun,
  Moon,
  Info,
  X,
  Layers,
} from 'lucide-react';
import { FeedItem, FeedMetadata } from '../types';
import { PRESET_FEEDS } from '../data/presets';
import { FeedHistoryItem } from '../services/rssService';

interface SidebarProps {
  currentUrl: string;
  onUrlChange: (newUrl: string) => void;
  onSubmitUrl: (urlToSubmit: string) => void;
  isLoading: boolean;
  metadata: FeedMetadata | null;
  favorites: FeedItem[];
  history: FeedHistoryItem[];
  onSelectFeed: (url: string) => void;
  onRemoveHistory: (url: string) => void;
  activeTab: 'feed' | 'favorites' | 'history' | 'presets';
  setActiveTab: (tab: 'feed' | 'favorites' | 'history' | 'presets') => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onRefresh: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onOpenChromeHelp: () => void;
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
  searchTerm,
  onSearchChange,
  onOpenChromeHelp,
  className = '',
  onCloseMobile,
}) => {
  const [copiedExtensionUrl, setCopiedExtensionUrl] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUrl.trim()) {
      onSubmitUrl(currentUrl.trim());
      if (onCloseMobile) onCloseMobile();
    }
  };

  const handleCopyChromeFormat = () => {
    const origin = window.location.origin;
    const sample = `${origin}/?rss=${encodeURIComponent(currentUrl || 'https://news.ycombinator.com/rss')}`;
    navigator.clipboard.writeText(sample);
    setCopiedExtensionUrl(true);
    setTimeout(() => setCopiedExtensionUrl(false), 2000);
  };

  return (
    <aside
      id="sidebar-panel"
      className={`w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col h-full bg-zinc-900/95 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800/80 text-zinc-100 ${className}`}
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <Rss className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              RSS Viewer
            </h1>
            <p className="text-[11px] text-zinc-400">Feed reader & URL gateway</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Primary RSS URL Input Box (Simplified, clean, intuitive) */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-900/50">
        <label
          htmlFor="rss-input"
          className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2"
        >
          RSS Feed URL <span className="text-amber-500 lowercase font-normal">(or ?rss=URL)</span>
        </label>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="relative">
            <input
              id="rss-input"
              type="url"
              value={currentUrl}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="Paste or enter feed URL..."
              className="w-full text-sm pl-3 pr-8 py-2.5 rounded-lg bg-zinc-800/90 border border-zinc-700/80 text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
            />
            {currentUrl && (
              <button
                type="button"
                onClick={() => onUrlChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                title="Clear input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isLoading || !currentUrl.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-zinc-950 font-bold text-xs tracking-wide transition-colors shadow-xs"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading feed...</span>
                </>
              ) : (
                <>
                  <span>Load Feed</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            {metadata && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="py-2.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs border border-zinc-700/60 transition-colors"
                title="Refresh feed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </form>

        {/* Chrome Extension integration helper badge */}
        <div className="mt-3 p-2.5 rounded-lg bg-amber-950/20 border border-amber-900/30 text-[11px] text-amber-200/90 flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-amber-300 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              Chrome Extension URL:
            </span>
            <button
              type="button"
              onClick={handleCopyChromeFormat}
              className="inline-flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 font-medium"
              title="Copy URL with ?rss= parameter"
            >
              {copiedExtensionUrl ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
          <code className="bg-black/40 px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-300 truncate">
            /?rss=YOUR_FEED_URL
          </code>
          <button
            type="button"
            onClick={onOpenChromeHelp}
            className="text-left text-[10px] text-amber-400/80 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1 mt-0.5"
          >
            <Info className="w-3 h-3" />
            How to configure with Chrome Extension?
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800/80 text-xs px-2 pt-1">
        <button
          type="button"
          onClick={() => setActiveTab('feed')}
          className={`flex-1 py-2.5 px-2 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'feed'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Feed</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 py-2.5 px-2 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'favorites'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>Favorites</span>
          {favorites.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
              {favorites.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className={`flex-1 py-2.5 px-2 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'presets'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Samples</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 px-2 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>History</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: CURRENT ACTIVE FEED */}
        {activeTab === 'feed' && (
          <div className="space-y-4">
            {metadata ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/60 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-bold text-white leading-tight">
                      {metadata.title}
                    </h2>
                    <span className="text-[10px] font-semibold bg-zinc-700/80 text-zinc-300 px-2 py-0.5 rounded-full flex-shrink-0">
                      {metadata.itemCount} articles
                    </span>
                  </div>

                  {metadata.description && (
                    <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">
                      {metadata.description}
                    </p>
                  )}

                  {metadata.link && (
                    <a
                      href={metadata.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-amber-400 hover:underline inline-flex items-center gap-1"
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
                    className="block text-[11px] font-medium text-zinc-400 mb-1"
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
                      className="w-full text-xs pl-8 pr-7 py-2 rounded-lg bg-zinc-800/80 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => onSearchChange('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
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
                <p className="text-[11px] text-zinc-400">
                  Enter an RSS URL above or select a sample feed from the Samples tab.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FAVORITES */}
        {activeTab === 'favorites' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">
                Bookmarked Articles ({favorites.length})
              </span>
              <span className="text-[10px]">Saved locally</span>
            </div>

            {favorites.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs space-y-2">
                <Bookmark className="w-7 h-7 mx-auto opacity-30 text-amber-500" />
                <p>No favorite articles saved.</p>
                <p className="text-[11px] text-zinc-400">
                  Click the bookmark icon on any article card to save it here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {favorites.map((fav) => (
                  <div
                    key={fav.id}
                    className="p-2.5 rounded-lg bg-zinc-800/70 border border-zinc-700/60 hover:bg-zinc-800 transition-colors flex flex-col gap-1 text-left"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="text-[10px] text-amber-400 font-medium truncate max-w-[170px]">
                        {fav.feedTitle || 'Feed'}
                      </span>
                      <a
                        href={fav.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-zinc-400 hover:text-zinc-200"
                        title="Open external article"
                      >
                        ↗
                      </a>
                    </div>
                    <a
                      href={fav.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-zinc-100 hover:text-amber-400 line-clamp-2"
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
            <p className="text-xs text-zinc-400">
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
                  className={`w-full p-2.5 rounded-lg text-left transition-all border ${
                    currentUrl === preset.url
                      ? 'bg-amber-950/30 border-amber-500/50 text-white'
                      : 'bg-zinc-800/60 border-zinc-700/60 hover:bg-zinc-800 text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-bold text-amber-400">{preset.title}</span>
                    <span className="text-[10px] text-zinc-400 font-medium px-1.5 py-0.5 rounded bg-zinc-700/50">
                      {preset.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 line-clamp-1">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300">Recent Feeds</span>
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
                    className="p-2.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 flex items-center justify-between gap-2 hover:bg-zinc-800 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectFeed(h.url);
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-xs font-semibold text-zinc-200 truncate hover:text-amber-400">
                        {h.title || h.url}
                      </p>
                      <p className="text-[10px] text-zinc-500 truncate">{h.url}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveHistory(h.url)}
                      className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
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
          className="hover:text-amber-400 flex items-center gap-1 transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          Extension setup
        </button>
      </div>
    </aside>
  );
};
