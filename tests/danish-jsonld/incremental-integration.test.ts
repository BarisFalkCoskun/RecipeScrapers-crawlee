import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Configuration } from "crawlee";
import { expect, it } from "vitest";
import { executeDanishJsonLdSource, type ExecuteSourceInput } from "../../src/danish-jsonld/runner.js";
import { WebsiteCooldowns } from "../../src/danish-jsonld/website-cooldowns.js";
import { AdaptiveRequestPacing } from "../../src/danish-jsonld/adaptive-pacing.js";
import type { DanishJsonLdSource } from "../../src/danish-jsonld/source-registry.js";
import type { RecipeDocumentV2 } from "../../src/types.js";
import type { CrawlStore, RecipeDocumentV2Store } from "../../src/storage/store.js";

async function fixture(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const directory = await mkdtemp(join(tmpdir(), "recipe-incremental-"));
  let origin = "";
  let sitemapHits = 0;
  const server = createServer((req, res) => {
    if (req.url === "/sitemap.xml") {
      sitemapHits += 1;
      res.setHeader("content-type", "application/xml");
      res.end(`<urlset><url><loc>${origin}/recipe/cake</loc></url></urlset>`);
    } else handler(req, res);
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const source: DanishJsonLdSource = {
    id: "incremental-fixture", domain: "127.0.0.1", allowedDomains: ["127.0.0.1"], legacySpider: "Fixture", legacyFamily: "JsonLdSitemapRecipeSpider",
    discovery: "sitemap", sitemapUrls: [`${origin}/sitemap.xml`], startUrls: [], recipeUrlPatterns: ["/recipe/"], fetchMode: "cheerio",
    requestSettings: { delaySeconds: 0, maxConcurrency: 1, maxRetries: 1, rateLimitPerMinute: null },
    requireCompleteJsonLd: true, migrationState: "configured", latestScrapyOutcome: "not_audited",
  };
  const recipes = new Map<string, Omit<RecipeDocumentV2, "_id">>();
  const store = {
    upsertPage: async () => {},
    upsertRecipeV2: async (recipe: Omit<RecipeDocumentV2, "_id">) => {
      const existing = recipes.get(recipe.sourceRecipeKey);
      recipes.set(recipe.sourceRecipeKey, recipe);
      return { operation: existing ? "updated" : "inserted", contentChanged: existing?.contentHash !== recipe.contentHash, contentMatches: [] };
    },
  } as unknown as CrawlStore & RecipeDocumentV2Store;
  const config = new Configuration({ storageClientOptions: { localDataDirectory: join(directory, "native") }, persistStorage: false, purgeOnStart: false });
  return {
    directory, origin, recipes, source, sitemapHits: () => sitemapHits,
    run: async (overrides: Partial<ExecuteSourceInput> = {}) => {
      const runId = randomUUID();
      return Configuration.storage.run(config, () => executeDanishJsonLdSource({ source, store,
        crawlRunId: runId, crawlAttemptId: runId, checkpointDirectory: directory, checkpointIdentity: "fixture", maxPages: 10,
        diagnosticSink: () => {}, ...overrides }));
    },
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    },
  };
}

function recipe(res: ServerResponse, title = "Cake") {
  res.setHeader("content-type", "text/html");
  res.end(`<html><script type="application/ld+json">${JSON.stringify({ "@type": "Recipe", name: title,
    recipeIngredient: ["100 g mel"], recipeInstructions: ["Bland og bag."] })}</script></html>`);
}

it("pauses a repeatedly denied website outside request handlers and resumes pending work after interruption", async () => {
  const f = await fixture((_req, res) => recipe(res));
  let now = Date.now();
  const settings = { directory: f.directory, minimumDelayMs: 0, maximumDelayMs: 0, denialPauseMs: 120_000, now: () => now };
  const pacing = new AdaptiveRequestPacing(settings);
  const controller = new AbortController();
  try {
    for (let i = 0; i < 3; i++) await pacing.observe(f.origin, 403, 10);
    const timer = setTimeout(() => controller.abort(), 250);
    let stopped: Awaited<ReturnType<typeof f.run>>;
    try { stopped = await f.run({ pacing, signal: controller.signal, crawlRunId: "pacing-resume" }); }
    finally { clearTimeout(timer); }
    expect(stopped.observation.interrupted).toBe(true);
    expect(stopped.observation.workAccounting?.pending).toBe(1);
    expect(f.sitemapHits()).toBe(0);
    expect(await new AdaptiveRequestPacing(settings).remaining(f.origin)).toBe(120_000);
    now += 120_001;
    const resumed = await f.run({ pacing: new AdaptiveRequestPacing(settings), resume: true, crawlRunId: "pacing-resume" });
    expect(resumed.outcome.outcome).toBe("succeeded");
    expect(f.recipes.size).toBe(1);
    expect(resumed.observation.failedRequests ?? 0).toBe(0);
  } finally { await f.close(); }
}, 15_000);

it("handles 200 → 304 → cached → changed → full refresh without losing run coverage", async () => {
  let version = 1;
  const requests: Array<string | undefined> = [];
  const f = await fixture((req, res) => {
    requests.push(req.headers["if-none-match"]);
    res.setHeader("etag", `"${version}"`);
    if (req.headers["if-none-match"] === `"${version}"`) { res.writeHead(304); res.end(); }
    else recipe(res, `Cake ${version}`);
  });
  try {
    const first = await f.run();
    expect(first.outcome.outcome).toBe("succeeded");
    expect(first.observation.insertedRecipes).toBe(1);
    const second = await f.run();
    expect(second.outcome.outcome).toBe("succeeded");
    expect(second.observation.notModifiedResponses).toBe(1);
    expect(second.observation.unchangedRecipes).toBe(1);
    expect(second.observation.workAccounting).toMatchObject({ admitted: 2, fetched: 2, pending: 0 });
    expect(second.observation.collectionComplete).toBe(true);
    expect(requests).toEqual([undefined, '"1"']);

    // A cache is not proof that database records still exist: replay repairs them.
    f.recipes.clear();
    const third = await f.run({ refreshHours: 12 });
    expect(third.observation.cachedRecipePages).toBe(1);
    expect(third.observation.insertedRecipes).toBe(1);
    expect(third.outcome.outcome).toBe("succeeded");
    expect(requests).toHaveLength(2);
    expect(f.sitemapHits()).toBe(3);

    version = 2;
    const fourth = await f.run();
    expect(fourth.observation.changedRecipes).toBe(1);
    expect([...f.recipes.values()][0].normalized.title).toBe("Cake 2");
    await f.run({ fullRefresh: true });
    expect(requests).toEqual([undefined, '"1"', '"1"', undefined]);
    expect(f.recipes.size).toBe(1);
  } finally { await f.close(); }
}, 30_000);

it("uses Last-Modified through redirects when no ETag is available", async () => {
  const lastModified = "Tue, 22 Sep 2026 12:00:00 GMT";
  const validators: Array<string | undefined> = [];
  const f = await fixture((req, res) => {
    if (req.url === "/recipe/cake") { res.writeHead(302, { location: "/recipe/cake-final" }); res.end(); return; }
    validators.push(req.headers["if-modified-since"]);
    res.setHeader("last-modified", lastModified);
    if (req.headers["if-modified-since"] === lastModified) { res.writeHead(304); res.end(); }
    else recipe(res);
  });
  try {
    expect((await f.run()).outcome.outcome).toBe("succeeded");
    const second = await f.run();
    expect(second.observation.notModifiedResponses).toBe(1);
    expect(second.outcome.outcome).toBe("succeeded");
    expect(validators).toEqual([undefined, lastModified]);
  } finally { await f.close(); }
}, 30_000);

it("applies the same cooldown before browser retries", async () => {
  const starts: number[] = [];
  const f = await fixture((req, res) => {
    if (req.url !== "/recipe/cake") { res.writeHead(204); res.end(); return; }
    starts.push(Date.now());
    if (starts.length === 1) { res.writeHead(429, { "content-type": "text/html", "Retry-After": "1" }); res.end("Slow down"); }
    else recipe(res);
  });
  try {
    const result = await f.run({ source: { ...f.source, fetchMode: "playwright" },
      cooldowns: new WebsiteCooldowns({ directory: f.directory, baseDelayMs: 10 }) });
    expect(starts).toHaveLength(2);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(1000);
    expect(result.outcome.outcome).toBe("succeeded");
    expect(result.observation.blockedRequests).toBe(0);
  } finally { await f.close(); }
}, 30_000);

it("waits before retrying a 429 and then completes the same admitted request", async () => {
  const starts: number[] = [];
  const f = await fixture((_req, res) => {
    starts.push(Date.now());
    if (starts.length === 1) { res.writeHead(429, { "content-type": "text/html", "Retry-After": "1" }); res.end("Slow down"); }
    else recipe(res);
  });
  try {
    const result = await f.run({ cooldowns: new WebsiteCooldowns({ directory: f.directory, baseDelayMs: 10 }) });
    expect(starts).toHaveLength(2);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(1000);
    expect(result.outcome.outcome).toBe("succeeded");
    expect(result.observation.workAccounting).toMatchObject({ admitted: 2, fetched: 2, pending: 0 });
    expect(result.observation.blockedRequests).toBe(0);
  } finally { await f.close(); }
}, 30_000);

it("interrupts a long cooldown promptly, retaining pending work for resume", async () => {
  const controller = new AbortController();
  const runId = randomUUID();
  let hits = 0;
  const f = await fixture((_req, res) => {
    if (++hits === 1) { res.writeHead(503, { "content-type": "text/html", "Retry-After": "120" }); res.end("Unavailable"); }
    else recipe(res);
  });
  try {
    const start = Date.now();
    const paused = await f.run({ crawlRunId: runId, crawlAttemptId: runId, signal: controller.signal,
      cooldowns: new WebsiteCooldowns({ directory: f.directory, diagnostic: () => controller.abort() }) });
    expect(Date.now() - start).toBeLessThan(10_000);
    expect(paused.observation.interrupted).toBe(true);
    expect(paused.observation.workAccounting?.pending).toBe(1);
    const resumedPolicy = new WebsiteCooldowns({ directory: f.directory, now: () => Date.now() + 121_000 });
    const resumed = await f.run({ crawlRunId: runId, crawlAttemptId: runId, resume: true, cooldowns: resumedPolicy });
    expect(resumed.outcome.outcome).toBe("succeeded");
    expect(resumed.observation.collectionComplete).toBe(true);
    expect(hits).toBe(2);
    expect(f.sitemapHits()).toBe(1);
  } finally { await f.close(); }
}, 30_000);

it("defers a cooling website, then resumes without resetting exhausted HTTP retries", async () => {
  let hits = 0;
  const f = await fixture((_req, res) => {
    hits++; res.statusCode = 429; res.setHeader("content-type", "text/html"); res.setHeader("Retry-After", "2"); res.end("Slow down");
  });
  let now = Date.now();
  const cooldowns = new WebsiteCooldowns({ directory: f.directory, now: () => now });
  const pacing = new AdaptiveRequestPacing({ minimumDelayMs: 0, maximumDelayMs: 0 });
  try {
    const first = await f.run({ crawlRunId: "deferred-retry", deferWhenPaused: true, cooldowns, pacing });
    expect(first.deferredUntil).toBeGreaterThan(Date.now());
    expect(hits).toBe(1);
    expect(first.observation.workAccounting?.pending).toBe(1);
    now += 120_000;
    const second = await f.run({ crawlRunId: "deferred-retry", resume: true, deferWhenPaused: true, cooldowns, pacing });
    expect(hits).toBe(2);
    expect(second.observation.workAccounting?.pending).toBe(0);
    expect(second.observation.blockedRequests).toBe(1);
    expect(second.deferredUntil).toBeUndefined();
  } finally { await f.close(); }
}, 20000);
