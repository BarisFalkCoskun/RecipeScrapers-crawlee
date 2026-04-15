import type { PageDocument } from "../types.js";

export function getRecrawlCutoff(
  recrawlAfterDays: number,
  now: Date = new Date()
): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - recrawlAfterDays);
  return cutoff;
}

export function wasFetchedSince(
  fetchedAt: Date | string,
  cutoff: Date
): boolean {
  const fetchedTime =
    fetchedAt instanceof Date ? fetchedAt.getTime() : new Date(fetchedAt).getTime();

  if (Number.isNaN(fetchedTime)) {
    return false;
  }

  return fetchedTime >= cutoff.getTime();
}

export function shouldSkipRecrawl(
  page: Pick<PageDocument, "fetchedAt"> | null,
  cutoff: Date
): boolean {
  if (page === null) {
    return false;
  }

  return wasFetchedSince(page.fetchedAt, cutoff);
}
