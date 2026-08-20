import { describe, expect, it } from "vitest";
import {
  buildEmbeddedRecipeDocumentV2,
  extractSpisbedreRecipe,
} from "../../src/custom/spisbedre.js";
import { DanishJsonLdSourceSession } from "../../src/danish-jsonld/crawler.js";
import type { DanishJsonLdSource } from "../../src/danish-jsonld/source-registry.js";
import type { CrawlStore, RecipeDocumentV2Store } from "../../src/storage/store.js";
import type {
  CrawlRunDocument,
  DanishJsonLdCrawlRunDocument,
  PageDocument,
  RecipeDocument,
  RecipeDocumentV2,
} from "../../src/types.js";

const rawRecipe = {
  id: 42,
  url: "https://spisbedre.dk/opskrifter/kage",
  title: "<strong>Kage</strong>",
  description: "En god kage",
  preparation_time: 10,
  cooking_time: 20,
  total_time: 30,
  serving_size: 4,
  serving_size_type: { name_plural: "personer" },
  grouped_ingredients: [{
    title: "Dej",
    ingredients: [{
      amount: 2,
      unit: { abbreviation: "stk." },
      ingredient_inflection: "plural",
      ingredient: { name_singular: "æg", name_plural: "æg" },
    }, {
      amount: null,
      unit: null,
      ingredient_inflection: "default",
      ingredient: { name_singular: "salt", name_plural: "salt" },
    }],
  }],
  grouped_instructions: [{
    title: "Bagning",
    instructions: [{ instruction: "<p>Bag <em>kagen</em>.</p>" }],
  }],
  tags: [
    { name: "Dessert", group: { name: "Måltid" } },
    { name: "Nem" },
  ],
  media: { raw_url: "https://spisbedre.dk/kage.jpg" },
  nutrition: { calories: 300, protein: 5 },
};

function pageHtml(recipe: Record<string, unknown> = rawRecipe): string {
  const encoded = JSON.stringify({ props: { recipe } })
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;");
  return `<html lang="da"><body><div id="app" data-page="${encoded}"></div></body></html>`;
}

class MemoryStore implements CrawlStore, RecipeDocumentV2Store {
  pages: Array<Omit<PageDocument, "_id">> = [];
  recipes: Array<Omit<RecipeDocumentV2, "_id">> = [];
  async upsertPage(page: Omit<PageDocument, "_id">): Promise<void> { this.pages.push(page); }
  async upsertRecipeV2(recipe: Omit<RecipeDocumentV2, "_id">) {
    this.recipes.push(recipe);
    return { operation: "inserted" as const, contentMatches: [] };
  }
  async insertRecipe(_recipe: Omit<RecipeDocument, "_id">): Promise<void> {}
  async wasPageFetchedSince(): Promise<boolean> { return false; }
  async findFreshPageUrls(): Promise<Set<string>> { return new Set(); }
  async insertCrawlRun(_run: Omit<CrawlRunDocument, "_id">): Promise<void> {}
  async insertDanishJsonLdRun(
    _run: Omit<DanishJsonLdCrawlRunDocument, "_id">
  ): Promise<void> {}
}

const source: DanishJsonLdSource = {
  id: "spisbedre",
  domain: "spisbedre.dk",
  allowedDomains: ["spisbedre.dk"],
  legacySpider: "SpisbedreSpider",
  legacyFamily: "EmbeddedJsonSitemapSpider",
  discovery: "sitemap",
  sitemapUrls: ["https://spisbedre.dk/opskrifter/sitemap.xml"],
  startUrls: [],
  recipeUrlPatterns: ["^https://spisbedre\\.dk/opskrifter/"],
  sitemapDiscovery: { followPatterns: [], skipUrlFragments: [] },
  fetchMode: "cheerio",
  requestSettings: {
    delaySeconds: 2,
    rateLimitPerMinute: null,
    maxConcurrency: 2,
    maxRetries: 3,
  },
  requireCompleteJsonLd: true,
  recipeExtractor: "spisbedre-inertia",
  migrationState: "not_started",
  latestScrapyOutcome: "not_audited",
};

describe("Spis Bedre embedded recipe adapter", () => {
  it("normalizes the Inertia data-page recipe and builds stable V2 identity", () => {
    const extraction = extractSpisbedreRecipe(
      pageHtml(),
      "https://spisbedre.dk/opskrifter/kage"
    );
    expect(extraction).toMatchObject({ incompleteCount: 0, malformedCount: 0 });
    expect(extraction.recipe?.normalized).toEqual({
      title: "Kage",
      description: "En god kage",
      ingredients: ["2 stk. æg", "salt"],
      instructions: [{ position: 1, text: "Bagning: Bag kagen." }],
      prepMinutes: 10,
      cookMinutes: 20,
      totalMinutes: 30,
      yieldText: "4 personer",
      imageUrls: ["https://spisbedre.dk/kage.jpg"],
      categories: ["Dessert"],
      cuisines: [],
      keywords: ["Nem"],
      nutrition: { calories: 300, protein: 5 },
    });
    const input = {
      sourceId: "spisbedre",
      crawlRunId: "run",
      crawlAttemptId: "attempt",
      pageUrl: "https://spisbedre.dk/opskrifter/kage",
      extractedAt: new Date("2026-08-19T00:00:00Z"),
      recipe: extraction.recipe!,
      language: "da",
      languageConfidence: 1,
      languageSignals: ["html-lang"],
      extractorVersion: "test",
      extractionSignals: ["spisbedre-inertia-data-page"],
    };
    expect(buildEmbeddedRecipeDocumentV2(input).sourceRecipeKey)
      .toBe(buildEmbeddedRecipeDocumentV2({ ...input, crawlRunId: "other" }).sourceRecipeKey);
  });

  it("persists through the source session without attempting JSON-LD fallback", async () => {
    const store = new MemoryStore();
    const session = new DanishJsonLdSourceSession({
      source,
      store,
      crawlRunId: "run",
      crawlAttemptId: "attempt",
      maxPages: 2,
    });
    const routes = await session.handleResponse({
      kind: "recipe",
      fetchMode: "cheerio",
      url: "https://spisbedre.dk/opskrifter/kage",
      statusCode: 200,
      headers: { "content-type": "text/html" },
      body: pageHtml(),
    });

    expect(routes).toEqual({ cheerioRequests: [], playwrightRequests: [] });
    expect(store.pages[0]).toMatchObject({
      extractionMethod: "embedded-json",
      recipeCount: 1,
    });
    expect(store.recipes[0]).toMatchObject({
      extractionMethod: "embedded-json",
      canonicalUrl: "https://spisbedre.dk/opskrifter/kage",
    });
    expect(session.observation).toMatchObject({
      persistedRecipes: 1,
      rejectedIncompleteCustom: 0,
      rejectedMalformedCustom: 0,
    });
  });
});
