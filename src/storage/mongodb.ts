import { MongoClient, type Db, type Collection } from "mongodb";
import type { PageDocument, RecipeDocument } from "../types.js";

export class RecipeStore {
  private client: MongoClient;
  private dbName: string;
  private db!: Db;
  private pages!: Collection<PageDocument>;
  private recipes!: Collection<RecipeDocument>;

  constructor(uri: string, dbName: string) {
    this.client = new MongoClient(uri);
    this.dbName = dbName;
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    this.pages = this.db.collection<PageDocument>("pages");
    this.recipes = this.db.collection<RecipeDocument>("recipes");
    await this.ensureIndexes();
  }

  private async ensureIndexes(): Promise<void> {
    await this.pages.createIndex({ canonicalUrl: 1 }, { unique: true });
    await this.pages.createIndex({ domain: 1, fetchedAt: 1 });
    await this.pages.createIndex({ extractionMethod: 1 });
    await this.pages.createIndex({ pageContentHash: 1 });

    await this.recipes.createIndex({ contentHash: 1 }, { unique: true });
    await this.recipes.createIndex({ domain: 1 });
    await this.recipes.createIndex({ pageUrl: 1 });
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
      if (
        err instanceof Error &&
        "code" in err &&
        (err as { code: number }).code === 11000
      ) {
        return;
      }
      throw err;
    }
  }

  async findPageByUrl(canonicalUrl: string): Promise<PageDocument | null> {
    return this.pages.findOne({ canonicalUrl });
  }

  async countPages(domain: string): Promise<number> {
    return this.pages.countDocuments({ domain });
  }

  async countRecipes(domain: string): Promise<number> {
    return this.recipes.countDocuments({ domain });
  }

  async dropDatabase(): Promise<void> {
    await this.db.dropDatabase();
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
