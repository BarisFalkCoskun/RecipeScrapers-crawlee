import { afterEach, describe, expect, it } from "vitest";
import { appendFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CrawlWorkJournal, workKey, type SessionCheckpoint } from "../../src/danish-jsonld/work-journal.js";
import { classifySourceOutcome, crawlExitCode } from "../../src/danish-jsonld/source-outcome.js";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });
const path = async () => { const directory = await mkdtemp(join(tmpdir(), "recipe-journal-")); directories.push(directory); return join(directory, "journal.jsonl"); };
const checkpoint = (persistedRecipes: number): SessionCheckpoint => ({ observation: { sourceId: "fixture", discoveryComplete: true, persistedRecipes }, sets: {}, values: {} });
const one = { kind: "recipe" as const, url: "https://fixture.invalid/one" };
const two = { ...one, url: "https://fixture.invalid/two" };

describe("durable crawl work", () => {
  it("reconstructs only unfinished requests after reopening, including admission before queue acknowledgement", async () => {
    const file = await path();
    const journal = await CrawlWorkJournal.open({ path: file, fingerprint: "v1" });
    await journal.admit("cheerio", [one, one, two]);
    await journal.queued([workKey("cheerio", one)]);
    await journal.commit(workKey("cheerio", one), "fetched", { ...checkpoint(1), sets: { admittedRecipeUrls: [one.url] } });
    await journal.close();
    const resumed = await CrawlWorkJournal.open({ path: file, fingerprint: "v1", resume: true });
    try {
      expect(resumed.pending().map((entry) => entry.request.url)).toEqual([two.url]);
      expect(resumed.accounting()).toMatchObject({ admitted: 2, queued: 1, fetched: 1, pending: 1 });
      expect(resumed.checkpoint?.observation.persistedRecipes).toBe(1);
      expect(resumed.checkpoint?.sets.admittedRecipeUrls).toEqual([one.url]);
      await resumed.admit("cheerio", [one]);
      expect(resumed.isTerminal(workKey("cheerio", one))).toBe(true);
    } finally { await resumed.close(); }
  });

  it("recovers a torn final write but rejects corrupt complete records and mismatched configurations", async () => {
    const file = await path();
    const original = await CrawlWorkJournal.open({ path: file, fingerprint: "v1" });
    await original.admit("cheerio", [one]);
    await original.close();
    await appendFile(file, '{"type":"commit"');
    const resumed = await CrawlWorkJournal.open({ path: file, fingerprint: "v1", resume: true });
    expect(resumed.pending()).toHaveLength(1);
    await resumed.close();
    expect((await readFile(file, "utf8")).endsWith("\n")).toBe(true);
    await expect(CrawlWorkJournal.open({ path: file, fingerprint: "v2", resume: true })).rejects.toThrow(/same source/);
    await appendFile(file, 'broken\n');
    await expect(CrawlWorkJournal.open({ path: file, fingerprint: "v1", resume: true })).rejects.toThrow();
  });

  it("rejects concurrent resume attempts and distinguishes POST bodies", async () => {
    const file = await path();
    const journal = await CrawlWorkJournal.open({ path: file, fingerprint: "v1" });
    try {
      await expect(CrawlWorkJournal.open({ path: file, fingerprint: "v1", resume: true })).rejects.toThrow(/in use/);
      expect(workKey("cheerio", { ...one, method: "POST", payload: "page=1" }))
        .not.toBe(workKey("cheerio", { ...one, method: "POST", payload: "page=2" }));
    } finally { await journal.close(); }
  });

  it("cannot report success when admitted requests or discovered candidates remain unexplained", async () => {
    const journal = await CrawlWorkJournal.open({ fingerprint: "fixture" });
    await journal.admit("cheerio", [one, two]);
    await journal.commit(workKey("cheerio", one), "fetched", checkpoint(1));
    const outcome = classifySourceOutcome({ ...checkpoint(1).observation, workAccounting: journal.accounting() });
    expect(outcome.outcome).toBe("partial");
    expect(outcome.outcomeReasons).toContain("unaccounted-requests");
    expect(classifySourceOutcome({ ...checkpoint(1).observation, unaccountedRecipeCandidates: 1 }).outcome).toBe("partial");
    expect(crawlExitCode({ robotsEnforced: false, sourceOutcomes: [outcome] })).toBe(1);
    expect(crawlExitCode({ robotsEnforced: false, sourceOutcomes: [] })).toBe(1);
    expect(crawlExitCode({ robotsEnforced: false, sourceOutcomes: [{ sourceId: "fixture", outcome: "succeeded", outcomeReasons: [] }] })).toBe(0);
  });
});
