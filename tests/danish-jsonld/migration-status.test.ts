import { describe, expect, it } from "vitest";
import {
  createMigrationStatusReport,
  renderMigrationStatus,
} from "../../src/danish-jsonld/migration-status.js";

describe("Danish JSON-LD migration status", () => {
  it("reports all required checklist fields in JSON", () => {
    const report = createMigrationStatusReport();

    expect(report.sources).toHaveLength(314);
    const unevidenced = report.sources.find((entry) => entry.latestCanary === null);
    expect(unevidenced).toMatchObject({
      source: expect.any(String),
      domain: expect.any(String),
      discoveryMode: expect.any(String),
      fetchMode: expect.any(String),
      scrapyOutcome: "not_audited",
      crawleeState: expect.any(String),
      latestCanary: null,
      shadowParity: null,
      cutoverDate: null,
      // A source may carry a reason without evidence, but never the reverse.
      reason: expect.toSatisfy(
        (value: unknown) => value === null || typeof value === "string"
      ),
    });
    expect(JSON.parse(renderMigrationStatus(report, "json"))).toEqual(report);
  });

  it("renders readable console and Markdown reports", () => {
    const report = createMigrationStatusReport();

    expect(renderMigrationStatus(report, "console")).toContain("Danish recipe migration status");
    expect(renderMigrationStatus(report, "markdown")).toContain(
      "| Source | Domain | Discovery | Fetch | Scrapy | Crawlee | Canary | Shadow parity | Cutover date | Reason |"
    );
    expect(renderMigrationStatus(report, "markdown")).toContain("| arla | arla.dk | sitemap | cheerio | not_audited | canary_passed |");
  });

  it("reports Surdejsentusiasten as shadow-passed without claiming cutover", () => {
    const source = createMigrationStatusReport().sources.find(
      (row) => row.source === "surdejsentusiasten"
    );

    expect(source).toMatchObject({
      crawleeState: "shadow_passed",
      latestCanary:
        "2026-08-13T19-21-01.957Z-attempt-4c841ddc-1d13-48c9-a02c-83587d34898e",
      shadowParity: "100%",
      cutoverDate: null,
      reason: null,
    });
  });
});
