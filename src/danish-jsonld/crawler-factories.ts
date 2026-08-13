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

export const DANISH_JSONLD_PLAYWRIGHT_BROWSER_POOL_OPTIONS = {
  maxOpenPagesPerBrowser: 1,
  retireInactiveBrowserAfterSecs: 5,
  closeInactiveBrowserAfterSecs: 10,
} as const;

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
  return new PlaywrightCrawler({
    ...options.crawlerOptions,
    ...(options.proxyConfiguration
      ? {
          proxyConfiguration: options.proxyConfiguration,
          launchContext: {
            ...launchContext,
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
