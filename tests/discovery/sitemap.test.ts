import { describe, expect, it } from "vitest";
import { resolveSeedSitemapUrls } from "../../src/discovery/sitemap.js";
import type { SeedConfig } from "../../src/types.js";

describe("resolveSeedSitemapUrls", () => {
  const seed: SeedConfig = {
    domain: "example.dk",
    sitemapUrl: "https://example.dk/configured-sitemap.xml",
    requiresJs: false,
    respectRobotsTxt: true,
    maxPages: 10,
    admissionRole: "trusted",
  };

  it("keeps configured sitemaps and adds discovered fallback sitemaps", async () => {
    const urls = await resolveSeedSitemapUrls(seed, {
      discoverSitemaps: async function* () {
        yield "https://example.dk/sitemap.xml";
        yield "https://example.dk/post-sitemap.xml";
      },
    });

    expect(urls).toEqual([
      "https://example.dk/configured-sitemap.xml",
      "https://example.dk/sitemap.xml",
      "https://example.dk/post-sitemap.xml",
    ]);
  });

  it("supports multiple configured sitemap URLs without duplicates", async () => {
    const urls = await resolveSeedSitemapUrls(
      {
        ...seed,
        sitemapUrls: [
          "https://example.dk/configured-sitemap.xml",
          "https://example.dk/recipe-sitemap.xml",
        ],
      },
      {
        discoverSitemaps: async function* () {
          yield "https://example.dk/recipe-sitemap.xml";
        },
      }
    );

    expect(urls).toEqual([
      "https://example.dk/configured-sitemap.xml",
      "https://example.dk/recipe-sitemap.xml",
    ]);
  });
});
