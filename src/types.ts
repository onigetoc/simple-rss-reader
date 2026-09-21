export interface FeedItemMedia {
  type: 'image' | 'video' | 'audio';
  url: string;
  mimeType?: string;
}

export interface FeedItem {
  id: string;
  title: string;
  link: string;
  pubDate?: string;
  isoDate?: string;
  creator?: string;
  author?: string;
  content?: string;
  contentSnippet?: string;
  description?: string;
  categories?: string[];
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  enclosure?: {
    url: string;
    type?: string;
    length?: string;
  };
  feedTitle?: string;
  feedUrl?: string;
  savedAt?: number;
}

export interface FeedMetadata {
  title: string;
  description?: string;
  link?: string;
  feedUrl: string;
  lastBuildDate?: string;
  imageUrl?: string;
  itemCount: number;
}

export interface FeedResponse {
  metadata: FeedMetadata;
  items: FeedItem[];
}

export interface PresetFeed {
  id: string;
  title: string;
  category: string;
  url: string;
  icon?: string;
  description: string;
}
