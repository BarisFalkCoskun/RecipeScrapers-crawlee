import * as cheerio from "cheerio";
import { Binary } from "mongodb";
import { gzipSync } from "node:zlib";
import type { RecipeDocumentV2Store, CrawlStore } from "../storage/store.js";
import type { PageDocument, SourceOutcomeReason, SourceRunOutcomeSummary } from "../types.js";
import { EXTRACTOR_VERSION } from "../config.js";
import { canonicalizeUrl, normalizeDomain } from "../utils/canonicalize.js";
import { hashHtml } from "../utils/hash.js";
import { detectLanguage } from "../utils/language.js";
import {
  buildRecipeDocumentV2,
  extractCompleteJsonLdRecipes,
  gzipJsonLdScripts,
  parseJsonLdScript,
} from "./recipe-document.js";
import { classifySourceOutcome, type SourceRunObservation } from "./source-outcome.js";
import type { DanishJsonLdSource } from "./source-registry.js";
import {
  discoverListingPage,
  discoverSitemapDocument,
  looksLikeHttp200BlockShell,
} from "./discovery.js";
import {
  createBoundedDiagnostic,
  inspectJsonLdShape,
} from "./diagnostics.js";
import { createSourceRequestBudget } from "./request-cap.js";

export type DanishJsonLdRequestKind = "sitemap" | "listing" | "recipe";
export interface DanishJsonLdRequest {
  kind: DanishJsonLdRequestKind;
  url: string;
}
export interface DanishJsonLdResponse extends DanishJsonLdRequest {
  fetchMode: "cheerio" | "playwright";
  loadedUrl?: string;
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}
export interface DanishJsonLdDiagnostic {
  event: string;
  data: Record<string, unknown>;
}
export interface DanishJsonLdRoutingResult {
  cheerioRequests: DanishJsonLdRequest[];
  playwrightRequests: DanishJsonLdRequest[];
}

type DanishJsonLdStore = CrawlStore & RecipeDocumentV2Store;
type SessionObservation = SourceRunObservation & { pageCapReached: boolean };

export class DanishJsonLdSourceSession {
  readonly observation: SessionObservation;
  private readonly source: DanishJsonLdSource;
  private readonly store: DanishJsonLdStore;
  private readonly crawlRunId: string;
  private readonly crawlAttemptId: string;
  private readonly diagnosticSink: (event: DanishJsonLdDiagnostic) => void;
  private readonly admittedRecipeUrls = new Set<string>();
  private readonly playwrightFallbackUrls = new Set<string>();
  private readonly requestBudget;

  constructor(options: {
    source: DanishJsonLdSource;
    store: DanishJsonLdStore;
    crawlRunId: string;
    crawlAttemptId: string;
    maxPages: number;
    diagnosticSink?: (event: DanishJsonLdDiagnostic) => void;
  }) {
    this.source = options.source;
    this.store = options.store;
    this.crawlRunId = options.crawlRunId;
    this.crawlAttemptId = options.crawlAttemptId;
    this.requestBudget = createSourceRequestBudget(options.maxPages);
    this.diagnosticSink = options.diagnosticSink ?? (() => undefined);
    this.observation = {
      sourceId: options.source.id,
      persistedRecipes: 0,
      completedRequests: 0,
      failedRequests: 0,
      blockedRequests: 0,
      discoveredRecipeCandidates: 0,
      processedRecipePages: 0,
      rejectedIncompleteJsonLd: 0,
      rejectedMalformedJsonLd: 0,
      playwrightFailures: 0,
      mongoFailures: 0,
      unintendedOffDomainAdmissions: 0,
      discoveryComplete: true,
      discoveryFailureReasons: [],
      pageCapReached: false,
    };
    this.emit("source-attempt", {
      discovery: options.source.discovery,
      fetchMode: options.source.fetchMode,
      maxPages: options.maxPages,
      settings: options.source.requestSettings,
      robotsEnforced: false,
    });
  }

  async handleResponse(
    response: DanishJsonLdResponse
  ): Promise<DanishJsonLdRoutingResult> {
    const budgeted = await this.requestBudget.handle(
      `${response.fetchMode}:${response.kind}:${response.url}`,
      async () => this.processResponse(response)
    );
    if (!budgeted.handled) {
      this.markPageCapReached();
      return emptyRoutes();
    }
    if (budgeted.capReached) {
      this.markPageCapReached();
      return emptyRoutes();
    }
    return budgeted.value;
  }

  isRequestCapReached(): boolean {
    return this.requestBudget.snapshot().capReached;
  }

  /** Records actual queue admission; rejected discovery candidates never call this. */
  recordQueueAdmission(url: string): void {
    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      hostname = "invalid-url";
    }
    const allowed = this.source.allowedDomains.some((domain) =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
    if (allowed) return;
    this.observation.unintendedOffDomainAdmissions =
      (this.observation.unintendedOffDomainAdmissions ?? 0) + 1;
    this.emit("off-domain-admission", { hostname });
  }

  private async processResponse(
    response: DanishJsonLdResponse
  ): Promise<DanishJsonLdRoutingResult> {
    this.observation.completedRequests = (this.observation.completedRequests ?? 0) + 1;
    const blocked = [401, 403, 429, 455, 526].includes(response.statusCode);
    if (blocked) {
      this.observation.blockedRequests = (this.observation.blockedRequests ?? 0) + 1;
    }
    this.emitHttpDiagnostic(response);

    if (response.loadedUrl && !this.isAllowedSourceUrl(response.loadedUrl)) {
      this.rejectDomainBoundary("loaded-url", response.loadedUrl, "loaded-url-domain-not-allowed");
      return emptyRoutes();
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (!blocked) {
        this.observation.failedRequests =
          (this.observation.failedRequests ?? 0) + 1;
      }
      if (response.kind !== "recipe") this.observation.discoveryComplete = false;
      return emptyRoutes();
    }

    if (looksLikeHttp200BlockShell(response.body)) {
      this.observation.blockedRequests = (this.observation.blockedRequests ?? 0) + 1;
      this.addDiscoveryFailure("http-200-block-shell");
      this.emit("discovery-incomplete", {
        kind: response.kind,
        reason: "http-200-block-shell",
      });
      return emptyRoutes();
    }

    if (response.kind === "sitemap") {
      return this.handleSitemap(response);
    }
    if (response.kind === "listing") {
      return this.handleListing(response);
    }
    return this.handleRecipe(response);
  }

  async recordFailedRequest(input: {
    fetchMode: "cheerio" | "playwright";
    kind: DanishJsonLdRequestKind;
    url: string;
    retryCount: number;
    statusCode?: number;
    headers?: Record<string, string | string[] | undefined>;
    snippet?: string;
    error: unknown;
  }): Promise<void> {
    const budgeted = await this.requestBudget.handle(
      `failed:${input.fetchMode}:${input.kind}:${input.url}:${input.retryCount}`,
      async () => undefined
    );
    if (!budgeted.handled || budgeted.capReached) this.markPageCapReached();
    const blocked =
      input.statusCode !== undefined &&
      [401, 403, 429, 455, 526].includes(input.statusCode);
    if (blocked) {
      this.observation.blockedRequests =
        (this.observation.blockedRequests ?? 0) + 1;
    } else {
      this.observation.failedRequests =
        (this.observation.failedRequests ?? 0) + 1;
    }
    if (!blocked && input.fetchMode === "playwright") {
      this.observation.playwrightFailures =
        (this.observation.playwrightFailures ?? 0) + 1;
    }
    if (input.kind !== "recipe") this.observation.discoveryComplete = false;
    this.emit("request-failed", {
      fetchMode: input.fetchMode,
      kind: input.kind,
      url: input.url,
      retryCount: input.retryCount,
      statusCode: input.statusCode,
      retryAfter: firstHeader(input.headers ?? {}, "retry-after"),
      cfRay: firstHeader(input.headers ?? {}, "cf-ray"),
      server: firstHeader(input.headers ?? {}, "server"),
      snippet: input.snippet,
      error: input.error instanceof Error ? input.error.message : String(input.error),
    });
  }

  async recordRetry(input: {
    fetchMode: "cheerio" | "playwright";
    kind: DanishJsonLdRequestKind;
    url: string;
    retryCount: number;
    statusCode?: number;
    error: unknown;
  }): Promise<boolean> {
    const budgeted = await this.requestBudget.handle(
      `retry:${input.fetchMode}:${input.kind}:${input.url}:${input.retryCount}`,
      async () => undefined
    );
    if (!budgeted.handled || budgeted.capReached) this.markPageCapReached();
    this.emit("request-retry", {
      fetchMode: input.fetchMode,
      kind: input.kind,
      url: input.url,
      retryCount: input.retryCount,
      statusCode: input.statusCode,
      error: input.error instanceof Error ? input.error.message : String(input.error),
    });
    return budgeted.handled && !budgeted.capReached;
  }

  outcome(): SourceRunOutcomeSummary {
    return classifySourceOutcome(this.observation);
  }

  private handleSitemap(response: DanishJsonLdResponse): DanishJsonLdRoutingResult {
    const discovery = discoverSitemapDocument({
      source: this.source,
      sitemapUrl: response.url,
      xml: response.body,
    });
    this.recordDiscoveryCompletion(response.kind, discovery);
    const recipeRequests = this.admitRecipeUrls(discovery.recipeUrls);
    this.emit("discovery", {
      kind: "sitemap",
      url: response.url,
      acceptedCount: discovery.acceptedCount,
      rejectedCount: sumCounts(discovery.rejectedByReason),
      rejectedByReason: discovery.rejectedByReason,
      recipeUrlCount: discovery.recipeUrls.length,
      sitemapUrlCount: discovery.sitemapUrls.length,
      terminal: discovery.terminal,
    });
    return {
      cheerioRequests: [
        ...discovery.sitemapUrls.map((url) => ({ kind: "sitemap" as const, url })),
        ...recipeRequests,
      ],
      playwrightRequests: [],
    };
  }

  private handleListing(response: DanishJsonLdResponse): DanishJsonLdRoutingResult {
    const contentType = firstHeader(response.headers, "content-type");
    const discovery = discoverListingPage({
      source: this.source,
      pageUrl: response.loadedUrl ?? response.url,
      body: response.body,
      contentType,
    });
    this.recordDiscoveryCompletion(response.kind, discovery);
    const recipeRequests = this.admitRecipeUrls(discovery.recipeUrls);
    this.emit("listing-discovery", {
      url: response.url,
      fetchMode: response.fetchMode,
      acceptedCount: discovery.acceptedCount,
      rejectedCount: sumCounts(discovery.rejectedByReason),
      rejectedByReason: discovery.rejectedByReason,
      linkCount: discovery.recipeUrls.length,
      nextCount: discovery.nextUrls.length,
      terminal: discovery.terminal,
    });
    const nextRequests = discovery.nextUrls.map((url) => ({
      kind: "listing" as const,
      url,
    }));
    return response.fetchMode === "playwright"
      ? {
          cheerioRequests: recipeRequests,
          playwrightRequests: nextRequests,
        }
      : {
          cheerioRequests: [...recipeRequests, ...nextRequests],
          playwrightRequests: [],
        };
  }

  private async handleRecipe(
    response: DanishJsonLdResponse
  ): Promise<DanishJsonLdRoutingResult> {
    const canonicalUrl = this.resolveCanonicalUrl(response);
    if (!this.isAllowedSourceUrl(canonicalUrl)) {
      this.rejectDomainBoundary(
        "canonical",
        canonicalUrl,
        "canonical-domain-not-allowed"
      );
      return emptyRoutes();
    }
    this.observation.processedRecipePages =
      (this.observation.processedRecipePages ?? 0) + 1;
    const extraction = extractCompleteJsonLdRecipes(response.body);
    this.observation.rejectedIncompleteJsonLd =
      (this.observation.rejectedIncompleteJsonLd ?? 0) +
      extraction.incompleteJsonLdCount;
    this.observation.rejectedMalformedJsonLd =
      (this.observation.rejectedMalformedJsonLd ?? 0) +
      extraction.malformedJsonLdCount;
    if (extraction.repairedJsonLdCount > 0) {
      this.emit("json-ld-repair", {
        repairedScriptCount: extraction.repairedJsonLdCount,
        rawJsonLdScriptCount: extraction.rawScripts.length,
        repair: "literal-control-characters-escaped",
      });
    }

    for (const rawScript of extraction.rawScripts.slice(0, 25)) {
      const parsedScript = parseJsonLdScript(rawScript);
      if (parsedScript) {
        this.emit("json-ld-shape", {
          ...inspectJsonLdShape(parsedScript.parsed),
          repairedControlCharacterCount:
            parsedScript.repairedControlCharacterCount,
        });
      } else {
        this.emit("json-ld-shape", {
          malformed: true,
          bytes: Buffer.byteLength(rawScript),
        });
      }
    }

    const fallbackReason =
      response.fetchMode === "cheerio" && extraction.recipes.length === 0
        ? this.playwrightFallbackReason(response, extraction.rawScripts.length)
        : null;
    const playwrightRequests: DanishJsonLdRequest[] = [];
    if (fallbackReason && !this.playwrightFallbackUrls.has(canonicalUrl)) {
      this.playwrightFallbackUrls.add(canonicalUrl);
      playwrightRequests.push({ kind: "recipe", url: response.url });
    }
    this.emit("playwright-decision", {
      url: response.url,
      from: response.fetchMode,
      queued: playwrightRequests.length === 1,
      reason: fallbackReason ?? "complete-json-ld-or-rendered-final",
    });

    const $ = cheerio.load(response.body);
    const bodyText = $("body").text();
    const domain = normalizeDomain(new URL(canonicalUrl).hostname);
    const pageLanguage = detectLanguage({
      $,
      html: response.body,
      bodyText,
      domain,
      recipe: extraction.recipes[0],
    });
    const extractionSignals = [
      "strict-json-ld-only",
      ...extraction.signals,
      ...(response.fetchMode === "playwright" ? ["playwright-js-rendered"] : []),
    ];

    const pageContentHash = hashHtml(response.body);
    const pageDocument: Omit<PageDocument, "_id"> = {
      canonicalUrl,
      domain,
      language: pageLanguage.language,
      languageConfidence: pageLanguage.languageConfidence,
      languageSignals: pageLanguage.languageSignals,
      fetchedAt: new Date(),
      httpStatus: response.statusCode,
      fetchMode: response.fetchMode,
      redirectChain:
        response.loadedUrl && response.loadedUrl !== response.url
          ? [response.url, response.loadedUrl]
          : undefined,
      extractionMethod: extraction.recipes.length > 0 ? "json-ld" : "partial",
      extractorVersion: EXTRACTOR_VERSION,
      extractionConfidence: extraction.recipes.length > 0 ? 1 : 0,
      extractionSignals,
      recipeCount: extraction.recipes.length,
      rawHtml:
        extraction.recipes.length === 0 || response.fetchMode === "playwright"
          ? new Binary(gzipSync(Buffer.from(response.body)))
          : undefined,
      rawJsonLdScripts: gzipJsonLdScripts(extraction.rawScripts),
      pageContentHash,
      discoverySource:
        response.fetchMode === "playwright" ? "playwright-fallback" : "discovered",
      sourceDomain: this.source.domain,
      admissionSignals: ["registry-url-pattern"],
      playwrightFallbackReason: fallbackReason ?? undefined,
      outboundRecipeLinks: [],
    };
    try {
      await this.store.upsertPage(pageDocument);
      this.emit("mongo-page-upsert", {
        canonicalUrl,
        pageContentHash,
        operation: "upserted",
        rawJsonLdScriptCount: extraction.rawScripts.length,
      });
    } catch (error) {
      this.observation.mongoFailures = (this.observation.mongoFailures ?? 0) + 1;
      this.emit("mongo-failure", {
        canonicalUrl,
        operation: "page-upsert",
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DanishJsonLdStoreFailure("Page upsert failed", error);
    }

    for (const [recipeIndex, rawRecipe] of extraction.recipes.entries()) {
      const recipeLanguage = detectLanguage({
        recipe: rawRecipe,
        $,
        html: response.body,
        bodyText,
        domain,
      });
      const now = new Date();
      const document = buildRecipeDocumentV2({
        sourceId: this.source.id,
        canonicalUrl,
        pageUrl: response.loadedUrl ?? response.url,
        crawlRunId: this.crawlRunId,
        crawlAttemptId: this.crawlAttemptId,
        extractedAt: now,
        rawRecipe,
        language: recipeLanguage.language,
        languageConfidence: recipeLanguage.languageConfidence,
        languageSignals: recipeLanguage.languageSignals,
        extractorVersion: EXTRACTOR_VERSION,
        extractionSignals,
        ...(extraction.recipes.length > 1 && !firstNonBlankString(rawRecipe["@id"])
          ? { pageRecipeDiscriminator: `recipe-${recipeIndex + 1}` }
          : {}),
      });
      try {
        const result = await this.store.upsertRecipeV2(document);
        this.observation.persistedRecipes =
          (this.observation.persistedRecipes ?? 0) + 1;
        this.emit("mongo-upsert", {
          canonicalUrl,
          sourceRecipeKey: document.sourceRecipeKey,
          sourceHash: document.sourceHash,
          contentHash: document.contentHash,
          operation: result.operation,
          duplicateDecision:
            result.contentMatches.length === 0
              ? "unique-content"
              : "content-match-audited",
          contentMatchCount: result.contentMatches.length,
        });
      } catch (error) {
        this.observation.mongoFailures = (this.observation.mongoFailures ?? 0) + 1;
        this.emit("mongo-failure", {
          canonicalUrl,
          sourceRecipeKey: document.sourceRecipeKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { cheerioRequests: [], playwrightRequests };
  }

  private admitRecipeUrls(urls: string[]): DanishJsonLdRequest[] {
    this.observation.discoveredRecipeCandidates =
      (this.observation.discoveredRecipeCandidates ?? 0) + urls.length;
    const requests: DanishJsonLdRequest[] = [];
    for (const url of urls) {
      const canonicalUrl = canonicalizeUrl(url);
      if (this.admittedRecipeUrls.has(canonicalUrl)) continue;
      this.admittedRecipeUrls.add(canonicalUrl);
      requests.push({ kind: "recipe", url });
    }
    return requests;
  }

  private markPageCapReached(): void {
    this.observation.pageCapReached = true;
    this.observation.discoveryComplete = false;
  }

  private recordDiscoveryCompletion(
    kind: DanishJsonLdRequestKind,
    discovery: { complete: boolean; incompleteReasons: string[] }
  ): void {
    if (discovery.complete) return;
    for (const reason of discovery.incompleteReasons) {
      if (isSourceOutcomeReason(reason)) this.addDiscoveryFailure(reason);
    }
    this.emit("discovery-incomplete", {
      kind,
      reasons: discovery.incompleteReasons,
    });
  }

  private addDiscoveryFailure(reason: SourceOutcomeReason): void {
    this.observation.discoveryComplete = false;
    const reasons = this.observation.discoveryFailureReasons ?? [];
    if (!reasons.includes(reason)) reasons.push(reason);
    this.observation.discoveryFailureReasons = reasons;
  }

  private rejectDomainBoundary(
    boundary: "loaded-url" | "canonical",
    url: string,
    reason: "loaded-url-domain-not-allowed" | "canonical-domain-not-allowed"
  ): void {
    this.addDiscoveryFailure(reason);
    this.emit("source-domain-rejected", {
      boundary,
      hostname: hostnameForDiagnostic(url),
    });
  }

  private isAllowedSourceUrl(url: string): boolean {
    try {
      const hostname = normalizeDomain(new URL(url).hostname);
      return this.source.allowedDomains.some((domain) => {
        const allowed = normalizeDomain(domain);
        return hostname === allowed || hostname.endsWith(`.${allowed}`);
      });
    } catch {
      return false;
    }
  }

  private playwrightFallbackReason(
    response: DanishJsonLdResponse,
    scriptCount: number
  ): string | null {
    if (response.statusCode < 200 || response.statusCode >= 400) return null;
    if (this.source.fetchMode === "playwright") return "registry-playwright-source";
    if (scriptCount > 0) return "incomplete-or-malformed-json-ld";
    if (/__NEXT_DATA__|__NUXT__|window\.__INITIAL_STATE__/u.test(response.body)) {
      return "client-rendering-marker";
    }
    if (/cloudflare|captcha|access denied|enable javascript|checking your browser/iu.test(response.body)) {
      return "blocked-or-client-rendered-shell";
    }
    return null;
  }

  private resolveCanonicalUrl(response: DanishJsonLdResponse): string {
    const $ = cheerio.load(response.body);
    const canonical = $('link[rel="canonical"]').first().attr("href");
    if (canonical) {
      try {
        return canonicalizeUrl(canonical, response.loadedUrl ?? response.url);
      } catch {
        // Fall through to the registry-discovered request URL.
      }
    }
    return canonicalizeUrl(response.url);
  }

  private emitHttpDiagnostic(response: DanishJsonLdResponse): void {
    this.emit("http-response", {
      kind: response.kind,
      fetchMode: response.fetchMode,
      url: response.url,
      loadedUrl: response.loadedUrl,
      statusCode: response.statusCode,
      redirected: Boolean(response.loadedUrl && response.loadedUrl !== response.url),
      retryAfter: firstHeader(response.headers, "retry-after"),
      cfRay: firstHeader(response.headers, "cf-ray"),
      server: firstHeader(response.headers, "server"),
      snippet: response.body.replace(/\s+/gu, " ").trim().slice(0, 1_000),
    });
  }

  private emit(event: string, data: Record<string, unknown>): void {
    this.diagnosticSink(
      createBoundedDiagnostic(event, {
        sourceId: this.source.id,
        crawlRunId: this.crawlRunId,
        crawlAttemptId: this.crawlAttemptId,
        ...data,
      })
    );
  }
}

function isSourceOutcomeReason(value: string): value is SourceOutcomeReason {
  return [
    "malformed-listing-payload",
    "unexpected-listing-shape",
    "http-200-block-shell",
  ].includes(value);
}

function hostnameForDiagnostic(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "invalid-url";
  }
}

function firstNonBlankString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function firstHeader(
  headers: Record<string, string | string[] | undefined>,
  wanted: string
): string | undefined {
  const entry = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === wanted.toLowerCase()
  )?.[1];
  return Array.isArray(entry) ? entry[0] : entry;
}

function sumCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

function emptyRoutes(): DanishJsonLdRoutingResult {
  return { cheerioRequests: [], playwrightRequests: [] };
}

class DanishJsonLdStoreFailure extends Error {
  readonly fatalScope = "store" as const;

  constructor(message: string, cause: unknown) {
    super(message, { cause });
    this.name = "DanishJsonLdStoreFailure";
  }
}
