import { describe, expect, it } from "vitest";
import { gunzipSync } from "node:zlib";
import {
  buildRecipeDocumentV2,
  extractCompleteJsonLdRecipes,
  gzipJsonLdScripts,
} from "../../src/danish-jsonld/recipe-document.js";

const completeRecipe = {
  "@context": "https://schema.org",
  "@type": "Recipe",
  "@id": "https://example.dk/opskrift/kage#recipe",
  name: "  Sommer kage  ",
  description: "En   enkel kage",
  recipeIngredient: ["2 æg", "200 g sukker"],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Pisk æg og sukker." },
    { "@type": "HowToStep", text: "Bag kagen." },
  ],
  prepTime: "PT15M",
  cookTime: "PT30M",
  totalTime: "PT45M",
  recipeYield: "4 portioner",
  image: ["https://images.example.dk/kage.jpg"],
  recipeCategory: ["Kage", "Dessert"],
  recipeCuisine: "Dansk",
  keywords: "sommer, kage",
  nutrition: { calories: "300 kcal" },
};

describe("Danish JSON-LD RecipeDocumentV2", () => {
  it("normalizes complete Recipe JSON-LD without mutating the raw parsed node", () => {
    const rawRecipe = structuredClone(completeRecipe);

    const document = buildRecipeDocumentV2({
      sourceId: "example",
      canonicalUrl: "https://example.dk/opskrift/kage",
      pageUrl: "https://example.dk/opskrift/kage?utm_source=test",
      crawlRunId: "run-1",
      crawlAttemptId: "attempt-1",
      extractedAt: new Date("2026-08-13T08:00:00.000Z"),
      rawRecipe,
      language: "da",
      languageConfidence: 1,
      languageSignals: ["recipe-inLanguage"],
      extractorVersion: "2.0.0",
      extractionSignals: ["json-ld-found"],
    });

    expect(document.rawRecipe).toEqual(completeRecipe);
    expect(document.rawRecipe).not.toBe(rawRecipe);
    expect(document.normalized).toEqual({
      title: "Sommer kage",
      description: "En enkel kage",
      ingredients: ["2 æg", "200 g sukker"],
      instructions: [
        { position: 1, text: "Pisk æg og sukker." },
        { position: 2, text: "Bag kagen." },
      ],
      prepMinutes: 15,
      cookMinutes: 30,
      totalMinutes: 45,
      yieldText: "4 portioner",
      imageUrls: ["https://images.example.dk/kage.jpg"],
      categories: ["Kage", "Dessert"],
      cuisines: ["Dansk"],
      keywords: ["sommer", "kage"],
      nutrition: { calories: "300 kcal" },
    });
    expect(document.sourceRecipeKey).toMatch(/^example:/);
    expect(document.sourceHash).not.toBe(document.contentHash);
  });

  it("uses source, canonical URL, upstream id, and normalized identity deterministically", () => {
    const input = {
      sourceId: "example",
      canonicalUrl: "https://example.dk/opskrift/kage",
      pageUrl: "https://example.dk/opskrift/kage",
      crawlRunId: "run-1",
      crawlAttemptId: "attempt-1",
      extractedAt: new Date("2026-08-13T08:00:00.000Z"),
      rawRecipe: completeRecipe,
      language: "da",
      languageConfidence: 1,
      languageSignals: [],
      extractorVersion: "2.0.0",
      extractionSignals: [],
    };

    const first = buildRecipeDocumentV2(input);
    const reordered = buildRecipeDocumentV2({
      ...input,
      rawRecipe: {
        ...completeRecipe,
        recipeIngredient: ["2 æg", "200 g sukker"],
      },
    });
    const differentCanonicalUrl = buildRecipeDocumentV2({
      ...input,
      canonicalUrl: "https://example.dk/opskrift/anden-kage",
    });
    const differentSource = buildRecipeDocumentV2({
      ...input,
      sourceId: "other-source",
    });

    expect(reordered.sourceRecipeKey).toBe(first.sourceRecipeKey);
    expect(differentCanonicalUrl.sourceRecipeKey).not.toBe(first.sourceRecipeKey);
    expect(differentSource.sourceRecipeKey).not.toBe(first.sourceRecipeKey);
  });

  it("preserves exact script text while rejecting malformed and incomplete JSON-LD", () => {
    const exactScript = `\n  {"@type":"Recipe","name":"Kage","recipeIngredient":["1 æg"],"recipeInstructions":["Bag."]}\n`;
    const html = `<script type="application/ld+json">${exactScript}</script>
      <script type="application/ld+json">{"@type":"Recipe","name":"Mangler ingredienser"}</script>
      <script type="application/ld+json">{"@type":"Recipe",}</script>`;

    const result = extractCompleteJsonLdRecipes(html);

    expect(result.rawScripts).toEqual([
      exactScript,
      '{"@type":"Recipe","name":"Mangler ingredienser"}',
      '{"@type":"Recipe",}',
    ]);
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]).toEqual({
      "@type": "Recipe",
      name: "Kage",
      recipeIngredient: ["1 æg"],
      recipeInstructions: ["Bag."],
    });
    expect(result.rejectedReasons).toEqual([
      "incomplete-json-ld",
      "malformed-json-ld",
    ]);
    expect(
      gzipJsonLdScripts(result.rawScripts).map((script) =>
        gunzipSync(script.buffer).toString("utf8")
      )
    ).toEqual(result.rawScripts);
  });

  it("retains every complete recipe when a page has multiple JSON-LD scripts", () => {
    const result = extractCompleteJsonLdRecipes(`
      <script type="application/ld+json">{"@type":"Recipe","name":"Første","recipeIngredient":["1 æg"],"recipeInstructions":["Bag."]}</script>
      <script type="application/ld+json">{"@type":"Recipe","name":"Anden","recipeIngredient":["2 æg"],"recipeInstructions":["Rør."]}</script>
    `);

    expect(result.recipes.map((recipe) => recipe["name"])).toEqual([
      "Første",
      "Anden",
    ]);
  });

  it("refuses to build a V2 document from incomplete JSON-LD", () => {
    expect(() =>
      buildRecipeDocumentV2({
        sourceId: "example",
        canonicalUrl: "https://example.dk/opskrift/ufuldstændig",
        pageUrl: "https://example.dk/opskrift/ufuldstændig",
        crawlRunId: "run-1",
        crawlAttemptId: "attempt-1",
        extractedAt: new Date("2026-08-13T08:00:00.000Z"),
        rawRecipe: { "@type": "Recipe", name: "Mangler felter" },
        language: "da",
        languageConfidence: 1,
        languageSignals: [],
        extractorVersion: "2.0.0",
        extractionSignals: [],
      })
    ).toThrow("Complete Recipe JSON-LD requires title, ingredients, and instructions");
  });
});
