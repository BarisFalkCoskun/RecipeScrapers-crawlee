// src/main.ts
import { RequestQueue, log, LogLevel } from "crawlee";
import { config } from "dotenv";
import { RecipeStore } from "./storage/mongodb.js";
import { CrawlMetrics } from "./telemetry/crawl-metrics.js";
import { LinkFilter } from "./discovery/link-filter.js";
import { enqueueFreshRequestsFromSitemap } from "./discovery/enqueue-fresh.js";
import { createSitemapRequestList } from "./discovery/sitemap.js";
import { SEEDS } from "./discovery/seeds.js";
import { createCheerioCrawlerInstance } from "./crawlers/cheerio-crawler.js";
import { createPlaywrightCrawlerInstance } from "./crawlers/playwright-crawler.js";
import { REQUEST_LABELS } from "./crawlers/request-routing.js";
import {
  CHEERIO_CONFIG,
  CRAWL_PROFILE,
  DISCOVERY,
  MONGODB_CONFIG,
  PLAYWRIGHT_CONFIG,
} from "./config.js";
import {
  createCrawlRunStorageKeys,
  resolveCrawlRunId,
} from "./crawl-run.js";
import type { SeedConfig } from "./types.js";
import { canonicalizeUrl, normalizeDomain } from "./utils/canonicalize.js";
import { getRecrawlCutoff } from "./utils/recrawl.js";

config(); // Load .env

log.setLevel(LogLevel.INFO);

async function main() {
  const mongoUri = process.env["MONGODB_URI"] ?? "mongodb://localhost:27017";
  const dbName =
    process.env["DB_NAME"] ?? MONGODB_CONFIG.defaultDatabaseName;
  const recrawlCutoff = getRecrawlCutoff(DISCOVERY.recrawlAfterDays);
  const startedAt = new Date();
  const crawlRunId = resolveCrawlRunId(startedAt);
  const storageKeys = createCrawlRunStorageKeys(crawlRunId);

  const store = new RecipeStore(mongoUri, dbName);
  await store.connect();
  log.info("Connected to MongoDB");
  log.info(`Crawl run id: ${crawlRunId}`);
  log.info(
    `Recrawl TTL enabled: skipping pages fetched since ${recrawlCutoff.toISOString()}`
  );
  log.info(
    `Crawl settings: profile=${CRAWL_PROFILE} ` +
      `cheerio={maxConcurrency:${CHEERIO_CONFIG.maxConcurrency},maxRequestsPerMinute:${CHEERIO_CONFIG.maxRequestsPerMinute},sameDomainDelaySecs:${CHEERIO_CONFIG.sameDomainDelaySecs},maxRetries:${CHEERIO_CONFIG.maxRequestRetries}} ` +
      `playwright={maxConcurrency:${PLAYWRIGHT_CONFIG.maxConcurrency},maxRequestsPerMinute:${PLAYWRIGHT_CONFIG.maxRequestsPerMinute},sameDomainDelaySecs:${PLAYWRIGHT_CONFIG.sameDomainDelaySecs},maxRetries:${PLAYWRIGHT_CONFIG.maxRequestRetries},waitForLoadState:${PLAYWRIGHT_CONFIG.waitForLoadState}} ` +
      `discovery={defaultMaxPagesPerDomain:${DISCOVERY.defaultMaxPagesPerDomain},globalQueueCap:${DISCOVERY.globalQueueCap},maxTrustedDomainNonRecipeHops:${DISCOVERY.maxTrustedDomainNonRecipeHops}}`
  );

  const normalizedSeeds = SEEDS.map((seed) => normalizeSeed(seed));
  const metrics = new CrawlMetrics(
    normalizedSeeds.map((seed) => normalizeDomain(seed.domain))
  );
  const seedRolesByDomain = new Map(
    normalizedSeeds.map((seed) => [
      normalizeDomain(seed.domain),
      seed.admissionRole,
    ])
  );

  const linkFilter = await LinkFilter.open({
    maxPagesByDomain: new Map(
      normalizedSeeds.map((seed) => [normalizeDomain(seed.domain), seed.maxPages])
    ),
    persistStateKey: storageKeys.linkFilterStateKey,
  });

  const cheerioSeeds = normalizedSeeds.filter((seed) => !seed.requiresJs);
  const playwrightSeeds = normalizedSeeds.filter((seed) => seed.requiresJs);

  const [cheerioQueue, playwrightQueue, cheerioRequestList, playwrightRequestList] =
    await Promise.all([
      RequestQueue.open(storageKeys.cheerioQueueName),
      RequestQueue.open(storageKeys.playwrightQueueName),
      createSitemapRequestList(cheerioSeeds, storageKeys.cheerioSitemapStateKey),
      createSitemapRequestList(
        playwrightSeeds,
        storageKeys.playwrightSitemapStateKey
      ),
    ]);

  log.info(`Prepared sitemap sources for ${normalizedSeeds.length} seed domains`);

  await Promise.all([
    enqueueFreshRequestsFromSitemap({
      queue: cheerioQueue,
      requestList: cheerioRequestList,
      store,
      recrawlCutoff,
      metrics,
      fetchMode: "cheerio",
      linkFilter,
      seedRolesByDomain,
    }),
    enqueueFreshRequestsFromSitemap({
      queue: playwrightQueue,
      requestList: playwrightRequestList,
      store,
      recrawlCutoff,
      metrics,
      fetchMode: "playwright",
      linkFilter,
      seedRolesByDomain,
    }),
  ]);

  for (const seed of normalizedSeeds) {
    const fetchMode = seed.requiresJs ? "playwright" : "cheerio";
    const queue = seed.requiresJs ? playwrightQueue : cheerioQueue;

    for (const startUrl of resolveSeedStartUrls(seed)) {
      const canonicalStartUrl = canonicalizeUrl(startUrl);
      if (await store.wasPageFetchedSince(canonicalStartUrl, recrawlCutoff)) {
        metrics.recordRecrawlSkip({
          domain: normalizeDomain(seed.domain),
          fetchMode,
        });
        log.info(`Skipping fresh seed start URL ${canonicalStartUrl}`);
        continue;
      }

      const addResult = await queue.addRequest({
        url: startUrl,
        uniqueKey: canonicalStartUrl,
        label: REQUEST_LABELS.seedRoot,
        userData: {
          seedDomain: normalizeDomain(seed.domain),
          isTrustedSource: seed.admissionRole === "trusted",
          discoverySource: REQUEST_LABELS.seedRoot,
          admissionSignals: ["same-domain-trusted-seed"],
        },
      });
      if (!addResult.wasAlreadyPresent && !addResult.wasAlreadyHandled) {
        linkFilter.recordEnqueued(canonicalStartUrl);
      }
    }
  }

  const seedDomains = new Map(
    normalizedSeeds.map((seed) => [normalizeDomain(seed.domain), seed])
  );
  const trustedSeedDomains = new Set(
    normalizedSeeds
      .filter((seed) => seed.admissionRole === "trusted")
      .map((seed) => normalizeDomain(seed.domain))
  );
  const maxRequestsPerCrawl = calculateMaxRequestsPerCrawl(normalizedSeeds);
  log.info(
    `Seed domains: ${normalizedSeeds
      .map((seed) => `${seed.domain}:${seed.maxPages}`)
      .join(", ")}`
  );
  log.info(
    `Storage keys: cheerioQueue=${storageKeys.cheerioQueueName} ` +
      `playwrightQueue=${storageKeys.playwrightQueueName} ` +
      `linkFilterState=${storageKeys.linkFilterStateKey}`
  );
  log.info(`Max requests per crawl: ${maxRequestsPerCrawl}`);

  await logQueueSnapshot("after initial enqueue", cheerioQueue, playwrightQueue);

  const cheerioCrawler = createCheerioCrawlerInstance({
    store,
    linkFilter,
    playwrightQueue,
    cheerioQueue,
    seedDomains,
    trustedSeedDomains,
    maxRequestsPerCrawl,
    respectRobotsTxtFile: shouldRespectRobotsTxt(cheerioSeeds),
    recrawlCutoff,
    metrics,
  });
  const signalDiagnostics = installSignalDiagnostics({
    startedAt,
    crawlRunId,
    metrics,
    linkFilter,
    cheerioQueue,
    playwrightQueue,
  });

  log.info("Starting crawlers...");

  try {
    // Run Cheerio first — it discovers pages and enqueues JS-fallback URLs to playwrightQueue
    await cheerioCrawler.run();
    await logQueueSnapshot("after CheerioCrawler", cheerioQueue, playwrightQueue);
    if (await playwrightQueue.isEmpty()) {
      log.info("CheerioCrawler finished. No Playwright work was enqueued.");
      return;
    }

    log.info("CheerioCrawler finished. Starting Playwright for queued fallback pages...");

    const playwrightCrawler = createPlaywrightCrawlerInstance({
      store,
      playwrightQueue,
      linkFilter,
      trustedSeedDomains,
      maxRequestsPerCrawl,
      respectRobotsTxtFile: shouldRespectRobotsTxt(playwrightSeeds),
      recrawlCutoff,
      metrics,
    });

    // Run Playwright only when there is queued JS work or JS-only seeds to process.
    await playwrightCrawler.run();
    await logQueueSnapshot("after PlaywrightCrawler", cheerioQueue, playwrightQueue);
  } finally {
    signalDiagnostics.dispose();
    const finishedAt = new Date();
    const summary = metrics.buildSummary();
    metrics.logSummary();
    await store.insertCrawlRun({
      startedAt,
      finishedAt,
      recrawlCutoff,
      seeds: normalizedSeeds.map((seed) => normalizeDomain(seed.domain)),
      summary,
    });
    await linkFilter.close();
    await store.close();
    log.info("Crawl complete. MongoDB connection closed.");
  }
}

main().catch((err) => {
  log.error(`Fatal error: ${err}`);
  process.exit(1);
});

function normalizeSeed(seed: SeedConfig): SeedConfig {
  return {
    ...seed,
    domain: normalizeDomain(seed.domain),
  };
}

function calculateMaxRequestsPerCrawl(seeds: SeedConfig[]): number {
  return seeds.reduce((sum, seed) => sum + seed.maxPages, 0);
}

function shouldRespectRobotsTxt(seeds: SeedConfig[]): boolean {
  return seeds.length > 0 && seeds.every((seed) => seed.respectRobotsTxt);
}

function resolveSeedStartUrls(seed: SeedConfig): string[] {
  const rootUrl = `https://${normalizeDomain(seed.domain)}`;
  const urls = [
    rootUrl,
    ...(seed.startUrls ?? []).map((startUrl) =>
      new URL(startUrl, rootUrl).toString()
    ),
  ];

  return Array.from(new Set(urls));
}

async function logQueueSnapshot(
  phase: string,
  cheerioQueue: RequestQueue,
  playwrightQueue: RequestQueue
): Promise<void> {
  const [cheerioInfo, playwrightInfo] = await Promise.all([
    safeQueueInfo(cheerioQueue),
    safeQueueInfo(playwrightQueue),
  ]);

  log.info(
    `Queue snapshot (${phase}): ` +
      `cheerio=${formatQueueInfo(cheerioInfo)} ` +
      `playwright=${formatQueueInfo(playwrightInfo)}`
  );
}

function installSignalDiagnostics({
  startedAt,
  crawlRunId,
  metrics,
  linkFilter,
  cheerioQueue,
  playwrightQueue,
}: {
  startedAt: Date;
  crawlRunId: string;
  metrics: CrawlMetrics;
  linkFilter: LinkFilter;
  cheerioQueue: RequestQueue;
  playwrightQueue: RequestQueue;
}): { dispose: () => void } {
  let handlingSignal = false;

  const handler = (signal: NodeJS.Signals) => {
    if (handlingSignal) {
      return;
    }
    handlingSignal = true;

    const exitCode = signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1;
    const forceExitTimer = setTimeout(() => process.exit(exitCode), 5000);
    forceExitTimer.unref();

    void logSignalDiagnostics({
      signal,
      startedAt,
      crawlRunId,
      metrics,
      linkFilter,
      cheerioQueue,
      playwrightQueue,
    }).finally(() => {
      clearTimeout(forceExitTimer);
      process.exit(exitCode);
    });
  };

  process.once("SIGINT", handler);
  process.once("SIGTERM", handler);

  return {
    dispose: () => {
      process.off("SIGINT", handler);
      process.off("SIGTERM", handler);
    },
  };
}

async function logSignalDiagnostics({
  signal,
  startedAt,
  crawlRunId,
  metrics,
  linkFilter,
  cheerioQueue,
  playwrightQueue,
}: {
  signal: NodeJS.Signals;
  startedAt: Date;
  crawlRunId: string;
  metrics: CrawlMetrics;
  linkFilter: LinkFilter;
  cheerioQueue: RequestQueue;
  playwrightQueue: RequestQueue;
}): Promise<void> {
  const elapsedMillis = Date.now() - startedAt.getTime();
  const summary = metrics.buildSummary();
  const [cheerioInfo, playwrightInfo] = await Promise.all([
    safeQueueInfo(cheerioQueue),
    safeQueueInfo(playwrightQueue),
  ]);

  log.warning(
    `Received ${signal}; crawl diagnostics before exit: ` +
      `runId=${crawlRunId} elapsedMillis=${elapsedMillis} ` +
      `processed=${summary.processedPages} ` +
      `cheerioProcessed=${summary.processedByMode.cheerio} ` +
      `playwrightProcessed=${summary.processedByMode.playwright} ` +
      `recipes=${summary.extractedRecipes} ` +
      `fallbacks=${summary.fallbacksEnqueued} ` +
      `recrawlSkips=${summary.recrawlSkips} ` +
      `blockedUrls=${sumRecord(summary.blockedUrlReasons)} ` +
      `linkFilterTotalEnqueued=${linkFilter.getTotalEnqueued()}`
  );
  log.warning(
    `Signal queue snapshot: cheerio=${formatQueueInfo(cheerioInfo)} ` +
      `playwright=${formatQueueInfo(playwrightInfo)}`
  );

  if (Object.keys(summary.playwrightFallbacksByReason).length > 0) {
    log.warning(
      `Signal fallback reasons: ${formatRecord(
        summary.playwrightFallbacksByReason
      )}`
    );
  }

  const topDomains = [...summary.domains]
    .sort((a, b) => b.processedPages - a.processedPages)
    .slice(0, 5);
  for (const domain of topDomains) {
    log.warning(
      `Signal domain snapshot ${domain.domain}: processed=${domain.processedPages} ` +
        `recipes=${domain.extractedRecipes} fallbacks=${domain.fallbacksEnqueued} ` +
        `blockedUrls=${sumRecord(domain.blockedUrlReasons)}`
    );
  }
}

async function safeQueueInfo(queue: RequestQueue): Promise<{
  totalRequestCount: number;
  handledRequestCount: number;
  pendingRequestCount: number;
} | null> {
  try {
    const info = await queue.getInfo();
    if (!info) {
      return null;
    }

    return {
      totalRequestCount: info.totalRequestCount,
      handledRequestCount: info.handledRequestCount,
      pendingRequestCount: info.pendingRequestCount,
    };
  } catch (error) {
    log.warning(
      `Unable to read queue info: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

function formatQueueInfo(
  info: Awaited<ReturnType<typeof safeQueueInfo>>
): string {
  if (!info) {
    return "unavailable";
  }

  return `{total:${info.totalRequestCount},handled:${info.handledRequestCount},pending:${info.pendingRequestCount}}`;
}

function formatRecord(record: Record<string, number>): string {
  return Object.entries(record)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join(",");
}

function sumRecord(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, value) => sum + value, 0);
}
