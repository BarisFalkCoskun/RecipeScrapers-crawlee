import { log, type RequestQueue } from "crawlee";
import { REQUEST_LABELS } from "../crawlers/request-routing.js";
import type { LinkFilter } from "./link-filter.js";
import type { CrawlStore } from "../storage/store.js";
import type { CrawlMetrics } from "../telemetry/crawl-metrics.js";
import type { SeedAdmissionRole } from "../types.js";
import { canonicalizeUrl, normalizeDomain } from "../utils/canonicalize.js";

type FetchMode = "cheerio" | "playwright";

export interface RequestCandidate {
  url: string;
  canonicalUrl: string;
  domain: string;
  anchorText?: string;
}

interface EnqueueFreshRequestsOptions {
  queue: Pick<RequestQueue, "addRequestsBatched">;
  requestList?: AsyncIterable<{ url: string }> | null;
  store: CrawlStore;
  recrawlCutoff: Date;
  metrics: CrawlMetrics;
  fetchMode: FetchMode;
  batchSize?: number;
  linkFilter?: Pick<LinkFilter, "recordEnqueued" | "getQueueEligibility">;
  seedRolesByDomain?: Map<string, SeedAdmissionRole>;
}

const DEFAULT_BATCH_SIZE = 250;

export async function enqueueFreshRequestsFromSitemap(
  options: EnqueueFreshRequestsOptions
): Promise<{ enqueued: number; skippedFresh: number }> {
  const {
    queue,
    requestList,
    store,
    recrawlCutoff,
    metrics,
    fetchMode,
    batchSize = DEFAULT_BATCH_SIZE,
    linkFilter,
    seedRolesByDomain,
  } = options;

  if (!requestList) {
    return { enqueued: 0, skippedFresh: 0 };
  }

  let enqueued = 0;
  let skippedFresh = 0;
  let pendingBatch: RequestCandidate[] = [];

  for await (const request of requestList) {
    const candidate = toRequestCandidate(request.url);
    if (!candidate) {
      continue;
    }

    pendingBatch.push(candidate);

    if (pendingBatch.length >= batchSize) {
      const result = await flushBatch({
        queue,
        store,
        recrawlCutoff,
        metrics,
        fetchMode,
        batch: pendingBatch,
        linkFilter,
        seedRolesByDomain,
      });
      enqueued += result.enqueued;
      skippedFresh += result.skippedFresh;
      pendingBatch = [];
    }
  }

  if (pendingBatch.length > 0) {
    const result = await flushBatch({
      queue,
      store,
      recrawlCutoff,
      metrics,
      fetchMode,
      batch: pendingBatch,
      linkFilter,
      seedRolesByDomain,
    });
    enqueued += result.enqueued;
    skippedFresh += result.skippedFresh;
  }

  log.info(
    `Prepared ${enqueued} ${fetchMode} sitemap requests and skipped ${skippedFresh} fresh URLs before crawl`
  );

  return { enqueued, skippedFresh };
}

async function flushBatch({
  queue,
  store,
  recrawlCutoff,
  metrics,
  fetchMode,
  batch,
  linkFilter,
  seedRolesByDomain,
}: {
  queue: Pick<RequestQueue, "addRequestsBatched">;
  store: CrawlStore;
  recrawlCutoff: Date;
  metrics: CrawlMetrics;
  fetchMode: FetchMode;
  batch: RequestCandidate[];
  linkFilter?: Pick<LinkFilter, "recordEnqueued" | "getQueueEligibility">;
  seedRolesByDomain?: Map<string, SeedAdmissionRole>;
}): Promise<{ enqueued: number; skippedFresh: number }> {
  const { freshCandidates, skippedFresh } = await filterFreshRequestCandidates({
    candidates: batch,
    store,
    recrawlCutoff,
    metrics,
    fetchMode,
  });

  const requestsToAdd = freshCandidates.flatMap((candidate) => {
    const seedIsTrusted =
      (seedRolesByDomain?.get(candidate.domain) ?? "trusted") === "trusted";
    const queueEligibility = linkFilter?.getQueueEligibility(
      candidate.canonicalUrl,
      {
        allowSoftDiscovery: seedIsTrusted,
      }
    ) ?? {
      allowed: true,
      reasons: ["queue-eligible"],
    };

    if (!queueEligibility.allowed) {
      metrics.recordBlockedUrl({
        domain: candidate.domain,
        reasons: queueEligibility.reasons,
      });
      return [];
    }

    return [
      {
        url: candidate.url,
        uniqueKey: candidate.canonicalUrl,
        label: REQUEST_LABELS.sitemapPage,
        userData: {
          fromSitemap: true,
          seedDomain: candidate.domain,
          isTrustedSource: seedIsTrusted,
          discoverySource: "sitemap",
          admissionSignals: [
            ...queueEligibility.reasons,
            "same-domain-trusted-seed",
          ],
        },
      },
    ];
  });

  if (requestsToAdd.length === 0) {
    return { enqueued: 0, skippedFresh };
  }

  const addResult = await queue.addRequestsBatched(requestsToAdd, {
    waitForAllRequestsToBeAdded: true,
  });
  const enqueued = addResult.addedRequests.filter(
    (request) => !request.wasAlreadyPresent && !request.wasAlreadyHandled
  ).length;
  linkFilter?.recordEnqueued(
    addResult.addedRequests
      .filter((request) => !request.wasAlreadyPresent && !request.wasAlreadyHandled)
      .map((request) => request.uniqueKey)
  );

  return { enqueued, skippedFresh };
}

export async function filterFreshRequestCandidates<T extends RequestCandidate>({
  candidates,
  store,
  recrawlCutoff,
  metrics,
  fetchMode,
}: {
  candidates: T[];
  store: CrawlStore;
  recrawlCutoff: Date;
  metrics: CrawlMetrics;
  fetchMode: FetchMode;
}): Promise<{ freshCandidates: T[]; skippedFresh: number }> {
  const dedupedCandidates = dedupeCandidates(candidates);
  if (dedupedCandidates.length === 0) {
    return { freshCandidates: [], skippedFresh: 0 };
  }

  const freshCanonicalUrls = await store.findFreshPageUrls(
    dedupedCandidates.map((candidate) => candidate.canonicalUrl),
    recrawlCutoff
  );

  const freshCandidates: T[] = [];
  let skippedFresh = 0;

  for (const candidate of dedupedCandidates) {
    if (freshCanonicalUrls.has(candidate.canonicalUrl)) {
      metrics.recordRecrawlSkip({
        domain: candidate.domain,
        fetchMode,
      });
      skippedFresh += 1;
      continue;
    }

    freshCandidates.push(candidate);
  }

  return { freshCandidates, skippedFresh };
}

export function toRequestCandidate(
  url: string,
  anchorText?: string
): RequestCandidate | null {
  try {
    const canonicalUrl = canonicalizeUrl(url);
    const parsed = new URL(canonicalUrl);
    if (!isHttpUrl(parsed)) {
      return null;
    }

    return {
      url,
      canonicalUrl,
      domain: normalizeDomain(parsed.hostname),
      anchorText,
    };
  } catch {
    return null;
  }
}

function isHttpUrl(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

function dedupeCandidates<T extends RequestCandidate>(candidates: T[]): T[] {
  const byCanonicalUrl = new Map<string, T>();

  for (const candidate of candidates) {
    if (!byCanonicalUrl.has(candidate.canonicalUrl)) {
      byCanonicalUrl.set(candidate.canonicalUrl, candidate);
    }
  }

  return Array.from(byCanonicalUrl.values());
}
