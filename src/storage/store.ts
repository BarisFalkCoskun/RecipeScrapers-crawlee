import type {
  CrawlRunDocument,
  RejectedRecipeCandidate,
  DanishJsonLdCrawlRunDocument,
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
  /** Optional for ephemeral probes; production stores persist rejection evidence. */
  upsertRejectedCandidate?(candidate: Omit<RejectedRecipeCandidate, "_id">): Promise<void>;
  upsertRecipeV2(
    recipe: Omit<RecipeDocumentV2, "_id">
  ): Promise<{
    operation: "inserted" | "updated";
    contentChanged?: boolean;
    contentMatches: RecipeContentMatch[];
  }>;
  insertDanishJsonLdRun(
    run: Omit<DanishJsonLdCrawlRunDocument, "_id">
  ): Promise<void>;
}
