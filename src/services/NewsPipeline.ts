import { NewsArticle } from "../models/NewsArticle.js";
import { NewsStory } from "../models/NewsStory.js";
import { sourceConfigs } from "../config/sources.js";
import { RssSource } from "../sources/RssSource.js";
import type { NormalizedArticle } from "../sources/types.js";
import type { AiNewsAnalyzer, AiArticle } from "../ai/types.js";
import { selectionPrompt } from "../ai/input.js";
import { env } from "../config/env.js";
import { normalizeUrl } from "../utils/url.js";
import { areNearDuplicateTitles } from "../utils/duplicates.js";

export interface PipelineReport { fetched: number; inserted: number; duplicates: number; candidates: number; selected: number; saved: number; failedSelectionBatches: number; failedSummaries: number; aiProcessingFailed: boolean; sources: Array<{ name: string; count: number }> }
function batches<T>(items: T[], size: number): T[][] { return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size)); }
export class NewsPipeline {
  constructor(private readonly analyzer: AiNewsAnalyzer) {}
  async run(): Promise<PipelineReport> {
    const report: PipelineReport = { fetched: 0, inserted: 0, duplicates: 0, candidates: 0, selected: 0, saved: 0, failedSelectionBatches: 0, failedSummaries: 0, aiProcessingFailed: false, sources: [] };
    const sources = sourceConfigs.filter((source) => source.enabled).map((source) => new RssSource(source));
    const results = await Promise.allSettled(sources.map((source) => source.fetchArticles()));
    const articles: NormalizedArticle[] = [];
    results.forEach((result, index) => {
      const source = sources[index];
      if (result.status === "fulfilled") { report.sources.push({ name: source.name, count: result.value.length }); articles.push(...result.value); }
      else console.error(`Source failed (${source.name}):`, result.reason instanceof Error ? result.reason.message : result.reason);
    });
    report.fetched = articles.length;
    for (const article of articles) {
      const url = normalizeUrl(article.url); if (!url) { report.duplicates++; continue; }
      const existing = await NewsArticle.findOne({ url }).select("_id title").lean();
      if (existing) { report.duplicates++; continue; }
      // A narrow title check catches feed reposts while avoiding aggressive event clustering.
      const possibleTitles = await NewsArticle.find({ publishedAt: { $gte: new Date(article.publishedAt.getTime() - 48 * 3600_000) } }).select("title").limit(100).lean();
      if (possibleTitles.some((item) => areNearDuplicateTitles(item.title, article.title))) { report.duplicates++; continue; }
      await NewsArticle.create({ ...article, url }); report.inserted++;
    }
    const pending = await NewsArticle.find({ processedAt: { $exists: false } }).sort({ publishedAt: -1 }).limit(80);
    report.candidates = pending.length; if (!pending.length) return report;
    const aiArticles: AiArticle[] = pending.map((article) => ({ id: article._id.toString(), title: article.title, description: article.description ?? undefined, source: article.source, publishedAt: article.publishedAt, category: article.category, url: article.url, content: article.content ?? undefined }));
    console.log(`Fetched: ${report.fetched} articles\nAfter deduplication: ${report.inserted} new articles\n\nAI selection:`);
    const selectionBatches = batches(aiArticles, env.aiSelectionBatchSize);
    const selectedIds = new Set<string>();
    const successfullySelectedArticleIds = new Set<string>();
    for (const [index, batch] of selectionBatches.entries()) {
      let approximateInputCharacters = 0;
      try {
        approximateInputCharacters = selectionPrompt(batch, env.aiMaxDescriptionChars, env.aiMaxSelectionInputChars).length;
        console.log(`Batch ${index + 1}/${selectionBatches.length}: ${batch.length} articles (~${approximateInputCharacters} input characters)`);
        const selected = await this.analyzer.selectImportantArticles(batch);
        batch.forEach((article) => successfullySelectedArticleIds.add(article.id));
        selected.forEach((article) => selectedIds.add(article.articleId));
      } catch (error) {
        report.failedSelectionBatches++;
        console.error(`AI selection batch ${index + 1}/${selectionBatches.length} failed (~${approximateInputCharacters} input characters); articles will remain pending:`, error instanceof Error ? error.message : error);
      }
    }
    if (!successfullySelectedArticleIds.size) {
      report.aiProcessingFailed = true;
      console.error("AI processing failed: every selection batch failed. No articles were marked processed.");
      return report;
    }
    report.selected = selectedIds.size;
    console.log(`Selected: ${report.selected} important articles\n\nAI summarization:`);
    const selectedSet = new Set(selectedIds);
    let summaryIndex = 0;
    for (const article of pending) {
      const articleId = article._id.toString();
      if (!successfullySelectedArticleIds.has(articleId)) continue;
      if (!selectedSet.has(articleId)) { article.processedAt = new Date(); await article.save(); continue; }
      summaryIndex++;
      console.log(`${summaryIndex}/${report.selected}`);
      try {
        const draft = await this.analyzer.summarizeStory([aiArticles.find((item) => item.id === articleId)!]);
        await NewsStory.create({ ...draft, category: article.category, publishedAt: article.publishedAt, processedAt: new Date(), important: true, sourceArticles: [{ articleId: article._id, source: article.source, url: article.url, title: article.title }] });
        article.processedAt = new Date(); await article.save(); report.saved++;
      } catch (error) { report.failedSummaries++; console.error(`AI summary failed (${article._id}); leaving it pending:`, error instanceof Error ? error.message : error); }
    }
    return report;
  }
}
