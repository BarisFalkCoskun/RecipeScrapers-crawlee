import { MongoClient, type Db, type Collection } from "mongodb";
import type {
  CrawlRunDocument,
  DanishJsonLdCrawlRunDocument,
  PageDocument,
  RecipeDocument,
  RecipeDocumentV2,
  RecipeContentMatch,
  RecipeContentMatchAudit,
} from "../types.js";
import { MONGODB_CONFIG, STORAGE } from "../config.js";
import type { CrawlStore, RecipeDocumentV2Store } from "./store.js";

export class RecipeStore implements CrawlStore, RecipeDocumentV2Store {
  private client: MongoClient;
  private dbName: string;
  private db!: Db;
  private pages!: Collection<PageDocument>;
  private recipes!: Collection<RecipeDocument>;
  private recipesV2!: Collection<RecipeDocumentV2>;
  private contentMatchAudits!: Collection<RecipeContentMatchAudit>;
  private crawlRuns!: Collection<CrawlRunDocument | DanishJsonLdCrawlRunDocument>;

  constructor(uri: string, dbName: string) {
    this.client = new MongoClient(uri);
    this.dbName = dbName;
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    this.pages = this.db.collection<PageDocument>(
      MONGODB_CONFIG.collections.pages
    );
    this.recipes = this.db.collection<RecipeDocument>(
      MONGODB_CONFIG.collections.recipes
    );
    this.recipesV2 = this.db.collection<RecipeDocumentV2>(
      MONGODB_CONFIG.collections.recipesV2
    );
    this.contentMatchAudits = this.db.collection<RecipeContentMatchAudit>(
      MONGODB_CONFIG.collections.recipeContentMatches
    );
    this.crawlRuns = this.db.collection<CrawlRunDocument | DanishJsonLdCrawlRunDocument>(
      MONGODB_CONFIG.collections.crawlRuns
    );
    await this.ensureIndexes();
  }

  private async ensureIndexes(): Promise<void> {
    const crawlRunRetentionSeconds =
      STORAGE.crawlRunRetentionDays * 24 * 60 * 60;

    await this.pages.createIndex({ canonicalUrl: 1 }, { unique: true });
    await this.pages.createIndex({ domain: 1, fetchedAt: 1 });
    await this.pages.createIndex({ language: 1, domain: 1 });
    await this.pages.createIndex({ extractionMethod: 1 });
    await this.pages.createIndex({ pageContentHash: 1 });

    await this.recipes.createIndex({ contentHash: 1 }, { unique: true });
    await this.recipes.createIndex({ domain: 1 });
    await this.recipes.createIndex({ language: 1, domain: 1 });
    await this.recipes.createIndex({ language: 1, extractedAt: -1 });
    await this.recipes.createIndex({ pageUrl: 1 });

    await this.recipesV2.createIndex({ sourceRecipeKey: 1 }, { unique: true });
    await this.recipesV2.createIndex({ contentHash: 1 });
    await this.recipesV2.createIndex({ sourceId: 1, contentHash: 1 });
    await this.recipesV2.createIndex({ canonicalUrl: 1 });
    await this.contentMatchAudits.createIndex(
      { contentHash: 1, sourceRecipeKeyA: 1, sourceRecipeKeyB: 1 },
      { unique: true }
    );

    await this.crawlRuns.createIndex({ startedAt: -1 });
    await this.crawlRuns.createIndex(
      { finishedAt: 1 },
      { expireAfterSeconds: crawlRunRetentionSeconds }
    );
  }

  async upsertPage(page: Omit<PageDocument, "_id">): Promise<void> {
    await this.pages.updateOne(
      { canonicalUrl: page.canonicalUrl },
      { $set: page },
      { upsert: true }
    );
  }

  async insertRecipe(recipe: Omit<RecipeDocument, "_id">): Promise<void> {
    try {
      await this.recipes.insertOne(recipe as RecipeDocument);
    } catch (err: unknown) {
      // Duplicate contentHash — update if new extraction has higher confidence
      if (
        err instanceof Error &&
        "code" in err &&
        (err as { code: number }).code === 11000
      ) {
        await this.recipes.updateOne(
          {
            contentHash: recipe.contentHash,
            extractionConfidence: { $lt: recipe.extractionConfidence },
          },
          { $set: recipe }
        );
        return;
      }
      throw err;
    }
  }

  async upsertRecipeV2(
    recipe: Omit<RecipeDocumentV2, "_id">
  ): Promise<{
    operation: "inserted" | "updated";
    contentMatches: RecipeContentMatch[];
  }> {
    const existing = await this.recipesV2.findOne({
      sourceRecipeKey: recipe.sourceRecipeKey,
    });
    await this.recipesV2.updateOne(
      { sourceRecipeKey: recipe.sourceRecipeKey },
      {
        $set: {
          ...recipe,
          createdAt: existing?.createdAt ?? recipe.createdAt,
          contentMatches: recipe.contentMatches,
        },
      },
      { upsert: true }
    );

    const contentMatches = this.buildContentMatches(
      recipe,
      await this.recipesV2.find({ contentHash: recipe.contentHash }).toArray()
    );
    await this.recordContentMatchAudits(recipe, contentMatches);
    await this.recipesV2.updateOne(
      { sourceRecipeKey: recipe.sourceRecipeKey },
      { $set: { contentMatches } }
    );

    return {
      operation: existing ? "updated" : "inserted",
      contentMatches,
    };
  }

  private buildContentMatches(
    recipe: Omit<RecipeDocumentV2, "_id">,
    matches: RecipeDocumentV2[]
  ): RecipeContentMatch[] {
    return matches
      .filter((match) => match.sourceRecipeKey !== recipe.sourceRecipeKey)
      .map((match): RecipeContentMatch => ({
        kind:
          match.sourceId === recipe.sourceId ? "same-source" : "cross-source",
        sourceId: match.sourceId,
        sourceRecipeKey: match.sourceRecipeKey,
      }))
      .sort((left, right) =>
        `${left.sourceId}:${left.sourceRecipeKey}`.localeCompare(
          `${right.sourceId}:${right.sourceRecipeKey}`
        )
      );
  }

  private async recordContentMatchAudits(
    recipe: Omit<RecipeDocumentV2, "_id">,
    contentMatches: RecipeContentMatch[]
  ): Promise<void> {
    await Promise.all(
      contentMatches.map(async (match) => {
        const [sourceRecipeKeyA, sourceRecipeKeyB] = [
          recipe.sourceRecipeKey,
          match.sourceRecipeKey,
        ].sort();
        const isIncomingA = sourceRecipeKeyA === recipe.sourceRecipeKey;
        await this.contentMatchAudits.updateOne(
          { contentHash: recipe.contentHash, sourceRecipeKeyA, sourceRecipeKeyB },
          {
            $setOnInsert: {
              contentHash: recipe.contentHash,
              sourceRecipeKeyA,
              sourceRecipeKeyB,
              sourceIdA: isIncomingA ? recipe.sourceId : match.sourceId,
              sourceIdB: isIncomingA ? match.sourceId : recipe.sourceId,
              kind: match.kind,
            },
          },
          { upsert: true }
        );
      })
    );
  }

  async findPageByUrl(canonicalUrl: string): Promise<PageDocument | null> {
    return this.pages.findOne({ canonicalUrl });
  }

  async wasPageFetchedSince(
    canonicalUrl: string,
    fetchedAfter: Date
  ): Promise<boolean> {
    const freshPage = await this.pages.findOne(
      {
        canonicalUrl,
        fetchedAt: { $gte: fetchedAfter },
      },
      {
        projection: { _id: 1 },
      }
    );

    return freshPage !== null;
  }

  async findFreshPageUrls(
    canonicalUrls: string[],
    fetchedAfter: Date
  ): Promise<Set<string>> {
    if (canonicalUrls.length === 0) {
      return new Set();
    }

    const freshPages = await this.pages
      .find(
        {
          canonicalUrl: { $in: canonicalUrls },
          fetchedAt: { $gte: fetchedAfter },
        },
        {
          projection: { canonicalUrl: 1 },
        }
      )
      .toArray();

    return new Set(freshPages.map((page) => page.canonicalUrl));
  }

  async countPages(domain: string): Promise<number> {
    return this.pages.countDocuments({ domain });
  }

  async countRecipes(domain: string): Promise<number> {
    return this.recipes.countDocuments({ domain });
  }

  async insertCrawlRun(run: Omit<CrawlRunDocument, "_id">): Promise<void> {
    await this.crawlRuns.insertOne(run as CrawlRunDocument);
  }

  async insertDanishJsonLdRun(
    run: Omit<DanishJsonLdCrawlRunDocument, "_id">
  ): Promise<void> {
    await this.crawlRuns.insertOne(run as DanishJsonLdCrawlRunDocument);
  }

  async listCrawlRuns(): Promise<CrawlRunDocument[]> {
    const runs = await this.crawlRuns.find({}).toArray();
    return runs.filter(
      (run) => !("kind" in run && run.kind === "danish-jsonld-v2")
    ) as CrawlRunDocument[];
  }

  async dropDatabase(): Promise<void> {
    await this.db.dropDatabase();
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
