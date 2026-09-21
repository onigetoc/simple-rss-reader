import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Rss,
  RefreshCw,
  Search,
  LayoutGrid,
  List,
  Bookmark,
  ExternalLink,
  Menu,
  AlertCircle,
  Share2,
  Check,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { FeedItem, FeedMetadata, FeedResponse } from './types';
import { PRESET_FEEDS } from './data/presets';
import {
  fetchFeed,
  getSavedFavorites,
  saveFavorite,
  isItemFavorite,
  getFeedHistory,
  addToFeedHistory,
  removeFromHistory,
  getStoredTheme,
  setStoredTheme,
  FeedHistoryItem,
} from './services/rssService';
import { Sidebar } from './components/Sidebar';
import { FeedItemCard } from './components/FeedItemCard';
import { ArticleReaderView } from './components/ArticleReaderView';
import { ChromeExtensionHelpModal } from './components/ChromeExtensionHelpModal';

// Helper to remove accents and lower case for bulletproof searching
function normalizeText(text?: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function App() {
  // Theme state: dark by default
  const [theme, setTheme] = useState<'dark' | 'light'>(() => getStoredTheme());

  // Feed states
  const [inputUrl, setInputUrl] = useState<string>('');
  const [activeUrl, setActiveUrl] = useState<string>('');
  const [metadata, setMetadata] = useState<FeedMetadata | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Selected article for detailed reader view
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // Filter & View states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('cards');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'with-media'>('all');

  // Persistence: Favorites & History
  const [favorites, setFavorites] = useState<FeedItem[]>(() => getSavedFavorites());
  const [history, setHistory] = useState<FeedHistoryItem[]>(() => getFeedHistory());

  // Sidebar navigation tab
  const [activeTab, setActiveTab] = useState<'feed' | 'favorites' | 'history' | 'presets'>('feed');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Modals & UI helpers
  const [isChromeHelpOpen, setIsChromeHelpOpen] = useState<boolean>(false);
  const [copiedShareLink, setCopiedShareLink] = useState<boolean>(false);

  // Apply theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    setStoredTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Function to load a feed by URL
  const loadFeed = useCallback(async (urlToLoad: string, updateBrowserUrl = true) => {
    if (!urlToLoad || !urlToLoad.trim()) return;

    const trimmed = urlToLoad.trim();
    setIsLoading(true);
    setError(null);
    setInputUrl(trimmed);
    setActiveUrl(trimmed);
    setSelectedArticleId(null);

    // Update browser URL query parameter: ?rss=...
    if (updateBrowserUrl && typeof window !== 'undefined') {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('rss', trimmed);
      newUrl.searchParams.delete('article');
      window.history.pushState({ rss: trimmed, articleId: null }, '', newUrl.toString());
    }

    try {
      const result: FeedResponse = await fetchFeed(trimmed);
      setMetadata(result.metadata);
      setItems(result.items);

      // Save to history
      if (result.metadata?.title) {
        const updatedHistory = addToFeedHistory(trimmed, result.metadata.title);
        setHistory(updatedHistory);
      }

      // Update document title
      if (result.metadata?.title) {
        document.title = `${result.metadata.title} - RSS Viewer`;
      }
    } catch (err: any) {
      console.error('Error in loadFeed:', err);
      setError(
        err.message ||
          "Unable to load this RSS feed. Please verify the URL is valid and reachable."
      );
      setMetadata(null);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Filtered items with accent-insensitive search across all text fields
  const displayedItems = useMemo(() => {
    let list = activeTab === 'favorites' ? favorites : items;

    if (searchTerm.trim()) {
      const normalizedQuery = normalizeText(searchTerm.trim());
      list = list.filter((item) => {
        const titleNorm = normalizeText(item.title);
        const snippetNorm = normalizeText(item.contentSnippet);
        const descNorm = normalizeText(item.description);
        const contentNorm = normalizeText(item.content);
        const creatorNorm = normalizeText(item.creator);
        const authorNorm = normalizeText(item.author);
        const categoriesNorm = item.categories?.map(normalizeText).join(' ') || '';

        return (
          titleNorm.includes(normalizedQuery) ||
          snippetNorm.includes(normalizedQuery) ||
          descNorm.includes(normalizedQuery) ||
          contentNorm.includes(normalizedQuery) ||
          creatorNorm.includes(normalizedQuery) ||
          authorNorm.includes(normalizedQuery) ||
          categoriesNorm.includes(normalizedQuery)
        );
      });
    }

    if (mediaFilter === 'with-media') {
      list = list.filter((item) => Boolean(item.imageUrl || item.videoUrl || item.audioUrl));
    }

    return list;
  }, [activeTab, favorites, items, searchTerm, mediaFilter]);

  // Find currently selected article
  const selectedArticle = useMemo(() => {
    if (!selectedArticleId) return null;
    return displayedItems.find((item) => item.id === selectedArticleId) || null;
  }, [selectedArticleId, displayedItems]);

  const currentArticleIndex = useMemo(() => {
    if (!selectedArticleId) return -1;
    return displayedItems.findIndex((item) => item.id === selectedArticleId);
  }, [selectedArticleId, displayedItems]);

  // Open article in detail view
  const handleSelectArticle = useCallback(
    (item: FeedItem) => {
      setSelectedArticleId(item.id);
      if (typeof window !== 'undefined') {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('article', item.id);
        window.history.pushState(
          { rss: activeUrl || inputUrl, articleId: item.id },
          '',
          newUrl.toString()
        );
      }
      document.title = `${item.title} - RSS Viewer`;
    },
    [activeUrl, inputUrl]
  );

  // Close article view / back to list
  const handleBackToList = useCallback(() => {
    setSelectedArticleId(null);
    if (typeof window !== 'undefined') {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('article');
      window.history.pushState(
        { rss: activeUrl || inputUrl, articleId: null },
        '',
        newUrl.toString()
      );
    }
    if (metadata?.title) {
      document.title = `${metadata.title} - RSS Viewer`;
    } else {
      document.title = 'RSS Viewer';
    }
  }, [metadata, activeUrl, inputUrl]);

  // Next & Previous Navigation
  const handleNextArticle = useCallback(() => {
    if (currentArticleIndex >= 0 && currentArticleIndex < displayedItems.length - 1) {
      handleSelectArticle(displayedItems[currentArticleIndex + 1]);
    }
  }, [currentArticleIndex, displayedItems, handleSelectArticle]);

  const handlePrevArticle = useCallback(() => {
    if (currentArticleIndex > 0) {
      handleSelectArticle(displayedItems[currentArticleIndex - 1]);
    }
  }, [currentArticleIndex, displayedItems, handleSelectArticle]);

  // Inspect URL parameters on mount (?rss=... or ?url=... & ?article=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const searchParams = new URLSearchParams(window.location.search);
    const rssParam =
      searchParams.get('rss') ||
      searchParams.get('RSS') ||
      searchParams.get('url') ||
      searchParams.get('feed');

    const articleParam = searchParams.get('article');

    if (rssParam && rssParam.trim()) {
      setInputUrl(rssParam.trim());
      loadFeed(rssParam.trim(), false).then(() => {
        if (articleParam) {
          setSelectedArticleId(articleParam);
        }
      });
    } else {
      // Default initial feed: Hacker News or Wired
      const defaultUrl = PRESET_FEEDS[0].url; // The Verge
      setInputUrl(defaultUrl);
      loadFeed(defaultUrl, false);
    }

    // Listen to browser forward/back buttons
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const urlFromPop = params.get('rss') || params.get('url') || params.get('feed');
      const articleFromPop = params.get('article');

      if (urlFromPop && urlFromPop !== activeUrl) {
        loadFeed(urlFromPop, false);
      }

      setSelectedArticleId(articleFromPop || null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [loadFeed]);

  // Handle Favorites toggle
  const handleToggleFavorite = (item: FeedItem) => {
    const updated = saveFavorite(item);
    setFavorites(updated);
  };

  const handleRemoveHistory = (url: string) => {
    const updated = removeFromHistory(url);
    setHistory(updated);
  };

  const handleShareCurrentRssUrl = () => {
    if (typeof window === 'undefined') return;
    const shareableUrl = `${window.location.origin}/?rss=${encodeURIComponent(activeUrl || inputUrl)}`;
    navigator.clipboard.writeText(shareableUrl);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2000);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* SIDEBAR (Desktop & Mobile Drawer) */}
      <Sidebar
        currentUrl={inputUrl}
        onUrlChange={setInputUrl}
        onSubmitUrl={(url) => loadFeed(url, true)}
        isLoading={isLoading}
        metadata={metadata}
        favorites={favorites}
        history={history}
        onSelectFeed={(url) => loadFeed(url, true)}
        onRemoveHistory={handleRemoveHistory}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedArticleId(null);
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRefresh={() => loadFeed(activeUrl || inputUrl, false)}
        searchTerm={searchTerm}
        onSearchChange={(val) => {
          setSearchTerm(val);
          if (selectedArticleId) setSelectedArticleId(null);
        }}
        onOpenChromeHelp={() => setIsChromeHelpOpen(true)}
        className="hidden md:flex"
      />

      {/* Mobile Drawer Overlay */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <Sidebar
            currentUrl={inputUrl}
            onUrlChange={setInputUrl}
            onSubmitUrl={(url) => loadFeed(url, true)}
            isLoading={isLoading}
            metadata={metadata}
            favorites={favorites}
            history={history}
            onSelectFeed={(url) => loadFeed(url, true)}
            onRemoveHistory={handleRemoveHistory}
            activeTab={activeTab}
            setActiveTab={(tab) => {
              setActiveTab(tab);
              setSelectedArticleId(null);
            }}
            theme={theme}
            onToggleTheme={toggleTheme}
            onRefresh={() => loadFeed(activeUrl || inputUrl, false)}
            searchTerm={searchTerm}
            onSearchChange={(val) => {
              setSearchTerm(val);
              if (selectedArticleId) setSelectedArticleId(null);
            }}
            onOpenChromeHelp={() => setIsChromeHelpOpen(true)}
            className="relative z-50 w-80 h-full"
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
          />
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        {/* If an article is selected, show ArticleReaderView */}
        {selectedArticle ? (
          <ArticleReaderView
            article={selectedArticle}
            onBack={handleBackToList}
            onNext={handleNextArticle}
            onPrev={handlePrevArticle}
            hasNext={currentArticleIndex < displayedItems.length - 1}
            hasPrev={currentArticleIndex > 0}
            nextTitle={
              currentArticleIndex < displayedItems.length - 1
                ? displayedItems[currentArticleIndex + 1]?.title
                : undefined
            }
            prevTitle={
              currentArticleIndex > 0 ? displayedItems[currentArticleIndex - 1]?.title : undefined
            }
            isFavorite={isItemFavorite(selectedArticle, favorites)}
            onToggleFavorite={handleToggleFavorite}
            currentIndex={currentArticleIndex}
            totalCount={displayedItems.length}
          />
        ) : (
          /* OTHERWISE: FEED LIST VIEW */
          <>
            {/* Top Navigation Bar */}
            <header
              id="main-header"
              className="h-16 flex-shrink-0 border-b border-zinc-200 dark:border-zinc-800/80 px-4 sm:px-6 flex items-center justify-between gap-3 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-md sticky top-0 z-10"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="md:hidden p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  title="Open feed menu"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <div className="min-w-0 max-w-xs sm:max-w-sm lg:max-w-md">
                  <div className="flex items-center gap-2">
                    <h1 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {activeTab === 'favorites'
                        ? 'Bookmarked Articles'
                        : metadata?.title || 'RSS Feed Reader'}
                    </h1>
                    {metadata?.itemCount !== undefined && activeTab !== 'favorites' && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hidden sm:inline-block flex-shrink-0">
                        {displayedItems.length}
                        {searchTerm ? ` / ${items.length}` : ''} articles
                      </span>
                    )}
                  </div>
                  {activeUrl && activeTab !== 'favorites' && (
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      <span className="truncate">{activeUrl}</span>
                      {metadata?.link && (
                        <a
                          href={metadata.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 flex-shrink-0"
                        >
                          <span>Website</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* SEARCH BAR (Prominent & synced) */}
              <div className="relative hidden sm:block w-44 md:w-56 lg:w-72">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search articles..."
                  className="w-full text-xs pl-8 pr-7 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Action Controls: Media Filter, View Switcher, Share */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Media Filter Button */}
                <button
                  type="button"
                  onClick={() =>
                    setMediaFilter((prev) => (prev === 'all' ? 'with-media' : 'all'))
                  }
                  className={`p-2 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                    mediaFilter === 'with-media'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400'
                      : 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/80 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  title="Filter only articles with images or videos"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Media only</span>
                </button>

                {/* View Switcher */}
                <div className="hidden sm:flex items-center p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 text-zinc-500 dark:text-zinc-400">
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === 'cards'
                        ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-xs'
                        : 'hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                    title="Grid Cards view"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('compact')}
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === 'compact'
                        ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-xs'
                        : 'hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                    title="Compact List view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                {/* Share Link Button (?rss=...) */}
                <button
                  type="button"
                  onClick={handleShareCurrentRssUrl}
                  className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/60 transition-colors flex items-center gap-1.5 text-xs font-medium"
                  title="Copy link with ?rss= parameter to share or use with Chrome"
                >
                  {copiedShareLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="hidden sm:inline text-emerald-600 dark:text-emerald-400">
                        Link copied!
                      </span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Share</span>
                    </>
                  )}
                </button>
              </div>
            </header>

            {/* Mobile Search input (visible only on small screens) */}
            <div className="sm:hidden p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search in articles..."
                  className="w-full text-xs pl-9 pr-8 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Stream / Articles View */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Search Active Notification Bar */}
                {searchTerm && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
                    <span>
                      Filtering for <strong className="font-bold">"{searchTerm}"</strong>: found{' '}
                      <strong>{displayedItems.length}</strong> matching article(s).
                    </span>
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="font-semibold underline hover:text-amber-900 dark:hover:text-amber-100 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Clear search
                    </button>
                  </div>
                )}

                {/* Error Banner */}
                {error && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Error loading RSS feed</p>
                      <p className="text-xs opacity-90 leading-relaxed">{error}</p>
                      <div className="pt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => loadFeed(activeUrl || inputUrl, false)}
                          className="px-3 py-1.5 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
                        >
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => loadFeed(PRESET_FEEDS[0].url, true)}
                          className="px-3 py-1.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                        >
                          Load The Verge Sample
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Loading Skeleton */}
                {isLoading && (
                  <div
                    className={`grid gap-4 ${
                      viewMode === 'compact'
                        ? 'grid-cols-1'
                        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                    }`}
                  >
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="animate-pulse rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3"
                      >
                        <div className="w-full aspect-video bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
                        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
                        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
                        <div className="space-y-1.5 pt-2">
                          <div className="h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded" />
                          <div className="h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded w-5/6" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {!isLoading && !error && displayedItems.length === 0 && (
                  <div className="text-center py-16 px-4 space-y-4 max-w-md mx-auto">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
                      <Rss className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                        {searchTerm
                          ? 'No articles match your search'
                          : activeTab === 'favorites'
                          ? 'No bookmarked articles yet'
                          : 'No articles found in this feed'}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {searchTerm
                          ? `No results for "${searchTerm}". Try checking your spelling or clear the filter.`
                          : 'Select a feed from the left panel or enter a custom RSS URL to get started.'}
                      </p>
                    </div>
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                )}

                {/* Articles List */}
                {!isLoading && displayedItems.length > 0 && (
                  <div
                    className={`grid gap-5 ${
                      viewMode === 'compact'
                        ? 'grid-cols-1'
                        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                    }`}
                  >
                    {displayedItems.map((item) => (
                      <FeedItemCard
                        key={item.id}
                        item={item}
                        isFavorite={isItemFavorite(item, favorites)}
                        onToggleFavorite={handleToggleFavorite}
                        onSelectArticle={handleSelectArticle}
                        viewMode={viewMode}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Chrome Extension Help Modal */}
      <ChromeExtensionHelpModal
        isOpen={isChromeHelpOpen}
        onClose={() => setIsChromeHelpOpen(false)}
        currentFeedUrl={activeUrl || inputUrl}
      />
    </div>
  );
}
