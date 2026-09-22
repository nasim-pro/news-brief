const trackingKeys = new Set(["fbclid", "gclid", "mc_cid", "mc_eid", "ref", "source"]);
export function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value); if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = ""; url.hostname = url.hostname.toLowerCase();
    for (const key of [...url.searchParams.keys()]) if (key.startsWith("utm_") || trackingKeys.has(key.toLowerCase())) url.searchParams.delete(key);
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch { return null; }
}
export function isHttpUrl(value: string): boolean { return normalizeUrl(value) !== null; }
