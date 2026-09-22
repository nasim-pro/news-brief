import type { categories } from "../models/NewsArticle.js";
export type Category = (typeof categories)[number];
export interface SourceConfig { name: string; category: Category; feedUrl: string; enabled: boolean }
export interface NormalizedArticle { source: string; sourceId?: string; title: string; url: string; description?: string; publishedAt: Date; category: Category; content?: string; fetchedAt: Date }
export interface NewsSource { name: string; category: Category; fetchArticles(): Promise<NormalizedArticle[]> }
