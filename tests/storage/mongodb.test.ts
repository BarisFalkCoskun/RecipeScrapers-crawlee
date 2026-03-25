import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RecipeStore } from "../../src/storage/mongodb.js";
import type { PageDocument, RecipeDocument } from "../../src/types.js";

describe("RecipeStore", () => {
  let store: RecipeStore;

  beforeAll(async () => {
    store = new RecipeStore("mongodb://localhost:27017", "danishRecipes_test");
    await store.connect();
  });

  afterAll(async () => {
    await store.dropDatabase();
    await store.close();
  });

  it("upserts a page document", async () => {
    const page: Omit<PageDocument, "_id"> = {
      canonicalUrl: "https://example.dk/opskrift/kage",
      domain: "example.dk",
      fetchedAt: new Date(),
      httpStatus: 200,
      extractionMethod: "json-ld",
      extractorVersion: "1.0.0",
      extractionConfidence: 1.0,
      extractionSignals: ["json-ld-found"],
      recipeCount: 1,
      pageContentHash: "abc123",
      outboundRecipeLinks: [],
    };
    await store.upsertPage(page);
    const found = await store.findPageByUrl("https://example.dk/opskrift/kage");
    expect(found).not.toBeNull();
    expect(found!.domain).toBe("example.dk");
  });

  it("upserts same page URL without duplicating", async () => {
    const page: Omit<PageDocument, "_id"> = {
      canonicalUrl: "https://example.dk/opskrift/kage",
      domain: "example.dk",
      fetchedAt: new Date(),
      httpStatus: 200,
      extractionMethod: "json-ld",
      extractorVersion: "1.0.0",
      extractionConfidence: 1.0,
      extractionSignals: ["json-ld-found"],
      recipeCount: 2,
      pageContentHash: "def456",
      outboundRecipeLinks: [],
    };
    await store.upsertPage(page);
    const count = await store.countPages("example.dk");
    expect(count).toBe(1);
  });

  it("inserts a recipe document", async () => {
    const recipe: Omit<RecipeDocument, "_id"> = {
      pageUrl: "https://example.dk/opskrift/kage",
      domain: "example.dk",
      extractedAt: new Date(),
      extractionMethod: "json-ld",
      extractorVersion: "1.0.0",
      extractionConfidence: 1.0,
      rawRecipe: { "@type": "Recipe", "name": "Kage" },
      extractionSignals: ["json-ld-found"],
      contentHash: "recipe_hash_1",
      sourceHash: "recipe_hash_1",
    };
    await store.insertRecipe(recipe);
    const count = await store.countRecipes("example.dk");
    expect(count).toBe(1);
  });

  it("silently skips duplicate recipe by contentHash", async () => {
    const recipe: Omit<RecipeDocument, "_id"> = {
      pageUrl: "https://other.dk/different-url",
      domain: "other.dk",
      extractedAt: new Date(),
      extractionMethod: "json-ld",
      extractorVersion: "1.0.0",
      extractionConfidence: 1.0,
      rawRecipe: { "@type": "Recipe", "name": "Kage" },
      extractionSignals: ["json-ld-found"],
      contentHash: "recipe_hash_1",
      sourceHash: "recipe_hash_1",
    };
    await store.insertRecipe(recipe); // Should not throw
  });
});
