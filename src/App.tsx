import React, { useEffect, useState, useCallback, useMemo, useRef, startTransition } from 'react';
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
  Newspaper,
  Layers,
  Sparkles,
  Info,
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
  getStoredFontSize,
  setStoredFontSize,
  ArticleFontSize,
  FeedHistoryItem,
  CachedFeedEntry,
  getCachedFeeds,
  saveFeedToCache,
  removeFeedFromCache,
  isCacheEntryFresh,
  clearFeedsCache,
  getAllCachedItemsSorted,
  isAbortError,
  findCachedFeedKey,
  getGoogleFaviconUrl,
} from './services/rssService';
import { Sidebar } from './components/Sidebar';
import { FeedItemCard } from './components/FeedItemCard';
import { FeedFavicon } from './components/FeedFavicon';
import { ArticleReaderView } from './components/ArticleReaderView';
import { ChromeExtensionHelpModal } from './components/ChromeExtensionHelpModal';
import { FeedFilterCombobox } from './components/FeedFilterCombobox';
import { ErrorBoundary } from './components/ErrorBoundary';

// Number of articles to display at a time
const PAGE_SIZE = 20;

// Helper to remove accents and lower case for bulletproof searching
function normalizeText(text?: any): string {
  if (!text) return '';
  const str = typeof text === 'string' ? text : text?._ || text?.value || text?.name || String(text);
  try {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  } catch {
    return String(str).toLowerCase();
  }
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

  // In-Memory Feeds Cache (all feeds visited and stored)
  const [cachedFeeds, setCachedFeeds] = useState<Record<string, CachedFeedEntry>>(() =>
    getCachedFeeds()
  );

  // Refs kept in sync so loadFeed can stay a stable callback without stale closures.
  const cachedFeedsRef = useRef<Record<string, CachedFeedEntry>>(cachedFeeds);
  const loadRequestRef = useRef<number>(0);
  // Controller for the in-flight feed fetch so the user can stop a slow load.
  const abortControllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    cachedFeedsRef.current = cachedFeeds;
  }, [cachedFeeds]);

  // Selected article for detailed reader view
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // Filter & View states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('cards');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'with-media'>('all');

  // ALL Feeds: filter the aggregated list down to a single feed + bulk refresh state
  const [allFeedsFilter, setAllFeedsFilter] = useState<string>('all');
  const [isRefreshingAll, setIsRefreshingAll] = useState<boolean>(false);

  // Reader font size: persisted in memory and localStorage across sessions
  const [fontSize, setFontSize] = useState<ArticleFontSize>(() => getStoredFontSize());

  const handleFontSizeChange = useCallback((newSize: ArticleFontSize) => {
    setFontSize(newSize);
    setStoredFontSize(newSize);
  }, []);

  // Pagination state: show 20 at a time by default
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  // Persistence: Favorites & History
  const [favorites, setFavorites] = useState<FeedItem[]>(() => getSavedFavorites());
  const [history, setHistory] = useState<FeedHistoryItem[]>(() => getFeedHistory());

  // Sidebar navigation tab
  const [activeTab, setActiveTab] = useState<'feed' | 'all-feeds' | 'favorites' | 'history' | 'presets'>('feed');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Modals & UI helpers
  const [isChromeHelpOpen, setIsChromeHelpOpen] = useState<boolean>(false);
  const [copiedShareLink, setCopiedShareLink] = useState<boolean>(false);

  // Transient info shown when the user tries to add a feed already in memory.
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);

  // Auto-dismiss the duplicate-feed notice.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

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

  // Function to load a feed by URL.
  // Serves a fresh cached copy instantly (30 min TTL) unless forceReload is true,
  // in which case it always fetches from the source and refreshes the cache.
  const loadFeed = useCallback(
    async (urlToLoad: string, updateBrowserUrl = true, forceReload = false, updateInput = true) => {
      if (!urlToLoad || !urlToLoad.trim()) return;

      const trimmed = urlToLoad.trim();

      // A feed already in memory must never be added a second time: resolve any
      // URL spelling that maps to an existing entry (missing scheme, `www.`,
      // trailing slash, query-parameter order…) back to its stored key.
      const existingKey = findCachedFeedKey(trimmed, cachedFeedsRef.current);
      const effectiveUrl = existingKey || trimmed;

      // Cancel any previous in-flight request before starting a new one.
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;

      const requestId = ++loadRequestRef.current;

      setError(null);
      // Selecting from ALL Feeds (updateInput = false) must not overwrite the URL field.
      if (updateInput) setInputUrl(effectiveUrl);
      setActiveUrl(effectiveUrl);
      setSelectedArticleId(null);

      // Update browser URL query parameter: ?rss=...
      if (updateBrowserUrl && typeof window !== 'undefined') {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('rss', effectiveUrl);
        newUrl.searchParams.delete('article');
        window.history.pushState({ rss: effectiveUrl, articleId: null }, '', newUrl.toString());
      }

      // Look up the in-memory cache (kept in a ref so this callback stays stable).
      const cachedEntry = !forceReload ? cachedFeedsRef.current[effectiveUrl] || null : null;

      // Cache hit: show the stored articles immediately (no loading flash / no network).
      if (cachedEntry) {
        setMetadata(cachedEntry.metadata);
        setItems(cachedEntry.items);

        if (cachedEntry.metadata?.title) {
          const updatedHistory = addToFeedHistory(trimmed, cachedEntry.metadata.title);
          setHistory(updatedHistory);
          document.title = `${cachedEntry.metadata.title} - RSS Viewer`;
        }

        // Still fresh: nothing else to do.
        if (isCacheEntryFresh(cachedEntry)) {
          setIsLoading(false);
          return;
        }
        // Stale: keep showing the cached articles while refreshing in the background.
      } else {
        setIsLoading(true);
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const result: FeedResponse = await fetchFeed(effectiveUrl, controller.signal);

        // Ignore responses from an outdated navigation.
        if (requestId !== loadRequestRef.current) return;

        setMetadata(result.metadata);
        setItems(result.items);

        // Save to persistent feeds cache (reusing the existing key when present,
        // so an equivalent URL can never create a duplicate entry).
        const updatedCache = saveFeedToCache(effectiveUrl, result.metadata, result.items);
        setCachedFeeds({ ...updatedCache });

        // Save to history
        if (result.metadata?.title) {
          const updatedHistory = addToFeedHistory(effectiveUrl, result.metadata.title);
          setHistory(updatedHistory);
          document.title = `${result.metadata.title} - RSS Viewer`;
        }
      } catch (err: any) {
        // Ignore errors from an outdated navigation or a user-triggered stop.
        if (requestId !== loadRequestRef.current) return;
        if (isAbortError(err)) return;

        console.error('Error in loadFeed:', err);
        // If we already have a (stale) cached copy, keep it instead of wiping the view.
        if (!cachedEntry) {
          setError(
            err.message ||
              'Unable to load this RSS feed. Please verify the URL is valid and reachable.'
          );
          setMetadata(null);
          setItems([]);
        }
      } finally {
        if (requestId === loadRequestRef.current) {
          setIsLoading(false);
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null;
          }
        }
      }
    },
    []
  );

  // Stop a feed that is taking too long to load.
  const handleStopLoading = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    // Invalidate the in-flight request so its callbacks don't touch the state.
    loadRequestRef.current++;
    setIsLoading(false);
  }, []);

  // Load a specific feed (URL input, loaded feeds, history, samples) and always
  // return to the single "Feed" view so the freshly loaded feed is displayed,
  // even if the user was browsing ALL Feeds, Favorites, History, etc.
  const handleSelectFeed = useCallback(
    (url: string, updateInput = true) => {
      setActiveTab('feed');
      setSelectedArticleId(null);
      loadFeed(url, true, false, updateInput);
    },
    [loadFeed]
  );

  // Add a feed from the URL input. A feed already held in memory is never added
  // again: instead we surface a notice and open the existing copy.
  const handleSubmitNewFeed = useCallback(
    (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) return;

      const existingKey = findCachedFeedKey(trimmed, cachedFeedsRef.current);
      if (existingKey) {
        setNotice({
          id: Date.now(),
          text: 'This feed is already in memory — opening the saved copy instead of adding it again.',
        });
        handleSelectFeed(existingKey);
        return;
      }

      setNotice(null);
      handleSelectFeed(trimmed);
    },
    [handleSelectFeed]
  );

  // All items currently cached in memory, merged and sorted by date (newest first)
  const allCachedItems = useMemo(() => {
    return getAllCachedItemsSorted(cachedFeeds);
  }, [cachedFeeds]);

  // Reset pagination to 20 whenever activeTab, search, mediaFilter, feed filter or activeUrl changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeTab, searchTerm, mediaFilter, allFeedsFilter, activeUrl]);

  // If the feed selected in the ALL Feeds filter is removed, fall back to "all"
  useEffect(() => {
    if (allFeedsFilter !== 'all' && !cachedFeeds[allFeedsFilter]) {
      setAllFeedsFilter('all');
    }
  }, [cachedFeeds, allFeedsFilter]);

  // The per-feed filter is meant to be a temporary view: reset it as soon as the
  // user leaves ALL Feeds, so re-entering always shows every feed again. This
  // prevents the "stuck on a single feed" trap.
  useEffect(() => {
    if (activeTab !== 'all-feeds') {
      setAllFeedsFilter('all');
    }
  }, [activeTab]);

  // Preload several sample feeds into memory
  const handlePreloadSamples = useCallback(async () => {
    setIsLoading(true);
    const sampleList = PRESET_FEEDS.slice(0, 4);
    for (const sample of sampleList) {
      try {
        const res = await fetchFeed(sample.url);
        saveFeedToCache(sample.url, res.metadata, res.items);
      } catch (e) {
        console.warn('Preload sample error:', e);
      }
    }
    setCachedFeeds(getCachedFeeds());
    setIsLoading(false);
  }, []);

  const handleClearCache = useCallback(() => {
    clearFeedsCache();
    setCachedFeeds({});
  }, []);

  // Re-fetch every feed currently held in memory from its source and refresh the cache.
  const handleRefreshAllFeeds = useCallback(async () => {
    const urls = Object.keys(cachedFeedsRef.current);
    if (urls.length === 0) return;

    setIsRefreshingAll(true);
    try {
      const results = await Promise.allSettled(
        urls.map(async (url) => ({ url, res: await fetchFeed(url) }))
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          saveFeedToCache(result.value.url, result.value.res.metadata, result.value.res.items);
        } else {
          console.warn('Refresh all feeds: one feed failed', result.reason);
        }
      }

      const refreshed = getCachedFeeds();
      setCachedFeeds(refreshed);

      // Keep the currently open feed in sync if it was part of the refresh.
      const activeEntry = activeUrl ? refreshed[activeUrl] : null;
      if (activeEntry) {
        setMetadata(activeEntry.metadata);
        setItems(activeEntry.items);
      }
    } finally {
      setIsRefreshingAll(false);
    }
  }, [activeUrl]);

  // Remove a single feed from the in-memory/localStorage cache (and its history entry)
  const handleRemoveFeedFromCache = useCallback(
    (url: string) => {
      const updatedCache = removeFeedFromCache(url);
      setCachedFeeds({ ...updatedCache });

      const updatedHistory = removeFromHistory(url);
      setHistory(updatedHistory);

      // If the removed feed is currently displayed, clear the active view too.
      if (activeUrl === url || inputUrl === url) {
        setMetadata(null);
        setItems([]);
        setError(null);
      }
    },
    [activeUrl, inputUrl]
  );

  // Filtered items with accent-insensitive search across all text fields
  const displayedItems = useMemo(() => {
    let list =
      activeTab === 'favorites'
        ? favorites
        : activeTab === 'all-feeds'
        ? allCachedItems
        : items;

    // ALL Feeds: optionally narrow the aggregated list to a single feed
    if (activeTab === 'all-feeds' && allFeedsFilter !== 'all') {
      list = list.filter((item) => (item.feedUrl || '') === allFeedsFilter);
    }

    if (searchTerm.trim()) {
      const normalizedQuery = normalizeText(searchTerm.trim());
      list = list.filter((item) => {
        const titleNorm = normalizeText(item.title);
        const snippetNorm = normalizeText(item.contentSnippet);
        const descNorm = normalizeText(item.description);
        const contentNorm = normalizeText(item.content);
        const creatorNorm = normalizeText(item.creator);
        const authorNorm = normalizeText(item.author);
        const feedTitleNorm = normalizeText(item.feedTitle);
        const categoriesNorm = item.categories?.map(normalizeText).join(' ') || '';

        return (
          titleNorm.includes(normalizedQuery) ||
          snippetNorm.includes(normalizedQuery) ||
          descNorm.includes(normalizedQuery) ||
          contentNorm.includes(normalizedQuery) ||
          creatorNorm.includes(normalizedQuery) ||
          authorNorm.includes(normalizedQuery) ||
          feedTitleNorm.includes(normalizedQuery) ||
          categoriesNorm.includes(normalizedQuery)
        );
      });
    }

    if (mediaFilter === 'with-media') {
      list = list.filter((item) => Boolean(item.imageUrl || item.videoUrl || item.audioUrl));
    }

    return list;
  }, [activeTab, favorites, allCachedItems, items, searchTerm, mediaFilter, allFeedsFilter]);

  // 20-at-a-time paginated list of items for the grid/cards view
  const paginatedItems = useMemo(() => {
    return displayedItems.slice(0, visibleCount);
  }, [displayedItems, visibleCount]);

  // Find currently selected article
  const selectedArticle = useMemo(() => {
    if (!selectedArticleId) return null;
    return displayedItems.find((item) => item.id === selectedArticleId) || null;
  }, [selectedArticleId, displayedItems]);

  // Favicon of the feed the open article comes from: prefer the favicon stored
  // in the feed cache, fall back to deriving it from the feed URL.
  const selectedArticleFaviconUrl = useMemo(() => {
    if (!selectedArticle) return null;
    const feedUrl = selectedArticle.feedUrl || '';
    const key = findCachedFeedKey(feedUrl, cachedFeeds);
    return (key ? cachedFeeds[key]?.faviconUrl : null) || getGoogleFaviconUrl(feedUrl);
  }, [selectedArticle, cachedFeeds]);

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

  // Handle Favorites toggle. Stable identity matters: FeedItemCard is memoized
  // and receives this handler, so a new function per render would defeat it.
  const handleToggleFavorite = useCallback((item: FeedItem) => {
    const updated = saveFavorite(item);
    setFavorites(updated);
  }, []);

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
        onSubmitUrl={handleSubmitNewFeed}
        isLoading={isLoading}
        metadata={metadata}
        favorites={favorites}
        history={history}
        onSelectFeed={handleSelectFeed}
        onRemoveHistory={handleRemoveHistory}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'all-feeds') setAllFeedsFilter('all');
          setSelectedArticleId(null);
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRefresh={() => loadFeed(activeUrl || inputUrl, false, true)}
        onStop={handleStopLoading}
        searchTerm={searchTerm}
        onSearchChange={(val) => {
          setSearchTerm(val);
          if (selectedArticleId) setSelectedArticleId(null);
        }}
        onOpenChromeHelp={() => setIsChromeHelpOpen(true)}
        cachedFeeds={cachedFeeds}
        onClearCache={handleClearCache}
        onRemoveFeed={handleRemoveFeedFromCache}
        onPreloadSamples={handlePreloadSamples}
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
            onSubmitUrl={handleSubmitNewFeed}
            isLoading={isLoading}
            metadata={metadata}
            favorites={favorites}
            history={history}
            onSelectFeed={handleSelectFeed}
            onRemoveHistory={handleRemoveHistory}
            activeTab={activeTab}
            setActiveTab={(tab) => {
              setActiveTab(tab);
              if (tab === 'all-feeds') setAllFeedsFilter('all');
              setSelectedArticleId(null);
            }}
            theme={theme}
            onToggleTheme={toggleTheme}
            onRefresh={() => loadFeed(activeUrl || inputUrl, false, true)}
            onStop={handleStopLoading}
            searchTerm={searchTerm}
            onSearchChange={(val) => {
              setSearchTerm(val);
              if (selectedArticleId) setSelectedArticleId(null);
            }}
            onOpenChromeHelp={() => setIsChromeHelpOpen(true)}
            cachedFeeds={cachedFeeds}
            onClearCache={handleClearCache}
            onRemoveFeed={handleRemoveFeedFromCache}
            onPreloadSamples={handlePreloadSamples}
            className="relative z-50 w-80 h-full"
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
          />
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="relative flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        {/* If an article is selected, show ArticleReaderView */}
        {selectedArticle ? (
          <ErrorBoundary
            fallbackTitle="Unable to display this article"
            onReset={handleBackToList}
          >
            <ArticleReaderView
              article={selectedArticle}
              onBack={handleBackToList}
              onNext={handleNextArticle}
              onPrev={handlePrevArticle}
              hasNext={currentArticleIndex < displayedItems.length - 1}
              hasPrev={currentArticleIndex > 0}
              faviconUrl={selectedArticleFaviconUrl}
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
              fontSize={fontSize}
              onFontSizeChange={handleFontSizeChange}
            />
          </ErrorBoundary>
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
                    {activeTab === 'feed' && activeUrl && (
                      <FeedFavicon
                        faviconUrl={cachedFeeds[activeUrl]?.faviconUrl ?? null}
                        className="w-4 h-4 sm:w-5 sm:h-5"
                      />
                    )}
                    <h1 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {activeTab === 'favorites'
                        ? 'Bookmarked Articles'
                        : activeTab === 'all-feeds'
                        ? 'ALL Feeds (In Memory)'
                        : metadata?.title || 'RSS Feed Reader'}
                    </h1>
                    {activeTab === 'feed' && metadata?.itemCount !== undefined && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hidden sm:inline-block flex-shrink-0">
                        {displayedItems.length}
                        {searchTerm ? ` / ${items.length}` : ''} articles
                      </span>
                    )}
                    {activeTab === 'all-feeds' && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 hidden sm:inline-block flex-shrink-0">
                        {displayedItems.length} articles • {Object.keys(cachedFeeds).length} feeds
                      </span>
                    )}
                  </div>
                  {activeTab === 'all-feeds' ? (
                    <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      <span>All in-memory RSS feeds sorted chronologically (newest first) • 20 at a time</span>
                    </div>
                  ) : activeUrl && activeTab !== 'favorites' ? (
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
                  ) : null}
                </div>
              </div>

              {/* SEARCH BAR (Prominent & synced) */}
              <div className="relative hidden sm:block w-44 md:w-56 lg:w-72">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={
                    activeTab === 'all-feeds'
                      ? 'Search all in-memory feeds...'
                      : 'Search articles...'
                  }
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

              {/* Action Controls: ALL Feeds, Media Filter, View Switcher, Share */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* ALL Feeds Tooltip Button */}
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => {
                      // Entering ALL Feeds always starts from the full list.
                      setAllFeedsFilter('all');
                      setActiveTab((prev) => (prev === 'all-feeds' ? 'feed' : 'all-feeds'));
                      setSelectedArticleId(null);
                    }}
                    title="ALL Feeds"
                    aria-label="ALL Feeds"
                    className={`p-2 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-all shadow-xs ${
                      activeTab === 'all-feeds'
                        ? 'bg-amber-500 text-zinc-950 border-amber-400 font-bold ring-2 ring-amber-500/30'
                        : 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/80 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    <Newspaper className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">ALL Feeds</span>
                    {Object.keys(cachedFeeds).length > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          activeTab === 'all-feeds'
                            ? 'bg-zinc-950/25 text-zinc-950'
                            : 'bg-amber-500/20 text-amber-500'
                        }`}
                      >
                        {Object.keys(cachedFeeds).length}
                      </span>
                    )}
                  </button>

                  {/* Floating visual tooltip */}
                  <div className="absolute right-0 top-full mt-2 hidden group-hover:flex flex-col items-end z-50 pointer-events-none">
                    <div className="bg-zinc-900 text-white text-[11px] font-medium py-1.5 px-3 rounded-md shadow-xl border border-zinc-700 whitespace-nowrap">
                      ALL Feeds • All RSS in memory sorted by date (20 at a time)
                    </div>
                  </div>
                </div>

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

            {/* Floating refresh button for the single feed currently displayed */}
            {activeTab === 'feed' && activeUrl && (
              <button
                type="button"
                onClick={() => loadFeed(activeUrl, false, true)}
                disabled={isLoading}
                title="Refresh this feed from source"
                aria-label="Refresh this feed from source"
                className="absolute top-20 right-4 sm:right-6 z-30 inline-flex items-center justify-center p-2.5 rounded-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-zinc-950 shadow-lg shadow-amber-500/20 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}

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

                {/* Duplicate feed notice */}
                {notice && (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
                    <span className="flex items-center gap-2 min-w-0">
                      <Info className="w-4 h-4 flex-shrink-0" />
                      <span>{notice.text}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotice(null)}
                      className="flex-shrink-0 font-semibold underline hover:text-amber-900 dark:hover:text-amber-100"
                    >
                      Dismiss
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
                          onClick={() => loadFeed(activeUrl || inputUrl, false, true)}
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
                      {activeTab === 'all-feeds' ? (
                        <Newspaper className="w-7 h-7" />
                      ) : (
                        <Rss className="w-7 h-7" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                        {searchTerm
                          ? 'No articles match your search'
                          : activeTab === 'favorites'
                          ? 'No bookmarked articles yet'
                          : activeTab === 'all-feeds'
                          ? allFeedsFilter !== 'all'
                            ? 'No articles in this feed'
                            : 'No feeds loaded in memory yet'
                          : 'No articles found in this feed'}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {searchTerm
                          ? `No results for "${searchTerm}". Try checking your spelling or clear the filter.`
                          : activeTab === 'all-feeds'
                          ? allFeedsFilter !== 'all'
                            ? 'This feed has no matching articles, or its content was removed. Show all feeds to keep browsing.'
                            : 'Load any RSS feeds from the sidebar or click below to preload sample feeds into memory.'
                          : 'Select a feed from the left panel or enter a custom RSS URL to get started.'}
                      </p>
                    </div>
                    {searchTerm ? (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                      >
                        Clear search
                      </button>
                    ) : activeTab === 'all-feeds' && allFeedsFilter !== 'all' ? (
                      <button
                        type="button"
                        onClick={() => setAllFeedsFilter('all')}
                        className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Newspaper className="w-3.5 h-3.5" />
                        <span>Show all feeds</span>
                      </button>
                    ) : activeTab === 'all-feeds' ? (
                      <button
                        type="button"
                        onClick={handlePreloadSamples}
                        className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Preload Sample Feeds</span>
                      </button>
                    ) : null}
                  </div>
                )}

                {/* ALL Feeds Info Banner (when viewing in-memory aggregation) */}
                {!isLoading && activeTab === 'all-feeds' && displayedItems.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
                      <span className="p-1 rounded-md bg-amber-500/20 text-amber-500">
                        <Newspaper className="w-3.5 h-3.5" />
                      </span>
                      <span>
                        Displaying <strong>{displayedItems.length}</strong>{' '}
                        {allFeedsFilter !== 'all' ? 'article(s) from this feed' : 'articles merged from'}{' '}
                        {allFeedsFilter === 'all' && (
                          <>
                            <strong>{Object.keys(cachedFeeds).length}</strong> feed(s) in memory, sorted by publication date.
                          </>
                        )}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                      <FeedFilterCombobox
                        feeds={Object.values(cachedFeeds)}
                        value={allFeedsFilter}
                        onChange={setAllFeedsFilter}
                      />

                      <button
                        type="button"
                        onClick={handleRefreshAllFeeds}
                        disabled={isRefreshingAll}
                        className="inline-flex items-center justify-center p-1 rounded-md bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-zinc-950 transition-colors cursor-pointer"
                        title="Refresh all feeds from source"
                        aria-label="Refresh all feeds from source"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAll ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Articles List (Paginated 20 at a time) */}
                {!isLoading && paginatedItems.length > 0 && (
                  <div className="space-y-6">
                    <div
                      className={`grid gap-5 ${
                        viewMode === 'compact'
                          ? 'grid-cols-1'
                          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                      }`}
                    >
                      {paginatedItems.map((item) => (
                        <FeedItemCard
                          key={item.id}
                          item={item}
                          isFavorite={isItemFavorite(item, favorites)}
                          onToggleFavorite={handleToggleFavorite}
                          onSelectArticle={handleSelectArticle}
                          viewMode={viewMode}
                          showFeedFavicon={activeTab === 'all-feeds'}
                          feedFaviconUrl={cachedFeeds[item.feedUrl || '']?.faviconUrl ?? null}
                        />
                      ))}
                    </div>

                    {/* 20-at-a-time pagination controls */}
                    {displayedItems.length > PAGE_SIZE && (
                      <div className="pt-6 pb-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-200 dark:border-zinc-800/80">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          Showing{' '}
                          <strong className="text-zinc-900 dark:text-zinc-100 font-bold">
                            {Math.min(visibleCount, displayedItems.length)}
                          </strong>{' '}
                          of{' '}
                          <strong className="text-zinc-900 dark:text-zinc-100 font-bold">
                            {displayedItems.length}
                          </strong>{' '}
                          articles (20 at a time)
                          {activeTab === 'all-feeds' && ` • ${Object.keys(cachedFeeds).length} feeds in memory`}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Growing the list mounts many cards at once. Wrapping the
                              update in a transition lets React yield between cards, so the
                              page stays responsive instead of freezing until every card
                              has mounted. */}
                          {visibleCount < displayedItems.length && (
                            <button
                              type="button"
                              onClick={() =>
                                startTransition(() => setVisibleCount((prev) => prev + PAGE_SIZE))
                              }
                              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>Load 20 more articles</span>
                              <span className="text-[10px] opacity-80 font-normal">
                                (+{Math.min(PAGE_SIZE, displayedItems.length - visibleCount)})
                              </span>
                            </button>
                          )}

                          {visibleCount < displayedItems.length && (
                            <button
                              type="button"
                              onClick={() =>
                                startTransition(() => setVisibleCount(displayedItems.length))
                              }
                              className="px-3.5 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs transition-colors cursor-pointer"
                            >
                              Show all ({displayedItems.length})
                            </button>
                          )}

                          {visibleCount > PAGE_SIZE && (
                            <button
                              type="button"
                              onClick={() => {
                                setVisibleCount(PAGE_SIZE);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="px-3.5 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium text-xs transition-colors cursor-pointer"
                            >
                              Reset to 20
                            </button>
                          )}
                        </div>
                      </div>
                    )}
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
