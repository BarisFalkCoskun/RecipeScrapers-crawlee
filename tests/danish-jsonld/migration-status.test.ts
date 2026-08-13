import { describe, expect, it } from "vitest";
import {
  createMigrationStatusReport,
  renderMigrationStatus,
} from "../../src/danish-jsonld/migration-status.js";

describe("Danish JSON-LD migration status", () => {
  it("reports all required checklist fields in JSON", () => {
    const report = createMigrationStatusReport();

    expect(report.sources).toHaveLength(99);
    expect(report.sources[0]).toMatchObject({
      source: expect.any(String),
      domain: expect.any(String),
      discoveryMode: expect.any(String),
      fetchMode: expect.any(String),
      scrapyOutcome: "not_audited",
      crawleeState: expect.any(String),
      latestCanary: null,
      shadowParity: null,
      cutoverDate: null,
      reason: null,
    });
    expect(JSON.parse(renderMigrationStatus(report, "json"))).toEqual(report);
  });

  it("renders readable console and Markdown reports", () => {
    const report = createMigrationStatusReport();

    expect(renderMigrationStatus(report, "console")).toContain("Danish JSON-LD migration status");
    expect(renderMigrationStatus(report, "markdown")).toContain(
      "| Source | Domain | Discovery | Fetch | Scrapy | Crawlee | Canary | Shadow parity | Cutover date | Reason |"
    );
    expect(renderMigrationStatus(report, "markdown")).toContain("| arla | arla.dk | sitemap | cheerio | not_audited | configured |");
  });
});
