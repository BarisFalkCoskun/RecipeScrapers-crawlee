import { describe, expect, it } from "vitest";
import { compareWprmProbeRecipes } from "../../src/wprm/probe-parity.js";

describe("WPRM live probe comparison", () => {
  it("aligns legacy fragment URLs and checks material normalized fields", () => {
    const report = compareWprmProbeRecipes([{
      url: "https://www.example.dk/opskrift/kage/#wprm-recipe-1",
      title: "Sommer\u00a0kage",
      ingredients: [{ original: "1 æg" }],
      instructions: [{ text: "Bag &quot;kagen&quot;." }],
      prep_time_minutes: 5,
      cook_time_minutes: null,
      total_time_minutes: 5,
      servings: 4,
      servings_unit: "personer",
      image_urls: ["https://example.dk/kage.jpg"],
      categories: ["Dessert"],
      tags: ["Dansk", "Kage"],
    }], [{
      canonicalUrl: "https://example.dk/opskrift/kage",
      normalized: {
        title: "Sommer kage",
        ingredients: ["1 æg"],
        instructions: [{ position: 1, text: "Bag \"kagen\"." }],
        prepMinutes: 5,
        totalMinutes: 5,
        yieldText: "4 personer",
        imageUrls: ["https://example.dk/kage.jpg"],
        categories: ["Dessert"],
        cuisines: ["Dansk"],
        keywords: ["Kage"],
      },
    }]);

    expect(report).toMatchObject({ passed: true, matchedUrls: 1 });
    expect(report.fields.instructionText.ratio).toBe(1);
  });

  it("treats www and bare-host image URLs as the same resource", () => {
    const report = compareWprmProbeRecipes([{
      url: "https://www.example.dk/opskrift",
      title: "Kage",
      ingredients: [{ original: "1 æg" }],
      instructions: [{ text: "Bag." }],
      image_urls: ["https://www.example.dk/image.jpg"],
      categories: [],
      tags: [],
    }], [{
      canonicalUrl: "https://example.dk/opskrift",
      normalized: {
        title: "Kage",
        ingredients: ["1 æg"],
        instructions: [{ position: 1, text: "Bag." }],
        imageUrls: ["https://example.dk/image.jpg"],
        categories: [],
        cuisines: [],
        keywords: [],
      },
    }]);

    expect(report).toMatchObject({ passed: true, fields: { imageUrls: { matches: 1 } } });
  });

  it("compares JSON-LD legacy tags to keywords while allowing additive cuisines", () => {
    const report = compareWprmProbeRecipes([{
      url: "https://example.dk/opskrift",
      title: "Kage",
      ingredients: [{ original: "1 æg" }],
      instructions: [{ text: "Bag." }],
      image_urls: [],
      categories: [],
      tags: ["Kage"],
    }], [{
      canonicalUrl: "https://example.dk/opskrift",
      normalized: {
        title: "Kage",
        ingredients: ["1 æg"],
        instructions: [{ position: 1, text: "Bag." }],
        imageUrls: [],
        categories: [],
        cuisines: ["Dansk"],
        keywords: ["Kage"],
      },
    }], { legacyTagsIncludeCuisines: false });

    expect(report).toMatchObject({
      passed: true,
      fields: { cuisinesAndKeywords: { matches: 1 } },
    });
  });

  it("verifies numeric-only legacy yields against richer JSON-LD yield text", () => {
    const report = compareWprmProbeRecipes([{
      url: "https://example.dk/opskrift",
      title: "Sandwich",
      ingredients: [{ original: "2 skiver brød" }],
      instructions: [{ text: "Saml sandwichene." }],
      servings: 2,
      image_urls: [],
      categories: [],
      tags: [],
    }], [{
      canonicalUrl: "https://example.dk/opskrift",
      normalized: {
        title: "Sandwich",
        ingredients: ["2 skiver brød"],
        instructions: [{ position: 1, text: "Saml sandwichene." }],
        yieldText: "2 sandwiches",
        imageUrls: [],
        categories: [],
        cuisines: [],
        keywords: [],
      },
    }], { legacyYieldIsNumericOnly: true });

    expect(report).toMatchObject({
      passed: true,
      fields: { yieldText: { matches: 1 } },
    });
  });

  it("compares rendered legacy ingredient text instead of presentation HTML", () => {
    const report = compareWprmProbeRecipes([{
      url: "https://example.dk/opskrift",
      title: "Kaffe<sup>®</sup><br>latte",
      ingredients: [{ original: '1 tsk <a href="/kaffe"><strong>Kaffe</strong></a>' }],
      instructions: [{ text: "Rør rundt." }],
      image_urls: [],
      categories: [],
      tags: [],
    }], [{
      canonicalUrl: "https://example.dk/opskrift",
      normalized: {
        title: "Kaffe® latte",
        ingredients: ["1 tsk Kaffe"],
        instructions: [{ position: 1, text: "Rør rundt." }],
        imageUrls: [],
        categories: [],
        cuisines: [],
        keywords: [],
      },
    }]);

    expect(report).toMatchObject({
      passed: true,
      fields: { title: { matches: 1 }, ingredientText: { matches: 1 } },
    });
  });

  it("compares decoded category text instead of escaped presentation markup", () => {
    const report = compareWprmProbeRecipes([{
      url: "https://example.dk/opskrift",
      title: "Bisque",
      ingredients: [{ original: "1 hummer" }],
      instructions: [{ text: "Kog suppen." }],
      image_urls: [],
      categories: ["&lt;p&gt;Bisque&lt;/p&gt;"],
      tags: [],
    }], [{
      canonicalUrl: "https://example.dk/opskrift",
      normalized: {
        title: "Bisque",
        ingredients: ["1 hummer"],
        instructions: [{ position: 1, text: "Kog suppen." }],
        imageUrls: [],
        categories: ["Bisque"],
        cuisines: [],
        keywords: [],
      },
    }]);

    expect(report).toMatchObject({
      passed: true,
      fields: { categories: { matches: 1 } },
    });
  });

  it("compares decoded legacy tags to normalized keyword text", () => {
    const report = compareWprmProbeRecipes([{
      url: "https://example.dk/opskrift",
      title: "Sandwich",
      ingredients: [{ original: "1 bolle" }],
      instructions: [{ text: "Saml den." }],
      image_urls: [],
      categories: [],
      tags: ["Burger &amp; sandwich"],
    }], [{
      canonicalUrl: "https://example.dk/opskrift",
      normalized: {
        title: "Sandwich",
        ingredients: ["1 bolle"],
        instructions: [{ position: 1, text: "Saml den." }],
        imageUrls: [],
        categories: [],
        cuisines: [],
        keywords: ["Burger & sandwich"],
      },
    }], { legacyTagsIncludeCuisines: false });

    expect(report).toMatchObject({
      passed: true,
      fields: { cuisinesAndKeywords: { matches: 1 } },
    });
  });

  it("retains non-WPRM fragments as distinct multi-recipe identities", () => {
    const legacy = ["suppe", "salat"].map((fragment) => ({
      url: `https://example.dk/opskrifter/menu#${fragment}`,
      title: fragment,
      ingredients: [{ original: "1 råvare" }],
      instructions: [{ text: "Tilbered retten." }],
      image_urls: [],
      categories: [],
      tags: [],
    }));
    const crawlee = ["suppe", "salat"].map((fragment) => ({
      canonicalUrl: `https://example.dk/opskrifter/menu#${fragment}`,
      normalized: {
        title: fragment,
        ingredients: ["1 råvare"],
        instructions: [{ position: 1, text: "Tilbered retten." }],
        imageUrls: [],
        categories: [],
        cuisines: [],
        keywords: [],
      },
    }));

    expect(compareWprmProbeRecipes(legacy, crawlee)).toMatchObject({
      passed: true,
      legacyCount: 2,
      crawleeCount: 2,
      matchedUrls: 2,
    });
  });

  it("compares every recipe when several WPRM records share one page URL", () => {
    const legacy = ["Cake base", "Cake filling"].map((title) => ({
      url: "https://example.dk/cake-components/",
      title,
      ingredients: [{ original: `1 ${title.toLowerCase()}` }],
      instructions: [{ text: `Make the ${title.toLowerCase()}.` }],
      image_urls: [],
      categories: [],
      tags: [],
    }));
    const crawlee = ["Cake filling", "Cake base"].map((title) => ({
      canonicalUrl: "https://example.dk/cake-components",
      normalized: {
        title,
        ingredients: [`1 ${title.toLowerCase()}`],
        instructions: [{ position: 1, text: `Make the ${title.toLowerCase()}.` }],
        imageUrls: [],
        categories: [],
        cuisines: [],
        keywords: [],
      },
    }));

    const report = compareWprmProbeRecipes(legacy, crawlee);
    expect(report).toMatchObject({
      passed: true,
      legacyCount: 2,
      crawleeCount: 2,
      matchedUrls: 2,
    });
    expect(report.fields.title.compared).toBe(2);

    const mismatched = structuredClone(crawlee);
    mismatched[0]!.normalized.ingredients = ["wrong ingredient"];
    expect(compareWprmProbeRecipes(legacy, mismatched)).toMatchObject({
      passed: false,
      matchedUrls: 2,
      fields: {
        ingredientCount: { matches: 2 },
        ingredientText: { matches: 1 },
        instructionText: { matches: 2 },
      },
    });
    expect(compareWprmProbeRecipes(legacy, mismatched).mismatchSamples)
      .toContainEqual({
        url: "https://example.dk/cake-components",
        fields: expect.arrayContaining(["ingredientText"]),
      });
  });
});
