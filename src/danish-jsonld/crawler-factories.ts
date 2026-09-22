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
import { ConditionalImpitHttpClient } from "./conditional-http-client.js";
import { CookieJar } from "tough-cookie";
import type { DanishJsonLdSource } from "./source-registry.js";
import type { DanishJsonLdSiteSession } from "./site-session.js";
import type { WebsiteCooldowns } from "./website-cooldowns.js";
import type { AdaptiveRequestPacing } from "./adaptive-pacing.js";
import { requestProfileFor } from "./request-profile.js";

type CheerioHandler = (context: CheerioCrawlingContext) => Promise<void>;
type PlaywrightHandler = (context: PlaywrightCrawlingContext) => Promise<void>;
type CheerioOptions = NonNullable<ConstructorParameters<typeof CheerioCrawler>[0]>;
type PlaywrightOptions = NonNullable<ConstructorParameters<typeof PlaywrightCrawler>[0]>;
type CheerioNavigationOptions = Parameters<NonNullable<CheerioOptions["preNavigationHooks"]>[number]>[1];
type PlaywrightErrorContext = Parameters<NonNullable<PlaywrightOptions["errorHandler"]>>[0];

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
 * them. The user agent below matches the bundled browser and runtime platform.
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
 * Legacy override retained for the opt-in local diagnostic only. Do not inject
 * it in crawler pages: it exposes JS source, changes the function name and
 * bypasses native receiver checks in both WebGL versions.
 * @deprecated The crawler preserves the browser's native GPU information.
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
 * Keep the browser identity tied to Playwright's bundled Chromium and the host
 * platform. Crawlee otherwise substitutes an old macOS UA when fingerprints
 * are disabled. HTTP impersonation has its own supported profile; its version
 * must not be copied onto the real browser binary.
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

const browserUserAgentPlatform = process.platform === "darwin"
  ? "Macintosh; Intel Mac OS X 10_15_7"
  : process.platform === "win32" ? "Windows NT 10.0; Win64; x64" : "X11; Linux x86_64";
export const DANISH_JSONLD_BROWSER_USER_AGENT = `Mozilla/5.0 (${browserUserAgentPlatform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bundledChromiumMajorVersion()}.0.0.0 Safari/537.36`;

/**
 * A common desktop screen with a window that fits inside it. The window frame adds
 * a few pixels, so a 1920x1080 window on a 1920x1080 screen measured 1928x1100 -
 * larger than the screen it sits on, which no real window is.
 */
export const DANISH_JSONLD_BROWSER_SCREEN = { width: 2560, height: 1440 } as const;
export const DANISH_JSONLD_BROWSER_WINDOW = { width: 1920, height: 1080 } as const;
export const DANISH_JSONLD_BROWSER_VIEWPORT = { width: 1920, height: 969 } as const;


/**
 * Pin a supported Impit profile and the exact UA/client hints it emits. The
 * generic "chrome" alias in installed Impit 0.14.5 emits Chrome 124, while the
 * independent header generator drew Chrome 140-145. Locally measured profile
 * defaults for "chrome151" are Windows desktop Chrome 151, including this
 * brand list. Keep this tuple together when upgrading the transport profile.
 */
export const DANISH_JSONLD_IMPIT_PROFILE = "chrome151" as const;
export const DANISH_JSONLD_ACCEPT_LANGUAGE = "da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7";

export function createDanishJsonLdBrowserIdentity(source?: DanishJsonLdSource): Record<string, string> {
  return {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
    "sec-ch-ua": '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "accept-language": requestProfileFor(source).acceptLanguage,
  };
}

function withoutIdentityOverrides<T>(headers: Record<string, T> = {}): Record<string, T> {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => {
    const lower = name.toLowerCase();
    return lower !== "user-agent" && lower !== "accept-language" && !lower.startsWith("sec-ch-ua");
  }));
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
  siteSession?: DanishJsonLdSiteSession;
  cooldowns?: WebsiteCooldowns;
  pacing?: AdaptiveRequestPacing;
  crawlerOptions?: Omit<CheerioOptions, "requestHandler">;
}) {
  const identity = createDanishJsonLdBrowserIdentity(options.source);
  const cookieJar = options.siteSession?.cookieJar ?? new CookieJar();
  const preNavigationHooks = [
    ...(options.crawlerOptions?.preNavigationHooks ?? []),
    jitterHook(options.source),
    ...(options.source.disableHeaderGenerator
      ? [async ({ request }: CheerioCrawlingContext, gotOptions: { useHeaderGenerator?: boolean; headers?: Record<string, unknown> }) => {
          gotOptions.useHeaderGenerator = false;
          const withoutLanguage = (headers: Record<string, unknown> = {}) => Object.fromEntries(
            Object.entries(headers).filter(([name]) => name.toLowerCase() !== "accept-language"));
          request.headers = withoutLanguage(request.headers) as Record<string, string>;
          gotOptions.headers = { ...withoutLanguage(gotOptions.headers), "accept-language": identity["accept-language"] };
        }]
      : [async (
          { request }: CheerioCrawlingContext,
          gotOptions: { headers?: Record<string, unknown>; useHeaderGenerator?: boolean }
        ) => {
          // Crawlee merges request headers after hooks, then Impit folds casing.
          // Remove identity overrides from both layers to prevent contradictory
          // values being concatenated; preserve all source-specific headers.
          request.headers = withoutIdentityOverrides(request.headers);
          gotOptions.headers = { ...identity, ...withoutIdentityOverrides(gotOptions.headers) };
          gotOptions.useHeaderGenerator = false;
        }]),
    async (
      { request, proxyInfo }: CheerioCrawlingContext,
      gotOptions: CheerioNavigationOptions
    ) => {
      await options.siteSession?.prepareRequest(proxyInfo?.url);
      if (!options.source.disableHeaderGenerator && !options.crawlerOptions?.httpClient) {
        // Impit reads this jar on each redirect hop. A fixed Cookie header
        // would suppress that handling and replay stale cookies after redirects.
        gotOptions.cookieJar = cookieJar;
      } else {
        // Crawlee's Got streaming adapter ignores its cookieJar option.
        const cookie = await cookieJar.getCookieString(request.url);
        if (cookie) gotOptions.headers = { ...gotOptions.headers, Cookie: cookie };
      }
      await options.cooldowns?.beforeRequest(request.url);
      await options.pacing?.start(request, request.url);
    },
  ];
  const postNavigationHooks = [
    async ({ request, response }: CheerioCrawlingContext) => {
      await options.pacing?.finish(request, response?.statusCode ?? 0);
    },
    ...(options.crawlerOptions?.postNavigationHooks ?? []),
    async ({ request, response }: CheerioCrawlingContext) => {
      const raw = (response as { headers?: Record<string, unknown> } | undefined)?.headers?.["set-cookie"];
      const values = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
      // Crawlee fills loadedUrl only after post-navigation hooks. The final
      // response URL supplies the correct host and default cookie path now.
      const url = response?.url ?? request.loadedUrl ?? request.url;
      for (const value of values) {
        await cookieJar.setCookie(String(value), url, { ignoreError: true });
      }
      await options.siteSession?.persist();
    },
  ];
  return new CheerioCrawler({
    // Keep the TLS/HTTP profile and HTTP identity together. Nemlig deliberately
    // uses its existing JSON transport with browser header generation disabled.
    ...(options.source.disableHeaderGenerator
      ? {}
      : { httpClient: new ConditionalImpitHttpClient({ browser: DANISH_JSONLD_IMPIT_PROFILE }) }),
    ...options.crawlerOptions,
    preNavigationHooks,
    postNavigationHooks,
    ...(options.proxyConfiguration
      ? { proxyConfiguration: options.proxyConfiguration }
      : {}),
    ...resolveDanishJsonLdCrawlerSettings(options.source),
    ...(options.siteSession ? {
      // One response must not rotate/clear a shared session while another
      // request is still using its relay or browser state.
      maxConcurrency: 1,
      useSessionPool: false,
      persistCookiesPerSession: false,
    } : {}),
    // Some sources serve recipe HTML under text/plain. Crawlee skips those by
    // default, which loses the page as a failed request; the body still parses
    // and extraction stays strict JSON-LD either way.
    additionalMimeTypes: [...DANISH_JSONLD_ADDITIONAL_MIME_TYPES],
    respectRobotsTxtFile: false,
    requestHandler: options.requestHandler,
    errorHandler: async (context, error) => {
      await options.pacing?.finish(context.request, context.response?.statusCode ?? 0);
      await options.crawlerOptions?.errorHandler?.(context, error);
    },
    failedRequestHandler: async (context, error) => {
      await options.pacing?.finish(context.request, context.response?.statusCode ?? 0);
      await options.crawlerOptions?.failedRequestHandler?.(context, error);
    },
  });
}

export function createDanishJsonLdPlaywrightCrawler(options: {
  source: DanishJsonLdSource;
  requestHandler: PlaywrightHandler;
  proxyConfiguration?: ProxyConfiguration;
  siteSession?: DanishJsonLdSiteSession;
  cooldowns?: WebsiteCooldowns;
  pacing?: AdaptiveRequestPacing;
  crawlerOptions?: Omit<PlaywrightOptions, "requestHandler">;
}) {
  const profile = requestProfileFor(options.source);
  const browserGenerations = new WeakMap<object, number>();
  const captureBrowserState = async (context: PlaywrightCrawlingContext) => {
    if (!options.siteSession || !context.page) return;
    const generation = browserGenerations.get(context.page);
    if (generation === undefined) return;
    if (generation !== options.siteSession.generation) {
      // Retiring also discards localStorage and other state, not only cookies.
      context.crawler.browserPool.retireBrowserController(context.browserController);
      return;
    }
    // Crawlee may close a failed navigation's page before the error handler,
    // while its context still holds response cookies needed by the retry.
    await options.siteSession.captureBrowser(context.page.context(), generation);
  };
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
      screen: DANISH_JSONLD_BROWSER_SCREEN,
      viewport: DANISH_JSONLD_BROWSER_VIEWPORT,
      ...launchContext?.launchOptions,
      locale: profile.locale,
      timezoneId: profile.timezoneId,
      extraHTTPHeaders: {
        ...Object.fromEntries(Object.entries(launchContext?.launchOptions?.extraHTTPHeaders ?? {})
          .filter(([name]) => name.toLowerCase() !== "accept-language")),
        "Accept-Language": profile.acceptLanguage,
      },
      args: [
        ...(launchContext?.launchOptions?.args ?? []),
        ...DANISH_JSONLD_AUTOMATION_LAUNCH_ARGS,
        `--lang=${profile.locale}`,
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
    async ({ page, proxyInfo, request }: PlaywrightCrawlingContext) => {
      if (options.siteSession) {
        await options.siteSession.prepareRequest(proxyInfo?.url);
        browserGenerations.set(page, await options.siteSession.restoreBrowser(page.context()));
      }
      await page.addInitScript(DANISH_JSONLD_WEBDRIVER_INIT_SCRIPT);
      await options.cooldowns?.beforeRequest(request.url);
      await options.pacing?.start(request, request.url);
    },
  ];
  return new PlaywrightCrawler({
    ...options.crawlerOptions,
    preNavigationHooks,
    postNavigationHooks: [
      async ({ request, response }) => { await options.pacing?.finish(request, response?.status() ?? 0); },
      ...(options.crawlerOptions?.postNavigationHooks ?? []),
      captureBrowserState,
    ],
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
    ...(options.siteSession ? {
      maxConcurrency: 1,
      useSessionPool: false,
      persistCookiesPerSession: false,
    } : {}),
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
    requestHandler: async (context) => {
      try {
        await options.requestHandler(context);
      } finally {
        // Includes cookies set while a page settles or the handler runs.
        await captureBrowserState(context);
      }
    },
    errorHandler: async (context: PlaywrightErrorContext, error: Error) => {
      try {
        await options.pacing?.finish(context.request, context.response?.status() ?? 0);
        await options.crawlerOptions?.errorHandler?.(context, error);
      } finally {
        await captureBrowserState(context);
      }
    },
    failedRequestHandler: async (context: PlaywrightErrorContext, error: Error) => {
      try {
        await options.pacing?.finish(context.request, context.response?.status() ?? 0);
        await options.crawlerOptions?.failedRequestHandler?.(context, error);
      } finally {
        await captureBrowserState(context);
      }
    },
  });
}
