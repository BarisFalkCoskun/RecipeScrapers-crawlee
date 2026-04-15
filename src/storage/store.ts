import type {
  CrawlRunDocument,
  PageDocument,
  RecipeDocument,
} from "../types.js";

export interface CrawlStore {
  upsertPage(page: Omit<PageDocument, "_id">): Promise<void>;
  insertRecipe(recipe: Omit<RecipeDocument, "_id">): Promise<void>;
  wasPageFetchedSince(canonicalUrl: string, fetchedAfter: Date): Promise<boolean>;
  findFreshPageUrls(
    canonicalUrls: string[],
    fetchedAfter: Date
  ): Promise<Set<string>>;
  insertCrawlRun(run: Omit<CrawlRunDocument, "_id">): Promise<void>;
}
