import { describe, expect, it, vi } from "vitest";
import { OllamaNewsAnalyzer } from "./OllamaNewsAnalyzer.js";

const article = { id: "article-1", title: "India announces a major policy", source: "PIB", publishedAt: new Date(), category: "india" as const, url: "https://example.test/article" };
function response(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }

describe("OllamaNewsAnalyzer", () => {
  it("checks the configured model and validates selected IDs", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ models: [{ name: "test-model" }] })).mockResolvedValueOnce(response({ message: { content: '{"selected":[{"articleId":"article-1","important":true},{"articleId":"invented","important":true}]}' } }));
    const analyzer = new OllamaNewsAnalyzer({ baseUrl: "http://ollama.test", model: "test-model", timeoutMs: 1000, maxDescriptionChars: 800, maxSelectionInputChars: 10_000, maxContentChars: 6_000, fetch });
    await expect(analyzer.selectImportantArticles([article])).resolves.toEqual([{ articleId: "article-1", important: true }]);
    expect(fetch.mock.calls[0][0]).toBe("http://ollama.test/api/tags");
    expect(fetch.mock.calls[1][0]).toBe("http://ollama.test/api/chat");
  });

  it("fails clearly when the configured model is absent", async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(response({ models: [] })));
    const analyzer = new OllamaNewsAnalyzer({ baseUrl: "http://ollama.test", model: "missing", timeoutMs: 1000, maxDescriptionChars: 800, maxSelectionInputChars: 10_000, maxContentChars: 6_000, fetch });
    await expect(analyzer.selectImportantArticles([article])).rejects.toThrow("Ollama model unavailable: missing");
  });
});
