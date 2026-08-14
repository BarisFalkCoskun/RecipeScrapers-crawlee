import { describe, expect, it } from "vitest";
import {
  discoverListingPage,
  discoverSitemapDocument,
  looksLikeHttp200BlockShell,
} from "../../src/danish-jsonld/discovery.js";
import {
  DANISH_JSONLD_SOURCES,
  type DanishJsonLdSource,
} from "../../src/danish-jsonld/source-registry.js";

const source: DanishJsonLdSource = {
  id: "fixture",
  domain: "example.dk",
  allowedDomains: ["example.dk", "www.example.dk"],
  legacySpider: "FixtureSpider",
  legacyFamily: "JsonLdSitemapRecipeSpider",
  discovery: "sitemap",
  sitemapUrls: ["https://example.dk/sitemap.xml"],
  startUrls: [],
  recipeUrlPatterns: ["^/opskrifter/[^/?#]+/?$"],
  fetchMode: "cheerio",
  requestSettings: {
    delaySeconds: 2,
    rateLimitPerMinute: null,
    maxConcurrency: 2,
    maxRetries: 3,
  },
  requireCompleteJsonLd: true,
  migrationState: "configured",
  latestScrapyOutcome: "not_audited",
};

describe("Danish JSON-LD discovery", () => {
  it("accepts explicit recipe URLs and nested sitemaps while diagnosing rejected sitemap entries", () => {
    const result = discoverSitemapDocument({
      source,
      sitemapUrl: "https://example.dk/sitemap.xml",
      xml: `<?xml version="1.0"?>
        <sitemapindex>
          <sitemap><loc>https://example.dk/recipes-2.xml</loc></sitemap>
          <url><loc>https://example.dk/opskrifter/kage</loc></url>
          <url><loc>https://example.dk/om-os</loc></url>
          <url><loc>https://outside.test/opskrifter/kage</loc></url>
          <url><loc>::not-a-url::</loc></url>
          <url><loc>https://example.dk/opskrifter/kage</loc></url>
        </sitemapindex>`,
    });

    expect(result.recipeUrls).toEqual(["https://example.dk/opskrifter/kage"]);
    expect(result.sitemapUrls).toEqual(["https://example.dk/recipes-2.xml"]);
    expect(result.acceptedCount).toBe(2);
    expect(result.rejectedByReason).toEqual({
      "domain-not-allowed": 1,
      duplicate: 1,
      "invalid-url": 1,
      "pattern-mismatch": 1,
    });
  });

  it("extracts recipe and next-page links from listings and reports a terminal page", () => {
    const first = discoverListingPage({
      source: { ...source, discovery: "listing", legacyFamily: "JsonLdListingSpider" },
      pageUrl: "https://example.dk/opskrifter/",
      body: `<a href="/opskrifter/kage">Kage</a>
        <a href="/om-os">Om os</a>
        <a rel="next" href="/opskrifter/page/2">Næste</a>`,
    });
    const terminal = discoverListingPage({
      source: { ...source, discovery: "listing", legacyFamily: "JsonLdListingSpider" },
      pageUrl: "https://example.dk/opskrifter/page/2",
      body: `<a href="/opskrifter/boller">Boller</a>`,
    });

    expect(first.recipeUrls).toEqual(["https://example.dk/opskrifter/kage"]);
    expect(first.nextUrls).toEqual(["https://example.dk/opskrifter/page/2"]);
    expect(first.terminal).toBe(false);
    expect(first.rejectedByReason).toEqual({ "pattern-mismatch": 1 });
    expect(terminal.recipeUrls).toEqual(["https://example.dk/opskrifter/boller"]);
    expect(terminal.nextUrls).toEqual([]);
    expect(terminal.terminal).toBe(true);
  });

  it("reports a script-gated load-more listing as incomplete instead of terminal", () => {
    const result = discoverListingPage({
      source: { ...source, discovery: "listing", legacyFamily: "JsonLdListingSpider" },
      pageUrl: "https://example.dk/opskrifter/",
      body: `<a href="/opskrifter/kage">Kage</a>
        <a href="/opskrifter/boller">Boller</a>
        <div class="ds_button-group">
          <button class="ds_button"><span>Vis flere</span></button>
        </div>`,
    });

    expect(result.recipeUrls).toEqual([
      "https://example.dk/opskrifter/kage",
      "https://example.dk/opskrifter/boller",
    ]);
    expect(result.nextUrls).toEqual([]);
    expect(result.complete).toBe(false);
    expect(result.incompleteReasons).toEqual(["script-gated-continuation"]);
  });

  it("keeps a genuinely terminal listing complete when no load-more control exists", () => {
    const result = discoverListingPage({
      source: { ...source, discovery: "listing", legacyFamily: "JsonLdListingSpider" },
      pageUrl: "https://example.dk/opskrifter/page/13",
      body: `<a href="/opskrifter/kage">Kage</a>
        <button class="filter">Filtrer</button>`,
    });

    expect(result.complete).toBe(true);
    expect(result.incompleteReasons).toEqual([]);
  });

  it("does not flag a load-more control when a real continuation link is present", () => {
    const result = discoverListingPage({
      source: { ...source, discovery: "listing", legacyFamily: "JsonLdListingSpider" },
      pageUrl: "https://example.dk/opskrifter/",
      body: `<a href="/opskrifter/kage">Kage</a>
        <a rel="next" href="/opskrifter/page/2">Næste</a>
        <button>Vis flere</button>`,
    });

    expect(result.nextUrls).toEqual(["https://example.dk/opskrifter/page/2"]);
    expect(result.complete).toBe(true);
    expect(result.incompleteReasons).toEqual([]);
  });

  it("ignores a load-more control on a listing that yielded no recipe links", () => {
    const result = discoverListingPage({
      source: { ...source, discovery: "listing", legacyFamily: "JsonLdListingSpider" },
      pageUrl: "https://example.dk/om-os",
      body: `<a href="/om-os">Om os</a>
        <button>Vis flere</button>`,
    });

    expect(result.recipeUrls).toEqual([]);
    expect(result.complete).toBe(true);
    expect(result.incompleteReasons).toEqual([]);
  });

  const offsetSource = (): DanishJsonLdSource => ({
    ...source,
    discovery: "listing",
    legacyFamily: "JsonLdListingSpider",
    listingDiscovery: {
      recipeLinkSelectors: [],
      skipPathFragments: [],
      continuationSelectors: [],
      continuationUrlPatterns: [],
      listingHosts: ["listing-api.test"],
      payload: {
        kind: "json-paths",
        expectedRoot: "array",
        recipePaths: ["[].url"],
        continuationOffset: { parameter: "from", step: 2, maxOffset: 4 },
      },
    },
  });

  const offsetBody = (slugs: string[]) =>
    JSON.stringify(slugs.map((slug) => ({ url: `https://example.dk/opskrifter/${slug}` })));

  it("reads recipe URLs from a root-array listing payload", () => {
    const result = discoverListingPage({
      source: offsetSource(),
      pageUrl: "https://listing-api.test/search?from=0",
      body: offsetBody(["kage", "boller"]),
      contentType: "application/json",
    });

    expect(result.recipeUrls).toEqual([
      "https://example.dk/opskrifter/kage",
      "https://example.dk/opskrifter/boller",
    ]);
    expect(result.complete).toBe(true);
  });

  it("advances a full offset page to the next offset on the listing host", () => {
    const result = discoverListingPage({
      source: offsetSource(),
      pageUrl: "https://listing-api.test/search?from=0",
      body: offsetBody(["kage", "boller"]),
      contentType: "application/json",
    });

    expect(result.nextUrls).toEqual(["https://listing-api.test/search?from=2"]);
    expect(result.terminal).toBe(false);
  });

  it("stops offset pagination on a short page without reporting it incomplete", () => {
    const result = discoverListingPage({
      source: offsetSource(),
      pageUrl: "https://listing-api.test/search?from=2",
      body: offsetBody(["kage"]),
      contentType: "application/json",
    });

    expect(result.nextUrls).toEqual([]);
    expect(result.terminal).toBe(true);
    expect(result.complete).toBe(true);
  });

  it("reports the service result window as incomplete when a full page hits maxOffset", () => {
    const result = discoverListingPage({
      source: offsetSource(),
      pageUrl: "https://listing-api.test/search?from=4",
      body: offsetBody(["kage", "boller"]),
      contentType: "application/json",
    });

    expect(result.nextUrls).toEqual([]);
    expect(result.complete).toBe(false);
    expect(result.incompleteReasons).toEqual(["listing-window-exhausted"]);
  });

  it("keeps recipe URLs off the listing host even when the payload offers them", () => {
    const result = discoverListingPage({
      source: offsetSource(),
      pageUrl: "https://listing-api.test/search?from=0",
      body: JSON.stringify([
        { url: "https://listing-api.test/opskrifter/kage" },
        { url: "https://example.dk/opskrifter/boller" },
      ]),
      contentType: "application/json",
    });

    expect(result.recipeUrls).toEqual(["https://example.dk/opskrifter/boller"]);
    expect(result.rejectedByReason).toMatchObject({ "domain-not-allowed": 1 });
  });

  it("extracts dynamic listing URLs from bounded JSON responses", () => {
    const result = discoverListingPage({
      source: { ...source, discovery: "listing", legacyFamily: "JsonLdListingSpider" },
      pageUrl: "https://example.dk/api/search",
      body: JSON.stringify({
        hits: [
          { url: "/opskrifter/kage" },
          { href: "https://outside.test/opskrifter/kage" },
        ],
      }),
      contentType: "application/json",
    });

    expect(result.recipeUrls).toEqual(["https://example.dk/opskrifter/kage"]);
    expect(result.rejectedByReason).toEqual({ "domain-not-allowed": 1 });
  });

  it("recognizes Ferrero-style dynamic JSON pagination keys", () => {
    const result = discoverListingPage({
      source: { ...source, discovery: "listing", legacyFamily: "JsonLdListingSpider" },
      pageUrl: "https://example.dk/api/search?page=1",
      body: JSON.stringify({
        hits: [{ link: "/opskrifter/kage" }],
        pagination: {
          next: "/api/search?page=2",
          nextUrl: "/api/search?page=3",
          next_url: "/api/search?page=4",
          nextPage: { href: "/api/search?page=5" },
        },
      }),
      contentType: "application/json",
    });

    expect(result.recipeUrls).toEqual(["https://example.dk/opskrifter/kage"]);
    expect(result.nextUrls).toEqual([
      "https://example.dk/api/search?page=2",
      "https://example.dk/api/search?page=3",
      "https://example.dk/api/search?page=4",
      "https://example.dk/api/search?page=5",
    ]);
    expect(result.terminal).toBe(false);
  });

  it("uses typed selectors for rel-next, icon-only next anchors, and REMA pagination", () => {
    const listingSource = {
      ...source,
      discovery: "listing" as const,
      legacyFamily: "JsonLdListingSpider" as const,
      listingDiscovery: {
        recipeLinkSelectors: ["a[href]"],
        skipPathFragments: [],
        continuationSelectors: [
          "a.next[href]",
          'link[rel~="next"][href]',
          "a.sr-only[href]",
        ],
        continuationUrlPatterns: [],
      },
    };
    const result = discoverListingPage({
      source: listingSource,
      pageUrl: "https://example.dk/opskrifter/",
      body: `<a href="/opskrifter/kage">Kage</a>
        <a class="next" href="/opskrifter/page/2"><svg/></a>
        <link rel="next" href="/opskrifter/page/3">
        <a class="sr-only" href="/opskrifter/page/4"><span aria-hidden="true">›</span></a>`,
    });

    expect(result.nextUrls).toEqual([
      "https://example.dk/opskrifter/page/2",
      "https://example.dk/opskrifter/page/3",
      "https://example.dk/opskrifter/page/4",
    ]);
  });

  it("keeps a continuation when a numbered pagination link repeats the next URL", () => {
    const madoghave = DANISH_JSONLD_SOURCES.find(
      (entry) => entry.id === "madoghave"
    )!;
    const result = discoverListingPage({
      source: madoghave,
      pageUrl: madoghave.startUrls[0],
      body: `
        <a href="/recipe-items/kage/">Kage</a>
        <a class="page-numbers" href="/opskrifter/page/2/">2</a>
        <a class="next page-numbers" href="/opskrifter/page/2/">Next &rarr;</a>
      `,
    });

    expect(result.recipeUrls).toEqual(["https://madoghave.dk/recipe-items/kage/"]);
    expect(result.nextUrls).toEqual(["https://madoghave.dk/opskrifter/page/2/"]);
    expect(result.terminal).toBe(false);
  });

  it.each([
    ["kitchenaid", "https://www.kitchenaid.dk/opskrifter/alle", "/opskrifter/alle/12"],
    ["klank", "https://klank.dk/index.php/opskrifter-koekken/", "/index.php/opskrifter-kategori/desserter/"],
  ])("follows typed recursive listing URLs for %s", (sourceId, pageUrl, href) => {
    const exceptional = DANISH_JSONLD_SOURCES.find((entry) => entry.id === sourceId)!;
    const result = discoverListingPage({
      source: exceptional,
      pageUrl,
      body: `<a href="${href}"><svg/></a>`,
    });
    expect(result.nextUrls).toEqual([new URL(href, pageUrl).toString()]);
  });

  it("applies inherited and source-specific listing skip paths before recipe patterns", () => {
    const inherited = DANISH_JSONLD_SOURCES.find(
      (entry) => entry.id === "frokenkraesen_com"
    )!;
    const result = discoverListingPage({
      source: inherited,
      pageUrl: inherited.startUrls[0],
      body: `<a href="/om-os">Om os</a><a href="/kage">Kage</a>`,
    });
    expect(result.recipeUrls).toEqual([new URL("/kage", inherited.startUrls[0]).toString()]);
    expect(result.rejectedByReason).toMatchObject({ "skip-path": 1 });
  });

  it.each([
    ["glutenfrimagi", "/opskrifter/"],
    ["heidiogper", "/opskrifter/forside"],
    ["knaehoejkarse", "/alle-opskrifter/"],
    ["recipesairfryer_dk", "/da/hjemmeside-da/"],
  ])("executes the %s source-specific listing skip rule", (sourceId, href) => {
    const exceptional = DANISH_JSONLD_SOURCES.find((entry) => entry.id === sourceId)!;
    const result = discoverListingPage({
      source: exceptional,
      pageUrl: exceptional.startUrls[0],
      body: `<a href="${href}">Index</a>`,
    });
    expect(result.recipeUrls).toEqual([]);
    expect(result.rejectedByReason).toMatchObject({ "skip-path": 1 });
  });

  it("discovers Madrejsen recipes from category cards without admitting navigation links", () => {
    const source = DANISH_JSONLD_SOURCES.find((entry) => entry.id === "madrejsen")!;
    const result = discoverListingPage({
      source,
      pageUrl: "https://madrejsen.dk/aftensmad/",
      body: `
        <nav><a href="/sous-vide/">Sous Vide</a></nav>
        <article class="entry">
          <h2><a class="entry-title-link" href="/malaysisk-kyllingekarry/">Recipe</a></h2>
        </article>
        <span class="pagination-next"><a href="/aftensmad/page/2/">Next Page »</a></span>
      `,
    });

    expect(source.startUrls).toEqual([
      "https://madrejsen.dk/sous-vide/",
      "https://madrejsen.dk/morgenmad/",
      "https://madrejsen.dk/frokost/",
      "https://madrejsen.dk/aftensmad/",
      "https://madrejsen.dk/tilbehor/",
    ]);
    expect(result.recipeUrls).toEqual([
      "https://madrejsen.dk/malaysisk-kyllingekarry/",
    ]);
    expect(result.nextUrls).toEqual([
      "https://madrejsen.dk/aftensmad/page/2/",
    ]);
  });

  it("applies typed sitemap follow and skip rules", () => {
    const bobedre = DANISH_JSONLD_SOURCES.find((entry) => entry.id === "bobedre")!;
    const nested = discoverSitemapDocument({
      source: bobedre,
      sitemapUrl: bobedre.sitemapUrls[0],
      xml: `<sitemapindex>
        <sitemap><loc>https://bobedre.dk/contenthub_composite-recipes.xml</loc></sitemap>
        <sitemap><loc>https://bobedre.dk/news-sitemap.xml</loc></sitemap>
      </sitemapindex>`,
    });
    expect(nested.sitemapUrls).toEqual([
      "https://bobedre.dk/contenthub_composite-recipes.xml",
    ]);
    expect(nested.rejectedByReason).toMatchObject({ "sitemap-follow-mismatch": 1 });

    const entries = discoverSitemapDocument({
      source: bobedre,
      sitemapUrl: nested.sitemapUrls[0],
      xml: `<urlset>
        <url><loc>https://bobedre.dk/opskrifter/hovedret?view=all</loc></url>
        <url><loc>https://bobedre.dk/opskrifter/kage</loc></url>
      </urlset>`,
    });
    expect(entries.recipeUrls).toEqual(["https://bobedre.dk/opskrifter/kage"]);
    expect(entries.rejectedByReason).toMatchObject({ "sitemap-skip": 1 });
  });

  it.each([
    ["bobedre", "https://bobedre.dk/contenthub_composite-recipes.xml"],
    ["iform", "https://iform.dk/contenthub_composite-recipes.xml"],
    ["kikkoman", "https://www.kikkoman.dk/sitemap.xml?sitemap=recipes"],
    ["micadeli", "https://micadeli.dk/post-sitemap.xml"],
    ["nogetiovnen", "https://nogetiovnen.dk/post-sitemap2.xml"],
  ])("executes the %s source-specific sitemap follow rule", (sourceId, nestedUrl) => {
    const exceptional = DANISH_JSONLD_SOURCES.find((entry) => entry.id === sourceId)!;
    const result = discoverSitemapDocument({
      source: exceptional,
      sitemapUrl: exceptional.sitemapUrls[0],
      xml: `<sitemapindex><sitemap><loc>${nestedUrl}</loc></sitemap></sitemapindex>`,
    });
    expect(result.sitemapUrls).toEqual([nestedUrl]);
  });

  it.each([
    ["bobedre", "/opskrifter/hovedret?view=all"],
    ["christinaskoekken", "/opskrifter-med/chokolade/"],
    ["frederikkewaerens", "/opskrifter/kager/"],
    ["madsvin", "/kategori/desserter/"],
    ["mariavestergaard", "/opskrifter/"],
    ["nogetiovnen", "/opskrifter/"],
    ["sundpaabudget", "/basislager/"],
  ])("executes the %s source-specific sitemap skip rule", (sourceId, path) => {
    const exceptional = DANISH_JSONLD_SOURCES.find((entry) => entry.id === sourceId)!;
    const candidate = new URL(path, exceptional.sitemapUrls[0]).toString();
    const result = discoverSitemapDocument({
      source: exceptional,
      sitemapUrl: exceptional.sitemapUrls[0],
      xml: `<urlset><url><loc>${candidate.replaceAll("&", "&amp;")}</loc></url></urlset>`,
    });
    expect(result.recipeUrls).toEqual([]);
    expect(result.rejectedByReason).toMatchObject({ "sitemap-skip": 1 });
  });

  it("fails closed for malformed and unexpected typed JSON listing payloads", () => {
    const ferrero = DANISH_JSONLD_SOURCES.find(
      (entry) => entry.id === "ferrerorocher"
    )!;
    const malformed = discoverListingPage({
      source: ferrero,
      pageUrl: ferrero.startUrls[0],
      body: "{not-json",
      contentType: "application/json",
    });
    const unexpected = discoverListingPage({
      source: ferrero,
      pageUrl: ferrero.startUrls[0],
      body: JSON.stringify({ url: "/dk/da/tips-og-ideer/opskrifter/kage" }),
      contentType: "application/json",
    });

    expect(malformed).toMatchObject({
      complete: false,
      incompleteReasons: ["malformed-listing-payload"],
    });
    expect(unexpected).toMatchObject({
      recipeUrls: [],
      complete: false,
      incompleteReasons: ["unexpected-listing-shape"],
    });
  });

  it("accepts an expected empty typed JSON result as complete no-data discovery", () => {
    const ferrero = DANISH_JSONLD_SOURCES.find(
      (entry) => entry.id === "ferrerorocher"
    )!;
    const result = discoverListingPage({
      source: ferrero,
      pageUrl: ferrero.startUrls[0],
      body: JSON.stringify({ hits: { hits: [] } }),
      contentType: "application/json",
    });

    expect(result).toMatchObject({
      recipeUrls: [],
      complete: true,
      incompleteReasons: [],
    });
  });

  it("discovers the current Gamle Opskrifter sitemap recipe route", () => {
    const gamleOpskrifter = DANISH_JSONLD_SOURCES.find(
      (entry) => entry.id === "gamleopskrifter"
    )!;
    const result = discoverSitemapDocument({
      source: gamleOpskrifter,
      sitemapUrl: "https://gamleopskrifter.com/sitemap.xml",
      xml: `<urlset>
        <url><loc>https://gamleopskrifter.com/</loc></url>
        <url><loc>https://gamleopskrifter.com/g/home/r/bacongryde</loc></url>
      </urlset>`,
    });

    expect(result.recipeUrls).toEqual([
      "https://gamleopskrifter.com/g/home/r/bacongryde",
    ]);
  });

  it("executes Ferrero's typed JSON path for both legacy string and array URLs", () => {
    const ferrero = DANISH_JSONLD_SOURCES.find(
      (entry) => entry.id === "ferrerorocher"
    )!;
    const result = discoverListingPage({
      source: ferrero,
      pageUrl: ferrero.startUrls[0],
      body: JSON.stringify({
        hits: {
          hits: [
            { _source: { url: "/dk/da/tips-og-ideer/opskrifter/kage" } },
            { _source: { url: ["/dk/da/tips-og-ideer/opskrifter/dessert"] } },
          ],
        },
      }),
      contentType: "application/json",
    });

    expect(result).toMatchObject({
      recipeUrls: [
        "https://www.ferrerorocher.com/dk/da/tips-og-ideer/opskrifter/kage",
        "https://www.ferrerorocher.com/dk/da/tips-og-ideer/opskrifter/dessert",
      ],
      complete: true,
      incompleteReasons: [],
    });
  });

  it("uses the configured Ferrero JSON payload strategy when Content-Type is absent", () => {
    const ferrero = DANISH_JSONLD_SOURCES.find(
      (entry) => entry.id === "ferrerorocher"
    )!;
    const result = discoverListingPage({
      source: ferrero,
      pageUrl: ferrero.startUrls[0],
      body: JSON.stringify({
        hits: {
          hits: [{ _source: { url: "/dk/da/tips-og-ideer/opskrifter/kage" } }],
        },
      }),
    });

    expect(result.recipeUrls).toEqual([
      "https://www.ferrerorocher.com/dk/da/tips-og-ideer/opskrifter/kage",
    ]);
    expect(result.complete).toBe(true);
  });

  it.each([
    ["kitchenaid", "https://www.kitchenaid.dk/opskrifter/alle", "/opskrifter/alle/12?campaign=summer"],
    ["klank", "https://klank.dk/index.php/opskrifter-koekken/", "/index.php/opskrifter-kategori/desserter/?ref=menu"],
  ])("matches %s continuation rules against pathname when query parameters exist", (sourceId, pageUrl, href) => {
    const exceptional = DANISH_JSONLD_SOURCES.find((entry) => entry.id === sourceId)!;
    const result = discoverListingPage({
      source: exceptional,
      pageUrl,
      body: `<a href="${href}"><svg/></a>`,
    });

    expect(result.nextUrls).toEqual([new URL(href, pageUrl).toString()]);
  });

  it("does not classify an ordinary reCAPTCHA script as an HTTP-200 block shell", () => {
    expect(looksLikeHttp200BlockShell(`
      <html><head><title>Opskrifter</title>
      <script src="https://www.google.com/recaptcha/api.js"></script></head>
      <body><main><h1>Opskrifter</h1><a href="/opskrifter/kage">Kage</a></main></body></html>
    `)).toBe(false);
    expect(looksLikeHttp200BlockShell(
      "<html><title>Checking your browser</title><body>Cloudflare challenge</body></html>"
    )).toBe(true);
  });
});
