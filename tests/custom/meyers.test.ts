import { describe, expect, it } from "vitest";
import { extractMeyersRecipes, MEYERS_SANITY_URL } from "../../src/custom/meyers.js";
import { DanishJsonLdSourceSession } from "../../src/danish-jsonld/crawler.js";
import { DANISH_JSONLD_SOURCES } from "../../src/danish-jsonld/source-registry.js";
import type { CrawlStore, RecipeDocumentV2Store } from "../../src/storage/store.js";
import type {
  CrawlRunDocument,
  DanishJsonLdCrawlRunDocument,
  PageDocument,
  RecipeDocument,
  RecipeDocumentV2,
} from "../../src/types.js";

const recipe = {
  _id: "recipe-42",
  title: "Svampetoast",
  slug: { current: "svampetoast" },
  description: "En <strong>sprød</strong> toast.",
  prepTime: 10,
  cookTime: 15,
  setting: 4,
  settingUnit: { plural: "personer" },
  ingredientGroups: [{
    title: "Toast",
    ingredients: [{
      amount: 250,
      beforeText: "ca.",
      afterText: "rensede",
      ingredient: { name: "svampe" },
      unit: { abbreviation: "g" },
    }],
  }],
  instructions: [{ title: "Tilberedning", steps: ["Steg svampene.", "Servér."] }],
  tags: [
    { name: "Frokost", category: "meal" },
    { name: "Vegetarisk", category: "diet" },
  ],
  image: { asset: { url: "https://cdn.sanity.io/svampetoast.jpg" } },
};

class MemoryStore implements CrawlStore, RecipeDocumentV2Store {
  pages: Array<Omit<PageDocument, "_id">> = [];
  recipes: Array<Omit<RecipeDocumentV2, "_id">> = [];
  async upsertPage(page: Omit<PageDocument, "_id">): Promise<void> { this.pages.push(page); }
  async upsertRecipeV2(document: Omit<RecipeDocumentV2, "_id">) {
    this.recipes.push(document);
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

describe("Meyers Sanity recipe adapter", () => {
  it("normalizes grouped Sanity recipes and rejects incomplete records", () => {
    const extraction = extractMeyersRecipes(JSON.stringify({
      result: [recipe, { ...recipe, _id: "incomplete", instructions: [] }],
    }));

    expect(extraction).toMatchObject({ incompleteCount: 1, malformedCount: 0 });
    expect(extraction.recipes[0]).toMatchObject({
      canonicalUrl: "https://www.meyers.dk/opskrifter/svampetoast",
      normalized: {
        title: "Svampetoast",
        description: "En sprød toast.",
        ingredients: ["ca. 250 g svampe rensede"],
        instructions: [
          { position: 1, text: "Tilberedning: Steg svampene." },
          { position: 2, text: "Tilberedning: Servér." },
        ],
        prepMinutes: 10,
        cookMinutes: 15,
        totalMinutes: 25,
        yieldText: "4 personer",
        imageUrls: ["https://cdn.sanity.io/svampetoast.jpg"],
        categories: ["Frokost"],
        cuisines: [],
        keywords: ["Vegetarisk"],
      },
    });
  });

  it("persists direct API provenance and V2 recipes through the source session", async () => {
    const source = DANISH_JSONLD_SOURCES.find((entry) => entry.id === "meyers")!;
    const store = new MemoryStore();
    const session = new DanishJsonLdSourceSession({
      source,
      store,
      crawlRunId: "run",
      crawlAttemptId: "attempt",
      maxPages: 1,
    });
    const routes = await session.handleResponse({
      kind: "listing",
      fetchMode: "cheerio",
      url: MEYERS_SANITY_URL,
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: [recipe] }),
    });

    expect(routes).toEqual({ cheerioRequests: [], playwrightRequests: [] });
    expect(store.pages[0]).toMatchObject({ extractionMethod: "api-json", recipeCount: 1 });
    expect(store.pages[0].rawApiPayload).toBeTruthy();
    expect(store.recipes[0]).toMatchObject({
      extractionMethod: "api-json",
      canonicalUrl: "https://meyers.dk/opskrifter/svampetoast",
      sourceRecipeKey: expect.stringMatching(/^meyers:/u),
    });
    expect(session.observation).toMatchObject({
      persistedRecipes: 1,
      discoveredRecipeCandidates: 1,
      rejectedIncompleteCustom: 0,
      rejectedMalformedCustom: 0,
    });
  });
});
