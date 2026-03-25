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
import { LinkFilter } from "../discovery/link-filter.js";
import type { ExtractionResult } from "../types.js";
import { gzipSync } from "zlib";
import { Binary } from "mongodb";
import * as cheerio from "cheerio";

interface CreatePlaywrightCrawlerOptions {
  store: RecipeStore;
  playwrightQueue: RequestQueue;
  linkFilter: LinkFilter;
}

export function createPlaywrightCrawlerInstance(
  options: CreatePlaywrightCrawlerOptions
) {
  const { store, playwrightQueue, linkFilter } = options;
  const router = createPlaywrightRouter();

  router.addDefaultHandler(async ({ request, page, enqueueLinks }) => {
    const requestUrl = request.loadedUrl ?? request.url;
    const domain = new URL(requestUrl).hostname;

    await page.waitForLoadState("networkidle");

    const html = await page.content();

    const canonicalTag = await page
      .locator('link[rel="canonical"]')
      .first()
      .getAttribute("href")
      .catch(() => null);
    let canonicalUrl: string;
    try {
      canonicalUrl = canonicalTag
        ? canonicalizeUrl(canonicalTag, requestUrl)
        : canonicalizeUrl(requestUrl);
    } catch {
      canonicalUrl = canonicalizeUrl(requestUrl);
    }

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

    // Collect outbound recipe links from rendered page
    const $ = extraction.method !== "json-ld" ? cheerio.load(html) : null;
    const $forLinks = $ ?? cheerio.load(html);
    const outboundRecipeLinks: string[] = [];
    $forLinks("a[href]").each((_i, el) => {
      const href = $forLinks(el).attr("href");
      if (!href) return;
      try {
        const absolute = new URL(href, requestUrl).toString();
        const canonical = canonicalizeUrl(absolute);
        if (linkFilter.isRecipeLikeUrl(canonical)) {
          outboundRecipeLinks.push(canonical);
        }
      } catch {
        // Invalid URL
      }
    });

    await store.upsertPage({
      canonicalUrl,
      domain,
      fetchedAt: new Date(),
      httpStatus: 200,
      fetchMode: "playwright",
      extractionMethod: extraction.method,
      extractorVersion: EXTRACTOR_VERSION,
      extractionConfidence: extraction.confidence,
      extractionSignals: extraction.signals,
      recipeCount: extraction.recipes.length,
      rawHtml: shouldStoreHtml
        ? new Binary(gzipSync(Buffer.from(html)))
        : undefined,
      pageContentHash,
      outboundRecipeLinks,
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

    // Discover and enqueue links from Playwright-rendered page
    await enqueueLinks({
      strategy: "all",
      transformRequestFunction: (req) => {
        try {
          const canonical = canonicalizeUrl(req.url, requestUrl);
          if (!linkFilter.shouldEnqueue(canonical)) return false;
          if (!linkFilter.isRecipeLikeUrl(canonical)) return false;
          linkFilter.recordEnqueued();
          req.url = canonical;
          req.uniqueKey = canonical;
          return req;
        } catch {
          return false;
        }
      },
    });
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
        fetchMode: "playwright",
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
