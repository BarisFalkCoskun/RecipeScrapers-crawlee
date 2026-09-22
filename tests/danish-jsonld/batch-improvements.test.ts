import { expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { tryWebsiteLock } from "../../src/danish-jsonld/website-lock.js";
import { runDanishJsonLdCrawl } from "../../src/danish-jsonld/runner.js";
import { createDanishJsonLdCrawlSelection } from "../../src/danish-jsonld/source-selection.js";
import { classifySourceOutcome } from "../../src/danish-jsonld/source-outcome.js";
import { runPreflight } from "../../src/danish-jsonld/preflight.js";
import { executeDanishJsonLdCli } from "../../src/danish-jsonld/cli.js";
import type { CrawlStore, RecipeDocumentV2Store } from "../../src/storage/store.js";

it("runs other sites while paused, preserves budgets and reports one cumulative result per site", async () => {
  const calls: string[] = [];
  const limits: number[] = [];
  const progress = vi.fn();
  const result = await runDanishJsonLdCrawl({
    selection: createDanishJsonLdCrawlSelection({ sourceIds: ["arla", "coop"], maxPages: 5, vpn: false, force: false }),
    store: {} as CrawlStore & RecipeDocumentV2Store, crawlRunId: "batch-test", onProgress: progress,
    executeSource: async (input) => {
      calls.push(input.source.id); limits.push(input.maxPages);
      const first = calls.length === 1;
      const observation = { sourceId: input.source.id, discoveryComplete: !first, insertedRecipes: first ? 1 : 2 };
      if (calls.length === 3) expect(input.resume).toBe(true);
      return { observation, outcome: classifySourceOutcome(observation), handledRequests: first ? 2 : 1,
        ...(first ? { deferredUntil: Date.now() + 30 } : {}) };
    },
  });
  expect(calls).toEqual(["arla", "coop", "arla"]);
  expect(limits).toEqual([5, 5, 3]);
  expect(result.observations.map((o) => o.sourceId)).toEqual(["arla", "coop"]);
  expect(progress.mock.lastCall?.[0]).toMatchObject({ finished: 2, inserted: 4, paused: 0 });
});

it("interrupts a batch waiting on a website lock without reporting a source failure", async () => {
  const controller = new AbortController();
  const result = await runDanishJsonLdCrawl({
    selection: createDanishJsonLdCrawlSelection({ sourceIds: ["arla"], vpn: false, force: false }),
    store: {} as CrawlStore & RecipeDocumentV2Store, crawlRunId: "waiting", signal: controller.signal,
    executeSource: async () => {
      controller.abort();
      const observation = { sourceId: "arla", discoveryComplete: false };
      return { observation, outcome: classifySourceOutcome(observation), waitingForWebsite: true, deferredUntil: Date.now() + 10000 };
    },
  });
  expect(result.observations[0]).toMatchObject({ interrupted: true });
  expect(result.observations[0].failedRequests).toBeUndefined();
});

it("coordinates real processes, recovers a dead owner and releases partial multi-host acquisitions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "website-lock-test-"));
  const child = spawn(process.execPath, ["--import", "tsx/esm", "--input-type=module", "-e", `
    import { tryWebsiteLock } from './src/danish-jsonld/website-lock.ts';
    await tryWebsiteLock(process.argv[1], ['b.example']);
    process.stdout.write('held'); setInterval(() => {}, 1000);
  `, directory], { stdio: ["ignore", "pipe", "pipe"] });
  try {
    await once(child.stdout!, "data");
    expect(await tryWebsiteLock(directory, ["a.example", "b.example"])).toBeUndefined();
    const partial = await tryWebsiteLock(directory, ["a.example"]);
    expect(partial).toBeTypeOf("function"); await partial!();
    const closed = once(child, "close"); child.kill("SIGKILL"); await closed;
    const recovered = await tryWebsiteLock(directory, ["b.example"]);
    expect(recovered).toBeTypeOf("function");
    expect(await tryWebsiteLock(directory, ["b.example"])).toBeUndefined();
    await recovered!(); await recovered!();
    const next = await tryWebsiteLock(directory, ["b.example"]);
    expect(next).toBeTypeOf("function"); await next!();
  } finally { child.kill(); await rm(directory, { recursive: true, force: true }); }
}, 10000);

it("preflight cleans its storage probe and reports independent failures without leaking credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "preflight-test-"));
  const sources = createDanishJsonLdCrawlSelection({ sourceIds: ["arla"], vpn: false, force: false }).sources;
  try {
    const results = await runPreflight({ sources, directory, mongoUri: "mongodb://secret:password@localhost", database: "test" }, {
      browser: async () => {}, mongo: async () => { throw new Error("mongodb://secret:password@localhost"); },
    });
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(JSON.stringify(results)).not.toContain("password");
    expect(await readdir(directory)).toEqual([]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it("--check exits unsuccessfully on failed checks without opening the crawl store or VPN", async () => {
  const createStore = vi.fn(); const createVpnTransport = vi.fn(); const runCrawl = vi.fn();
  const result = await executeDanishJsonLdCli(["--check", "--sources", "arla", "--vpn"], {
    env: {}, output: vi.fn(), createStore, createVpnTransport, runCrawl,
    preflight: async () => [{ name: "MongoDB", ok: false, message: "unavailable" }],
  });
  expect(result.exitCode).toBe(1);
  expect(createStore).not.toHaveBeenCalled(); expect(createVpnTransport).not.toHaveBeenCalled(); expect(runCrawl).not.toHaveBeenCalled();
});
