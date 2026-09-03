import { STRIP_QUERY_PARAMS } from "../config.js";

export function canonicalizeUrl(rawUrl: string, baseUrl?: string): string {
  const url = new URL(rawUrl, baseUrl);

  // Lowercase hostname and strip www. prefix
  url.hostname = url.hostname.toLowerCase();
  if (url.hostname.startsWith("www.")) {
    url.hostname = url.hostname.slice(4);
  }

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

/**
 * Strip only the tracking parameters from a URL, changing nothing else.
 *
 * oetker publishes its Recipe `@id` as the page URL with a marketing query
 * string attached, and the `fbclid` in it is different on every request. That
 * `@id` feeds the upsert key, so the key changed every run and each crawl
 * inserted a duplicate document instead of updating one: seven of its recipes
 * held two or three copies, one per run, and the store grew while every run
 * reported a clean 806.
 *
 * Deliberately not `canonicalizeUrl`. That also lowercases the host, drops
 * `www`, sorts the query and trims a trailing slash, and re-keying every
 * record whose `@id` merely spells its URL differently would make one large
 * duplicate insert to fix a small one. A URL with nothing to strip is returned
 * byte-identical, so only the unstable `@id`s move.
 */
export function stripTrackingParams(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return rawUrl;

  const doomed: string[] = [];
  url.searchParams.forEach((_value, key) => {
    if (STRIP_QUERY_PARAMS.some((pattern) => pattern.test(key))) doomed.push(key);
  });
  if (doomed.length === 0) return rawUrl;

  for (const key of doomed) url.searchParams.delete(key);
  return url.toString();
}

export function normalizeDomain(hostname: string): string {
  const lower = hostname.toLowerCase();
  return lower.startsWith("www.") ? lower.slice(4) : lower;
}
