import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { IncrementalRecipeCache } from "../../src/danish-jsonld/incremental-cache.js";
import { parseDanishJsonLdCrawlArgs } from "../../src/danish-jsonld/source-selection.js";
import type { DanishJsonLdResponse } from "../../src/danish-jsonld/crawler.js";

it("reuses only compatible public recipe GETs and expires full responses after a week", async () => {
  const directory = await mkdtemp(join(tmpdir(), "incremental-test-"));
  let now = Date.now();
  const request = { url: "https://example.com/recipe", kind: "recipe" as const };
  const response: DanishJsonLdResponse = { ...request, fetchMode: "cheerio", statusCode: 200, body: "recipe body", headers: { etag: '"one"', "last-modified": "Tue, 22 Sep 2026 12:00:00 GMT" } };
  const cache = new IncrementalRecipeCache({ directory, identity: "source-build-database", refreshHours: 24, now: () => now });
  try {
    await cache.save(request, response);
    const entry = (await cache.read(request))!;
    expect(entry.body).toBe(response.body);
    expect(cache.fresh(entry)).toBe(true);
    expect(cache.validators(entry)).toEqual({ "If-None-Match": '"one"' });
    expect(cache.validators({ ...entry, headers: { "last-modified": response.headers["last-modified"] as string } })).toEqual({ "If-Modified-Since": response.headers["last-modified"] });
    expect(await cache.read({ ...request, kind: "listing" })).toBeUndefined();
    expect(await cache.read({ ...request, method: "POST" })).toBeUndefined();
    expect(await cache.read({ ...request, requestHeaders: { Authorization: "private" } })).toBeUndefined();
    expect(await new IncrementalRecipeCache({ directory, identity: "different-database" }).read(request)).toBeUndefined();
    expect(await new IncrementalRecipeCache({ directory, identity: "source-build-database", fullRefresh: true }).read(request)).toBeUndefined();
    now += 24 * 3600_000;
    expect(cache.fresh(entry)).toBe(false);
    await cache.save(request, response, entry); // 304 validates without extending the full-fetch deadline.
    now += 6 * 24 * 3600_000;
    expect(await cache.read(request)).toBeUndefined();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it("honors cache restrictions, preserves no cookies, and treats corruption as a miss", async () => {
  const directory = await mkdtemp(join(tmpdir(), "incremental-test-"));
  const now = Date.now();
  const request = { url: "https://example.com/recipe", kind: "recipe" as const };
  const response: DanishJsonLdResponse = { ...request, fetchMode: "cheerio", statusCode: 200, body: "recipe body", headers: { etag: '"one"' } };
  const cache = new IncrementalRecipeCache({ directory, identity: "test", refreshHours: 24, now: () => now });
  try {
    for (const headers of [{ "cache-control": "no-store" }, { "cache-control": "private" }, { vary: "Cookie" }, { vary: "*" }, { "Set-Cookie": "secret=value" }]) {
      await cache.save(request, response);
      await cache.save(request, { ...response, headers });
      expect(await cache.read(request)).toBeUndefined();
    }
    await cache.save(request, { ...response, headers: { ...response.headers, "cache-control": "no-cache" } });
    expect(cache.fresh((await cache.read(request))!)).toBe(false);
    await cache.save(request, { ...response, headers: { ...response.headers, "cache-control": "max-age=10", age: "10" } });
    expect(cache.fresh((await cache.read(request))!)).toBe(false);
    const [name] = await readdir(join(directory, "incremental"));
    await writeFile(join(directory, "incremental", name), "corrupted");
    expect(await cache.read(request)).toBeUndefined();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it("parses explicit freshness controls without changing --force semantics", () => {
  expect(parseDanishJsonLdCrawlArgs(["--refresh-hours", "12"])).toMatchObject({ refreshHours: 12, force: false });
  expect(parseDanishJsonLdCrawlArgs(["--full-refresh", "--force"])).toMatchObject({ fullRefresh: true, force: true });
  for (const value of ["-1", "NaN", "Infinity", "169", ""]) {
    expect(() => parseDanishJsonLdCrawlArgs(["--refresh-hours", value])).toThrow();
  }
  expect(() => parseDanishJsonLdCrawlArgs(["--full-refresh", "--refresh-hours", "12"])).toThrow();
});
