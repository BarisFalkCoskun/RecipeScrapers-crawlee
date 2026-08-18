import { describe, expect, it } from "vitest";
import { gunzipSync } from "node:zlib";
import {
  DanishJsonLdSourceSession,
  type DanishJsonLdDiagnostic,
} from "../../src/danish-jsonld/crawler.js";
import type { DanishJsonLdSource } from "../../src/danish-jsonld/source-registry.js";
import type {
  CrawlRunDocument,
  PageDocument,
  RecipeDocument,
  RecipeDocumentV2,
} from "../../src/types.js";
import type { CrawlStore, RecipeDocumentV2Store } from "../../src/storage/store.js";

const source: DanishJsonLdSource = {
  id: "fixture",
  domain: "example.dk",
  allowedDomains: ["example.dk"],
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

class MemoryV2Store implements CrawlStore, RecipeDocumentV2Store {
  readonly pages = new Map<string, Omit<PageDocument, "_id">>();
  readonly recipesV2: Array<Omit<RecipeDocumentV2, "_id">> = [];

  async upsertPage(page: Omit<PageDocument, "_id">): Promise<void> {
    this.pages.set(page.canonicalUrl, page);
  }
  async upsertRecipeV2(recipe: Omit<RecipeDocumentV2, "_id">) {
    const index = this.recipesV2.findIndex(
      (stored) => stored.sourceRecipeKey === recipe.sourceRecipeKey
    );
    if (index >= 0) {
      this.recipesV2[index] = recipe;
      return { operation: "updated" as const, contentMatches: [] };
    }
    this.recipesV2.push(recipe);
    return { operation: "inserted" as const, contentMatches: [] };
  }
  async insertRecipe(_recipe: Omit<RecipeDocument, "_id">): Promise<void> {}
  async wasPageFetchedSince(): Promise<boolean> { return false; }
  async findFreshPageUrls(): Promise<Set<string>> { return new Set(); }
  async insertCrawlRun(_run: Omit<CrawlRunDocument, "_id">): Promise<void> {}
}

const completeRecipe = {
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Kage",
  recipeIngredient: ["1 æg"],
  recipeInstructions: [{ "@type": "HowToStep", text: "Bag kagen." }],
};

describe("Danish JSON-LD source session", () => {
  it("records an off-domain request only after runner queue admission, without requiring page persistence", () => {
    const session = new DanishJsonLdSourceSession({
      source,
      store: new MemoryV2Store(),
      crawlRunId: "run-admission",
      crawlAttemptId: "attempt-admission",
      maxPages: 5,
    });

    session.recordQueueAdmission("https://unrelated.example/opskrifter/kage");

    expect(session.observation.unintendedOffDomainAdmissions).toBe(1);
  });

  it("routes incomplete Cheerio evidence to Playwright once and persists only the rendered complete JSON-LD", async () => {
    const store = new MemoryV2Store();
    const diagnostics: DanishJsonLdDiagnostic[] = [];
    const session = new DanishJsonLdSourceSession({
      source,
      store,
      crawlRunId: "run-1",
      crawlAttemptId: "attempt-1",
      maxPages: 5,
      diagnosticSink: (event) => diagnostics.push(event),
    });
    const url = "https://example.dk/opskrifter/kage";

    const first = await session.handleResponse({
      kind: "recipe",
      fetchMode: "cheerio",
      url,
      statusCode: 200,
      headers: { server: "fixture", "cf-ray": "abc", "retry-after": "5" },
      body: `<html><body><script type="application/ld+json">{
        "@type":"Recipe","name":"Kage"
      }</script></body></html>`,
    });
    const duplicate = await session.handleResponse({
      kind: "recipe",
      fetchMode: "cheerio",
      url,
      statusCode: 200,
      headers: {},
      body: "<html><body>recipe shell</body></html>",
    });
    const rendered = await session.handleResponse({
      kind: "recipe",
      fetchMode: "playwright",
      url,
      loadedUrl: `${url}?rendered=1`,
      statusCode: 200,
      headers: {},
      body: `<script type="application/ld+json">${JSON.stringify(completeRecipe)}</script>`,
    });

    expect(first.playwrightRequests).toEqual([{ kind: "recipe", url }]);
    expect(duplicate.playwrightRequests).toEqual([]);
    expect(rendered.playwrightRequests).toEqual([]);
    expect(store.recipesV2).toHaveLength(1);
    expect(store.recipesV2[0]).toMatchObject({
      schemaVersion: 2,
      sourceId: "fixture",
      canonicalUrl: url,
      extractionMethod: "json-ld",
    });
    const page = store.pages.get(url);
    expect(page?.fetchMode).toBe("playwright");
    expect(page?.rawJsonLdScripts).toHaveLength(1);
    expect(
      gunzipSync(Buffer.from(page?.rawJsonLdScripts?.[0].buffer ?? [])).toString()
    ).toBe(JSON.stringify(completeRecipe));
    expect(diagnostics.map((event) => event.event)).toContain("playwright-decision");
    expect(diagnostics.map((event) => event.event)).toContain("mongo-page-upsert");
    expect(diagnostics.map((event) => event.event)).toContain("mongo-upsert");
  });

  it("never emits a legacy HTML fallback recipe and records rejection evidence", async () => {
    const store = new MemoryV2Store();
    const session = new DanishJsonLdSourceSession({
      source,
      store,
      crawlRunId: "run-1",
      crawlAttemptId: "attempt-2",
      maxPages: 5,
    });

    await session.handleResponse({
      kind: "recipe",
      fetchMode: "playwright",
      url: "https://example.dk/opskrifter/html-only",
      statusCode: 200,
      headers: {},
      body: `<article itemtype="https://schema.org/Recipe">
        <h1>Kage</h1><ul><li class="ingredient">1 æg</li></ul>
        <ol><li class="instruction">Bag.</li></ol>
      </article>`,
    });

    expect(store.recipesV2).toEqual([]);
    expect(session.observation.persistedRecipes).toBe(0);
    expect(session.observation.rejectedIncompleteJsonLd).toBe(0);
    expect(store.pages.get("https://example.dk/opskrifter/html-only")?.recipeCount).toBe(0);
  });

  it("does not render a page whose JSON-LD parsed cleanly but holds no Recipe", async () => {
    const session = new DanishJsonLdSourceSession({
      source,
      store: new MemoryV2Store(),
      crawlRunId: "run-article",
      crawlAttemptId: "attempt-article",
      maxPages: 5,
    });

    // Valid Article JSON-LD and no Recipe node: the server already answered
    // definitively, so re-rendering cannot produce a recipe.
    const routes = await session.handleResponse({
      kind: "recipe",
      fetchMode: "cheerio",
      url: "https://example.dk/opskrifter/artikel",
      statusCode: 200,
      headers: {},
      body: `<html><body><script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        headline: "Ti gode råd",
      })}</script></body></html>`,
    });

    expect(routes.playwrightRequests).toEqual([]);
  });

  it("still renders a page whose Recipe JSON-LD is incomplete", async () => {
    const session = new DanishJsonLdSourceSession({
      source,
      store: new MemoryV2Store(),
      crawlRunId: "run-incomplete",
      crawlAttemptId: "attempt-incomplete",
      maxPages: 5,
    });

    const routes = await session.handleResponse({
      kind: "recipe",
      fetchMode: "cheerio",
      url: "https://example.dk/opskrifter/delvis",
      statusCode: 200,
      headers: {},
      body: `<html><body><script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Recipe",
        name: "Kage",
      })}</script></body></html>`,
    });

    expect(routes.playwrightRequests).toEqual([
      { kind: "recipe", url: "https://example.dk/opskrifter/delvis" },
    ]);
  });

  it("does not render ordinary complete HTML without dynamic evidence", async () => {
    const session = new DanishJsonLdSourceSession({
      source,
      store: new MemoryV2Store(),
      crawlRunId: "run-1",
      crawlAttemptId: "attempt-no-fallback",
      maxPages: 5,
    });

    const routes = await session.handleResponse({
      kind: "recipe",
      fetchMode: "cheerio",
      url: "https://example.dk/opskrifter/no-jsonld",
      statusCode: 200,
      headers: {},
      body: "<html><body><article><h1>Ordinary page</h1><p>Static content.</p></article></body></html>",
    });

    expect(routes.playwrightRequests).toEqual([]);
  });

  it("keeps recipe requests on Playwright for a registry Playwright source", async () => {
    const session = new DanishJsonLdSourceSession({
      source: {
        ...source,
        discovery: "listing",
        legacyFamily: "JsonLdListingSpider",
        fetchMode: "playwright",
      },
      store: new MemoryV2Store(),
      crawlRunId: "run-playwright-source",
      crawlAttemptId: "attempt-playwright-source",
      maxPages: 5,
    });

    const routes = await session.handleResponse({
      kind: "listing",
      fetchMode: "playwright",
      url: "https://example.dk/opskrifter/",
      statusCode: 200,
      headers: { "content-type": "text/html" },
      body: `<a href="/opskrifter/kage">Kage</a>`,
    });

    expect(routes.cheerioRequests).toEqual([]);
    expect(routes.playwrightRequests).toEqual([
      { kind: "recipe", url: "https://example.dk/opskrifter/kage" },
    ]);
  });

  it.each([
    ["malformed-listing-payload", "application/json", "{not-json"],
    ["http-200-block-shell", "text/html", "<html><title>Checking your browser</title><body>Cloudflare challenge</body></html>"],
  ])("marks HTTP-200 discovery %s as incomplete with a stable reason", async (
    reason,
    contentType,
    body
  ) => {
    const session = new DanishJsonLdSourceSession({
      source: { ...source, discovery: "listing", legacyFamily: "JsonLdListingSpider" },
      store: new MemoryV2Store(),
      crawlRunId: "run-discovery-failure",
      crawlAttemptId: `attempt-${reason}`,
      maxPages: 5,
    });

    await session.handleResponse({
      kind: "listing",
      fetchMode: "cheerio",
      url: "https://example.dk/opskrifter/",
      statusCode: 200,
      headers: { "content-type": contentType },
      body,
    });

    expect(session.observation.discoveryComplete).toBe(false);
    expect(session.observation.discoveryFailureReasons).toContain(reason);
    expect(session.outcome()).toMatchObject({
      outcome: reason === "http-200-block-shell" ? "blocked" : "failed",
      outcomeReasons: expect.arrayContaining([reason, "discovery-incomplete"]),
    });
  });

  it("keeps a script-gated load-more listing out of a succeeded outcome", async () => {
    const session = new DanishJsonLdSourceSession({
      source: { ...source, discovery: "listing", legacyFamily: "JsonLdListingSpider" },
      store: new MemoryV2Store(),
      crawlRunId: "run-script-gated",
      crawlAttemptId: "attempt-script-gated",
      maxPages: 5,
    });

    await session.handleResponse({
      kind: "listing",
      fetchMode: "cheerio",
      url: "https://example.dk/opskrifter/",
      statusCode: 200,
      headers: { "content-type": "text/html" },
      body: `<a href="/opskrifter/kage">Kage</a>
        <button><span>Vis flere</span></button>`,
    });

    expect(session.observation.discoveryComplete).toBe(false);
    expect(session.observation.discoveryFailureReasons).toContain(
      "script-gated-continuation"
    );
    expect(session.outcome().outcome).not.toBe("succeeded");
  });

  it("admits a configured listing host without counting it off-domain", async () => {
    const listingSource = {
      ...source,
      discovery: "listing" as const,
      legacyFamily: "JsonLdListingSpider" as const,
      listingDiscovery: {
        recipeLinkSelectors: [],
        skipPathFragments: [],
        continuationSelectors: [],
        continuationUrlPatterns: [],
        listingHosts: ["listing-api.test"],
        payload: {
          kind: "json-paths" as const,
          expectedRoot: "array" as const,
          recipePaths: ["[].url"],
          continuationOffset: { parameter: "from", step: 2, maxOffset: 10 },
        },
      },
    };
    const session = new DanishJsonLdSourceSession({
      source: listingSource,
      store: new MemoryV2Store(),
      crawlRunId: "run-listing-host",
      crawlAttemptId: "attempt-listing-host",
      maxPages: 10,
    });

    const routes = await session.handleResponse({
      kind: "listing",
      fetchMode: "cheerio",
      url: "https://listing-api.test/search?from=0",
      loadedUrl: "https://listing-api.test/search?from=0",
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify([
        { url: "https://example.dk/opskrifter/kage" },
        { url: "https://example.dk/opskrifter/boller" },
      ]),
    });

    for (const request of [...routes.cheerioRequests, ...routes.playwrightRequests]) {
      session.recordQueueAdmission(request.url);
    }

    expect(routes.cheerioRequests).toEqual([
      { kind: "recipe", url: "https://example.dk/opskrifter/kage" },
      { kind: "recipe", url: "https://example.dk/opskrifter/boller" },
      { kind: "listing", url: "https://listing-api.test/search?from=2" },
    ]);
    expect(session.observation.unintendedOffDomainAdmissions).toBe(0);
    expect(session.observation.discoveryComplete).toBe(true);
  });

  it("ignores a canonical href that concatenates two URLs", async () => {
    const store = new MemoryV2Store();
    const session = new DanishJsonLdSourceSession({
      source,
      store,
      crawlRunId: "run-canonical-concat",
      crawlAttemptId: "attempt-canonical-concat",
      maxPages: 5,
    });

    // The site glued its base onto an absolute URL. The result parses, but its
    // host is nonsense, so it is a template bug rather than a cross-site
    // canonical and must not invalidate the source's discovery.
    await session.handleResponse({
      kind: "recipe",
      fetchMode: "cheerio",
      url: "https://example.dk/opskrifter/kage",
      statusCode: 200,
      headers: {},
      body: `<html><head><link rel="canonical" href="https://example.dkhttps://example.dk/opskrifter/kage"/></head>
        <body><script type="application/ld+json">${JSON.stringify(completeRecipe)}</script></body></html>`,
    });

    expect(session.observation.discoveryComplete).toBe(true);
    expect(session.observation.discoveryFailureReasons).toEqual([]);
    expect(store.recipesV2).toHaveLength(1);
    expect(store.recipesV2[0]?.canonicalUrl).toBe("https://example.dk/opskrifter/kage");
  });

  it("records a non-2xx response as a failure sample too", async () => {
    const session = new DanishJsonLdSourceSession({
      source,
      store: new MemoryV2Store(),
      crawlRunId: "run-status-sample",
      crawlAttemptId: "attempt-status-sample",
      maxPages: 5,
    });

    // A response that arrives and is simply not 2xx counts as a failure, and
    // needs recording just as much as one that threw in the error handler.
    await session.handleResponse({
      kind: "recipe",
      fetchMode: "cheerio",
      url: "https://example.dk/opskrifter/borte",
      statusCode: 404,
      headers: {},
      body: "not found",
    });

    expect(session.observation.failedRequests).toBe(1);
    expect(session.observation.failedRequestSamples).toEqual([
      { url: "https://example.dk/opskrifter/borte", statusCode: 404, error: "http-404" },
    ]);
  });

  it("records a bounded sample of failed requests in the observation", async () => {
    const session = new DanishJsonLdSourceSession({
      source,
      store: new MemoryV2Store(),
      crawlRunId: "run-failed-sample",
      crawlAttemptId: "attempt-failed-sample",
      maxPages: 20,
    });

    await session.recordFailedRequest({
      fetchMode: "cheerio",
      kind: "recipe",
      url: "https://example.dk/opskrifter/kage",
      retryCount: 3,
      error: new Error("socket hang up"),
    });

    // Failed-request diagnostics go through the budgeted sink and vanish on a
    // long crawl, leaving a partial outcome with no traceable cause.
    expect(session.observation.failedRequestSamples).toEqual([
      { url: "https://example.dk/opskrifter/kage", statusCode: null, error: "socket hang up" },
    ]);
  });

  it("records the rejected canonical URLs in the observation", async () => {
    const session = new DanishJsonLdSourceSession({
      source,
      store: new MemoryV2Store(),
      crawlRunId: "run-canonical-record",
      crawlAttemptId: "attempt-canonical-record",
      maxPages: 5,
    });

    for (const slug of ["a", "b"]) {
      await session.handleResponse({
        kind: "recipe",
        fetchMode: "cheerio",
        url: `https://example.dk/opskrifter/${slug}`,
        statusCode: 200,
        headers: {},
        body: `<html><head><link rel="canonical" href="https://elsewhere.test/${slug}"/></head></html>`,
      });
    }

    // The evidence file has to name the offending URLs; the diagnostic budget
    // drops these events on a long crawl, leaving the cause unidentifiable.
    expect(session.observation.rejectedCanonicalUrls).toEqual([
      "https://elsewhere.test/a",
      "https://elsewhere.test/b",
    ]);
  });

  it("ignores a canonical href that is not a hostname at all", async () => {
    const store = new MemoryV2Store();
    const session = new DanishJsonLdSourceSession({
      source,
      store,
      crawlRunId: "run-canonical-junk",
      crawlAttemptId: "attempt-canonical-junk",
      maxPages: 5,
    });

    // A tag list emitted where a URL belongs. It parses, but the host cannot
    // be a hostname, so it is a template bug rather than a cross-site
    // canonical and must not invalidate the source's discovery.
    await session.handleResponse({
      kind: "recipe",
      fetchMode: "cheerio",
      url: "https://example.dk/opskrifter/kage",
      statusCode: 200,
      headers: {},
      body: `<html><head><link rel="canonical" href="http://hjemme,sommerferie,italien/"/></head>
        <body><script type="application/ld+json">${JSON.stringify(completeRecipe)}</script></body></html>`,
    });

    expect(session.observation.discoveryComplete).toBe(true);
    expect(session.observation.rejectedCanonicalUrls ?? []).toEqual([]);
    expect(store.recipesV2[0]?.canonicalUrl).toBe("https://example.dk/opskrifter/kage");
  });

  it("still rejects a genuine cross-site canonical", async () => {
    const store = new MemoryV2Store();
    const session = new DanishJsonLdSourceSession({
      source,
      store,
      crawlRunId: "run-canonical-cross",
      crawlAttemptId: "attempt-canonical-cross",
      maxPages: 5,
    });

    await session.handleResponse({
      kind: "recipe",
      fetchMode: "cheerio",
      url: "https://example.dk/opskrifter/kage",
      statusCode: 200,
      headers: {},
      body: `<html><head><link rel="canonical" href="https://elsewhere.test/opskrifter/kage"/></head>
        <body><script type="application/ld+json">${JSON.stringify(completeRecipe)}</script></body></html>`,
    });

    expect(session.observation.discoveryComplete).toBe(false);
    expect(store.recipesV2).toEqual([]);
  });

  it("rejects an off-domain loaded URL before extraction or persistence", async () => {
    const store = new MemoryV2Store();
    const diagnostics: DanishJsonLdDiagnostic[] = [];
    const session = new DanishJsonLdSourceSession({
      source,
      store,
      crawlRunId: "run-redirect",
      crawlAttemptId: "attempt-redirect",
      maxPages: 5,
      diagnosticSink: (event) => diagnostics.push(event),
    });

    await session.handleResponse({
      kind: "recipe",
      fetchMode: "cheerio",
      url: "https://example.dk/opskrifter/kage",
      loadedUrl: "https://external.example/harvested",
      statusCode: 200,
      headers: {},
      body: `<script type="application/ld+json">${JSON.stringify(completeRecipe)}</script>`,
    });

    expect(store.pages.size).toBe(0);
    expect(store.recipesV2).toEqual([]);
    expect(session.observation.discoveryComplete).toBe(false);
    expect(session.outcome().outcomeReasons).toContain("loaded-url-domain-not-allowed");
    expect(diagnostics).toContainEqual(expect.objectContaining({
      event: "source-domain-rejected",
      data: expect.objectContaining({ boundary: "loaded-url", hostname: "external.example" }),
    }));
  });

  it("rejects an external canonical before page or recipe persistence", async () => {
    const store = new MemoryV2Store();
    const session = new DanishJsonLdSourceSession({
      source,
      store,
      crawlRunId: "run-canonical",
      crawlAttemptId: "attempt-canonical",
      maxPages: 5,
    });

    await session.handleResponse({
      kind: "recipe",
      fetchMode: "cheerio",
      url: "https://example.dk/opskrifter/kage",
      statusCode: 200,
      headers: {},
      body: `<link rel="canonical" href="https://external.example/stolen">
        <script type="application/ld+json">${JSON.stringify(completeRecipe)}</script>`,
    });

    expect(store.pages.size).toBe(0);
    expect(store.recipesV2).toEqual([]);
    expect(session.observation.discoveryComplete).toBe(false);
    expect(session.outcome().outcomeReasons).toContain("canonical-domain-not-allowed");
  });

  it.each([401, 403, 429, 455, 526])(
    "rejects blocked HTTP %i before extraction or persistence",
    async (statusCode) => {
    const store = new MemoryV2Store();
    const diagnostics: DanishJsonLdDiagnostic[] = [];
    const session = new DanishJsonLdSourceSession({
      source,
      store,
      crawlRunId: "run-1",
      crawlAttemptId: "attempt-blocked",
      maxPages: 5,
      diagnosticSink: (event) => diagnostics.push(event),
    });

    const routes = await session.handleResponse({
      kind: "recipe",
      fetchMode: "cheerio",
      url: "https://example.dk/opskrifter/blocked",
      statusCode,
      headers: {
        "retry-after": "60",
        "cf-ray": "fixture-ray",
        server: "cloudflare",
      },
      body: `<script type="application/ld+json">${JSON.stringify(completeRecipe)}</script> blocked`,
    });

    expect(routes).toEqual({ cheerioRequests: [], playwrightRequests: [] });
    expect(store.pages.size).toBe(0);
    expect(store.recipesV2).toEqual([]);
    expect(session.outcome()).toEqual({
      sourceId: "fixture",
      outcome: "blocked",
      outcomeReasons: ["requests-blocked"],
    });
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        event: "http-response",
        data: expect.objectContaining({
          statusCode,
          retryAfter: "60",
          cfRay: "fixture-ray",
          server: "cloudflare",
        }),
      })
    );
    }
  );

  it("classifies a non-blocking 404 as a failed request, never no_data", async () => {
    const store = new MemoryV2Store();
    const session = new DanishJsonLdSourceSession({
      source,
      store,
      crawlRunId: "run-1",
      crawlAttemptId: "attempt-not-found",
      maxPages: 5,
    });

    await session.handleResponse({
      kind: "recipe",
      fetchMode: "cheerio",
      url: "https://example.dk/opskrifter/missing",
      statusCode: 404,
      headers: {},
      body: `<script type="application/ld+json">${JSON.stringify(completeRecipe)}</script>`,
    });

    expect(store.pages.size).toBe(0);
    expect(store.recipesV2).toEqual([]);
    expect(session.outcome()).toEqual({
      sourceId: "fixture",
      outcome: "failed",
      outcomeReasons: ["failed-requests"],
    });
  });

  it("persists control-character-repaired JSON-LD and emits bounded repair evidence", async () => {
    const store = new MemoryV2Store();
    const diagnostics: DanishJsonLdDiagnostic[] = [];
    const session = new DanishJsonLdSourceSession({
      source,
      store,
      crawlRunId: "run-repaired-jsonld",
      crawlAttemptId: "attempt-repaired-jsonld",
      maxPages: 5,
      diagnosticSink: (event) => diagnostics.push(event),
    });

    await session.handleResponse({
      kind: "recipe",
      fetchMode: "cheerio",
      url: "https://example.dk/opskrifter/hummus",
      statusCode: 200,
      headers: {},
      body: `<script type="application/ld+json">{"@type":"Recipe","name":"Hummus","recipeCategory":"
        Vegetarisk","recipeIngredient":["Kikærter"],"recipeInstructions":["Blend."]}</script>`,
    });

    expect(store.recipesV2).toHaveLength(1);
    expect(store.recipesV2[0]?.extractionSignals)
      .toContain("json-ld-control-character-repaired");
    expect(diagnostics).toContainEqual(expect.objectContaining({
      event: "json-ld-repair",
      data: expect.objectContaining({ repairedScriptCount: 1 }),
    }));
  });

  it("preserves blocked status evidence received through a terminal failure handler", async () => {
    const diagnostics: DanishJsonLdDiagnostic[] = [];
    const session = new DanishJsonLdSourceSession({
      source,
      store: new MemoryV2Store(),
      crawlRunId: "run-1",
      crawlAttemptId: "attempt-terminal-status",
      maxPages: 5,
      diagnosticSink: (event) => diagnostics.push(event),
    });

    await session.recordFailedRequest({
      fetchMode: "cheerio",
      kind: "recipe",
      url: "https://example.dk/opskrifter/limited",
      retryCount: 3,
      statusCode: 429,
      headers: { "retry-after": "120", "cf-ray": "terminal-ray" },
      snippet: "rate limited",
      error: new Error("429 response"),
    });

    expect(session.outcome()).toEqual({
      sourceId: "fixture",
      outcome: "blocked",
      outcomeReasons: ["requests-blocked"],
    });
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        event: "request-failed",
        data: expect.objectContaining({
          statusCode: 429,
          retryAfter: "120",
          cfRay: "terminal-ray",
          snippet: "rate limited",
        }),
      })
    );
  });

  it("classifies a direct HTTP 454 browser-check response as blocked", async () => {
    const session = new DanishJsonLdSourceSession({
      source,
      store: new MemoryV2Store(),
      crawlRunId: "run-http-454",
      crawlAttemptId: "attempt-http-454",
      maxPages: 5,
    });

    await session.handleResponse({
      kind: "recipe",
      fetchMode: "cheerio",
      url: "https://example.dk/opskrifter/browser-check",
      statusCode: 454,
      headers: { server: "Simply.com" },
      body: "<html><title>Checking your browser...</title></html>",
    });

    expect(session.observation.blockedRequests).toBe(1);
    expect(session.observation.failedRequests).toBe(0);
    expect(session.outcome()).toEqual({
      sourceId: "fixture",
      outcome: "blocked",
      outcomeReasons: ["requests-blocked"],
    });
  });

  it("classifies relay-pool exhaustion as an explicit blocked outcome", async () => {
    const session = new DanishJsonLdSourceSession({
      source,
      store: new MemoryV2Store(),
      crawlRunId: "run-1",
      crawlAttemptId: "attempt-vpn-exhausted",
      maxPages: 5,
      diagnosticSink: () => undefined,
    });

    await session.recordFailedRequest({
      fetchMode: "playwright",
      kind: "listing",
      url: "https://example.dk/opskrifter/",
      retryCount: 0,
      blockedReason: "vpn-relay-pool-exhausted",
      error: new Error("No verified Mullvad relay is available for example.dk"),
    });

    expect(session.outcome()).toEqual({
      sourceId: "fixture",
      outcome: "blocked",
      outcomeReasons: [
        "discovery-incomplete",
        "requests-blocked",
        "vpn-relay-pool-exhausted",
      ],
    });
  });

  it("marks a hard per-source canary cap as incomplete run evidence", async () => {
    const session = new DanishJsonLdSourceSession({
      source,
      store: new MemoryV2Store(),
      crawlRunId: "run-1",
      crawlAttemptId: "attempt-3",
      maxPages: 1,
    });

    const routes = await session.handleResponse({
      kind: "sitemap",
      fetchMode: "cheerio",
      url: "https://example.dk/sitemap.xml",
      statusCode: 200,
      headers: {},
      body: `<urlset>
        <url><loc>https://example.dk/opskrifter/one</loc></url>
        <url><loc>https://example.dk/opskrifter/two</loc></url>
      </urlset>`,
    });

    expect(routes.cheerioRequests).toEqual([]);
    expect(session.observation.discoveryComplete).toBe(false);
    expect(session.observation.pageCapReached).toBe(true);
    expect(session.outcome()).toEqual({
      sourceId: "fixture",
      outcome: "failed",
      outcomeReasons: [
        "discovery-incomplete",
        "max-pages-cap-reached",
        "recipe-candidates-discovered",
      ],
    });
  });
});
