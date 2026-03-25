// src/crawlers/playwright-crawler.ts
import {
  PlaywrightCrawler,
  createPlaywrightRouter,
  log,
  type RequestQueue,
} from "crawlee";
import { extractJsonLdRecipes } from "../extractors/json-ld.js";
import { extractHtmlFallback } from "../extractors/html-fallback.js";
import { canonicalizeUrl } from "../utils/canonicalize.js";
import { hashRecipe, hashHtml } from "../utils/hash.js";
import { RecipeStore } from "../storage/mongodb.js";
import { PLAYWRIGHT_CONFIG, EXTRACTOR_VERSION } from "../config.js";
import type { ExtractionResult } from "../types.js";
import { gzipSync } from "zlib";
import { Binary } from "mongodb";
import * as cheerio from "cheerio";

interface CreatePlaywrightCrawlerOptions {
  store: RecipeStore;
  playwrightQueue: RequestQueue;
}

export function createPlaywrightCrawlerInstance(
  options: CreatePlaywrightCrawlerOptions
) {
  const { store, playwrightQueue } = options;
  const router = createPlaywrightRouter();

  router.addDefaultHandler(async ({ request, page }) => {
    const requestUrl = request.loadedUrl ?? request.url;
    const domain = new URL(requestUrl).hostname;

    await page.waitForLoadState("networkidle");

    const html = await page.content();

    const canonicalTag = await page
      .locator('link[rel="canonical"]')
      .first()
      .getAttribute("href")
      .catch(() => null);
    const canonicalUrl = canonicalTag
      ? canonicalizeUrl(canonicalTag)
      : canonicalizeUrl(requestUrl);

    let extraction: ExtractionResult;
    const jsonLdResult = extractJsonLdRecipes(html);

    if (jsonLdResult.recipes.length > 0) {
      extraction = {
        recipes: jsonLdResult.recipes,
        method: "json-ld",
        confidence: 1.0,
        signals: [...jsonLdResult.signals, "playwright-js-rendered"],
      };
    } else {
      const $ = cheerio.load(html);
      const htmlResult = extractHtmlFallback($);
      if (htmlResult.recipes.length > 0) {
        extraction = {
          recipes: htmlResult.recipes,
          method: "html-parsing",
          confidence: htmlResult.confidence,
          signals: [
            ...htmlResult.signals,
            "playwright-fallback",
            "playwright-js-rendered",
          ],
        };
      } else {
        extraction = {
          recipes: [],
          method: "partial",
          confidence: 0,
          signals: ["playwright-fallback", "playwright-js-rendered"],
        };
      }
    }

    const pageContentHash = hashHtml(html);
    const shouldStoreHtml = extraction.method !== "json-ld";

    log.info(
      `Playwright extracted ${extraction.recipes.length} recipes from ${canonicalUrl}`
    );

    await store.upsertPage({
      canonicalUrl,
      domain,
      fetchedAt: new Date(),
      httpStatus: 200,
      extractionMethod: extraction.method,
      extractorVersion: EXTRACTOR_VERSION,
      extractionConfidence: extraction.confidence,
      extractionSignals: extraction.signals,
      recipeCount: extraction.recipes.length,
      rawHtml: shouldStoreHtml
        ? new Binary(gzipSync(Buffer.from(html)))
        : undefined,
      pageContentHash,
      outboundRecipeLinks: [],
    });

    for (const rawRecipe of extraction.recipes) {
      const recipeObj = rawRecipe as Record<string, unknown>;
      const contentHash = hashRecipe(recipeObj);
      await store.insertRecipe({
        pageUrl: canonicalUrl,
        domain,
        extractedAt: new Date(),
        extractionMethod: extraction.method as
          | "json-ld"
          | "html-parsing"
          | "partial",
        extractorVersion: EXTRACTOR_VERSION,
        extractionConfidence: extraction.confidence,
        rawRecipe: recipeObj,
        extractionSignals: extraction.signals,
        contentHash,
        sourceHash: contentHash,
      });
    }
  });

  return new PlaywrightCrawler({
    requestQueue: playwrightQueue,
    requestHandler: router,
    maxConcurrency: PLAYWRIGHT_CONFIG.maxConcurrency,
    maxRequestsPerMinute: PLAYWRIGHT_CONFIG.maxRequestsPerMinute,
    maxRequestRetries: PLAYWRIGHT_CONFIG.maxRequestRetries,
    launchContext: {
      launchOptions: {
        headless: true,
      },
    },
    async failedRequestHandler({ request }, error) {
      const requestUrl = request.url;
      const domain = new URL(requestUrl).hostname;
      log.error(`Playwright failed after retries: ${requestUrl} - ${error.message}`);
      await store.upsertPage({
        canonicalUrl: canonicalizeUrl(requestUrl),
        domain,
        fetchedAt: new Date(),
        httpStatus: 0,
        extractionMethod: "failed",
        extractorVersion: EXTRACTOR_VERSION,
        extractionConfidence: 0,
        extractionSignals: ["playwright-fallback"],
        recipeCount: 0,
        pageContentHash: "",
        outboundRecipeLinks: [],
      });
    },
  });
}
