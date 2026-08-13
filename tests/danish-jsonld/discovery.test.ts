import { describe, expect, it } from "vitest";
import {
  discoverListingPage,
  discoverSitemapDocument,
} from "../../src/danish-jsonld/discovery.js";
import type { DanishJsonLdSource } from "../../src/danish-jsonld/source-registry.js";

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
});
