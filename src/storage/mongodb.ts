import { MongoClient, type Db, type Collection } from "mongodb";
import type {
  CrawlRunDocument,
  PageDocument,
  RecipeDocument,
} from "../types.js";
import { MONGODB_CONFIG, STORAGE } from "../config.js";
import type { CrawlStore } from "./store.js";

export class RecipeStore implements CrawlStore {
  private client: MongoClient;
  private dbName: string;
  private db!: Db;
  private pages!: Collection<PageDocument>;
  private recipes!: Collection<RecipeDocument>;
  private crawlRuns!: Collection<CrawlRunDocument>;

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
    this.crawlRuns = this.db.collection<CrawlRunDocument>(
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

  async listCrawlRuns(): Promise<CrawlRunDocument[]> {
    return this.crawlRuns.find({}).toArray();
  }

  async dropDatabase(): Promise<void> {
    await this.db.dropDatabase();
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
