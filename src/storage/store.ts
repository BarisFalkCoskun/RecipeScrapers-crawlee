import type {
  CrawlRunDocument,
  PageDocument,
  RecipeDocument,
  RecipeDocumentV2,
  RecipeContentMatch,
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

export interface RecipeDocumentV2Store {
  upsertRecipeV2(
    recipe: Omit<RecipeDocumentV2, "_id">
  ): Promise<{
    operation: "inserted" | "updated";
    contentMatches: RecipeContentMatch[];
  }>;
}
