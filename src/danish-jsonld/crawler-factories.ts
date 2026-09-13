import {
  CheerioCrawler,
  PlaywrightCrawler,
  type ProxyConfiguration,
  type CheerioCrawlingContext,
  type PlaywrightCrawlingContext,
} from "crawlee";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { ImpitHttpClient } from "@crawlee/impit-client";
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
 * A server has no GPU, so WebGL reports a software rasterizer - llvmpipe under
 * the old headless shell, SwiftShader under the new headless mode - and the
 * renderer string is one of the most-read signals that a browser is not a
 * person's. It is reported as an ordinary Intel laptop GPU under Mesa, which is
 * what a real Linux desktop running this Chrome would show. Only the two
 * debug-info strings change; rendering itself is untouched.
 */
export const DANISH_JSONLD_WEBGL_INIT_SCRIPT = `
(() => {
  const VENDOR = 0x9245, RENDERER = 0x9246;
  const patch = (proto) => {
    if (!proto) return;
    const original = proto.getParameter;
    proto.getParameter = function (parameter) {
      if (parameter === VENDOR) return 'Google Inc. (Intel)';
      if (parameter === RENDERER) return 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)';
      return original.call(this, parameter);
    };
  };
  patch(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
  patch(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
})();
`;

/** A Danish reader: language, and the timezone this corpus's audience lives in. */
export const DANISH_JSONLD_BROWSER_LOCALE = "da-DK";
export const DANISH_JSONLD_BROWSER_TIMEZONE = "Europe/Copenhagen";

/**
 * The browser path tells the truth about its binary rather than pretending to be
 * another browser: it is Chromium on Linux, so that is what it says.
 *
 * Crawlee's fingerprint injection was the alternative, and it drew a different
 * random fingerprint for every browser it launched, because fingerprints are
 * cached per session and the runner keeps the session pool off to preserve block
 * diagnostics - Chrome 142 on one page and Chrome 135 on the next, and a Brave
 * brand list on a Chrome binary. With injection off, Crawlee falls back to a
 * hardcoded user agent for macOS Chrome 107, which contradicts a Linux platform
 * and a Chromium 147 brand list; and with no user agent at all, headless mode
 * reports itself as HeadlessChrome. So the user agent is written out here from
 * the Chromium version Playwright actually ships, in Chrome's reduced form. The
 * platform, brand list, TLS handshake and HTTP/2 behaviour are then all genuine
 * and all agree with it.
 */
function bundledChromiumMajorVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    // The package's export map hides browsers.json, so read it beside the entry.
    const manifestPath = join(dirname(require.resolve("playwright-core")), "browsers.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      browsers: Array<{ name: string; browserVersion?: string }>;
    };
    const version = manifest.browsers.find((browser) => browser.name === "chromium")?.browserVersion;
    const major = version?.split(".")[0];
    if (major && /^\d+$/u.test(major)) return major;
  } catch {
    // Fall through to the error below with the reason it matters.
  }
  throw new Error("Cannot read the bundled Chromium version; the browser user agent would not match its binary");
}

export const DANISH_JSONLD_BROWSER_USER_AGENT = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bundledChromiumMajorVersion()}.0.0.0 Safari/537.36`;

/**
 * A common desktop screen with a window that fits inside it. The window frame adds
 * a few pixels, so a 1920x1080 window on a 1920x1080 screen measured 1928x1100 -
 * larger than the screen it sits on, which no real window is.
 */
export const DANISH_JSONLD_BROWSER_SCREEN = { width: 2560, height: 1440 } as const;
export const DANISH_JSONLD_BROWSER_WINDOW = { width: 1920, height: 1080 } as const;
export const DANISH_JSONLD_BROWSER_VIEWPORT = { width: 1920, height: 969 } as const;


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

/**
 * Crawlee's same-domain delay has no randomness: the next request leaves the
 * moment the delay since the last one expires, so a source paced at 40 seconds
 * sees a request every 40.0 seconds - a rhythm no reader keeps. Each request now
 * waits an extra random pause before it is sent.
 *
 * The pause cannot simply sit on top of the delay. Crawlee stamps a domain's
 * last access when a request is taken from the queue, before this pause runs,
 * so a long pause followed by a short one put two requests closer together than
 * the delay - measured at 1592 ms against a 2 second delay. That matters on the
 * sources paced because they rate-limit: 40 seconds is clean there and 20 seconds
 * was refused. So the delay Crawlee enforces is raised by the largest possible
 * pause, which guarantees every gap is at least the source's configured delay
 * and at most that plus twice the pause ceiling. The pause ceiling is 20% of the
 * delay, capped at 10 seconds; the average cost is that 20%.
 */
export const DANISH_JSONLD_JITTER_FRACTION = 0.2;
export const DANISH_JSONLD_JITTER_CAP_MS = 10_000;

export function danishJsonLdJitterCeilingMillis(delaySeconds: number): number {
  return Math.min(delaySeconds * 1000 * DANISH_JSONLD_JITTER_FRACTION, DANISH_JSONLD_JITTER_CAP_MS);
}

export function danishJsonLdJitterMillis(delaySeconds: number, random = Math.random): number {
  const ceiling = danishJsonLdJitterCeilingMillis(delaySeconds);
  return ceiling > 0 ? Math.round(random() * ceiling) : 0;
}

function jitterHook(source: DanishJsonLdSource) {
  return async () => {
    const pause = danishJsonLdJitterMillis(source.requestSettings.delaySeconds);
    if (pause > 0) await new Promise((resolve) => setTimeout(resolve, pause));
  };
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
    sameDomainDelaySecs:
      source.requestSettings.delaySeconds +
      danishJsonLdJitterCeilingMillis(source.requestSettings.delaySeconds) / 1000,
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
    jitterHook(options.source),
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
    // Headers alone cannot make a Node client look like Chrome. got-scraping
    // negotiates TLS and HTTP/2 the way Node does - JA4 t13d1513h2..ff9cead5a15b
    // with 13 extensions, HTTP/2 settings 2:0;4:33554432 and pseudo-headers in
    // the order method, path, authority, scheme - while real Chrome sends JA4
    // t13d1516h2_8daaf6152771_02713d6af862 and method, authority, scheme, path.
    // Bot management compares the two and sees a client claiming Chrome that
    // connects like Node. impit reproduces Chrome's handshake exactly, measured
    // against tls.peet.ws. nemlig keeps got-scraping with its generated headers
    // turned off, because its JSON transport is the one place a browser profile
    // was deliberately removed.
    ...(options.source.disableHeaderGenerator
      ? {}
      : { httpClient: new ImpitHttpClient({ browser: "chrome" }) }),
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
      // Playwright's headless: true runs the stripped headless shell, which has
      // no plugins, no window.chrome and an 800x600 screen inside a larger
      // window. The chromium channel runs full Chrome in the new headless mode
      // instead: 5 plugins, window.chrome, and a consistent 1920x1080 screen.
      channel: "chromium",
      locale: DANISH_JSONLD_BROWSER_LOCALE,
      timezoneId: DANISH_JSONLD_BROWSER_TIMEZONE,
      screen: DANISH_JSONLD_BROWSER_SCREEN,
      viewport: DANISH_JSONLD_BROWSER_VIEWPORT,
      ...launchContext?.launchOptions,
      args: [
        ...(launchContext?.launchOptions?.args ?? []),
        ...DANISH_JSONLD_AUTOMATION_LAUNCH_ARGS,
        `--lang=${DANISH_JSONLD_BROWSER_LOCALE}`,
        `--user-agent=${DANISH_JSONLD_BROWSER_USER_AGENT}`,
        `--window-size=${DANISH_JSONLD_BROWSER_WINDOW.width},${DANISH_JSONLD_BROWSER_WINDOW.height}`,
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
    jitterHook(options.source),
    async ({ page }: PlaywrightCrawlingContext) => {
      await page.addInitScript(DANISH_JSONLD_WEBDRIVER_INIT_SCRIPT);
      await page.addInitScript(DANISH_JSONLD_WEBGL_INIT_SCRIPT);
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
      // See DANISH_JSONLD_BROWSER_USER_AGENT: one truthful identity instead of a
      // random fingerprint per launched browser.
      useFingerprints: false,
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
