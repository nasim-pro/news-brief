import { describe, expect, it } from "vitest";
import { areNearDuplicateTitles } from "./duplicates.js";
describe("title duplicate detection", () => {
  it("finds small headline variations", () => expect(areNearDuplicateTitles("India launches new satellite today", "India launches a new satellite today")).toBe(true));
  it("does not merge unrelated headlines", () => expect(areNearDuplicateTitles("India launches satellite", "RBI changes bank liquidity rules")).toBe(false));
});
