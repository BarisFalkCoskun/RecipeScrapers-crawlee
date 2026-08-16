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

  it("normalizes nested ingredients and numeric-keyed instruction maps", () => {
    const rawRecipe = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Lammerullepølse",
      recipeIngredient: [{
        "0": "1 lammeslag",
        "1": "1 håndfuld persille",
        "3": "Friskkværnet peber",
      }],
      recipeInstructions: {
        "0": { "@type": "HowToStep", text: "Lav saltlagen." },
        "2": { "@type": "HowToStep", text: "Rul slaget stramt." },
      },
    };
    const html = `<script type="application/ld+json">${JSON.stringify(rawRecipe)}</script>`;

    const extraction = extractCompleteJsonLdRecipes(html);
    expect(extraction.incompleteJsonLdCount).toBe(0);
    expect(extraction.recipes).toEqual([rawRecipe]);

    const document = buildRecipeDocumentV2({
      sourceId: "madoghave",
      canonicalUrl: "https://madoghave.dk/opskrift/lammerullepoelse",
      pageUrl: "https://madoghave.dk/recipe-items/lammerullepoelse/",
      crawlRunId: "run-nested",
      crawlAttemptId: "attempt-nested",
      extractedAt: new Date("2026-08-13T08:00:00.000Z"),
      rawRecipe,
      language: "da",
      languageConfidence: 1,
      languageSignals: [],
      extractorVersion: "2.0.0",
      extractionSignals: ["json-ld-found"],
    });
    expect(document.normalized.ingredients).toEqual([
      "1 lammeslag",
      "1 håndfuld persille",
      "Friskkværnet peber",
    ]);
    expect(document.normalized.instructions).toEqual([
      { position: 1, text: "Lav saltlagen." },
      { position: 2, text: "Rul slaget stramt." },
    ]);
  });

  it("uses source, canonical URL, and upstream id deterministically", () => {
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

  it("keeps upstream-id identity stable when ingredients and instructions change", () => {
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
    const updated = buildRecipeDocumentV2({
      ...input,
      rawRecipe: {
        ...completeRecipe,
        recipeIngredient: ["3 æg"],
        recipeInstructions: ["Pisk længe.", "Bag ved 180 grader."],
      },
    });
    expect(updated.sourceRecipeKey).toBe(buildRecipeDocumentV2(input).sourceRecipeKey);
  });

  it("uses the stable page identity without @id and adds a discriminator only for multiple recipes", () => {
    const withoutId = { ...completeRecipe } as Record<string, unknown>;
    delete withoutId["@id"];
    const input = {
      sourceId: "example",
      canonicalUrl: "https://example.dk/opskrift/menu",
      pageUrl: "https://example.dk/opskrift/menu",
      crawlRunId: "run-1",
      crawlAttemptId: "attempt-1",
      extractedAt: new Date("2026-08-13T08:00:00.000Z"),
      rawRecipe: withoutId,
      language: "da",
      languageConfidence: 1,
      languageSignals: [],
      extractorVersion: "2.0.0",
      extractionSignals: [],
    };
    const single = buildRecipeDocumentV2(input);
    const updatedSingle = buildRecipeDocumentV2({
      ...input,
      rawRecipe: {
        ...withoutId,
        recipeIngredient: ["4 æg"],
        recipeInstructions: ["Rør.", "Bag."],
      },
    });
    const first = buildRecipeDocumentV2({ ...input, pageRecipeDiscriminator: "recipe-1" });
    const second = buildRecipeDocumentV2({ ...input, pageRecipeDiscriminator: "recipe-2" });

    expect(updatedSingle.sourceRecipeKey).toBe(single.sourceRecipeKey);
    expect(first.sourceRecipeKey).not.toBe(second.sourceRecipeKey);
    expect(first.sourceRecipeKey).not.toBe(single.sourceRecipeKey);
  });

  it("repairs a trailing comma before a closing bracket", () => {
    const raw = `{
      "@context": "https://schema.org",
      "@type": "Recipe",
      "name": "Kage",
      "recipeIngredient": ["1 æg", "2 dl mel",        ],
      "recipeInstructions": [{ "@type": "HowToStep", "text": "Bag." },]
    }`;
    const result = extractCompleteJsonLdRecipes(
      `<script type="application/ld+json">${raw}</script>`
    );

    expect(result.malformedJsonLdCount).toBe(0);
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]?.["recipeIngredient"]).toEqual(["1 æg", "2 dl mel"]);
  });

  it("leaves a comma inside a quoted value alone", () => {
    const raw = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Kage, med krymmel ]",
      recipeIngredient: ["1 æg, stort"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Bag, derefter køl ]" }],
    });
    const result = extractCompleteJsonLdRecipes(
      `<script type="application/ld+json">${raw}</script>`
    );

    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]?.["name"]).toBe("Kage, med krymmel ]");
  });

  it("still rejects JSON that a trailing-comma repair cannot fix", () => {
    const result = extractCompleteJsonLdRecipes(
      `<script type="application/ld+json">{"@type":"Recipe", "name": }</script>`
    );

    expect(result.malformedJsonLdCount).toBe(1);
    expect(result.recipes).toEqual([]);
  });

  it("ignores an empty JSON-LD script instead of calling it malformed", () => {
    const complete = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Kage",
      recipeIngredient: ["1 æg"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Bag." }],
    };
    const result = extractCompleteJsonLdRecipes(
      `<script type="application/ld+json">\n\n</script>
       <script type="application/ld+json">   </script>
       <script type="application/ld+json">${JSON.stringify(complete)}</script>`
    );

    // A blank script makes no recipe claim, so it is not a rejection.
    expect(result.recipes).toHaveLength(1);
    expect(result.malformedJsonLdCount).toBe(0);
    expect(result.rejectedReasons).not.toContain("malformed-json-ld");
  });

  it("preserves exact script text while rejecting malformed and incomplete JSON-LD", () => {
    const exactScript = `\n  {"@type":"Recipe","name":"Kage","recipeIngredient":["1 æg"],"recipeInstructions":["Bag."]}\n`;
    const html = `<script type="application/ld+json">${exactScript}</script>
      <script type="application/ld+json">{"@type":"Recipe","name":"Mangler ingredienser"}</script>
      <script type="application/ld+json">{"@type":"Recipe" "name":"Uparsbar"}</script>`;

    const result = extractCompleteJsonLdRecipes(html);

    expect(result.rawScripts).toEqual([
      exactScript,
      '{"@type":"Recipe","name":"Mangler ingredienser"}',
      '{"@type":"Recipe" "name":"Uparsbar"}',
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
    expect(result.malformedJsonLdCount).toBe(1);
    expect(result.incompleteJsonLdCount).toBe(1);
    expect(result.signals).toContain("malformed-json-ld");
    expect(
      gzipJsonLdScripts(result.rawScripts).map((script) =>
        gunzipSync(script.buffer).toString("utf8")
      )
    ).toEqual(result.rawScripts);
  });

  it("recovers Recipe JSON-LD containing literal control characters without changing the raw script", () => {
    const exactScript = `{"@type":"Recipe","name":"Hummus","recipeCategory":"
      Vegetarisk,
      Dips","recipeIngredient":["1 dåse kikærter"],"recipeInstructions":["Blend."]}`;
    const result = extractCompleteJsonLdRecipes(
      `<script type="application/ld+json">${exactScript}</script>`
    );

    expect(result.rawScripts).toEqual([exactScript]);
    expect(result.recipes).toEqual([
      {
        "@type": "Recipe",
        name: "Hummus",
        recipeCategory: "\n      Vegetarisk,\n      Dips",
        recipeIngredient: ["1 dåse kikærter"],
        recipeInstructions: ["Blend."],
      },
    ]);
    expect(result.repairedJsonLdCount).toBe(1);
    expect(result.malformedJsonLdCount).toBe(0);
    expect(result.signals).toContain("json-ld-control-character-repaired");
  });

  it("parses exact JSON-LD script text without decoding HTML entities", () => {
    const result = extractCompleteJsonLdRecipes(`
      <script type="application/ld+json">{"@type":"Recipe","name":"Bread &amp; Butter","recipeIngredient":["1 æg"],"recipeInstructions":["Bag."]}</script>
      <script type="application/ld+json">{"@type":"Recipe","name":"Siger &quot;hej&quot;","recipeIngredient":["2 æg"],"recipeInstructions":["Rør."]}</script>
    `);

    expect(result.recipes.map((recipe) => recipe["name"])).toEqual([
      "Bread &amp; Butter",
      "Siger &quot;hej&quot;",
    ]);
    expect(result.malformedJsonLdCount).toBe(0);
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
