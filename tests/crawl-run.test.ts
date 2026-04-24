import { describe, expect, it } from "vitest";
import {
  createCrawlRunStorageKeys,
  resolveCrawlRunId,
} from "../src/crawl-run.js";

describe("crawl run storage keys", () => {
  it("creates stable run-scoped queue and state keys", () => {
    expect(createCrawlRunStorageKeys("2026-04-24T21-45-10-000Z")).toEqual({
      cheerioQueueName: "cheerio-queue-2026-04-24T21-45-10-000Z",
      playwrightQueueName: "playwright-queue-2026-04-24T21-45-10-000Z",
      linkFilterStateKey: "link-filter-state-2026-04-24T21-45-10-000Z",
      cheerioSitemapStateKey:
        "cheerio-sitemap-request-list-2026-04-24T21-45-10-000Z",
      playwrightSitemapStateKey:
        "playwright-sitemap-request-list-2026-04-24T21-45-10-000Z",
    });
  });

  it("uses a configured run id so intentional resumes target the same storage", () => {
    expect(
      resolveCrawlRunId(new Date("2026-04-24T21:45:10.000Z"), {
        CRAWL_RUN_ID: "manual retry #1",
      })
    ).toBe("manual-retry-1");
  });

  it("defaults to a sanitized timestamp run id", () => {
    expect(
      resolveCrawlRunId(new Date("2026-04-24T21:45:10.123Z"), {})
    ).toBe("2026-04-24T21-45-10.123Z");
  });
});
