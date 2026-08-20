import { describe, expect, it } from "vitest";
import { createDeprecationReadinessReport } from "../../src/migration/deprecation-readiness.js";
import type { OperationalDeprecationEvidence } from "../../src/migration/deprecation-readiness.js";
import type { DanishJsonLdSource } from "../../src/danish-jsonld/source-registry.js";
import type { LegacyDanishSpider } from "../../src/migration/legacy-danish-inventory.js";

const legacy = (id: string): LegacyDanishSpider => ({
  id,
  legacySpider: `${id}Spider`,
  baseClass: "Spider",
  domain: `${id}.dk`,
});
const source = (
  id: string,
  migrationState: DanishJsonLdSource["migrationState"],
  aliasFor?: string
): DanishJsonLdSource => ({
  id,
  domain: `${id}.dk`,
  allowedDomains: [`${id}.dk`],
  legacySpider: `${id}Spider`,
  legacyFamily: "CustomListingSpider",
  discovery: "listing",
  sitemapUrls: [],
  startUrls: [`https://${id}.dk/`],
  recipeUrlPatterns: ["/opskrift/"],
  fetchMode: "cheerio",
  requestSettings: {
    delaySeconds: 1,
    rateLimitPerMinute: null,
    maxConcurrency: 1,
    maxRetries: 1,
  },
  requireCompleteJsonLd: true,
  migrationState,
  latestScrapyOutcome: "not_audited",
  ...(aliasFor ? { aliasFor } : {}),
});

const passedOperations: OperationalDeprecationEvidence = {
  schemaVersion: 1,
  gates: {
    "consumer-data-contract": {
      passed: true,
      evidence: "change/consumer-migration-123",
      observedAt: "2026-08-20T00:00:00Z",
    },
    "scheduler-and-monitoring-deployed": {
      passed: true,
      evidence: "deployment/crawlee-production-7",
      observedAt: "2026-08-20T00:00:00Z",
    },
    "rollback-validated": {
      passed: true,
      evidence: "runbook-test/rollback-4",
      observedAt: "2026-08-20T00:00:00Z",
    },
    "observation-window-complete": {
      passed: true,
      evidence: "dashboard/window-2026-08",
      observedAt: "2026-08-20T00:00:00Z",
    },
    "scrapy-retirement-approved": {
      passed: true,
      evidence: "approval/recipe-platform-owner",
      observedAt: "2026-08-20T00:00:00Z",
    },
  },
};

describe("Scrapy deprecation readiness", () => {
  it("stays closed for missing and non-cutover legacy sources", () => {
    const report = createDeprecationReadinessReport(
      [legacy("ready"), legacy("canary"), legacy("missing")],
      [source("ready", "cutover"), source("canary", "canary_passed")]
    );

    expect(report.readyForScrapyDeprecation).toBe(false);
    expect(report.registeredLegacySpiders).toBe(2);
    expect(report.missingSourceIds).toEqual(["missing"]);
    expect(report.effectiveStateCounts).toEqual({
      canary_passed: 1,
      cutover: 1,
      missing: 1,
    });
    expect(report.notCutover.map((gap) => gap.sourceId)).toEqual(["canary", "missing"]);
  });

  it("resolves a legacy alias through the canonical cutover source", () => {
    const report = createDeprecationReadinessReport(
      [legacy("canonical"), legacy("old-command")],
      [source("canonical", "cutover"), source("old-command", "configured", "canonical")],
      passedOperations
    );

    expect(report.readyForScrapyDeprecation).toBe(true);
    expect(report.effectiveStateCounts).toEqual({ cutover: 2 });
    expect(report.notCutover).toEqual([]);
  });

  it("stays fail-closed when every source is cut over but operations are unproven", () => {
    const report = createDeprecationReadinessReport(
      [legacy("ready")],
      [source("ready", "cutover")]
    );

    expect(report.sourcesReadyForScrapyDeprecation).toBe(true);
    expect(report.operationalGatesReady).toBe(false);
    expect(report.readyForScrapyDeprecation).toBe(false);
    expect(report.operationalReadinessGaps).toHaveLength(5);
  });

  it("rejects incomplete or unauditable operational attestations", () => {
    const evidence = structuredClone(passedOperations);
    evidence.gates["rollback-validated"] = {
      passed: true,
      evidence: "",
      observedAt: "2026-08-20T00:00:00Z",
    };
    evidence.gates["observation-window-complete"] = {
      passed: true,
      evidence: "dashboard/window-2026-08",
      observedAt: "not-a-date",
    };

    const report = createDeprecationReadinessReport(
      [legacy("ready")],
      [source("ready", "cutover")],
      evidence
    );

    expect(report.operationalGatesReady).toBe(false);
    expect(report.operationalReadinessGaps).toContainEqual({
      gate: "rollback-validated",
      reason: "Gate has no evidence reference",
    });
    expect(report.operationalReadinessGaps).toContainEqual({
      gate: "observation-window-complete",
      reason: "Gate observedAt is not a valid timestamp",
    });
  });
});
