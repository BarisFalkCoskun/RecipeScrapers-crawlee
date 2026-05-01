import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { detectLanguage } from "../../src/utils/language.js";

describe("detectLanguage", () => {
  it("prefers recipe inLanguage over page metadata", () => {
    const $ = cheerio.load('<html lang="da"><body>opskrift ingredienser</body></html>');

    const result = detectLanguage({
      $,
      domain: "example.dk",
      recipe: {
        "@type": "Recipe",
        inLanguage: "en-US",
        name: "Apple pie",
      },
    });

    expect(result.language).toBe("en");
    expect(result.languageConfidence).toBe(1);
    expect(result.languageSignals).toContain("recipe-inLanguage");
  });

  it("uses HTML language metadata when recipe language is absent", () => {
    const $ = cheerio.load('<html lang="sv-SE"><body>recept ingredienser</body></html>');

    const result = detectLanguage({ $, domain: "example.se" });

    expect(result.language).toBe("sv");
    expect(result.languageSignals).toContain("html-lang");
  });

  it("uses og:locale when HTML lang is absent", () => {
    const $ = cheerio.load(
      '<html><head><meta property="og:locale" content="de_DE"></head><body>Zutaten Zubereitung Rezept</body></html>'
    );

    const result = detectLanguage({ $, domain: "example.com" });

    expect(result.language).toBe("de");
    expect(result.languageSignals).toContain("og-locale");
  });

  it("falls back to recipe and body text keywords", () => {
    const result = detectLanguage({
      domain: "example.com",
      recipe: {
        name: "Chocolate cake",
        recipeIngredient: ["2 cups flour", "1 teaspoon salt"],
        recipeInstructions: ["Bake for 30 minutes."],
      },
    });

    expect(result.language).toBe("en");
    expect(result.languageConfidence).toBeGreaterThan(0.5);
    expect(result.languageSignals[0]).toMatch(/^text-keywords:en:/);
  });

  it("returns und when no language signal is available", () => {
    const result = detectLanguage({
      bodyText: "Short",
    });

    expect(result).toEqual({
      language: "und",
      languageConfidence: 0,
      languageSignals: ["language-undetected"],
    });
  });
});
