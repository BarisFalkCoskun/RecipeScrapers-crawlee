import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { extractHtmlFallback } from "../../src/extractors/html-fallback.js";

function $(html: string) {
  return cheerio.load(html);
}

describe("extractHtmlFallback", () => {
  it("extracts title from h1", () => {
    const result = extractHtmlFallback($("<html><body><h1>Kanelsnurrer</h1></body></html>"));
    expect(result.recipes[0]?.["name"]).toBe("Kanelsnurrer");
    expect(result.recipes[0]?.["title"]).toBe("Kanelsnurrer");
    expect(result.signals).toContain("heuristic-title-from-h1");
  });

  it("extracts title from og:title if no h1", () => {
    const result = extractHtmlFallback($(
      '<html><head><meta property="og:title" content="Rugbrod Opskrift"></head><body></body></html>'
    ));
    expect(result.recipes[0]?.["name"]).toBe("Rugbrod Opskrift");
    expect(result.recipes[0]?.["title"]).toBe("Rugbrod Opskrift");
    expect(result.signals).toContain("heuristic-title-from-meta");
  });

  it("extracts ingredients from ul near ingredienser keyword", () => {
    const html = `<html><body>
      <h2>Ingredienser</h2>
      <ul><li>200g mel</li><li>100g sukker</li><li>2 aeg</li></ul>
    </body></html>`;
    const result = extractHtmlFallback($(html));
    expect(result.recipes[0]?.["recipeIngredient"]).toEqual(["200g mel", "100g sukker", "2 aeg"]);
    expect(result.recipes[0]?.["ingredients"]).toEqual(["200g mel", "100g sukker", "2 aeg"]);
    expect(result.signals).toContain("heuristic-ingredients-from-nearby-content");
  });

  it("extracts instructions from ol", () => {
    const html = `<html><body>
      <h2>Fremgangsmaade</h2>
      <ol><li>Bland mel og sukker</li><li>Tilsaet aeg</li></ol>
    </body></html>`;
    const result = extractHtmlFallback($(html));
    expect(result.recipes[0]?.["recipeInstructions"]).toEqual(["Bland mel og sukker", "Tilsaet aeg"]);
    expect(result.recipes[0]?.["instructions"]).toEqual(["Bland mel og sukker", "Tilsaet aeg"]);
    expect(result.signals).toContain("heuristic-instructions-from-nearby-content");
  });

  it("reports missing fields in signals", () => {
    const result = extractHtmlFallback($("<html><body><p>Nothing here</p></body></html>"));
    expect(result.signals).toContain("missing-title");
    expect(result.signals).toContain("missing-ingredients");
    expect(result.signals).toContain("missing-instructions");
  });

  it("returns partial confidence based on fields found", () => {
    const html = `<html><body><h1>Kage</h1></body></html>`;
    const result = extractHtmlFallback($(html));
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("extracts from microdata (schema.org/Recipe)", () => {
    const html = `<html><body>
      <div itemscope itemtype="https://schema.org/Recipe">
        <h1 itemprop="name">Rugbrod</h1>
        <span itemprop="recipeIngredient">500g rugmel</span>
        <span itemprop="recipeIngredient">300ml vand</span>
        <div itemprop="recipeInstructions">Bland det hele</div>
      </div>
    </body></html>`;
    const result = extractHtmlFallback($(html));
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]["name"]).toBe("Rugbrod");
    expect(result.recipes[0]["recipeIngredient"]).toEqual(["500g rugmel", "300ml vand"]);
    expect(result.recipes[0]["recipeInstructions"]).toEqual(["Bland det hele"]);
    expect(result.signals).toContain("microdata-found");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("prefers microdata over heuristic when both present", () => {
    const html = `<html><body>
      <div itemscope itemtype="http://schema.org/Recipe">
        <span itemprop="name">Microdata Recipe</span>
      </div>
      <h1>Heuristic Title</h1>
      <h2>Ingredienser</h2>
      <ul><li>mel</li></ul>
    </body></html>`;
    const result = extractHtmlFallback($(html));
    expect(result.signals).toContain("microdata-found");
    expect(result.recipes[0]["name"]).toBe("Microdata Recipe");
  });

  it("falls back to heuristic when microdata has no recipe", () => {
    const html = `<html><body>
      <div itemscope itemtype="https://schema.org/Article">
        <span itemprop="name">Not a recipe</span>
      </div>
      <h1>Kage</h1>
    </body></html>`;
    const result = extractHtmlFallback($(html));
    expect(result.signals).not.toContain("microdata-found");
    expect(result.recipes[0]?.["title"]).toBe("Kage");
  });

  it("extracts ingredients and instructions from nearby paragraphs", () => {
    const html = `<html><body>
      <h2>Ingredienser</h2>
      <div>
        <p>250 g mel</p>
        <p>2 dl maelk</p>
      </div>
      <h2>Tilberedning</h2>
      <div>
        <p>Ror ingredienserne sammen.</p>
        <p>Bag i 25 minutter.</p>
      </div>
    </body></html>`;
    const result = extractHtmlFallback($(html));
    expect(result.recipes[0]?.["recipeIngredient"]).toEqual(["250 g mel", "2 dl maelk"]);
    expect(result.recipes[0]?.["recipeInstructions"]).toEqual([
      "Ror ingredienserne sammen.",
      "Bag i 25 minutter.",
    ]);
  });

  it("extracts extra microdata fields from meta-like content", () => {
    const html = `<html><body>
      <article itemscope itemtype="https://schema.org/Recipe">
        <meta itemprop="name" content="Lagkage" />
        <meta itemprop="prepTime" content="PT20M" />
        <meta itemprop="cookTime" content="PT30M" />
        <meta itemprop="recipeYield" content="8 portioner" />
        <meta itemprop="description" content="Festkage" />
        <span itemprop="recipeIngredient">1 bund</span>
        <div itemprop="recipeInstructions">
          <ol><li>Pisk flode</li><li>Saml kagen</li></ol>
        </div>
      </article>
    </body></html>`;
    const result = extractHtmlFallback($(html));
    expect(result.recipes[0]?.["name"]).toBe("Lagkage");
    expect(result.recipes[0]?.["prepTime"]).toBe("PT20M");
    expect(result.recipes[0]?.["cookTime"]).toBe("PT30M");
    expect(result.recipes[0]?.["recipeYield"]).toBe("8 portioner");
    expect(result.recipes[0]?.["description"]).toBe("Festkage");
    expect(result.recipes[0]?.["recipeInstructions"]).toEqual([
      "Pisk flode",
      "Saml kagen",
    ]);
  });

  it("extracts heuristic time and yield labels", () => {
    const html = `<html><body>
      <h1>Fastelavnsboller</h1>
      <strong>Forberedelsestid</strong><span>20 min</span>
      <strong>Tilberedningstid</strong><span>15 min</span>
      <strong>Portioner</strong><span>12 stk</span>
    </body></html>`;
    const result = extractHtmlFallback($(html));
    expect(result.recipes[0]?.["prepTime"]).toBe("20 min");
    expect(result.recipes[0]?.["cookTime"]).toBe("15 min");
    expect(result.recipes[0]?.["recipeYield"]).toBe("12 stk");
  });
});
