import { describe, expect, it } from "vitest";
import { selectionSchema } from "./schemas.js";
describe("AI response validation", () => {
  it("requires only selected important IDs", () => expect(selectionSchema.parse({ selected: [{ articleId: "a1", important: true }] }).selected[0].articleId).toBe("a1"));
  it("rejects false selections", () => expect(() => selectionSchema.parse({ selected: [{ articleId: "a1", important: false }] })).toThrow());
});
