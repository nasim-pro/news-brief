import type { AiArticle } from "./AiNewsAnalyzer.js";

export function truncateText(text: string | undefined, maxCharacters: number): string | undefined {
  if (!text) return undefined;
  if (maxCharacters <= 0) return undefined;
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return undefined;
  return compact.length <= maxCharacters ? compact : `${compact.slice(0, Math.max(0, maxCharacters - 1)).trimEnd()}…`;
}

function selectionEntry(article: AiArticle, maxDescriptionChars: number): string {
  return [
    `ID: ${article.id}`,
    `Source: ${article.source}`,
    `Category: ${article.category}`,
    `Published: ${article.publishedAt.toISOString()}`,
    `Title: ${truncateText(article.title, 300) ?? ""}`,
    `Description: ${truncateText(article.description, maxDescriptionChars) ?? ""}`
  ].join("\n");
}

export function selectionPrompt(articles: AiArticle[], maxDescriptionChars: number, maxInputChars: number): string {
  const join = (descriptionLimit: number) => articles.map((article) => selectionEntry(article, descriptionLimit)).join("\n\n");
  const metadataOnly = join(0);
  if (metadataOnly.length > maxInputChars) throw new Error(`Selection metadata exceeds configured input limit (${maxInputChars} characters)`);
  const availableDescriptionChars = Math.floor((maxInputChars - metadataOnly.length) / articles.length);
  // Keep every article represented while shrinking only descriptions. This puts a
  // hard upper bound on one model request without silently dropping candidates.
  return join(Math.min(maxDescriptionChars, availableDescriptionChars));
}

export function summaryPrompt(articles: AiArticle[], maxDescriptionChars: number, maxContentChars: number): string {
  return articles.map((article) => [
    `Source: ${article.source}`,
    `Category: ${article.category}`,
    `Published: ${article.publishedAt.toISOString()}`,
    `Title: ${truncateText(article.title, 300) ?? ""}`,
    `Description: ${truncateText(article.description, maxDescriptionChars) ?? ""}`,
    `Content: ${truncateText(article.content, maxContentChars) ?? ""}`
  ].join("\n")).join("\n\n");
}
