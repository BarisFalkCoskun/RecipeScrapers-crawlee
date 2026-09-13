import { describe, expect, it } from "vitest";
import { ProxyConfiguration } from "crawlee";
import {
  DANISH_JSONLD_ADDITIONAL_MIME_TYPES,
  DANISH_JSONLD_PLAYWRIGHT_BROWSER_POOL_OPTIONS,
  createDanishJsonLdCheerioCrawler,
  createDanishJsonLdPlaywrightCrawler,
  resolveDanishJsonLdCrawlerSettings,
  danishJsonLdJitterMillis,
  DANISH_JSONLD_WEBGL_INIT_SCRIPT,
  DANISH_JSONLD_BROWSER_USER_AGENT,
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

  it("accepts a mislabelled text/plain recipe page", () => {
    const source = DANISH_JSONLD_SOURCES.find((entry) => entry.id === "blenderopskrifter");
    if (!source) throw new Error("Blenderopskrifter registry fixture missing");
    const crawler = createDanishJsonLdCheerioCrawler({ source, requestHandler }) as unknown as {
      supportedMimeTypes: Set<string> | string[];
    };
    const supported = [...crawler.supportedMimeTypes];

    // Some sources serve HTML under text/plain; Crawlee skips those by default
    // and the recipes are lost as failed requests.
    expect(supported).toContain("text/plain");
    expect(supported).toContain("text/html");
    expect(supported).toContain("application/graphql-response+json");
  });

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

  it("runs full Chrome in the new headless mode, as a Danish reader", () => {
    // The headless shell Playwright uses for headless: true had no plugins, no
    // window.chrome, an 800x600 screen inside a larger window, en-US and UTC.
    const source = DANISH_JSONLD_SOURCES.find((entry) => entry.fetchMode === "playwright");
    if (!source) throw new Error("No browser-fetched registry fixture");
    const crawler = createDanishJsonLdPlaywrightCrawler({
      source,
      requestHandler,
      crawlerOptions: { launchContext: { launchOptions: { headless: true } } },
    }) as unknown as {
      launchContext: { launchOptions: Record<string, unknown> & { args?: string[] } };
      preNavigationHooks: Array<(context: unknown) => Promise<void>>;
    };
    const options = crawler.launchContext.launchOptions;
    expect(options.channel).toBe("chromium");
    expect(options.locale).toBe("da-DK");
    expect(options.timezoneId).toBe("Europe/Copenhagen");
    expect(options.args).toContain("--lang=da-DK");
    expect(options.headless).toBe(true);
  });

  it("gives the browser one truthful identity instead of random fingerprints", () => {
    // Injection drew a new fingerprint per launched browser (Chrome 142, then
    // 135, then a Brave brand list on a Chrome binary), and with it off Crawlee
    // substitutes macOS Chrome 107 - contradicting a Linux Chromium 147.
    const source = DANISH_JSONLD_SOURCES.find((entry) => entry.fetchMode === "playwright");
    if (!source) throw new Error("No browser-fetched registry fixture");
    const crawler = createDanishJsonLdPlaywrightCrawler({ source, requestHandler }) as unknown as {
      launchContext: { launchOptions: { args?: string[]; screen?: { width: number; height: number } } };
      browserPool: { useFingerprints?: boolean };
    };
    const args = crawler.launchContext.launchOptions.args ?? [];
    const userAgentArg = args.find((arg) => arg.startsWith("--user-agent="));
    expect(userAgentArg).toBe(`--user-agent=${DANISH_JSONLD_BROWSER_USER_AGENT}`);
    expect(DANISH_JSONLD_BROWSER_USER_AGENT).toMatch(/^Mozilla\/5\.0 \(X11; Linux x86_64\) .* Chrome\/\d+\.0\.0\.0 Safari\/537\.36$/u);
    expect(DANISH_JSONLD_BROWSER_USER_AGENT).not.toMatch(/Headless|Chrome\/107/u);
    expect(crawler.browserPool.useFingerprints).toBe(false);
    // The window frame makes the outer window larger than a same-sized screen.
    const screen = crawler.launchContext.launchOptions.screen;
    const windowArg = args.find((arg) => arg.startsWith("--window-size="))?.split("=")[1].split(",").map(Number) ?? [];
    expect(screen && windowArg[0] + 16 <= screen.width && windowArg[1] + 40 <= screen.height).toBe(true);
  });

  it("reports a GPU instead of a software rasterizer", () => {
    // A server has no GPU, so WebGL named llvmpipe or SwiftShader.
    expect(DANISH_JSONLD_WEBGL_INIT_SCRIPT).toContain("0x9246");
    expect(DANISH_JSONLD_WEBGL_INIT_SCRIPT).not.toMatch(/llvmpipe|SwiftShader/u);
    expect(DANISH_JSONLD_WEBGL_INIT_SCRIPT).toContain("WebGL2RenderingContext");
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
    // The enforced delay is the registry delay plus the largest jitter pause, so
    // a random pause can only lengthen a gap: 2s plus 20% of 2s.
    expect(resolveDanishJsonLdCrawlerSettings(arla)).toEqual({
      maxConcurrency: 2,
      maxRequestRetries: 3,
      sameDomainDelaySecs: 2.4,
    });
  });

  it("never lets a jitter pause shorten a gap below the registry delay", () => {
    // Crawlee stamps last access before the pause runs, so a long pause then a
    // short one once put two requests 1592 ms apart on a 2 second delay.
    for (const delaySeconds of [1, 2, 3, 20, 40, 120]) {
      const source = { requestSettings: { delaySeconds, maxConcurrency: 1, maxRetries: 3, rateLimitPerMinute: null } } as never;
      const enforcedMs = resolveDanishJsonLdCrawlerSettings(source).sameDomainDelaySecs * 1000;
      const longest = danishJsonLdJitterMillis(delaySeconds, () => 1);
      const shortest = danishJsonLdJitterMillis(delaySeconds, () => 0);
      expect(enforcedMs + shortest - longest).toBeGreaterThanOrEqual(delaySeconds * 1000);
      expect(longest).toBeLessThanOrEqual(10_000);
    }
  });

  type HookOptions = { headers?: Record<string, unknown>; useHeaderGenerator?: boolean };
  type Hooked = {
    preNavigationHooks: Array<(context: unknown, options: HookOptions) => Promise<void>>;
    postNavigationHooks: Array<(context: unknown) => Promise<void>>;
  };
  const navigate = async (crawler: Hooked, url: string, setCookie?: string[]) => {
    const options: HookOptions = {};
    const request = { url, loadedUrl: url };
    for (const hook of crawler.preNavigationHooks) await hook({ request }, options);
    // Crawlee prepends a hook of its own that needs a real response; ours is last.
    await crawler.postNavigationHooks.at(-1)?.({
      request,
      response: { url, headers: setCookie ? { "set-cookie": setCookie } : {} },
    });
    return options;
  };
  const crawlerFor = (id: string) => {
    const source = DANISH_JSONLD_SOURCES.find((entry) => entry.id === id);
    if (!source) throw new Error(`Registry fixture ${id} missing`);
    return createDanishJsonLdCheerioCrawler({ source, requestHandler }) as unknown as Hooked;
  };

  it("keeps Nemlig's JSON transport free of generated browser headers", async () => {
    const options = await navigate(crawlerFor("nemlig"), "https://www.nemlig.com/a");
    expect(options.useHeaderGenerator).toBe(false);
    expect(options.headers?.["user-agent"]).toBeUndefined();
  });

  it("presents one desktop Chrome for a whole crawl", async () => {
    // Left to got-scraping every request drew a new browser - 12 across 60
    // requests from one address - and some drew a crawler's own user agent,
    // compatible; pageburst, or none at all.
    const crawler = crawlerFor("arla");
    const first = await navigate(crawler, "https://www.arla.dk/a");
    const second = await navigate(crawler, "https://www.arla.dk/b");
    const userAgent = String(first.headers?.["user-agent"]);
    expect(userAgent).toMatch(/Chrome\/\d+/u);
    expect(userAgent).not.toMatch(/bot|crawl|spider|compatible;|headless/iu);
    expect(second.headers?.["user-agent"]).toBe(userAgent);
    expect(first.useHeaderGenerator).toBe(false);
    expect(first.headers?.["accept-language"]).toMatch(/^da-DK/u);
    const version = userAgent.match(/Chrome\/(\d+)/u)?.[1];
    expect(String(first.headers?.["sec-ch-ua"])).toContain(`v="${version}"`);
  });

  it("sends back the cookies a site set", async () => {
    // The runner does not use Crawlee's session pool, and a jar handed to got
    // is bypassed by Crawlee's streaming request path, so no cookie was ever
    // returned - 0 of 79 in a measured run.
    const crawler = crawlerFor("arla");
    await navigate(crawler, "https://www.arla.dk/a", ["visitor=abc; Path=/", "consent=yes; Path=/"]);
    const next = await navigate(crawler, "https://www.arla.dk/b");
    expect(String(next.headers?.Cookie)).toContain("visitor=abc");
    expect(String(next.headers?.Cookie)).toContain("consent=yes");
    const elsewhere = await navigate(crawler, "https://example.com/");
    expect(elsewhere.headers?.Cookie).toBeUndefined();
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

  it("accepts a sitemap served as an RSS or Atom content type", () => {
    // skolemaelk serves an ordinary sitemap - 341 <loc> entries, 164 of them
    // under /madpakker-og-opskrifter - as application/rss+xml. Crawlee refused
    // the only request the crawl made and the run recorded 0 completed and 1
    // failed, which reads as a source publishing no recipes at all.
    expect(DANISH_JSONLD_ADDITIONAL_MIME_TYPES).toContain("application/rss+xml");
    expect(DANISH_JSONLD_ADDITIONAL_MIME_TYPES).toContain("application/atom+xml");
  });
});
