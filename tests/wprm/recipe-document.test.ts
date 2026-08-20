import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildWprmRecipeDocumentV2,
  extractWprmRecipes,
  parseWprmApiResponseBody,
} from "../../src/wprm/recipe-document.js";

const fixture = JSON.parse(
  readFileSync(new URL("../fixtures/wprm-recipe.json", import.meta.url), "utf8")
) as unknown[];

describe("WPRM API recipe extraction", () => {
  it("maps a real WPRM payload into the normalized recipe shape", () => {
    const result = extractWprmRecipes(fixture);

    expect(result.malformedCount).toBe(0);
    expect(result.incompleteCount).toBe(0);
    expect(result.recipes).toHaveLength(1);

    const [recipe] = result.recipes;
    expect(recipe.canonicalUrl).toBe("https://www.dadwithapan.com/zesty-cowboy-butter-recipe/");
    expect(recipe.normalized.title).toBe("Cowboy Butter");
    expect(recipe.normalized.description).not.toContain("<p>");
    // Ingredients arrive grouped, and each carries amount, unit, name and notes
    // as separate fields that have to be rejoined into one readable line.
    expect(recipe.normalized.ingredients[0]).toBe(
      "1 cup unsalted butter (softened (2 sticks))"
    );
    expect(recipe.normalized.ingredients.length).toBeGreaterThan(1);
    expect(recipe.normalized.instructions[0]).toMatchObject({
      position: 1,
      text: expect.stringMatching(/^Let the butter sit at room temperature/u),
    });
    expect(recipe.normalized.prepMinutes).toBe(5);
    expect(recipe.normalized.yieldText).toBe("8 servings");
  });

  it("reads JSON rendered by Chromium inside a pre element", () => {
    const escapedJson = JSON.stringify(fixture)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    const body = `<html><body><pre>${escapedJson}</pre></body></html>`;

    expect(parseWprmApiResponseBody(body)).toEqual(fixture);
    expect(parseWprmApiResponseBody("not-json")).toBeUndefined();
  });

  it("builds a stable source-scoped V2 document", () => {
    const recipe = extractWprmRecipes(fixture).recipes[0];
    const input = {
      sourceId: "fixture",
      crawlRunId: "run-1",
      crawlAttemptId: "attempt-1",
      apiPageUrl: "https://example.dk/wp-json/wp/v2/wprm_recipe?page=1",
      extractedAt: new Date("2026-08-19T12:00:00.000Z"),
      recipe,
      language: "da",
      languageConfidence: 0.9,
      languageSignals: ["fixture"],
      extractorVersion: "2.0.0",
      extractionSignals: ["wprm-rest-api"],
    };
    const document = buildWprmRecipeDocumentV2(input);
    const updated = buildWprmRecipeDocumentV2({
      ...input,
      recipe: {
        ...recipe,
        rawRecipe: { ...recipe.rawRecipe, ingredients: [] },
      },
    });

    expect(document).toMatchObject({
      sourceId: "fixture",
      extractionMethod: "wprm-api",
      canonicalUrl: recipe.canonicalUrl,
      pageUrl: input.apiPageUrl,
    });
    expect(document.sourceRecipeKey).toMatch(/^fixture:/u);
    expect(updated.sourceRecipeKey).toBe(document.sourceRecipeKey);
    expect(document.rawRecipe).not.toBe(recipe.rawRecipe);
  });

  it("preserves the API object as rawRecipe rather than the normalized copy", () => {
    const [recipe] = extractWprmRecipes(fixture).recipes;

    // The strict contract keeps exactly what the source served.
    expect(recipe.rawRecipe).toEqual((fixture[0] as { recipe: unknown }).recipe);
  });

  it("rejects a recipe missing any of name, ingredients or instructions", () => {
    const base = JSON.parse(JSON.stringify(fixture[0])) as Record<string, any>;
    const withoutName = JSON.parse(JSON.stringify(base));
    withoutName.recipe.name = "";
    const withoutIngredients = JSON.parse(JSON.stringify(base));
    withoutIngredients.recipe.ingredients = [];
    const withoutInstructions = JSON.parse(JSON.stringify(base));
    withoutInstructions.recipe.instructions = [];

    const result = extractWprmRecipes([withoutName, withoutIngredients, withoutInstructions]);

    expect(result.recipes).toEqual([]);
    expect(result.incompleteCount).toBe(3);
  });

  it("reports a payload that is not an array of posts as malformed", () => {
    expect(extractWprmRecipes({ code: "rest_no_route" }).malformedCount).toBe(1);
    expect(extractWprmRecipes([{ id: 1 }]).malformedCount).toBe(1);
  });

  it("skips a post whose link is missing rather than inventing one", () => {
    const post = JSON.parse(JSON.stringify(fixture[0])) as Record<string, any>;
    delete post.link;

    const result = extractWprmRecipes([post]);

    expect(result.recipes).toEqual([]);
    expect(result.malformedCount).toBe(1);
  });
});
