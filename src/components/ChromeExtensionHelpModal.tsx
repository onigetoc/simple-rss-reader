import React, { useState } from 'react';
import { X, Copy, Check, ExternalLink, Chrome, Code, Sparkles } from 'lucide-react';

interface ChromeExtensionHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFeedUrl?: string;
}

export const ChromeExtensionHelpModal: React.FC<ChromeExtensionHelpModalProps> = ({
  isOpen,
  onClose,
  currentFeedUrl,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3008';
  const urlPattern = `${currentOrigin}/?rss=\${encodeURIComponent(rssUrl)}`;

  const bookmarkletCode = `javascript:(function(){
  var link = document.querySelector('link[type="application/rss+xml"], link[type="application/atom+xml"]');
  var rssUrl = link ? link.href : window.location.href;
  window.open('${currentOrigin}/?rss=' + encodeURIComponent(rssUrl), '_blank');
})();`;

  const extensionManifestCode = `{
  "name": "Send to RSS Viewer",
  "version": "1.0",
  "manifest_version": 3,
  "permissions": ["activeTab", "contextMenus"],
  "background": {
    "service_worker": "background.js"
  }
}`;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <Chrome className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Chrome Extension & URL Integration
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Connect RSS Viewer directly with browser extensions and bookmarks
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-zinc-700 dark:text-zinc-300">
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
                {urlPattern}
              </span>
              <button
                type="button"
                onClick={() => handleCopyCode(`${currentOrigin}/?rss=https://news.ycombinator.com/rss`, setCopiedUrl)}
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
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-bold transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
