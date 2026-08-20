import { describe, expect, it, vi } from "vitest";
import { RecipeStore } from "../../src/storage/mongodb.js";
import type {
  CrawlRunDocument,
  DanishJsonLdCrawlRunDocument,
  RecipeDocumentV2,
} from "../../src/types.js";

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
    update: { $set: Partial<StoredRecipeV2> },
    options?: { upsert?: boolean }
  ): Promise<void> {
    const index = this.documents.findIndex((document) =>
      Object.entries(filter).every(
        ([key, value]) => document[key as keyof StoredRecipeV2] === value
      )
    );
    if (index >= 0) {
      this.documents[index] = { ...this.documents[index], ...update.$set };
    } else if (options?.upsert) {
      this.documents.push(update.$set);
    }
  }
}

class ConcurrentV2RecipeCollection extends FakeV2RecipeCollection {
  private initialFinds = 0;
  private releaseInitialFinds!: () => void;
  private readonly initialFindBarrier = new Promise<void>((resolve) => {
    this.releaseInitialFinds = resolve;
  });

  override async findOne(
    filter: Partial<StoredRecipeV2>
  ): Promise<StoredRecipeV2 | null> {
    if (filter.sourceRecipeKey && this.documents.length === 0) {
      this.initialFinds += 1;
      if (this.initialFinds === 2) this.releaseInitialFinds();
      await this.initialFindBarrier;
    }
    return super.findOne(filter);
  }
}

interface StoredContentMatchAudit {
  contentHash: string;
  sourceRecipeKeyA: string;
  sourceRecipeKeyB: string;
  sourceIdA: string;
  sourceIdB: string;
  kind: "same-source" | "cross-source";
}

class FakeContentMatchAuditCollection {
  readonly documents: StoredContentMatchAudit[] = [];
  readonly createIndex = vi.fn(async () => undefined);

  async updateOne(
    filter: Pick<StoredContentMatchAudit, "contentHash" | "sourceRecipeKeyA" | "sourceRecipeKeyB">,
    update: { $setOnInsert: StoredContentMatchAudit },
    options?: { upsert?: boolean }
  ): Promise<void> {
    const existing = this.documents.some(
      (document) =>
        document.contentHash === filter.contentHash &&
        document.sourceRecipeKeyA === filter.sourceRecipeKeyA &&
        document.sourceRecipeKeyB === filter.sourceRecipeKeyB
    );
    if (!existing && options?.upsert) this.documents.push(update.$setOnInsert);
  }
}

class FakeRunCollection {
  constructor(
    readonly documents: Array<CrawlRunDocument | DanishJsonLdCrawlRunDocument>
  ) {}

  find() {
    return { toArray: async () => this.documents };
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
  it("lists dedicated Danish V2 runs separately from generic crawler runs", async () => {
    const store = new RecipeStore("mongodb://unused", "crawlee_test");
    const danishRun: DanishJsonLdCrawlRunDocument = {
      kind: "danish-recipe-v2",
      schemaVersion: 2,
      crawlRunId: "run-danish",
      startedAt: new Date("2026-08-19T01:00:00.000Z"),
      finishedAt: new Date("2026-08-19T01:05:00.000Z"),
      sourceIds: ["ketoliv"],
      summary: {
        robotsEnforced: false,
        sourceOutcomes: [{
          sourceId: "ketoliv",
          outcome: "succeeded",
          outcomeReasons: [],
        }],
      },
      observations: [{ sourceId: "ketoliv", persistedRecipes: 578 }],
    };
    const genericRun = {
      startedAt: new Date("2026-08-19T02:00:00.000Z"),
      finishedAt: new Date("2026-08-19T02:05:00.000Z"),
      recrawlCutoff: new Date("2026-07-19T02:00:00.000Z"),
      seeds: ["example.dk"],
      summary: {},
    } as CrawlRunDocument;
    (store as never as { crawlRuns: FakeRunCollection }).crawlRuns =
      new FakeRunCollection([genericRun, danishRun]);

    await expect(store.listDanishRecipeRuns()).resolves.toEqual([danishRun]);
    await expect(store.listCrawlRuns()).resolves.toEqual([genericRun]);
  });

  it("upserts by sourceRecipeKey and audits same-source and cross-source content matches", async () => {
    const store = new RecipeStore("mongodb://unused", "crawlee_test");
    const recipesV2 = new FakeV2RecipeCollection();
    const contentMatches = new FakeContentMatchAuditCollection();
    (store as never as { recipesV2: FakeV2RecipeCollection }).recipesV2 = recipesV2;
    (store as never as { contentMatchAudits: FakeContentMatchAuditCollection }).contentMatchAudits = contentMatches;

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
    const contentMatches = new FakeContentMatchAuditCollection();
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
    (store as never as { contentMatchAudits: FakeContentMatchAuditCollection }).contentMatchAudits = contentMatches;
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
    expect(recipesV2.createIndex).toHaveBeenCalledWith({ sourceId: 1, crawlRunId: 1 });
    expect(recipesV2.createIndex).not.toHaveBeenCalledWith(
      { contentHash: 1 },
      { unique: true }
    );
  });

  it("audits concurrent cross-source content matches after both source identities are persisted", async () => {
    const store = new RecipeStore("mongodb://unused", "crawlee_test");
    const recipesV2 = new ConcurrentV2RecipeCollection();
    const contentMatches = new FakeContentMatchAuditCollection();
    (store as never as { recipesV2: ConcurrentV2RecipeCollection }).recipesV2 = recipesV2;
    (store as never as { contentMatchAudits: FakeContentMatchAuditCollection }).contentMatchAudits = contentMatches;

    await Promise.all([
      store.upsertRecipeV2(recipe()),
      store.upsertRecipeV2(
        recipe({
          sourceId: "other",
          sourceRecipeKey: "other:one",
          canonicalUrl: "https://other.dk/kage",
        })
      ),
    ]);

    expect(recipesV2.documents).toHaveLength(2);
    expect(contentMatches.documents).toEqual([
      {
        contentHash: "content-shared",
        sourceRecipeKeyA: "arla:one",
        sourceRecipeKeyB: "other:one",
        sourceIdA: "arla",
        sourceIdB: "other",
        kind: "cross-source",
      },
    ]);
  });
});
