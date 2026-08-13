import { describe, expect, it, vi } from "vitest";
import { RecipeStore } from "../../src/storage/mongodb.js";
import type { RecipeDocumentV2 } from "../../src/types.js";

type StoredRecipeV2 = Omit<RecipeDocumentV2, "_id">;

class FakeV2RecipeCollection {
  readonly documents: StoredRecipeV2[] = [];
  readonly createIndex = vi.fn(async () => undefined);

  async findOne(filter: Partial<StoredRecipeV2>): Promise<StoredRecipeV2 | null> {
    return (
      this.documents.find((document) =>
        Object.entries(filter).every(
          ([key, value]) => document[key as keyof StoredRecipeV2] === value
        )
      ) ?? null
    );
  }

  find(filter: Partial<StoredRecipeV2>) {
    return {
      toArray: async () =>
        this.documents.filter((document) =>
          Object.entries(filter).every(
            ([key, value]) => document[key as keyof StoredRecipeV2] === value
          )
        ),
    };
  }

  async updateOne(
    filter: Partial<StoredRecipeV2>,
    update: { $set: StoredRecipeV2 },
    options?: { upsert?: boolean }
  ): Promise<void> {
    const index = this.documents.findIndex((document) =>
      Object.entries(filter).every(
        ([key, value]) => document[key as keyof StoredRecipeV2] === value
      )
    );
    if (index >= 0) {
      this.documents[index] = update.$set;
    } else if (options?.upsert) {
      this.documents.push(update.$set);
    }
  }
}

function recipe(overrides: Partial<StoredRecipeV2> = {}): StoredRecipeV2 {
  return {
    schemaVersion: 2,
    sourceId: "arla",
    sourceRecipeKey: "arla:one",
    canonicalUrl: "https://arla.dk/opskrifter/kage",
    pageUrl: "https://arla.dk/opskrifter/kage",
    crawlRunId: "run-1",
    crawlAttemptId: "attempt-1",
    createdAt: new Date("2026-08-13T08:00:00.000Z"),
    updatedAt: new Date("2026-08-13T08:00:00.000Z"),
    extractedAt: new Date("2026-08-13T08:00:00.000Z"),
    language: "da",
    languageConfidence: 1,
    languageSignals: [],
    extractionMethod: "json-ld",
    extractorVersion: "2.0.0",
    extractionConfidence: 1,
    extractionSignals: ["json-ld-found"],
    rawRecipe: {
      "@type": "Recipe",
      name: "Kage",
      recipeIngredient: ["1 æg"],
      recipeInstructions: ["Bag."],
    },
    normalized: {
      title: "Kage",
      ingredients: ["1 æg"],
      instructions: [{ position: 1, text: "Bag." }],
      imageUrls: [],
      categories: [],
      cuisines: [],
      keywords: [],
    },
    sourceHash: "source-one",
    contentHash: "content-shared",
    contentMatches: [],
    ...overrides,
  };
}

describe("RecipeStore V2 persistence", () => {
  it("upserts by sourceRecipeKey and audits same-source and cross-source content matches", async () => {
    const store = new RecipeStore("mongodb://unused", "crawlee_test");
    const recipesV2 = new FakeV2RecipeCollection();
    (store as never as { recipesV2: FakeV2RecipeCollection }).recipesV2 = recipesV2;

    await expect(store.upsertRecipeV2(recipe())).resolves.toEqual({
      operation: "inserted",
      contentMatches: [],
    });
    await expect(
      store.upsertRecipeV2(recipe({ crawlAttemptId: "attempt-2" }))
    ).resolves.toEqual({ operation: "updated", contentMatches: [] });
    await expect(
      store.upsertRecipeV2(
        recipe({
          sourceRecipeKey: "arla:two",
          canonicalUrl: "https://arla.dk/opskrifter/kage-print",
        })
      )
    ).resolves.toEqual({
      operation: "inserted",
      contentMatches: [
        { kind: "same-source", sourceId: "arla", sourceRecipeKey: "arla:one" },
      ],
    });
    await expect(
      store.upsertRecipeV2(
        recipe({
          sourceId: "other",
          sourceRecipeKey: "other:one",
          canonicalUrl: "https://other.dk/kage",
        })
      )
    ).resolves.toEqual({
      operation: "inserted",
      contentMatches: [
        { kind: "cross-source", sourceId: "arla", sourceRecipeKey: "arla:one" },
        { kind: "cross-source", sourceId: "arla", sourceRecipeKey: "arla:two" },
      ],
    });

    expect(recipesV2.documents).toHaveLength(3);
    expect(recipesV2.documents[0].crawlAttemptId).toBe("attempt-2");
    expect(recipesV2.documents[2].contentMatches).toContainEqual({
      kind: "cross-source",
      sourceId: "arla",
      sourceRecipeKey: "arla:one",
    });
  });

  it("indexes V2 source identity uniquely and permits repeated content hashes", async () => {
    const store = new RecipeStore("mongodb://unused", "crawlee_test");
    const recipesV2 = new FakeV2RecipeCollection();
    const noOpCollection = { createIndex: vi.fn(async () => undefined) };
    (store as never as {
      pages: typeof noOpCollection;
      recipes: typeof noOpCollection;
      recipesV2: FakeV2RecipeCollection;
      crawlRuns: typeof noOpCollection;
    }).pages = noOpCollection;
    (store as never as {
      pages: typeof noOpCollection;
      recipes: typeof noOpCollection;
      recipesV2: FakeV2RecipeCollection;
      crawlRuns: typeof noOpCollection;
    }).recipes = noOpCollection;
    (store as never as {
      pages: typeof noOpCollection;
      recipes: typeof noOpCollection;
      recipesV2: FakeV2RecipeCollection;
      crawlRuns: typeof noOpCollection;
    }).recipesV2 = recipesV2;
    (store as never as {
      pages: typeof noOpCollection;
      recipes: typeof noOpCollection;
      recipesV2: FakeV2RecipeCollection;
      crawlRuns: typeof noOpCollection;
    }).crawlRuns = noOpCollection;

    await (store as never as { ensureIndexes: () => Promise<void> }).ensureIndexes();

    expect(recipesV2.createIndex).toHaveBeenCalledWith(
      { sourceRecipeKey: 1 },
      { unique: true }
    );
    expect(recipesV2.createIndex).toHaveBeenCalledWith({ contentHash: 1 });
    expect(recipesV2.createIndex).not.toHaveBeenCalledWith(
      { contentHash: 1 },
      { unique: true }
    );
  });
});
