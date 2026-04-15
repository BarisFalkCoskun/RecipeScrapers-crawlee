// src/crawlers/playwright-crawler.ts
import {
  PlaywrightCrawler,
  createPlaywrightRouter,
  log,
  type RequestQueue,
} from "crawlee";
import { extractJsonLdRecipes } from "../extractors/json-ld.js";
import { extractHtmlFallback } from "../extractors/html-fallback.js";
import { canonicalizeUrl, normalizeDomain } from "../utils/canonicalize.js";
import { hashRecipe, hashHtml } from "../utils/hash.js";
import { CrawlMetrics } from "../telemetry/crawl-metrics.js";
import {
  filterFreshRequestCandidates,
  toRequestCandidate,
  type RequestCandidate,
} from "../discovery/enqueue-fresh.js";
import {
  evaluateAdmission,
  shouldFollowCandidate,
  type AdmissionDecision,
} from "../discovery/admission.js";
import {
  REQUEST_LABELS,
  classifyPlaywrightRequest,
  type RequestLabel,
} from "./request-routing.js";
import type { CrawlStore } from "../storage/store.js";
import {
  PLAYWRIGHT_CONFIG,
  EXTRACTOR_VERSION,
} from "../config.js";
import { LinkFilter } from "../discovery/link-filter.js";
import type { ExtractionResult } from "../types.js";
import { gzipSync } from "zlib";
import { Binary } from "mongodb";
import * as cheerio from "cheerio";

interface CreatePlaywrightCrawlerOptions {
  store: CrawlStore;
  playwrightQueue: RequestQueue;
  linkFilter: LinkFilter;
  trustedSeedDomains: Set<string>;
  maxRequestsPerCrawl: number;
  respectRobotsTxtFile: boolean;
  recrawlCutoff: Date;
  metrics: CrawlMetrics;
  waitForLoadState?: "load" | "domcontentloaded" | "networkidle";
  waitForLoadStateTimeoutMs?: number;
}

export function createPlaywrightCrawlerInstance(
  options: CreatePlaywrightCrawlerOptions
) {
  const {
    store,
    playwrightQueue,
    linkFilter,
    trustedSeedDomains,
    maxRequestsPerCrawl,
    respectRobotsTxtFile,
    recrawlCutoff,
    metrics,
    waitForLoadState = PLAYWRIGHT_CONFIG.waitForLoadState,
    waitForLoadStateTimeoutMs = PLAYWRIGHT_CONFIG.waitForLoadStateTimeoutMs,
  } = options;
  const router = createPlaywrightRouter();
  const logSkippedRequest = createSkippedRequestLogger("PlaywrightCrawler");

  const handlePageRequest = async (
    routeLabel: RequestLabel,
    context: Parameters<Parameters<typeof router.addDefaultHandler>[0]>[0]
  ) => {
    const { request, page, response, robotsTxtFile } = context;
    const requestUrl = request.loadedUrl ?? request.url;
    const domain = normalizeDomain(new URL(requestUrl).hostname);
    const sourceDiscoverySource =
      (request.userData?.["discoverySource"] as
        | "seed-root"
        | "sitemap"
        | "discovered"
        | "playwright-fallback"
        | undefined) ?? requestLabelToDiscoverySource(routeLabel);
    const sourceIsTrusted = request.userData?.["isTrustedSource"] === true;
    const seedDomain =
      normalizeDomain(
        (request.userData?.["seedDomain"] as string | undefined) ?? domain
      );
    const robotsTxt =
      robotsTxtFile as { isAllowed(url: string): boolean } | undefined;

    await page
      .waitForLoadState(waitForLoadState, {
        timeout: waitForLoadStateTimeoutMs,
      })
      .catch(() => {
        log.warning(
          `${waitForLoadState} timeout for ${requestUrl}, proceeding with current content`
        );
      });

    const html = await page.content();

    const canonicalTag = await page
      .locator('link[rel="canonical"]')
      .first()
      .getAttribute("href")
      .catch(() => null);
    let canonicalUrl: string;
    try {
      canonicalUrl = canonicalTag
        ? canonicalizeUrl(canonicalTag, requestUrl)
        : canonicalizeUrl(requestUrl);
    } catch {
      canonicalUrl = canonicalizeUrl(requestUrl);
    }

    const isPlaywrightFallback =
      routeLabel === REQUEST_LABELS.playwrightFallback ||
      request.userData?.["playwrightRetry"] === true;
    if (!isPlaywrightFallback && (await store.wasPageFetchedSince(canonicalUrl, recrawlCutoff))) {
      metrics.recordRecrawlSkip({ domain, fetchMode: "playwright" });
      log.info(`Skipping fresh Playwright page ${canonicalUrl}`);
      return;
    }

    let extraction: ExtractionResult;
    const jsonLdResult = extractJsonLdRecipes(html);

    if (jsonLdResult.recipes.length > 0) {
      extraction = {
        recipes: jsonLdResult.recipes,
        method: "json-ld",
        confidence: 1.0,
        signals: [...jsonLdResult.signals, "playwright-js-rendered"],
      };
    } else {
      const $ = cheerio.load(html);
      const htmlResult = extractHtmlFallback($);
      if (htmlResult.recipes.length > 0) {
        extraction = {
          recipes: htmlResult.recipes,
          method: "html-parsing",
          confidence: htmlResult.confidence,
          signals: [
            ...htmlResult.signals,
            "playwright-fallback",
            "playwright-js-rendered",
          ],
        };
      } else {
        extraction = {
          recipes: [],
          method: "partial",
          confidence: 0,
          signals: ["playwright-fallback", "playwright-js-rendered"],
        };
      }
    }

    const pageContentHash = hashHtml(html);
    const shouldStoreHtml = extraction.method !== "json-ld";

    log.info(
      `Playwright extracted ${extraction.recipes.length} recipes from ${canonicalUrl}`
    );

    const $ = cheerio.load(html);
    const outboundRecipeLinks: string[] = [];
    const discoveredCandidates: RequestCandidate[] = [];
    $("a[href]").each((_i, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      try {
        const absolute = new URL(href, requestUrl).toString();
        const candidate = toRequestCandidate(absolute, $(el).text());
        if (!candidate) return;
        discoveredCandidates.push(candidate);
        if (linkFilter.isRecipeLikeUrl(candidate.canonicalUrl)) {
          outboundRecipeLinks.push(candidate.canonicalUrl);
        }
      } catch {
        // Invalid URL
      }
    });

    await store.upsertPage({
      canonicalUrl,
      domain,
      fetchedAt: new Date(),
      httpStatus: response?.status() ?? 200,
      fetchMode: "playwright",
      extractionMethod: extraction.method,
      extractorVersion: EXTRACTOR_VERSION,
      extractionConfidence: extraction.confidence,
      extractionSignals: extraction.signals,
      recipeCount: extraction.recipes.length,
      rawHtml: shouldStoreHtml
        ? new Binary(gzipSync(Buffer.from(html)))
        : undefined,
      pageContentHash,
      discoverySource: sourceDiscoverySource,
      sourceDomain:
        (request.userData?.["sourceDomain"] as string | undefined) ?? undefined,
      admissionSignals:
        (request.userData?.["admissionSignals"] as string[] | undefined) ?? [],
      playwrightFallbackReason:
        (request.userData?.["playwrightFallbackReason"] as string | undefined) ??
        undefined,
      outboundRecipeLinks,
    });

    for (const rawRecipe of extraction.recipes) {
      const recipeObj = rawRecipe as Record<string, unknown>;
      const contentHash = hashRecipe(recipeObj);
      await store.insertRecipe({
        pageUrl: canonicalUrl,
        domain,
        extractedAt: new Date(),
        extractionMethod: extraction.method as
          | "json-ld"
          | "html-parsing"
          | "partial",
        extractorVersion: EXTRACTOR_VERSION,
        extractionConfidence: extraction.confidence,
        rawRecipe: recipeObj,
        extractionSignals: extraction.signals,
        contentHash,
        sourceHash: contentHash,
      });
    }

    metrics.recordPageProcessed({
      domain,
      fetchMode: "playwright",
      recipeCount: extraction.recipes.length,
    });

    const { freshCandidates } = await filterFreshRequestCandidates({
      candidates: discoveredCandidates,
      store,
      recrawlCutoff,
      metrics,
      fetchMode: "playwright",
    });

    const requestsToQueue: Array<{
      url: string;
      uniqueKey: string;
      label: RequestLabel;
      userData: Record<string, unknown>;
      decision: AdmissionDecision;
    }> = [];
    const isRecipePage = extraction.recipes.length > 0;
    const currentNonRecipeHops =
      (request.userData?.["nonRecipeHops"] as number) ?? 0;

    for (const candidate of freshCandidates) {
      const isRecipeLink = linkFilter.isRecipeLikeUrl(candidate.canonicalUrl);
      const decision = evaluateAdmission(candidate, {
        sourceDomain: domain,
        sourceIsTrusted,
        sourceIsRecipePage: isRecipePage,
        sourceDiscoverySource,
        sourceHasRecipeSignals: extraction.recipes.length > 0,
        trustedSeedDomains,
        linkFilter,
      });

      if (
        !shouldFollowCandidate({
          decision,
          isRecipeLike: isRecipeLink,
          sourceIsTrusted,
          nonRecipeHops: currentNonRecipeHops,
        })
      ) {
        continue;
      }

      if (robotsTxt && !robotsTxt.isAllowed(candidate.canonicalUrl)) {
        logSkippedRequest({ url: candidate.canonicalUrl, reason: "robotsTxt" });
        continue;
      }

      requestsToQueue.push({
        url: candidate.canonicalUrl,
        uniqueKey: candidate.canonicalUrl,
        label: REQUEST_LABELS.discoveredPage,
        userData: {
          seedDomain,
          sourceDomain: domain,
          isTrustedSource: sourceIsTrusted,
          discoverySource: "discovered",
          admissionSignals: decision.reasons,
          admissionScore: decision.score,
          nonRecipeHops: isRecipeLink ? 0 : currentNonRecipeHops + 1,
        },
        decision,
      });
    }

    if (requestsToQueue.length > 0) {
      const addResult = await playwrightQueue.addRequestsBatched(
        requestsToQueue.map(({ decision, ...requestInfo }) => requestInfo),
        { waitForAllRequestsToBeAdded: true }
      );
      const newlyAdded = addResult.addedRequests.filter(
        (requestInfo) =>
          !requestInfo.wasAlreadyPresent && !requestInfo.wasAlreadyHandled
      );
      const addedKeys = newlyAdded.map((requestInfo) => requestInfo.uniqueKey);
      linkFilter.recordEnqueued(addedKeys);
      recordOffDomainAdmissions(
        requestsToQueue,
        addedKeys,
        metrics,
        domain
      );
    }
  };

  router.addHandler(REQUEST_LABELS.seedRoot, async (context) => {
    await handlePageRequest(REQUEST_LABELS.seedRoot, context);
  });
  router.addHandler(REQUEST_LABELS.sitemapPage, async (context) => {
    await handlePageRequest(REQUEST_LABELS.sitemapPage, context);
  });
  router.addHandler(REQUEST_LABELS.discoveredPage, async (context) => {
    await handlePageRequest(REQUEST_LABELS.discoveredPage, context);
  });
  router.addHandler(REQUEST_LABELS.playwrightFallback, async (context) => {
    await handlePageRequest(REQUEST_LABELS.playwrightFallback, context);
  });
  router.addDefaultHandler(async (context) => {
    await handlePageRequest(classifyPlaywrightRequest(context.request), context);
  });

  return new PlaywrightCrawler({
    requestQueue: playwrightQueue,
    requestHandler: router,
    maxConcurrency: PLAYWRIGHT_CONFIG.maxConcurrency,
    maxRequestsPerMinute: PLAYWRIGHT_CONFIG.maxRequestsPerMinute,
    maxRequestRetries: PLAYWRIGHT_CONFIG.maxRequestRetries,
    sameDomainDelaySecs: PLAYWRIGHT_CONFIG.sameDomainDelaySecs,
    maxRequestsPerCrawl,
    maxSessionRotations: PLAYWRIGHT_CONFIG.maxSessionRotations,
    respectRobotsTxtFile,
    onSkippedRequest: logSkippedRequest,
    statusMessageLoggingInterval:
      PLAYWRIGHT_CONFIG.statusMessageLoggingIntervalSecs,
    useSessionPool: true,
    persistCookiesPerSession: true,
    preNavigationHooks: [
      async ({ page }) => {
        await page.route("**/*", (route) => {
          const resourceType = route.request().resourceType();
          if (resourceType === "image" || resourceType === "font" || resourceType === "media") {
            return route.abort();
          }

          return route.continue();
        });
      },
    ],
    launchContext: {
      launchOptions: {
        headless: true,
      },
    },
    async failedRequestHandler({ request }, error) {
      const requestUrl = request.url;
      const domain = normalizeDomain(new URL(requestUrl).hostname);
      log.error(`Playwright failed after retries: ${requestUrl} - ${error.message}`);
      await store.upsertPage({
        canonicalUrl: canonicalizeUrl(requestUrl),
        domain,
        fetchedAt: new Date(),
        httpStatus: 0,
        fetchMode: "playwright",
        extractionMethod: "failed",
        extractorVersion: EXTRACTOR_VERSION,
        extractionConfidence: 0,
        extractionSignals: ["playwright-fallback"],
        recipeCount: 0,
        pageContentHash: "",
        discoverySource: requestLabelToDiscoverySource(
          classifyPlaywrightRequest(request)
        ),
        sourceDomain:
          (request.userData?.["sourceDomain"] as string | undefined) ?? undefined,
        admissionSignals:
          (request.userData?.["admissionSignals"] as string[] | undefined) ?? [],
        playwrightFallbackReason:
          (request.userData?.["playwrightFallbackReason"] as string | undefined) ??
          undefined,
        outboundRecipeLinks: [],
      });
    },
  });
}

function requestLabelToDiscoverySource(
  routeLabel: RequestLabel
): "seed-root" | "sitemap" | "discovered" | "playwright-fallback" {
  switch (routeLabel) {
    case REQUEST_LABELS.seedRoot:
      return "seed-root";
    case REQUEST_LABELS.sitemapPage:
      return "sitemap";
    case REQUEST_LABELS.playwrightFallback:
      return "playwright-fallback";
    default:
      return "discovered";
  }
}

function recordOffDomainAdmissions(
  requests: Array<{
    uniqueKey: string;
    decision: AdmissionDecision;
  }>,
  addedKeys: string[],
  metrics: CrawlMetrics,
  sourceDomain: string
): void {
  const addedKeySet = new Set(addedKeys);
  for (const request of requests) {
    if (!request.decision.crossDomain || !addedKeySet.has(request.uniqueKey)) {
      continue;
    }

    const targetDomain = normalizeDomain(new URL(request.uniqueKey).hostname);
    metrics.recordOffDomainAdmission({
      sourceDomain,
      targetDomain,
    });
  }
}

function createSkippedRequestLogger(crawlerName: string) {
  return ({ url, reason }: { url: string; reason: string }) => {
    if (reason === "robotsTxt") {
      log.warning(`${crawlerName} skipped ${url} (${reason})`);
      return;
    }

    log.debug(`${crawlerName} skipped ${url} (${reason})`);
  };
}
