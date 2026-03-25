// src/main.ts
import { RequestQueue, log, LogLevel } from "crawlee";
import { config } from "dotenv";
import { RecipeStore } from "./storage/mongodb.js";
import { LinkFilter } from "./discovery/link-filter.js";
import { fetchSitemapUrls } from "./discovery/sitemap.js";
import { SEEDS } from "./discovery/seeds.js";
import { createCheerioCrawlerInstance } from "./crawlers/cheerio-crawler.js";
import { createPlaywrightCrawlerInstance } from "./crawlers/playwright-crawler.js";
import { canonicalizeUrl } from "./utils/canonicalize.js";

config(); // Load .env

log.setLevel(LogLevel.INFO);

async function main() {
  const mongoUri = process.env["MONGODB_URI"] ?? "mongodb://localhost:27017";
  const dbName = process.env["DB_NAME"] ?? "danishRecipes";

  const store = new RecipeStore(mongoUri, dbName);
  await store.connect();
  log.info("Connected to MongoDB");

  const linkFilter = new LinkFilter();

  const cheerioQueue = await RequestQueue.open("cheerio-queue");
  const playwrightQueue = await RequestQueue.open("playwright-queue");

  log.info(`Loading sitemaps from ${SEEDS.length} seed domains...`);

  for (const seed of SEEDS) {
    const entries = await fetchSitemapUrls(seed);
    const requests = entries.map((entry) => {
      const canonical = canonicalizeUrl(entry.url);
      return {
        url: entry.url,
        uniqueKey: canonical,
        userData: {
          fromSitemap: true,
          domain: seed.domain,
        },
      };
    });

    if (seed.requiresJs) {
      await playwrightQueue.addRequests(requests);
    } else {
      await cheerioQueue.addRequests(requests);
    }

    log.info(`Enqueued ${requests.length} URLs from ${seed.domain}`);
  }

  for (const seed of SEEDS) {
    const rootUrl = `https://${seed.domain}`;
    const queue = seed.requiresJs ? playwrightQueue : cheerioQueue;
    await queue.addRequest({
      url: rootUrl,
      uniqueKey: canonicalizeUrl(rootUrl),
      userData: { fromSitemap: false, domain: seed.domain },
    });
  }

  const seedDomains = new Map(
    SEEDS.map((s) => [s.domain, { requiresJs: s.requiresJs }])
  );

  const cheerioCrawler = createCheerioCrawlerInstance({
    store,
    linkFilter,
    playwrightQueue,
    cheerioQueue,
    seedDomains,
  });

  const playwrightCrawler = createPlaywrightCrawlerInstance({
    store,
    playwrightQueue,
    linkFilter,
  });

  log.info("Starting crawlers...");

  try {
    // Run Cheerio first — it discovers pages and enqueues JS-fallback URLs to playwrightQueue
    await cheerioCrawler.run();
    log.info("CheerioCrawler finished. Running Playwright for JS-fallback pages...");

    // Now run Playwright on whatever was enqueued during Cheerio crawling
    await playwrightCrawler.run();
  } finally {
    await store.close();
    log.info("Crawl complete. MongoDB connection closed.");
  }
}

main().catch((err) => {
  log.error(`Fatal error: ${err}`);
  process.exit(1);
});
