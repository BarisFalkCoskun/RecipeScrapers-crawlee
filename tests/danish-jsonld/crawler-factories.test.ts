import { describe, expect, it } from "vitest";
import { ProxyConfiguration } from "crawlee";
import {
  DANISH_JSONLD_PLAYWRIGHT_BROWSER_POOL_OPTIONS,
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

  it("hides Chromium's automation markers from browser-check sources", () => {
    const source = DANISH_JSONLD_SOURCES.find((entry) => entry.id === "sundpaabudget");
    if (!source) throw new Error("Sund paa Budget registry fixture missing");
    const crawler = createDanishJsonLdPlaywrightCrawler({
      source,
      requestHandler,
      crawlerOptions: { launchContext: { launchOptions: { headless: true } } },
    }) as unknown as {
      launchContext: {
        launchOptions: { args?: string[]; ignoreDefaultArgs?: string[]; headless?: boolean };
      };
    };
    const { args = [], ignoreDefaultArgs = [], headless } =
      crawler.launchContext.launchOptions;

    expect(args).toContain("--disable-blink-features=AutomationControlled");
    expect(ignoreDefaultArgs).toContain("--enable-automation");
    // Caller-supplied launch options must survive the hardening merge.
    expect(headless).toBe(true);
  });

  it("keeps caller launch args alongside the automation hardening", () => {
    const source = DANISH_JSONLD_SOURCES.find((entry) => entry.id === "sundpaabudget");
    if (!source) throw new Error("Sund paa Budget registry fixture missing");
    const crawler = createDanishJsonLdPlaywrightCrawler({
      source,
      requestHandler,
      crawlerOptions: {
        launchContext: { launchOptions: { args: ["--custom-flag"] } },
      },
    }) as unknown as {
      launchContext: { launchOptions: { args?: string[] } };
    };

    expect(crawler.launchContext.launchOptions.args).toContain("--custom-flag");
    expect(crawler.launchContext.launchOptions.args).toContain(
      "--disable-blink-features=AutomationControlled"
    );
  });

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

  it("accepts the same dynamic proxy configuration for Cheerio and Playwright", () => {
    const arla = DANISH_JSONLD_SOURCES.find((source) => source.id === "arla");
    if (!arla) throw new Error("Arla registry fixture missing");
    const proxyConfiguration = new ProxyConfiguration({
      newUrlFunction: async () => "http://127.0.0.1:4310",
    });
    const cheerio = createDanishJsonLdCheerioCrawler({
      source: arla,
      requestHandler,
      proxyConfiguration,
    }) as unknown as { proxyConfiguration: ProxyConfiguration };
    const playwright = createDanishJsonLdPlaywrightCrawler({
      source: arla,
      requestHandler,
      proxyConfiguration,
    }) as unknown as {
      proxyConfiguration: ProxyConfiguration;
      launchContext: { browserPerProxy: boolean };
    };

    expect(cheerio.proxyConfiguration).toBe(proxyConfiguration);
    expect(playwright.proxyConfiguration).toBe(proxyConfiguration);
    expect(playwright.launchContext.browserPerProxy).toBe(true);
    expect(DANISH_JSONLD_PLAYWRIGHT_BROWSER_POOL_OPTIONS).toEqual({
      retireInactiveBrowserAfterSecs: 5,
      closeInactiveBrowserAfterSecs: 10,
      maxOpenPagesPerBrowser: 1,
    });
    expect((playwright as unknown as {
      browserPool: { maxOpenPagesPerBrowser: number; closeInactiveBrowserAfterMillis: number };
    }).browserPool).toMatchObject({
      maxOpenPagesPerBrowser: 1,
      closeInactiveBrowserAfterMillis: 10_000,
    });
  });

  it("cannot re-enable robots.txt through dedicated crawler option overrides", () => {
    const arla = DANISH_JSONLD_SOURCES.find((source) => source.id === "arla");
    if (!arla) throw new Error("Arla registry fixture missing");
    const cheerio = crawlerInternal(createDanishJsonLdCheerioCrawler({
      source: arla,
      requestHandler,
      crawlerOptions: { respectRobotsTxtFile: true },
    }));
    const playwright = crawlerInternal(createDanishJsonLdPlaywrightCrawler({
      source: arla,
      requestHandler,
      crawlerOptions: { respectRobotsTxtFile: true },
    }));

    expect(cheerio.respectRobotsTxtFile).toBe(false);
    expect(playwright.respectRobotsTxtFile).toBe(false);
  });
});
