import { describe, expect, it } from "vitest";
import { extractWebopskrifterRecipe } from "../../src/custom/webopskrifter.js";
import { DanishJsonLdSourceSession } from "../../src/danish-jsonld/crawler.js";
import { DANISH_JSONLD_SOURCES } from "../../src/danish-jsonld/source-registry.js";
import type { CrawlStore, RecipeDocumentV2Store } from "../../src/storage/store.js";
import type {
  CrawlRunDocument,
  DanishJsonLdCrawlRunDocument,
  PageDocument,
  RecipeDocument,
  RecipeDocumentV2,
} from "../../src/types.js";

const html = `<!doctype html><html lang="da"><body>
  <main itemscope itemtype="https://schema.org/Recipe">
    <h1 itemprop="name">Kartoffelsuppe</h1>
    <p itemprop="description">En nem suppe.</p>
    <meta itemprop="prepTime" content="PT15M">
    <meta itemprop="cookTime" content="PT1H">
    <meta itemprop="totalTime" content="PT1H15M">
    <span itemprop="recipeYield">4 personer</span>
    <ul>
      <li itemprop="recipeIngredient"><span class="num">2</span> <span class="unit">kg</span> <span class="ingredientName">kartofler</span></li>
      <li itemprop="recipeIngredient">salt og peber</li>
    </ul>
    <div itemprop="recipeInstructions"><ol><li>Skræl kartoflerne.</li><li>Kog suppen.</li></ol></div>
    <span itemprop="recipeCategory">Suppe</span>
    <span itemprop="recipeCuisine">Dansk</span>
    <span itemprop="keywords">Nem, Vinter</span>
    <img itemprop="image" src="/images/suppe.jpg">
    <div itemprop="nutrition"><span itemprop="calories">300 kcal</span></div>
  </main>
</body></html>`;

class MemoryStore implements CrawlStore, RecipeDocumentV2Store {
  pages: Array<Omit<PageDocument, "_id">> = [];
  recipes: Array<Omit<RecipeDocumentV2, "_id">> = [];
  async upsertPage(page: Omit<PageDocument, "_id">): Promise<void> { this.pages.push(page); }
  async upsertRecipeV2(recipe: Omit<RecipeDocumentV2, "_id">) {
    this.recipes.push(recipe);
    return { operation: "inserted" as const, contentMatches: [] };
  }
  async insertRecipe(_recipe: Omit<RecipeDocument, "_id">): Promise<void> {}
  async wasPageFetchedSince(): Promise<boolean> { return false; }
  async findFreshPageUrls(): Promise<Set<string>> { return new Set(); }
  async insertCrawlRun(_run: Omit<CrawlRunDocument, "_id">): Promise<void> {}
  async insertDanishJsonLdRun(
    _run: Omit<DanishJsonLdCrawlRunDocument, "_id">
  ): Promise<void> {}
}

describe("Webopskrifter microdata adapter", () => {
  it("normalizes complete Recipe microdata", () => {
    expect(extractWebopskrifterRecipe(
      html,
      "https://www.webopskrifter.dk/opskrifter/suppe"
    )).toMatchObject({
      incompleteCount: 0,
      malformedCount: 0,
      recipe: {
        normalized: {
          title: "Kartoffelsuppe",
          description: "En nem suppe.",
          ingredients: ["2 kg kartofler", "salt og peber"],
          instructions: [
            { position: 1, text: "Skræl kartoflerne." },
            { position: 2, text: "Kog suppen." },
          ],
          prepMinutes: 15,
          cookMinutes: 60,
          totalMinutes: 75,
          yieldText: "4 personer",
          imageUrls: ["https://www.webopskrifter.dk/images/suppe.jpg"],
          categories: ["Suppe"],
          cuisines: ["Dansk"],
          keywords: ["Nem", "Vinter"],
          nutrition: { calories: "300 kcal" },
        },
      },
    });
  });

  it("persists HTML-derived V2 records through the custom session route", async () => {
    const source = DANISH_JSONLD_SOURCES.find((entry) => entry.id === "webopskrifter")!;
    const store = new MemoryStore();
    const session = new DanishJsonLdSourceSession({
      source,
      store,
      crawlRunId: "run",
      crawlAttemptId: "attempt",
      maxPages: 2,
    });
    await session.handleResponse({
      kind: "recipe",
      fetchMode: "cheerio",
      url: "https://www.webopskrifter.dk/opskrifter/suppe",
      statusCode: 200,
      headers: { "content-type": "text/html" },
      body: html,
    });

    expect(store.pages[0]).toMatchObject({ extractionMethod: "html-parsing", recipeCount: 1 });
    expect(store.recipes[0]).toMatchObject({
      extractionMethod: "html-parsing",
      canonicalUrl: "https://webopskrifter.dk/opskrifter/suppe",
    });
    expect(session.observation.persistedRecipes).toBe(1);
  });
});
