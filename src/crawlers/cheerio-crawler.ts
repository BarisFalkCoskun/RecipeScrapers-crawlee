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
  const diagnostics = new CheerioCrawlerDiagnostics({
    linkFilter,
    logIntervalMs: CHEERIO_CONFIG.diagnosticsLoggingIntervalSecs * 1000,
    pageInterval: CHEERIO_CONFIG.diagnosticsPageInterval,
  });

  const handlePageRequest = async (
    routeLabel: RequestLabel,
    context: Parameters<Parameters<typeof router.addDefaultHandler>[0]>[0]
  ) => {
      const { request, $, body, response, robotsTxtFile } = context;
      const html = typeof body === "string" ? body : body.toString();
      const requestUrl = request.loadedUrl ?? request.url;
      const domain = normalizeDomain(new URL(requestUrl).hostname);
      const pageStartedAt = Date.now();
      diagnostics.recordRequestStarted(domain, requestUrl);
      const fromSitemap =
        routeLabel === REQUEST_LABELS.sitemapPage ||
        request.userData?.["fromSitemap"] === true;
      const admissionScore = Number(request.userData?.["admissionScore"] ?? 0);
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

      const bodyText = $("body").text();
      const compactBodyTextLength = bodyText.replace(/\s+/g, " ").trim().length;
      const fallbackReason = getPlaywrightFallbackReason(
        $,
        html,
        extraction,
        fromSitemap,
        admissionScore
      );
      const needsPlaywright = fallbackReason !== null;

      if (needsPlaywright && extraction.recipes.length === 0 && fallbackReason) {
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
        const newlyQueued =
          !enqueueInfo.wasAlreadyPresent && !enqueueInfo.wasAlreadyHandled;
        log.info(
          `Enqueueing to Playwright: ${canonicalUrl} ` +
            `reason=${fallbackReason} status=${formatQueueAddStatus(enqueueInfo)} ` +
            `route=${routeLabel} method=${extraction.method} ` +
            `confidence=${extraction.confidence.toFixed(2)} ` +
            `signals=${formatSignals(extraction.signals)} ` +
            `bodyTextLength=${compactBodyTextLength} ` +
            `fromSitemap=${fromSitemap} admissionScore=${admissionScore}`
        );
        if (newlyQueued) {
          metrics.recordFallbackQueued(domain, fallbackReason);
          linkFilter.recordEnqueued(canonicalizeUrl(requestUrl));
          diagnostics.recordFallbackQueued(domain, fallbackReason);
        }
      }

      const shouldStoreHtml =
        extraction.method !== "json-ld" || extraction.confidence < 0.5;

      const pageContentHash = hashHtml(html);
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

      let newlyQueuedCheerio = 0;
      let newlyQueuedPlaywright = 0;

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
        newlyQueuedCheerio = newlyAdded.length;
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
        newlyQueuedPlaywright = newlyAdded.length;
        linkFilter.recordEnqueued(addedKeys);
        recordOffDomainAdmissions(
          playwrightRequests,
          addedKeys,
          metrics,
          domain
        );
      }

      diagnostics.recordRequestFinished({
        domain,
        durationMillis: Date.now() - pageStartedAt,
        recipeCount: extraction.recipes.length,
        discoveredCandidates: discoveredCandidates.length,
        freshCandidates: freshCandidates.length,
        queuedCheerio: newlyQueuedCheerio,
        queuedPlaywright: newlyQueuedPlaywright,
      });
      await diagnostics.maybeLogProgress({
        trigger: "page-finished",
        domain,
        latestUrl: canonicalUrl,
        cheerioQueue,
        playwrightQueue,
      });
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
    async errorHandler({ request }, error) {
      const requestUrl = request.loadedUrl ?? request.url;
      const domain = normalizeDomain(new URL(requestUrl).hostname);
      diagnostics.recordRetry(domain);
      log.warning(
        `Cheerio retry diagnostic: url=${requestUrl} ` +
          `retryCount=${request.retryCount} label=${classifyCheerioRequest(request)} ` +
          `error=${formatErrorMessage(error)}`
      );
      await diagnostics.maybeLogProgress({
        trigger: "retry",
        domain,
        latestUrl: requestUrl,
        cheerioQueue,
        playwrightQueue,
      });
    },
    async failedRequestHandler({ request }, error) {
      const requestUrl = request.url;
      const domain = normalizeDomain(new URL(requestUrl).hostname);
      diagnostics.recordFailure(domain);
      log.error(`Failed after retries: ${requestUrl} - ${error.message}`);
      await diagnostics.maybeLogProgress({
        trigger: "failed-request",
        domain,
        latestUrl: requestUrl,
        cheerioQueue,
        playwrightQueue,
      });
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

interface CheerioCrawlerDiagnosticsOptions {
  linkFilter: LinkFilter;
  logIntervalMs: number;
  pageInterval: number;
}

interface CheerioDomainDiagnostics {
  domain: string;
  started: number;
  finished: number;
  recipes: number;
  fallbackQueued: number;
  fallbackReasons: Map<string, number>;
  discoveredCandidates: number;
  freshCandidates: number;
  queuedCheerio: number;
  queuedPlaywright: number;
  retries: number;
  failures: number;
  totalDurationMillis: number;
  maxDurationMillis: number;
  firstStartedAt?: number;
  lastStartedAt?: number;
  startGapSamples: number;
  totalStartGapMillis: number;
  maxStartGapMillis: number;
  latestUrl?: string;
}

class CheerioCrawlerDiagnostics {
  private domains = new Map<string, CheerioDomainDiagnostics>();
  private totalFinished = 0;
  private lastLogAt = Date.now();

  constructor(private readonly options: CheerioCrawlerDiagnosticsOptions) {}

  recordRequestStarted(domain: string, url: string): void {
    const stats = this.ensureDomain(domain);
    const now = Date.now();
    stats.started += 1;
    stats.latestUrl = url;

    if (stats.lastStartedAt !== undefined) {
      const gapMillis = now - stats.lastStartedAt;
      stats.startGapSamples += 1;
      stats.totalStartGapMillis += gapMillis;
      stats.maxStartGapMillis = Math.max(stats.maxStartGapMillis, gapMillis);
    } else {
      stats.firstStartedAt = now;
    }

    stats.lastStartedAt = now;
  }

  recordRequestFinished({
    domain,
    durationMillis,
    recipeCount,
    discoveredCandidates,
    freshCandidates,
    queuedCheerio,
    queuedPlaywright,
  }: {
    domain: string;
    durationMillis: number;
    recipeCount: number;
    discoveredCandidates: number;
    freshCandidates: number;
    queuedCheerio: number;
    queuedPlaywright: number;
  }): void {
    const stats = this.ensureDomain(domain);
    this.totalFinished += 1;
    stats.finished += 1;
    stats.recipes += recipeCount;
    stats.discoveredCandidates += discoveredCandidates;
    stats.freshCandidates += freshCandidates;
    stats.queuedCheerio += queuedCheerio;
    stats.queuedPlaywright += queuedPlaywright;
    stats.totalDurationMillis += durationMillis;
    stats.maxDurationMillis = Math.max(stats.maxDurationMillis, durationMillis);
  }

  recordFallbackQueued(domain: string, reason: string): void {
    const stats = this.ensureDomain(domain);
    stats.fallbackQueued += 1;
    stats.fallbackReasons.set(
      reason,
      (stats.fallbackReasons.get(reason) ?? 0) + 1
    );
  }

  recordRetry(domain: string): void {
    this.ensureDomain(domain).retries += 1;
  }

  recordFailure(domain: string): void {
    this.ensureDomain(domain).failures += 1;
  }

  async maybeLogProgress({
    trigger,
    domain,
    latestUrl,
    cheerioQueue,
    playwrightQueue,
  }: {
    trigger: string;
    domain: string;
    latestUrl: string;
    cheerioQueue: RequestQueue;
    playwrightQueue: RequestQueue;
  }): Promise<void> {
    const now = Date.now();
    const reachedPageInterval =
      this.options.pageInterval > 0 &&
      this.totalFinished > 0 &&
      this.totalFinished % this.options.pageInterval === 0;
    const reachedTimeInterval = now - this.lastLogAt >= this.options.logIntervalMs;

    if (!reachedPageInterval && !reachedTimeInterval) {
      return;
    }

    this.lastLogAt = now;
    const [cheerioInfo, playwrightInfo] = await Promise.all([
      safeQueueInfo(cheerioQueue),
      safeQueueInfo(playwrightQueue),
    ]);
    const currentDomainStats = this.domains.get(domain);
    const topDomains = this.topDomainsByFinished(3);

    log.info(
      `Cheerio diagnostics: trigger=${trigger} totalFinished=${this.totalFinished} ` +
        `currentDomain=${domain} current=${formatDomainDiagnostics(
          currentDomainStats
        )} ` +
        `cheerioQueue=${formatQueueInfo(cheerioInfo)} ` +
        `playwrightQueue=${formatQueueInfo(playwrightInfo)} ` +
        `linkFilterTotalEnqueued=${this.options.linkFilter.getTotalEnqueued()} ` +
        `latestUrl=${latestUrl}`
    );

    for (const stats of topDomains) {
      log.info(`Cheerio domain diagnostics: ${formatDomainDiagnostics(stats)}`);
    }
  }

  private ensureDomain(domain: string): CheerioDomainDiagnostics {
    const existing = this.domains.get(domain);
    if (existing) {
      return existing;
    }

    const created: CheerioDomainDiagnostics = {
      domain,
      started: 0,
      finished: 0,
      recipes: 0,
      fallbackQueued: 0,
      fallbackReasons: new Map(),
      discoveredCandidates: 0,
      freshCandidates: 0,
      queuedCheerio: 0,
      queuedPlaywright: 0,
      retries: 0,
      failures: 0,
      totalDurationMillis: 0,
      maxDurationMillis: 0,
      startGapSamples: 0,
      totalStartGapMillis: 0,
      maxStartGapMillis: 0,
    };
    this.domains.set(domain, created);
    return created;
  }

  private topDomainsByFinished(limit: number): CheerioDomainDiagnostics[] {
    return Array.from(this.domains.values())
      .sort((a, b) => b.finished - a.finished)
      .slice(0, limit);
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
      `Unable to read Cheerio queue diagnostics: ${
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

function formatDomainDiagnostics(
  stats: CheerioDomainDiagnostics | undefined
): string {
  if (!stats) {
    return "unavailable";
  }

  const avgStartGapMillis =
    stats.startGapSamples === 0
      ? 0
      : stats.totalStartGapMillis / stats.startGapSamples;
  const avgDurationMillis =
    stats.finished === 0 ? 0 : stats.totalDurationMillis / stats.finished;

  return (
    `{domain:${stats.domain},started:${stats.started},finished:${stats.finished},` +
    `recipes:${stats.recipes},fallbackQueued:${stats.fallbackQueued},` +
    `fallbackReasons:${formatMap(stats.fallbackReasons)},` +
    `discovered:${stats.discoveredCandidates},fresh:${stats.freshCandidates},` +
    `queuedCheerio:${stats.queuedCheerio},queuedPlaywright:${stats.queuedPlaywright},` +
    `retries:${stats.retries},failures:${stats.failures},` +
    `avgStartGapMs:${avgStartGapMillis.toFixed(0)},maxStartGapMs:${stats.maxStartGapMillis},` +
    `avgDurationMs:${avgDurationMillis.toFixed(0)},maxDurationMs:${stats.maxDurationMillis}}`
  );
}

function formatMap(map: Map<string, number>): string {
  if (map.size === 0) {
    return "none";
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("|");
}

function formatSignals(signals: string[]): string {
  if (signals.length === 0) {
    return "none";
  }

  const shown = signals.slice(0, 8).join("|");
  return signals.length > 8 ? `${shown}|+${signals.length - 8}` : shown;
}

function formatQueueAddStatus({
  wasAlreadyHandled,
  wasAlreadyPresent,
}: {
  wasAlreadyHandled: boolean;
  wasAlreadyPresent: boolean;
}): string {
  if (wasAlreadyHandled) {
    return "already-handled";
  }

  if (wasAlreadyPresent) {
    return "already-present";
  }

  return "new";
}

function formatErrorMessage(error: Error): string {
  return error.message.replace(/\s+/g, " ").slice(0, 300);
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
