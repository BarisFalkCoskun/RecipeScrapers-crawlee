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
  requestVpnSessionId,
  type DanishJsonLdVpnTransport,
} from "./vpn-transport.js";

export interface DanishJsonLdCrawlSelection extends DanishJsonLdCrawlOptions {
  sourceIds: string[];
  sources: DanishJsonLdSource[];
}

export const DANISH_JSONLD_OBSERVED_HTTP_ERROR_STATUS_CODES = [
  401, 403, 429, 526,
] as const;
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
  robotsEnforced?: boolean | "unknown";
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
  const robotsObservations: Array<boolean | "unknown"> = [];
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
      robotsObservations.push(result.robotsEnforced ?? "unknown");
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
      robotsObservations.push("unknown");
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
    summary: createDanishJsonLdRunSummary(
      outcomes,
      summarizeRobotsEnforcement(robotsObservations)
    ),
    observations,
  };
}

export async function executeDanishJsonLdSource(
  input: ExecuteSourceInput
): Promise<{
  observation: SourceRunObservation;
  outcome: SourceRunOutcomeSummary;
  robotsEnforced: boolean | "unknown";
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
  const [cheerioQueue, playwrightQueue] = await Promise.all([
    RequestQueue.open(`danish-jsonld-cheerio-${queueKey}`),
    RequestQueue.open(`danish-jsonld-playwright-${queueKey}`),
  ]);

  const enqueue = async (
    queue: RequestQueue,
    requests: DanishJsonLdRequest[],
    fetchMode: "cheerio" | "playwright"
  ): Promise<void> => {
    if (requests.length === 0) return;
    await queue.addRequestsBatched(
      requests.map((request) => {
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
          uniqueKey: `${request.kind}:${request.url}`,
          label: request.kind,
          userData: {
            kind: request.kind,
            sourceId: input.source.id,
            ...(requestSessionId ? { vpnSessionId: requestSessionId } : {}),
          },
        };
      }),
      { waitForAllRequestsToBeAdded: true }
    );
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
      const routes = await session.handleResponse({
        kind: requestKind(context.request.label, context.request.userData),
        fetchMode: "cheerio",
        url: context.request.url,
        loadedUrl: context.request.loadedUrl,
        statusCode: context.response.statusCode ?? 200,
        headers: normalizeHeaders(context.response.headers),
        body,
      });
      const rotation = input.vpnTransport
        ? await input.vpnTransport.handleResponse({
            sessionId: vpnSessionId(context.request.userData),
            statusCode: context.response.statusCode ?? 200,
            body,
          })
        : undefined;
      if (rotation?.exhausted) context.request.noRetry = true;
      if (rotation?.rotated) {
        throw new VpnRotationRetryError(
          rotation.reason ?? "eligible-response"
        );
      }
      await route(routes);
      await releaseVpnRequest(context.request.userData);
    },
    crawlerOptions: {
      requestQueue: cheerioQueue,
      useSessionPool: false,
      maxRequestsPerCrawl: input.maxPages,
      ignoreHttpErrorStatusCodes: [
        ...DANISH_JSONLD_OBSERVED_HTTP_ERROR_STATUS_CODES,
      ],
      errorHandler: async (
        { request }: CheerioCrawlingContext,
        error: Error
      ) => {
        const rotation = input.vpnTransport
          ? await input.vpnTransport.handleFailure({
              sessionId: vpnSessionId(request.userData),
              error,
            })
          : undefined;
        if (rotation?.exhausted) request.noRetry = true;
        const allowRetry = await session.recordRetry({
          fetchMode: "cheerio",
          kind: requestKind(request.label, request.userData),
          url: request.url,
          retryCount: request.retryCount,
          statusCode: parseHttpStatus(error, request.errorMessages),
          error,
        });
        if (!allowRetry) request.noRetry = true;
        if (request.noRetry) await releaseVpnRequest(request.userData);
      },
      failedRequestHandler: async (
        { request }: CheerioCrawlingContext,
        error: Error
      ) => {
        await session.recordFailedRequest({
          fetchMode: "cheerio",
          kind: requestKind(request.label, request.userData),
          url: request.url,
          retryCount: request.retryCount,
          statusCode: parseHttpStatus(error, request.errorMessages),
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
      const routes = await session.handleResponse({
        kind: requestKind(context.request.label, context.request.userData),
        fetchMode: "playwright",
        url: context.request.url,
        loadedUrl: context.request.loadedUrl,
        statusCode: context.response?.status() ?? 200,
        headers,
        body,
      });
      const rotation = input.vpnTransport
        ? await input.vpnTransport.handleResponse({
            sessionId: vpnSessionId(context.request.userData),
            statusCode: context.response?.status() ?? 200,
            body,
          })
        : undefined;
      if (rotation?.exhausted) context.request.noRetry = true;
      if (rotation?.rotated) {
        throw new VpnRotationRetryError(
          rotation.reason ?? "eligible-response"
        );
      }
      await route(routes);
      await releaseVpnRequest(context.request.userData);
    },
    crawlerOptions: {
      requestQueue: playwrightQueue,
      useSessionPool: false,
      maxRequestsPerCrawl: input.maxPages,
      errorHandler: async (
        { request }: PlaywrightCrawlingContext,
        error: Error
      ) => {
        const rotation = input.vpnTransport
          ? await input.vpnTransport.handleFailure({
              sessionId: vpnSessionId(request.userData),
              error,
            })
          : undefined;
        if (rotation?.exhausted) request.noRetry = true;
        const allowRetry = await session.recordRetry({
          fetchMode: "playwright",
          kind: requestKind(request.label, request.userData),
          url: request.url,
          retryCount: request.retryCount,
          statusCode: parseHttpStatus(error, request.errorMessages),
          error,
        });
        if (!allowRetry) request.noRetry = true;
        if (request.noRetry) await releaseVpnRequest(request.userData);
      },
      failedRequestHandler: async (
        { request }: PlaywrightCrawlingContext,
        error: Error
      ) => {
        await session.recordFailedRequest({
          fetchMode: "playwright",
          kind: requestKind(request.label, request.userData),
          url: request.url,
          retryCount: request.retryCount,
          statusCode: parseHttpStatus(error, request.errorMessages),
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
        robotsEnforced: observeRobotsEnforcement(cheerioCrawler, playwrightCrawler),
      };
    }
    if (!(await playwrightQueue.isEmpty())) await playwrightCrawler.run();
    if (session.isRequestCapReached()) {
      return {
        observation: session.observation,
        outcome: session.outcome(),
        robotsEnforced: observeRobotsEnforcement(cheerioCrawler, playwrightCrawler),
      };
    }
    if ((await cheerioQueue.isEmpty()) && (await playwrightQueue.isEmpty())) {
      return {
        observation: session.observation,
        outcome: session.outcome(),
        robotsEnforced: observeRobotsEnforcement(cheerioCrawler, playwrightCrawler),
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
    robotsEnforced: observeRobotsEnforcement(cheerioCrawler, playwrightCrawler),
  };
  } catch (error) {
    throw new SourceExecutionFailure(error, session.observation);
  } finally {
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

function parseHttpStatus(error: unknown, errorMessages: string[]): number | undefined {
  const text = [error instanceof Error ? error.message : String(error), ...errorMessages]
    .join(" ");
  const match = text.match(/(?:^|\D)([1-5]\d{2})(?:\D|$)/u);
  return match ? Number(match[1]) : undefined;
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

function observeRobotsEnforcement(...crawlers: unknown[]): boolean | "unknown" {
  const values = crawlers.map((crawler) =>
    (crawler as { respectRobotsTxtFile?: unknown }).respectRobotsTxtFile
  );
  if (values.some((value) => value === true || typeof value === "object")) return true;
  if (values.every((value) => value === false)) return false;
  return "unknown";
}

function summarizeRobotsEnforcement(
  observations: Array<boolean | "unknown">
): boolean | "unknown" {
  if (observations.some((value) => value === true)) return true;
  if (observations.length > 0 && observations.every((value) => value === false)) {
    return false;
  }
  return "unknown";
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
