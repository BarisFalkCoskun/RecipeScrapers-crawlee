import type {
  CrawlRunDocument,
  PageDocument,
  RecipeDocument,
} from "../../src/types.js";
import type { CrawlStore } from "../../src/storage/store.js";

export class MemoryCrawlStore implements CrawlStore {
  readonly pages = new Map<string, Omit<PageDocument, "_id">>();
  readonly recipes = new Map<string, Omit<RecipeDocument, "_id">>();
  readonly runs: Array<Omit<CrawlRunDocument, "_id">> = [];

  async upsertPage(page: Omit<PageDocument, "_id">): Promise<void> {
    this.pages.set(page.canonicalUrl, page);
  }

  async insertRecipe(recipe: Omit<RecipeDocument, "_id">): Promise<void> {
    this.recipes.set(recipe.contentHash, recipe);
  }

  async wasPageFetchedSince(
    canonicalUrl: string,
    fetchedAfter: Date
  ): Promise<boolean> {
    const page = this.pages.get(canonicalUrl);
    return page !== undefined && page.fetchedAt >= fetchedAfter;
  }

  async findFreshPageUrls(
    canonicalUrls: string[],
    fetchedAfter: Date
  ): Promise<Set<string>> {
    const freshUrls = new Set<string>();

    for (const canonicalUrl of canonicalUrls) {
      const page = this.pages.get(canonicalUrl);
      if (page && page.fetchedAt >= fetchedAfter) {
        freshUrls.add(canonicalUrl);
      }
    }

    return freshUrls;
  }

  async insertCrawlRun(run: Omit<CrawlRunDocument, "_id">): Promise<void> {
    this.runs.push(run);
  }
}
