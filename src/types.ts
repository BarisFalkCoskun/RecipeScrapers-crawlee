import { Binary, ObjectId } from "mongodb";

export interface SeedConfig {
  domain: string;
  sitemapUrl: string;
  requiresJs: boolean;
  respectRobotsTxt: boolean;
  maxPages: number;
}

export interface PageDocument {
  _id?: ObjectId;
  canonicalUrl: string;
  domain: string;
  fetchedAt: Date;
  httpStatus: number;
  redirectChain?: string[];
  extractionMethod: "json-ld" | "html-parsing" | "partial" | "failed";
  extractorVersion: string;
  extractionConfidence: number;
  extractionSignals: string[];
  recipeCount: number;
  rawHtml?: Binary;
  pageContentHash: string;
  sitemapLastmod?: Date;
  etag?: string;
  lastModified?: string;
  outboundRecipeLinks: string[];
}

export interface RecipeDocument {
  _id?: ObjectId;
  pageUrl: string;
  domain: string;
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
