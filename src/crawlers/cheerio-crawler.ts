// src/crawlers/cheerio-crawler.ts
import {
  CheerioCrawler,
  createCheerioRouter,
  type RequestQueue,
  log,
} from "crawlee";
import { extractJsonLdRecipes } from "../extractors/json-ld.js";
import { extractHtmlFallback } from "../extractors/html-fallback.js";
import { canonicalizeUrl } from "../utils/canonicalize.js";
import { hashRecipe, hashHtml } from "../utils/hash.js";
import { LinkFilter } from "../discovery/link-filter.js";
import { RecipeStore } from "../storage/mongodb.js";
import {
  CHEERIO_CONFIG,
  EXTRACTOR_VERSION,
  DANISH_KEYWORDS,
  JS_FRAMEWORK_MARKERS,
  MIN_BODY_TEXT_LENGTH,
} from "../config.js";
import type { ExtractionResult } from "../types.js";
import { gzipSync } from "zlib";
import { Binary } from "mongodb";

interface CreateCheerioCrawlerOptions {
  store: RecipeStore;
  linkFilter: LinkFilter;
  playwrightQueue: RequestQueue;
  cheerioQueue: RequestQueue;
  seedDomains: Map<string, { requiresJs: boolean }>;
}

export function createCheerioCrawlerInstance(
  options: CreateCheerioCrawlerOptions
) {
  const { store, linkFilter, playwrightQueue, cheerioQueue, seedDomains } =
    options;
  const router = createCheerioRouter();

  router.addDefaultHandler(async ({ request, $, body, enqueueLinks, response }) => {
    const html = typeof body === "string" ? body : body.toString();
    const requestUrl = request.loadedUrl ?? request.url;
    const domain = new URL(requestUrl).hostname;

    // Dynamic canonicalization — handle relative canonical tags
    const canonicalTag = $('link[rel="canonical"]').attr("href");
    let canonicalUrl: string;
    try {
      canonicalUrl = canonicalTag
        ? canonicalizeUrl(canonicalTag, requestUrl)
        : canonicalizeUrl(requestUrl);
    } catch {
      canonicalUrl = canonicalizeUrl(requestUrl);
    }

    linkFilter.recordPageCrawled(domain);

    let extraction: ExtractionResult;
    const jsonLdResult = extractJsonLdRecipes(html);

    if (jsonLdResult.recipes.length > 0) {
      extraction = {
        recipes: jsonLdResult.recipes,
        method: "json-ld",
        confidence: 1.0,
        signals: jsonLdResult.signals,
      };
    } else {
      const htmlResult = extractHtmlFallback($);
      if (htmlResult.recipes.length > 0) {
        extraction = {
          recipes: htmlResult.recipes,
          method: "html-parsing",
          confidence: htmlResult.confidence,
          signals: htmlResult.signals,
        };
      } else {
        extraction = {
          recipes: [],
          method: "partial",
          confidence: 0,
          signals: htmlResult.signals,
        };
      }
    }

    const needsPlaywright = shouldFallbackToPlaywright(
      $,
      html,
      extraction,
      request.userData?.["fromSitemap"] === true
    );

    if (needsPlaywright && extraction.recipes.length === 0) {
      log.info(`Enqueueing to Playwright: ${canonicalUrl}`);
      await playwrightQueue.addRequest({
        url: requestUrl,
        uniqueKey: canonicalizeUrl(requestUrl),
        userData: { ...request.userData, playwrightRetry: true },
      });
    }

    const shouldStoreHtml =
      extraction.method !== "json-ld" || extraction.confidence < 0.5;

    const pageContentHash = hashHtml(html);

    const outboundRecipeLinks: string[] = [];
    $("a[href]").each((_i, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      try {
        const absolute = new URL(href, requestUrl).toString();
        const canonical = canonicalizeUrl(absolute);
        if (linkFilter.isRecipeLikeUrl(canonical)) {
          outboundRecipeLinks.push(canonical);
        }
      } catch {
        // Invalid URL, skip
      }
    });

    await store.upsertPage({
      canonicalUrl,
      domain,
      fetchedAt: new Date(),
      httpStatus: response.statusCode ?? 200,
      fetchMode: "cheerio",
      redirectChain:
        request.loadedUrl && request.loadedUrl !== request.url
          ? [request.url, request.loadedUrl]
          : undefined,
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

    const pageHasDanishRecipe =
      extraction.recipes.length > 0 &&
      (domain.endsWith(".dk") ||
        DANISH_KEYWORDS.some((kw) => html.toLowerCase().includes(kw)));

    const isRecipePage = extraction.recipes.length > 0;
    const currentNonRecipeHops =
      (request.userData?.["nonRecipeHops"] as number) ?? 0;

    await enqueueLinks({
      strategy: "all",
      transformRequestFunction: (req) => {
        try {
          const absUrl = new URL(req.url, requestUrl).toString();
          const canonical = canonicalizeUrl(absUrl);
          const isRecipeLink = linkFilter.isRecipeLikeUrl(canonical);

          if (
            !linkFilter.shouldFollowLink(
              canonical,
              isRecipePage,
              isRecipeLink,
              currentNonRecipeHops
            )
          ) {
            return false;
          }

          const shouldQueue = linkFilter.shouldEnqueue(canonical, {
            isDanishRecipe: pageHasDanishRecipe,
          });
          if (!shouldQueue) return false;

          const linkDomain = new URL(canonical).hostname;
          const seedConfig = seedDomains.get(linkDomain);
          if (seedConfig?.requiresJs) {
            playwrightQueue.addRequest({
              url: canonical,
              uniqueKey: canonical,
              userData: { fromRecipePage: isRecipePage, nonRecipeHops: 0 },
            }).catch((err) =>
              log.warning(`Failed to enqueue to Playwright: ${err}`)
            );
            return false;
          }

          linkFilter.recordEnqueued();
          req.url = canonical;
          req.uniqueKey = canonical;
          req.userData = {
            fromRecipePage: isRecipePage,
            nonRecipeHops: isRecipeLink ? 0 : currentNonRecipeHops + 1,
          };
          return req;
        } catch {
          return false;
        }
      },
    });
  });

  return new CheerioCrawler({
    requestQueue: cheerioQueue,
    requestHandler: router,
    maxConcurrency: CHEERIO_CONFIG.maxConcurrency,
    maxRequestsPerMinute: CHEERIO_CONFIG.maxRequestsPerMinute,
    maxRequestRetries: CHEERIO_CONFIG.maxRequestRetries,
    async failedRequestHandler({ request }, error) {
      const requestUrl = request.url;
      const domain = new URL(requestUrl).hostname;
      log.error(`Failed after retries: ${requestUrl} - ${error.message}`);
      await store.upsertPage({
        canonicalUrl: canonicalizeUrl(requestUrl),
        domain,
        fetchedAt: new Date(),
        httpStatus: 0,
        fetchMode: "cheerio",
        extractionMethod: "failed",
        extractorVersion: EXTRACTOR_VERSION,
        extractionConfidence: 0,
        extractionSignals: [],
        recipeCount: 0,
        pageContentHash: "",
        outboundRecipeLinks: [],
      });
    },
  });
}

function shouldFallbackToPlaywright(
  $: ReturnType<typeof import("cheerio").load>,
  html: string,
  extraction: ExtractionResult,
  fromSitemap: boolean
): boolean {
  if (extraction.recipes.length > 0) return false;
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  if (bodyText.length < MIN_BODY_TEXT_LENGTH) return true;
  if (JS_FRAMEWORK_MARKERS.some((marker) => html.includes(marker)))
    return true;
  if (fromSitemap) return true;
  return false;
}
