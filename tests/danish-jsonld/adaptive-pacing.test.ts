import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { AdaptiveRequestPacing, PacingPendingError } from "../../src/danish-jsonld/adaptive-pacing.js";

it("learns from slow responses and failures, then recovers gradually without crossing the site minimum", async () => {
  let now = 10_000;
  const diagnostics: Array<Record<string, unknown>> = [];
  const pacing = new AdaptiveRequestPacing({ minimumDelayMs: 2000, now: () => now, diagnostic: (d) => diagnostics.push(d) });
  const url = "https://recipes.test/a";
  const fetch = async (status: number, durationMs: number) => {
    now += await pacing.remaining(url);
    const request = {};
    await pacing.start(request, url);
    now += durationMs;
    await pacing.finish(request, status);
    await pacing.finish(request, status); // Duplicate terminal callbacks must not double-count.
  };
  await fetch(200, 100);
  await fetch(200, 1500);
  expect(diagnostics.at(-1)).toMatchObject({ delayMs: 2500, reason: "response-slowed" });
  await fetch(503, 100);
  expect(diagnostics.at(-1)).toMatchObject({ delayMs: 3750, reason: "request-failed" });
  for (let i = 0; i < 100; i++) await fetch(200, 100);
  expect(diagnostics.at(-1)).toMatchObject({ delayMs: 2000, reason: "healthy-recovery" });
  expect(await pacing.remaining(url)).toBe(1900);
  await expect(pacing.start({}, url)).rejects.toBeInstanceOf(PacingPendingError);
  expect(await pacing.remaining("https://other.test/a")).toBe(0);
});

it("keeps learned pacing and repeated-denial pauses on restart, scoped to a website", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pacing-test-"));
  let now = 10_000;
  const options = { directory, minimumDelayMs: 100, now: () => now, denialPauseMs: 60_000 };
  try {
    const pacing = new AdaptiveRequestPacing(options);
    for (let i = 0; i < 3; i++) await pacing.observe("https://www.recipes.test/a", 403, 100);
    const resumed = new AdaptiveRequestPacing(options);
    resumed.register("https://recipes.test/b");
    expect(await resumed.remaining("https://recipes.test/b")).toBe(60_000);
    expect(await resumed.ready()).toBe(false);
    expect(await resumed.remaining("https://other.test/b")).toBe(0);
    now += 60_000;
    expect(await resumed.ready()).toBe(true);
    await resumed.start({}, "https://recipes.test/b");
    expect(await resumed.remaining("https://recipes.test/c")).toBe(2250);
    now += 8 * 24 * 60 * 60_000;
    const expired = new AdaptiveRequestPacing(options);
    await expired.start({}, "https://recipes.test/b");
    expect(await expired.remaining("https://recipes.test/c")).toBe(100);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it("caps learned delays and counts network failures only for admitted requests", async () => {
  let now = 10_000;
  const events: unknown[] = [];
  const pacing = new AdaptiveRequestPacing({ minimumDelayMs: 0, maximumDelayMs: 1200, now: () => now, diagnostic: (e) => events.push(e) });
  await pacing.finish({}, 0);
  expect(events).toEqual([]);
  for (let i = 0; i < 5; i++) {
    const request = {};
    await pacing.start(request, "https://recipes.test/");
    await pacing.finish(request, 0);
    now += 1200;
  }
  expect(events.at(-1)).toMatchObject({ delayMs: 1200, reason: "request-failed" });
});
