import {
  CheerioCrawler,
  PlaywrightCrawler,
  type CheerioCrawlingContext,
  type PlaywrightCrawlingContext,
} from "crawlee";
import type { DanishJsonLdSource } from "./source-registry.js";

type CheerioHandler = (context: CheerioCrawlingContext) => Promise<void>;
type PlaywrightHandler = (context: PlaywrightCrawlingContext) => Promise<void>;
type CheerioOptions = ConstructorParameters<typeof CheerioCrawler>[0];
type PlaywrightOptions = ConstructorParameters<typeof PlaywrightCrawler>[0];

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
  crawlerOptions?: Omit<CheerioOptions, "requestHandler">;
}) {
  return new CheerioCrawler({
    ...options.crawlerOptions,
    ...resolveDanishJsonLdCrawlerSettings(options.source),
    requestHandler: options.requestHandler,
  });
}

export function createDanishJsonLdPlaywrightCrawler(options: {
  source: DanishJsonLdSource;
  requestHandler: PlaywrightHandler;
  crawlerOptions?: Omit<PlaywrightOptions, "requestHandler">;
}) {
  return new PlaywrightCrawler({
    ...options.crawlerOptions,
    ...resolveDanishJsonLdCrawlerSettings(options.source),
    requestHandler: options.requestHandler,
  });
}
