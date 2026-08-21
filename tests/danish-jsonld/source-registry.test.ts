import { describe, expect, it } from "vitest";
import {
  DANISH_JSONLD_SOURCES,
  MIGRATION_STATES,
} from "../../src/danish-jsonld/source-registry.js";
import { DANISH_WPRM_SOURCE_DEFINITIONS } from "../../src/wprm/danish-sources.js";
import { DANISH_WP_POSTS_SOURCE_DEFINITIONS } from "../../src/danish-jsonld/danish-wp-posts-sources.js";
import {
  DANISH_CUSTOM_JSONLD_SOURCE_DEFINITIONS,
  DANISH_CUSTOM_LISTING_JSONLD_SOURCE_DEFINITIONS,
  DANISH_CUSTOM_WPRM_SOURCE_DEFINITIONS,
  DANISH_ARTICLE_HTML_SOURCE_DEFINITIONS,
  DANISH_JSONLD_HTML_SOURCE_DEFINITIONS,
  DANISH_REDIRECTED_JSONLD_SOURCE_DEFINITIONS,
  DANISH_ALT_HTML_SOURCE_DEFINITIONS,
  DANISH_MULTI_RECIPE_HTML_SOURCE_DEFINITIONS,
  DANISH_DR_GRAPHQL_SOURCE_DEFINITIONS,
  DANISH_AUTHENTICATED_API_SOURCE_DEFINITIONS,
  DANISH_DAGROFA_API_SOURCE_DEFINITIONS,
  DANISH_SITECORE_API_SOURCE_DEFINITIONS,
  DANISH_SHOPIFY_BLOG_SOURCE_DEFINITIONS,
  DANISH_EMBEDDED_JSON_SOURCE_DEFINITIONS,
  DANISH_HTML_RECIPE_SOURCE_DEFINITIONS,
} from "../../src/danish-jsonld/custom-danish-sources.js";

describe("Danish JSON-LD source registry", () => {
  const expectedLegacySourceIds = [
  "abakershouse",
  "acouplecooks",
  "afamilyfeast",
  "aggieskitchen",
  "allergylicious",
  "allrecipes",
  "amo",
  "anicula",
  "annsentitledlife",
  "aperol",
  "arla",
  "artfuldishes",
  "asweetspoonful",
  "aurion",
  "avocadosfrommexico",
  "babybite",
  "bakerella",
  "bareencocktail",
  "basisvarer",
  "bbcgoodfood",
  "beauvais",
  "becel",
  "bedstedrinks",
  "bellalimento",
  "bertolli",
  "bettycrocker",
  "blenderopskrifter",
  "bobedre",
  "bobsredmill",
  "bodylab",
  "bornemenuen",
  "bornholms",
  "breadtopia",
  "brownedbutterblondie",
  "butternutbakeryblog",
  "campari",
  "canadianliving",
  "carrotstick",
  "castello",
  "chelsea_nz",
  "choosingchia",
  "christinaskoekken",
  "closetcooking",
  "cocktaily",
  "cookieandkate",
  "cookiesandcups",
  "cookingwithruthie",
  "coop",
  "copenhagendistillery_da",
  "coupleinthekitchen",
  "danishcrown",
  "delmonte",
  "diabetesopskrifter",
  "edmonds_nz",
  "evatrio",
  "familiejournal",
  "fannetasticfood",
  "ferrerorocher",
  "fevertree",
  "foodnetwork_uk",
  "foodnotes",
  "frederikkewaerens",
  "friluftslageret",
  "frokenkraesen_com",
  "gamleopskrifter",
  "gastrofun",
  "gastrologik",
  "gastrotools",
  "gatheranddine",
  "gigtforeningen",
  "gimmesomeoven",
  "glutenfrimagi",
  "glyngoere",
  "goodlifeeats",
  "greatbritishchefs",
  "greedygourmet",
  "groedgrisen",
  "grownupdish",
  "gunris",
  "hannerobinson",
  "heidiogper",
  "heinz",
  "hverdagskoekken",
  "iform",
  "imerco",
  "ingridhornshoj",
  "inspiredtaste",
  "jamieoliver",
  "jonsmadklub",
  "joyfulhealthyeats",
  "joythebaker",
  "kalynskitchen",
  "kenwoodworld",
  "ketoliv",
  "ketomums",
  "kikkoman",
  "kitchenaid",
  "klank",
  "klinksgaard",
  "knaehoejkarse",
  "kokke",
  "kokkeriermedpassion",
  "kornkammeret",
  "kystfisken",
  "landolakes",
  "lavenderandlovage",
  "lazycatkitchen",
  "lowcarbdelish",
  "lundoaagaard",
  "lurpak",
  "madenimitliv",
  "madensverden",
  "madfolket",
  "madformadelskere",
  "madogdrikke",
  "madoghave",
  "madrejsen",
  "madsvin",
  "maduniverset",
  "mambeno",
  "mariavestergaard",
  "micadeli",
  "moderncrumb",
  "mutti",
  "nannapretzmann",
  "nescafe",
  "netto",
  "nogetiovnen",
  "nordicfoodliving",
  "nordmad",
  "nutella",
  "nyssaskitchen",
  "oatly",
  "odensemarcipan",
  "oetker",
  "olivemagazine",
  "opskrifterdk",
  "opskrifterforalle",
  "orwhateveryoudo",
  "parcelhuslykke",
  "peaceloveandlowcarb",
  "perrysplate",
  "pickledplum",
  "pillsbury",
  "pinchofyum",
  "planetariskkogebog",
  "planteaederen",
  "plantepusherne",
  "progresso",
  "projectmealplan",
  "puredansk",
  "rachlmansfield",
  "recipesairfryer_dk",
  "rema1000",
  "revivafit",
  "ricardocuisine",
  "rockrecipes",
  "rosekylling",
  "santamariaworld",
  "schulstad",
  "semper",
  "shelikesfood",
  "skalvibage",
  "skolemaelk",
  "slagterlampe",
  "smaagroenneskridt",
  "smittenkitchen",
  "spam",
  "spicytwist",
  "spisekunst",
  "starbucksathome",
  "stegeso",
  "stinna",
  "sundpaabudget",
  "sunset",
  "surdejsentusiasten",
  "sweetsimplevegan",
  "sydhavnsbloggen",
  "tasteandsee",
  "tasteofhome",
  "tesco_recipes",
  "thatskinnychickcanbake",
  "thecakeblog",
  "thecastawaykitchen",
  "thecookful",
  "thehappierhomemaker",
  "thehealthymaven",
  "therealfoodrds",
  "tidymom",
  "tillamook",
  "tv2mad",
  "udeoghjemme",
  "violife",
  "withspice",
];

  it("contains the migrated legacy source families and every Danish WPRM source", () => {
    expect(DANISH_JSONLD_SOURCES).toHaveLength(314);
    expect(DANISH_JSONLD_SOURCES.filter(
      (source) => source.legacyFamily === "JsonLdSitemapRecipeSpider"
    )).toHaveLength(89);
    expect(DANISH_JSONLD_SOURCES.filter(
      (source) => source.legacyFamily === "JsonLdListingSpider"
    )).toHaveLength(34);
    expect(DANISH_JSONLD_SOURCES.filter(
      (source) => source.legacyFamily === "WprmApiSpider"
    )).toHaveLength(88);
    expect(DANISH_JSONLD_SOURCES.filter(
      (source) => source.legacyFamily === "WpPostsJsonLdSpider"
    )).toHaveLength(76);
    expect(DANISH_JSONLD_SOURCES.map((source) => source.id).sort()).toEqual(
      [...new Set([
        ...expectedLegacySourceIds,
        ...DANISH_WPRM_SOURCE_DEFINITIONS.map(([id]) => id),
        ...DANISH_WP_POSTS_SOURCE_DEFINITIONS.map(([id]) => id),
        ...DANISH_CUSTOM_JSONLD_SOURCE_DEFINITIONS.map(({ id }) => id),
        ...DANISH_CUSTOM_LISTING_JSONLD_SOURCE_DEFINITIONS.map(({ id }) => id),
        ...DANISH_CUSTOM_WPRM_SOURCE_DEFINITIONS.map(({ id }) => id),
        ...DANISH_SHOPIFY_BLOG_SOURCE_DEFINITIONS.map(({ id }) => id),
        ...DANISH_ARTICLE_HTML_SOURCE_DEFINITIONS.map(({ id }) => id),
        ...DANISH_JSONLD_HTML_SOURCE_DEFINITIONS.map(({ id }) => id),
        ...DANISH_REDIRECTED_JSONLD_SOURCE_DEFINITIONS.map(({ id }) => id),
        ...DANISH_ALT_HTML_SOURCE_DEFINITIONS.map(({ id }) => id),
        "dkkogebogen",
        "nipunijulie",
        "thefoodclub",
        ...DANISH_MULTI_RECIPE_HTML_SOURCE_DEFINITIONS.map(({ id }) => id),
        ...DANISH_DR_GRAPHQL_SOURCE_DEFINITIONS.map(({ id }) => id),
        ...DANISH_AUTHENTICATED_API_SOURCE_DEFINITIONS.map(({ id }) => id),
        ...DANISH_DAGROFA_API_SOURCE_DEFINITIONS.map(({ id }) => id),
        ...DANISH_SITECORE_API_SOURCE_DEFINITIONS.map(({ id }) => id),
        ...DANISH_EMBEDDED_JSON_SOURCE_DEFINITIONS.map(({ id }) => id),
        ...DANISH_HTML_RECIPE_SOURCE_DEFINITIONS.map(({ id }) => id),
        "meyers",
      ])].sort()
    );
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
    expect(byId.get("kikkoman")?.migrationState).toBe("canary_passed");
    expect(byId.get("gamleopskrifter")?.migrationState).toBe("shadow_passed");
    expect(byId.get("sundpaabudget")).toMatchObject({
      migrationState: "canary_passed",
      fetchMode: "playwright",
    });
    expect(byId.get("sundpaabudget")?.deferOrBlockReason).toMatch(
      /no blocked or failed request/u
    );
    // First source of the WordPress posts family to pass, now shadow-verified.
    expect(byId.get("gunris")).toMatchObject({
      migrationState: "shadow_passed",
      latestScrapyOutcome: "succeeded",
      numericYieldOnly: true,
      shadowParity: expect.stringContaining("5/5"),
    });
    expect(byId.get("gigtforeningen")).toMatchObject({
      discovery: "listing",
      recipeExtractor: "gigtforeningen-wp-html",
      migrationState: "shadow_passed",
      latestScrapyOutcome: "failed",
      shadowParity: expect.stringContaining("legacy-unhealthy"),
    });
    expect(byId.get("bedstedrinks")).toMatchObject({
      migrationState: "shadow_passed",
      latestScrapyOutcome: "succeeded",
      shadowParity: expect.stringContaining("80/80"),
    });
    expect(byId.get("madformadelskere")).toMatchObject({
      migrationState: "shadow_passed",
      latestScrapyOutcome: "succeeded",
      shadowParity: expect.stringContaining("72/72"),
    });
    expect(byId.get("schulstad")).toMatchObject({
      migrationState: "shadow_passed",
      latestScrapyOutcome: "succeeded",
      shadowParity: expect.stringContaining("94/94"),
    });
    expect(byId.get("jonsmadklub")).toMatchObject({
      migrationState: "shadow_passed",
      latestScrapyOutcome: "succeeded",
      shadowParity: expect.stringContaining("106/106"),
    });
    expect(byId.get("kystfisken")).toMatchObject({
      migrationState: "shadow_passed",
      latestScrapyOutcome: "succeeded",
      shadowParity: expect.stringContaining("136/136"),
    });
    expect(byId.get("klank")).toMatchObject({
      migrationState: "shadow_passed",
      latestScrapyOutcome: "succeeded",
      shadowParity: expect.stringContaining("52/52"),
    });
    expect(byId.get("glyngoere")).toMatchObject({
      migrationState: "shadow_passed",
      latestScrapyOutcome: "succeeded",
      shadowParity: expect.stringContaining("74/74"),
    });
    expect(byId.get("bareencocktail")).toMatchObject({
      migrationState: "shadow_passed",
      latestScrapyOutcome: "succeeded",
      shadowParity: expect.stringContaining("81/81"),
    });
    expect(byId.get("copenhagendistillery_da")).toMatchObject({
      migrationState: "shadow_passed",
      latestScrapyOutcome: "succeeded",
      shadowParity: expect.stringContaining("87/87"),
    });
    expect(byId.get("gamleopskrifter")).toMatchObject({
      migrationState: "shadow_passed",
      latestScrapyOutcome: "failed",
      shadowParity: expect.stringMatching(/legacy-unhealthy.*5\/5/u),
    });
    expect(byId.get("bodylab")).toMatchObject({
      migrationState: "shadow_passed",
      latestScrapyOutcome: "partial",
      shadowParity: expect.stringMatching(/29\/29.*149-recipe/u),
    });
    expect(byId.get("familiejournal")?.migrationState).toBe("canary_passed");
    // Parity work carries a source past its canary, which must not read as a
    // break in the canary evidence this test is about.
    expect(["canary_passed", "shadow_passed"]).toContain(
      byId.get("nordmad")?.migrationState
    );
    expect(byId.get("oetker")?.migrationState).toBe("canary_passed");
    expect(byId.get("odensemarcipan")?.migrationState).toBe("canary_passed");
    expect(byId.get("nogetiovnen")?.migrationState).toBe("canary_passed");
    expect(byId.get("nogetiovnen")?.deferOrBlockReason).toMatch(
      /no blocked, failed or rejected record/u
    );
    expect(byId.get("klinksgaard")?.migrationState).toBe("blocked");
    expect(byId.get("bornholms")).toMatchObject({
      migrationState: "shadow_passed",
      latestScrapyOutcome: "succeeded",
      latestCanary: "2026-08-19T20-16-22.495Z",
      shadowParity: expect.stringMatching(/11\/11 unique current recipes/u),
    });
    expect(byId.get("bornholms")?.listingDiscovery?.skipPathFragments)
      .toContain("/opskrifter/bagel-med-bornholms-fiskepate");
    expect(byId.get("sydhavnsbloggen")).toMatchObject({
      migrationState: "shadow_passed",
      latestScrapyOutcome: "succeeded",
      latestCanary: "2026-08-19T20-20-33.834Z",
      shadowParity: expect.stringMatching(/42\/42 recipes/u),
    });
    expect(byId.get("netto")?.migrationState).toBe("deferred");
    expect(["canary_passed", "shadow_passed"]).toContain(
      byId.get("madrejsen")?.migrationState
    );
    expect(byId.get("madrejsen")?.deferOrBlockReason).toMatch(
      /no failed, blocked, rejected, storage or domain record/u
    );
    expect(DANISH_JSONLD_SOURCES.filter((source) => source.migrationState === "cutover")).toHaveLength(0);
  });

  it("claims canary evidence only as a real run id", () => {
    const runId = /^\d{4}-\d{2}-\d{2}T[\d.-]+Z(-attempt-[0-9a-f-]{36})?$/u;

    for (const source of DANISH_JSONLD_SOURCES) {
      if (source.latestCanary !== undefined) {
        expect(source.latestCanary).toMatch(runId);
      }
      // A state that asserts a passing run must name the run that passed.
      if (source.migrationState === "canary_passed" || source.migrationState === "shadow_passed") {
        expect(source.latestCanary).toMatch(runId);
      }
      // Parity is only meaningful once a shadow comparison has run.
      if (source.shadowParity !== undefined) {
        expect(source.migrationState).toBe("shadow_passed");
      }
    }
    // Only a source whose route the audit could not reach stays not_started.
    // Every source carried over from the sitemap and listing families has been
    // attempted; only the newly added WordPress posts family is unrun.
    expect(
      DANISH_JSONLD_SOURCES.filter((source) => source.migrationState === "not_started")
        .every((source) =>
          source.legacyFamily === "WpPostsJsonLdSpider" ||
          source.legacyFamily === "WprmApiSpider" ||
          source.legacyFamily === "CustomSitemapSpider" ||
          source.legacyFamily === "CustomListingSpider" ||
          source.legacyFamily === "EmbeddedJsonSitemapSpider" ||
          source.legacyFamily === "HtmlMicrodataSitemapSpider"
        )
    ).toBe(true);
  });

  it("registers every Danish WPRM spider on direct API discovery", () => {
    const sources = DANISH_JSONLD_SOURCES.filter(
      (source) => source.legacyFamily === "WprmApiSpider"
    );

    expect(sources.map((source) => source.id).sort()).toEqual(
      DANISH_WPRM_SOURCE_DEFINITIONS.map(([id]) => id).sort()
    );
    for (const source of sources) {
      // Page size is per-source: a site that cannot build the default page
      // answers HTTP 500 rather than a short page, so the route is asserted
      // without pinning the size.
      expect(source.startUrls[0]).toMatch(
        /\/wp-json\/wp\/v2\/wprm_recipe\?per_page=\d+&page=1$/u
      );
      expect(source.listingDiscovery?.payload).toMatchObject({
        expectedRoot: "array",
        recipePaths: ["[].link"],
        terminalPayload: { path: "code", equals: "rest_post_invalid_page_number" },
      });
      expect(["not_started", "configured", "canary_passed", "shadow_passed", "blocked", "deferred"])
        .toContain(source.migrationState);
    }
    expect(sources.filter((source) => source.fetchMode === "playwright").map(
      (source) => source.id
    ).sort()).toEqual(
      DANISH_WPRM_SOURCE_DEFINITIONS.filter(([, , , , usePlaywright]) => usePlaywright)
        .map(([id]) => id)
        .sort()
    );
    expect(sources.find((source) => source.id === "altmad")?.requestSettings)
      .toMatchObject({ delaySeconds: 10, maxConcurrency: 1 });
    expect(sources.find((source) => source.id === "madbanditten")?.requestSettings)
      .toMatchObject({ delaySeconds: 100, maxConcurrency: 1 });
    expect(sources.find((source) => source.id === "twinfood"))
      .toMatchObject({ fetchMode: "playwright", requestSettings: {
        delaySeconds: 20,
        rateLimitPerMinute: null,
        maxConcurrency: 1,
        maxRetries: 3,
      } });
    expect(sources.find((source) => source.id === "gastrofun")).toMatchObject({
      migrationState: "configured",
      latestScrapyOutcome: "partial",
      latestCanary: "2026-08-19T15-51-22.062Z",
    });
    expect(sources.find((source) => source.id === "gastrofun")?.deferOrBlockReason)
      .toMatch(/38-page catalog still requires an uncapped run/u);
    expect(sources.find((source) => source.id === "ketoliv")).toMatchObject({
      migrationState: "shadow_passed",
      latestScrapyOutcome: "succeeded",
      latestCanary: "2026-08-19T20-33-21.809Z",
      shadowParity: expect.stringMatching(/578\/578 complete records/u),
    });
    expect(sources.find((source) => source.id === "ketoliv")?.deferOrBlockReason)
      .toMatch(/named-step prefixes on 69 records/u);
  });

  it("records the WordPress posts family canary run for every source it reached", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));

    // Sources whose uncapped run came back clean.
    for (const id of ["afamilyfeast", "cookiesandcups", "opskrifterforalle", "inspiredtaste"]) {
      expect(byId.get(id)?.migrationState).toBe("canary_passed");
      expect(byId.get(id)?.latestCanary).toBeTruthy();
    }
    // Short of a canary on records the source itself publishes badly.
    expect(byId.get("acouplecooks")?.migrationState).toBe("configured");
    expect(byId.get("withspice")?.deferOrBlockReason).toMatch(
      /12 records the source publishes incomplete or malformed/u
    );
    // Whole-crawl evidence that the site publishes no Recipe JSON-LD at all.
    for (const id of ["closetcooking", "asweetspoonful"]) {
      expect(byId.get(id)?.migrationState).toBe("deferred");
    }
    // Three sites rebranded after the legacy spiders were written, and their
    // API redirects across to the new name. Without it in allowedDomains every
    // response is rejected and the run ends with no candidates at all.
    expect(byId.get("therealfoodrds")?.allowedDomains).toContain("therealfooddietitians.com");
    // The rebrand fix is what turned a zero-candidate failure into a canary.
    expect(byId.get("therealfoodrds")?.migrationState).toBe("canary_passed");
    expect(byId.get("brownedbutterblondie")?.allowedDomains).toContain("athomebyheather.com");
    expect(byId.get("lowcarbdelish")?.allowedDomains).toContain("wellportionedplate.com");

    // Parity work already took gunris past a canary; recording must not undo it.
    expect(byId.get("gunris")?.migrationState).toBe("shadow_passed");
  });

  it("records a live run for every Danish source", () => {
    // The sweep covered the WPRM and WordPress-posts families, so no source is
    // left claiming a state it never earned from a run.
    const notStarted = DANISH_JSONLD_SOURCES.filter(
      (source) => source.migrationState === "not_started"
    );
    expect(notStarted.map((source) => source.id)).toEqual([]);
    // Every source states what its run found. Surdejsentusiasten predates the
    // reason column and carries its evidence in the deprecation plan instead.
    const unexplained = DANISH_JSONLD_SOURCES.filter(
      (source) => !(source.deferOrBlockReason ?? "").trim()
    );
    expect(unexplained.map((source) => source.id)).toEqual(["surdejsentusiasten"]);
  });

  it("records the WPRM family sweep with the evidence each run produced", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));

    // Every source the sweep reached carries the run that produced its state.
    for (const id of ["airfryerkogebogen", "emmaolsen", "opskriftnet", "madensverden"]) {
      expect(byId.get(id)?.latestCanary).toBeTruthy();
      expect(byId.get(id)?.migrationState).not.toBe("not_started");
    }
    // airfryerkogebogen only completed once a transient HTTP 500 on page 46
    // cleared; the recorded run is the whole 4930-record catalog.
    expect(byId.get("airfryerkogebogen")?.deferOrBlockReason)
      .toMatch(/whole 4930-record catalog/u);
    // Its legacy comparison is outstanding because the source began answering
    // HTTP 500 to everything; that is recorded rather than retried against it.
    expect(byId.get("airfryerkogebogen")?.deferOrBlockReason)
      .toMatch(/wait for the source to recover/u);
    // koudahl discovered nothing until its page size came down.
    expect(byId.get("koudahl")?.migrationState).toBe("configured");
    expect(byId.get("koudahl")?.deferOrBlockReason).toMatch(/329 recipes/u);
    // Sources whose legacy API route no longer carries their recipes.
    for (const id of ["grilltips", "karinabaagoe"]) {
      expect(byId.get(id)?.migrationState).toBe("deferred");
      expect(byId.get(id)?.deferOrBlockReason).toMatch(/collection is empty/u);
    }
    // Sources the site itself keeps unreachable.
    for (const id of ["letmad", "madbanditten", "juliekarla"]) {
      expect(byId.get(id)?.migrationState).toBe("blocked");
    }
  });

  it("carries full shadow parity for the sources compared against Scrapy", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));
    const shadowed = [
      "frukreativ", "minopskrift", "nemlchf", "madskribent", "sundmor",
      "jensensmadblog", "johanjohansen", "gastry", "chilisauce", "bondemad", "twinfood",
      "italienskvinogmad", "airfryermad", "camillemaja", "cookingclub", "altmad",
      "fuldkorn", "rigeligtsmor", "veganernu", "vielskermad", "mariasilje",
      "albertestengaard", "juliebruun", "planteaederen", "pilenskoekken", "drkoch",
      "annamaddk", "newyorkerbyheart", "muttionline", "emmaolsen", "hverdagsro",
      "frahaventilmaven", "onekitchenblog", "madogkaerlighed", "gastromad",
      "opskriftorg", "louisesmadblog", "marialottes", "opskriftnet",
      "hoerup", "madopskriften", "opskriftslageret", "nemmadplan", "veganermor",
      "lundoaagaard", "smaagroenneskridt", "kokkeriermedpassion", "anicula", "babybite",
      "nannapretzmann", "coupleinthekitchen", "bakerella", "abakershouse",
      "thecakeblog", "basisvarer", "moderncrumb", "breadtopia",
      "skalvibage", "kokke", "ingridhornshoj", "madsvin", "madfolket", "puredansk",
      "nordmad",
    ];

    for (const id of shadowed) {
      const source = byId.get(id);
      expect(source?.migrationState).toBe("shadow_passed");
      expect(source?.latestScrapyOutcome).toBe("succeeded");
      expect(source?.shadowParity).toMatch(/every material field match exactly/u);
      // Each promotion rests on two uncapped runs, not one.
      expect(source?.deferOrBlockReason).toMatch(/Two uncapped Crawlee runs/u);
    }
  });

  it("credits the percent-encoded URL fix where it changed the count", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));

    // ingridhornshoj came back 160 against legacy's 161 until the encoded
    // spelling was matched; the reason names the record so the link between
    // the fix and the count is not lost.
    expect(byId.get("ingridhornshoj")?.deferOrBlockReason)
      .toMatch(/percent-encoded URL fix recovered/u);
    expect(byId.get("ingridhornshoj")?.shadowParity).toMatch(/161\/161/u);
  });

  it("routes madrejsen past the legacy start URL the site turned into a hub", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));
    const madrejsen = byId.get("madrejsen");

    // /opskrifter/ answers 200 with a page listing the five categories and no
    // recipes, so the legacy spider starts somewhere that cannot yield any.
    expect(madrejsen?.migrationState).toBe("shadow_passed");
    expect(madrejsen?.latestScrapyOutcome).toBe("failed");
    expect(madrejsen?.deferOrBlockReason).toMatch(/category hub carrying no recipe links/u);
    // Crawlee starts from the five category routes instead.
    expect(madrejsen?.startUrls).toHaveLength(5);
    expect(madrejsen?.startUrls.every((url) => !url.endsWith("/opskrifter/"))).toBe(true);
  });

  it("takes the blocked-legacy sources through the legacy-unhealthy route", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));

    // A legacy run that is being blocked, or pointed at an abandoned domain, is
    // not a sound comparison, so these cannot be promoted on parity. They carry
    // the alternative evidence instead and say why.
    for (const id of ["butternutbakeryblog", "tasteandsee", "brownedbutterblondie"]) {
      const source = byId.get(id);
      expect(source?.migrationState).toBe("shadow_passed");
      expect(source?.latestScrapyOutcome).toBe("failed");
      expect(source?.shadowParity).toMatch(/legacy-unhealthy/u);
      expect(source?.deferOrBlockReason).toMatch(/manual read of 25 stored records/u);
    }
    expect(byId.get("brownedbutterblondie")?.deferOrBlockReason)
      .toMatch(/redirects to athomebyheather\.com/u);
    expect(byId.get("tasteandsee")?.deferOrBlockReason).toMatch(/HTTP 403/u);
  });

  it("names the yield legacy reduces to a leading integer", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));

    // Legacy takes the first integer out of recipeYield, so a published 1.75
    // becomes 1 and the unit is lost. V2 keeps the yield as written.
    expect(byId.get("smaagroenneskridt")?.deferOrBlockReason)
      .toMatch(/1\.75 yield that legacy reduces to its leading integer/u);
  });

  it("names the WPRM named-step prefixes Crawlee keeps and legacy drops", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));

    // WPRM lets a step carry a name. V2 keeps it as a "Name: body" prefix, so
    // the step matches legacy once the prefix comes off and carries more of the
    // source; the reasons say so rather than leaving it looking like drift.
    expect(byId.get("cookingclub")?.deferOrBlockReason)
      .toMatch(/named-step prefixes on 136 records/u);
    expect(byId.get("drkoch")?.deferOrBlockReason)
      .toMatch(/named-step prefix on one record/u);
    // One louisesmadblog ingredient carries zero-width characters mid-string.
    // Stripping them is the same visible text, not a dropped field.
    expect(byId.get("louisesmadblog")?.deferOrBlockReason)
      .toMatch(/zero-width characters/u);
    // Legacy was unhealthy on its first pilenskoekken run; the parity rests on
    // the run where it emitted its whole catalog.
    expect(byId.get("pilenskoekken")?.deferOrBlockReason)
      .toMatch(/robots preflight answered HTTP 403/u);
  });

  it("records the browser-fetched WordPress posts sources the unwrap fix reached", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));

    // All five now carry full parity against their legacy spiders, which is
    // what confirms the unwrap fix rather than just a clean run.
    for (const id of ["madopskriften", "opskriftslageret", "hoerup", "nemmadplan", "veganermor"]) {
      expect(byId.get(id)?.migrationState).toBe("shadow_passed");
      expect(byId.get(id)?.deferOrBlockReason)
        .toMatch(/discovered nothing at all until the browser's rendered JSON viewer/u);
    }
    // Both remaining sources are closed at the source, not by extraction.
    expect(byId.get("hverdagsgourmet")?.deferOrBlockReason)
      .toMatch(/itsec_rest_api_access_restricted/u);
    expect(byId.get("madopskriftertilairfryer")?.deferOrBlockReason)
      .toMatch(/WordPress critical-error page/u);
  });

  it("requests koudahl's WPRM collection at a page size its server can build", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));

    // koudahl answers per_page=100 with HTTP 500 and an empty body, so the
    // whole source discovered nothing; 50 is served reliably.
    expect(byId.get("koudahl")?.startUrls[0]).toContain("per_page=50");
    // Every other WPRM source keeps the default page size.
    for (const source of DANISH_JSONLD_SOURCES) {
      if (source.legacyFamily !== "WprmApiSpider" || source.id === "koudahl") continue;
      expect(source.startUrls[0]).toContain("per_page=100");
    }
  });

  it("carries the WordPress posts sources on the strict JSON-LD contract", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));
    const wpPosts = DANISH_JSONLD_SOURCES.filter(
      (source) => source.legacyFamily === "WpPostsJsonLdSpider"
    );

    expect(wpPosts).toHaveLength(76);
    for (const source of wpPosts) {
      // Discovery is the posts API, so the window must end on the terminal
      // document rather than on an empty collection.
      expect(source.listingDiscovery?.payload).toMatchObject({
        expectedRoot: "array",
        recipePaths: ["[].link"],
        terminalPayload: { path: "code", equals: "rest_post_invalid_page_number" },
      });
      // The posts API already scopes the set to this site's posts, so
      // admission is the domain check; JSON-LD presence does the filtering,
      // exactly as the legacy spider relied on.
      expect(source.recipeUrlPatterns).toEqual(["^https?://"]);
      expect(source.startUrls).toHaveLength(1);
      // Four sites expose a custom post type rather than core posts, and one
      // reaches the API through ?rest_route= instead of a path.
      // per_page is per source: aggieskitchen answers 200 with an empty body
      // above 20, so the window size is part of the source's contract.
      expect(source.startUrls[0]).toMatch(/[?&]per_page=\d+&page=1$/u);
      expect(source.startUrls[0]).toMatch(/\/wp\/v2\//u);
      expect(source.requireCompleteJsonLd).toBe(true);
      // Sources in this family are unrun until a lane reaches them, and a
      // state past not_started has to name the run that earned it.
      if (source.migrationState === "not_started") {
        expect(source.latestCanary).toBeUndefined();
      } else {
        expect(source.latestCanary).toBeTruthy();
      }
    }

    for (const [id, legacySpider, domain, postsApiUrl, usePlaywright] of DANISH_WP_POSTS_SOURCE_DEFINITIONS) {
      expect(byId.get(id)).toMatchObject({
        legacySpider,
        domain,
        allowedDomains: [domain],
        startUrls: [`${postsApiUrl}?per_page=100&page=1`],
        fetchMode: usePlaywright === false ? "cheerio" : "playwright",
        requestSettings: {
          delaySeconds: 2,
          rateLimitPerMinute: null,
          maxConcurrency: 1,
          maxRetries: 3,
        },
      });
    }
    expect(byId.get("mummum")).toMatchObject({
      migrationState: "configured",
      latestScrapyOutcome: "partial",
      latestCanary: "2026-08-19T16-20-34.637Z",
      fetchMode: "cheerio",
    });
    expect(byId.get("mummum")?.deferOrBlockReason).toMatch(
      /35-page catalog remains unvalidated/u
    );

    expect(byId.get("aggieskitchen")?.startUrls[0]).toContain("per_page=20&");

    expect(byId.get("acouplecooks")).toMatchObject({
      domain: "acouplecooks.com",
      discovery: "listing",
      fetchMode: "cheerio",
    });
  });

  it("registers compatible custom sitemap spiders without changing their routes", () => {
    const source = DANISH_JSONLD_SOURCES.find((entry) => entry.id === "beetrootbakery");
    expect(source).toMatchObject({
      legacySpider: "BeetrootBakerySpider",
      legacyFamily: "CustomSitemapSpider",
      discovery: "sitemap",
      sitemapUrls: ["https://www.beetrootbakery.dk/wp-sitemap.xml"],
      fetchMode: "cheerio",
      requestSettings: {
        delaySeconds: 2,
        rateLimitPerMinute: null,
        maxConcurrency: 2,
        maxRetries: 3,
      },
      migrationState: "configured",
      latestScrapyOutcome: "partial",
      latestCanary: "2026-08-19T16-01-22.287Z",
    });
    expect(source?.sitemapDiscovery).toMatchObject({
      followPatterns: ["post-sitemap"],
      skipUrlFragments: expect.arrayContaining(["/category/", "/tag/"]),
    });
    expect(source?.deferOrBlockReason).toMatch(/uncapped shadow comparison is still required/u);

    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "vegetariskhverdag"))
      .toMatchObject({
        legacySpider: "VegetariskhverdagSpider",
        legacyFamily: "CustomListingSpider",
        discovery: "listing",
        startUrls: ["https://vegetariskhverdag.dk/opskrifter"],
        recipeUrlPatterns: ["^/\\d{4}/\\d{2}/[a-z0-9æøå-]+/?$"],
        fetchMode: "cheerio",
        migrationState: "configured",
        latestScrapyOutcome: "partial",
        latestCanary: "2026-08-19T16-23-14.879Z",
      });

    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "spisbedre"))
      .toMatchObject({
        legacySpider: "SpisbedreSpider",
        legacyFamily: "EmbeddedJsonSitemapSpider",
        discovery: "sitemap",
        sitemapUrls: ["https://spisbedre.dk/opskrifter/sitemap.xml"],
        recipeExtractor: "spisbedre-inertia",
        fetchMode: "cheerio",
        migrationState: "configured",
        latestScrapyOutcome: "partial",
        latestCanary: "2026-08-19T16-11-30.677Z",
      });
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "webopskrifter"))
      .toMatchObject({
        legacySpider: "WebopskrifterSpider",
        legacyFamily: "HtmlMicrodataSitemapSpider",
        sitemapUrls: ["https://www.webopskrifter.dk/sitemap.xml"],
        recipeExtractor: "webopskrifter-microdata",
        fetchMode: "cheerio",
        migrationState: "configured",
        latestScrapyOutcome: "succeeded",
        latestCanary: "2026-08-19T16-16-22.434Z",
      });
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "meyers"))
      .toMatchObject({
        legacySpider: "MeyersSpider",
        legacyFamily: "SanityRecipeApiSpider",
        discovery: "listing",
        fetchMode: "cheerio",
        requestSettings: { delaySeconds: 1, maxConcurrency: 1 },
        migrationState: "shadow_passed",
        latestScrapyOutcome: "succeeded",
        latestCanary: "2026-08-19T16-28-11.559Z",
        shadowParity: expect.stringMatching(/1123\/1123 complete records matched/u),
      });
    for (const definition of DANISH_CUSTOM_WPRM_SOURCE_DEFINITIONS) {
      expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === definition.id))
        .toMatchObject({
          legacySpider: definition.legacySpider,
          legacyFamily: "CustomWprmApiSpider",
          discovery: "listing",
          startUrls: [`${definition.apiUrl}?per_page=100&page=1`],
          recipeExtractor: "wprm-api",
          fetchMode: "cheerio",
          migrationState: ["foodfanatic", "scandikitchen"].includes(definition.id)
            ? "shadow_passed"
            : "configured",
          latestScrapyOutcome: ["foodfanatic", "scandikitchen"].includes(definition.id)
            ? "succeeded"
            : "partial",
          latestCanary: definition.id === "foodfanatic"
            ? "2026-08-19T20-30-43.490Z"
            : definition.id === "scandikitchen"
              ? "2026-08-19T20-30-04.163Z"
              : "2026-08-19T16-30-48.666Z",
        });
      const source = DANISH_JSONLD_SOURCES.find((entry) => entry.id === definition.id);
      if (definition.id === "foodfanatic") {
        expect(source?.shadowParity).toMatch(/504\/504 complete records/u);
      } else if (definition.id === "scandikitchen") {
        expect(source?.shadowParity).toMatch(/109\/109 records/u);
      } else {
        expect(source?.deferOrBlockReason).toMatch(/catalog still requires an uncapped run/u);
      }
    }
    for (const definition of DANISH_SHOPIFY_BLOG_SOURCE_DEFINITIONS) {
      expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === definition.id))
        .toMatchObject({
          legacySpider: definition.legacySpider,
          legacyFamily: "HtmlRecipeSitemapSpider",
          sitemapUrls: [definition.sitemapUrl],
          recipeExtractor: "shopify-blog-html",
          fetchMode: "cheerio",
          migrationState: "shadow_passed",
          latestScrapyOutcome: "succeeded",
        });
      expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === definition.id)
        ?.shadowParity).toMatch(/\d+\/\d+/u);
    }
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "femina"))
      .toMatchObject({
        legacySpider: "FeminaSpider",
        legacyFamily: "HtmlRecipeSitemapSpider",
        sitemapUrls: ["https://www.femina.dk/sitemap.xml"],
        recipeExtractor: "femina-html",
        fetchMode: "cheerio",
        migrationState: "canary_passed",
        latestScrapyOutcome: "succeeded",
        latestCanary: "2026-08-19T17-27-48.705Z",
      });
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "gocook"))
      .toMatchObject({
        legacySpider: "GocookSpider",
        legacyFamily: "HtmlRecipeSitemapSpider",
        sitemapUrls: ["https://gocook.dk/sitemap.xml"],
        recipeExtractor: "gocook-jsonld-html",
        fetchMode: "cheerio",
        migrationState: "canary_passed",
        latestScrapyOutcome: "partial",
        latestCanary: "2026-08-19T17-34-06.299Z",
      });
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "samvirke"))
      .toMatchObject({
        legacySpider: "SamvirkeSpider",
        legacyFamily: "CustomSitemapSpider",
        recipeExtractor: "strict-json-ld",
        allowedDomains: ["samvirke.dk", "opskrifter.coop.dk"],
        canonicalFollowStatuses: [200, 404],
        migrationState: "canary_passed",
        latestScrapyOutcome: "no_data",
        latestCanary: "2026-08-19T17-45-20.157Z",
      });
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "alt"))
      .toMatchObject({
        legacySpider: "AltSpider",
        legacyFamily: "HtmlRecipeSitemapSpider",
        recipeExtractor: "alt-html",
        sitemapDiscovery: { followPatterns: ["sitemap\\?start="] },
        migrationState: "canary_passed",
        latestScrapyOutcome: "partial",
        latestCanary: "2026-08-19T17-50-45.285Z",
      });
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "365discount"))
      .toMatchObject({
        legacySpider: "Discount365Spider",
        legacyFamily: "HtmlRecipeSitemapSpider",
        recipeExtractor: "discount365-html",
        allowedDomains: ["365discount.coop.dk", "365discount.dk"],
        migrationState: "canary_passed",
        latestScrapyOutcome: "partial",
        latestCanary: "2026-08-19T18-03-03.842Z",
      });
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "drdk"))
      .toMatchObject({
        legacySpider: "DrDkSpider",
        legacyFamily: "DirectRecipeApiSpider",
        recipeExtractor: "dr-graphql",
        migrationState: "canary_passed",
        latestScrapyOutcome: "no_data",
        latestCanary: "2026-08-19T18-10-28.791Z",
      });
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "dr"))
      .toMatchObject({ legacySpider: "DrSpider", aliasFor: "drdk" });
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "hellofresh"))
      .toMatchObject({
        legacySpider: "HellofreshSpider",
        legacyFamily: "DirectRecipeApiSpider",
        recipeExtractor: "hellofresh-api",
        migrationState: "canary_passed",
        latestScrapyOutcome: "partial",
        latestCanary: "2026-08-19T18-16-15.232Z",
      });
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "madforfattigroeve"))
      .toMatchObject({
        legacySpider: "MadForFattigroeveSpider",
        legacyFamily: "DirectRecipeApiSpider",
        recipeExtractor: "madforfattigroeve-nextjs",
        migrationState: "canary_passed",
      });
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "meny"))
      .toMatchObject({
        legacySpider: "MenySpider",
        recipeExtractor: "meny-api",
        migrationState: "canary_passed",
        latestScrapyOutcome: "partial",
        latestCanary: "2026-08-19T18-24-35.758Z",
      });
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "aarstiderne"))
      .toMatchObject({ legacySpider: "AarstiderneSpider", aliasFor: "meny" });
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "nemlig"))
      .toMatchObject({
        legacySpider: "NemligSpider",
        recipeExtractor: "nemlig-sitecore",
        disableHeaderGenerator: true,
        migrationState: "canary_passed",
      });
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "kagerogsager"))
      .toMatchObject({
        legacySpider: "KagerOgSagerSpider",
        discovery: "listing",
        numericYieldOnly: true,
        migrationState: "shadow_passed",
        latestCanary: "2026-08-19T19-21-03.129Z",
        shadowParity: expect.stringContaining("9/9"),
      });
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "dkkogebogen"))
      .toMatchObject({
        legacySpider: "DkKogebogenSpider",
        discovery: "listing",
        recipeExtractor: "dkkogebogen-microdata",
        migrationState: "canary_passed",
      });
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "nipunijulie"))
      .toMatchObject({
        recipeExtractor: "nipunijulie-body-html",
        migrationState: "shadow_passed",
        latestScrapyOutcome: "succeeded",
        shadowParity: expect.stringContaining("140/140"),
      });
    expect(DANISH_JSONLD_SOURCES.find((entry) => entry.id === "thefoodclub"))
      .toMatchObject({
        recipeExtractor: "thefoodclub-body-html",
        fetchMode: "cheerio",
        migrationState: "canary_passed",
      });
  });

  it("carries the international JSON-LD sources on the same strict contract", () => {
    const byId = new Map(DANISH_JSONLD_SOURCES.map((source) => [source.id, source]));

    for (const sourceId of ["allrecipes", "bbcgoodfood", "jamieoliver", "progresso"]) {
      expect(byId.get(sourceId)).toMatchObject({
        discovery: "sitemap",
        fetchMode: "cheerio",
        requireCompleteJsonLd: true,
      });
      // None of them may claim a pass; each has run and fallen short of one.
      expect(byId.get(sourceId)?.migrationState).not.toBe("canary_passed");
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

    // A payload listing reads a JSON API, where HTML link selectors have no
    // meaning; the default selectors are an HTML-listing invariant.
    for (const listing of listingSources.filter(
      (source) =>
        !["dkkogebogen", "foodfanatic", "madrejsen", "meyers", "rema1000", "scandikitchen", "tv2mad"]
          .includes(source.id) &&
        source.legacyFamily !== "DirectRecipeApiSpider" &&
        source.listingDiscovery?.payload === undefined
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

    expect(byId.get("dkkogebogen")?.listingDiscovery).toMatchObject({
      recipeLinkSelectors: ['a[href*="/opskrifter/"]'],
      continuationSelectors: [
        'a[href*="/kategorier/"]',
        'a[href*="/retter/"]',
        'a[rel~="next"][href]',
      ],
      continuationForefront: true,
      recipeForefront: true,
    });

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
