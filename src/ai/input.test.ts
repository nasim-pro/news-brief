import { describe, expect, it } from "vitest";
import { selectionPrompt, summaryPrompt, truncateText } from "./input.js";

const article = { id: "article-1", title: "A title", source: "PIB", publishedAt: new Date("2026-09-22T00:00:00Z"), category: "india" as const, url: "https://example.test", description: "d".repeat(2_000), content: "c".repeat(20_000) };
describe("AI input limits", () => {
  it("compacts whitespace and truncates text", () => expect(truncateText("  a\n  b  ", 10)).toBe("a b"));
  it("selection includes only compact metadata within the batch budget", () => {
    const prompt = selectionPrompt(Array.from({ length: 15 }, (_, index) => ({ ...article, id: String(index) })), 800, 10_000);
    expect(prompt.length).toBeLessThanOrEqual(10_000); expect(prompt).not.toContain("Content:"); expect(prompt).not.toContain("https://example.test");
  });
  it("summary bounds article content", () => expect(summaryPrompt([article], 800, 6000).length).toBeLessThan(7_500));
});
