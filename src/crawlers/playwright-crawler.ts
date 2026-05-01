// src/crawlers/playwright-crawler.ts
import {
  Configuration,
  PlaywrightCrawler,
  createPlaywrightRouter,
  log,
  type RequestQueue,
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
import { execFile } from "node:child_process";
import { freemem, totalmem } from "node:os";
import { promisify } from "node:util";
import { gzipSync } from "zlib";
import { Binary } from "mongodb";
import * as cheerio from "cheerio";

const execFileAsync = promisify(execFile);
const BYTES_PER_MIB = 1024 * 1024;
const DEFAULT_CRAWLEE_AVAILABLE_MEMORY_RATIO = 0.25;
const SNAPSHOTTER_MAX_USED_MEMORY_RATIO = 0.9;
const SNAPSHOTTER_RESERVE_MEMORY_RATIO = 0.5;

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
  let handledRequestCount = 0;

  void logPlaywrightMemoryDiagnostics("crawler-start", {
    maxConcurrency: PLAYWRIGHT_CONFIG.maxConcurrency,
    maxRequestsPerMinute: PLAYWRIGHT_CONFIG.maxRequestsPerMinute,
    maxRequestsPerCrawl,
    waitForLoadState,
    waitForLoadStateTimeoutMs,
    respectRobotsTxtFile,
  });

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
    const rawHtmlBuffer = shouldStoreHtml
      ? gzipSync(Buffer.from(html))
      : undefined;

    log.info(
      `Playwright extracted ${extraction.recipes.length} recipes from ${canonicalUrl}`
    );

    const $ = cheerio.load(html);
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
        // Invalid URL
      }
    });

    await store.upsertPage({
      canonicalUrl,
      domain,
      language: pageLanguage.language,
      languageConfidence: pageLanguage.languageConfidence,
      languageSignals: pageLanguage.languageSignals,
      fetchedAt: new Date(),
      httpStatus: response?.status() ?? 200,
      fetchMode: "playwright",
      extractionMethod: extraction.method,
      extractorVersion: EXTRACTOR_VERSION,
      extractionConfidence: extraction.confidence,
      extractionSignals: extraction.signals,
      recipeCount: extraction.recipes.length,
      rawHtml: rawHtmlBuffer ? new Binary(rawHtmlBuffer) : undefined,
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
      fetchMode: "playwright",
      recipeCount: extraction.recipes.length,
      recipeLanguages,
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

      if (robotsTxt && !robotsTxt.isAllowed(candidate.canonicalUrl)) {
        metrics.recordBlockedUrl({
          domain: candidate.domain,
          reasons: ["robotsTxt"],
        });
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

    handledRequestCount += 1;
    await maybeLogPlaywrightRequestDiagnostics({
      handledRequestCount,
      requestUrl,
      canonicalUrl,
      domain,
      routeLabel,
      htmlBytes: Buffer.byteLength(html),
      bodyTextChars: bodyText.length,
      rawHtmlGzipBytes: rawHtmlBuffer?.byteLength ?? 0,
      recipeCount: extraction.recipes.length,
      discoveredCandidateCount: discoveredCandidates.length,
      freshCandidateCount: freshCandidates.length,
      queuedRequestCount: requestsToQueue.length,
      pageCount: page.context().pages().length,
      browserContextCount: page.context().browser()?.contexts().length ?? null,
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
        language: "und",
        languageConfidence: 0,
        languageSignals: ["language-undetected"],
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

interface PlaywrightRequestDiagnostics {
  handledRequestCount: number;
  requestUrl: string;
  canonicalUrl: string;
  domain: string;
  routeLabel: RequestLabel;
  htmlBytes: number;
  bodyTextChars: number;
  rawHtmlGzipBytes: number;
  recipeCount: number;
  discoveredCandidateCount: number;
  freshCandidateCount: number;
  queuedRequestCount: number;
  pageCount: number;
  browserContextCount: number | null;
}

async function maybeLogPlaywrightRequestDiagnostics(
  diagnostics: PlaywrightRequestDiagnostics
): Promise<void> {
  const options = getPlaywrightMemoryDiagnosticsOptions();
  if (!options.enabled) {
    return;
  }

  if (
    diagnostics.handledRequestCount !== 1 &&
    diagnostics.handledRequestCount % options.interval !== 0
  ) {
    return;
  }

  await logPlaywrightMemoryDiagnostics("request-sample", { ...diagnostics });
}

async function logPlaywrightMemoryDiagnostics(
  reason: string,
  context: Record<string, unknown>
): Promise<void> {
  const options = getPlaywrightMemoryDiagnosticsOptions();
  if (!options.enabled) {
    return;
  }

  const memoryUsage = process.memoryUsage();
  const processTree = await collectProcessTreeMemory(options.topProcesses).catch(
    (error: unknown) => ({
      error: error instanceof Error ? error.message : String(error),
    })
  );

  log.info("Playwright memory diagnostics", {
    reason,
    context,
    crawleeMemoryBudget: getCrawleeMemoryBudgetSnapshot(),
    nodeMemory: {
      rssMiB: bytesToMiB(memoryUsage.rss),
      heapUsedMiB: bytesToMiB(memoryUsage.heapUsed),
      heapTotalMiB: bytesToMiB(memoryUsage.heapTotal),
      externalMiB: bytesToMiB(memoryUsage.external),
      arrayBuffersMiB: bytesToMiB(memoryUsage.arrayBuffers),
    },
    hostMemory: {
      totalMiB: bytesToMiB(totalmem()),
      freeMiB: bytesToMiB(freemem()),
    },
    processTree,
  });
}

function getCrawleeMemoryBudgetSnapshot() {
  const crawleeConfig = Configuration.getGlobalConfig();
  const configuredMemoryMiB = crawleeConfig.get("memoryMbytes", 0);
  const availableMemoryRatio = crawleeConfig.get(
    "availableMemoryRatio",
    DEFAULT_CRAWLEE_AVAILABLE_MEMORY_RATIO
  );
  const budgetBytes =
    configuredMemoryMiB > 0
      ? configuredMemoryMiB * BYTES_PER_MIB
      : Math.ceil(totalmem() * availableMemoryRatio);
  const overloadBytes = budgetBytes * SNAPSHOTTER_MAX_USED_MEMORY_RATIO;
  const criticalBytes =
    overloadBytes +
    budgetBytes *
      (1 - SNAPSHOTTER_MAX_USED_MEMORY_RATIO) *
      SNAPSHOTTER_RESERVE_MEMORY_RATIO;

  return {
    source:
      configuredMemoryMiB > 0
        ? "CRAWLEE_MEMORY_MBYTES"
        : "CRAWLEE_AVAILABLE_MEMORY_RATIO",
    configuredMemoryMiB:
      configuredMemoryMiB > 0 ? configuredMemoryMiB : null,
    availableMemoryRatio,
    budgetMiB: bytesToMiB(budgetBytes),
    overloadAtMiB: bytesToMiB(overloadBytes),
    criticalWarningAtMiB: bytesToMiB(criticalBytes),
    env: {
      CRAWLEE_MEMORY_MBYTES: process.env["CRAWLEE_MEMORY_MBYTES"] ?? null,
      CRAWLEE_AVAILABLE_MEMORY_RATIO:
        process.env["CRAWLEE_AVAILABLE_MEMORY_RATIO"] ?? null,
    },
  };
}

async function collectProcessTreeMemory(topProcesses: number) {
  const { stdout } = await execFileAsync("ps", [
    "-A",
    "-o",
    "ppid=",
    "-o",
    "pid=",
    "-o",
    "rss=",
    "-o",
    "comm=",
  ]);
  const rows = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseProcessRow)
    .filter((row): row is ProcessMemoryRow => row !== null);
  const byPid = new Map(rows.map((row) => [row.pid, row]));
  const childrenByParent = new Map<number, ProcessMemoryRow[]>();
  for (const row of rows) {
    const siblings = childrenByParent.get(row.ppid) ?? [];
    siblings.push(row);
    childrenByParent.set(row.ppid, siblings);
  }

  const rootPid = process.pid;
  const seen = new Set<number>([rootPid]);
  const stack = [rootPid];
  const processTreeRows: ProcessMemoryRow[] = [];
  while (stack.length > 0) {
    const pid = stack.pop();
    if (pid === undefined) {
      continue;
    }

    const row = byPid.get(pid);
    if (row) {
      processTreeRows.push(row);
    }

    for (const child of childrenByParent.get(pid) ?? []) {
      if (seen.has(child.pid)) {
        continue;
      }

      seen.add(child.pid);
      stack.push(child.pid);
    }
  }

  const mainProcess = byPid.get(rootPid);
  const childProcesses = processTreeRows.filter((row) => row.pid !== rootPid);
  const childRssBytes = childProcesses.reduce(
    (sum, row) => sum + row.rssBytes,
    0
  );
  const mainRssBytes = mainProcess?.rssBytes ?? process.memoryUsage().rss;
  const topChildProcesses = [...childProcesses]
    .sort((a, b) => b.rssBytes - a.rssBytes)
    .slice(0, topProcesses)
    .map((row) => ({
      pid: row.pid,
      command: row.command,
      rssMiB: bytesToMiB(row.rssBytes),
    }));

  return {
    rootPid,
    processCount: processTreeRows.length,
    childProcessCount: childProcesses.length,
    mainRssMiB: bytesToMiB(mainRssBytes),
    childRssMiB: bytesToMiB(childRssBytes),
    totalRssMiB: bytesToMiB(mainRssBytes + childRssBytes),
    topChildProcesses,
  };
}

interface ProcessMemoryRow {
  ppid: number;
  pid: number;
  rssBytes: number;
  command: string;
}

function parseProcessRow(line: string): ProcessMemoryRow | null {
  const match = line.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
  if (!match) {
    return null;
  }

  const [, ppid, pid, rssKiB, command] = match;
  const parsed = {
    ppid: Number.parseInt(ppid, 10),
    pid: Number.parseInt(pid, 10),
    rssBytes: Number.parseInt(rssKiB, 10) * 1024,
    command,
  };

  if (
    !Number.isFinite(parsed.ppid) ||
    !Number.isFinite(parsed.pid) ||
    !Number.isFinite(parsed.rssBytes)
  ) {
    return null;
  }

  return parsed;
}

function getPlaywrightMemoryDiagnosticsOptions() {
  return {
    enabled: process.env["PLAYWRIGHT_MEMORY_DIAGNOSTICS"] !== "0",
    interval: readPositiveIntEnv("PLAYWRIGHT_MEMORY_DIAGNOSTICS_INTERVAL", 25),
    topProcesses: readPositiveIntEnv(
      "PLAYWRIGHT_MEMORY_DIAGNOSTICS_TOP_PROCESSES",
      6
    ),
  };
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function bytesToMiB(bytes: number): number {
  return Math.round((bytes / BYTES_PER_MIB) * 10) / 10;
}
