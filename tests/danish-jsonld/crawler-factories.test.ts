import { describe, expect, it } from "vitest";
import {
  createDanishJsonLdCheerioCrawler,
  createDanishJsonLdPlaywrightCrawler,
  resolveDanishJsonLdCrawlerSettings,
} from "../../src/danish-jsonld/crawler-factories.js";
import { DANISH_JSONLD_SOURCES } from "../../src/danish-jsonld/source-registry.js";

function crawlerInternal(crawler: unknown) {
  return crawler as {
    respectRobotsTxtFile: boolean;
    maxRequestRetries: number;
    autoscaledPoolOptions: {
      maxConcurrency: number;
      maxTasksPerMinute: number;
    };
  };
}

describe("Danish JSON-LD crawler factories", () => {
  const requestHandler = async () => undefined;

  it("applies each source's registry concurrency, retry, and delay settings", () => {
    const arla = DANISH_JSONLD_SOURCES.find((source) => source.id === "arla");
    if (!arla) throw new Error("Arla registry fixture missing");
    const cheerio = crawlerInternal(
      createDanishJsonLdCheerioCrawler({ source: arla, requestHandler })
    );
    const playwright = crawlerInternal(
      createDanishJsonLdPlaywrightCrawler({ source: arla, requestHandler })
    );

    expect(cheerio.maxRequestRetries).toBe(arla.requestSettings.maxRetries);
    expect(playwright.maxRequestRetries).toBe(arla.requestSettings.maxRetries);
    expect(cheerio.autoscaledPoolOptions.maxConcurrency).toBe(
      arla.requestSettings.maxConcurrency
    );
    expect(playwright.autoscaledPoolOptions.maxConcurrency).toBe(
      arla.requestSettings.maxConcurrency
    );
    expect(resolveDanishJsonLdCrawlerSettings(arla)).toEqual({
      maxConcurrency: 2,
      maxRequestRetries: 3,
      sameDomainDelaySecs: 2,
    });
  });
});
