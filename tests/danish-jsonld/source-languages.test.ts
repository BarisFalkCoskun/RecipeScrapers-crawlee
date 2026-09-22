import { describe, expect, it } from "vitest";
import { DANISH_JSONLD_SOURCES } from "../../src/danish-jsonld/source-registry.js";
import { RECIPE_SOURCE_IDS_BY_LANGUAGE, recipeSourceLanguage } from "../../src/danish-jsonld/source-languages.js";

describe("source language metadata", () => {
  it("classifies every canonical source exactly once, without stale IDs or aliases", () => {
    const classified = Object.values(RECIPE_SOURCE_IDS_BY_LANGUAGE).flat();
    const canonicalIds = DANISH_JSONLD_SOURCES.filter((source) => !source.aliasFor).map((source) => source.id);
    expect(new Set(classified).size).toBe(classified.length);
    expect([...classified].sort()).toEqual([...canonicalIds].sort());
    expect(recipeSourceLanguage("unknown")).toBeUndefined();
  });

  it("uses catalogue language for localized domains and Scandinavian cuisine in English", () => {
    for (const id of ["arla", "danishcrown", "danishthings", "chokomils", "nutella", "starbucksathome"]) {
      expect(recipeSourceLanguage(id), id).toBe("da");
    }
    for (const id of ["allrecipes", "bbcgoodfood", "scandikitchen", "currytrail"]) {
      expect(recipeSourceLanguage(id), id).toBe("en");
    }
  });
});
