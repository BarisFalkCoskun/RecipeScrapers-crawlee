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
import { DISCOVERY, MONGODB_CONFIG } from "./config.js";
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

  log.info("Starting crawlers...");

  try {
    // Run Cheerio first — it discovers pages and enqueues JS-fallback URLs to playwrightQueue
    await cheerioCrawler.run();
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
  } finally {
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
