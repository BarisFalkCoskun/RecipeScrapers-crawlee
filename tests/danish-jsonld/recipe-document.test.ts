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

  it("decodes HTML entities in normalized JSON-LD text while preserving raw provenance", () => {
    const rawRecipe = {
      ...completeRecipe,
      name: "Salt &amp; peber",
      recipeIngredient: ["&nbsp; Salt", "1 &frac12; dl vand"],
      recipeInstructions: [{ "@type": "HowToStep", text: "<strong>Rør</strong> &amp; smag til." }],
      recipeCategory: "Morgenmad, Brunch, Dessert",
      recipeCuisine: "Europæisk, Skandinavisk",
      prepTime: "PT0M",
    };
    const document = buildRecipeDocumentV2({
      sourceId: "ferrerorocher",
      canonicalUrl: "https://example.dk/opskrift",
      pageUrl: "https://example.dk/opskrift",
      crawlRunId: "run-entities",
      crawlAttemptId: "attempt-entities",
      extractedAt: new Date("2026-08-19T20:00:00.000Z"),
      rawRecipe,
      language: "da",
      languageConfidence: 1,
      languageSignals: [],
      extractorVersion: "2.0.0",
      extractionSignals: [],
    });

    expect(document.rawRecipe).toEqual(rawRecipe);
    expect(document.normalized).toMatchObject({
      title: "Salt & peber",
      ingredients: ["Salt", "1 ½ dl vand"],
      instructions: [{ position: 1, text: "Rør & smag til." }],
      categories: ["Morgenmad", "Brunch", "Dessert"],
      cuisines: ["Europæisk", "Skandinavisk"],
    });
    expect(document.normalized).not.toHaveProperty("prepMinutes");
  });

  it("keeps the image out of an array its source leaked markup into", () => {
    // bornemenuen's template drops an unescaped quote, so its ImageObject url
    // is ["/sites/.../Karrysalat copy2.jpg", "hvide bønner og æble\" />"] —
    // the second entry is a fragment of its own page. Legacy discards the whole
    // field, taking the real image with it.
    const document = buildRecipeDocumentV2({
      sourceId: "example",
      canonicalUrl: "https://example.dk/opskrift/karrysalat",
      pageUrl: "https://example.dk/opskrift/karrysalat",
      crawlRunId: "run-leaky-image",
      crawlAttemptId: "attempt-leaky-image",
      extractedAt: new Date("2026-08-24T08:00:00.000Z"),
      rawRecipe: {
        ...structuredClone(completeRecipe),
        image: {
          "@type": "ImageObject",
          url: ["/sites/default/files/2024-05/Karrysalat%20copy2.jpg", "hvide bønner og æble\" />"],
        },
      },
      language: "da",
      languageConfidence: 1,
      languageSignals: [],
      extractorVersion: "2.0.0",
      extractionSignals: [],
    });

    expect(document.normalized.imageUrls)
      .toEqual(["/sites/default/files/2024-05/Karrysalat%20copy2.jpg"]);
  });

  it("still accepts the image shapes sources ordinarily publish", () => {
    const build = (image: unknown) => buildRecipeDocumentV2({
      sourceId: "example",
      canonicalUrl: "https://example.dk/opskrift/kage",
      pageUrl: "https://example.dk/opskrift/kage",
      crawlRunId: "run-images",
      crawlAttemptId: "attempt-images",
      extractedAt: new Date("2026-08-24T08:00:00.000Z"),
      rawRecipe: { ...structuredClone(completeRecipe), image },
      language: "da",
      languageConfidence: 1,
      languageSignals: [],
      extractorVersion: "2.0.0",
      extractionSignals: [],
    }).normalized.imageUrls;

    expect(build("https://images.example.dk/kage.jpg")).toEqual(["https://images.example.dk/kage.jpg"]);
    expect(build("//cdn.example.dk/kage.jpg")).toEqual(["//cdn.example.dk/kage.jpg"]);
    expect(build("/wp-content/kage.jpg")).toEqual(["/wp-content/kage.jpg"]);
    expect(build(["https://a.dk/1.jpg", "https://a.dk/2.jpg"]))
      .toEqual(["https://a.dk/1.jpg", "https://a.dk/2.jpg"]);
    // A caption is not a reference to anything.
    expect(build("En dejlig kage med marcipan")).toEqual([]);
  });

  it("treats a negative ISO duration as no duration rather than a huge one", () => {
    // gatheranddine publishes prepTime "PT-29787046.716667M", a clock
    // subtraction made the wrong way round that drifts with real time. The
    // loose duration fallbacks would scrape 29,787,047 minutes out of it and
    // store a 56-year prep time.
    const document = buildRecipeDocumentV2({
      sourceId: "example",
      canonicalUrl: "https://example.dk/opskrift/spanakopita",
      pageUrl: "https://example.dk/opskrift/spanakopita",
      crawlRunId: "run-negative-duration",
      crawlAttemptId: "attempt-negative-duration",
      extractedAt: new Date("2026-08-20T08:00:00.000Z"),
      rawRecipe: {
        ...structuredClone(completeRecipe),
        prepTime: "PT-29787046.716667M",
        cookTime: "PT30M",
        totalTime: "PT2H",
      },
      language: "da",
      languageConfidence: 1,
      languageSignals: [],
      extractorVersion: "2.0.0",
      extractionSignals: [],
    });

    expect(document.normalized).not.toHaveProperty("prepMinutes");
    // The durations the source states correctly are still read.
    expect(document.normalized).toMatchObject({ cookMinutes: 30, totalMinutes: 120 });
  });

  it("reports no duration rather than a fragment of a malformed one", () => {
    const build = (prepTime: string) => buildRecipeDocumentV2({
      sourceId: "example",
      canonicalUrl: "https://example.dk/opskrift/kage",
      pageUrl: "https://example.dk/opskrift/kage",
      crawlRunId: "run-malformed",
      crawlAttemptId: "attempt-malformed",
      extractedAt: new Date("2026-08-21T08:00:00.000Z"),
      rawRecipe: { ...structuredClone(completeRecipe), prepTime },
      language: "da",
      languageConfidence: 1,
      languageSignals: [],
      extractorVersion: "2.0.0",
      extractionSignals: [],
    }).normalized.prepMinutes;

    // These are the malformed spellings the sources actually publish, and the
    // loose patterns read every one of them correctly. Rejecting unparseable
    // ISO outright would turn all four into no duration at all.
    expect(build("PT20 minM")).toBe(20);
    expect(build("P10M")).toBe(10);
    expect(build("PTH1H30M")).toBe(90);
    expect(build("P20M")).toBe(20);
    // An empty duration stays empty.
    expect(build("P")).toBeUndefined();
    // Human-written durations are not ISO and still parse.
    expect(build("1 time 30 minutter")).toBe(90);
    expect(build("45 min")).toBe(45);
  });

  it("still reads ordinary ISO durations that carry no negative component", () => {
    const build = (prepTime: string) => buildRecipeDocumentV2({
      sourceId: "example",
      canonicalUrl: "https://example.dk/opskrift/kage",
      pageUrl: "https://example.dk/opskrift/kage",
      crawlRunId: "run-durations",
      crawlAttemptId: "attempt-durations",
      extractedAt: new Date("2026-08-20T08:00:00.000Z"),
      rawRecipe: { ...structuredClone(completeRecipe), prepTime },
      language: "da",
      languageConfidence: 1,
      languageSignals: [],
      extractorVersion: "2.0.0",
      extractionSignals: [],
    }).normalized.prepMinutes;

    expect(build("PT1H30M")).toBe(90);
    // A very long duration can be real: one source states a ninety-day
    // Trækketid for a plum liqueur, so only the negative sign disqualifies one.
    expect(build("PT129620M")).toBe(129620);
    // gastrotools writes the hour designator in Danish. Its own totals confirm
    // the reading: 15t30M prep plus 1t45M cooking is the 17t15M it states.
    expect(build("PT15t30M")).toBe(930);
    expect(build("PT1t45M")).toBe(105);
    expect(build("PT17t15M")).toBe(1035);
    // A trailing Danish designator carries hours too: PT2t is two timer.
    expect(build("PT2t")).toBe(120);
    // Whitespace inside a duration is a formatting slip, not a new meaning.
    expect(build("PT 1H 30M")).toBe(90);
    expect(build("PT45M")).toBe(45);
    expect(build("P0DT2H")).toBe(120);
    // A hyphen outside an ISO duration is a range, not a negative component:
    // it still parses, reading the number the unit belongs to.
    expect(build("1-2 timer")).toBe(120);
  });

  it("preserves inline text adjacency while spacing HTML line breaks", () => {
    const document = buildRecipeDocumentV2({
      sourceId: "nutella",
      canonicalUrl: "https://example.dk/opskrift",
      pageUrl: "https://example.dk/opskrift",
      crawlRunId: "run-markup",
      crawlAttemptId: "attempt-markup",
      extractedAt: new Date("2026-08-19T20:00:00.000Z"),
      rawRecipe: {
        ...completeRecipe,
        name: "Veganske crepes med<br>Nutella<sup>®</sup>",
        recipeIngredient: ["60 g Nutella<sup>®</sup> (15 g/portion)"],
      },
      language: "da",
      languageConfidence: 1,
      languageSignals: [],
      extractorVersion: "2.0.0",
      extractionSignals: [],
    });

    expect(document.normalized.title).toBe("Veganske crepes med Nutella®");
    expect(document.normalized.ingredients).toEqual(["60 g Nutella® (15 g/portion)"]);
  });

  it("supports legacy numeric-only yields without changing raw provenance", () => {
    const document = buildRecipeDocumentV2({
      sourceId: "kagerogsager",
      canonicalUrl: "https://kagerogsager.dk/blogs/gratis-opskrifter/tiramisusnitter",
      pageUrl: "https://kagerogsager.dk/blogs/gratis-opskrifter/tiramisusnitter",
      crawlRunId: "run-1",
      crawlAttemptId: "attempt-1",
      extractedAt: new Date("2026-08-19T19:00:00.000Z"),
      rawRecipe: { ...completeRecipe, recipeYield: "16 store stykker" },
      language: "da",
      languageConfidence: 1,
      languageSignals: ["domain-da"],
      extractorVersion: "2.0.0",
      extractionSignals: ["strict-json-ld-only"],
      numericYieldOnly: true,
    });

    expect(document.rawRecipe.recipeYield).toBe("16 store stykker");
    expect(document.normalized.yieldText).toBe("16");
  });

  it("normalizes the first value from an array-shaped recipe yield", () => {
    const document = buildRecipeDocumentV2({
      sourceId: "bornholms",
      canonicalUrl: "https://bornholms.dk/opskrifter/hummersuppe",
      pageUrl: "https://bornholms.dk/opskrifter/hummersuppe/",
      crawlRunId: "run-1",
      crawlAttemptId: "attempt-1",
      extractedAt: new Date("2026-08-19T20:00:00.000Z"),
      rawRecipe: { ...completeRecipe, recipeYield: ["4"] },
      language: "da",
      languageConfidence: 1,
      languageSignals: ["domain-da"],
      extractorVersion: "2.0.0",
      extractionSignals: ["strict-json-ld-only"],
    });

    expect(document.rawRecipe.recipeYield).toEqual(["4"]);
    expect(document.normalized.yieldText).toBe("4");
  });

  it("normalizes Danish, English, and extended ISO duration forms", () => {
    const document = buildRecipeDocumentV2({
      sourceId: "semper",
      canonicalUrl: "https://semper.dk/opskrift",
      pageUrl: "https://semper.dk/opskrift",
      crawlRunId: "run-duration",
      crawlAttemptId: "attempt-duration",
      extractedAt: new Date("2026-08-19T20:00:00.000Z"),
      rawRecipe: {
        ...completeRecipe,
        prepTime: "1 time 30 min",
        cookTime: "2 hours 15 minutes",
        totalTime: "P0Y0M0DT3H45M0S",
      },
      language: "da",
      languageConfidence: 1,
      languageSignals: [],
      extractorVersion: "2.0.0",
      extractionSignals: [],
    });

    expect(document.normalized).toMatchObject({
      prepMinutes: 90,
      cookMinutes: 135,
      totalMinutes: 225,
    });
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

  it("preserves an ingredient array boundary across presentation newlines", () => {
    const rawRecipe = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Smørrebrød",
      recipeIngredient: [
        "2 skiver rugbrød, gerne Signaturbrød\nRestaurant Gilleleje Havn",
        "saltagurker",
      ],
      recipeInstructions: [{ "@type": "HowToStep", text: "Anret brødet." }],
    };

    const document = buildRecipeDocumentV2({
      sourceId: "schulstad",
      canonicalUrl: "https://schulstad.dk/opskrifter/smoerrebroed",
      pageUrl: "https://www.schulstad.dk/opskrifter/smoerrebroed/",
      crawlRunId: "run-ingredient-newline",
      crawlAttemptId: "attempt-ingredient-newline",
      extractedAt: new Date("2026-08-19T00:00:00.000Z"),
      rawRecipe,
      language: "da",
      languageConfidence: 1,
      languageSignals: [],
      extractorVersion: "2.0.0",
      extractionSignals: [],
    });

    expect(document.normalized.ingredients).toEqual([
      "2 skiver rugbrød, gerne Signaturbrød Restaurant Gilleleje Havn",
      "saltagurker",
    ]);
  });

  it("preserves numeric Schema.org recipeYield values", () => {
    const rawRecipe = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Citronmåne",
      recipeYield: 2,
      recipeIngredient: ["2 citroner"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Bag kagen." }],
    };

    const document = buildRecipeDocumentV2({
      sourceId: "jonsmadklub",
      canonicalUrl: "https://jonsmadklub.dk/blogs/opskrifter/citronmaane",
      pageUrl: "https://jonsmadklub.dk/blogs/opskrifter/citronmaane",
      crawlRunId: "run-numeric-yield",
      crawlAttemptId: "attempt-numeric-yield",
      extractedAt: new Date("2026-08-19T00:00:00.000Z"),
      rawRecipe,
      language: "da",
      languageConfidence: 1,
      languageSignals: [],
      extractorVersion: "2.0.0",
      extractionSignals: [],
    });

    expect(document.normalized.yieldText).toBe("2");
  });

  it("preserves array step boundaries and splits a single instruction string like legacy", () => {
    const baseInput = {
      sourceId: "example",
      canonicalUrl: "https://example.dk/opskrift",
      pageUrl: "https://example.dk/opskrift",
      crawlRunId: "run-instructions",
      crawlAttemptId: "attempt-instructions",
      extractedAt: new Date("2026-08-19T20:00:00.000Z"),
      language: "da",
      languageConfidence: 1,
      languageSignals: [],
      extractorVersion: "2.0.0",
      extractionSignals: [],
    };
    const arrayDocument = buildRecipeDocumentV2({
      ...baseInput,
      rawRecipe: {
        ...completeRecipe,
        recipeInstructions: ["Aftenen før:\nGør dejen klar.", "Bag kagen."],
      },
    });
    expect(arrayDocument.normalized.instructions).toEqual([
      { position: 1, text: "Aftenen før: Gør dejen klar." },
      { position: 2, text: "Bag kagen." },
    ]);

    const stringDocument = buildRecipeDocumentV2({
      ...baseInput,
      rawRecipe: {
        ...completeRecipe,
        recipeInstructions: "Trin 1: Rør dejen. Trin 2: Bag kagen. Køl den af.",
      },
    });
    expect(stringDocument.normalized.instructions).toEqual([
      { position: 1, text: "Trin 1: Rør dejen." },
      { position: 2, text: "Trin 2: Bag kagen." },
      { position: 3, text: "Køl den af." },
    ]);

    const placeholderDocument = buildRecipeDocumentV2({
      ...baseInput,
      rawRecipe: {
        ...completeRecipe,
        recipeInstructions: [
          { "@type": "HowToStep", name: "Pisk dejen." },
          { "@type": "HowToStep", name: "Step" },
          { "@type": "HowToStep", name: "Trin 3" },
        ],
      },
    });
    expect(placeholderDocument.normalized.instructions).toEqual([
      { position: 1, text: "Pisk dejen." },
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

  it("accepts a lowercase recipe @type", () => {
    const result = extractCompleteJsonLdRecipes(
      `<script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "recipe",
        name: "Kage",
        recipeIngredient: ["1 æg"],
        recipeInstructions: [{ "@type": "HowToStep", text: "Bag." }],
      })}</script>`
    );

    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]?.["name"]).toBe("Kage");
  });

  it("accepts a lowercase schema.org recipe URL type", () => {
    const result = extractCompleteJsonLdRecipes(
      `<script type="application/ld+json">${JSON.stringify({
        "@type": "https://schema.org/recipe",
        name: "Kage",
        recipeIngredient: ["1 æg"],
        recipeInstructions: ["Bag."],
      })}</script>`
    );

    expect(result.recipes).toHaveLength(1);
  });

  it("does not treat another type as a recipe", () => {
    const result = extractCompleteJsonLdRecipes(
      `<script type="application/ld+json">${JSON.stringify({
        "@type": "Article",
        name: "Kage",
        recipeIngredient: ["1 æg"],
        recipeInstructions: ["Bag."],
      })}</script>`
    );

    expect(result.recipes).toEqual([]);
    expect(result.incompleteJsonLdCount).toBe(0);
  });

  it("ignores a Recipe node reference rather than rejecting it as incomplete", () => {
    const complete = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      "@id": "https://example.dk/opskrifter/kage#recipe",
      name: "Kage",
      recipeIngredient: ["1 æg"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Bag." }],
    };
    // A bare @type/@id pair points at the node above; it claims nothing itself.
    const reference = { "@type": "Recipe", "@id": "https://example.dk/opskrifter/kage#recipe" };
    const result = extractCompleteJsonLdRecipes(
      `<script type="application/ld+json">${JSON.stringify({ "@graph": [reference, complete, reference] })}</script>`
    );

    expect(result.recipes).toHaveLength(1);
    expect(result.incompleteJsonLdCount).toBe(0);
    expect(result.rejectedReasons).not.toContain("incomplete-json-ld");
  });

  it("still rejects a Recipe that has content but lacks required fields", () => {
    const result = extractCompleteJsonLdRecipes(
      `<script type="application/ld+json">${JSON.stringify({
        "@type": "Recipe",
        "@id": "https://example.dk/x#recipe",
        name: "Mangler alt",
      })}</script>`
    );

    expect(result.recipes).toEqual([]);
    expect(result.incompleteJsonLdCount).toBe(1);
  });

  it("tolerates a trailing semicolon after the JSON value", () => {
    const complete = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Kage",
      recipeIngredient: ["1 æg"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Bag." }],
    };
    const result = extractCompleteJsonLdRecipes(
      `<script type="application/ld+json">\n\t${JSON.stringify(complete)};\n\t</script>`
    );

    expect(result.malformedJsonLdCount).toBe(0);
    expect(result.recipes).toHaveLength(1);
  });

  it("does not strip a semicolon inside a quoted value", () => {
    const raw = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Kage; med krymmel",
      recipeIngredient: ["1 æg; stort"],
      recipeInstructions: [{ "@type": "HowToStep", text: "Bag; køl." }],
    });
    const result = extractCompleteJsonLdRecipes(
      `<script type="application/ld+json">${raw}</script>`
    );

    expect(result.recipes[0]?.["name"]).toBe("Kage; med krymmel");
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
