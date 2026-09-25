import React, { useEffect, useState } from 'react';
import { X, Copy, Check, ExternalLink, Chrome, Code, Settings } from 'lucide-react';
import { CACHE_TTL_OPTIONS } from '../services/rssService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFeedUrl?: string;
  /** Cache freshness window in ms (Settings tab). */
  cacheTtlMs: number;
  onCacheTtlChange: (ttlMs: number) => void;
}

type SettingsTab = 'settings' | 'extension';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentFeedUrl,
  cacheTtlMs,
  onCacheTtlChange,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('settings');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurrentFeed, setCopiedCurrentFeed] = useState(false);

  // Always open on the Settings tab, then let the user switch to Extension.
  useEffect(() => {
    if (isOpen) setActiveTab('settings');
  }, [isOpen]);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3008';
  const exampleFeedUrl = 'https://www.theverge.com/rss/index.xml';
  // Displayed and copied as a normal, readable URL (no %3A / %2F encoding).
  const currentFeedExtensionUrl = `${currentOrigin}/?rss=${currentFeedUrl || exampleFeedUrl}`;
  const exampleExtensionUrl = `${currentOrigin}/?rss=${exampleFeedUrl}`;

  const bookmarkletCode = `javascript:(function(){
  var link = document.querySelector('link[type="application/rss+xml"], link[type="application/atom+xml"]');
  var rssUrl = link ? link.href : window.location.href;
  window.open('${currentOrigin}/?rss=' + encodeURIComponent(rssUrl), '_blank');
})();`;

  const extensionBackgroundJs = `// background.js for your Chrome Extension
chrome.action.onClicked.addListener((tab) => {
  if (tab.url) {
    const viewerUrl = "${currentOrigin}/?rss=" + encodeURIComponent(tab.url);
    chrome.tabs.create({ url: viewerUrl });
  }
});`;

  const handleCopyCode = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabClass = (isActive: boolean) =>
    `py-2.5 px-3 font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
      isActive
        ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-bold'
        : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Settings</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Cache, ?rss= URL, bookmarklet and browser extension
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800/80 text-xs px-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={tabClass(activeTab === 'settings')}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('extension')}
            className={tabClass(activeTab === 'extension')}
          >
            <Chrome className="w-3.5 h-3.5" />
            <span>Extension</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-zinc-700 dark:text-zinc-300">
          {activeTab === 'settings' && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Feed cache
              </h3>
              <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                Each feed you load is stored in <code className="text-amber-500">localStorage</code> and
                served instantly while its cache is fresh. Once a feed is older than the duration below,
                it is refreshed silently in the background: when you open it, and — on a page reload —
                for every in-memory feed whose cache has expired. Fresh feeds are left untouched.
              </p>

              <label
                htmlFor="cache-ttl"
                className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 pt-1"
              >
                Refresh feeds after
              </label>
              <select
                id="cache-ttl"
                value={cacheTtlMs}
                onChange={(e) => onCacheTtlChange(Number(e.target.value))}
                className="w-full sm:w-64 text-sm px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
              >
                {CACHE_TTL_OPTIONS.map((option) => (
                  <option key={option.ms} value={option.ms}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Default: 30 minutes. The manual <strong>Refresh</strong> button (and the error{' '}
                <strong>Retry</strong> button) always bypass the cache and fetch the live feed.
              </p>
            </div>
          )}

          {activeTab === 'extension' && (
            <>
              {/* Suggested Chrome extension (top callout) */}
              <a
                href="https://chromewebstore.google.com/detail/rss-subscription-extensio/nlbjncdgjeocebhnmkbbbdekmmmcbfjd"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/15 transition-colors"
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <Chrome className="w-4 h-4 flex-shrink-0" />
                  Suggested extension: RSS Subscription Extension
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 flex-shrink-0">
                  Install
                  <ExternalLink className="w-3.5 h-3.5" />
                </span>
              </a>

              {/* Section 0: Chrome Extension URL for the current feed */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Chrome Extension URL (current feed)
                </h3>
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Paste this URL into your RSS browser extension / subscription tool to open the feed you are
                  currently viewing:
                </p>
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 dark:bg-zinc-950 font-mono text-xs border border-amber-500/25 dark:border-zinc-800">
                  <span className="text-amber-700 dark:text-amber-400 truncate mr-2">
                    {currentFeedExtensionUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(currentFeedExtensionUrl, setCopiedCurrentFeed)}
                    className="flex items-center gap-1 text-xs font-sans font-semibold text-zinc-600 dark:text-zinc-300 hover:text-amber-500 flex-shrink-0"
                  >
                    {copiedCurrentFeed ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCurrentFeed ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Section 1: URL Parameter */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  1. Direct URL Parameter Support (?rss=)
                </h3>
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  RSS Viewer automatically loads and parses any RSS or Atom URL passed in the query parameter:
                </p>
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-100 dark:bg-zinc-950 font-mono text-xs border border-zinc-200 dark:border-zinc-800">
                  <span className="text-amber-600 dark:text-amber-400 truncate mr-2">
                    {exampleExtensionUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(exampleExtensionUrl, setCopiedUrl)}
                    className="flex items-center gap-1 text-xs font-sans font-semibold text-zinc-600 dark:text-zinc-300 hover:text-amber-500 flex-shrink-0"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Section 2: 1-Click Bookmarklet */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  2. Quick 1-Click Browser Bookmarklet (No Extension Required)
                </h3>
                <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Drag this link to your bookmarks bar, or create a new bookmark with the JavaScript code below. Clicking it on any website detects its RSS link and opens it here:
                </p>
                <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-950 font-mono text-xs border border-zinc-200 dark:border-zinc-800 relative">
                  <pre className="overflow-x-auto text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                    {bookmarkletCode}
                  </pre>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(bookmarkletCode, setCopiedCode)}
                    className="absolute top-2 right-2 px-2 py-1 rounded bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-sans font-medium flex items-center gap-1"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Code</span>
                  </button>
                </div>
              </div>

              {/* Section 3: Chrome Extension Background Script */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5" />
                  3. Chrome Extension Manifest & Background Script
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  If you have your own Chrome extension, simply add this listener in your <code className="text-amber-500">background.js</code>:
                </p>
                <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-950 font-mono text-[11px] border border-zinc-200 dark:border-zinc-800 overflow-x-auto text-zinc-700 dark:text-zinc-300">
                  {extensionBackgroundJs}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
