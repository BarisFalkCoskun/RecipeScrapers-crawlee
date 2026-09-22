import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Configuration } from "crawlee";
import { describe, expect, it } from "vitest";
import { executeDanishJsonLdSource } from "../../src/danish-jsonld/runner.js";
import type { DanishJsonLdSource } from "../../src/danish-jsonld/source-registry.js";
import type { RecipeDocumentV2 } from "../../src/types.js";
import type { CrawlStore, RecipeDocumentV2Store } from "../../src/storage/store.js";

describe("durable crawl resume", () => {
  it.each(["cap", "signal"])("resumes after %s without losing discoveries or refetching completed work", async (pauseMode) => {
    const controller = new AbortController();
    const directory = await mkdtemp(join(tmpdir(), "recipe-resume-"));
    const requests: string[] = [];
    let origin = "";
    const server = createServer((req, res) => {
      requests.push(req.url!);
      if (req.url === "/sitemap.xml") {
        res.setHeader("content-type", "application/xml");
        res.end(`<urlset>${["one", "one", "two"].map((slug) => `<url><loc>${origin}/recipe/${slug}</loc></url>`).join("")}</urlset>`);
      } else {
        res.setHeader("content-type", "text/html");
        res.end(`<html><script type="application/ld+json">${JSON.stringify({ "@type": "Recipe", name: req.url,
          recipeIngredient: ["100 g mel"], recipeInstructions: ["Bland og bag."] })}</script></html>`);
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const source: DanishJsonLdSource = {
      id: "resume-fixture", domain: "127.0.0.1", allowedDomains: ["127.0.0.1"], legacySpider: "Fixture", legacyFamily: "JsonLdSitemapRecipeSpider",
      discovery: "sitemap", sitemapUrls: [`${origin}/sitemap.xml`], startUrls: [], recipeUrlPatterns: ["/recipe/"], fetchMode: "cheerio",
      requestSettings: { delaySeconds: 0, maxConcurrency: 1, maxRetries: 0, rateLimitPerMinute: null },
      requireCompleteJsonLd: true, migrationState: "configured", latestScrapyOutcome: "not_audited",
    };
    const recipes = new Map<string, Omit<RecipeDocumentV2, "_id">>();
    const store = {
      upsertPage: async () => {},
      upsertRecipeV2: async (recipe: Omit<RecipeDocumentV2, "_id">) => {
        const operation = recipes.has(recipe.sourceRecipeKey) ? "updated" as const : "inserted" as const;
        recipes.set(recipe.sourceRecipeKey, recipe);
        if (pauseMode === "signal" && recipes.size === 1) controller.abort();
        return { operation, contentMatches: [] };
      },
    } as unknown as CrawlStore & RecipeDocumentV2Store;
    const crawlRunId = randomUUID();
    const config = new Configuration({ storageClientOptions: { localDataDirectory: join(directory, "native") }, persistStorage: false, purgeOnStart: false });
    try {
      const input = { source, store, crawlRunId, crawlAttemptId: crawlRunId, checkpointDirectory: directory, checkpointIdentity: "test" };
      const first = await Configuration.storage.run(config, () => executeDanishJsonLdSource({ ...input, maxPages: pauseMode === "cap" ? 1 : 10, signal: controller.signal }));
      expect(first.observation.workAccounting).toMatchObject({ admitted: 3, fetched: pauseMode === "cap" ? 1 : 2, pending: pauseMode === "cap" ? 2 : 1 });
      expect(first.outcome.outcomeReasons).toContain("unaccounted-requests");
      if (pauseMode === "signal") expect(first.outcome.outcomeReasons).toContain("interrupted");
      const second = await Configuration.storage.run(config, () => executeDanishJsonLdSource({ ...input, maxPages: 10, resume: true }));
      expect(second.outcome.outcome).toBe("succeeded");
      expect(second.observation.collectionComplete).toBe(true);
      expect(second.observation.workAccounting).toMatchObject({ admitted: 3, fetched: 3, pending: 0 });
      expect(second.observation.persistedRecipes).toBe(2);
      expect(second.observation.uniqueRecipeUrls).toBe(2);
      expect(recipes.size).toBe(2);
      expect(requests.filter((path) => path === "/sitemap.xml")).toHaveLength(1);
      const third = await Configuration.storage.run(config, () => executeDanishJsonLdSource({ ...input, maxPages: 10, resume: true }));
      expect(third.observation.persistedRecipes).toBe(2);
      expect(requests).toHaveLength(3);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    }
  }, 30_000);
});

it("resumes sources that had not started when a batch was interrupted", async () => {
  const { runDanishJsonLdCrawl } = await import("../../src/danish-jsonld/runner.js");
  const directory = await mkdtemp(join(tmpdir(), "recipe-unstarted-"));
  const controller = new AbortController();
  controller.abort();
  const source: DanishJsonLdSource = {
    id: "empty-fixture", domain: "fixture.invalid", allowedDomains: ["fixture.invalid"], legacySpider: "Fixture", legacyFamily: "JsonLdListingSpider",
    discovery: "listing", sitemapUrls: [], startUrls: [], recipeUrlPatterns: [], fetchMode: "cheerio",
    requestSettings: { delaySeconds: 0, maxConcurrency: 1, maxRetries: 0, rateLimitPerMinute: null },
    requireCompleteJsonLd: true, migrationState: "configured", latestScrapyOutcome: "not_audited",
  };
  const runId = randomUUID();
  const selection = { force: false, vpn: false, sourceIds: [source.id], sources: [source] };
  const input = { selection, store: {} as CrawlStore & RecipeDocumentV2Store, crawlRunId: runId, checkpointDirectory: directory };
  const config = new Configuration({ persistStorage: false, purgeOnStart: false });
  try {
    const interrupted = await Configuration.storage.run(config, () => runDanishJsonLdCrawl({ ...input, signal: controller.signal }));
    expect(interrupted.summary.sourceOutcomes[0].outcomeReasons).toContain("interrupted");
    const resumed = await Configuration.storage.run(config, () => runDanishJsonLdCrawl({ ...input, selection: { ...selection, resumeRunId: runId } }));
    expect(resumed.summary.sourceOutcomes[0].outcome).toBe("no_data");
    expect(resumed.summary.sourceOutcomes[0].outcomeReasons).not.toContain("failed-requests");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
