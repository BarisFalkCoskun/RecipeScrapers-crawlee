import http from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { RequestQueue, log, LogLevel } from "crawlee";
import { createCheerioCrawlerInstance } from "../crawlers/cheerio-crawler.js";
import { createPlaywrightCrawlerInstance } from "../crawlers/playwright-crawler.js";
import { REQUEST_LABELS } from "../crawlers/request-routing.js";
import { DISCOVERY } from "../config.js";
import { enqueueFreshRequestsFromSitemap } from "../discovery/enqueue-fresh.js";
import { LinkFilter } from "../discovery/link-filter.js";
import { createSitemapRequestList } from "../discovery/sitemap.js";
import type { CrawlStore } from "../storage/store.js";
import { CrawlMetrics } from "../telemetry/crawl-metrics.js";
import type {
  CrawlMetricsSummary,
  CrawlRunDocument,
  PageDocument,
  RecipeDocument,
  SeedConfig,
} from "../types.js";
import { canonicalizeUrl, normalizeDomain } from "../utils/canonicalize.js";
import { getRecrawlCutoff } from "../utils/recrawl.js";

log.setLevel(LogLevel.INFO);

async function main() {
  const requestCounts = new Map<string, number>();
  const server = createFixtureServer(requestCounts);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const domain = normalizeDomain(new URL(baseUrl).hostname);
  const recrawlCutoff = getRecrawlCutoff(DISCOVERY.recrawlAfterDays);
  const startedAt = new Date();
  const runId = randomUUID();

  const store = new MemoryCrawlStore();
  const freshSkipUrl = canonicalizeUrl(`${baseUrl}/recipe/fresh-skip`);

  await store.upsertPage({
    canonicalUrl: freshSkipUrl,
    domain,
    language: "da",
    languageConfidence: 1,
    languageSignals: ["preseeded-language"],
    fetchedAt: new Date(),
    httpStatus: 200,
    fetchMode: "cheerio",
    extractionMethod: "json-ld",
    extractorVersion: "smoke",
    extractionConfidence: 1,
    extractionSignals: ["preseeded-fresh"],
    recipeCount: 1,
    pageContentHash: "preseeded",
    discoverySource: "sitemap",
    admissionSignals: ["queue-eligible"],
    outboundRecipeLinks: [],
  });

  const seed: SeedConfig = {
    domain,
    sitemapUrl: `${baseUrl}/missing-sitemap.xml`,
    requiresJs: false,
    respectRobotsTxt: true,
    maxPages: 20,
    admissionRole: "trusted",
  };

  const metrics = new CrawlMetrics([domain]);
  const linkFilter = new LinkFilter({
    maxPagesByDomain: new Map([[domain, seed.maxPages]]),
  });
  const trustedSeedDomains = new Set([domain]);

  const [cheerioQueue, playwrightQueue, cheerioRequestList] = await Promise.all([
    RequestQueue.open(`smoke-cheerio-queue-${runId}`),
    RequestQueue.open(`smoke-playwright-queue-${runId}`),
    createSitemapRequestList([seed], `smoke-sitemap-request-list-${runId}`, {
      discoverSitemaps: async function* () {
        yield `${baseUrl}/sitemap.xml`;
      },
    }),
  ]);

  try {
    await enqueueFreshRequestsFromSitemap({
      queue: cheerioQueue,
      requestList: cheerioRequestList,
      store,
      recrawlCutoff,
      metrics,
      fetchMode: "cheerio",
      linkFilter,
      seedRolesByDomain: new Map([[domain, seed.admissionRole]]),
    });

    await cheerioQueue.addRequest({
      url: `${baseUrl}/`,
      uniqueKey: canonicalizeUrl(`${baseUrl}/`),
      label: REQUEST_LABELS.seedRoot,
      userData: {
        seedDomain: domain,
        isTrustedSource: true,
        discoverySource: "seed-root",
        admissionSignals: ["same-domain-trusted-seed"],
      },
    });

    const seedDomains = new Map([[domain, seed]]);
    const maxRequestsPerCrawl = seed.maxPages;

    const cheerioCrawler = createCheerioCrawlerInstance({
      store,
      linkFilter,
      playwrightQueue,
      cheerioQueue,
      seedDomains,
      trustedSeedDomains,
      maxRequestsPerCrawl,
      respectRobotsTxtFile: true,
      recrawlCutoff,
      metrics,
    });

    await cheerioCrawler.run();

    if (await playwrightQueue.isEmpty()) {
      throw new Error("Smoke crawl expected a Playwright fallback request");
    }

    const playwrightCrawler = createPlaywrightCrawlerInstance({
      store,
      playwrightQueue,
      linkFilter,
      trustedSeedDomains,
      maxRequestsPerCrawl,
      respectRobotsTxtFile: true,
      recrawlCutoff,
      metrics,
      waitForLoadState: "load",
      waitForLoadStateTimeoutMs: 2_000,
    });

    await playwrightCrawler.run();

    const finishedAt = new Date();
    const summary = metrics.buildSummary();
    await store.insertCrawlRun({
      startedAt,
      finishedAt,
      recrawlCutoff,
      seeds: [domain],
      summary,
    });

    assertSmokeRun({
      baseUrl,
      requestCounts,
      store,
      summary,
      freshSkipUrl,
    });

    console.log(
      `Smoke crawl passed: cheerio=${summary.processedByMode.cheerio}, playwright=${summary.processedByMode.playwright}, skips=${summary.recrawlSkips}, fallbacks=${summary.fallbacksEnqueued}`
    );
  } finally {
    server.close();
  }
}

function createFixtureServer(requestCounts: Map<string, number>) {
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    requestCounts.set(url.pathname, (requestCounts.get(url.pathname) ?? 0) + 1);

    if (url.pathname === "/robots.txt") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("User-agent: *\nAllow: /\n");
      return;
    }

    if (url.pathname === "/sitemap.xml") {
      res.writeHead(200, { "content-type": "application/xml" });
      res.end(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin(req)}/recipe/sitemap-static</loc></url>
  <url><loc>${origin(req)}/recipe/fresh-skip</loc></url>
  <url><loc>${origin(req)}/recipe/js-shell</loc></url>
</urlset>`);
      return;
    }

    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(`<!doctype html>
<html>
  <head>
    <title>Smoke Root</title>
    <script type="application/ld+json">${jsonLdRecipe("Root Recipe")}</script>
  </head>
  <body>
    <main>
      <h1>Rodfrugtgryde</h1>
      <p>ingredienser tilberedning opskrift portioner minutter</p>
      <a href="/recipe/discovered-static">Discovered recipe</a>
      <a href="/category/english">English recipes</a>
      <a href="/search?q=kage">Search noise</a>
    </main>
  </body>
</html>`);
      return;
    }

    if (url.pathname === "/recipe/sitemap-static") {
      respondRecipePage(res, "Sitemap Recipe");
      return;
    }

    if (url.pathname === "/recipe/discovered-static") {
      respondRecipePage(res, "Discovered Recipe");
      return;
    }

    if (url.pathname === "/recipe/playwright-discovered") {
      respondRecipePage(res, "Playwright Discovered Recipe");
      return;
    }

    if (url.pathname === "/category/english") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(`<!doctype html>
<html lang="en">
  <head>
    <title>English recipes</title>
  </head>
  <body>
    <main>
      <p>recipe ingredients instructions serves minutes</p>
      <a href="/recipes/english-cake">English cake recipe</a>
    </main>
  </body>
</html>`);
      return;
    }

    if (url.pathname === "/recipes/english-cake") {
      respondRecipePage(res, "English Cake", "en");
      return;
    }

    if (url.pathname === "/collection/seasonal") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(`<!doctype html>
<html>
  <head>
    <title>Seasonal recipes</title>
  </head>
  <body>
    <main>
      <h1>Seasonal recipes</h1>
      <a href="${origin(req)}/recipe/cross-domain-discovered">Chocolate cake recipe</a>
    </main>
  </body>
</html>`);
      return;
    }

    if (url.pathname === "/recipe/cross-domain-discovered") {
      respondRecipePage(res, "Cross Domain Recipe");
      return;
    }

    if (url.pathname === "/recipe/fresh-skip") {
      respondRecipePage(res, "Fresh Skip Recipe");
      return;
    }

    if (url.pathname === "/recipe/js-shell") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(`<!doctype html>
<html>
  <head>
    <title>JS Shell</title>
  </head>
  <body>
    <div id="app">loading</div>
    <script>
      const main = document.createElement("main");
      const heading = document.createElement("h1");
      heading.textContent = "Playwright Recipe";

      const copy = document.createElement("p");
      copy.textContent = "ingredienser tilberedning opskrift portioner minutter";

      const ldJson = document.createElement("script");
      ldJson.type = "application/ld+json";
      ldJson.textContent = ${JSON.stringify(jsonLdRecipe("Playwright Recipe"))};

      const link = document.createElement("a");
      link.href = "/recipe/playwright-discovered";
      link.textContent = "Playwright discovered";

      const crossDomainLink = document.createElement("a");
      crossDomainLink.href = ${JSON.stringify(
        `${crossOrigin(req)}/collection/seasonal`
      )};
      crossDomainLink.textContent = "More recipes";

      main.append(heading, copy, ldJson, link, crossDomainLink);
      document.body.replaceChildren(main);
    </script>
  </body>
</html>`);
      return;
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  });
}

function respondRecipePage(
  res: http.ServerResponse<http.IncomingMessage>,
  title: string,
  language = "da"
) {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(`<!doctype html>
<html lang="${language}">
  <head>
    <title>${title}</title>
    <script type="application/ld+json">${jsonLdRecipe(title, language)}</script>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${
        language === "en"
          ? "ingredients instructions recipe serves minutes"
          : "ingredienser tilberedning opskrift portioner minutter"
      }</p>
    </main>
  </body>
</html>`);
}

function jsonLdRecipe(title: string, language = "da") {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Recipe",
    inLanguage: language,
    name: title,
    recipeIngredient:
      language === "en" ? ["1 cup flour"] : ["1 kg kartofler"],
    recipeInstructions:
      language === "en" ? ["Mix everything together."] : ["Bland det hele sammen."],
  });
}

function origin(req: http.IncomingMessage) {
  return `http://${req.headers.host}`;
}

function crossOrigin(req: http.IncomingMessage) {
  const host = req.headers.host ?? "";
  const [, port = ""] = host.split(":");
  return `http://localhost:${port}`;
}

function assertSmokeRun({
  baseUrl,
  requestCounts,
  store,
  summary,
  freshSkipUrl,
}: {
  baseUrl: string;
  requestCounts: Map<string, number>;
  store: MemoryCrawlStore;
  summary: CrawlMetricsSummary;
  freshSkipUrl: string;
}) {
  if (requestCounts.get("/recipe/fresh-skip")) {
    throw new Error("Fresh sitemap URL was fetched instead of being skipped");
  }

  if (summary.recrawlSkips < 1) {
    throw new Error("Smoke crawl expected at least one recrawl skip");
  }

  if (summary.fallbacksEnqueued < 1) {
    throw new Error("Smoke crawl expected at least one Playwright fallback");
  }

  if (summary.offDomainAdmissions < 1) {
    throw new Error("Smoke crawl expected at least one off-domain admission");
  }

  if (!summary.newlyAdmittedDomains.includes("localhost")) {
    throw new Error(
      "Smoke crawl expected localhost to be recorded as a newly admitted domain"
    );
  }

  if (summary.processedByMode.cheerio < 3) {
    throw new Error("Smoke crawl expected Cheerio to process multiple pages");
  }

  if (summary.processedByMode.playwright < 2) {
    throw new Error(
      "Smoke crawl expected Playwright to process fallback and discovered pages"
    );
  }

  if ((summary.recipeLanguages["da"] ?? 0) < 1) {
    throw new Error("Smoke crawl expected Danish recipe language metrics");
  }

  if ((summary.recipeLanguages["en"] ?? 0) < 1) {
    throw new Error("Smoke crawl expected English recipe language metrics");
  }

  if ((summary.blockedUrlReasons["hard-denylist-pattern"] ?? 0) < 1) {
    throw new Error("Smoke crawl expected blocked URL reason metrics");
  }

  const expectedPages = [
    canonicalizeUrl(`${baseUrl}/`),
    canonicalizeUrl(`${baseUrl}/recipe/sitemap-static`),
    canonicalizeUrl(`${baseUrl}/recipe/discovered-static`),
    canonicalizeUrl(`${baseUrl}/category/english`),
    canonicalizeUrl(`${baseUrl}/recipes/english-cake`),
    canonicalizeUrl(`${baseUrl}/recipe/js-shell`),
    canonicalizeUrl(`${baseUrl}/recipe/playwright-discovered`),
    canonicalizeUrl(`http://localhost:${new URL(baseUrl).port}/collection/seasonal`),
    canonicalizeUrl(
      `http://localhost:${new URL(baseUrl).port}/recipe/cross-domain-discovered`
    ),
  ];

  for (const pageUrl of expectedPages) {
    if (!store.pages.has(pageUrl)) {
      throw new Error(`Smoke crawl expected page ${pageUrl} to be stored`);
    }
  }

  if (!store.pages.has(freshSkipUrl)) {
    throw new Error("Smoke crawl expected preseeded fresh page to remain stored");
  }

  if (store.recipes.size < 6) {
    throw new Error("Smoke crawl expected extracted recipes to be persisted");
  }

  const storedLanguages = new Set(
    Array.from(store.recipes.values()).map((recipe) => recipe.language)
  );
  if (!storedLanguages.has("da") || !storedLanguages.has("en")) {
    throw new Error("Smoke crawl expected recipes to be stored by language");
  }

  if (store.runs.length !== 1) {
    throw new Error("Smoke crawl expected one persisted crawl run summary");
  }
}

class MemoryCrawlStore implements CrawlStore {
  readonly pages = new Map<string, Omit<PageDocument, "_id">>();
  readonly recipes = new Map<string, Omit<RecipeDocument, "_id">>();
  readonly runs: Array<Omit<CrawlRunDocument, "_id">> = [];

  async upsertPage(page: Omit<PageDocument, "_id">): Promise<void> {
    this.pages.set(page.canonicalUrl, page);
  }

  async insertRecipe(recipe: Omit<RecipeDocument, "_id">): Promise<void> {
    const existing = this.recipes.get(recipe.contentHash);
    if (
      existing &&
      existing.extractionConfidence >= recipe.extractionConfidence
    ) {
      return;
    }

    this.recipes.set(recipe.contentHash, recipe);
  }

  async wasPageFetchedSince(
    canonicalUrl: string,
    fetchedAfter: Date
  ): Promise<boolean> {
    const page = this.pages.get(canonicalUrl);
    return page ? page.fetchedAt >= fetchedAfter : false;
  }

  async findFreshPageUrls(
    canonicalUrls: string[],
    fetchedAfter: Date
  ): Promise<Set<string>> {
    return new Set(
      canonicalUrls.filter((canonicalUrl) => {
        const page = this.pages.get(canonicalUrl);
        return page ? page.fetchedAt >= fetchedAfter : false;
      })
    );
  }

  async insertCrawlRun(run: Omit<CrawlRunDocument, "_id">): Promise<void> {
    this.runs.push(run);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
