import type { SourceConfig } from "../sources/types.js";

// Each enabled URL was checked as a public RSS/Atom endpoint. Keep feeds here so
// adding or disabling a source never requires changing the ingestion pipeline.
export const sourceConfigs: SourceConfig[] = [
  { name: "The Hindu", 
    category: "india", 
    feedUrl: "https://www.thehindu.com/news/national/feeder/default.rss", 
    enabled: true 
  },
  { 
    name: "Indian Express", 
    category: "india", 
    feedUrl: "https://indianexpress.com/section/india/feed/", 
    enabled: true 
  },
  { 
    name: "Press Information Bureau", 
    category: "india", 
    feedUrl: "https://pib.gov.in/RssMain.aspx?ModId=6&Regid=3&Lang=1", 
    enabled: true 
  },
  { 
    name: "Reserve Bank of India", 
    category: "business", 
    feedUrl: "https://www.rbi.org.in/pressreleases_rss.xml", 
    enabled: true 
  },
  // ISRO's former public RSS path currently returns 404. Keep the adapter ready,
  // but require a newly verified feed URL before enabling it.
  { 
    name: "ISRO", 
    category: "space", 
    feedUrl: process.env.ISRO_FEED_URL ?? "", 
    enabled: Boolean(process.env.ISRO_FEED_URL) 
  },
  { 
    name: "BBC World", 
    category: "world", 
    feedUrl: "https://feeds.bbci.co.uk/news/world/rss.xml", 
    enabled: true 
  },
  { 
    name: "BBC Technology", 
    category: "technology", 
    feedUrl: "https://feeds.bbci.co.uk/news/technology/rss.xml", 
    enabled: true 
  },
  { 
    name: "NASA", 
    category: "space", 
    feedUrl: "https://www.nasa.gov/rss/dyn/breaking_news.rss", 
    enabled: true 
  },
  // Reuters no longer maintains a universally available public RSS catalog. Add a
  // currently valid URL in REUTERS_FEED_URL to enable this adapter.
  { 
    name: "Reuters", 
    category: "world", 
    feedUrl: process.env.REUTERS_FEED_URL ?? "", 
    enabled: Boolean(process.env.REUTERS_FEED_URL) 
  }
];
