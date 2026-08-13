import { describe, expect, it } from "vitest";
import {
  DANISH_JSONLD_SOURCES,
  MIGRATION_STATES,
} from "../../src/danish-jsonld/source-registry.js";

describe("Danish JSON-LD source registry", () => {
  const expectedLegacySourceIds = ["amo", "aperol", "arla", "aurion", "bareencocktail", "beauvais", "becel", "bedstedrinks", "blenderopskrifter", "bobedre", "bodylab", "bornemenuen", "bornholms", "campari", "castello", "christinaskoekken", "cocktaily", "coop", "copenhagendistillery_da", "danishcrown", "diabetesopskrifter", "evatrio", "familiejournal", "ferrerorocher", "fevertree", "foodnotes", "frederikkewaerens", "friluftslageret", "frokenkraesen_com", "gamleopskrifter", "gastrologik", "gastrotools", "gigtforeningen", "glutenfrimagi", "glyngoere", "hannerobinson", "heidiogper", "heinz", "hverdagskoekken", "iform", "imerco", "ingridhornshoj", "jonsmadklub", "kenwoodworld", "ketomums", "kikkoman", "kitchenaid", "klank", "klinksgaard", "knaehoejkarse", "kokke", "kornkammeret", "kystfisken", "lurpak", "madenimitliv", "madfolket", "madformadelskere", "madogdrikke", "madoghave", "madrejsen", "madsvin", "maduniverset", "mambeno", "mariavestergaard", "micadeli", "mutti", "nescafe", "netto", "nogetiovnen", "nordmad", "nutella", "oatly", "odensemarcipan", "oetker", "opskrifterdk", "parcelhuslykke", "planetariskkogebog", "plantepusherne", "puredansk", "recipesairfryer_dk", "rema1000", "revivafit", "rosekylling", "santamariaworld", "schulstad", "semper", "skalvibage", "skolemaelk", "slagterlampe", "spicytwist", "spisekunst", "starbucksathome", "stinna", "sundpaabudget", "surdejsentusiasten", "sydhavnsbloggen", "tv2mad", "udeoghjemme", "violife"];

  it("contains exactly the 99 Danish legacy JSON-LD sources", () => {
    expect(DANISH_JSONLD_SOURCES).toHaveLength(99);
    expect(DANISH_JSONLD_SOURCES.filter((source) => source.discovery === "sitemap")).toHaveLength(65);
    expect(DANISH_JSONLD_SOURCES.filter((source) => source.discovery === "listing")).toHaveLength(34);
    expect(DANISH_JSONLD_SOURCES.map((source) => source.id).sort()).toEqual(expectedLegacySourceIds);
  });

  it("keeps source ids unique and preserves the required migration metadata", () => {
    const ids = DANISH_JSONLD_SOURCES.map((source) => source.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const source of DANISH_JSONLD_SOURCES) {
      expect(source.allowedDomains.length).toBeGreaterThan(0);
      expect(source.legacySpider).toBeTruthy();
      expect(Array.isArray(source.recipeUrlPatterns)).toBe(true);
      expect(source.requireCompleteJsonLd).toBe(true);
      expect(MIGRATION_STATES).toContain(source.migrationState);
      expect(source.latestScrapyOutcome).toBeTruthy();
    }
  });

  it("marks only Arla configured and does not claim cutover for any source", () => {
    const configured = DANISH_JSONLD_SOURCES.filter(
      (source) => source.migrationState === "configured"
    );

    expect(configured.map((source) => source.id)).toEqual(["arla"]);
    expect(DANISH_JSONLD_SOURCES.filter((source) => source.migrationState === "cutover")).toHaveLength(0);
  });
});
