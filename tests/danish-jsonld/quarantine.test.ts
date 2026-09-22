import { describe, expect, it, vi } from "vitest";
import { gunzipSync } from "node:zlib";
import { DanishJsonLdSourceSession } from "../../src/danish-jsonld/crawler.js";
import { extractWprmRecipes } from "../../src/wprm/recipe-document.js";
import type { DanishJsonLdSource } from "../../src/danish-jsonld/source-registry.js";
import type { CrawlStore, RecipeDocumentV2Store } from "../../src/storage/store.js";

const source: DanishJsonLdSource = {
  id: "fixture", domain: "example.dk", allowedDomains: ["example.dk"], legacySpider: "Fixture", legacyFamily: "JsonLdSitemapRecipeSpider",
  discovery: "sitemap", sitemapUrls: [], startUrls: [], recipeUrlPatterns: ["/recipe/"], fetchMode: "cheerio",
  requestSettings: { delaySeconds: 0, maxConcurrency: 1, maxRetries: 0, rateLimitPerMinute: null },
  requireCompleteJsonLd: true, migrationState: "configured", latestScrapyOutcome: "not_audited",
};
const complete = { "@type": "Recipe", name: "Kage", recipeIngredient: ["100 g mel"], recipeInstructions: ["Bag."] };

describe("recipe rejection evidence", () => {
  it("preserves incomplete nodes and exact field reasons without publishing them", async () => {
    const save = vi.fn(async () => {});
    const publish = vi.fn(async () => ({ operation: "inserted" as const, contentMatches: [] }));
    const session = new DanishJsonLdSourceSession({ source,
      store: { upsertPage: async () => {}, upsertRejectedCandidate: save, upsertRecipeV2: publish } as unknown as CrawlStore & RecipeDocumentV2Store,
      crawlRunId: "run", crawlAttemptId: "attempt", maxPages: 10 });
    const incomplete = { ...complete, recipeInstructions: null };
    await session.handleResponse({ kind: "recipe", fetchMode: "playwright", url: "https://example.dk/recipe/kage", statusCode: 200, headers: {},
      body: `<script type="application/ld+json">${JSON.stringify([complete, incomplete])}</script>` });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ rawRecipe: incomplete, reasons: ["missing-instructions"],
      diagnosis: "incomplete-structured-data", sourceId: "fixture", crawlRunId: "run" }));
    expect(session.observation.quarantinedCandidates).toBe(1);
    expect(session.observation.rejectedIncompleteJsonLd).toBe(1);
  });
  it("retains malformed source bytes for diagnosis and surfaces quarantine storage failures", async () => {
    const save = vi.fn(async () => {});
    const store = { upsertPage: async () => {}, upsertRejectedCandidate: save } as unknown as CrawlStore & RecipeDocumentV2Store;
    const session = new DanishJsonLdSourceSession({ source, store, crawlRunId: "run", crawlAttemptId: "attempt", maxPages: 10 });
    const body = '<script type="application/ld+json">{broken</script>';
    const response = { kind: "recipe" as const, fetchMode: "playwright" as const, url: "https://example.dk/recipe/broken", statusCode: 200, headers: {}, body };
    await session.handleResponse(response);
    const candidate = save.mock.calls[0][0];
    expect(candidate.reasons).toContain("malformed-json-ld");
    expect(gunzipSync(candidate.rawPayload.buffer).toString()).toBe(body);
    save.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(session.handleResponse(response)).rejects.toThrow(/Rejected candidate persistence failed/);
    expect(session.observation.mongoFailures).toBe(1);
  });
  it("keeps the rejected WPRM object rather than inventing missing fields", () => {
    const post = { id: 42, link: "https://example.dk/recipe/42", recipe: { name: "Kage", ingredients: [], instructions: [] } };
    const result = extractWprmRecipes([post]);
    expect(result.recipes).toEqual([]);
    expect(result.rejectedCandidates).toEqual([{ rawRecipe: post, reasons: ["missing-ingredients", "missing-instructions"] }]);
  });
});
