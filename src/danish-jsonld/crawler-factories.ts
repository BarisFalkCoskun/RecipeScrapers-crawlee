import {
  CheerioCrawler,
  PlaywrightCrawler,
  type ProxyConfiguration,
  type CheerioCrawlingContext,
  type PlaywrightCrawlingContext,
} from "crawlee";
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

/** Content types that carry recipe HTML despite not being declared as HTML. */
export const DANISH_JSONLD_ADDITIONAL_MIME_TYPES = ["text/plain"] as const;

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
  return new CheerioCrawler({
    ...options.crawlerOptions,
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
