import { describe, expect, it } from "vitest";
import { RequestQueue } from "crawlee";
import { createCheerioCrawlerInstance } from "../../src/crawlers/cheerio-crawler.js";
import { createPlaywrightCrawlerInstance } from "../../src/crawlers/playwright-crawler.js";

const common = {
  store: {} as never,
  linkFilter: {} as never,
  trustedSeedDomains: new Set<string>(),
  maxRequestsPerCrawl: 1,
  respectRobotsTxtFile: true,
  recrawlCutoff: new Date(0),
  metrics: {} as never,
};

describe("global robots.txt policy", () => {
  it("cannot re-enable robots enforcement in the generic Cheerio crawler", async () => {
    const cheerioQueue = await RequestQueue.open(`robots-cheerio-${crypto.randomUUID()}`);
    const playwrightQueue = await RequestQueue.open(`robots-playwright-fallback-${crypto.randomUUID()}`);
    try {
      const crawler = createCheerioCrawlerInstance({
        ...common,
        playwrightQueue,
        cheerioQueue,
        seedDomains: new Map(),
      }) as unknown as { respectRobotsTxtFile: boolean };

      expect(crawler.respectRobotsTxtFile).toBe(false);
    } finally {
      await cheerioQueue.drop();
      await playwrightQueue.drop();
    }
  });

  it("cannot re-enable robots enforcement in the generic Playwright crawler", async () => {
    const playwrightQueue = await RequestQueue.open(`robots-playwright-${crypto.randomUUID()}`);
    try {
      const crawler = createPlaywrightCrawlerInstance({
        ...common,
        playwrightQueue,
      }) as unknown as { respectRobotsTxtFile: boolean };

      expect(crawler.respectRobotsTxtFile).toBe(false);
    } finally {
      await playwrightQueue.drop();
    }
  });
});
