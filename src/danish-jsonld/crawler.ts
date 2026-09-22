import type { SessionCheckpoint } from "./work-journal.js";
import * as cheerio from "cheerio";
import { Binary } from "mongodb";
import { gzipSync } from "node:zlib";
import type { RecipeDocumentV2Store, CrawlStore } from "../storage/store.js";
import type { PageDocument, SourceOutcomeReason, SourceRunOutcomeSummary } from "../types.js";
import { EXTRACTOR_VERSION } from "../config.js";
import { canonicalizeUrl, normalizeDomain } from "../utils/canonicalize.js";
import { hashHtml, hashRecipe } from "../utils/hash.js";
import { detectLanguage } from "../utils/language.js";
import {
  buildWprmRecipeDocumentV2,
  extractWprmRecipes,
  parseWprmApiResponseBody,
} from "../wprm/recipe-document.js";
import {
  buildEmbeddedRecipeDocumentV2,
  extractSpisbedreRecipe,
  type EmbeddedRecipe,
  type EmbeddedRecipeExtraction,
} from "../custom/spisbedre.js";
import { extractWebopskrifterRecipe } from "../custom/webopskrifter.js";
import { extractJetpackRecipe } from "../custom/jetpack-recipe.js";
import { extractDkKogebogenRecipe } from "../custom/dkkogebogen.js";
import {
  extractNipuniJulieRecipe,
  extractTheFoodClubRecipe,
} from "../custom/legacy-body-recipes.js";
import { extractMeyersRecipes } from "../custom/meyers.js";
import {
  extractShopifyBlogRecipe,
  type ShopifyBlogSourceId,
} from "../custom/shopify-blog.js";
import { extractFeminaRecipe } from "../custom/femina.js";
import { extractGocookRecipe } from "../custom/gocook.js";
import { extractAltRecipe } from "../custom/alt.js";
import { extractSamvirkeRecipe } from "../custom/samvirke.js";
import { extractDiscount365Recipes } from "../custom/discount365.js";
import {
  extractGigtforeningenPosts,
  nextGigtforeningenPostsRequest,
} from "../custom/gigtforeningen.js";
import { extractDrListing, extractDrRecipe } from "../custom/dr.js";
import {
  createHelloFreshSearchRequest,
  extractHelloFreshPage,
  extractHelloFreshToken,
  HELLOFRESH_PAGE_SIZE,
} from "../custom/hellofresh.js";
import {
  createMadForFattigroeveCurrentRequest,
  createMadForFattigroeveSitemapRequest,
  discoverMadForFattigroeveRecipes,
  extractMadForFattigroeveBuildId,
  extractMadForFattigroeveCurrentCatalog,
  extractMadForFattigroeveCurrentRecipes,
  extractMadForFattigroeveDictionary,
  extractMadForFattigroeveGraphqlCatalog,
  extractMadForFattigroeveRecipe,
} from "../custom/madforfattigroeve.js";
import {
  createMenySearchRequest,
  extractMenyPage,
  MENY_PAGE_SIZE,
} from "../custom/meny.js";
import {
  createNemligCategoryRequest,
  createNemligGroupRequest,
  extractNemligCategory,
  extractNemligGroup,
  extractNemligRecipe,
  extractNemligStamp,
  NEMLIG_SEED_CATEGORIES,
} from "../custom/nemlig.js";
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
  isListingHost,
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
  forefront?: boolean;
  method?: "GET" | "POST";
  requestHeaders?: Record<string, string>;
  payload?: string;
  uniqueKey?: string;
  requestData?: Record<string, unknown>;
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

/** Each checkpoint writes only newly discovered identities, even for very large catalogs. */
class CheckpointSet extends Set<string> {
  private additions: string[] = [];
  override add(value: string): this {
    if (!this.has(value)) this.additions.push(value);
    return super.add(value);
  }
  restore(values: string[]): void { for (const value of values) super.add(value); }
  takeAdditions(): string[] { return this.additions.splice(0); }
}

export class DanishJsonLdSourceSession {
  readonly observation: SessionObservation;
  private readonly source: DanishJsonLdSource;
  private readonly store: DanishJsonLdStore;
  private readonly crawlRunId: string;
  private readonly crawlAttemptId: string;
  private readonly diagnosticSink: (event: DanishJsonLdDiagnostic) => void;
  private readonly admittedRecipeUrls = new CheckpointSet();
  private readonly playwrightFallbackUrls = new CheckpointSet();
  private helloFreshToken?: string;
  private madForFattigroeveBuildId?: string;
  private nemligStamp?: string;
  private readonly nemligCategories = new CheckpointSet();
  private readonly nemligGroups = new CheckpointSet();
  private readonly nemligRecipes = new CheckpointSet();
  private readonly requestBudget;

  constructor(options: {
    source: DanishJsonLdSource;
    store: DanishJsonLdStore;
    crawlRunId: string;
    crawlAttemptId: string;
    maxPages: number;
    diagnosticSink?: (event: DanishJsonLdDiagnostic) => void;
    checkpoint?: SessionCheckpoint;
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
      rejectedIncompleteWprm: 0,
      rejectedMalformedWprm: 0,
      rejectedIncompleteCustom: 0,
      rejectedMalformedCustom: 0,
      playwrightFailures: 0,
      mongoFailures: 0,
      unintendedOffDomainAdmissions: 0,
      discoveryComplete: true,
      discoveryFailureReasons: [],
      pageCapReached: false,
    };
    if (options.checkpoint) {
      Object.assign(this.observation, options.checkpoint.observation, { interrupted: false, pageCapReached: false });
      // A prior cap interrupted traversal; resuming can finish it. Other discovery failures remain sticky.
      if (options.checkpoint.observation.pageCapReached && !(options.checkpoint.observation.discoveryFailureReasons?.length)) {
        this.observation.discoveryComplete = true;
      }
      for (const [name, set] of Object.entries(this.checkpointSets())) {
        set.restore(options.checkpoint.sets[name] ?? []);
      }
      Object.assign(this, options.checkpoint.values);
    }
    this.emit("source-attempt", {
      discovery: options.source.discovery,
      fetchMode: options.source.fetchMode,
      maxPages: options.maxPages,
      settings: options.source.requestSettings,
      robotsEnforced: false,
    });
  }

  recipeCandidateUrls(): string[] { return [...this.admittedRecipeUrls]; }

  private checkpointSets(): Record<string, CheckpointSet> {
    return { admittedRecipeUrls: this.admittedRecipeUrls, playwrightFallbackUrls: this.playwrightFallbackUrls,
      nemligCategories: this.nemligCategories, nemligGroups: this.nemligGroups, nemligRecipes: this.nemligRecipes };
  }

  checkpointDelta(): SessionCheckpoint {
    const sets: Record<string, string[]> = {};
    for (const [name, set] of Object.entries(this.checkpointSets())) {
      sets[name] = set.takeAdditions();
    }
    return { observation: structuredClone(this.observation), sets,
      values: { helloFreshToken: this.helloFreshToken, madForFattigroeveBuildId: this.madForFattigroeveBuildId, nemligStamp: this.nemligStamp } };
  }

  async handleResponse(
    response: DanishJsonLdResponse
  ): Promise<DanishJsonLdRoutingResult> {
    const budgeted = await this.requestBudget.handle(
      `${response.fetchMode}:${response.kind}:${response.url}`,
      async () => {
        const before = structuredClone(this.observation);
        const routes = await this.processResponse(response);
        const differences = [
          ["rejectedIncompleteCustom", "incomplete-custom-recipe"], ["rejectedMalformedCustom", "malformed-custom-payload"],
          ["rejectedMalformedJsonLd", "malformed-json-ld"], ["rejectedMalformedWprm", "malformed-wprm"],
        ] as const;
        const reasons = differences.filter(([key]) => (this.observation[key] ?? 0) > (before[key] ?? 0));
        if (reasons.length) await this.quarantine(response, {
          format: reasons.some(([key]) => key === "rejectedMalformedJsonLd") ? "json-ld" : reasons.some(([key]) => key === "rejectedMalformedWprm") ? "wprm-api" : "custom",
          reasons: reasons.map(([, reason]) => reason),
          candidateCount: reasons.reduce((sum, [key]) => sum + (this.observation[key] ?? 0) - (before[key] ?? 0), 0),
        });
        return routes;
      }
    );
    if (!budgeted.handled) {
      this.markPageCapReached();
      return emptyRoutes();
    }
    if (budgeted.capReached) this.markPageCapReached();
    return budgeted.value;
  }

  /** Logs a response attempt that will be retried without making it terminal run state. */
  recordRetriedResponseDiagnostic(response: DanishJsonLdResponse): void {
    this.emitHttpDiagnostic(response);
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
    if (allowed || isListingHost(this.source, url)) return;
    this.observation.unintendedOffDomainAdmissions =
      (this.observation.unintendedOffDomainAdmissions ?? 0) + 1;
    this.emit("off-domain-admission", { hostname });
  }

  private async processResponse(
    response: DanishJsonLdResponse
  ): Promise<DanishJsonLdRoutingResult> {
    this.observation.completedRequests = (this.observation.completedRequests ?? 0) + 1;
    const blocked = [401, 403, 429, 454, 455, 526].includes(response.statusCode);
    if (blocked) {
      this.observation.blockedRequests = (this.observation.blockedRequests ?? 0) + 1;
    }
    this.emitHttpDiagnostic(response);

    if (
      response.loadedUrl &&
      !this.isAllowedSourceUrl(response.loadedUrl) &&
      !(response.kind === "listing" && isListingHost(this.source, response.loadedUrl))
    ) {
      this.rejectDomainBoundary("loaded-url", response.loadedUrl, "loaded-url-domain-not-allowed");
      return emptyRoutes();
    }

    // A service whose pagination window ends in an error document answers the
    // page past the last one with that error status. Reading the body is the
    // only way to tell the window ending from a real failure, so it has to
    // reach discovery; a body that is not the declared terminal document
    // still reports itself incomplete from there.
    if (
      response.kind === "listing" &&
      response.statusCode === TERMINAL_PAYLOAD_STATUS &&
      this.source.listingDiscovery?.payload?.terminalPayload !== undefined
    ) {
      return this.handleListing(response);
    }

    if (
      response.kind === "recipe" &&
      this.source.canonicalFollowStatuses?.includes(response.statusCode)
    ) {
      const canonicalUrl = this.resolveCanonicalUrl(response);
      if (canonicalUrl !== canonicalizeUrl(response.url) && this.isAllowedSourceUrl(canonicalUrl)) {
        if (this.admittedRecipeUrls.has(canonicalUrl)) return emptyRoutes();
        this.admittedRecipeUrls.add(canonicalUrl);
        this.emit("canonical-followup", {
          statusCode: response.statusCode,
          fromUrl: response.url,
          canonicalUrl,
        });
        const request = { kind: "recipe" as const, url: canonicalUrl, forefront: true };
        return this.source.fetchMode === "playwright"
          ? { cheerioRequests: [], playwrightRequests: [request] }
          : { cheerioRequests: [request], playwrightRequests: [] };
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      if (!blocked) {
        this.observation.failedRequests =
          (this.observation.failedRequests ?? 0) + 1;
        this.recordFailedRequestSample(
          response.url,
          response.statusCode,
          `http-${response.statusCode}`
        );
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
    blockedReason?: SourceOutcomeReason;
    error: unknown;
  }): Promise<void> {
    const budgeted = await this.requestBudget.handle(
      `failed:${input.fetchMode}:${input.kind}:${input.url}:${input.retryCount}`,
      async () => undefined
    );
    if (!budgeted.handled || budgeted.capReached) this.markPageCapReached();
    const blocked = Boolean(input.blockedReason) || (
      input.statusCode !== undefined &&
      [401, 403, 429, 454, 455, 526].includes(input.statusCode)
    );
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
    if (!blocked) {
      this.recordFailedRequestSample(
        input.url,
        input.statusCode ?? null,
        input.error instanceof Error ? input.error.message : String(input.error)
      );
    }
    if (input.blockedReason) this.addDiscoveryFailure(input.blockedReason);
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
      required: (this.source.sitemapUrls ?? []).some(
        (url) => canonicalizeUrl(url) === canonicalizeUrl(response.url)
      ),
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
    const sitemapRequests = discovery.sitemapUrls.map((url) => ({
      kind: "sitemap" as const,
      url,
    }));
    return this.source.fetchMode === "playwright"
      ? {
          cheerioRequests: sitemapRequests,
          playwrightRequests: recipeRequests,
        }
      : {
          cheerioRequests: [...sitemapRequests, ...recipeRequests],
          playwrightRequests: [],
        };
  }

  private async handleListing(
    response: DanishJsonLdResponse
  ): Promise<DanishJsonLdRoutingResult> {
    if (this.source.recipeExtractor === "gigtforeningen-wp-html") {
      const extraction = extractGigtforeningenPosts(response.body);
      this.observation.discoveredRecipeCandidates =
        (this.observation.discoveredRecipeCandidates ?? 0) + extraction.candidateCount;
      this.observation.processedRecipePages =
        (this.observation.processedRecipePages ?? 0) + extraction.candidateCount;
      if (extraction.malformedCount > 0 && extraction.postCount === 0) {
        this.observation.discoveryComplete = false;
        this.addDiscoveryFailure("unexpected-listing-shape");
      }
      const totalPagesHeader = firstHeader(response.headers, "x-wp-totalpages");
      const next = nextGigtforeningenPostsRequest(response.url, totalPagesHeader);
      if (!totalPagesHeader && extraction.postCount >= 100) {
        this.observation.discoveryComplete = false;
        this.addDiscoveryFailure("script-gated-continuation");
      }
      this.emit("listing-discovery", {
        url: response.url,
        fetchMode: response.fetchMode,
        acceptedCount: extraction.candidateCount,
        rejectedCount: extraction.incompleteCount + extraction.malformedCount,
        rejectedByReason: {
          ...(extraction.incompleteCount > 0
            ? { "incomplete-custom-recipe": extraction.incompleteCount }
            : {}),
          ...(extraction.malformedCount > 0
            ? { "malformed-custom-payload": extraction.malformedCount }
            : {}),
        },
        linkCount: extraction.candidateCount,
        nextCount: next ? 1 : 0,
        terminal: !next,
      });
      const stored = await this.handleCustomRecipe(
        response,
        canonicalizeUrl(response.url),
        extraction,
        "api-json",
        ["wordpress-posts-api", "gigtforeningen-post-body-html", "complete-api-recipe-only"],
        "wordpress-post-body"
      );
      if (next) stored.cheerioRequests.push(next);
      return stored;
    }
    if (this.source.recipeExtractor === "nemlig-sitecore") {
      const phase = response.requestData?.nemligPhase;
      if (phase !== "category" && phase !== "group") {
        const stamp = extractNemligStamp(response.body);
        if (!stamp) {
          this.observation.rejectedMalformedCustom =
            (this.observation.rejectedMalformedCustom ?? 0) + 1;
          this.observation.discoveryComplete = false;
          this.addDiscoveryFailure("malformed-listing-payload");
          return emptyRoutes();
        }
        this.nemligStamp = stamp;
        const requests = NEMLIG_SEED_CATEGORIES.filter((path) => {
          if (this.nemligCategories.has(path)) return false;
          this.nemligCategories.add(path);
          return true;
        }).map(createNemligCategoryRequest);
        return { cheerioRequests: requests, playwrightRequests: [] };
      }
      if (phase === "category") {
        const extraction = extractNemligCategory(response.body);
        if (extraction.malformed || !this.nemligStamp) {
          this.observation.rejectedMalformedCustom =
            (this.observation.rejectedMalformedCustom ?? 0) + 1;
          this.observation.discoveryComplete = false;
          this.addDiscoveryFailure("malformed-listing-payload");
          return emptyRoutes();
        }
        const groupRequests = extraction.groupIds.filter((id) => {
          if (this.nemligGroups.has(id)) return false;
          this.nemligGroups.add(id);
          return true;
        }).map((id) => createNemligGroupRequest(this.nemligStamp as string, id, 0));
        const categoryRequests = extraction.categoryPaths.filter((path) => {
          if (this.nemligCategories.has(path)) return false;
          this.nemligCategories.add(path);
          return true;
        }).map(createNemligCategoryRequest);
        return { cheerioRequests: [...groupRequests, ...categoryRequests], playwrightRequests: [] };
      }
      const stamp = this.nemligStamp;
      const groupId = typeof response.requestData?.groupId === "string" ? response.requestData.groupId : "";
      const pageIndex = typeof response.requestData?.pageIndex === "number" ? response.requestData.pageIndex : 0;
      if (!stamp || !groupId) {
        this.observation.discoveryComplete = false;
        this.addDiscoveryFailure("malformed-listing-payload");
        return emptyRoutes();
      }
      const extraction = extractNemligGroup(response.body, stamp, groupId, pageIndex);
      if (extraction.malformed) {
        this.observation.rejectedMalformedCustom =
          (this.observation.rejectedMalformedCustom ?? 0) + 1;
        this.observation.discoveryComplete = false;
        this.addDiscoveryFailure("malformed-listing-payload");
      }
      const requests = extraction.requests.filter((request) => {
        if (request.kind !== "recipe") return true;
        if (this.nemligRecipes.has(request.url)) return false;
        this.nemligRecipes.add(request.url);
        return true;
      });
      const candidates = requests.filter((request) => request.kind === "recipe").length;
      this.observation.discoveredRecipeCandidates =
        (this.observation.discoveredRecipeCandidates ?? 0) + candidates;
      return { cheerioRequests: requests, playwrightRequests: [] };
    }
    if (this.source.recipeExtractor === "meny-api") {
      const offset = typeof response.requestData?.menyOffset === "number"
        ? response.requestData.menyOffset
        : 0;
      const extraction = extractMenyPage(response.body);
      this.observation.discoveredRecipeCandidates =
        (this.observation.discoveredRecipeCandidates ?? 0) + extraction.itemCount;
      this.observation.processedRecipePages =
        (this.observation.processedRecipePages ?? 0) + extraction.itemCount;
      const stored = await this.handleCustomRecipe(
        response,
        canonicalizeUrl(response.url),
        extraction,
        "api-json",
        ["dagrofa-search-api", "complete-api-recipe-only"],
        "meny-api-page"
      );
      const hasNext = extraction.itemCount > 0 && (
        (extraction.total !== undefined && offset + extraction.itemCount < extraction.total) ||
        extraction.itemCount >= MENY_PAGE_SIZE
      );
      if (hasNext) stored.cheerioRequests.push(createMenySearchRequest(offset + MENY_PAGE_SIZE));
      return stored;
    }
    if (this.source.recipeExtractor === "madforfattigroeve-nextjs") {
      const phase = response.requestData?.madForFattigroevePhase;
      if (phase === "current-catalog") {
        const catalog = extractMadForFattigroeveGraphqlCatalog(response.body);
        const dictionary = extractMadForFattigroeveDictionary(response.body);
        if (!dictionary || catalog.malformed) {
          this.observation.rejectedMalformedCustom =
            (this.observation.rejectedMalformedCustom ?? 0) + 1;
          this.observation.discoveryComplete = false;
          this.addDiscoveryFailure("malformed-listing-payload");
          return emptyRoutes();
        }
        const extraction = extractMadForFattigroeveCurrentRecipes(
          catalog.recipes,
          dictionary
        );
        this.observation.discoveredRecipeCandidates =
          (this.observation.discoveredRecipeCandidates ?? 0) + catalog.recipes.length;
        this.observation.processedRecipePages =
          (this.observation.processedRecipePages ?? 0) + catalog.recipes.length;
        return this.handleCustomRecipe(
          response,
          "https://madforfattigroeve.dk/",
          extraction,
          "api-json",
          ["nextjs-server-recipe-catalog", "graphql-ingredient-dictionary", "complete-api-recipe-only"],
          "current-recipe-catalog"
        );
      }
      if (phase !== "sitemap") {
        const current = extractMadForFattigroeveCurrentCatalog(response.body);
        if (!current.malformed) {
          return {
            cheerioRequests: [createMadForFattigroeveCurrentRequest()],
            playwrightRequests: [],
          };
        }
        const buildId = extractMadForFattigroeveBuildId(response.body);
        if (!buildId) {
          this.observation.rejectedMalformedCustom =
            (this.observation.rejectedMalformedCustom ?? 0) + 1;
          this.observation.discoveryComplete = false;
          this.addDiscoveryFailure("malformed-listing-payload");
          return emptyRoutes();
        }
        this.madForFattigroeveBuildId = buildId;
        return {
          cheerioRequests: [createMadForFattigroeveSitemapRequest()],
          playwrightRequests: [],
        };
      }
      if (!this.madForFattigroeveBuildId) {
        this.observation.discoveryComplete = false;
        this.addDiscoveryFailure("malformed-listing-payload");
        return emptyRoutes();
      }
      const requests = discoverMadForFattigroeveRecipes(
        response.body,
        this.madForFattigroeveBuildId
      );
      this.observation.discoveredRecipeCandidates =
        (this.observation.discoveredRecipeCandidates ?? 0) + requests.length;
      this.emit("listing-discovery", {
        url: response.url,
        fetchMode: response.fetchMode,
        acceptedCount: requests.length,
        rejectedCount: 0,
        rejectedByReason: {},
        linkCount: requests.length,
        nextCount: 0,
        terminal: true,
      });
      return { cheerioRequests: requests, playwrightRequests: [] };
    }
    if (this.source.recipeExtractor === "hellofresh-api") {
      if (response.requestData?.helloFreshPhase !== "search") {
        const token = extractHelloFreshToken(response.body);
        if (!token) {
          this.observation.rejectedMalformedCustom =
            (this.observation.rejectedMalformedCustom ?? 0) + 1;
          this.observation.discoveryComplete = false;
          this.addDiscoveryFailure("malformed-listing-payload");
          return emptyRoutes();
        }
        this.helloFreshToken = token;
        return {
          cheerioRequests: [createHelloFreshSearchRequest(token, 0)],
          playwrightRequests: [],
        };
      }
      const offset = typeof response.requestData.offset === "number"
        ? response.requestData.offset
        : 0;
      const extraction = extractHelloFreshPage(response.body);
      this.observation.discoveredRecipeCandidates =
        (this.observation.discoveredRecipeCandidates ?? 0) + extraction.itemCount;
      this.observation.processedRecipePages =
        (this.observation.processedRecipePages ?? 0) + extraction.itemCount;
      const stored = await this.handleCustomRecipe(
        response,
        canonicalizeUrl(response.url),
        extraction,
        "api-json",
        ["hellofresh-search-api", "complete-api-recipe-only"],
        "hellofresh-api-page"
      );
      const hasNext = extraction.total !== undefined && extraction.itemCount > 0 &&
        offset + HELLOFRESH_PAGE_SIZE < extraction.total;
      if (!hasNext) return stored;
      if (!this.helloFreshToken) {
        this.observation.discoveryComplete = false;
        this.addDiscoveryFailure("malformed-listing-payload");
        return stored;
      }
      stored.cheerioRequests.push(
        createHelloFreshSearchRequest(this.helloFreshToken, offset + HELLOFRESH_PAGE_SIZE)
      );
      return stored;
    }
    if (this.source.recipeExtractor === "dr-graphql") {
      const offset = typeof response.requestData?.offset === "number"
        ? response.requestData.offset
        : 0;
      const discovery = extractDrListing(response.body, offset);
      this.observation.discoveredRecipeCandidates =
        (this.observation.discoveredRecipeCandidates ?? 0) + discovery.candidateCount;
      if (discovery.malformed) {
        this.observation.rejectedMalformedCustom =
          (this.observation.rejectedMalformedCustom ?? 0) + 1;
        this.observation.discoveryComplete = false;
        this.addDiscoveryFailure("unexpected-listing-shape");
      }
      this.emit("listing-discovery", {
        url: response.url,
        fetchMode: response.fetchMode,
        acceptedCount: discovery.candidateCount,
        rejectedCount: discovery.malformed ? 1 : 0,
        rejectedByReason: discovery.malformed ? { "malformed-custom-payload": 1 } : {},
        linkCount: discovery.candidateCount,
        nextCount: discovery.requests.filter((request) => request.kind === "listing").length,
        terminal: discovery.terminal,
      });
      return { cheerioRequests: discovery.requests, playwrightRequests: [] };
    }
    if (this.source.legacyFamily === "SanityRecipeApiSpider") {
      return this.handleMeyersListing(response);
    }
    const contentType = firstHeader(response.headers, "content-type");
    const isWprmSource = this.source.legacyFamily === "WprmApiSpider" ||
      this.source.recipeExtractor === "wprm-api";
    const wprmPayload = isWprmSource
      ? parseWprmApiResponseBody(response.body)
      : undefined;
    const discovery = discoverListingPage({
      source: this.source,
      pageUrl: response.loadedUrl ?? response.url,
      body: wprmPayload === undefined ? response.body : JSON.stringify(wprmPayload),
      contentType,
    });
    this.recordDiscoveryCompletion(response.kind, discovery);
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
    if (isWprmSource) {
      return this.handleWprmListing(response, discovery, wprmPayload);
    }
    const recipeRequests = this.admitRecipeUrls(discovery.recipeUrls).map((request) => ({
      ...request,
      ...(this.source.listingDiscovery?.recipeForefront ? { forefront: true } : {}),
    }));
    const nextRequests = discovery.nextUrls.map((url) => ({
      kind: "listing" as const,
      url,
      ...(this.source.listingDiscovery?.continuationForefront && discovery.recipeUrls.length === 0
        ? { forefront: true }
        : {}),
    }));
    const playwrightRequests = [
      ...(this.source.fetchMode === "playwright" ? recipeRequests : []),
      ...(response.fetchMode === "playwright" ? nextRequests : []),
    ];
    const cheerioRequests = [
      ...(this.source.fetchMode === "cheerio" ? recipeRequests : []),
      ...(response.fetchMode === "cheerio" ? nextRequests : []),
    ];
    return { cheerioRequests, playwrightRequests };
  }

  private async handleMeyersListing(
    response: DanishJsonLdResponse
  ): Promise<DanishJsonLdRoutingResult> {
    const extraction = extractMeyersRecipes(response.body);
    this.observation.rejectedIncompleteCustom =
      (this.observation.rejectedIncompleteCustom ?? 0) + extraction.incompleteCount;
    this.observation.rejectedMalformedCustom =
      (this.observation.rejectedMalformedCustom ?? 0) + extraction.malformedCount;
    const candidateCount = extraction.recipes.length +
      extraction.incompleteCount + extraction.malformedCount;
    this.observation.discoveredRecipeCandidates =
      (this.observation.discoveredRecipeCandidates ?? 0) + candidateCount;
    this.observation.processedRecipePages =
      (this.observation.processedRecipePages ?? 0) + candidateCount;

    const accepted = [];
    for (const recipe of extraction.recipes) {
      let canonicalUrl: string;
      try {
        canonicalUrl = canonicalizeUrl(recipe.canonicalUrl);
      } catch {
        this.observation.rejectedMalformedCustom =
          (this.observation.rejectedMalformedCustom ?? 0) + 1;
        continue;
      }
      if (!this.isAllowedSourceUrl(canonicalUrl)) {
        this.rejectDomainBoundary(
          "canonical",
          canonicalUrl,
          "canonical-domain-not-allowed"
        );
        continue;
      }
      accepted.push({ ...recipe, canonicalUrl });
    }

    this.emit("listing-discovery", {
      url: response.url,
      fetchMode: response.fetchMode,
      acceptedCount: accepted.length,
      rejectedCount: candidateCount - accepted.length,
      rejectedByReason: {
        "incomplete-custom-recipe": extraction.incompleteCount,
        "malformed-custom-payload": extraction.malformedCount,
      },
      linkCount: accepted.length,
      nextCount: 0,
      terminal: true,
    });

    const apiPageUrl = canonicalizeUrl(response.loadedUrl ?? response.url);
    const domain = normalizeDomain(new URL(apiPageUrl).hostname);
    const language = detectLanguage({
      recipe: accepted[0]?.rawRecipe,
      domain: this.source.domain,
    });
    const extractionSignals = [
      "meyers-sanity-groq-api",
      "complete-structured-recipe-only",
    ];
    const pageContentHash = hashHtml(response.body);
    try {
      await this.store.upsertPage({
        canonicalUrl: apiPageUrl,
        domain,
        language: language.language,
        languageConfidence: language.languageConfidence,
        languageSignals: language.languageSignals,
        fetchedAt: new Date(),
        httpStatus: response.statusCode,
        fetchMode: response.fetchMode,
        redirectChain:
          response.loadedUrl && response.loadedUrl !== response.url
            ? [response.url, response.loadedUrl]
            : undefined,
        extractionMethod: accepted.length > 0 ? "api-json" : "partial",
        extractorVersion: EXTRACTOR_VERSION,
        extractionConfidence: accepted.length > 0 ? 1 : 0,
        extractionSignals,
        recipeCount: accepted.length,
        rawApiPayload: new Binary(gzipSync(Buffer.from(response.body))),
        pageContentHash,
        discoverySource: "discovered",
        sourceDomain: this.source.domain,
        admissionSignals: ["registry-sanity-api"],
        outboundRecipeLinks: [],
      });
      this.emit("mongo-page-upsert", {
        canonicalUrl: apiPageUrl,
        pageContentHash,
        operation: "upserted",
        apiRecipeCount: accepted.length,
      });
    } catch (error) {
      this.observation.mongoFailures = (this.observation.mongoFailures ?? 0) + 1;
      this.emit("mongo-failure", {
        canonicalUrl: apiPageUrl,
        operation: "api-page-upsert",
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DanishJsonLdStoreFailure("Recipe API page upsert failed", error);
    }

    for (const recipe of accepted) {
      const recipeLanguage = detectLanguage({
        recipe: recipe.rawRecipe,
        domain: this.source.domain,
      });
      const document = buildEmbeddedRecipeDocumentV2({
        sourceId: this.source.id,
        crawlRunId: this.crawlRunId,
        crawlAttemptId: this.crawlAttemptId,
        pageUrl: apiPageUrl,
        extractedAt: new Date(),
        recipe,
        language: recipeLanguage.language,
        languageConfidence: recipeLanguage.languageConfidence,
        languageSignals: recipeLanguage.languageSignals,
        extractorVersion: EXTRACTOR_VERSION,
        extractionSignals,
        extractionMethod: "api-json",
      });
      try {
        const result = await this.store.upsertRecipeV2(document);
        const counter = result.operation === "inserted" ? "insertedRecipes" : result.contentChanged === false ? "unchangedRecipes" : "changedRecipes";
        this.observation[counter] = (this.observation[counter] ?? 0) + 1;
        this.observation.persistedRecipes =
          (this.observation.persistedRecipes ?? 0) + 1;
        this.emit("mongo-upsert", {
          canonicalUrl: document.canonicalUrl,
          sourceRecipeKey: document.sourceRecipeKey,
          sourceHash: document.sourceHash,
          contentHash: document.contentHash,
          operation: result.operation,
          extractionMethod: "api-json",
          contentMatchCount: result.contentMatches.length,
        });
      } catch (error) {
        this.observation.mongoFailures = (this.observation.mongoFailures ?? 0) + 1;
        this.emit("mongo-failure", {
          canonicalUrl: document.canonicalUrl,
          sourceRecipeKey: document.sourceRecipeKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return emptyRoutes();
  }

  private async handleWprmListing(
    response: DanishJsonLdResponse,
    discovery: { nextUrls: string[]; terminal: boolean },
    payload: unknown | undefined
  ): Promise<DanishJsonLdRoutingResult> {
    const nextRequests = discovery.nextUrls.map((url) => ({
      kind: "listing" as const,
      url,
    }));
    // WordPress signals the page after the last page with its declared
    // terminal error object. It contains no recipes and is not malformed.
    if (response.statusCode === TERMINAL_PAYLOAD_STATUS && discovery.terminal) {
      return response.fetchMode === "playwright"
        ? { cheerioRequests: [], playwrightRequests: nextRequests }
        : { cheerioRequests: nextRequests, playwrightRequests: [] };
    }

    const extraction = extractWprmRecipes(payload);
    for (const rejected of extraction.rejectedCandidates) {
      await this.quarantine(response, { ...rejected, format: "wprm-api", candidateCount: 1 });
    }
    this.observation.rejectedIncompleteWprm =
      (this.observation.rejectedIncompleteWprm ?? 0) + extraction.incompleteCount;
    this.observation.rejectedMalformedWprm =
      (this.observation.rejectedMalformedWprm ?? 0) + extraction.malformedCount;
    const candidateCount = extraction.recipes.length +
      extraction.incompleteCount + extraction.malformedCount;
    this.observation.discoveredRecipeCandidates =
      (this.observation.discoveredRecipeCandidates ?? 0) + candidateCount;
    this.observation.processedRecipePages =
      (this.observation.processedRecipePages ?? 0) + candidateCount;

    const accepted = [];
    for (const recipe of extraction.recipes) {
      let canonicalUrl: string;
      try {
        canonicalUrl = canonicalizeUrl(recipe.canonicalUrl);
      } catch {
        this.observation.rejectedMalformedWprm =
          (this.observation.rejectedMalformedWprm ?? 0) + 1;
        continue;
      }
      if (!this.isAllowedSourceUrl(canonicalUrl)) {
        this.rejectDomainBoundary(
          "canonical",
          canonicalUrl,
          "canonical-domain-not-allowed"
        );
        continue;
      }
      accepted.push({ ...recipe, canonicalUrl });
    }

    const apiPageUrl = canonicalizeUrl(response.loadedUrl ?? response.url);
    const domain = normalizeDomain(new URL(apiPageUrl).hostname);
    const pageLanguage = detectLanguage({
      recipe: accepted[0]?.rawRecipe,
      domain: this.source.domain,
    });
    const extractionSignals = [
      "wprm-rest-api",
      "complete-structured-recipe-only",
      ...(response.fetchMode === "playwright" ? ["playwright-json-rendered"] : []),
    ];
    const pageContentHash = hashHtml(response.body);
    try {
      await this.store.upsertPage({
        canonicalUrl: apiPageUrl,
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
        extractionMethod: accepted.length > 0 ? "wprm-api" : "partial",
        extractorVersion: EXTRACTOR_VERSION,
        extractionConfidence: accepted.length > 0 ? 1 : 0,
        extractionSignals,
        recipeCount: accepted.length,
        rawApiPayload: new Binary(gzipSync(Buffer.from(response.body))),
        pageContentHash,
        discoverySource: "discovered",
        sourceDomain: this.source.domain,
        admissionSignals: ["registry-wprm-api"],
        outboundRecipeLinks: [],
      });
      this.emit("mongo-page-upsert", {
        canonicalUrl: apiPageUrl,
        pageContentHash,
        operation: "upserted",
        wprmRecipeCount: accepted.length,
      });
    } catch (error) {
      this.observation.mongoFailures = (this.observation.mongoFailures ?? 0) + 1;
      this.emit("mongo-failure", {
        canonicalUrl: apiPageUrl,
        operation: "wprm-page-upsert",
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DanishJsonLdStoreFailure("WPRM API page upsert failed", error);
    }

    for (const recipe of accepted) {
      const language = detectLanguage({
        recipe: recipe.rawRecipe,
        domain: this.source.domain,
      });
      const document = buildWprmRecipeDocumentV2({
        sourceId: this.source.id,
        crawlRunId: this.crawlRunId,
        crawlAttemptId: this.crawlAttemptId,
        apiPageUrl,
        extractedAt: new Date(),
        recipe,
        language: language.language,
        languageConfidence: language.languageConfidence,
        languageSignals: language.languageSignals,
        extractorVersion: EXTRACTOR_VERSION,
        extractionSignals,
      });
      try {
        const result = await this.store.upsertRecipeV2(document);
        const counter = result.operation === "inserted" ? "insertedRecipes" : result.contentChanged === false ? "unchangedRecipes" : "changedRecipes";
        this.observation[counter] = (this.observation[counter] ?? 0) + 1;
        this.observation.persistedRecipes =
          (this.observation.persistedRecipes ?? 0) + 1;
        this.emit("mongo-upsert", {
          canonicalUrl: document.canonicalUrl,
          sourceRecipeKey: document.sourceRecipeKey,
          sourceHash: document.sourceHash,
          contentHash: document.contentHash,
          operation: result.operation,
          extractionMethod: "wprm-api",
          contentMatchCount: result.contentMatches.length,
        });
      } catch (error) {
        this.observation.mongoFailures = (this.observation.mongoFailures ?? 0) + 1;
        this.emit("mongo-failure", {
          canonicalUrl: document.canonicalUrl,
          sourceRecipeKey: document.sourceRecipeKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return response.fetchMode === "playwright"
      ? { cheerioRequests: [], playwrightRequests: nextRequests }
      : { cheerioRequests: nextRequests, playwrightRequests: [] };
  }

  private async handleRecipe(
    response: DanishJsonLdResponse
  ): Promise<DanishJsonLdRoutingResult> {
    if (this.source.recipeExtractor === "nemlig-sitecore") {
      this.observation.processedRecipePages =
        (this.observation.processedRecipePages ?? 0) + 1;
      const extraction = extractNemligRecipe(response.body, response.url);
      return this.handleCustomRecipe(
        response,
        extraction.recipe?.canonicalUrl ?? response.url,
        extraction,
        "api-json",
        ["nemlig-sitecore-json", "complete-api-recipe-only"],
        "nemlig-sitecore-recipe"
      );
    }
    if (this.source.recipeExtractor === "madforfattigroeve-nextjs") {
      this.observation.processedRecipePages =
        (this.observation.processedRecipePages ?? 0) + 1;
      const recipeId = typeof response.requestData?.recipeId === "string"
        ? response.requestData.recipeId
        : response.url.match(/\/(\d+)\.json(?:\?|$)/u)?.[1] ?? "";
      const extraction = extractMadForFattigroeveRecipe(response.body, recipeId);
      const pageCanonicalUrl = extraction.recipe?.canonicalUrl ?? response.url;
      return this.handleCustomRecipe(
        response,
        pageCanonicalUrl,
        extraction,
        "api-json",
        ["nextjs-data-endpoint", "complete-api-recipe-only"],
        "madforfattigroeve-nextjs"
      );
    }
    if (this.source.recipeExtractor === "dr-graphql") {
      this.observation.processedRecipePages =
        (this.observation.processedRecipePages ?? 0) + 1;
      const extraction = extractDrRecipe(response.body);
      let pageCanonicalUrl = response.url;
      if (extraction.recipe) {
        try {
          pageCanonicalUrl = canonicalizeUrl(extraction.recipe.canonicalUrl);
        } catch {
          // The shared custom handler records the malformed identity.
        }
      }
      return this.handleCustomRecipe(
        response,
        pageCanonicalUrl,
        extraction,
        "api-json",
        ["dr-steffi-graphql", "complete-api-recipe-only"],
        "dr-graphql-article"
      );
    }
    // DK Kogebogen has unrelated recipe pages with stale canonical tags that
    // collide with valid numeric recipe URLs. The legacy spider identifies a
    // record by the final requested URL, which is also the stable site key.
    const canonicalUrl = this.source.recipeExtractor === "dkkogebogen-microdata"
      ? canonicalizeUrl(response.loadedUrl ?? response.url)
      : this.resolveCanonicalUrl(response);
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
    if (this.source.recipeExtractor === "spisbedre-inertia") {
      return this.handleCustomRecipe(
        response,
        canonicalUrl,
        extractSpisbedreRecipe(response.body, canonicalUrl),
        "embedded-json",
        ["spisbedre-inertia-data-page", "complete-embedded-recipe-only"],
        "embedded-inertia-payload"
      );
    }
    if (this.source.recipeExtractor === "webopskrifter-microdata") {
      return this.handleCustomRecipe(
        response,
        canonicalUrl,
        extractWebopskrifterRecipe(response.body, canonicalUrl),
        "html-parsing",
        ["webopskrifter-recipe-microdata", "complete-html-recipe-only"],
        "recipe-microdata"
      );
    }
    if (this.source.recipeExtractor === "jetpack-recipe-html") {
      // A post without a Jetpack recipe block is simply not a recipe; it falls
      // through to the JSON-LD path, which finds nothing and records no rejection.
      const extraction = extractJetpackRecipe(response.body, canonicalUrl);
      if (extraction.found) {
        return this.handleCustomRecipe(
          response,
          canonicalUrl,
          extraction,
          "html-parsing",
          ["jetpack-recipe-microdata", "complete-html-recipe-only"],
          "recipe-microdata"
        );
      }
    }
    if (this.source.recipeExtractor === "dkkogebogen-microdata") {
      return this.handleCustomRecipe(
        response,
        canonicalUrl,
        extractDkKogebogenRecipe(response.body, canonicalUrl),
        "html-parsing",
        ["dkkogebogen-recipe-microdata", "complete-html-recipe-only"],
        "recipe-microdata"
      );
    }
    if (this.source.recipeExtractor === "nipunijulie-body-html") {
      return this.handleCustomRecipe(
        response,
        canonicalUrl,
        extractNipuniJulieRecipe(response.body, canonicalUrl),
        "html-parsing",
        ["nipunijulie-article-body", "complete-html-recipe-only"],
        "legacy-article-body"
      );
    }
    if (this.source.recipeExtractor === "samvirke-html") {
      return this.handleCustomRecipe(
        response,
        canonicalUrl,
        extractSamvirkeRecipe(response.body, canonicalUrl),
        "html-parsing",
        ["samvirke-article-body", "complete-html-recipe-only"],
        "legacy-article-body"
      );
    }
    if (this.source.recipeExtractor === "thefoodclub-body-html") {
      return this.handleCustomRecipe(
        response,
        canonicalUrl,
        extractTheFoodClubRecipe(response.body, canonicalUrl),
        "html-parsing",
        ["thefoodclub-article-body", "complete-html-recipe-only"],
        "legacy-article-body"
      );
    }
    if (this.source.recipeExtractor === "shopify-blog-html") {
      return this.handleCustomRecipe(
        response,
        canonicalUrl,
        extractShopifyBlogRecipe({
          sourceId: this.source.id as ShopifyBlogSourceId,
          html: response.body,
          canonicalUrl,
        }),
        "html-parsing",
        ["shopify-article-html", "complete-html-recipe-only"],
        "shopify-recipe-article"
      );
    }
    if (this.source.recipeExtractor === "femina-html") {
      return this.handleCustomRecipe(
        response,
        canonicalUrl,
        extractFeminaRecipe(response.body, canonicalUrl),
        "html-parsing",
        ["femina-wysiwyg-html", "complete-html-recipe-only"],
        "femina-recipe-article"
      );
    }
    if (this.source.recipeExtractor === "gocook-jsonld-html") {
      return this.handleCustomRecipe(
        response,
        canonicalUrl,
        extractGocookRecipe(response.body, canonicalUrl),
        "html-parsing",
        ["gocook-json-ld-metadata", "gocook-html-instructions", "complete-html-recipe-only"],
        "json-ld-plus-html"
      );
    }
    if (this.source.recipeExtractor === "alt-html") {
      return this.handleCustomRecipe(
        response,
        canonicalUrl,
        extractAltRecipe(response.body, canonicalUrl),
        "html-parsing",
        ["alt-current-recipe-html", "complete-html-recipe-only"],
        "alt-recipe-html"
      );
    }
    if (this.source.recipeExtractor === "discount365-html") {
      return this.handleCustomRecipe(
        response,
        canonicalUrl,
        extractDiscount365Recipes(response.body, canonicalUrl),
        "html-parsing",
        ["365discount-text-container-html", "complete-html-recipe-only"],
        "365discount-recipe-html"
      );
    }
    const extraction = extractCompleteJsonLdRecipes(response.body, {
      collapseSameTitleRecipes: this.source.collapseSameTitleRecipes === true,
      keepFirstRecipeOnly: this.source.keepFirstRecipeOnly === true,
    });
    if (extraction.repairedJsonLdCount > 0) {
      this.emit("json-ld-repair", {
        repairedScriptCount: extraction.repairedJsonLdCount,
        rawJsonLdScriptCount: extraction.rawScripts.length,
        repair: "literal-control-characters-escaped",
      });
    }

    for (const rawScript of extraction.rawScripts.slice(0, 25)) {
      // Extraction ignores blank scripts; the shape diagnostic must agree, or
      // the log reports malformed scripts the counters never rejected.
      if (rawScript.trim() === "") continue;
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
        ? this.playwrightFallbackReason(response, extraction)
        : null;
    const playwrightRequests: DanishJsonLdRequest[] = [];
    if (fallbackReason && !this.playwrightFallbackUrls.has(canonicalUrl)) {
      this.playwrightFallbackUrls.add(canonicalUrl);
      playwrightRequests.push({ kind: "recipe", url: response.url });
    }
    // Cheerio evidence that triggers rendering is intermediate. Count only the
    // terminal rendered extraction so rejection metrics and alerts do not
    // report the same upstream Recipe node twice.
    if (!fallbackReason) {
      for (const rejected of extraction.rejectedCandidates) {
        await this.quarantine(response, { ...rejected, format: "json-ld", candidateCount: 1 });
      }
      this.observation.rejectedIncompleteJsonLd =
        (this.observation.rejectedIncompleteJsonLd ?? 0) +
        extraction.incompleteJsonLdCount;
      this.observation.rejectedMalformedJsonLd =
        (this.observation.rejectedMalformedJsonLd ?? 0) +
        extraction.malformedJsonLdCount;
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
        ...(this.source.numericYieldOnly ? { numericYieldOnly: true as const } : {}),
        ...(extraction.recipes.length > 1 && !firstNonBlankString(rawRecipe["@id"])
          ? { pageRecipeDiscriminator: `recipe-${recipeIndex + 1}` }
          : {}),
      });
      try {
        const result = await this.store.upsertRecipeV2(document);
        const counter = result.operation === "inserted" ? "insertedRecipes" : result.contentChanged === false ? "unchangedRecipes" : "changedRecipes";
        this.observation[counter] = (this.observation[counter] ?? 0) + 1;
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

  private async handleCustomRecipe(
    response: DanishJsonLdResponse,
    pageCanonicalUrl: string,
    extraction: EmbeddedRecipeExtraction,
    extractionMethod: "embedded-json" | "html-parsing" | "api-json",
    sourceExtractionSignals: string[],
    admissionSignal: string
  ): Promise<DanishJsonLdRoutingResult> {
    this.observation.rejectedIncompleteCustom =
      (this.observation.rejectedIncompleteCustom ?? 0) + extraction.incompleteCount;
    this.observation.rejectedMalformedCustom =
      (this.observation.rejectedMalformedCustom ?? 0) + extraction.malformedCount;
    const extractedRecipes = extraction.recipes ?? (extraction.recipe ? [extraction.recipe] : []);
    const recipes: EmbeddedRecipe[] = [];
    for (let recipe of extractedRecipes) {
      let canonicalUrl: string;
      try {
        const resolved = new URL(recipe.canonicalUrl, pageCanonicalUrl);
        const fragment = recipe.preserveCanonicalFragment ? resolved.hash : "";
        canonicalUrl = canonicalizeUrl(resolved.toString());
        if (fragment) canonicalUrl += fragment;
      } catch {
        this.observation.rejectedMalformedCustom =
          (this.observation.rejectedMalformedCustom ?? 0) + 1;
        continue;
      }
      if (!this.isAllowedSourceUrl(canonicalUrl)) {
        this.rejectDomainBoundary(
          "canonical",
          canonicalUrl,
          "canonical-domain-not-allowed"
        );
      } else {
        recipes.push({ ...recipe, canonicalUrl });
      }
    }

    const $ = cheerio.load(response.body);
    const bodyText = $("body").text();
    const domain = normalizeDomain(new URL(pageCanonicalUrl).hostname);
    const language = detectLanguage({
      $,
      html: response.body,
      bodyText,
      domain,
      recipe: recipes[0]?.rawRecipe,
    });
    const extractionSignals = [
      ...sourceExtractionSignals,
      ...(response.fetchMode === "playwright" ? ["playwright-js-rendered"] : []),
    ];
    const pageContentHash = hashHtml(response.body);
    try {
      await this.store.upsertPage({
        canonicalUrl: pageCanonicalUrl,
        domain,
        language: language.language,
        languageConfidence: language.languageConfidence,
        languageSignals: language.languageSignals,
        fetchedAt: new Date(),
        httpStatus: response.statusCode,
        fetchMode: response.fetchMode,
        redirectChain:
          response.loadedUrl && response.loadedUrl !== response.url
            ? [response.url, response.loadedUrl]
            : undefined,
        extractionMethod: recipes.length > 0 ? extractionMethod : "partial",
        extractorVersion: EXTRACTOR_VERSION,
        extractionConfidence: recipes.length > 0 ? 1 : 0,
        extractionSignals,
        recipeCount: recipes.length,
        rawHtml: new Binary(gzipSync(Buffer.from(response.body))),
        pageContentHash,
        discoverySource:
          response.fetchMode === "playwright" ? "playwright-fallback" : "discovered",
        sourceDomain: this.source.domain,
        admissionSignals: ["registry-url-pattern", admissionSignal],
        outboundRecipeLinks: [],
      });
      this.emit("mongo-page-upsert", {
        canonicalUrl: pageCanonicalUrl,
        pageContentHash,
        operation: "upserted",
        embeddedRecipeCount: recipes.length,
      });
    } catch (error) {
      this.observation.mongoFailures = (this.observation.mongoFailures ?? 0) + 1;
      this.emit("mongo-failure", {
        canonicalUrl: pageCanonicalUrl,
        operation: "embedded-page-upsert",
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DanishJsonLdStoreFailure("Embedded recipe page upsert failed", error);
    }

    this.emit("playwright-decision", {
      url: response.url,
      from: response.fetchMode,
      queued: false,
      reason: "source-custom-extraction-final",
    });
    for (const recipe of recipes) {
      const document = buildEmbeddedRecipeDocumentV2({
        sourceId: this.source.id,
        crawlRunId: this.crawlRunId,
        crawlAttemptId: this.crawlAttemptId,
        pageUrl: response.loadedUrl ?? response.url,
        extractedAt: new Date(),
        recipe,
        language: language.language,
        languageConfidence: language.languageConfidence,
        languageSignals: language.languageSignals,
        extractorVersion: EXTRACTOR_VERSION,
        extractionSignals,
        extractionMethod,
      });
      try {
        const result = await this.store.upsertRecipeV2(document);
        const counter = result.operation === "inserted" ? "insertedRecipes" : result.contentChanged === false ? "unchangedRecipes" : "changedRecipes";
        this.observation[counter] = (this.observation[counter] ?? 0) + 1;
        this.observation.persistedRecipes =
          (this.observation.persistedRecipes ?? 0) + 1;
        this.emit("mongo-upsert", {
          canonicalUrl: document.canonicalUrl,
          sourceRecipeKey: document.sourceRecipeKey,
          sourceHash: document.sourceHash,
          contentHash: document.contentHash,
          operation: result.operation,
          extractionMethod,
          contentMatchCount: result.contentMatches.length,
        });
      } catch (error) {
        this.observation.mongoFailures = (this.observation.mongoFailures ?? 0) + 1;
        this.emit("mongo-failure", {
          canonicalUrl: document.canonicalUrl,
          sourceRecipeKey: document.sourceRecipeKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return emptyRoutes();
  }

  private async quarantine(response: DanishJsonLdResponse, input: {
    format: "json-ld" | "wprm-api" | "custom";
    rawRecipe?: Record<string, unknown>;
    reasons: string[];
    candidateCount: number;
  }): Promise<void> {
    if (!this.store.upsertRejectedCandidate) {
      this.emit("quarantine-unavailable", { url: response.url, reasons: input.reasons });
      return;
    }
    try {
      await this.store.upsertRejectedCandidate({
        candidateKey: hashRecipe({ source: this.source.id, run: this.crawlRunId, url: response.url,
          content: input.rawRecipe ?? hashHtml(response.body), reasons: input.reasons }),
        sourceId: this.source.id, pageUrl: response.loadedUrl ?? response.url,
        crawlRunId: this.crawlRunId, extractedAt: new Date(), extractorVersion: EXTRACTOR_VERSION,
        ...input,
        ...(input.rawRecipe ? {} : { rawPayload: new Binary(gzipSync(Buffer.from(response.body))) }),
        diagnosis: input.format === "custom" ? "extractor-rejected"
          : input.rawRecipe ? "incomplete-structured-data" : "malformed-structured-data",
      });
      this.observation.quarantinedCandidates = (this.observation.quarantinedCandidates ?? 0) + input.candidateCount;
    } catch (error) {
      this.observation.mongoFailures = (this.observation.mongoFailures ?? 0) + 1;
      throw new DanishJsonLdStoreFailure("Rejected candidate persistence failed", error);
    }
  }

  private admitRecipeUrls(urls: string[]): DanishJsonLdRequest[] {
    this.observation.discoveredRecipeCandidates =
      (this.observation.discoveredRecipeCandidates ?? 0) + urls.length;
    const requests: DanishJsonLdRequest[] = [];
    for (const url of urls) {
      // Canonical form is the deduplication identity, not necessarily a safe
      // fetch representation. Some WordPress routes distinguish `/category/`
      // from `/category` and only redirect correctly on the www host. Keep the
      // discovered URL on the wire, then normalize the loaded recipe identity.
      const canonicalUrl = canonicalizeUrl(url);
      if (this.admittedRecipeUrls.has(canonicalUrl)) continue;
      this.admittedRecipeUrls.add(canonicalUrl);
      this.observation.uniqueRecipeUrls = this.admittedRecipeUrls.size;
      requests.push({ kind: "recipe", url });
    }
    return requests;
  }

  /**
   * Failure diagnostics go through the budgeted sink and disappear on a long
   * crawl, leaving a partial outcome with no traceable cause. A bounded sample
   * on the observation always reaches the evidence file.
   */
  private recordFailedRequestSample(
    url: string,
    statusCode: number | null,
    error: string
  ): void {
    const samples = this.observation.failedRequestSamples ?? [];
    if (samples.length >= 10) return;
    samples.push({ url, statusCode, error: error.slice(0, 200) });
    this.observation.failedRequestSamples = samples;
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
    // The diagnostic sink is budgeted and drops these on a long crawl, which
    // leaves the offending URL unknowable. Keep a bounded sample on the
    // observation so the evidence file always names it.
    const rejected = this.observation.rejectedCanonicalUrls ?? [];
    if (rejected.length < 10 && !rejected.includes(url)) {
      rejected.push(url);
      this.observation.rejectedCanonicalUrls = rejected;
    }
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
    extraction: {
      rawScripts: string[];
      incompleteJsonLdCount: number;
      malformedJsonLdCount: number;
    }
  ): string | null {
    if (response.statusCode < 200 || response.statusCode >= 400) return null;
    if (this.source.fetchMode === "playwright") return "registry-playwright-source";
    // Scripts that parsed cleanly and carried no Recipe node are a definitive
    // answer from the server: this page is not a recipe. Rendering it again
    // cannot change that, and on article-heavy sitemaps it costs hours.
    if (
      extraction.rawScripts.length > 0 &&
      extraction.incompleteJsonLdCount === 0 &&
      extraction.malformedJsonLdCount === 0
    ) {
      return null;
    }
    if (extraction.rawScripts.length > 0) return "incomplete-or-malformed-json-ld";
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
    // Templates emit junk here: a base glued onto an absolute URL, or a tag
    // list where a URL belongs. Both parse, into hosts that cannot exist, so
    // they are discarded in favour of the already-validated request URL rather
    // than read as cross-site canonicals that invalidate the whole source.
    const unusable = canonical ? unusableCanonicalReason(canonical) : null;
    if (unusable) {
      this.emit("canonical-ignored", { reason: unusable, url: response.url });
      return canonicalizeUrl(response.url);
    }
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

/** Names why a canonical href cannot be a real URL, or null if it looks fine. */
/** The status a paginated service answers with once past its last page. */
const TERMINAL_PAYLOAD_STATUS = 400;

function unusableCanonicalReason(canonical: string): string | null {
  if (/:\/\/[^\s]*:\/\//u.test(canonical)) return "concatenated-href";
  let hostname: string;
  try {
    hostname = new URL(canonical, "https://placeholder.invalid").hostname;
  } catch {
    return "unparsable-href";
  }
  // Hostnames are letters, digits, hyphens and dots once the URL parser has
  // encoded them. Anything else means this was never a hostname.
  if (hostname && !/^[a-z0-9.-]+$/u.test(hostname)) return "not-a-hostname";
  return null;
}

function isSourceOutcomeReason(value: string): value is SourceOutcomeReason {
  return [
    "malformed-listing-payload",
    "unexpected-listing-shape",
    "http-200-block-shell",
    "sitemap-not-xml",
    "script-gated-continuation",
    "listing-window-exhausted",
    "vpn-relay-pool-exhausted",
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
