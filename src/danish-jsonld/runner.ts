import {
  RequestQueue,
  log,
  type CheerioCrawlingContext,
  type PlaywrightCrawlingContext,
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
} from "./crawler-factories.js";
import {
  createBoundedDiagnostic,
  createBudgetedDiagnosticSink,
} from "./diagnostics.js";
import {
  VpnRotationRetryError,
  isVpnRelayPoolExhaustedError,
  requestVpnSessionId,
  type DanishJsonLdVpnTransport,
} from "./vpn-transport.js";
import { createDrListRequest } from "../custom/dr.js";

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
 * A rendered browser check is worth re-requesting: the browser clears the
 * challenge once, so the retry lands on the real page. Only the rendered path
 * qualifies, because a plain HTTP client never clears it.
 */
export function shouldRetryBrowserCheck(input: {
  statusCode: number;
  retryCount: number;
  maxRetries: number;
}): boolean {
  return (
    BROWSER_CHECK_STATUS_CODES.includes(input.statusCode) &&
    input.retryCount < input.maxRetries
  );
}

/** Plain HTTP cannot clear a browser challenge; retry that request in Chromium. */
export function shouldEscalateBrowserCheck(input: {
  statusCode: number;
  fetchMode: "cheerio" | "playwright";
  vpnEnabled: boolean;
}): boolean {
  return (
    input.fetchMode === "cheerio" &&
    !input.vpnEnabled &&
    BROWSER_CHECK_STATUS_CODES.includes(input.statusCode)
  );
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
  return !(error instanceof BrowserCheckRetryError);
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

  for (const source of input.selection.sources) {
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
  const session = new DanishJsonLdSourceSession({ ...input, diagnosticSink });
  const sourceVpnSessions = new Set<string>();
  const ownedQueues: DanishJsonLdAttemptQueue[] = [];
  const releaseVpnRequest = async (
    userData: Record<string, unknown>
  ): Promise<void> => {
    if (!input.vpnTransport) return;
    const sessionId = vpnSessionId(userData);
    if (!sourceVpnSessions.has(sessionId)) return;
    await input.vpnTransport.release(sessionId);
    sourceVpnSessions.delete(sessionId);
  };
  try {
  const queueKey = sanitizeStorageKey(input.crawlAttemptId);
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
    const addBatch = async (
      batch: DanishJsonLdRequest[],
      forefront: boolean
    ): Promise<void> => {
      if (batch.length === 0) return;
      await queue.addRequestsBatched(
      batch.map((request) => {
        const requestSessionId = input.vpnTransport
          ? requestVpnSessionId(
              input.source.id,
              `${fetchMode}:${request.kind}`,
              request.url
            )
          : undefined;
        if (requestSessionId) sourceVpnSessions.add(requestSessionId);
        return {
          url: request.url,
          uniqueKey: request.uniqueKey ?? `${request.kind}:${request.url}`,
          label: request.kind,
          ...(request.method ? { method: request.method } : {}),
          ...(request.requestHeaders ? { headers: request.requestHeaders } : {}),
          ...(request.payload ? { payload: request.payload } : {}),
          userData: {
            kind: request.kind,
            sourceId: input.source.id,
            ...(request.requestData ? { requestData: request.requestData } : {}),
            ...(requestSessionId ? { vpnSessionId: requestSessionId } : {}),
          },
        };
      }),
      { waitForAllRequestsToBeAdded: true, forefront }
      );
    };
    await addBatch(requests.filter((request) => !request.forefront), false);
    await addBatch(requests.filter((request) => request.forefront), true);
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

  const initial = initialRequests(input.source);
  await Promise.all([
    enqueue(cheerioQueue, initial.cheerioRequests, "cheerio"),
    enqueue(playwrightQueue, initial.playwrightRequests, "playwright"),
  ]);

  const cheerioCrawler = createDanishJsonLdCheerioCrawler({
    source: input.source,
    ...(input.vpnTransport
      ? { proxyConfiguration: input.vpnTransport.proxyConfiguration }
      : {}),
    requestHandler: async (context: CheerioCrawlingContext) => {
      const body = typeof context.body === "string"
        ? context.body
        : context.body.toString();
      const response = {
        kind: requestKind(context.request.label, context.request.userData),
        fetchMode: "cheerio" as const,
        url: context.request.url,
        loadedUrl: context.request.loadedUrl,
        statusCode: context.response.statusCode ?? 200,
        headers: normalizeHeaders(context.response.headers),
        body,
        ...requestData(context.request.userData),
      };
      if (shouldEscalateBrowserCheck({
        statusCode: response.statusCode,
        fetchMode: response.fetchMode,
        vpnEnabled: Boolean(input.vpnTransport),
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
        await releaseVpnRequest(context.request.userData);
        return;
      }
      const rotation = input.vpnTransport
        ? await input.vpnTransport.handleResponse({
            sessionId: vpnSessionId(context.request.userData),
            statusCode: context.response.statusCode ?? 200,
            body,
          })
        : undefined;
      if (rotation?.exhausted) context.request.noRetry = true;
      if (rotation?.rotated) {
        session.recordRetriedResponseDiagnostic(response);
        throw new VpnRotationRetryError(
          rotation.reason ?? "eligible-response"
        );
      }
      const routes = await session.handleResponse(response);
      await route(routes);
      await releaseVpnRequest(context.request.userData);
    },
    crawlerOptions: {
      requestQueue: cheerioQueue,
      useSessionPool: false,
      maxRequestsPerCrawl: input.maxPages,
      ...(input.vpnTransport?.requestHandlerTimeoutSecs
        ? { requestHandlerTimeoutSecs: input.vpnTransport.requestHandlerTimeoutSecs }
        : {}),
      ignoreHttpErrorStatusCodes: httpErrorStatusCodesForSources([input.source]),
      errorHandler: async (
        { request }: CheerioCrawlingContext,
        error: Error
      ) => {
        const relayPoolExhausted = isVpnRelayPoolExhaustion(
          error,
          request.errorMessages
        );
        const rotation = input.vpnTransport
          ? await input.vpnTransport.handleFailure({
              sessionId: vpnSessionId(request.userData),
              error,
            })
          : undefined;
        if (rotation?.exhausted || relayPoolExhausted) request.noRetry = true;
        const allowRetry = await session.recordRetry({
          fetchMode: "cheerio",
          kind: requestKind(request.label, request.userData),
          url: request.url,
          retryCount: request.retryCount,
          statusCode: parseHttpStatusForDiagnostics(error, request.errorMessages),
          error,
        });
        if (!allowRetry) request.noRetry = true;
        if (request.noRetry) await releaseVpnRequest(request.userData);
      },
      failedRequestHandler: async (
        { request }: CheerioCrawlingContext,
        error: Error
      ) => {
        const relayPoolExhausted = isVpnRelayPoolExhaustion(
          error,
          request.errorMessages
        );
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
        await releaseVpnRequest(request.userData);
      },
    },
  });
  const playwrightCrawler = createDanishJsonLdPlaywrightCrawler({
    source: input.source,
    ...(input.vpnTransport
      ? { proxyConfiguration: input.vpnTransport.proxyConfiguration }
      : {}),
    requestHandler: async (context: PlaywrightCrawlingContext) => {
      const body = await context.page.content();
      const headers = context.response
        ? await context.response.allHeaders()
        : {};
      const response = {
        kind: requestKind(context.request.label, context.request.userData),
        fetchMode: "playwright" as const,
        url: context.request.url,
        loadedUrl: context.request.loadedUrl,
        statusCode: context.response?.status() ?? 200,
        headers,
        body,
        ...requestData(context.request.userData),
      };
      // A browser check is cleared by this browser session, so it is retried
      // before the relay logic sees it; rotating would discard that session.
      if (
        shouldRetryBrowserCheck({
          statusCode: response.statusCode,
          retryCount: context.request.retryCount,
          maxRetries: input.source.requestSettings.maxRetries,
        })
      ) {
        session.recordRetriedResponseDiagnostic(response);
        throw new BrowserCheckRetryError(response.statusCode);
      }
      const rotation = input.vpnTransport
        ? await input.vpnTransport.handleResponse({
            sessionId: vpnSessionId(context.request.userData),
            statusCode: context.response?.status() ?? 200,
            body,
          })
        : undefined;
      if (rotation?.exhausted) context.request.noRetry = true;
      if (rotation?.rotated) {
        session.recordRetriedResponseDiagnostic(response);
        throw new VpnRotationRetryError(
          rotation.reason ?? "eligible-response"
        );
      }
      const routes = await session.handleResponse(response);
      await route(routes);
      await releaseVpnRequest(context.request.userData);
    },
    crawlerOptions: {
      requestQueue: playwrightQueue,
      useSessionPool: false,
      maxRequestsPerCrawl: input.maxPages,
      ...(input.vpnTransport?.requestHandlerTimeoutSecs
        ? { requestHandlerTimeoutSecs: input.vpnTransport.requestHandlerTimeoutSecs }
        : {}),
      errorHandler: async (
        { request }: PlaywrightCrawlingContext,
        error: Error
      ) => {
        const relayPoolExhausted = isVpnRelayPoolExhaustion(
          error,
          request.errorMessages
        );
        const rotation = input.vpnTransport && shouldRotateRelayOnFailure(error)
          ? await input.vpnTransport.handleFailure({
              sessionId: vpnSessionId(request.userData),
              error,
            })
          : undefined;
        if (rotation?.exhausted || relayPoolExhausted) request.noRetry = true;
        const allowRetry = await session.recordRetry({
          fetchMode: "playwright",
          kind: requestKind(request.label, request.userData),
          url: request.url,
          retryCount: request.retryCount,
          statusCode: parseHttpStatusForDiagnostics(error, request.errorMessages),
          error,
        });
        if (!allowRetry) request.noRetry = true;
        if (request.noRetry) await releaseVpnRequest(request.userData);
      },
      failedRequestHandler: async (
        { request }: PlaywrightCrawlingContext,
        error: Error
      ) => {
        const relayPoolExhausted = isVpnRelayPoolExhaustion(
          error,
          request.errorMessages
        );
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
        await releaseVpnRequest(request.userData);
      },
      launchContext: { launchOptions: { headless: true } },
    },
  });

  for (let cycle = 0; cycle < 10; cycle += 1) {
    if (!(await cheerioQueue.isEmpty())) await cheerioCrawler.run();
    if (session.isRequestCapReached()) {
      return {
        observation: session.observation,
        outcome: session.outcome(),
        robotsEnforced: false,
      };
    }
    if (!(await playwrightQueue.isEmpty())) await playwrightCrawler.run();
    if (session.isRequestCapReached()) {
      return {
        observation: session.observation,
        outcome: session.outcome(),
        robotsEnforced: false,
      };
    }
    if ((await cheerioQueue.isEmpty()) && (await playwrightQueue.isEmpty())) {
      return {
        observation: session.observation,
        outcome: session.outcome(),
        robotsEnforced: false,
      };
    }
  }

  await session.recordFailedRequest({
    fetchMode: "cheerio",
    kind: input.source.discovery,
    url: input.source.domain,
    retryCount: 0,
    error: new Error("crawler routing did not reach a terminal queue state"),
  });
  return {
    observation: session.observation,
    outcome: session.outcome(),
    robotsEnforced: false,
  };
  } catch (error) {
    throw new SourceExecutionFailure(error, session.observation);
  } finally {
    await cleanupDanishJsonLdAttemptQueues({
      queues: ownedQueues,
      sameDomainDelaySecs: input.source.requestSettings.delaySeconds,
      sourceId: input.source.id,
      crawlRunId: input.crawlRunId,
      crawlAttemptId: input.crawlAttemptId,
      diagnosticSink,
    });
    if (input.vpnTransport) {
      await Promise.allSettled(
        [...sourceVpnSessions].map((sessionId) =>
          input.vpnTransport?.release(sessionId)
        )
      );
      sourceVpnSessions.clear();
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
