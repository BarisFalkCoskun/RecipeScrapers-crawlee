import { Binary, ObjectId } from "mongodb";

export type SeedAdmissionRole = "trusted";

export type DiscoverySource =
  | "seed-root"
  | "sitemap"
  | "discovered"
  | "playwright-fallback";

export interface SeedConfig {
  domain: string;
  sitemapUrl?: string;
  sitemapUrls?: string[];
  startUrls?: string[];
  requiresJs: boolean;
  maxPages: number;
  admissionRole: SeedAdmissionRole;
}

export interface FetchModeCounters {
  cheerio: number;
  playwright: number;
}

export interface PageDocument {
  _id?: ObjectId;
  canonicalUrl: string;
  domain: string;
  language: string;
  languageConfidence: number;
  languageSignals: string[];
  fetchedAt: Date;
  httpStatus: number;
  fetchMode: "cheerio" | "playwright";
  redirectChain?: string[];
  extractionMethod: "json-ld" | "wprm-api" | "embedded-json" | "html-parsing" | "api-json" | "partial" | "failed";
  extractorVersion: string;
  extractionConfidence: number;
  extractionSignals: string[];
  recipeCount: number;
  rawHtml?: Binary;
  /** Exact application/ld+json script bodies, each compressed independently. */
  rawJsonLdScripts?: Binary[];
  /** Exact WPRM API response body, compressed for source provenance. */
  rawApiPayload?: Binary;
  pageContentHash: string;
  discoverySource: DiscoverySource;
  sourceDomain?: string;
  admissionSignals: string[];
  playwrightFallbackReason?: string;
  sitemapLastmod?: Date;
  etag?: string;
  lastModified?: string;
  outboundRecipeLinks: string[];
}

export interface RecipeDocument {
  _id?: ObjectId;
  pageUrl: string;
  domain: string;
  language: string;
  languageConfidence: number;
  languageSignals: string[];
  extractedAt: Date;
  extractionMethod: "json-ld" | "html-parsing" | "partial";
  extractorVersion: string;
  extractionConfidence: number;
  rawRecipe: Record<string, unknown>;
  extractionSignals: string[];
  contentHash: string;
  sourceHash: string;
}

export interface NormalizedRecipeInstruction {
  position: number;
  text: string;
}

export interface NormalizedRecipeV2 {
  title: string;
  description?: string;
  ingredients: string[];
  instructions: NormalizedRecipeInstruction[];
  prepMinutes?: number;
  cookMinutes?: number;
  totalMinutes?: number;
  yieldText?: string;
  imageUrls: string[];
  categories: string[];
  cuisines: string[];
  keywords: string[];
  nutrition?: Record<string, unknown>;
}

export interface RecipeContentMatch {
  kind: "same-source" | "cross-source";
  sourceId: string;
  sourceRecipeKey: string;
}

export interface RecipeContentMatchAudit {
  _id?: ObjectId;
  contentHash: string;
  sourceRecipeKeyA: string;
  sourceRecipeKeyB: string;
  sourceIdA: string;
  sourceIdB: string;
  kind: "same-source" | "cross-source";
}

/**
 * The migration-only recipe shape. It intentionally coexists with RecipeDocument
 * until the legacy crawler has been cut over.
 */
export interface RecipeDocumentV2 {
  _id?: ObjectId;
  schemaVersion: 2;
  sourceId: string;
  sourceRecipeKey: string;
  canonicalUrl: string;
  pageUrl: string;
  crawlRunId: string;
  crawlAttemptId: string;
  createdAt: Date;
  updatedAt: Date;
  extractedAt: Date;
  language: string;
  languageConfidence: number;
  languageSignals: string[];
  extractionMethod: "json-ld" | "wprm-api" | "embedded-json" | "html-parsing" | "api-json";
  extractorVersion: string;
  extractionConfidence: number;
  extractionSignals: string[];
  /** The exact JSON.parse result, never the normalized copy. */
  rawRecipe: Record<string, unknown>;
  normalized: NormalizedRecipeV2;
  sourceHash: string;
  contentHash: string;
  contentMatches: RecipeContentMatch[];
}

export type SourceRunOutcome =
  | "succeeded"
  | "partial"
  | "blocked"
  | "no_data"
  | "failed";

export type SourceOutcomeReason =
  | "recipes-persisted"
  | "failed-requests"
  | "requests-blocked"
  | "recipe-candidates-discovered"
  | "incomplete-json-ld-rejected"
  | "malformed-json-ld-rejected"
  | "incomplete-wprm-rejected"
  | "malformed-wprm-rejected"
  | "incomplete-custom-recipe-rejected"
  | "malformed-custom-payload-rejected"
  | "playwright-failure"
  | "mongo-failure"
  | "max-pages-cap-reached"
  | "discovery-incomplete"
  | "malformed-listing-payload"
  | "truncated-listing-payload"
  | "unexpected-listing-shape"
  | "http-200-block-shell"
  | "script-gated-continuation"
  | "listing-window-exhausted"
  | "vpn-relay-pool-exhausted"
  | "loaded-url-domain-not-allowed"
  | "canonical-domain-not-allowed"
  | "structured-extraction-empty"
  | "no-recipe-candidates";

export interface SourceRunOutcomeSummary {
  sourceId: string;
  outcome: SourceRunOutcome;
  outcomeReasons: SourceOutcomeReason[];
}

export interface DanishJsonLdRunSummary {
  /** Global invariant: crawler factories never enforce robots.txt. */
  robotsEnforced: false;
  sourceOutcomes: SourceRunOutcomeSummary[];
}

/**
 * Dedicated-run record sharing the native crawl_runs collection with the
 * legacy crawler. The discriminator prevents consumers from treating this as
 * a legacy metrics summary.
 */
export interface DanishJsonLdCrawlRunDocument {
  _id?: ObjectId;
  kind: "danish-jsonld-v2" | "danish-wprm-v2" | "danish-recipe-v2";
  schemaVersion: 2;
  crawlRunId: string;
  startedAt: Date;
  finishedAt: Date;
  sourceIds: string[];
  summary: DanishJsonLdRunSummary;
  observations: unknown[];
}

export interface ExtractionResult {
  recipes: Record<string, unknown>[];
  method: "json-ld" | "html-parsing" | "partial";
  confidence: number;
  signals: string[];
}

export interface SitemapEntry {
  url: string;
  lastmod?: Date;
}

export interface DomainMetricsSummary {
  domain: string;
  processedPages: number;
  recipePages: number;
  extractedRecipes: number;
  recipeLanguages: Record<string, number>;
  recrawlSkips: number;
  fallbacksEnqueued: number;
  offDomainAdmissions: number;
  blockedUrlReasons: Record<string, number>;
  processedByMode: FetchModeCounters;
  recrawlSkipsByMode: FetchModeCounters;
  recipePageYield: number;
  fallbackRate: number;
}

export interface CrawlMetricsSummary {
  processedPages: number;
  recipePages: number;
  extractedRecipes: number;
  recipeLanguages: Record<string, number>;
  recrawlSkips: number;
  fallbacksEnqueued: number;
  offDomainAdmissions: number;
  blockedUrlReasons: Record<string, number>;
  processedByMode: FetchModeCounters;
  recrawlSkipsByMode: FetchModeCounters;
  recipePageYield: number;
  fallbackRate: number;
  newlyAdmittedDomains: string[];
  playwrightFallbacksByReason: Record<string, number>;
  domains: DomainMetricsSummary[];
}

export interface CrawlRunDocument {
  _id?: ObjectId;
  startedAt: Date;
  finishedAt: Date;
  recrawlCutoff: Date;
  seeds: string[];
  summary: CrawlMetricsSummary;
}
