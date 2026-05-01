// src/crawlers/cheerio-crawler.ts
import {
  CheerioCrawler,
  createCheerioRouter,
  type RequestQueue,
  log,
} from "crawlee";
import { extractJsonLdRecipes } from "../extractors/json-ld.js";
import { extractHtmlFallback } from "../extractors/html-fallback.js";
import { canonicalizeUrl, normalizeDomain } from "../utils/canonicalize.js";
import { hashRecipe, hashHtml } from "../utils/hash.js";
import { detectLanguage } from "../utils/language.js";
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
  classifyCheerioRequest,
  type RequestLabel,
} from "./request-routing.js";
import { LinkFilter } from "../discovery/link-filter.js";
import type { CrawlStore } from "../storage/store.js";
import {
  CHEERIO_CONFIG,
  EXTRACTOR_VERSION,
} from "../config.js";
import type { ExtractionResult, SeedConfig } from "../types.js";
import { gzipSync } from "zlib";
import { Binary } from "mongodb";
import { getPlaywrightFallbackReason } from "./fallback-policy.js";

interface CreateCheerioCrawlerOptions {
  store: CrawlStore;
  linkFilter: LinkFilter;
  playwrightQueue: RequestQueue;
  cheerioQueue: RequestQueue;
  seedDomains: Map<string, SeedConfig>;
  trustedSeedDomains: Set<string>;
  maxRequestsPerCrawl: number;
  respectRobotsTxtFile: boolean;
  recrawlCutoff: Date;
  metrics: CrawlMetrics;
}

export function createCheerioCrawlerInstance(
  options: CreateCheerioCrawlerOptions
) {
  const {
    store,
    linkFilter,
    playwrightQueue,
    cheerioQueue,
    seedDomains,
    trustedSeedDomains,
    maxRequestsPerCrawl,
    respectRobotsTxtFile,
    recrawlCutoff,
    metrics,
  } = options;
  const router = createCheerioRouter();
  const logSkippedRequest = createSkippedRequestLogger("CheerioCrawler");

  const handlePageRequest = async (
    routeLabel: RequestLabel,
    context: Parameters<Parameters<typeof router.addDefaultHandler>[0]>[0]
  ) => {
      const { request, $, body, response, robotsTxtFile } = context;
      const html = typeof body === "string" ? body : body.toString();
      const requestUrl = request.loadedUrl ?? request.url;
      const domain = normalizeDomain(new URL(requestUrl).hostname);
      const fromSitemap =
        routeLabel === REQUEST_LABELS.sitemapPage ||
        request.userData?.["fromSitemap"] === true;
      const sourceDiscoverySource =
        (request.userData?.["discoverySource"] as
          | "seed-root"
          | "sitemap"
          | "discovered"
          | "playwright-fallback"
          | undefined) ??
        requestLabelToDiscoverySource(routeLabel);
      const sourceIsTrusted = request.userData?.["isTrustedSource"] === true;
      const seedDomain =
        normalizeDomain(
          (request.userData?.["seedDomain"] as string | undefined) ?? domain
        );
      const robotsTxt =
        robotsTxtFile as { isAllowed(url: string): boolean } | undefined;

      // Dynamic canonicalization — handle relative canonical tags
      const canonicalTag = $('link[rel="canonical"]').attr("href");
      let canonicalUrl: string;
      try {
        canonicalUrl = canonicalTag
          ? canonicalizeUrl(canonicalTag, requestUrl)
          : canonicalizeUrl(requestUrl);
      } catch {
        canonicalUrl = canonicalizeUrl(requestUrl);
      }

      if (await store.wasPageFetchedSince(canonicalUrl, recrawlCutoff)) {
        metrics.recordRecrawlSkip({ domain, fetchMode: "cheerio" });
        log.info(`Skipping fresh Cheerio page ${canonicalUrl}`);
        return;
      }

      linkFilter.recordPageCrawled(domain);

      let extraction: ExtractionResult;
      const jsonLdResult = extractJsonLdRecipes(html);

      if (jsonLdResult.recipes.length > 0) {
        extraction = {
          recipes: jsonLdResult.recipes,
          method: "json-ld",
          confidence: 1.0,
          signals: jsonLdResult.signals,
        };
      } else {
        const htmlResult = extractHtmlFallback($);
        if (htmlResult.recipes.length > 0) {
          extraction = {
            recipes: htmlResult.recipes,
            method: "html-parsing",
            confidence: htmlResult.confidence,
            signals: htmlResult.signals,
          };
        } else {
          extraction = {
            recipes: [],
            method: "partial",
            confidence: 0,
            signals: htmlResult.signals,
          };
        }
      }

      const fallbackReason = getPlaywrightFallbackReason(
        $,
        html,
        extraction,
        fromSitemap,
        Number(request.userData?.["admissionScore"] ?? 0)
      );
      const needsPlaywright = fallbackReason !== null;

      if (needsPlaywright && extraction.recipes.length === 0 && fallbackReason) {
        log.info(`Enqueueing to Playwright: ${canonicalUrl}`);
        const enqueueInfo = await playwrightQueue.addRequest({
          url: requestUrl,
          uniqueKey: canonicalizeUrl(requestUrl),
          label: REQUEST_LABELS.playwrightFallback,
          userData: {
            ...request.userData,
            playwrightRetry: true,
            discoverySource: "playwright-fallback",
            playwrightFallbackReason: fallbackReason,
          },
        });
        if (!enqueueInfo.wasAlreadyPresent && !enqueueInfo.wasAlreadyHandled) {
          metrics.recordFallbackQueued(domain, fallbackReason);
          linkFilter.recordEnqueued(canonicalizeUrl(requestUrl));
        }
      }

      const shouldStoreHtml =
        extraction.method !== "json-ld" || extraction.confidence < 0.5;

      const pageContentHash = hashHtml(html);
      const bodyText = $("body").text();
      const pageLanguage = detectLanguage({
        $,
        html,
        domain,
        bodyText,
        recipe: extraction.recipes[0] as Record<string, unknown> | undefined,
      });

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
          // Invalid URL, skip
        }
      });

      await store.upsertPage({
        canonicalUrl,
        domain,
        language: pageLanguage.language,
        languageConfidence: pageLanguage.languageConfidence,
        languageSignals: pageLanguage.languageSignals,
        fetchedAt: new Date(),
        httpStatus: response.statusCode ?? 200,
        fetchMode: "cheerio",
        redirectChain:
          request.loadedUrl && request.loadedUrl !== request.url
            ? [request.url, request.loadedUrl]
            : undefined,
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
          (request.userData?.["admissionSignals"] as string[] | undefined) ??
          [],
        playwrightFallbackReason:
          (request.userData?.["playwrightFallbackReason"] as string | undefined) ??
          fallbackReason ??
          undefined,
        outboundRecipeLinks,
      });

      const recipeLanguages: string[] = [];
      for (const rawRecipe of extraction.recipes) {
        const recipeObj = rawRecipe as Record<string, unknown>;
        const recipeLanguage = detectLanguage({
          recipe: recipeObj,
          $,
          html,
          domain,
          bodyText,
        });
        recipeLanguages.push(recipeLanguage.language);
        const contentHash = hashRecipe(recipeObj);
        await store.insertRecipe({
          pageUrl: canonicalUrl,
          domain,
          language: recipeLanguage.language,
          languageConfidence: recipeLanguage.languageConfidence,
          languageSignals: recipeLanguage.languageSignals,
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
        fetchMode: "cheerio",
        recipeCount: extraction.recipes.length,
        recipeLanguages,
      });

      const isRecipePage = extraction.recipes.length > 0;
      const sourceHasRecipeSignals = extraction.recipes.length > 0;
      const currentNonRecipeHops =
        (request.userData?.["nonRecipeHops"] as number) ?? 0;

      const { freshCandidates } = await filterFreshRequestCandidates({
        candidates: discoveredCandidates,
        store,
        recrawlCutoff,
        metrics,
        fetchMode: "cheerio",
      });

      const cheerioRequests: Array<{
        url: string;
        uniqueKey: string;
        label: RequestLabel;
        userData: Record<string, unknown>;
        decision: AdmissionDecision;
      }> = [];
      const playwrightRequests: Array<{
        url: string;
        uniqueKey: string;
        label: RequestLabel;
        userData: Record<string, unknown>;
        decision: AdmissionDecision;
      }> = [];

      for (const candidate of freshCandidates) {
        const canonical = candidate.canonicalUrl;
        const isRecipeLink = linkFilter.isRecipeLikeUrl(canonical);
        const decision = evaluateAdmission(candidate, {
          sourceDomain: domain,
          sourceIsTrusted,
          sourceIsRecipePage: isRecipePage,
          sourceDiscoverySource,
          sourceHasRecipeSignals,
          trustedSeedDomains,
          linkFilter,
        });

        const shouldFollow = shouldFollowCandidate({
          decision,
          isRecipeLike: isRecipeLink,
          sourceIsTrusted,
          nonRecipeHops: currentNonRecipeHops,
        });

        if (!shouldFollow) {
          metrics.recordBlockedUrl({
            domain: candidate.domain,
            reasons: decision.allowed
              ? ["non-recipe-hop-limit"]
              : decision.reasons,
          });
          continue;
        }

        if (robotsTxt && !robotsTxt.isAllowed(canonical)) {
          metrics.recordBlockedUrl({
            domain: candidate.domain,
            reasons: ["robotsTxt"],
          });
          logSkippedRequest({ url: canonical, reason: "robotsTxt" });
          continue;
        }

        const linkDomain = normalizeDomain(new URL(canonical).hostname);
        const seedConfig = seedDomains.get(linkDomain);
        const userData = {
          seedDomain,
          sourceDomain: domain,
          isTrustedSource: sourceIsTrusted,
          discoverySource: "discovered",
          admissionSignals: decision.reasons,
          admissionScore: decision.score,
          nonRecipeHops: isRecipeLink ? 0 : currentNonRecipeHops + 1,
        };
        if (seedConfig?.requiresJs) {
          playwrightRequests.push({
            url: canonical,
            uniqueKey: canonical,
            label: REQUEST_LABELS.discoveredPage,
            userData,
            decision,
          });
          continue;
        }

        cheerioRequests.push({
          url: canonical,
          uniqueKey: canonical,
          label: REQUEST_LABELS.discoveredPage,
          userData,
          decision,
        });
      }

      if (cheerioRequests.length > 0) {
        const addResult = await cheerioQueue.addRequestsBatched(
          cheerioRequests.map(({ decision, ...requestInfo }) => requestInfo),
          { waitForAllRequestsToBeAdded: true }
        );
        const newlyAdded = addResult.addedRequests.filter(
          (requestInfo) =>
            !requestInfo.wasAlreadyPresent && !requestInfo.wasAlreadyHandled
        );
        const addedKeys = newlyAdded.map((requestInfo) => requestInfo.uniqueKey);
        linkFilter.recordEnqueued(addedKeys);
        recordOffDomainAdmissions(
          cheerioRequests,
          addedKeys,
          metrics,
          domain
        );
      }

      if (playwrightRequests.length > 0) {
        const addResult = await playwrightQueue.addRequestsBatched(
          playwrightRequests.map(({ decision, ...requestInfo }) => requestInfo),
          { waitForAllRequestsToBeAdded: true }
        );
        const newlyAdded = addResult.addedRequests.filter(
          (requestInfo) =>
            !requestInfo.wasAlreadyPresent && !requestInfo.wasAlreadyHandled
        );
        const addedKeys = newlyAdded.map((requestInfo) => requestInfo.uniqueKey);
        linkFilter.recordEnqueued(addedKeys);
        recordOffDomainAdmissions(
          playwrightRequests,
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
  router.addDefaultHandler(async (context) => {
    await handlePageRequest(classifyCheerioRequest(context.request), context);
  });

  return new CheerioCrawler({
    requestQueue: cheerioQueue,
    requestHandler: router,
    maxConcurrency: CHEERIO_CONFIG.maxConcurrency,
    maxRequestsPerMinute: CHEERIO_CONFIG.maxRequestsPerMinute,
    maxRequestRetries: CHEERIO_CONFIG.maxRequestRetries,
    sameDomainDelaySecs: CHEERIO_CONFIG.sameDomainDelaySecs,
    maxRequestsPerCrawl,
    respectRobotsTxtFile,
    onSkippedRequest: logSkippedRequest,
    statusMessageLoggingInterval: CHEERIO_CONFIG.statusMessageLoggingIntervalSecs,
    async failedRequestHandler({ request }, error) {
      const requestUrl = request.url;
      const domain = normalizeDomain(new URL(requestUrl).hostname);
      log.error(`Failed after retries: ${requestUrl} - ${error.message}`);
      await store.upsertPage({
        canonicalUrl: canonicalizeUrl(requestUrl),
        domain,
        language: "und",
        languageConfidence: 0,
        languageSignals: ["language-undetected"],
        fetchedAt: new Date(),
        httpStatus: 0,
        fetchMode: "cheerio",
        extractionMethod: "failed",
        extractorVersion: EXTRACTOR_VERSION,
        extractionConfidence: 0,
        extractionSignals: [],
        recipeCount: 0,
        pageContentHash: "",
        discoverySource: requestLabelToDiscoverySource(
          classifyCheerioRequest(request)
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
