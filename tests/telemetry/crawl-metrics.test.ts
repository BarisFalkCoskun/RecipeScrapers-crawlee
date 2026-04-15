import { describe, expect, it } from "vitest";
import { CrawlMetrics } from "../../src/telemetry/crawl-metrics.js";

describe("CrawlMetrics", () => {
  it("summarizes processed pages, skips, and fallback rates", () => {
    const metrics = new CrawlMetrics(["example.dk"]);

    metrics.recordPageProcessed({
      domain: "example.dk",
      fetchMode: "cheerio",
      recipeCount: 2,
    });
    metrics.recordPageProcessed({
      domain: "example.dk",
      fetchMode: "cheerio",
      recipeCount: 0,
    });
    metrics.recordPageProcessed({
      domain: "example.dk",
      fetchMode: "playwright",
      recipeCount: 1,
    });
    metrics.recordFallbackQueued("example.dk", "thin-content");
    metrics.recordRecrawlSkip({
      domain: "example.dk",
      fetchMode: "cheerio",
    });
    metrics.recordOffDomainAdmission({
      sourceDomain: "example.dk",
      targetDomain: "remote.example",
    });

    const summary = metrics.buildSummary();

    expect(summary.processedPages).toBe(3);
    expect(summary.recipePages).toBe(2);
    expect(summary.extractedRecipes).toBe(3);
    expect(summary.fallbacksEnqueued).toBe(1);
    expect(summary.recrawlSkips).toBe(1);
    expect(summary.offDomainAdmissions).toBe(1);
    expect(summary.fallbackRate).toBeCloseTo(0.5);
    expect(summary.newlyAdmittedDomains).toEqual(["remote.example"]);
    expect(summary.playwrightFallbacksByReason).toEqual({
      "thin-content": 1,
    });
    expect(summary.domains).toHaveLength(1);
    expect(summary.domains[0]).toMatchObject({
      domain: "example.dk",
      processedPages: 3,
      recipePages: 2,
      extractedRecipes: 3,
      recrawlSkips: 1,
      fallbacksEnqueued: 1,
      offDomainAdmissions: 1,
    });
  });
});
