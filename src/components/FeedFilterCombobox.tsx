import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Newspaper, Search, X } from 'lucide-react';
import { CachedFeedEntry } from '../services/rssService';

interface FeedFilterComboboxProps {
  feeds: CachedFeedEntry[];
  /** Currently selected feed URL, or 'all' to show every feed. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * Searchable dropdown used to filter the aggregated "ALL Feeds" list by feed.
 * Opens a popover with a search field so you can quickly find one of many feeds.
 */
export const FeedFilterCombobox: React.FC<FeedFilterComboboxProps> = ({
  feeds,
  value,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Reset + focus the search field every time the popover opens.
  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  const selected = value !== 'all' ? feeds.find((f) => f.url === value) : null;
  const selectedLabel = selected ? selected.metadata?.title || selected.url : 'All feeds';

  const normalizedQuery = query.trim().toLowerCase();
  const filteredFeeds = useMemo(() => {
    if (!normalizedQuery) return feeds;
    return feeds.filter((f) => {
      const title = (f.metadata?.title || '').toLowerCase();
      return title.includes(normalizedQuery) || f.url.toLowerCase().includes(normalizedQuery);
    });
  }, [feeds, normalizedQuery]);

  const handleSelect = (url: string) => {
    onChange(url);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="flex items-center gap-1.5 max-w-[220px] text-[11px] font-semibold pl-2.5 pr-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-amber-500/30 text-zinc-700 dark:text-zinc-200 hover:border-amber-500/60 focus:outline-hidden focus:ring-1 focus:ring-amber-500 transition-colors cursor-pointer"
          title="Filter aggregated articles by feed"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <Newspaper className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span className="truncate">{selectedLabel}</span>
          {value === 'all' && (
            <span className="text-[10px] px-1.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 font-bold flex-shrink-0">
              {feeds.length}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* One-click escape from a single-feed filter. */}
        {value !== 'all' && (
          <button
            type="button"
            onClick={() => {
              onChange('all');
              setIsOpen(false);
            }}
            className="flex-shrink-0 p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-amber-500/30 text-zinc-500 dark:text-zinc-400 hover:text-red-500 hover:border-red-500/50 transition-colors cursor-pointer"
            title="Clear feed filter (show all feeds)"
            aria-label="Clear feed filter (show all feeds)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-2xl overflow-hidden">
          {/* Feed search */}
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search feeds..."
                className="w-full text-xs pl-8 pr-7 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="max-h-64 overflow-y-auto py-1" role="listbox">
            {/* Always available, even while typing a search, so the user can
                never get stuck inside a single-feed filter. */}
            <button
              type="button"
              onClick={() => handleSelect('all')}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer border-b border-zinc-100 dark:border-zinc-800 ${
                value === 'all'
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Newspaper className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span className="truncate">All feeds</span>
              </span>
              <span className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[10px] text-zinc-400">{feeds.length}</span>
                {value === 'all' && <Check className="w-3.5 h-3.5" />}
              </span>
            </button>

            {filteredFeeds.length === 0 ? (
              <p className="px-3 py-4 text-center text-[11px] text-zinc-500">
                No feed matches "{query}".
              </p>
            ) : (
              filteredFeeds.map((feed) => {
                const title = feed.metadata?.title || feed.url;
                const isSelected = value === feed.url;
                return (
                  <button
                    key={feed.url}
                    type="button"
                    onClick={() => handleSelect(feed.url)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className={`block text-xs truncate ${isSelected ? 'font-semibold' : ''}`}>
                        {title}
                      </span>
                      <span className="block text-[10px] text-zinc-400 truncate">
                        {feed.items?.length || 0} articles
                      </span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
