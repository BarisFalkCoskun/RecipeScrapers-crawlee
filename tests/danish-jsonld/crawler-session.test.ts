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
      outcome: reason === "http-200-block-shell" ? "blocked" : "partial",
      outcomeReasons: expect.arrayContaining([reason, "discovery-incomplete"]),
    });
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

  it.each([401, 403, 429, 526])(
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
      outcome: "partial",
      outcomeReasons: [
        "discovery-incomplete",
        "max-pages-cap-reached",
        "recipe-candidates-discovered",
      ],
    });
  });
});
