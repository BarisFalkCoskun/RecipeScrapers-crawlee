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
    respectRobotsTxtFile: false,
    requestHandler: options.requestHandler,
  });
}
