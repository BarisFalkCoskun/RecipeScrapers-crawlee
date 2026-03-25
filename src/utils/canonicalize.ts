import { STRIP_QUERY_PARAMS } from "../config.js";

export function canonicalizeUrl(rawUrl: string, baseUrl?: string): string {
  const url = new URL(rawUrl, baseUrl);

  // Lowercase hostname
  url.hostname = url.hostname.toLowerCase();

  // Remove fragments
  url.hash = "";

  // Strip tracking query params
  const keysToDelete: string[] = [];
  url.searchParams.forEach((_value, key) => {
    if (STRIP_QUERY_PARAMS.some((pattern) => pattern.test(key))) {
      keysToDelete.push(key);
    }
  });
  for (const key of keysToDelete) {
    url.searchParams.delete(key);
  }

  // Sort remaining params for consistency
  url.searchParams.sort();

  // Remove AMP/mobile path prefixes
  url.pathname = url.pathname.replace(/^\/(amp|m)\//, "/");

  // Strip trailing slash (but not from root "/")
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}
