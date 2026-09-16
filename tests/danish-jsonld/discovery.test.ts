import { describe, expect, it } from "vitest";
import {
  discoverListingPage,
  discoverSitemapDocument,
  matchesSourceRecipeUrl,
  looksLikeHttp200BlockShell,
  unwrapBrowserJsonDocument,
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

  it("matches path-scoped recipe rules even when a listing link has presentation query parameters", () => {
    const result = discoverListingPage({
      source: { ...source, discovery: "listing", legacyFamily: "JsonLdListingSpider" },
      pageUrl: "https://example.dk/opskrifter/",
      body: `<a href="/opskrifter/kage/?portfolioCats=57">Kage</a>`,
    });

    expect(result.recipeUrls).toEqual([
      "https://example.dk/opskrifter/kage/?portfolioCats=57",
    ]);
    expect(result.rejectedByReason).toEqual({});
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

  const wpPostsSource = (): DanishJsonLdSource => ({
    ...source,
    discovery: "listing",
    legacyFamily: "WpPostsJsonLdSpider",
    listingDiscovery: {
      recipeLinkSelectors: [],
      skipPathFragments: [],
      continuationSelectors: [],
      continuationUrlPatterns: [],
      payload: {
        kind: "json-paths",
        expectedRoot: "array",
        recipePaths: ["[].link"],
        continuationOffset: { parameter: "page", step: 1, maxOffset: 500 },
        terminalPayload: { path: "code", equals: "rest_post_invalid_page_number" },
      },
    },
  });

  it("ends WordPress posts pagination on the invalid-page-number document", () => {
    const result = discoverListingPage({
      source: wpPostsSource(),
      pageUrl: "https://example.dk/wp-json/wp/v2/posts?per_page=100&page=7",
      // WordPress localises `message`, so only `code` is a stable signal.
      body: JSON.stringify({
        code: "rest_post_invalid_page_number",
        message: "Det forespurgte sidenummer er større end antallet af sider.",
        data: { status: 400 },
      }),
      contentType: "application/json",
    });

    expect(result.recipeUrls).toEqual([]);
    expect(result.nextUrls).toEqual([]);
    expect(result.terminal).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.incompleteReasons).toEqual([]);
  });

  it("still reports an unrecognised object payload as an unexpected shape", () => {
    const result = discoverListingPage({
      source: wpPostsSource(),
      pageUrl: "https://example.dk/wp-json/wp/v2/posts?per_page=100&page=7",
      body: JSON.stringify({ code: "rest_forbidden", data: { status: 401 } }),
      contentType: "application/json",
    });

    expect(result.complete).toBe(false);
    expect(result.incompleteReasons).toEqual(["unexpected-listing-shape"]);
  });

  it("advances WordPress posts pagination while pages stay full", () => {
    const result = discoverListingPage({
      source: wpPostsSource(),
      pageUrl: "https://example.dk/wp-json/wp/v2/posts?per_page=100&page=1",
      body: JSON.stringify([
        { link: "https://example.dk/opskrifter/kage" },
        { link: "https://example.dk/opskrifter/boller" },
      ]),
      contentType: "application/json",
    });

    expect(result.recipeUrls).toEqual([
      "https://example.dk/opskrifter/kage",
      "https://example.dk/opskrifter/boller",
    ]);
    expect(result.nextUrls).toEqual([
      "https://example.dk/wp-json/wp/v2/posts?per_page=100&page=2",
    ]);
  });

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

  it("treats an empty root-array page as a clean end of the listing", () => {
    const result = discoverListingPage({
      source: offsetSource(),
      pageUrl: "https://listing-api.test/search?from=4",
      body: "[]",
      contentType: "application/json",
    });

    expect(result.recipeUrls).toEqual([]);
    expect(result.nextUrls).toEqual([]);
    expect(result.terminal).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.incompleteReasons).toEqual([]);
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

  it("recognises a proof-of-work challenge that carries no words", () => {
    // pinoyrecipe answers the crawler with a 1994-byte document whose only
    // content is the altcha script, while the same API returns JSON with 100
    // records to a plain client. Matching on visible text cannot see it - the
    // page has none - so the run recorded a malformed listing payload, which
    // reads as our parsing fault rather than the source turning the crawler away.
    const challenge = `<!DOCTYPE html><html><head>`
      + `<meta name="viewport" content="width=device-width, initial-scale=1">`
      + `</head><body><script src="https://cdn.jsdelivr.net/npm/altcha/dist/altcha.js" async defer>`
      + `</script></body></html>`;

    expect(looksLikeHttp200BlockShell(challenge)).toBe(true);
  });

  it("recognises the same challenge from a different vendor", () => {
    // alt.dk serves a 2101-byte document titled "Are we human?" whose only
    // content is /_labrador/pow/slow.js. It answers 200, so a crawl reads it as
    // a page that merely has no recipe: one run counted 13554 of them as
    // incomplete extractions and still reported discovery complete with nothing
    // blocked.
    const challenge = `<!DOCTYPE html><html><head>`
      + `<title>Are we human?</title>`
      + `<script defer type="text/javascript" src="/_labrador/pow/slow.js"></script>`
      + `</head><body></body></html>`;

    expect(looksLikeHttp200BlockShell(challenge)).toBe(true);
  });

  it("does not call an ordinary page a challenge for mentioning a script", () => {
    const page = `<html><head><title>Opskrifter</title></head><body><main>`
      + `<h1>Opskrifter</h1><p>altcha.js is a proof-of-work library.</p>`
      + `<a href="/opskrifter/kage">Kage</a></main></body></html>`;

    // The wording appears as prose rather than a script reference, and nothing
    // here is an interstitial.
    expect(looksLikeHttp200BlockShell(page)).toBe(false);
  });

  it("recognises the reloading, Cloudflare and Anubis interstitials by their wording", () => {
    // opskrifter.dk answered every URL, sitemap.xml included, with this shell
    // under HTTP 200 on 2026-09-14; madbanditten pages carried Anubis's.
    const shells = [
      `<!DOCTYPE html><html lang="en"><head><meta charset="utf8"><title>One moment, please...</title>`
        + `<script>setTimeout(function(){ window.location.reload(); }, 5000);</script></head>`
        + `<body><div class="spinner"></div><p>Please wait while your request is being verified...</p></body></html>`,
      `<!DOCTYPE html><html><head><title>Just a moment...</title></head><body><noscript>Enable JavaScript and cookies to continue</noscript></body></html>`,
      `<!doctype html><html lang="en"><head><title>Making sure you&#39;re not a bot!</title></head><body><h1>Making sure you&#39;re not a bot!</h1></body></html>`,
    ];
    for (const shell of shells) expect(looksLikeHttp200BlockShell(shell)).toBe(true);
    const article = `<html><head><title>Kage</title></head><body><main><p>Just a moment... before you bake, read this.</p>`
      + Array.from({ length: 25 }, (_v, i) => `<a href="/opskrift/${i}">Opskrift ${i}</a>`).join("")
      + `</main></body></html>`;
    expect(looksLikeHttp200BlockShell(article)).toBe(false);
  });

  it("records a nested sitemap link that answers HTML without failing discovery", () => {
    // jamieoliver's sitemap.xml lists /sitemap, which serves the homepage; the
    // 4821 recipe links it shows were already taken from the XML.
    const result = discoverSitemapDocument({
      source,
      sitemapUrl: "https://example.com/sitemap",
      xml: "<!DOCTYPE html><html><head><title>Home</title></head><body><a href=\"/opskrifter/kage\">Kage</a></body></html>",
      required: false,
    });
    expect(result.complete).toBe(true);
    expect(result.incompleteReasons).toEqual([]);
    expect(result.rejectedByReason).toMatchObject({ "sitemap-not-xml": 1 });
    expect(result.recipeUrls).toEqual([]);
  });

  it("does not read a non-sitemap answer to a sitemap URL as an empty sitemap", () => {
    const result = discoverSitemapDocument({
      source,
      sitemapUrl: "https://example.com/sitemap.xml",
      xml: "<!DOCTYPE html><html><head><title>Welcome</title></head><body><p>Hello</p></body></html>",
    });
    expect(result.complete).toBe(false);
    expect(result.incompleteReasons).toEqual(["sitemap-not-xml"]);
    expect(result.recipeUrls).toEqual([]);
  });

  it("calls a large half-arrived listing truncated rather than malformed", () => {
    // allergylicious stored nothing under two concurrent crawls on a host low on
    // memory and stored 324 records with complete discovery on its own. Either
    // way the run recorded "malformed-listing-payload", which reads as the
    // source publishing a broken listing when the body was cut off in transit.
    const ferrero = DANISH_JSONLD_SOURCES.find((entry) => entry.id === "ferrerorocher")!;
    const halfArrived = `[{"id":1,"content":"${"x".repeat(70_000)}"},{"id":2,"cont`;

    const result = discoverListingPage({
      source: ferrero,
      pageUrl: ferrero.startUrls[0],
      body: halfArrived,
      contentType: "application/json",
    });

    expect(result).toMatchObject({
      complete: false,
      incompleteReasons: ["truncated-listing-payload"],
    });
  });

  it("still calls a short unparseable body malformed", () => {
    const ferrero = DANISH_JSONLD_SOURCES.find((entry) => entry.id === "ferrerorocher")!;

    const result = discoverListingPage({
      source: ferrero,
      pageUrl: ferrero.startUrls[0],
      body: "{not-json",
      contentType: "application/json",
    });

    expect(result.incompleteReasons).toEqual(["malformed-listing-payload"]);
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

  it("does not parse a JSON listing looking for an HTTP-200 block shell", () => {
    // easysavory's WPRM listing is 1.9 MB of JSON carrying HTML fragments in its
    // fields. Parsing it here built a tree deep enough to overflow the stack, so
    // the page failed every retry, paging stopped, and the source held 200 of
    // the 642 recipes it declares. A challenge shell is small and HTML.
    const jsonListing = JSON.stringify(
      Array.from({ length: 200 }, (_, index) => ({
        id: index,
        recipe: { name: `Opskrift ${index}`, ingredients_flat: [] },
        content: { rendered: "<div><p>Checking your browser</p></div>".repeat(50) },
      })),
    );

    expect(looksLikeHttp200BlockShell(jsonListing)).toBe(false);
  });

  it("does not parse a body far larger than any challenge shell", () => {
    const huge = `<html><body>Cloudflare challenge${"<p>x</p>".repeat(80_000)}</body></html>`;

    expect(huge.length).toBeGreaterThan(512_000);
    expect(looksLikeHttp200BlockShell(huge)).toBe(false);
  });

  it("still recognises a challenge shell after the guards", () => {
    expect(looksLikeHttp200BlockShell(
      "<html><title>Access denied</title><body>unusual traffic detected</body></html>"
    )).toBe(true);
  });

  it("reads a WordPress posts listing that a browser rendered in its JSON viewer", () => {
    const dittejulie = DANISH_JSONLD_SOURCES.find(
      (entry) => entry.id === "dittejulie"
    )!;
    const posts = JSON.stringify([
      { link: "https://dittejulie.dk/donuts-med-vanilje/" },
      { link: "https://dittejulie.dk/boller-med-kanel/" },
    ]);
    const result = discoverListingPage({
      source: dittejulie,
      pageUrl: dittejulie.startUrls[0],
      // Chromium serves a JSON URL through its viewer document, so a
      // browser-fetched posts API arrives wrapped in <pre> rather than raw.
      body: `<html><head><meta name="color-scheme" content="light dark">`
        + `<meta charset="utf-8"></head><body><pre>${posts}</pre></body></html>`,
      contentType: "text/html",
    });

    expect(result.recipeUrls).toEqual([
      "https://dittejulie.dk/donuts-med-vanilje/",
      "https://dittejulie.dk/boller-med-kanel/",
    ]);
    expect(result.complete).toBe(true);
    expect(result.incompleteReasons).toEqual([]);
  });

  it("decodes entities the JSON viewer escaped and still rejects genuinely malformed bodies", () => {
    const dittejulie = DANISH_JSONLD_SOURCES.find(
      (entry) => entry.id === "dittejulie"
    )!;
    const escaped = discoverListingPage({
      source: dittejulie,
      pageUrl: dittejulie.startUrls[0],
      body: "<html><body><pre>[{&quot;link&quot;:"
        + "&quot;https://dittejulie.dk/aeb%C3%A6r/&quot;}]</pre></body></html>",
      contentType: "text/html",
    });
    const notJson = discoverListingPage({
      source: dittejulie,
      pageUrl: dittejulie.startUrls[0],
      body: "<html><body><pre>Service Unavailable</pre></body></html>",
      contentType: "text/html",
    });

    expect(escaped.recipeUrls).toEqual(["https://dittejulie.dk/aeb%C3%A6r/"]);
    expect(notJson).toMatchObject({
      complete: false,
      incompleteReasons: ["malformed-listing-payload"],
    });
  });

  it("leaves a raw JSON body untouched when unwrapping a browser document", () => {
    expect(unwrapBrowserJsonDocument('[{"link":"https://example.dk/a"}]'))
      .toBe('[{"link":"https://example.dk/a"}]');
    expect(unwrapBrowserJsonDocument('  {"code":"rest_post_invalid_page_number"}  '))
      .toBe('  {"code":"rest_post_invalid_page_number"}  ');
    // An HTML listing page is not a viewer document and must stay HTML so the
    // cheerio branch keeps handling it.
    expect(unwrapBrowserJsonDocument("<html><body><a href=\"/opskrifter/kage\">Kage</a></body></html>"))
      .toBe("<html><body><a href=\"/opskrifter/kage\">Kage</a></body></html>");
  });

  it("ends browser-rendered posts pagination on the terminal payload", () => {
    const dittejulie = DANISH_JSONLD_SOURCES.find(
      (entry) => entry.id === "dittejulie"
    )!;
    const result = discoverListingPage({
      source: dittejulie,
      pageUrl: dittejulie.startUrls[0],
      body: '<html><body><pre>{"code":"rest_post_invalid_page_number",'
        + '"message":"The page number requested is larger than the number of pages available."}'
        + "</pre></body></html>",
      contentType: "text/html",
    });

    expect(result.terminal).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.recipeUrls).toEqual([]);
  });


  it("matches a recipe URL the sitemap published percent-encoded", () => {
    const ingrid = DANISH_JSONLD_SOURCES.find((entry) => entry.id === "ingridhornshoj")!;

    // The pattern is written against readable Danish characters; the sitemap
    // publishes the same URL encoded, and both are the same page.
    expect(matchesSourceRecipeUrl(
      ingrid,
      "https://ingridhornshoj.dk/opskrift/pok%C3%A9-bowl-med-torpedorejer"
    )).toBe(true);
    expect(matchesSourceRecipeUrl(
      ingrid,
      "https://ingridhornshoj.dk/opskrift/poké-bowl-med-torpedorejer"
    )).toBe(true);
    // Plain ASCII paths are unaffected.
    expect(matchesSourceRecipeUrl(
      ingrid,
      "https://ingridhornshoj.dk/opskrift/poke-bowl-med-tun"
    )).toBe(true);
    // Decoding does not widen the pattern to paths it should still reject.
    expect(matchesSourceRecipeUrl(
      ingrid,
      "https://ingridhornshoj.dk/blog/pok%C3%A9-bowl-med-torpedorejer"
    )).toBe(false);
  });

  it("keeps a malformed percent sequence out of the match", () => {
    const ingrid = DANISH_JSONLD_SOURCES.find((entry) => entry.id === "ingridhornshoj")!;

    // decodeURI throws on this; a URL that cannot be decoded is simply not
    // offered in its decoded spelling rather than failing the whole check.
    expect(matchesSourceRecipeUrl(
      ingrid,
      "https://ingridhornshoj.dk/opskrift/pok%ZZ-bowl"
    )).toBe(false);
    expect(matchesSourceRecipeUrl(
      ingrid,
      "https://ingridhornshoj.dk/opskrift/gulerodskage"
    )).toBe(true);
  });

  // pillsbury addresses a recipe as /recipes/<slug>/<uuid> and a category page
  // as /recipes/<type>/<name> - the same shape without the uuid. A bare
  // "/recipes/" pattern admitted 109 category pages as recipe candidates; they
  // publish no Recipe JSON-LD and fall into no rejection bucket, so the run
  // reported far more candidates than it could ever persist.
  it("admits a pillsbury recipe by its uuid and leaves its category pages out", () => {
    const pillsbury = DANISH_JSONLD_SOURCES.find((entry) => entry.id === "pillsbury")!;

    expect(matchesSourceRecipeUrl(
      pillsbury,
      "https://www.pillsbury.com/recipes/easter-bread/615ea976-2924-4949-812e-d96f0c268100"
    )).toBe(true);
    for (const category of [
      "https://www.pillsbury.com/recipes/meal-course/dinner",
      "https://www.pillsbury.com/recipes/ingredient/pork",
      "https://www.pillsbury.com/recipes/dish-type/cookies",
      "https://www.pillsbury.com/recipes/slow-cooker-recipes/breakfast",
      "https://www.pillsbury.com/bake-off-contest/recipes/every-single-grand-prize-winning-bake-off-recipe-ever",
    ]) {
      expect(matchesSourceRecipeUrl(pillsbury, category)).toBe(false);
    }
  });

});
