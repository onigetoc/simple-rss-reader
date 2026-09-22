# RSS Viewer 📰

A modern, fast and clean RSS and Atom feed reader, built for comfortable reading with direct URL parameter support, media extraction (images and YouTube videos), an immersive reader mode, in-memory multi-feed aggregation and a smart 30-minute local cache for instant navigation.

![RSS Viewer preview](https://raw.githubusercontent.com/onigetoc/simple-rss-reader/refs/heads/main/public/screenshot.png)

---

## ✨ Main features

### 🔗 Direct URL gateway & Chrome extensions
- **`?rss=` parameter**: Load any feed directly by opening `/?rss=https://example.com/feed.xml`.
- **Extension / Bookmarklet integration**: Works with browser extensions (Chrome, Firefox) and one-click bookmarklets to send the current page's feed straight into the reader.
- **Help dialog**: The **?** icon in the sidebar header opens a dialog with the current feed's Chrome extension URL, the bookmarklet and the extension snippets.
- **Compact URL bar**: The URL field, the icon-only **Load** button and the **Refresh** button share a single row.

### 📚 Aggregated "ALL Feeds" view
- **In-memory combined feeds**: Collects and deduplicates every RSS feed you visit during your session.
- **Chronological sort**: Articles are sorted newest first, across all sources.
- **20-article pagination**: Shows 20 articles initially with *"Load 20 more"*, *"Show all"* and *"Reset to 20"* buttons.
- **Preloaded samples**: One-click button to inject a selection of tech news feeds (The Verge, Ars Technica, Hacker News, GitHub Blog).
- **Loaded Feeds list**: Shows every feed currently held in memory with its article count and cache age. A search box filters the list, and hovering a feed reveals a **✕** to remove it from memory and `localStorage`; **Clear Memory** empties the whole cache.
- **Per-feed filter & bulk refresh**: A searchable combo box filters the aggregated list down to a single feed (type to find a feed by title or URL), and **Refresh all** re-fetches every in-memory feed from its source at once.

### ⚡ Smart 30-minute cache
- **Per-feed cache**: Every feed you load (metadata + articles) is stored in `localStorage`, keyed by its URL, so it survives page reloads.
- **30-minute freshness window**: Re-opening a feed within 30 minutes is instant — no network request and no loading flash.
- **Stale-while-revalidate**: Past 30 minutes, the cached articles are still displayed immediately while the feed refreshes silently in the background. If the refresh fails, the cached copy is kept.
- **Manual refresh from source**: The refresh button (and the error **Retry** button) bypasses the cache and re-fetches the live feed, then updates the cache.
- **Automatic pruning**: The cache is capped at 30 feeds; the oldest entries are removed automatically.

### 📖 Full article reader (Reader View)
- **Immersive, distraction-free reading**: Displays the full text, images and embedded videos.
- **Keyboard shortcuts**:
  - `←` / `→`: Go to the previous or next article.
  - `Esc`: Return to the article list.
  - Adjustable font size (`A` / `A+`).
- **Safe links in new tabs**: Every link in the content always opens in a new tab (`target="_blank"` with `rel="noopener noreferrer"`).
- **YouTube videos & thumbnails**: High-quality thumbnail with an optimized video player.

### 🎨 Dark / Light theme & customization
- **Theme switcher**: Instant toggle between dark and light mode via the Sun/Moon icon.
- **Persistence**: Your theme preference is saved automatically in `localStorage`.
- **Styled scrollbars**: Scrollbars that match the colors of each theme.
- **Two display modes**: Card grid (`Cards`) or compact list (`Compact`).

### 💾 Bookmarks & local history
- **Bookmarks**: Save your favorite articles locally to find them again at any time.
- **Recent history**: Quick access to the last feeds you visited, with the ability to remove them.
- **Live search**: Instant filtering by keyword, title or author in the active feed or in "ALL Feeds".

---

## 🛠️ Tech stack

- **Frontend**:
  - [React 19](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/)
  - [Vite](https://vite.dev/)
  - [Tailwind CSS v4](https://tailwindcss.com/)
  - [Lucide React](https://lucide.dev/) (icons)
- **Backend & RSS proxy**:
  - [Express](https://expressjs.com/) (Node.js)
  - [rss-parser](https://github.com/rbren/rss-parser) v3.13 (RSS / Atom / RDF XML parsing with media tag extraction)
  - Client-side CORS fallback mechanism (`allorigins`) when the network restricts requests.

---

## 🚀 Quick start

### Requirements
- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- `npm` or `bun`

### Installation

1. **Clone the repository or open the directory**:
   ```bash
   git clone https://github.com/onigetoc/simple-rss-reader
   cd simple-rss-reader
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3008`.

---

## 📦 Available scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Express backend server with the Vite middleware in development mode (on port 3008) |
| `npm run build` | Builds the frontend with Vite and bundles the TypeScript backend with esbuild into `dist/server.cjs` |
| `npm start` | Runs the compiled production server |
| `npm run lint` | Validates the TypeScript types (`tsc --noEmit`) |
| `npm run clean` | Removes the `dist` build folder |

---

## 🔌 Using with a Chrome extension or a Bookmarklet

### Via the URL
Simply add the desired RSS feed as a URL parameter:
```text
http://localhost:3008/?rss=https://nytimes.com
```
The reader fetches and displays the feed automatically. This works with any feed URL (RSS, Atom or RDF), for example `https://news.ycombinator.com/rss`.

### Via the Chrome "RSS Subscription Extension"
The reader integrates seamlessly with the [RSS Subscription Extension](https://chromewebstore.google.com/detail/rss-subscription-extensio/nlbjncdgjeocebhnmkbbbdekmmmcbfjd) (or any similar RSS reader / subscription tool) thanks to its `?rss=` parameter.

1. Install the extension in Chrome.
2. Open the extension options and click **Manage**.
3. Add a new reader with the following URL, where `%s` is automatically replaced by the current page's feed:

   ```text
   http://localhost:3008/?rss=%s
   ```

   ![Manage subscription configuration](https://github.com/onigetoc/simple-rss-reader/blob/main/public/rss-sub.png?raw=true)

Once configured, just click the extension icon while visiting a site to open its feed directly in Simple RSS Viewer.

---

## 📄 License

This project is released under a free license. See the source code for more details.
