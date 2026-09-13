import {
  CheerioCrawler,
  PlaywrightCrawler,
  type ProxyConfiguration,
  type CheerioCrawlingContext,
  type PlaywrightCrawlingContext,
} from "crawlee";
import { HeaderGenerator } from "header-generator";
import { CookieJar } from "tough-cookie";
import type { DanishJsonLdSource } from "./source-registry.js";

type CheerioHandler = (context: CheerioCrawlingContext) => Promise<void>;
type PlaywrightHandler = (context: PlaywrightCrawlingContext) => Promise<void>;
type CheerioOptions = NonNullable<ConstructorParameters<typeof CheerioCrawler>[0]>;
type PlaywrightOptions = NonNullable<ConstructorParameters<typeof PlaywrightCrawler>[0]>;

export interface DanishJsonLdCrawlerSettings {
  maxConcurrency: number;
  maxRequestRetries: number;
  maxRequestsPerMinute?: number;
  sameDomainDelaySecs: number;
}

/**
 * Content types that carry recipe HTML, or a sitemap, despite not being
 * declared as HTML.
 *
 * skolemaelk serves a perfectly ordinary sitemap - 341 <loc> entries, 164 of
 * them under /madpakker-og-opskrifter - as application/rss+xml, and Crawlee
 * refused the only request the crawl made: "served Content-Type
 * application/rss+xml, but only text/html, ... are allowed". The run recorded 0
 * completed requests and 1 failed, which reads as a source with no recipes.
 * What a sitemap is declared as says nothing about what it contains.
 */
export const DANISH_JSONLD_ADDITIONAL_MIME_TYPES = [
  "text/plain",
  "application/graphql-response+json",
  "application/rss+xml",
  "application/atom+xml",
] as const;

export const DANISH_JSONLD_PLAYWRIGHT_BROWSER_POOL_OPTIONS = {
  maxOpenPagesPerBrowser: 1,
  retireInactiveBrowserAfterSecs: 5,
  closeInactiveBrowserAfterSecs: 10,
} as const;

/**
 * Chromium advertises its automation by default. Sources that answer with a
 * browser check read those markers, so the rendered path launches without
 * them. Crawlee's fingerprint injection already supplies a browser user agent.
 */
export const DANISH_JSONLD_AUTOMATION_LAUNCH_ARGS = [
  "--disable-blink-features=AutomationControlled",
] as const;
export const DANISH_JSONLD_IGNORED_DEFAULT_ARGS = ["--enable-automation"] as const;

/** Removes the `navigator.webdriver` flag the automation launch still sets. */
export const DANISH_JSONLD_WEBDRIVER_INIT_SCRIPT = `
Object.defineProperty(navigator, 'webdriver', {
  configurable: true,
  get: () => undefined,
});
`;


/**
 * One browser, for the whole crawl.
 *
 * Left to got-scraping, every request drew a fresh header set: 12 different
 * browsers across 60 requests from one address, which no person produces. It
 * also draws the HTTP/1 and HTTP/2 sets independently, so a single session could
 * still present two browsers. And it chooses the TLS handshake from whatever
 * user agent the request carries, falling back to Firefox when there is none -
 * so the few requests the generator left without a user agent also negotiated
 * TLS as Firefox beneath Chrome headers.
 *
 * So the identity is chosen once, here, from desktop Chrome only (the TLS
 * profile got-scraping reproduces best), and sent unchanged on every request.
 * A draw is refused if it carries no user agent or any crawler marker, and the
 * few retries that takes are cheap.
 */
const CRAWLER_MARKER = /bot|crawl|spider|compatible;|pageburst|headless|preview|scan/i;

export const DANISH_JSONLD_ACCEPT_LANGUAGE = "da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7";

export function createDanishJsonLdBrowserIdentity(): Record<string, string> {
  const generator = new HeaderGenerator({
    browsers: [{ name: "chrome", minVersion: 130 }],
    operatingSystems: ["macos", "windows"],
    devices: ["desktop"],
    locales: ["da-DK", "da", "en-US", "en"],
  });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const headers = generator.getHeaders({ httpVersion: "2" }) as Record<string, string>;
    const userAgent = headers["user-agent"] ?? "";
    if (!/Chrome\/\d+/u.test(userAgent) || CRAWLER_MARKER.test(userAgent)) continue;
    // Most of this corpus is Danish; a browser in Denmark asks for Danish first.
    headers["accept-language"] = DANISH_JSONLD_ACCEPT_LANGUAGE;
    return headers;
  }
  throw new Error("Could not generate a clean desktop Chrome identity in 50 draws");
}

export function resolveDanishJsonLdCrawlerSettings(
  source: DanishJsonLdSource
): DanishJsonLdCrawlerSettings {
  return {
    maxConcurrency: source.requestSettings.maxConcurrency,
    maxRequestRetries: source.requestSettings.maxRetries,
    ...(source.requestSettings.rateLimitPerMinute === null
      ? {}
      : { maxRequestsPerMinute: source.requestSettings.rateLimitPerMinute }),
    sameDomainDelaySecs: source.requestSettings.delaySeconds,
  };
}

export function createDanishJsonLdCheerioCrawler(options: {
  source: DanishJsonLdSource;
  requestHandler: CheerioHandler;
  proxyConfiguration?: ProxyConfiguration;
  crawlerOptions?: Omit<CheerioOptions, "requestHandler">;
}) {
  const identity = createDanishJsonLdBrowserIdentity();
  // Kept here rather than handed to got: a jar passed as gotOptions.cookieJar
  // reaches got on every request and is still never used, because Crawlee's
  // streaming request path does not go through got's cookie handling - a
  // measured run sent 0 of 19 cookies back that way. So cookies are read from
  // each response and written onto the next request explicitly.
  const cookieJar = new CookieJar();
  const preNavigationHooks = [
    ...(options.crawlerOptions?.preNavigationHooks ?? []),
    ...(options.source.disableHeaderGenerator
      ? [async (_context: CheerioCrawlingContext, gotOptions: { useHeaderGenerator?: boolean }) => {
          gotOptions.useHeaderGenerator = false;
        }]
      : [async (
          _context: CheerioCrawlingContext,
          gotOptions: { headers?: Record<string, unknown>; useHeaderGenerator?: boolean }
        ) => {
          // Headers the caller set on a request still win; the identity fills
          // everything else, and the generator is off so it cannot redraw.
          gotOptions.headers = { ...identity, ...gotOptions.headers };
          gotOptions.useHeaderGenerator = false;
        }]),
    async (
      { request }: CheerioCrawlingContext,
      gotOptions: { headers?: Record<string, unknown> }
    ) => {
      const cookie = await cookieJar.getCookieString(request.url);
      // Crawlee merges gotOptions Cookie with any session cookies itself.
      if (cookie) gotOptions.headers = { ...gotOptions.headers, Cookie: cookie };
    },
  ];
  const postNavigationHooks = [
    ...(options.crawlerOptions?.postNavigationHooks ?? []),
    async ({ request, response }: CheerioCrawlingContext) => {
      const raw = (response as { headers?: Record<string, unknown> } | undefined)?.headers?.["set-cookie"];
      const values = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
      const url = request.loadedUrl ?? request.url;
      for (const value of values) {
        await cookieJar.setCookie(String(value), url, { ignoreError: true });
      }
    },
  ];
  return new CheerioCrawler({
    ...options.crawlerOptions,
    preNavigationHooks,
    postNavigationHooks,
    ...(options.proxyConfiguration
      ? { proxyConfiguration: options.proxyConfiguration }
      : {}),
    ...resolveDanishJsonLdCrawlerSettings(options.source),
    // Some sources serve recipe HTML under text/plain. Crawlee skips those by
    // default, which loses the page as a failed request; the body still parses
    // and extraction stays strict JSON-LD either way.
    additionalMimeTypes: [...DANISH_JSONLD_ADDITIONAL_MIME_TYPES],
    respectRobotsTxtFile: false,
    requestHandler: options.requestHandler,
  });
}

export function createDanishJsonLdPlaywrightCrawler(options: {
  source: DanishJsonLdSource;
  requestHandler: PlaywrightHandler;
  proxyConfiguration?: ProxyConfiguration;
  crawlerOptions?: Omit<PlaywrightOptions, "requestHandler">;
}) {
  const launchContext = options.crawlerOptions?.launchContext;
  const browserPoolOptions = options.crawlerOptions?.browserPoolOptions;
  const hardenedLaunchContext = {
    ...launchContext,
    launchOptions: {
      ...launchContext?.launchOptions,
      args: [
        ...(launchContext?.launchOptions?.args ?? []),
        ...DANISH_JSONLD_AUTOMATION_LAUNCH_ARGS,
      ],
      ignoreDefaultArgs: [
        ...(Array.isArray(launchContext?.launchOptions?.ignoreDefaultArgs)
          ? launchContext.launchOptions.ignoreDefaultArgs
          : []),
        ...DANISH_JSONLD_IGNORED_DEFAULT_ARGS,
      ],
    },
  };
  const preNavigationHooks = [
    ...(options.crawlerOptions?.preNavigationHooks ?? []),
    async ({ page }: PlaywrightCrawlingContext) => {
      await page.addInitScript(DANISH_JSONLD_WEBDRIVER_INIT_SCRIPT);
    },
  ];
  return new PlaywrightCrawler({
    ...options.crawlerOptions,
    preNavigationHooks,
    launchContext: hardenedLaunchContext,
    ...(options.proxyConfiguration
      ? {
          proxyConfiguration: options.proxyConfiguration,
          launchContext: {
            ...hardenedLaunchContext,
            browserPerProxy: true,
          },
        }
      : {}),
    ...resolveDanishJsonLdCrawlerSettings(options.source),
    browserPoolOptions: {
      ...browserPoolOptions,
      // A VPN rotation produces a new local bridge URL and therefore a new
      // proxy-specific Chromium. Retire old proxy browsers promptly instead
      // of retaining Crawlee's five-minute default pool.
      ...DANISH_JSONLD_PLAYWRIGHT_BROWSER_POOL_OPTIONS,
    },
    respectRobotsTxtFile: false,
    requestHandler: options.requestHandler,
  });
}
