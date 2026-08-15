import { describe, expect, it } from "vitest";
import {
  DANISH_JSONLD_SOURCES,
  MIGRATION_STATES,
} from "../../src/danish-jsonld/source-registry.js";

describe("Danish JSON-LD source registry", () => {
  const expectedLegacySourceIds = ["allrecipes", "amo", "aperol", "arla", "aurion", "avocadosfrommexico", "bareencocktail", "bbcgoodfood", "beauvais", "becel", "bedstedrinks", "bertolli", "bettycrocker", "blenderopskrifter", "bobedre", "bobsredmill", "bodylab", "bornemenuen", "bornholms", "campari", "canadianliving", "castello", "chelsea_nz", "christinaskoekken", "cocktaily", "coop", "copenhagendistillery_da", "danishcrown", "delmonte", "diabetesopskrifter", "edmonds_nz", "evatrio", "familiejournal", "ferrerorocher", "fevertree", "foodnetwork_uk", "foodnotes", "frederikkewaerens", "friluftslageret", "frokenkraesen_com", "gamleopskrifter", "gastrologik", "gastrotools", "gigtforeningen", "glutenfrimagi", "glyngoere", "greatbritishchefs", "hannerobinson", "heidiogper", "heinz", "hverdagskoekken", "iform", "imerco", "ingridhornshoj", "jamieoliver", "jonsmadklub", "kenwoodworld", "ketomums", "kikkoman", "kitchenaid", "klank", "klinksgaard", "knaehoejkarse", "kokke", "kornkammeret", "kystfisken", "landolakes", "lurpak", "madenimitliv", "madfolket", "madformadelskere", "madogdrikke", "madoghave", "madrejsen", "madsvin", "maduniverset", "mambeno", "mariavestergaard", "micadeli", "mutti", "nescafe", "netto", "nogetiovnen", "nordicfoodliving", "nordmad", "nutella", "oatly", "odensemarcipan", "oetker", "olivemagazine", "opskrifterdk", "parcelhuslykke", "pillsbury", "planetariskkogebog", "plantepusherne", "progresso", "puredansk", "recipesairfryer_dk", "rema1000", "revivafit", "ricardocuisine", "rosekylling", "santamariaworld", "schulstad", "semper", "skalvibage", "skolemaelk", "slagterlampe", "spam", "spicytwist", "spisekunst", "starbucksathome", "stinna", "sundpaabudget", "sunset", "surdejsentusiasten", "sydhavnsbloggen", "tasteofhome", "tesco_recipes", "tillamook", "tv2mad", "udeoghjemme", "violife"];

  it("contains exactly the 123 legacy JSON-LD sources", () => {
    expect(DANISH_JSONLD_SOURCES).toHaveLength(123);
    expect(DANISH_JSONLD_SOURCES.filter(
      (source) => source.legacyFamily === "JsonLdSitemapRecipeSpider"
    )).toHaveLength(89);
    expect(DANISH_JSONLD_SOURCES.filter(
      (source) => source.legacyFamily === "JsonLdListingSpider"
    )).toHaveLength(34);
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

  it("records verified migration evidence without claiming cutover", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));

    expect(["arla", "coop", "kitchenaid", "madoghave", "tv2mad"].map(
      (sourceId) => [sourceId, byId.get(sourceId)?.migrationState]
    )).toEqual([
      ["arla", "canary_passed"],
      ["coop", "configured"],
      ["kitchenaid", "configured"],
      ["madoghave", "shadow_passed"],
      ["tv2mad", "configured"],
    ]);
    expect(byId.get("madoghave")?.shadowParity).toBe("legacy-unhealthy");
    expect(byId.get("tv2mad")?.deferOrBlockReason).toMatch(
      /result window stops at 10000/u
    );
    expect(byId.get("surdejsentusiasten")?.migrationState).toBe("shadow_passed");
    expect(byId.get("kikkoman")?.migrationState).toBe("configured");
    expect(byId.get("gamleopskrifter")?.migrationState).toBe("configured");
    expect(byId.get("sundpaabudget")).toMatchObject({
      migrationState: "canary_passed",
      fetchMode: "playwright",
    });
    expect(byId.get("sundpaabudget")?.deferOrBlockReason).toMatch(
      /no blocked or failed request/u
    );
    expect(byId.get("klinksgaard")?.migrationState).toBe("blocked");
    expect(byId.get("netto")?.migrationState).toBe("deferred");
    expect(byId.get("madrejsen")?.migrationState).toBe("canary_passed");
    expect(byId.get("madrejsen")?.deferOrBlockReason).toMatch(
      /no blocked or failed request/u
    );
    expect(DANISH_JSONLD_SOURCES.filter((source) => source.migrationState === "cutover")).toHaveLength(0);
  });

  it("marks route-audited sources configured without inventing canary evidence", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));
    const audited = ["amo", "opskrifterdk", "danishcrown", "bobedre", "familiejournal"];

    for (const sourceId of audited) {
      const source = byId.get(sourceId);
      expect(source?.migrationState).toBe("configured");
      // A verified route is not a canary; nothing may claim canary evidence.
      expect(source?.latestCanary).toBeUndefined();
      expect(source?.shadowParity).toBeUndefined();
    }
    // Only a source whose route the audit could not reach stays not_started.
    expect(
      DANISH_JSONLD_SOURCES.filter((source) => source.migrationState === "not_started")
        .map((source) => source.id)
    ).toEqual(["ricardocuisine"]);
  });

  it("carries the international JSON-LD sources on the same strict contract", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));

    for (const sourceId of ["allrecipes", "bbcgoodfood", "jamieoliver", "tesco_recipes"]) {
      expect(byId.get(sourceId)).toMatchObject({
        discovery: "sitemap",
        fetchMode: "cheerio",
        requireCompleteJsonLd: true,
        migrationState: "configured",
      });
      expect(byId.get(sourceId)?.latestCanary).toBeUndefined();
    }
    expect(byId.get("allrecipes")?.requestSettings).toMatchObject({
      delaySeconds: 3,
      maxConcurrency: 1,
    });
  });

  it("records Kenwood's script-gated listing rather than calling it ready", () => {
    const source = DANISH_JSONLD_SOURCES.find((entry) => entry.id === "kenwoodworld");

    expect(source?.migrationState).toBe("configured");
    expect(source?.deferOrBlockReason).toMatch(/script-only load-more control/u);
  });

  it("uses Gamle Opskrifter's current sitemap and recipe route", () => {
    const source = DANISH_JSONLD_SOURCES.find((entry) => entry.id === "gamleopskrifter");

    expect(source).toMatchObject({
      discovery: "sitemap",
      sitemapUrls: ["https://gamleopskrifter.com/sitemap.xml"],
      startUrls: [],
      recipeUrlPatterns: ["^https://gamleopskrifter\\.com/g/home/r/[^/?#]+/?$"],
    });
  });

  it("preserves inherited listing patterns and Ferrero Rocher's dynamic discovery", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));
    const inheritedPatterns = [
      "^/[a-z0-9æøå-]+/?$",
      "^/(opskrift(?:er)?|recipes?|mad)/[a-z0-9æøå-]+/?$",
    ];

    for (const sourceId of [
      "frokenkraesen_com",
      "madenimitliv",
      "madformadelskere",
      "plantepusherne",
      "stinna",
      "sydhavnsbloggen",
    ]) {
      expect(byId.get(sourceId)?.recipeUrlPatterns).toEqual(inheritedPatterns);
    }
    expect(byId.get("ferrerorocher")).toMatchObject({
      startUrls: ["https://www.ferrerorocher.com/api/dk/search/_search?size=200"],
      recipeUrlPatterns: ["^/dk/da/tips-og-ideer/opskrifter/[^/?#]+/?$"],
    });
  });

  it("retains representative effective Scrapy request settings", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));

    expect(byId.get("arla")?.requestSettings).toMatchObject({
      delaySeconds: 2,
      maxConcurrency: 2,
      maxRetries: 3,
    });
    expect(byId.get("coop")?.requestSettings).toMatchObject({
      delaySeconds: 3,
      maxConcurrency: 1,
      maxRetries: 3,
    });
  });

  it("represents every effective legacy discovery override as typed registry data", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));
    const listingSources = DANISH_JSONLD_SOURCES.filter(
      (source) => source.discovery === "listing"
    );

    for (const listing of listingSources.filter(
      (source) => !["madrejsen", "rema1000", "tv2mad"].includes(source.id)
    )) {
      expect(listing.listingDiscovery).toMatchObject({
        recipeLinkSelectors: ["a[href]"],
        continuationSelectors: [
          "a.next[href]",
          "a.page-numbers.next[href]",
          'link[rel~="next"][href]',
        ],
      });
      expect(listing.listingDiscovery?.skipPathFragments).toEqual(
        expect.arrayContaining(["/category/", "/tag/", "/page/", "/author/"])
      );
    }

    expect(byId.get("rema1000")?.listingDiscovery?.continuationSelectors)
      .toEqual(["a.sr-only[href]"]);
    expect(byId.get("tv2mad")).toMatchObject({
      startUrls: ["https://recipe-front.services.tv2.dk/search/%20?from=0"],
      listingDiscovery: {
        listingHosts: ["recipe-front.services.tv2.dk"],
        payload: {
          expectedRoot: "array",
          recipePaths: ["[].url"],
          continuationOffset: { parameter: "from", step: 50, maxOffset: 9_950 },
        },
      },
    });
    expect(byId.get("tv2mad")?.allowedDomains).toEqual(["livsstil.tv2.dk"]);
    expect(byId.get("madrejsen")?.listingDiscovery).toMatchObject({
      recipeLinkSelectors: ["article.entry a.entry-title-link[href]"],
      continuationSelectors: [".pagination-next a[href]"],
    });
    expect(byId.get("kitchenaid")?.listingDiscovery?.continuationUrlPatterns)
      .toEqual(["^/opskrifter/alle/\\d+/?$"]);
    expect(byId.get("klank")?.listingDiscovery?.continuationUrlPatterns).toEqual([
      "^/index\\.php/opskrifter-(?:koekken|kategori)/[a-z0-9æøåé-]+/?$",
    ]);
    expect(byId.get("ferrerorocher")?.listingDiscovery?.payload).toEqual({
      kind: "json-paths",
      expectedRoot: "object",
      recipePaths: ["hits.hits[]._source.url[]"],
    });

    expect(byId.get("glutenfrimagi")?.listingDiscovery?.skipPathFragments)
      .toContain("/opskrifter/");
    expect(byId.get("heidiogper")?.listingDiscovery?.skipPathFragments)
      .toContain("/opskrifter/forside");
    expect(byId.get("knaehoejkarse")?.listingDiscovery?.skipPathFragments)
      .toContain("/alle-opskrifter/");
    expect(byId.get("madrejsen")?.listingDiscovery?.skipPathFragments)
      .toContain("/opskrifter/");
    expect(byId.get("recipesairfryer_dk")?.listingDiscovery?.skipPathFragments)
      .toContain("/da/hjemmeside-da/");

    expect(byId.get("bobedre")?.sitemapDiscovery).toMatchObject({
      followPatterns: ["contenthub_composite"],
      skipUrlFragments: expect.arrayContaining(["/opskrifter/hovedret?"]),
    });
    expect(byId.get("iform")?.sitemapDiscovery?.followPatterns)
      .toEqual(["contenthub_composite"]);
    expect(byId.get("kikkoman")?.sitemapDiscovery?.followPatterns)
      .toEqual(["sitemap=recipes"]);
    expect(byId.get("micadeli")?.sitemapDiscovery?.followPatterns)
      .toEqual(["post-sitemap\\.xml$"]);
    expect(byId.get("nogetiovnen")?.sitemapDiscovery?.followPatterns)
      .toEqual(["post-sitemap"]);
  });
});
