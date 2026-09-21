import { PresetFeed } from '../types';

export const PRESET_FEEDS: PresetFeed[] = [
  {
    id: 'the-verge',
    title: 'The Verge',
    category: 'Tech & Culture',
    url: 'https://www.theverge.com/rss/index.xml',
    description: 'Technology, gadgets, science, and digital culture.',
  },
  {
    id: 'hacker-news',
    title: 'Hacker News',
    category: 'Tech & Dev',
    url: 'https://news.ycombinator.com/rss',
    description: 'Trending tech stories and intellectual discussions.',
  },
  {
    id: 'bbc-world',
    title: 'BBC News - World',
    category: 'World News',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    description: 'Global breaking news, world stories, and analysis.',
  },
  {
    id: 'techcrunch',
    title: 'TechCrunch',
    category: 'Startups',
    url: 'https://techcrunch.com/feed/',
    description: 'Startup news, venture capital, and Silicon Valley updates.',
  },
  {
    id: 'nasa-iotd',
    title: 'NASA Image of the Day',
    category: 'Space & Science',
    url: 'https://www.nasa.gov/rss/dyn/lg_image_of_the_day.rss',
    description: 'Breathtaking space photos with detailed scientific summaries.',
  },
  {
    id: 'wired',
    title: 'Wired News',
    category: 'Tech & Culture',
    url: 'https://www.wired.com/feed/rss',
    description: 'The impact of technology on society, politics, and culture.',
  },
  {
    id: 'reddit-technology',
    title: 'Reddit /r/technology',
    category: 'Community',
    url: 'https://www.reddit.com/r/technology/.rss',
    description: 'Major technology news and emerging tech discussions.',
  },
  {
    id: 'lemonde-actu',
    title: 'Le Monde - Headlines',
    category: 'International News',
    url: 'https://www.lemonde.fr/rss/une.xml',
    description: 'French and European leading daily news with rich media.',
  },
  {
    id: 'veritasium-youtube',
    title: 'Veritasium (YouTube)',
    category: 'Video & Science',
    url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCHnyfMqiRRG1u-2MsSQLbXA',
    description: 'Popular science, physics experiments, and educational video channel.',
  },
];
