import { describe, it, expect } from "vitest";
import { extractJsonLdRecipes } from "../../src/extractors/json-ld.js";

describe("extractJsonLdRecipes", () => {
  it("extracts a simple Recipe from JSON-LD script tag", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@type": "Recipe", "name": "Kanelsnurrer", "recipeIngredient": ["mel", "sukker"]}
      </script>
    </head><body></body></html>`;
    const result = extractJsonLdRecipes(html);
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]["name"]).toBe("Kanelsnurrer");
    expect(result.signals).toContain("json-ld-found");
  });

  it("handles @graph wrapper", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@graph": [
          {"@type": "WebPage", "name": "Page"},
          {"@type": "Recipe", "name": "Rugbrod"}
        ]}
      </script>
    </head><body></body></html>`;
    const result = extractJsonLdRecipes(html);
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]["name"]).toBe("Rugbrod");
    expect(result.signals).toContain("graph-wrapper");
  });

  it("handles @type as array", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@type": ["Recipe", "HowTo"], "name": "Boller"}
      </script>
    </head><body></body></html>`;
    const result = extractJsonLdRecipes(html);
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]["name"]).toBe("Boller");
  });

  it("handles mainEntity wrapper", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@type": "WebPage", "mainEntity": {"@type": "Recipe", "name": "Kartofler"}}
      </script>
    </head><body></body></html>`;
    const result = extractJsonLdRecipes(html);
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]["name"]).toBe("Kartofler");
    expect(result.signals).toContain("main-entity-wrapper");
  });

  it("extracts multiple recipes from one page", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@type": "Recipe", "name": "Recipe1"}
      </script>
      <script type="application/ld+json">
        {"@type": "Recipe", "name": "Recipe2"}
      </script>
    </head><body></body></html>`;
    const result = extractJsonLdRecipes(html);
    expect(result.recipes).toHaveLength(2);
    expect(result.signals).toContain("multiple-recipes");
  });

  it("returns empty for no JSON-LD", () => {
    const html = `<html><body><h1>No recipes here</h1></body></html>`;
    const result = extractJsonLdRecipes(html);
    expect(result.recipes).toHaveLength(0);
  });

  it("handles malformed JSON gracefully", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@type": "Recipe", "name": "Bad JSON",}
      </script>
    </head><body></body></html>`;
    const result = extractJsonLdRecipes(html);
    expect(result.signals.some((s) => s.startsWith("malformed-json"))).toBe(true);
  });

  it("handles JSON-LD that is an array at top level", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        [{"@type": "Recipe", "name": "ArrayRecipe"}]
      </script>
    </head><body></body></html>`;
    const result = extractJsonLdRecipes(html);
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]["name"]).toBe("ArrayRecipe");
  });
});
