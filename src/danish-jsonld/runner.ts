import { randomUUID } from "node:crypto";
import { canonicalizeUrl } from "../utils/canonicalize.js";
import { hashRecipe } from "../utils/hash.js";
import { CrawlWorkJournal, checkpointPath, workKey, type WorkDisposition } from "./work-journal.js";
import {
  RequestQueue,
  log,
  type CheerioCrawlingContext,
  type PlaywrightCrawlingContext,
  type Request,
} from "crawlee";
import type { RecipeDocumentV2Store, CrawlStore } from "../storage/store.js";
import type { DanishJsonLdRunSummary, SourceRunOutcomeSummary } from "../types.js";
import {
  classifySourceOutcome,
  createDanishJsonLdRunSummary,
} from "./source-outcome.js";
import type { SourceRunObservation } from "./source-outcome.js";
import type { DanishJsonLdSource } from "./source-registry.js";
import type { DanishJsonLdCrawlOptions } from "./source-selection.js";
import {
  DanishJsonLdSourceSession,
  type DanishJsonLdDiagnostic,
  type DanishJsonLdRequest,
  type DanishJsonLdRequestKind,
} from "./crawler.js";
import {
  createDanishJsonLdCheerioCrawler,
  createDanishJsonLdPlaywrightCrawler,
  DANISH_JSONLD_BROWSER_USER_AGENT,
  DANISH_JSONLD_IMPIT_PROFILE,
} from "./crawler-factories.js";
import {
  createBoundedDiagnostic,
  createBudgetedDiagnosticSink,
} from "./diagnostics.js";
import {
  VpnRotationRetryError,
  isVpnRelayPoolExhaustedError,
  requestVpnSessionId,
  siteVpnSessionId,
  type DanishJsonLdVpnTransport,
} from "./vpn-transport.js";
import { createDrListRequest } from "../custom/dr.js";
import { looksLikeBrowserCheckDocument } from "./discovery.js";
import { DanishJsonLdSiteSession } from "./site-session.js";
import { IncrementalRecipeCache, CacheMissRetryError, type CachedRecipeResponse } from "./incremental-cache.js";
import { WebsiteCooldowns, CooldownPendingError, WebsiteResponseRetryError } from "./website-cooldowns.js";
import { AdaptiveRequestPacing, PacingPendingError } from "./adaptive-pacing.js";
import { requestProfileFor } from "./request-profile.js";

export interface DanishJsonLdCrawlSelection extends DanishJsonLdCrawlOptions {
  sourceIds: string[];
  sources: DanishJsonLdSource[];
}

export const DANISH_JSONLD_OBSERVED_HTTP_ERROR_STATUS_CODES = [
  401, 403, 429, 454, 455, 526,
] as const;
/**
 * A service that ends its pagination window with an error document answers the
 * page past the last one with HTTP 400. That status has to reach the route for
 * the terminal payload to be read, but only for sources that declare one: a
 * 400 anywhere else is a real failed request and must stay one.
 */
export function httpErrorStatusCodesForSources(
  sources: readonly DanishJsonLdSource[]
): number[] {
  const codes = [...DANISH_JSONLD_OBSERVED_HTTP_ERROR_STATUS_CODES] as number[];
  const endsOnTerminalPayload = sources.some(
    (source) => source.listingDiscovery?.payload?.terminalPayload !== undefined
  );
  return endsOnTerminalPayload ? [...codes, 400] : codes;
}

const QUEUE_RECLAIM_GRACE_BUFFER_MS = 100;

/** WAF interstitials a real browser clears for the rest of its session. */
const BROWSER_CHECK_STATUS_CODES = [454, 455];

/**
 * Some hosts answer the same interstitial under an ordinary error status
 * instead of 454/455 — simply.com alternates between 454 and 500 for it — so a
 * challenge is recognised by its status or, failing that, by its body. Reading
 * the body only when the status is unhelpful keeps a genuine server error a
 * failure rather than an endlessly retried challenge.
 */
function isBrowserCheck(statusCode: number, body?: string): boolean {
  if (BROWSER_CHECK_STATUS_CODES.includes(statusCode)) return true;
  return statusCode >= 500 && body !== undefined && looksLikeBrowserCheckDocument(body);
}

/**
 * A rendered browser check is worth re-requesting: the browser clears the
 * challenge once, so the retry lands on the real page. Only the rendered path
 * qualifies, because a plain HTTP client never clears it.
 */
export function shouldRetryBrowserCheck(input: {
  statusCode: number;
  retryCount: number;
  maxRetries: number;
  body?: string;
}): boolean {
  return (
    isBrowserCheck(input.statusCode, input.body) &&
    input.retryCount < input.maxRetries
  );
}

/** Plain HTTP cannot clear a browser challenge; retry that request in Chromium. */
export function shouldEscalateBrowserCheck(input: {
  statusCode: number;
  fetchMode: "cheerio" | "playwright";
  vpnEnabled: boolean;
  body?: string;
}): boolean {
  return (
    input.fetchMode === "cheerio" &&
    !input.vpnEnabled &&
    isBrowserCheck(input.statusCode, input.body)
  );
}

/**
 * How long to let a WAF interstitial finish before giving up on it. The
 * simply.com challenge resolves in about three seconds; the budget is well
 * clear of that without stalling a source whose challenge never completes.
 */
const BROWSER_CHECK_SETTLE_TIMEOUT_MS = 15_000;
const BROWSER_CHECK_POLL_MS = 500;

/**
 * Read the page a browser actually ended up on. A WAF interstitial replaces
 * itself with the real document once its challenge script runs, so reading
 * content the moment navigation settles captures the challenge instead of the
 * page: madrejsen answers every listing URL with one, and the crawl saw five
 * blocked requests and no candidates while a browser reaches the real 16-link
 * listing about three seconds later. Waiting for the interstitial to go away
 * costs nothing on an ordinary page, which never enters the loop.
 */
export async function readSettledPageContent(
  page: { content: () => Promise<string>; waitForTimeout: (ms: number) => Promise<void> },
  options: { timeoutMs?: number; pollMs?: number } = {}
): Promise<{ body: string; clearedBrowserCheck: boolean }> {
  let body = await page.content();
  if (!looksLikeBrowserCheckDocument(body)) {
    return { body, clearedBrowserCheck: false };
  }
  const timeoutMs = options.timeoutMs ?? BROWSER_CHECK_SETTLE_TIMEOUT_MS;
  const pollMs = options.pollMs ?? BROWSER_CHECK_POLL_MS;
  for (let waited = 0; waited < timeoutMs; waited += pollMs) {
    await page.waitForTimeout(pollMs);
    body = await page.content();
    if (!looksLikeBrowserCheckDocument(body)) {
      return { body, clearedBrowserCheck: true };
    }
  }
  return { body, clearedBrowserCheck: false };
}

export class BrowserCheckRetryError extends Error {
  constructor(statusCode: number) {
    super(`Rendered browser check HTTP ${statusCode}; retrying in session`);
    this.name = "BrowserCheckRetryError";
  }
}

/**
 * A browser check is cleared by the browser session that met it, so the retry
 * must keep the same relay. Rotating would throw that cleared session away and
 * spend one relay per challenge until the pool is exhausted.
 */
export function shouldRotateRelayOnFailure(error: unknown): boolean {
  return !(error instanceof BrowserCheckRetryError || error instanceof WebsiteResponseRetryError || error instanceof CooldownPendingError || error instanceof CacheMissRetryError || error instanceof PacingPendingError);
}

interface DanishJsonLdAttemptQueue {
  kind: "cheerio" | "playwright";
  queue: Pick<RequestQueue, "drop">;
}

export async function cleanupDanishJsonLdAttemptQueues(input: {
  queues: DanishJsonLdAttemptQueue[];
  sameDomainDelaySecs: number;
  sourceId: string;
  crawlRunId: string;
  crawlAttemptId: string;
  diagnosticSink: (event: DanishJsonLdDiagnostic) => void;
  sleep?: (milliseconds: number) => Promise<void>;
}): Promise<void> {
  const reclaimGraceMillis = input.sameDomainDelaySecs > 0
    ? Math.ceil(input.sameDomainDelaySecs * 1_000) + QUEUE_RECLAIM_GRACE_BUFFER_MS
    : 0;
  if (reclaimGraceMillis > 0) {
    input.diagnosticSink(createBoundedDiagnostic("queue-cleanup-grace", {
      sourceId: input.sourceId,
      crawlRunId: input.crawlRunId,
      crawlAttemptId: input.crawlAttemptId,
      reclaimGraceMillis,
    }));
    await (input.sleep ?? waitForMilliseconds)(reclaimGraceMillis);
  }

  await Promise.all(input.queues.map(async ({ kind, queue }) => {
    try {
      await queue.drop();
    } catch (error) {
      input.diagnosticSink(createBoundedDiagnostic("queue-cleanup-failed", {
        sourceId: input.sourceId,
        crawlRunId: input.crawlRunId,
        crawlAttemptId: input.crawlAttemptId,
        queue: kind,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }));
}

function waitForMilliseconds(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export interface ExecuteSourceInput {
  source: DanishJsonLdSource;
  store: CrawlStore & RecipeDocumentV2Store;
  crawlRunId: string;
  crawlAttemptId: string;
  maxPages: number;
  checkpointDirectory?: string;
  checkpointIdentity?: string;
  resume?: boolean;
  signal?: AbortSignal;
  fullRefresh?: boolean;
  refreshHours?: number;
  cooldowns?: WebsiteCooldowns;
  pacing?: AdaptiveRequestPacing;
  vpnTransport?: DanishJsonLdVpnTransport;
  diagnosticSink?: (event: DanishJsonLdDiagnostic) => void;
}
export type ExecuteDanishJsonLdSource = (
  input: ExecuteSourceInput
) => Promise<{
  observation: SourceRunObservation;
  outcome: SourceRunOutcomeSummary;
  robotsEnforced?: false;
}>;

export async function runDanishJsonLdCrawl(input: {
  selection: DanishJsonLdCrawlSelection;
  store: CrawlStore & RecipeDocumentV2Store;
  crawlRunId: string;
  executeSource?: ExecuteDanishJsonLdSource;
  checkpointDirectory?: string;
  checkpointIdentity?: string;
  signal?: AbortSignal;
  diagnosticSink?: (event: DanishJsonLdDiagnostic) => void;
  vpnTransport?: DanishJsonLdVpnTransport;
}): Promise<{
  summary: DanishJsonLdRunSummary;
  observations: SourceRunObservation[];
}> {
  const executeSource = input.executeSource ?? executeDanishJsonLdSource;
  const observations: SourceRunObservation[] = [];
  const outcomes: SourceRunOutcomeSummary[] = [];
  const maxPages = input.selection.maxPages ?? Number.MAX_SAFE_INTEGER;
  const diagnosticOutput = input.diagnosticSink ?? ((event: DanishJsonLdDiagnostic) => {
    log.info(JSON.stringify(event));
  });

  // Allocate every source checkpoint before work starts, including sources a signal may leave unstarted.
  if (input.checkpointDirectory && !input.selection.resumeRunId && !input.executeSource) {
    for (const source of input.selection.sources) {
      const checkpoint = await CrawlWorkJournal.open({
        path: checkpointPath(input.checkpointDirectory, input.crawlRunId, source.id),
        fingerprint: hashRecipe({ source, identity: input.checkpointIdentity ?? "probe" }),
        runId: input.crawlRunId, sourceId: source.id,
      });
      await checkpoint.close();
    }
  }

  for (const source of input.selection.sources) {
    if (input.signal?.aborted) {
      const observation: SourceRunObservation = { sourceId: source.id, discoveryComplete: false, interrupted: true };
      observations.push(observation);
      outcomes.push(classifySourceOutcome(observation));
      continue;
    }
    const diagnosticSink = createBudgetedDiagnosticSink({
      maxEvents: 1_000,
      sink: diagnosticOutput,
    });
    try {
      const result = await executeSource({
        source,
        store: input.store,
        crawlRunId: input.crawlRunId,
        crawlAttemptId: `${input.crawlRunId}:${source.id}`,
        maxPages,
        checkpointDirectory: input.checkpointDirectory,
        checkpointIdentity: input.checkpointIdentity,
        resume: Boolean(input.selection.resumeRunId || (input.checkpointDirectory && !input.executeSource)),
        signal: input.signal,
        fullRefresh: input.selection.fullRefresh,
        refreshHours: input.selection.refreshHours,
        diagnosticSink,
        ...(input.vpnTransport ? { vpnTransport: input.vpnTransport } : {}),
      });
      observations.push(result.observation);
      outcomes.push(result.outcome);
    } catch (error) {
      if (isFatalBatchError(error)) throw error;
      const observed = readFailureObservation(error, source.id);
      const observation: SourceRunObservation = {
        ...observed,
        sourceId: source.id,
        failedRequests: Math.max(1, observed.failedRequests ?? 0),
        discoveryComplete: false,
      };
      observations.push(observation);
      outcomes.push(classifySourceOutcome(observation));
      diagnosticSink(
        createBoundedDiagnostic("source-failed", {
          sourceId: source.id,
          crawlRunId: input.crawlRunId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  return {
    summary: createDanishJsonLdRunSummary(outcomes),
    observations,
  };
}

export async function executeDanishJsonLdSource(
  input: ExecuteSourceInput
): Promise<{
  observation: SourceRunObservation;
  outcome: SourceRunOutcomeSummary;
  robotsEnforced: false;
}> {
  const diagnosticSink = createBudgetedDiagnosticSink({
    maxEvents: 1_000,
    sink:
      input.diagnosticSink ??
      ((event) => {
        log.info(JSON.stringify(event));
      }),
  });
  const attemptStarted = Date.now();
  const requestProfile = requestProfileFor(input.source);
  const cooldowns = input.cooldowns ?? new WebsiteCooldowns({ directory: input.checkpointDirectory,
    diagnostic: (data) => diagnosticSink(createBoundedDiagnostic("website-cooldown", data)) });
  const pacing = input.pacing ?? new AdaptiveRequestPacing({ directory: input.checkpointDirectory,
    minimumDelayMs: Math.max(input.source.requestSettings.delaySeconds * 1000,
      input.source.requestSettings.rateLimitPerMinute ? 60_000 / input.source.requestSettings.rateLimitPerMinute : 0),
    diagnostic: (data) => diagnosticSink(createBoundedDiagnostic("adaptive-pacing", data)) });
  // Register every source host before the pool starts: an earlier run may have
  // left a deadline even though this run has not yet seen a response.
  for (const domain of input.source.allowedDomains) {
    cooldowns.register(`https://${domain}`);
    pacing.register(`https://${domain}`);
  }
  const cache = new IncrementalRecipeCache({ directory: input.checkpointDirectory,
    identity: hashRecipe({ source: input.source, identity: input.checkpointIdentity ?? "probe" }),
    fullRefresh: input.fullRefresh, refreshHours: input.refreshHours,
    diagnostic: (data) => diagnosticSink(createBoundedDiagnostic("incremental-cache", data)) });
  const conditional = new WeakMap<Request, CachedRecipeResponse>();
  const observedResponses = new WeakSet<object>();
  const observeResponse = async (url: string, status: number, headers: Record<string, string | string[] | undefined>, response?: object) => {
    if (response && observedResponses.has(response)) return;
    if (response) observedResponses.add(response);
    await cooldowns.observe(url, status, headers);
  };
  const journal = await CrawlWorkJournal.open({
    path: input.checkpointDirectory ? checkpointPath(input.checkpointDirectory, input.crawlRunId, input.source.id) : undefined,
    fingerprint: hashRecipe({ source: input.source, identity: input.checkpointIdentity ?? "probe" }),
    resume: input.resume,
    runId: input.crawlRunId,
    sourceId: input.source.id,
  });
  const originalRequest = (request: Request): DanishJsonLdRequest => journal.entries.get(String(request.userData["workKey"]))!.request;
  const retryWithoutPenalty = (request: Request, error: Error): boolean => {
    if (!(error instanceof CooldownPendingError || error instanceof CacheMissRetryError || error instanceof PacingPendingError)) return false;
    request.retryCount -= 1; // Crawlee increments after this hook; no HTTP attempt was lost.
    return true;
  };
  const session = new DanishJsonLdSourceSession({ ...input, diagnosticSink, checkpoint: journal.checkpoint });
  const initialCheckpoint = session.checkpointDelta();
  const previousDuration = session.observation.durationSeconds ?? 0;
  const currentResult = () => {
    session.observation.workAccounting = journal.accounting();
    const accounted = new Set([...journal.entries.values()].filter((entry) => entry.request.kind === "recipe")
      .map((entry) => canonicalizeUrl(entry.request.url)));
    session.observation.uniqueRecipeUrls = session.recipeCandidateUrls().length;
    session.observation.unaccountedRecipeCandidates = session.recipeCandidateUrls().filter((url) => !accounted.has(url)).length;
    if (input.signal?.aborted) session.observation.interrupted = true;
    const o = session.observation;
    o.durationSeconds = previousDuration + (Date.now() - attemptStarted) / 1000;
    o.collectionComplete = !failed && o.discoveryComplete && !o.pageCapReached && !o.interrupted && o.workAccounting?.pending === 0
      && (o.unaccountedRecipeCandidates ?? 0) === 0 && (o.failedRequests ?? 0) === 0 && (o.blockedRequests ?? 0) === 0 && (o.mongoFailures ?? 0) === 0;
    return { observation: session.observation, outcome: session.outcome(), robotsEnforced: false as const };
  };
  const disposition = (before: SourceRunObservation, kind: DanishJsonLdRequestKind): WorkDisposition => {
    const after = session.observation;
    if ((after.blockedRequests ?? 0) > (before.blockedRequests ?? 0)) return "blocked";
    if ((after.failedRequests ?? 0) > (before.failedRequests ?? 0) || (after.mongoFailures ?? 0) > (before.mongoFailures ?? 0)) return "failed";
    if (kind !== "recipe" || (after.persistedRecipes ?? 0) > (before.persistedRecipes ?? 0)) return "fetched";
    const rejected = (o: SourceRunObservation) => (o.rejectedIncompleteJsonLd ?? 0) + (o.rejectedMalformedJsonLd ?? 0)
      + (o.rejectedIncompleteCustom ?? 0) + (o.rejectedMalformedCustom ?? 0);
    return rejected(after) > rejected(before) ? "rejected" : "skipped";
  };
  let failed = false;
  let stopCrawlers: (() => void) | undefined;
  let journalError: unknown;
  const durable = async (operation: Promise<void>) => {
    try { await operation; } catch (error) { journalError = error; stopCrawlers?.(); throw error; }
  };
  const stateHosts = [...new Set([...input.source.allowedDomains, ...(input.source.listingDiscovery?.listingHosts ?? [])])];
  const siteSession = new DanishJsonLdSiteSession({ diagnosticSink, directory: input.checkpointDirectory,
    allowedDomains: stateHosts,
    identity: hashRecipe({ sourceId: input.source.id, hosts: stateHosts,
      profile: requestProfile, browser: DANISH_JSONLD_BROWSER_USER_AGENT, http: DANISH_JSONLD_IMPIT_PROFILE }),
  });
  const sourceVpnSessionId = input.vpnTransport
    ? siteVpnSessionId(input.source.id, input.crawlAttemptId)
    : undefined;
  const ownedQueues: DanishJsonLdAttemptQueue[] = [];
  const completeVpnRequest = async (
    userData: Record<string, unknown>
  ): Promise<void> => {
    if (!input.vpnTransport) return;
    const sessionId = vpnSessionId(userData);
    if (userData["vpnRequestCompleted"] === true) return;
    const requestId = vpnRequestId(userData);
    await input.vpnTransport.completeRequest?.(sessionId, requestId);
    userData["vpnRequestCompleted"] = true;
    diagnosticSink(createBoundedDiagnostic("vpn-session-lifecycle", {
      sourceId: input.source.id,
      sessionId,
      requestId,
      reason: "request-terminal",
    }));
  };
  const handleVpnFailure = async (
    request: Pick<Request, "userData" | "retryCount" | "errorMessages" | "noRetry">,
    error: Error
  ): Promise<boolean> => {
    const relayPoolExhausted = isVpnRelayPoolExhaustion(error, request.errorMessages);
    if (
      !input.vpnTransport ||
      request.userData["vpnFailureHandledAtRetryCount"] === request.retryCount
    ) return relayPoolExhausted;
    // Crawlee skips errorHandler on the last attempt, but can call both hooks
    // when errorHandler sets noRetry. Account for each failed attempt once.
    request.userData["vpnFailureHandledAtRetryCount"] = request.retryCount;
    const rotation = shouldRotateRelayOnFailure(error)
      ? await input.vpnTransport.handleFailure({
          sessionId: vpnSessionId(request.userData),
          requestId: vpnRequestId(request.userData),
          error,
        })
      : undefined;
    if (rotation?.rotated || rotation?.exhausted || relayPoolExhausted) {
      await siteSession.reset(rotation?.reason ?? "vpn-relay-pool-exhausted");
    }
    if (rotation?.exhausted || relayPoolExhausted) request.noRetry = true;
    return relayPoolExhausted;
  };
  try {
  const queueKey = sanitizeStorageKey(input.crawlAttemptId) + (input.checkpointDirectory ? `-${randomUUID()}` : "");
  const cheerioQueue = await RequestQueue.open(`danish-jsonld-cheerio-${queueKey}`);
  ownedQueues.push({ kind: "cheerio", queue: cheerioQueue });
  const playwrightQueue = await RequestQueue.open(`danish-jsonld-playwright-${queueKey}`);
  ownedQueues.push({ kind: "playwright", queue: playwrightQueue });

  const enqueue = async (
    queue: RequestQueue,
    requests: DanishJsonLdRequest[],
    fetchMode: "cheerio" | "playwright"
  ): Promise<void> => {
    if (requests.length === 0) return;
    await durable(journal.admit(fetchMode, requests));
    requests = requests.filter((request) => !journal.isTerminal(workKey(fetchMode, request)));
    const addBatch = async (
      batch: DanishJsonLdRequest[],
      forefront: boolean
    ): Promise<void> => {
      if (batch.length === 0) return;
      await queue.addRequestsBatched(
      await Promise.all(batch.map(async (request) => {
        cooldowns.register(request.url);
        const cached = fetchMode === "cheerio" ? await cache.read(request) : undefined;
        const requestId = input.vpnTransport
          ? requestVpnSessionId(
              input.source.id,
              `${fetchMode}:${request.kind}`,
              request.uniqueKey ?? request.url
            )
          : undefined;
        if (sourceVpnSessionId) diagnosticSink(createBoundedDiagnostic("vpn-session-lifecycle", {
          sourceId: input.source.id,
          sessionId: sourceVpnSessionId,
          requestId,
          fetchMode,
          reason: "request-admitted",
        }));
        return {
          url: request.url,
          uniqueKey: workKey(fetchMode, request),
          label: request.kind,
          skipNavigation: Boolean(cached && cache.fresh(cached)),
          ...(request.method ? { method: request.method } : {}),
          ...(request.requestHeaders ? { headers: request.requestHeaders } : {}),
          ...(request.payload ? { payload: request.payload } : {}),
          userData: {
            kind: request.kind,
            workKey: workKey(fetchMode, request),
            sourceId: input.source.id,
            ...(request.requestData ? { requestData: request.requestData } : {}),
            ...(sourceVpnSessionId
              ? { vpnSessionId: sourceVpnSessionId, vpnRequestId: requestId }
              : {}),
          },
        };
      })),
      { waitForAllRequestsToBeAdded: true, forefront }
      );
    };
    await addBatch(requests.filter((request) => !request.forefront), false);
    await addBatch(requests.filter((request) => request.forefront), true);
    await durable(journal.queued(requests.map((request) => workKey(fetchMode, request))));
    for (const request of requests) session.recordQueueAdmission(request.url);
  };
  const route = async (routes: {
    cheerioRequests: DanishJsonLdRequest[];
    playwrightRequests: DanishJsonLdRequest[];
  }) => {
    await Promise.all([
      enqueue(cheerioQueue, routes.cheerioRequests, "cheerio"),
      enqueue(playwrightQueue, routes.playwrightRequests, "playwright"),
    ]);
  };

  const initial = input.resume && journal.entries.size > 0
    ? { cheerioRequests: journal.pending().filter((entry) => entry.mode === "cheerio").map((entry) => entry.request),
        playwrightRequests: journal.pending().filter((entry) => entry.mode === "playwright").map((entry) => entry.request) }
    : initialRequests(input.source);
  await Promise.all([
    enqueue(cheerioQueue, initial.cheerioRequests, "cheerio"),
    enqueue(playwrightQueue, initial.playwrightRequests, "playwright"),
  ]);

  const cheerioCrawler = createDanishJsonLdCheerioCrawler({
    source: input.source,
    siteSession,
    cooldowns,
    pacing,
    ...(input.vpnTransport
      ? { proxyConfiguration: input.vpnTransport.proxyConfiguration }
      : {}),
    requestHandler: async (context: CheerioCrawlingContext) => {
      let cached = conditional.get(context.request);
      const freshReuse = context.request.skipNavigation;
      if (freshReuse) {
        cached = await cache.read(originalRequest(context.request));
        if (!cached || !cache.fresh(cached)) {
          context.request.skipNavigation = false;
          throw new CacheMissRetryError();
        }
      }
      const statusCode = context.response?.statusCode ?? (freshReuse ? 200 : 0);
      if (statusCode === 304 && (!cached || context.response.url !== cached.loadedUrl)) {
        conditional.delete(context.request);
        context.request.userData["unconditionalFetch"] = true;
        await cache.remove(originalRequest(context.request));
        throw new CacheMissRetryError();
      }
      const reused = freshReuse || statusCode === 304;
      const body = reused ? cached!.body : typeof context.body === "string"
        ? context.body
        : context.body.toString();
      const response = {
        kind: requestKind(context.request.label, context.request.userData),
        fetchMode: "cheerio" as const,
        url: context.request.url,
        loadedUrl: reused ? cached!.loadedUrl : context.request.loadedUrl,
        statusCode: reused ? 200 : statusCode,
        headers: reused ? { ...cached!.headers, ...normalizeHeaders(context.response?.headers ?? {}), "content-type": cached!.headers["content-type"] } : normalizeHeaders(context.response.headers),
        body,
        ...requestData(context.request.userData),
      };
      if ([429, 503].includes(statusCode) && context.request.retryCount < input.source.requestSettings.maxRetries) {
        session.recordRetriedResponseDiagnostic(response);
        throw new WebsiteResponseRetryError(statusCode);
      }
      if (!reused && statusCode < 500) await cache.remove(originalRequest(context.request));
      if (shouldEscalateBrowserCheck({
        statusCode: response.statusCode,
        fetchMode: response.fetchMode,
        vpnEnabled: Boolean(input.vpnTransport),
        body,
      })) {
        session.recordRetriedResponseDiagnostic(response);
        await route({
          cheerioRequests: [],
          playwrightRequests: [{
            kind: response.kind,
            url: response.url,
            forefront: true,
            ...requestData(context.request.userData),
          }],
        });
        await completeVpnRequest(context.request.userData);
        await durable(journal.commit(String(context.request.userData["workKey"]), "skipped", session.checkpointDelta()));
        return;
      }
      const rotation = input.vpnTransport
        ? await input.vpnTransport.handleResponse({
            sessionId: vpnSessionId(context.request.userData),
            requestId: vpnRequestId(context.request.userData),
            statusCode: response.statusCode,
            body,
          })
        : undefined;
      if (rotation?.rotated || rotation?.exhausted) {
        await siteSession.reset(rotation.reason ?? "vpn-relay-changed");
      }
      if (rotation?.exhausted) context.request.noRetry = true;
      if (rotation?.rotated) {
        session.recordRetriedResponseDiagnostic(response);
        throw new VpnRotationRetryError(
          rotation.reason ?? "eligible-response"
        );
      }
      if (session.isRequestCapReached() || input.signal?.aborted) { stopCrawlers?.(); return; }
      const key = String(context.request.userData["workKey"]);
      if (journal.isTerminal(key)) return;
      const before = structuredClone(session.observation);
      const routes = await session.handleResponse(response);
      await route(routes);
      if (statusCode === 304) session.observation.notModifiedResponses = (session.observation.notModifiedResponses ?? 0) + 1;
      if (freshReuse) session.observation.cachedRecipePages = (session.observation.cachedRecipePages ?? 0) + 1;
      const clean = ["mongoFailures", "blockedRequests", "failedRequests", "rejectedIncompleteJsonLd", "rejectedMalformedJsonLd",
        "rejectedIncompleteWprm", "rejectedMalformedWprm", "rejectedIncompleteCustom", "rejectedMalformedCustom"] as const;
      if (!freshReuse && disposition(before, response.kind) === "fetched" && routes.playwrightRequests.length === 0
        && clean.every((key) => (session.observation[key] ?? 0) === (before[key] ?? 0))) {
        await cache.save(originalRequest(context.request), response, statusCode === 304 ? cached : undefined);
      }
      await completeVpnRequest(context.request.userData);
      await durable(journal.commit(key, disposition(before, response.kind), session.checkpointDelta()));
    },
    crawlerOptions: {
      requestQueue: cheerioQueue,
      autoscaledPoolOptions: { isTaskReadyFunction: async () => !input.signal?.aborted && !(await cheerioQueue.isEmpty()) && await cooldowns.ready() && await pacing.ready() },
      preNavigationHooks: [async ({ request }, options) => {
        conditional.delete(request);
        const entry = request.userData["unconditionalFetch"] ? undefined : await cache.read(originalRequest(request));
        if (entry) {
          const validators = cache.validators(entry);
          if (Object.keys(validators).length) { conditional.set(request, entry); options.headers = { ...options.headers, ...validators }; }
        }
      }],
      postNavigationHooks: [async ({ request, response }) => {
        await observeResponse(response.url ?? request.url, response.statusCode ?? 0, normalizeHeaders(response.headers), response);
      }],
      useSessionPool: false,
      maxRequestsPerCrawl: input.maxPages,
      ...(input.vpnTransport?.requestHandlerTimeoutSecs
        ? { requestHandlerTimeoutSecs: input.vpnTransport.requestHandlerTimeoutSecs }
        : {}),
      ignoreHttpErrorStatusCodes: httpErrorStatusCodesForSources([input.source]),
      errorHandler: async (
        { request, response }: CheerioCrawlingContext,
        error: Error
      ) => {
        if (retryWithoutPenalty(request, error)) return;
        if (response) await observeResponse(response.url ?? request.url, response.statusCode ?? 0, normalizeHeaders(response.headers), response);
        await handleVpnFailure(request, error);
        const allowRetry = await session.recordRetry({
          fetchMode: "cheerio",
          kind: requestKind(request.label, request.userData),
          url: request.url,
          retryCount: request.retryCount,
          statusCode: parseHttpStatusForDiagnostics(error, request.errorMessages),
          error,
        });
        if (!allowRetry) request.noRetry = true;
        if (request.noRetry) await completeVpnRequest(request.userData);
      },
      failedRequestHandler: async (
        { request, response }: CheerioCrawlingContext,
        error: Error
      ) => {
        if (response) await observeResponse(response.url ?? request.url, response.statusCode ?? 0, normalizeHeaders(response.headers), response);
        const relayPoolExhausted = await handleVpnFailure(request, error);
        await session.recordFailedRequest({
          fetchMode: "cheerio",
          kind: requestKind(request.label, request.userData),
          url: request.url,
          retryCount: request.retryCount,
          statusCode: parseHttpStatusForDiagnostics(error, request.errorMessages),
          ...(relayPoolExhausted
            ? { blockedReason: "vpn-relay-pool-exhausted" as const }
            : {}),
          error,
        });
        await completeVpnRequest(request.userData);
        if (!journalError) await durable(journal.commit(String(request.userData["workKey"]),
          [401, 403, 429, 454, 455, 526].includes(parseHttpStatusForDiagnostics(error, request.errorMessages) ?? 0) ? "blocked" : "failed",
          session.checkpointDelta()));
      },
    },
  });
  const playwrightCrawler = createDanishJsonLdPlaywrightCrawler({
    source: input.source,
    siteSession,
    cooldowns,
    pacing,
    ...(input.vpnTransport
      ? { proxyConfiguration: input.vpnTransport.proxyConfiguration }
      : {}),
    requestHandler: async (context: PlaywrightCrawlingContext) => {
      const { body, clearedBrowserCheck } = await readSettledPageContent(context.page);
      const headers = context.response
        ? await context.response.allHeaders()
        : {};
      // The navigation response carries the interstitial's status. Once the
      // challenge has replaced itself with the real document, that status
      // describes a page the browser is no longer on, and keeping it would
      // record a blocked request against content that arrived fine.
      const navigationStatus = context.response?.status() ?? 200;
      const response = {
        kind: requestKind(context.request.label, context.request.userData),
        fetchMode: "playwright" as const,
        url: context.request.url,
        loadedUrl: context.request.loadedUrl,
        statusCode: clearedBrowserCheck ? 200 : navigationStatus,
        headers,
        body,
        ...requestData(context.request.userData),
      };
      if ([429, 503].includes(response.statusCode) && context.request.retryCount < input.source.requestSettings.maxRetries) {
        session.recordRetriedResponseDiagnostic(response);
        throw new WebsiteResponseRetryError(response.statusCode);
      }
      // A browser check is cleared by this browser session, so it is retried
      // before the relay logic sees it; rotating would discard that session.
      if (
        shouldRetryBrowserCheck({
          statusCode: response.statusCode,
          retryCount: context.request.retryCount,
          maxRetries: input.source.requestSettings.maxRetries,
          body,
        })
      ) {
        session.recordRetriedResponseDiagnostic(response);
        throw new BrowserCheckRetryError(response.statusCode);
      }
      const rotation = input.vpnTransport
        ? await input.vpnTransport.handleResponse({
            sessionId: vpnSessionId(context.request.userData),
            requestId: vpnRequestId(context.request.userData),
            statusCode: response.statusCode,
            body,
          })
        : undefined;
      if (rotation?.rotated || rotation?.exhausted) {
        await siteSession.reset(rotation.reason ?? "vpn-relay-changed");
      }
      if (rotation?.exhausted) context.request.noRetry = true;
      if (rotation?.rotated) {
        session.recordRetriedResponseDiagnostic(response);
        throw new VpnRotationRetryError(
          rotation.reason ?? "eligible-response"
        );
      }
      if (session.isRequestCapReached() || input.signal?.aborted) { stopCrawlers?.(); return; }
      const key = String(context.request.userData["workKey"]);
      if (journal.isTerminal(key)) return;
      const before = structuredClone(session.observation);
      const routes = await session.handleResponse(response);
      await route(routes);
      await completeVpnRequest(context.request.userData);
      await durable(journal.commit(key, disposition(before, response.kind), session.checkpointDelta()));
    },
    crawlerOptions: {
      requestQueue: playwrightQueue,
      autoscaledPoolOptions: { isTaskReadyFunction: async () => !input.signal?.aborted && !(await playwrightQueue.isEmpty()) && await cooldowns.ready() && await pacing.ready() },
      postNavigationHooks: [async ({ request, response }) => {
        if (response) await observeResponse(response.url(), response.status(), await response.allHeaders(), response);
      }],
      useSessionPool: false,
      maxRequestsPerCrawl: input.maxPages,
      ...(input.vpnTransport?.requestHandlerTimeoutSecs
        ? { requestHandlerTimeoutSecs: input.vpnTransport.requestHandlerTimeoutSecs }
        : {}),
      errorHandler: async (
        { request, response }: PlaywrightCrawlingContext,
        error: Error
      ) => {
        if (retryWithoutPenalty(request, error)) return;
        if (response) await observeResponse(response.url(), response.status(), await response.allHeaders(), response);
        await handleVpnFailure(request, error);
        const allowRetry = await session.recordRetry({
          fetchMode: "playwright",
          kind: requestKind(request.label, request.userData),
          url: request.url,
          retryCount: request.retryCount,
          statusCode: parseHttpStatusForDiagnostics(error, request.errorMessages),
          error,
        });
        if (!allowRetry) request.noRetry = true;
        if (request.noRetry) await completeVpnRequest(request.userData);
      },
      failedRequestHandler: async (
        { request, response }: PlaywrightCrawlingContext,
        error: Error
      ) => {
        if (response) await observeResponse(response.url(), response.status(), await response.allHeaders(), response);
        const relayPoolExhausted = await handleVpnFailure(request, error);
        await session.recordFailedRequest({
          fetchMode: "playwright",
          kind: requestKind(request.label, request.userData),
          url: request.url,
          retryCount: request.retryCount,
          statusCode: parseHttpStatusForDiagnostics(error, request.errorMessages),
          ...(relayPoolExhausted
            ? { blockedReason: "vpn-relay-pool-exhausted" as const }
            : {}),
          error,
        });
        await completeVpnRequest(request.userData);
        if (!journalError) await durable(journal.commit(String(request.userData["workKey"]),
          [401, 403, 429, 454, 455, 526].includes(parseHttpStatusForDiagnostics(error, request.errorMessages) ?? 0) ? "blocked" : "failed",
          session.checkpointDelta()));
      },
      launchContext: { launchOptions: { headless: true } },
    },
  });

  stopCrawlers = () => { cheerioCrawler.stop(); playwrightCrawler.stop(); };
  input.signal?.addEventListener("abort", stopCrawlers, { once: true });
  for (let cycle = 0; cycle < 10; cycle += 1) {
    if (input.signal?.aborted) return currentResult();
    if (!(await cheerioQueue.isEmpty())) await cheerioCrawler.run();
    if (session.isRequestCapReached()) {
      return currentResult();
    }
    if (input.signal?.aborted) return currentResult();
    if (journalError) throw journalError;
    if (!(await playwrightQueue.isEmpty())) await playwrightCrawler.run();
    if (session.isRequestCapReached()) {
      return currentResult();
    }
    if (journalError) throw journalError;
    if ((await cheerioQueue.isEmpty()) && (await playwrightQueue.isEmpty())) {
      return currentResult();
    }
  }

  await session.recordFailedRequest({
    fetchMode: "cheerio",
    kind: input.source.discovery,
    url: input.source.domain,
    retryCount: 0,
    error: new Error("crawler routing did not reach a terminal queue state"),
  });
  return currentResult();
  } catch (error) {
    failed = true;
    currentResult();
    throw new SourceExecutionFailure(error, session.observation);
  } finally {
    if (stopCrawlers) input.signal?.removeEventListener("abort", stopCrawlers);
    currentResult();
    const complete = !failed && !input.signal?.aborted && journal.accounting().pending === 0
      && (session.observation.unaccountedRecipeCandidates ?? 0) === 0;
    try {
      try {
        await siteSession.persist();
        if (!journalError) {
          const checkpoint = failed ? { ...(journal.checkpoint ?? initialCheckpoint), sets: {} } : session.checkpointDelta();
          await journal.stop(checkpoint, complete);
        }
      } finally {
        await journal.close();
      }
      // Durable journals own the unfinished frontier; temporary native queues can now be reclaimed.
      if (complete || input.checkpointDirectory) await cleanupDanishJsonLdAttemptQueues({
        queues: ownedQueues,
        sameDomainDelaySecs: input.source.requestSettings.delaySeconds,
        sourceId: input.source.id,
        crawlRunId: input.crawlRunId,
        crawlAttemptId: input.crawlAttemptId,
        diagnosticSink,
      });
    } finally {
      if (input.vpnTransport && sourceVpnSessionId) {
        const [release] = await Promise.allSettled([input.vpnTransport.release(sourceVpnSessionId)]);
        diagnosticSink(createBoundedDiagnostic("vpn-session-lifecycle", {
          sourceId: input.source.id,
          sessionId: sourceVpnSessionId,
          reason: release.status === "fulfilled" ? "source-terminal-release" : "source-terminal-release-failed",
          ...(release.status === "rejected"
            ? { error: release.reason instanceof Error ? release.reason.message : String(release.reason) }
            : {}),
        }));
      }
    }
  }
}

function initialRequests(source: DanishJsonLdSource): {
  cheerioRequests: DanishJsonLdRequest[];
  playwrightRequests: DanishJsonLdRequest[];
} {
  if (source.recipeExtractor === "dr-graphql") {
    return { cheerioRequests: [createDrListRequest()], playwrightRequests: [] };
  }
  if (source.discovery === "sitemap") {
    return {
      cheerioRequests: source.sitemapUrls.map((url) => ({ kind: "sitemap", url })),
      playwrightRequests: [],
    };
  }
  const listingRequests = source.startUrls.map((url) => ({
    kind: "listing" as const,
    url,
  }));
  return source.fetchMode === "playwright"
    ? { cheerioRequests: [], playwrightRequests: listingRequests }
    : { cheerioRequests: listingRequests, playwrightRequests: [] };
}

function requestKind(
  label: string | undefined,
  userData: Record<string, unknown>
): DanishJsonLdRequestKind {
  const candidate = label ?? userData["kind"];
  if (candidate === "sitemap" || candidate === "listing" || candidate === "recipe") {
    return candidate;
  }
  throw new Error(`Unsupported Danish JSON-LD request kind: ${String(candidate)}`);
}

function vpnSessionId(userData: Record<string, unknown>): string {
  const value = userData["vpnSessionId"];
  if (typeof value !== "string") {
    throw new Error("VPN request is missing its explicit relay session identity");
  }
  return value;
}

function vpnRequestId(userData: Record<string, unknown>): string | undefined {
  const value = userData["vpnRequestId"];
  return typeof value === "string" ? value : undefined;
}

function requestData(userData: Record<string, unknown>): {
  requestData?: Record<string, unknown>;
} {
  const value = userData["requestData"];
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? { requestData: value as Record<string, unknown> }
    : {};
}

function normalizeHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, string | string[] | undefined> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
}

function sanitizeStorageKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/gu, "-").replace(/^-|-$/gu, "");
}

export function parseHttpStatusForDiagnostics(
  error: unknown,
  errorMessages: string[]
): number | undefined {
  const structured = readStructuredHttpStatus(error);
  if (structured !== undefined) return structured;
  const patterns = [
    /\b(?:response|status)(?:\s+code)?\s*[:=]?\s*([1-5]\d{2})\b/iu,
    /\bHTTP(?:\/\d(?:\.\d)?)?\s+([1-5]\d{2})\b/iu,
    /\breceived\s+([1-5]\d{2})\s+status\b/iu,
  ];
  for (const text of [
    error instanceof Error ? error.message : String(error),
    ...errorMessages,
  ]) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return Number(match[1]);
    }
  }
  return undefined;
}

function readStructuredHttpStatus(error: unknown): number | undefined {
  let current = error;
  for (let depth = 0; depth < 4; depth += 1) {
    if (current === null || typeof current !== "object") return undefined;
    const record = current as {
      status?: unknown;
      statusCode?: unknown;
      response?: { status?: unknown; statusCode?: unknown };
      cause?: unknown;
    };
    for (const value of [
      record.statusCode,
      record.status,
      record.response?.statusCode,
      record.response?.status,
    ]) {
      if (typeof value === "number" && value >= 100 && value <= 599) {
        return value;
      }
    }
    current = record.cause;
  }
  return undefined;
}

function isVpnRelayPoolExhaustion(
  error: unknown,
  errorMessages: string[]
): boolean {
  return isVpnRelayPoolExhaustedError(error) ||
    errorMessages.some((message) =>
      message.startsWith("No verified Mullvad relay is available for ")
    );
}

class SourceExecutionFailure extends Error {
  readonly observation: SourceRunObservation;

  constructor(cause: unknown, observation: SourceRunObservation) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.name = "SourceExecutionFailure";
    this.observation = { ...observation };
  }
}

function readFailureObservation(
  error: unknown,
  sourceId: string
): SourceRunObservation {
  if (error !== null && typeof error === "object" && "observation" in error) {
    const observation = (error as { observation?: unknown }).observation;
    if (observation !== null && typeof observation === "object") {
      return {
        ...(observation as SourceRunObservation),
        sourceId,
        discoveryComplete: false,
      };
    }
  }
  return { sourceId, discoveryComplete: false };
}

function isFatalBatchError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (current === null || typeof current !== "object") return false;
    if ((current as { fatalScope?: unknown }).fatalScope === "store") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
