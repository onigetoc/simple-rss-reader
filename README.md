# RSS Viewer 📰

A modern, fast and clean RSS and Atom feed reader, built for comfortable reading with direct URL parameter support, media extraction (images, YouTube videos and audio podcasts), an immersive reader mode, in-memory multi-feed aggregation and a smart, configurable local cache for instant navigation.

![RSS Viewer preview](https://raw.githubusercontent.com/onigetoc/simple-rss-reader/refs/heads/main/public/screenshot.png)

---

## ✨ Main features

### 🔗 Direct URL gateway & Chrome extensions
- **`?rss=` parameter**: Load any feed directly by opening `/?rss=https://example.com/feed.xml`.
- **Extension / Bookmarklet integration**: Works with browser extensions (Chrome, Firefox) and one-click bookmarklets to send the current page's feed straight into the reader.
- **Settings dialog**: The **Settings** button in the sidebar footer opens a tabbed dialog — **Settings** (cache duration) and **Extension** (the current feed's Chrome extension URL, the bookmarklet and the extension snippets).
- **Compact URL bar**: The URL field, the icon-only **Load** button and the **Refresh** button share a single row.

### 📚 Aggregated "ALL Feeds" view
- **In-memory combined feeds**: Collects and deduplicates every RSS feed you visit during your session.
- **Chronological sort**: Articles are sorted newest first, across all sources.
- **20-article pagination**: Shows 20 articles initially with *"Load 20 more"*, *"Show all"* and *"Reset to 20"* buttons.
- **Preloaded samples**: One-click button to inject a selection of tech news feeds (The Verge, Ars Technica, Hacker News, GitHub Blog).
- **Loaded Feeds list**: Shows every feed currently held in memory with its article count and cache age. A search box filters the list, and hovering a feed reveals a **✕** to remove it from memory and `localStorage`; **Delete All** empties the whole cache after a confirmation dialog.
- **Per-feed filter & bulk refresh**: A searchable combo box filters the aggregated list down to a single feed (type to find a feed by title or URL), and **Refresh all** re-fetches every in-memory feed from its source at once. When a single feed is open in the **Feed** view, a floating refresh button (icon only) reloads just that feed.

> 💡 **Tip — search across everything:** When **ALL Feeds** is showing every in-memory feed, the search bar queries the **entire combined list at once** — every article from every loaded feed, merged and deduplicated. This makes it great for precise research: even very specific or unexpected keywords can surface matching articles across all your sources. Keep in mind this cross-feed search only covers feeds currently in memory, so load (or **Refresh all**) the feeds you want to search through first.

### ⚡ Smart configurable cache
- **Per-feed cache**: Every feed you load (metadata + articles) is stored in `localStorage`, keyed by its URL, so it survives page reloads.
- **Configurable freshness window (Settings tab)**: Choose how long a feed stays fresh — from 5 minutes to 24 hours, **30 minutes by default**. Re-opening a feed from inside the app within that window is instant — no network request and no loading flash.
- **Stale-while-revalidate**: Once a feed is older than the window, the cached articles are displayed immediately while the feed refreshes silently in the background. If the refresh fails, the cached copy is kept.
- **Page reload revalidates expired feeds**: A full page load paints the cached articles instantly, then refreshes **every in-memory feed whose cache has expired** — fresh feeds are left untouched, so a refresh never re-fetches everything. A fresh cache entry is written when new content arrives.
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
- **Audio podcasts**: Audio enclosures are detected and played inline with a native audio player; podcast episodes are also flagged with a badge on the card.

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
  - [Fastify](https://fastify.dev/) (Node.js)
  - [rss-parser](https://github.com/rbren/rss-parser) v3.13 (RSS / Atom / RDF XML parsing with media tag extraction)
  - Client-side CORS fallback mechanism (`allorigins`) when the network restricts requests.

---

## 🚀 Quick start

### Requirements
- [Node.js](https://nodejs.org/) (version 20 or higher recommended)
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
| `npm run dev` | Starts the Fastify backend server with the Vite middleware in development mode (on port 3008) |
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

Append `?view=all` to reopen directly on the aggregated **ALL Feeds** view (the underlying feed is resolved from history/cache):
```text
http://localhost:3008/?view=all
```

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

## 🧹 Rejecting tracking-pixel images

Some feeds expose a 1×1 analytics/tracking pixel as the item's image (for example NPR's `npr-rss-pixel.png`). Stretched into the card layout it would render as a big, ugly black box, so these images are rejected instead of displayed:

- **URL heuristic** (server + client): URLs that look like tracking pixels/spacers (`pixel.png`, `1x1.gif`, `spacer`, `blank`, `transparent`, `beacon`, feedburner/doubleclick hosts…) are skipped before being requested.
- **Real-size check** (browser): the image is measured via `naturalWidth` / `naturalHeight` on load; anything smaller than **64 px** on either side is dropped. The browser already downloaded the image to display it, so this costs nothing extra.

When a feed image is rejected, the card simply falls back to the YouTube thumbnail (if any) or to a text-only layout — never a stretched pixel. The threshold lives in `MIN_IMAGE_DIMENSION` in `src/utils/imageFilter.ts`.

---

## 🖼️ Smart image variant selection

Many feeds (WordPress sites, NASA, news outlets…) expose the same photo at several widths through `srcset`, `?w=`/`?h=` query params or `-1024x683` filename suffixes. Some also expose a multi-megabyte original as the `enclosure` (NASA's Image of the Day ships 15–96 MB files). Loading the original means the browser must decode a huge bitmap and re-rasterize it while scrolling, which makes the list lag even after the image is loaded.

To avoid that, the server gathers every candidate (content `<img>` + each `srcset` variant, `media:content`, `media:thumbnail`, enclosure) and picks the **smallest variant that still renders crisply on a card**:

- minimum **350 × 200 px** — tiny thumbnails are never stretched into a card;
- dimensions are inferred from `?w=`/`?h=`, `srcset` `400w` descriptors, `width`/`height` attributes and WordPress `-WxH` suffixes;
- HTML entities (`&#038;`) in content URLs are decoded so multi-parameter image URLs stay valid;
- if no size can be determined, the historical enclosure → media → content precedence is kept, and a small image is preferred over no image at all.

The logic lives in `extractFirstImage` in `server.ts`.

---

## 🌐 Interesting feeds to try

Any of these can be loaded directly through the `?rss=` parameter, for example `/?rss=<feed-url>`. Most services build the feed on the fly from a query string, so you can tweak the keywords and options freely.

### 🔎 Google News search

Google News turns any query into a feed — great for keyword monitoring across thousands of sources.

```text
https://news.google.com/rss/search?q=ai+openai
```

You can also restrict the search to a single site with the `site:` operator, for example to only get YouTube videos about a topic:

```text
https://news.google.com/rss/search?q=ai+openai+site:youtube.com
```

> 💡 Tip: `+` is the encoded form of a space. Use quotes (`%22…%22`) for exact phrases, `OR` for alternatives, and add `when:7d` to limit results to the last 7 days.

### 👽 Reddit

Search across all of Reddit:

```text
https://www.reddit.com/search.rss?q=ai+openai&sort=hot
```

Or follow a single subreddit with its classic sort variants — `hot`, `top` and `new`:

```text
https://www.reddit.com/r/LocalLLaMA/hot/.rss
https://www.reddit.com/r/LocalLLaMA/top/.rss?t=day
https://www.reddit.com/r/LocalLLaMA/new/.rss
```

`t=` accepts `hour`, `day`, `week`, `month`, `year` or `all` (used with `top` and `controversial`).

### ▶️ YouTube channels & playlists

Every channel exposes an Atom feed. Grab the channel ID (`UC…`) from the channel's page:

```text
https://www.youtube.com/feeds/videos.xml?channel_id=UCawZsQWqfGSbCI5yjkdVkTA
```

That one is **@matthew_berman**. Playlists work the same way with a playlist ID:

```text
https://www.youtube.com/feeds/videos.xml?playlist_id=PLxxxxxxxxxxxxxxxx
```

> 🔧 **Finding the ID**: if you don't know a channel's `UC…` ID or a playlist ID, the free [News Keeper YouTube tool](https://newskeeper.pages.dev/tools/youtube) looks them up for you — paste a channel or video URL and it returns the channel feed, playlist feeds and more.

### 📰 Preloaded tech feeds

The **ALL Feeds** view ships with a one-click sample pack (The Verge, Ars Technica, Hacker News, GitHub Blog) so you can start exploring right away.

### ✍️ Medium tags

Medium exposes every tag as an RSS feed — just swap the tag to follow anything:

```text
https://medium.com/feed/tag/ai
https://medium.com/feed/tag/openai
https://medium.com/feed/tag/chatgpt
```

Replace `ai` with any tag (`openai`, `chatgpt`, `programming`, …) to build a custom topic feed.

---

## 📄 License

This project is released under the [MIT License](./LICENSE).
