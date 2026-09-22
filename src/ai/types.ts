import type { Category } from "../sources/types.js";
export interface AiArticle { id: string; title: string; description?: string; source: string; publishedAt: Date; category: Category; url: string; content?: string }
export interface SelectedArticle { articleId: string; important: true }
export interface NewsSummary { headline: string; summary: string; whyItMatters: string }
// This is the only AI contract used by the rest of the application. Provider
// implementations may use local or cloud transport without leaking it outward.
export interface AiNewsAnalyzer {
  selectImportantArticles(articles: AiArticle[]): Promise<SelectedArticle[]>;
  summarizeStory(articles: AiArticle[]): Promise<NewsSummary>;
}
