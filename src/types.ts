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
