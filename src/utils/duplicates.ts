export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/\b(reuters|bbc|the hindu|indian express)\b/g, "").replace(/\s+/g, " ").trim();
}
export function areNearDuplicateTitles(a: string, b: string): boolean {
  const aWords = new Set(normalizeTitle(a).split(" ").filter(Boolean)); const bWords = new Set(normalizeTitle(b).split(" ").filter(Boolean));
  if (!aWords.size || !bWords.size) return false;
  let common = 0; for (const word of aWords) if (bWords.has(word)) common++;
  return common / Math.max(aWords.size, bWords.size) >= 0.8;
}
