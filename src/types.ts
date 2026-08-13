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
  respectRobotsTxt: boolean;
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
  extractionMethod: "json-ld" | "html-parsing" | "partial" | "failed";
  extractorVersion: string;
  extractionConfidence: number;
  extractionSignals: string[];
  recipeCount: number;
  rawHtml?: Binary;
  /** Exact application/ld+json script bodies, each compressed independently. */
  rawJsonLdScripts?: Binary[];
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
  extractionMethod: "json-ld";
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
  | "playwright-failure"
  | "mongo-failure"
  | "discovery-incomplete"
  | "no-recipe-candidates";

export interface SourceRunOutcomeSummary {
  sourceId: string;
  outcome: SourceRunOutcome;
  outcomeReasons: SourceOutcomeReason[];
}

export interface DanishJsonLdRunSummary {
  /** Deliberately explicit until crawler-factory enforcement is added. */
  robotsEnforced: false;
  sourceOutcomes: SourceRunOutcomeSummary[];
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
