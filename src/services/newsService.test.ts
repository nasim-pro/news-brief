import { describe, expect, it, vi } from "vitest";
vi.mock("../models/NewsStory.js", () => ({ NewsStory: { find: vi.fn() } }));
import { NewsStory } from "../models/NewsStory.js";
import { getLatestImportantStories } from "./newsService.js";
describe("news response formatting", () => {
  it("returns public fields and source links", async () => {
    const lean = vi.fn().mockResolvedValue([{ _id: { toString: () => "story1" }, headline: "A headline", summary: "A summary", whyItMatters: "It matters", category: "india", publishedAt: new Date("2026-01-01T00:00:00Z"), sourceArticles: [{ source: "PIB", url: "https://example.test" }] }]);
    const limit = vi.fn().mockReturnValue({ lean }); const sort = vi.fn().mockReturnValue({ limit }); vi.mocked(NewsStory.find).mockReturnValue({ sort } as never);
    await expect(getLatestImportantStories(20)).resolves.toEqual([{ id: "story1", headline: "A headline", summary: "A summary", whyItMatters: "It matters", category: "india", publishedAt: "2026-01-01T00:00:00.000Z", sources: [{ name: "PIB", url: "https://example.test" }] }]);
  });
});
