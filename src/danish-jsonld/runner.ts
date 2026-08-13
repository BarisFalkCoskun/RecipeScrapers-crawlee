import {
  RequestQueue,
  log,
  type CheerioCrawlingContext,
  type PlaywrightCrawlingContext,
} from "crawlee";
import type { RecipeDocumentV2Store, CrawlStore } from "../storage/store.js";
import type { DanishJsonLdRunSummary, SourceRunOutcomeSummary } from "../types.js";
import { createDanishJsonLdRunSummary } from "./source-outcome.js";
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
import { createBudgetedDiagnosticSink } from "./diagnostics.js";

export interface DanishJsonLdCrawlSelection extends DanishJsonLdCrawlOptions {
  sourceIds: string[];
  sources: DanishJsonLdSource[];
}
export interface ExecuteSourceInput {
  source: DanishJsonLdSource;
  store: CrawlStore & RecipeDocumentV2Store;
  crawlRunId: string;
  crawlAttemptId: string;
  maxPages: number;
  diagnosticSink?: (event: DanishJsonLdDiagnostic) => void;
}
export type ExecuteDanishJsonLdSource = (
  input: ExecuteSourceInput
) => Promise<{
  observation: SourceRunObservation;
  outcome: SourceRunOutcomeSummary;
}>;

export async function runDanishJsonLdCrawl(input: {
  selection: DanishJsonLdCrawlSelection;
  store: CrawlStore & RecipeDocumentV2Store;
  crawlRunId: string;
  executeSource?: ExecuteDanishJsonLdSource;
  diagnosticSink?: (event: DanishJsonLdDiagnostic) => void;
}): Promise<{
  summary: DanishJsonLdRunSummary;
  observations: SourceRunObservation[];
}> {
  const executeSource = input.executeSource ?? executeDanishJsonLdSource;
  const observations: SourceRunObservation[] = [];
  const outcomes: SourceRunOutcomeSummary[] = [];
  const maxPages = input.selection.maxPages ?? Number.MAX_SAFE_INTEGER;

  for (const source of input.selection.sources) {
    const result = await executeSource({
      source,
      store: input.store,
      crawlRunId: input.crawlRunId,
      crawlAttemptId: `${input.crawlRunId}:${source.id}`,
      maxPages,
      diagnosticSink: input.diagnosticSink,
    });
    observations.push(result.observation);
    outcomes.push(result.outcome);
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
  const queueKey = sanitizeStorageKey(input.crawlAttemptId);
  const [cheerioQueue, playwrightQueue] = await Promise.all([
    RequestQueue.open(`danish-jsonld-cheerio-${queueKey}`),
    RequestQueue.open(`danish-jsonld-playwright-${queueKey}`),
  ]);

  const enqueue = async (
    queue: RequestQueue,
    requests: DanishJsonLdRequest[]
  ): Promise<void> => {
    if (requests.length === 0) return;
    await queue.addRequestsBatched(
      requests.map((request) => ({
        url: request.url,
        uniqueKey: `${request.kind}:${request.url}`,
        label: request.kind,
        userData: { kind: request.kind, sourceId: input.source.id },
      })),
      { waitForAllRequestsToBeAdded: true }
    );
  };
  const route = async (routes: {
    cheerioRequests: DanishJsonLdRequest[];
    playwrightRequests: DanishJsonLdRequest[];
  }) => {
    await Promise.all([
      enqueue(cheerioQueue, routes.cheerioRequests),
      enqueue(playwrightQueue, routes.playwrightRequests),
    ]);
  };

  const initial = initialRequests(input.source);
  await Promise.all([
    enqueue(cheerioQueue, initial.cheerioRequests),
    enqueue(playwrightQueue, initial.playwrightRequests),
  ]);

  const cheerioCrawler = createDanishJsonLdCheerioCrawler({
    source: input.source,
    requestHandler: async (context: CheerioCrawlingContext) => {
      const body = typeof context.body === "string"
        ? context.body
        : context.body.toString();
      await route(
        await session.handleResponse({
          kind: requestKind(context.request.label, context.request.userData),
          fetchMode: "cheerio",
          url: context.request.url,
          loadedUrl: context.request.loadedUrl,
          statusCode: context.response.statusCode ?? 200,
          headers: normalizeHeaders(context.response.headers),
          body,
        })
      );
    },
    crawlerOptions: {
      requestQueue: cheerioQueue,
      ...(Number.isSafeInteger(input.maxPages)
        ? { maxRequestsPerCrawl: input.maxPages + 100 }
        : {}),
      errorHandler: async (
        { request }: CheerioCrawlingContext,
        error: Error
      ) => {
        session.recordRetry({
          fetchMode: "cheerio",
          kind: requestKind(request.label, request.userData),
          url: request.url,
          retryCount: request.retryCount,
          error,
        });
      },
      failedRequestHandler: async (
        { request }: CheerioCrawlingContext,
        error: Error
      ) => {
        session.recordFailedRequest({
          fetchMode: "cheerio",
          kind: requestKind(request.label, request.userData),
          url: request.url,
          retryCount: request.retryCount,
          error,
        });
      },
    },
  });
  const playwrightCrawler = createDanishJsonLdPlaywrightCrawler({
    source: input.source,
    requestHandler: async (context: PlaywrightCrawlingContext) => {
      const body = await context.page.content();
      const headers = context.response
        ? await context.response.allHeaders()
        : {};
      await route(
        await session.handleResponse({
          kind: requestKind(context.request.label, context.request.userData),
          fetchMode: "playwright",
          url: context.request.url,
          loadedUrl: context.request.loadedUrl,
          statusCode: context.response?.status() ?? 200,
          headers,
          body,
        })
      );
    },
    crawlerOptions: {
      requestQueue: playwrightQueue,
      ...(Number.isSafeInteger(input.maxPages)
        ? { maxRequestsPerCrawl: input.maxPages + 100 }
        : {}),
      errorHandler: async (
        { request }: PlaywrightCrawlingContext,
        error: Error
      ) => {
        session.recordRetry({
          fetchMode: "playwright",
          kind: requestKind(request.label, request.userData),
          url: request.url,
          retryCount: request.retryCount,
          error,
        });
      },
      failedRequestHandler: async (
        { request }: PlaywrightCrawlingContext,
        error: Error
      ) => {
        session.recordFailedRequest({
          fetchMode: "playwright",
          kind: requestKind(request.label, request.userData),
          url: request.url,
          retryCount: request.retryCount,
          error,
        });
      },
      launchContext: { launchOptions: { headless: true } },
    },
  });

  for (let cycle = 0; cycle < 10; cycle += 1) {
    if (!(await cheerioQueue.isEmpty())) await cheerioCrawler.run();
    if (!(await playwrightQueue.isEmpty())) await playwrightCrawler.run();
    if ((await cheerioQueue.isEmpty()) && (await playwrightQueue.isEmpty())) {
      return { observation: session.observation, outcome: session.outcome() };
    }
  }

  session.recordFailedRequest({
    fetchMode: "cheerio",
    kind: input.source.discovery,
    url: input.source.domain,
    retryCount: 0,
    error: new Error("crawler routing did not reach a terminal queue state"),
  });
  return { observation: session.observation, outcome: session.outcome() };
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
