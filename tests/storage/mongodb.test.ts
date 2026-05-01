import { beforeEach, describe, expect, it, vi } from "vitest";
import { MONGODB_CONFIG, STORAGE } from "../../src/config.js";
import { RecipeStore } from "../../src/storage/mongodb.js";
import type {
  CrawlRunDocument,
  PageDocument,
  RecipeDocument,
} from "../../src/types.js";

type StoredPage = Omit<PageDocument, "_id">;
type StoredRecipe = Omit<RecipeDocument, "_id">;
type StoredRun = Omit<CrawlRunDocument, "_id">;

class FakeCollection<T extends Record<string, unknown>> {
  readonly createIndex = vi.fn(async () => undefined);

  constructor(
    private documents: T[],
    private getUniqueKey: (doc: T) => string,
    private duplicateCode = 11000
  ) {}

  async updateOne(
    filter: Record<string, unknown>,
    update: { $set: T },
    options?: { upsert?: boolean }
  ): Promise<void> {
    const index = this.documents.findIndex((doc) => matchesFilter(doc, filter));
    if (index >= 0) {
      this.documents[index] = update.$set;
      return;
    }

    if (options?.upsert) {
      this.documents.push(update.$set);
    }
  }

  async insertOne(document: T): Promise<void> {
    const key = this.getUniqueKey(document);
    if (this.documents.some((doc) => this.getUniqueKey(doc) === key)) {
      const duplicateError = new Error("duplicate key");
      Object.assign(duplicateError, { code: this.duplicateCode });
      throw duplicateError;
    }

    this.documents.push(document);
  }

  async findOne(
    filter: Record<string, unknown>,
    options?: { projection?: Record<string, number> }
  ): Promise<T | null> {
    const match = this.documents.find((doc) => matchesFilter(doc, filter));
    if (!match) {
      return null;
    }

    return applyProjection(match, options?.projection);
  }

  find(
    filter: Record<string, unknown>,
    options?: { projection?: Record<string, number> }
  ) {
    const matches = this.documents
      .filter((doc) => matchesFilter(doc, filter))
      .map((doc) => applyProjection(doc, options?.projection));

    return {
      toArray: async () => matches,
    };
  }

  async countDocuments(filter: Record<string, unknown>): Promise<number> {
    return this.documents.filter((doc) => matchesFilter(doc, filter)).length;
  }
}

describe("RecipeStore", () => {
  let store: RecipeStore;
  let pages: StoredPage[];
  let recipes: StoredRecipe[];
  let crawlRuns: StoredRun[];
  let pagesCollection: FakeCollection<StoredPage>;
  let recipesCollection: FakeCollection<StoredRecipe>;
  let crawlRunsCollection: FakeCollection<StoredRun>;
  let fakeDb: { dropDatabase: ReturnType<typeof vi.fn> };
  let fakeClient: { close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    store = new RecipeStore("mongodb://unused", "crawlee_test");
    pages = [];
    recipes = [];
    crawlRuns = [];
    fakeDb = { dropDatabase: vi.fn().mockResolvedValue(undefined) };
    fakeClient = { close: vi.fn().mockResolvedValue(undefined) };

    (store as never as {
      db: typeof fakeDb;
      client: typeof fakeClient;
      pages: FakeCollection<StoredPage>;
      recipes: FakeCollection<StoredRecipe>;
      crawlRuns: FakeCollection<StoredRun>;
    }).db = fakeDb;

    (store as never as {
      db: typeof fakeDb;
      client: typeof fakeClient;
      pages: FakeCollection<StoredPage>;
      recipes: FakeCollection<StoredRecipe>;
      crawlRuns: FakeCollection<StoredRun>;
    }).client = fakeClient;

    pagesCollection = new FakeCollection(pages, (doc) => doc.canonicalUrl);
    recipesCollection = new FakeCollection(recipes, (doc) => doc.contentHash);
    crawlRunsCollection = new FakeCollection(
      crawlRuns,
      (doc) => doc.startedAt.toISOString()
    );

    (store as never as {
      db: typeof fakeDb;
      client: typeof fakeClient;
      pages: FakeCollection<StoredPage>;
      recipes: FakeCollection<StoredRecipe>;
      crawlRuns: FakeCollection<StoredRun>;
    }).pages = pagesCollection;

    (store as never as {
      db: typeof fakeDb;
      client: typeof fakeClient;
      pages: FakeCollection<StoredPage>;
      recipes: FakeCollection<StoredRecipe>;
      crawlRuns: FakeCollection<StoredRun>;
    }).recipes = recipesCollection;

    (store as never as {
      db: typeof fakeDb;
      client: typeof fakeClient;
      pages: FakeCollection<StoredPage>;
      recipes: FakeCollection<StoredRecipe>;
      crawlRuns: FakeCollection<StoredRun>;
    }).crawlRuns = crawlRunsCollection;
  });

  it("uses the expected MongoDB database and collection names", () => {
    expect(MONGODB_CONFIG.defaultDatabaseName).toBe("crawlee");
    expect(MONGODB_CONFIG.collections.recipes).toBe("recipes");
  });

  it("creates a TTL index for crawl run retention", async () => {
    await (
      store as never as { ensureIndexes: () => Promise<void> }
    ).ensureIndexes();

    expect(crawlRunsCollection.createIndex).toHaveBeenCalledWith(
      { finishedAt: 1 },
      { expireAfterSeconds: STORAGE.crawlRunRetentionDays * 24 * 60 * 60 }
    );
    expect(pagesCollection.createIndex).toHaveBeenCalledWith({
      language: 1,
      domain: 1,
    });
    expect(recipesCollection.createIndex).toHaveBeenCalledWith({
      language: 1,
      domain: 1,
    });
    expect(recipesCollection.createIndex).toHaveBeenCalledWith({
      language: 1,
      extractedAt: -1,
    });
  });

  it("upserts a page document", async () => {
    const page: StoredPage = {
      canonicalUrl: "https://example.dk/opskrift/kage",
      domain: "example.dk",
      language: "da",
      languageConfidence: 1,
      languageSignals: ["html-lang"],
      fetchedAt: new Date(),
      httpStatus: 200,
      fetchMode: "cheerio",
      extractionMethod: "json-ld",
      extractorVersion: "1.0.0",
      extractionConfidence: 1.0,
      extractionSignals: ["json-ld-found"],
      recipeCount: 1,
      pageContentHash: "abc123",
      discoverySource: "seed-root",
      admissionSignals: ["same-domain-trusted-seed"],
      outboundRecipeLinks: [],
    };
    await store.upsertPage(page);
    const found = await store.findPageByUrl("https://example.dk/opskrift/kage");
    expect(found).not.toBeNull();
    expect(found!.domain).toBe("example.dk");
  });

  it("upserts same page URL without duplicating", async () => {
    const page: StoredPage = {
      canonicalUrl: "https://example.dk/opskrift/kage",
      domain: "example.dk",
      language: "da",
      languageConfidence: 1,
      languageSignals: ["html-lang"],
      fetchedAt: new Date(),
      httpStatus: 200,
      fetchMode: "cheerio",
      extractionMethod: "json-ld",
      extractorVersion: "1.0.0",
      extractionConfidence: 1.0,
      extractionSignals: ["json-ld-found"],
      recipeCount: 1,
      pageContentHash: "abc123",
      discoverySource: "seed-root",
      admissionSignals: ["same-domain-trusted-seed"],
      outboundRecipeLinks: [],
    };

    await store.upsertPage(page);
    await store.upsertPage({
      ...page,
      recipeCount: 2,
      pageContentHash: "def456",
    });

    const count = await store.countPages("example.dk");
    expect(count).toBe(1);
    expect(pages[0].recipeCount).toBe(2);
  });

  it("inserts a recipe document", async () => {
    const recipe: StoredRecipe = {
      pageUrl: "https://example.dk/opskrift/kage",
      domain: "example.dk",
      language: "da",
      languageConfidence: 1,
      languageSignals: ["recipe-inLanguage"],
      extractedAt: new Date(),
      extractionMethod: "json-ld",
      extractorVersion: "1.0.0",
      extractionConfidence: 1.0,
      rawRecipe: { "@type": "Recipe", name: "Kage" },
      extractionSignals: ["json-ld-found"],
      contentHash: "recipe_hash_1",
      sourceHash: "recipe_hash_1",
    };
    await store.insertRecipe(recipe);
    const count = await store.countRecipes("example.dk");
    expect(count).toBe(1);
  });

  it("updates duplicate recipe when a higher-confidence extraction arrives", async () => {
    const baseRecipe: StoredRecipe = {
      pageUrl: "https://example.dk/opskrift/kage",
      domain: "example.dk",
      language: "da",
      languageConfidence: 1,
      languageSignals: ["recipe-inLanguage"],
      extractedAt: new Date("2026-03-28T10:00:00.000Z"),
      extractionMethod: "partial",
      extractorVersion: "1.0.0",
      extractionConfidence: 0.3,
      rawRecipe: { "@type": "Recipe", name: "Kage" },
      extractionSignals: ["partial"],
      contentHash: "recipe_hash_1",
      sourceHash: "recipe_hash_1",
    };

    await store.insertRecipe(baseRecipe);
    await store.insertRecipe({
      ...baseRecipe,
      extractionMethod: "json-ld",
      extractionConfidence: 1.0,
      extractionSignals: ["json-ld-found"],
    });

    expect(recipes).toHaveLength(1);
    expect(recipes[0].extractionMethod).toBe("json-ld");
    expect(recipes[0].extractionConfidence).toBe(1.0);
  });

  it("finds fresh pages by cutoff", async () => {
    await store.upsertPage({
      canonicalUrl: "https://example.dk/fresh",
      domain: "example.dk",
      language: "da",
      languageConfidence: 1,
      languageSignals: ["html-lang"],
      fetchedAt: new Date("2026-03-20T00:00:00.000Z"),
      httpStatus: 200,
      fetchMode: "cheerio",
      extractionMethod: "json-ld",
      extractorVersion: "1.0.0",
      extractionConfidence: 1,
      extractionSignals: [],
      recipeCount: 1,
      pageContentHash: "fresh",
      discoverySource: "sitemap",
      admissionSignals: ["queue-eligible"],
      outboundRecipeLinks: [],
    });
    await store.upsertPage({
      canonicalUrl: "https://example.dk/stale",
      domain: "example.dk",
      language: "da",
      languageConfidence: 1,
      languageSignals: ["html-lang"],
      fetchedAt: new Date("2026-01-20T00:00:00.000Z"),
      httpStatus: 200,
      fetchMode: "cheerio",
      extractionMethod: "json-ld",
      extractorVersion: "1.0.0",
      extractionConfidence: 1,
      extractionSignals: [],
      recipeCount: 1,
      pageContentHash: "stale",
      discoverySource: "sitemap",
      admissionSignals: ["queue-eligible"],
      outboundRecipeLinks: [],
    });

    const freshUrls = await store.findFreshPageUrls(
      ["https://example.dk/fresh", "https://example.dk/stale"],
      new Date("2026-03-01T00:00:00.000Z")
    );

    expect(freshUrls).toEqual(new Set(["https://example.dk/fresh"]));
    await expect(
      store.wasPageFetchedSince(
        "https://example.dk/fresh",
        new Date("2026-03-01T00:00:00.000Z")
      )
    ).resolves.toBe(true);
  });

  it("persists crawl run summaries", async () => {
    const run: StoredRun = {
      startedAt: new Date("2026-03-28T10:00:00.000Z"),
      finishedAt: new Date("2026-03-28T10:05:00.000Z"),
      recrawlCutoff: new Date("2026-02-27T10:00:00.000Z"),
      seeds: ["example.dk"],
      summary: {
        processedPages: 10,
        recipePages: 4,
        extractedRecipes: 5,
        recipeLanguages: { da: 5 },
        recrawlSkips: 2,
        fallbacksEnqueued: 1,
        offDomainAdmissions: 1,
        blockedUrlReasons: { "hard-denylist-pattern": 3 },
        processedByMode: { cheerio: 9, playwright: 1 },
        recrawlSkipsByMode: { cheerio: 2, playwright: 0 },
        recipePageYield: 0.4,
        fallbackRate: 1 / 9,
        newlyAdmittedDomains: ["remote.example"],
        playwrightFallbacksByReason: { "thin-content": 1 },
        domains: [],
      },
    };

    await store.insertCrawlRun(run);
    const runs = await store.listCrawlRuns();

    expect(runs).toHaveLength(1);
    expect(runs[0].summary.processedPages).toBe(10);
  });

  it("delegates dropDatabase and close", async () => {
    await store.dropDatabase();
    await store.close();

    expect(fakeDb.dropDatabase).toHaveBeenCalledTimes(1);
    expect(fakeClient.close).toHaveBeenCalledTimes(1);
  });
});

function matchesFilter(
  doc: Record<string, unknown>,
  filter: Record<string, unknown>
): boolean {
  return Object.entries(filter).every(([key, value]) => {
    const actual = doc[key];

    if (value && typeof value === "object" && !Array.isArray(value)) {
      if ("$gte" in value) {
        return actual instanceof Date && actual >= (value.$gte as Date);
      }

      if ("$lt" in value) {
        return typeof actual === "number" && actual < (value.$lt as number);
      }

      if ("$in" in value) {
        return (value.$in as unknown[]).includes(actual);
      }
    }

    return actual === value;
  });
}

function applyProjection<T extends Record<string, unknown>>(
  doc: T,
  projection?: Record<string, number>
): T {
  if (!projection) {
    return doc;
  }

  const projected = {} as T;
  for (const [key, include] of Object.entries(projection)) {
    if (include) {
      projected[key as keyof T] = doc[key as keyof T];
    }
  }
  return projected;
}
