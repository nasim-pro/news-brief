import { describe, expect, it } from "vitest";
import { normalizeUrl } from "./url.js";
describe("normalizeUrl", () => {
  it("removes tracking parameters and fragments", () => expect(normalizeUrl("https://Example.com/a/?utm_source=x&keep=yes#part")).toBe("https://example.com/a?keep=yes"));
  it("rejects non-web URLs", () => expect(normalizeUrl("javascript:alert(1)")).toBeNull());
});
