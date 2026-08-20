import type {
  CrawlRunDocument,
  DanishJsonLdCrawlRunDocument,
  PageDocument,
  RecipeDocument,
  RecipeDocumentV2,
} from "../types.js";
import type { CrawlStore, RecipeDocumentV2Store } from "../storage/store.js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { runDanishJsonLdCrawl } from "../danish-jsonld/runner.js";
import {
  createDanishJsonLdCrawlSelection,
  parseDanishJsonLdCrawlArgs,
} from "../danish-jsonld/source-selection.js";

class ProbeStore implements CrawlStore, RecipeDocumentV2Store {
  readonly pages = new Map<string, Omit<PageDocument, "_id">>();
  readonly recipes = new Map<string, Omit<RecipeDocumentV2, "_id">>();

  async upsertPage(page: Omit<PageDocument, "_id">): Promise<void> {
    this.pages.set(page.canonicalUrl, page);
  }

  async upsertRecipeV2(recipe: Omit<RecipeDocumentV2, "_id">) {
    const operation = this.recipes.has(recipe.sourceRecipeKey)
      ? "updated" as const
      : "inserted" as const;
    this.recipes.set(recipe.sourceRecipeKey, recipe);
    return { operation, contentMatches: [] };
  }

  async insertRecipe(_recipe: Omit<RecipeDocument, "_id">): Promise<void> {}
  async wasPageFetchedSince(): Promise<boolean> { return false; }
  async findFreshPageUrls(): Promise<Set<string>> { return new Set(); }
  async insertCrawlRun(_run: Omit<CrawlRunDocument, "_id">): Promise<void> {}
  async insertDanishJsonLdRun(
    _run: Omit<DanishJsonLdCrawlRunDocument, "_id">
  ): Promise<void> {}
}

async function main(): Promise<void> {
  const suppliedArgs = process.argv.slice(2);
  const uncappedIndex = suppliedArgs.indexOf("--uncapped");
  const uncapped = uncappedIndex >= 0;
  if (uncapped) suppliedArgs.splice(uncappedIndex, 1);
  const recipesOutIndex = suppliedArgs.indexOf("--recipes-out");
  const recipesOut = recipesOutIndex < 0 ? undefined : suppliedArgs[recipesOutIndex + 1];
  if (recipesOutIndex >= 0) {
    if (!recipesOut || recipesOut.startsWith("--")) {
      throw new Error("--recipes-out requires a path");
    }
    suppliedArgs.splice(recipesOutIndex, 2);
  }
  const args = suppliedArgs.includes("--sources")
    ? suppliedArgs
    : ["--sources", "gastrofun", ...suppliedArgs];
  const options = parseDanishJsonLdCrawlArgs(args);
  if (options.maxPages === undefined && !uncapped) options.maxPages = 1;
  const selection = createDanishJsonLdCrawlSelection(options);
  const store = new ProbeStore();
  const diagnosticCounts = new Map<string, number>();
  const crawlRunId = `probe-${new Date().toISOString().replaceAll(":", "-")}`;
  const result = await runDanishJsonLdCrawl({
    selection,
    store,
    crawlRunId,
    diagnosticSink: ({ event }) => {
      diagnosticCounts.set(event, (diagnosticCounts.get(event) ?? 0) + 1);
    },
  });
  const recipes = [...store.recipes.values()];
  const evidence = {
    crawlRunId,
    selectedSources: selection.sourceIds,
    maxPages: selection.maxPages,
    summary: result.summary,
    observations: result.observations,
    storedPages: store.pages.size,
    storedRecipes: recipes.length,
    recipeSamples: recipes.slice(0, 5).map((recipe) => ({
      sourceId: recipe.sourceId,
      sourceRecipeKey: recipe.sourceRecipeKey,
      canonicalUrl: recipe.canonicalUrl,
      title: recipe.normalized.title,
      ingredientCount: recipe.normalized.ingredients.length,
      instructionCount: recipe.normalized.instructions.length,
    })),
    diagnosticCounts: Object.fromEntries(
      [...diagnosticCounts.entries()].sort(([left], [right]) => left.localeCompare(right))
    ),
  };
  const evidenceJson = `${JSON.stringify(evidence, null, 2)}\n`;
  if (options.jsonOut) {
    await mkdir(dirname(options.jsonOut), { recursive: true });
    await writeFile(options.jsonOut, evidenceJson, "utf8");
  }
  if (recipesOut) {
    await mkdir(dirname(recipesOut), { recursive: true });
    await writeFile(recipesOut, `${JSON.stringify(recipes.map((recipe) => ({
      sourceId: recipe.sourceId,
      sourceRecipeKey: recipe.sourceRecipeKey,
      canonicalUrl: recipe.canonicalUrl,
      normalized: recipe.normalized,
    })), null, 2)}\n`, "utf8");
  }
  console.log(evidenceJson.trimEnd());

  if (recipes.length === 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
