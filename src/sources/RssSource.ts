import Parser from "rss-parser";
import type { NewsSource, NormalizedArticle, SourceConfig } from "./types.js";
import { isHttpUrl } from "../utils/url.js";

const parser = new Parser({ timeout: 12_000, headers: { "User-Agent": "NewsBriefMVP/1.0 (RSS reader)" } });
export class RssSource implements NewsSource {
  constructor(private readonly config: SourceConfig) {}
  get name() { return this.config.name; }
  get category() { return this.config.category; }
  async fetchArticles(): Promise<NormalizedArticle[]> {
    const feed = await parser.parseURL(this.config.feedUrl);
    const fetchedAt = new Date();
    return feed.items.flatMap((item): NormalizedArticle[] => {
      const url = item.link?.trim(); const title = item.title?.trim();
      const publishedAt = item.isoDate ?? item.pubDate;
      if (!url || !title || !publishedAt || !isHttpUrl(url) || Number.isNaN(new Date(publishedAt).getTime())) return [];
      return [{ source: this.name, sourceId: item.guid, title, url, description: item.contentSnippet?.trim(), content: item.content?.slice(0, 6_000), publishedAt: new Date(publishedAt), category: this.category, fetchedAt }];
    });
  }
}
