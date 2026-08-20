import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createSchedulerConfigFromEnv,
  DanishRecipeScheduler,
  defaultDailyCron,
  latestScheduleSlot,
  parseAllowedStates,
  parseDailyCron,
  SchedulerLedger,
  SchedulerLease,
  schedulerHeartbeatIsFresh,
  scheduledOutcomeIsHealthy,
  selectScheduledSources,
  writeSchedulerHeartbeat,
} from "../../src/operations/danish-scheduler.js";

describe("Danish Crawlee scheduler", () => {
  it("stays fail-closed unless source registry states are explicitly allowed", () => {
    expect(parseAllowedStates(undefined)).toEqual(["cutover"]);
    expect(() => selectScheduledSources({
      requested: "ketoliv",
      allowedStates: ["cutover"],
    })).toThrow(/ketoliv is shadow_passed/u);
    expect(selectScheduledSources({
      requested: "ketoliv, foodfanatic ketoliv",
      allowedStates: ["shadow_passed"],
    })).toEqual(["ketoliv", "foodfanatic"]);
  });

  it("parses daily schedules and finds a Copenhagen catch-up slot", () => {
    expect(parseDailyCron("20 2 * * *")).toEqual({ minute: 20, hour: 2 });
    expect(defaultDailyCron(23, 80)).toBe("20 0 * * *");
    expect(() => parseDailyCron("*/5 * * * *")).toThrow(/Only daily/u);
    expect(latestScheduleSlot({
      now: new Date("2026-08-19T00:35:00.000Z"),
      schedule: { minute: 20, hour: 2 },
      timezone: "Europe/Copenhagen",
      catchupMinutes: 30,
    })?.toISOString()).toBe("2026-08-19T00:20:00.000Z");
  });

  it("builds explicit observation schedules without opening production states", () => {
    const config = createSchedulerConfigFromEnv({
      CRAWLEE_SCHEDULER_ALLOWED_STATES: "shadow_passed",
      CRAWLEE_SCHEDULED_SOURCES: "foodfanatic,ketoliv",
      CRAWLEE_SCRAPE_HOUR: "3",
      CRAWLEE_SCHEDULE_KETOLIV: "45 5 * * *",
    });
    expect(config.sourceIds).toEqual(["foodfanatic", "ketoliv"]);
    expect(config.schedules.get("foodfanatic")).toEqual({ minute: 0, hour: 3 });
    expect(config.schedules.get("ketoliv")).toEqual({ minute: 45, hour: 5 });
  });

  it("recovers running ledger entries as interrupted and writes atomically", async () => {
    const directory = await mkdtemp(join(tmpdir(), "crawlee-scheduler-ledger-"));
    const path = join(directory, "ledger.json");
    await writeFile(path, JSON.stringify({
      schemaVersion: 1,
      runs: {
        slot: {
          sourceId: "ketoliv",
          scheduledFor: "2026-08-19T00:00:00.000Z",
          status: "running",
        },
      },
    }), "utf8");
    const ledger = new SchedulerLedger(path);
    await ledger.open(new Date("2026-08-19T01:00:00.000Z"));
    expect(ledger.get("slot")).toMatchObject({
      status: "interrupted",
      finishedAt: "2026-08-19T01:00:00.000Z",
    });
    expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({ schemaVersion: 1 });
  });

  it("runs a due slot once and persists completion plus heartbeat", async () => {
    const directory = await mkdtemp(join(tmpdir(), "crawlee-scheduler-run-"));
    const now = new Date("2026-08-19T00:20:00.000Z");
    const calls: string[] = [];
    const scheduler = new DanishRecipeScheduler({
      sourceIds: ["foodfanatic"],
      allowedStates: ["shadow_passed"],
      schedules: new Map([["foodfanatic", { minute: 20, hour: 2 }]]),
      timezone: "Europe/Copenhagen",
      catchupMinutes: 30,
      pollIntervalMs: 100,
      heartbeatIntervalMs: 60_000,
      heartbeatPath: join(directory, "heartbeat.json"),
      ledgerPath: join(directory, "ledger.json"),
      evidenceDirectory: join(directory, "evidence"),
    }, {
      now: () => now,
      runSource: async (sourceId, evidencePath) => { calls.push(`${sourceId}:${evidencePath}`); },
      output: () => undefined,
    });
    await scheduler.initialize();
    try {
      expect(await scheduler.runDue()).toBe(1);
      expect(await scheduler.runDue()).toBe(0);
      expect(calls).toHaveLength(1);
      expect(JSON.parse(await readFile(join(directory, "ledger.json"), "utf8")))
        .toMatchObject({ runs: expect.objectContaining({
          "foodfanatic:2026-08-19T00:20:00.000Z": expect.objectContaining({
            status: "completed",
          }),
        }) });
    } finally {
      await scheduler.dispose();
    }
  });

  it("rejects a second scheduler lease and permits takeover after release", async () => {
    const directory = await mkdtemp(join(tmpdir(), "crawlee-scheduler-lease-"));
    const path = join(directory, "scheduler.lock");
    const first = new SchedulerLease(path, 60_000, "worker-1", 101, () => true);
    const second = new SchedulerLease(path, 60_000, "worker-1", 102, () => true);
    const now = new Date("2026-08-19T01:00:00.000Z");
    await first.acquire(now);
    await expect(second.acquire(now)).rejects.toThrow(/Another Crawlee scheduler owns/u);
    await first.release();
    await second.acquire(now);
    await second.release();
  });

  it("reports a failed one-shot crawl to its caller", async () => {
    const directory = await mkdtemp(join(tmpdir(), "crawlee-scheduler-failure-"));
    const now = new Date("2026-08-19T00:20:00.000Z");
    const scheduler = new DanishRecipeScheduler({
      sourceIds: ["foodfanatic"],
      allowedStates: ["shadow_passed"],
      schedules: new Map([["foodfanatic", { minute: 20, hour: 2 }]]),
      timezone: "Europe/Copenhagen",
      catchupMinutes: 30,
      pollIntervalMs: 100,
      heartbeatIntervalMs: 60_000,
      heartbeatPath: join(directory, "heartbeat.json"),
      ledgerPath: join(directory, "ledger.json"),
      evidenceDirectory: join(directory, "evidence"),
    }, {
      now: () => now,
      runSource: async () => { throw new Error("blocked"); },
      output: () => undefined,
    });
    await scheduler.initialize();
    try {
      expect(await scheduler.runOne("foodfanatic")).toBe(false);
    } finally {
      await scheduler.dispose();
    }
  });

  it("rejects stale, foreign, and dead-process heartbeats", async () => {
    const directory = await mkdtemp(join(tmpdir(), "crawlee-scheduler-heartbeat-"));
    const path = join(directory, "heartbeat.json");
    await writeSchedulerHeartbeat(path, {
      schemaVersion: 1,
      pid: 42,
      hostname: "worker-1",
      updatedAt: "2026-08-19T01:00:00.000Z",
      scheduledSourceIds: ["ketoliv"],
    });
    const base = {
      path,
      now: new Date("2026-08-19T01:01:00.000Z"),
      maxAgeSeconds: 180,
      expectedHostname: "worker-1",
    };
    expect(await schedulerHeartbeatIsFresh({ ...base, processAlive: () => true })).toBe(true);
    expect(await schedulerHeartbeatIsFresh({ ...base, expectedHostname: "worker-2", processAlive: () => true })).toBe(false);
    expect(await schedulerHeartbeatIsFresh({ ...base, processAlive: () => false })).toBe(false);
    expect(await schedulerHeartbeatIsFresh({ ...base, now: new Date("2026-08-19T01:10:00.000Z"), processAlive: () => true })).toBe(false);
  });

  it("accepts only successful or benign incomplete-recipe outcomes", () => {
    const summary = (outcome: "succeeded" | "partial" | "blocked", reasons: any[]) => ({
      robotsEnforced: false as const,
      sourceOutcomes: [{ sourceId: "ketoliv", outcome, outcomeReasons: reasons }],
    });
    expect(scheduledOutcomeIsHealthy(summary("succeeded", []), "ketoliv")).toBe(true);
    expect(scheduledOutcomeIsHealthy(summary("partial", [
      "recipes-persisted",
      "recipe-candidates-discovered",
      "incomplete-wprm-rejected",
    ]), "ketoliv")).toBe(true);
    expect(scheduledOutcomeIsHealthy(summary("partial", [
      "recipes-persisted",
      "failed-requests",
    ]), "ketoliv")).toBe(false);
    expect(scheduledOutcomeIsHealthy(summary("blocked", ["requests-blocked"]), "ketoliv"))
      .toBe(false);
    expect(scheduledOutcomeIsHealthy(summary("succeeded", []), "missing")).toBe(false);
  });
});
