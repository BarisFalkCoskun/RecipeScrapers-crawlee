import { describe, expect, it } from "vitest";
import { sourceHealth, renderSourceHealthHtml } from "../../src/operations/source-health.js";
import type { DanishJsonLdCrawlRunDocument } from "../../src/types.js";
import type { SourceRunObservation } from "../../src/danish-jsonld/source-outcome.js";

const run = (day: number, overrides: Partial<SourceRunObservation> = {}): DanishJsonLdCrawlRunDocument => ({
  kind: "danish-jsonld-v2", schemaVersion: 2, crawlRunId: `run-${day}`, sourceIds: ["fixture"],
  startedAt: new Date(`2026-09-${day}T00:00:00Z`), finishedAt: new Date(`2026-09-${day}T00:10:00Z`),
  summary: { robotsEnforced: false, sourceOutcomes: [{ sourceId: "fixture", outcome: "succeeded", outcomeReasons: [] }] },
  observations: [{ sourceId: "fixture", persistedRecipes: 100, discoveryComplete: true, collectionComplete: true, durationSeconds: 600,
    workAccounting: { admitted: 100, queued: 100, fetched: 100, pending: 0, blocked: 0, failed: 0, rejected: 0, skipped: 0 }, ...overrides }],
});

describe("source health", () => {
  it("reports overdue collection even when the scheduler is alive or a recent partial crawl exists", () => {
    const health = sourceHealth({ sourceId: "fixture", now: new Date("2026-09-22T12:00:00Z"),
      runs: [run(20), run(22, { collectionComplete: false, blockedRequests: 5 })] });
    expect(health.status).toBe("overdue");
    expect(health.lastCompleteAt).toBe("2026-09-20T00:10:00.000Z");
    expect(health.alerts).toContain("5 requests blocked");
  });
  it("alerts on yield and rejection regressions against complete runs, excluding duplicate resume evidence", () => {
    const health = sourceHealth({ sourceId: "fixture", now: new Date("2026-09-22T12:00:00Z"),
      runs: [run(18), run(19), run(20), run(20), run(22, { persistedRecipes: 40, rejectedIncompleteJsonLd: 60 })] });
    expect(health.status).toBe("warning");
    expect(health.rejectionRate).toBe(0.6);
    expect(health.alerts).toContain("Recipe count below 50% of recent complete-run median");
    expect(health.alerts).toContain("Recipe rejection rate increased materially");
  });
  it("does not label historical unverified runs or missing history as healthy", () => {
    expect(sourceHealth({ sourceId: "fixture", runs: [] }).status).toBe("unknown");
    expect(sourceHealth({ sourceId: "fixture", runs: [run(22, { collectionComplete: undefined, workAccounting: undefined })] }).status).toBe("overdue");
  });
  it("alerts when a complete crawl produces no publishable recipes, even without a baseline", () => {
    const health = sourceHealth({ sourceId: "fixture", runs: [run(22, { persistedRecipes: 0, rejectedIncompleteJsonLd: 5 })], now: new Date("2026-09-22T12:00:00Z") });
    expect(health.status).toBe("warning");
    expect(health.alerts).toContain("No publishable recipes in the latest run");
  });
  it("escapes report data rather than executing source strings as HTML", () => {
    const html = renderSourceHealthHtml([sourceHealth({ sourceId: '<script>alert(1)</script>', runs: [] })]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

it("emits changed alerts and recovery without repeating unchanged poll results", async () => {
  const { SourceHealthMonitor } = await import("../../src/operations/health-monitor.js");
  let runs: DanishJsonLdCrawlRunDocument[] = [];
  const events: string[] = [];
  const monitor = new SourceHealthMonitor({ sourceIds: ["fixture"], now: () => new Date("2026-09-22T12:00:00Z"),
    readRuns: async () => runs, emit: (event) => events.push(event.event) });
  await monitor.check();
  await monitor.check();
  runs = [run(22)];
  await monitor.check();
  await monitor.check();
  expect(events).toEqual(["source-health-alert", "source-health-recovered"]);
});
