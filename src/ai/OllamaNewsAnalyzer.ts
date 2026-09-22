import { env } from "../config/env.js";
import { selectionSchema, storySchema } from "./schemas.js";
import type { AiArticle, AiNewsAnalyzer, NewsSummary, SelectedArticle } from "./AiNewsAnalyzer.js";
import { selectionPrompt, summaryPrompt } from "./input.js";

type Fetch = typeof fetch;
interface OllamaChatResponse { message?: { content?: string } }
interface OllamaTagsResponse { models?: Array<{ name?: string; model?: string }> }

const selectionInstructions = `You are a careful news editor. Select only genuinely important factual developments for a busy professional, especially consequential India news. Reject clickbait, entertainment, opinion, rumors, minor crime, routine announcements and repeated coverage. Important is not popularity. Return JSON only: {"selected":[{"articleId":"exact input id","important":true}]}. Never invent an ID.`;
const summaryInstructions = `Write factual, concise news copy from only supplied material. No clickbait, invented facts, quotes, statistics, speculation or investment advice. Headline: at most 15 words. Summary: 50-70 words maximum. Why it matters: 40-50 words maximum. Return JSON only with headline, summary, whyItMatters.`;

export interface OllamaOptions { baseUrl: string; model: string; timeoutMs: number; maxDescriptionChars: number; maxSelectionInputChars: number; maxContentChars: number; fetch: Fetch }

export class OllamaNewsAnalyzer implements AiNewsAnalyzer {
  private modelChecked = false;
  private readonly baseUrl: string;
  constructor(private readonly options: OllamaOptions = { baseUrl: env.ollamaBaseUrl, model: env.ollamaModel, timeoutMs: 60_000, maxDescriptionChars: env.aiMaxDescriptionChars, maxSelectionInputChars: env.aiMaxSelectionInputChars, maxContentChars: env.aiMaxContentChars, fetch: globalThis.fetch as Fetch }) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    try {
      const response = await this.options.fetch(`${this.baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(this.options.timeoutMs) });
      if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") throw new Error(`Ollama request timed out after ${this.options.timeoutMs}ms`);
      if (error instanceof Error) throw new Error(`Ollama unavailable or request failed: ${error.message}`);
      throw new Error("Ollama unavailable or request failed");
    }
  }

  private async ensureModelAvailable(): Promise<void> {
    if (this.modelChecked) return;
    const tags = await (await this.request("/api/tags")).json() as OllamaTagsResponse;
    const available = tags.models?.some((model) => model.name === this.options.model || model.model === this.options.model);
    if (!available) throw new Error(`Ollama model unavailable: ${this.options.model}. Install it with: ollama pull ${this.options.model}`);
    this.modelChecked = true;
  }

  private async json(instructions: string, input: string): Promise<unknown> {
    await this.ensureModelAvailable();
    const response = await this.request("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: this.options.model, stream: false, format: "json", options: { temperature: 0 }, messages: [{ role: "system", content: instructions }, { role: "user", content: input }] }) });
    const body = await response.json() as OllamaChatResponse;
    const content = body.message?.content?.trim();
    if (!content) throw new Error("Ollama returned an empty response");
    try { return JSON.parse(content); } catch { throw new Error("Ollama returned malformed JSON"); }
  }

  async selectImportantArticles(articles: AiArticle[]): Promise<SelectedArticle[]> {
    const input = selectionPrompt(articles, this.options.maxDescriptionChars, this.options.maxSelectionInputChars);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const parsed = selectionSchema.parse(await this.json(selectionInstructions, input));
        const allowed = new Set(articles.map((article) => article.id));
        return parsed.selected.filter((selected) => allowed.has(selected.articleId));
      } catch (error) { if (attempt === 1) throw error; }
    }
    throw new Error("Ollama selection failed");
  }

  async summarizeStory(articles: AiArticle[]): Promise<NewsSummary> {
    if (!articles.length) throw new Error("Cannot summarize an empty set of articles");
    const input = summaryPrompt(articles, this.options.maxDescriptionChars, this.options.maxContentChars);
    for (let attempt = 0; attempt < 2; attempt++) {
      try { return storySchema.parse(await this.json(summaryInstructions, input)); } catch (error) { if (attempt === 1) throw error; }
    }
    throw new Error("Ollama summary failed");
  }
}
