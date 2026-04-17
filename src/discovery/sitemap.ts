import { SitemapRequestList, discoverValidSitemaps, log } from "crawlee";
import type { SeedConfig } from "../types.js";
import { normalizeDomain } from "../utils/canonicalize.js";

export async function createSitemapRequestList(
  seeds: SeedConfig[],
  persistStateKey: string
) {
  if (seeds.length === 0) {
    return undefined;
  }

  const sitemapUrls = (
    await Promise.all(seeds.map((seed) => resolveSeedSitemapUrls(seed)))
  ).flat();

  if (sitemapUrls.length === 0) {
    log.warning(`No sitemap URLs resolved for ${seeds.length} seed domains`);
    return undefined;
  }

  log.info(
    `Opening SitemapRequestList with ${sitemapUrls.length} sitemap sources for ${seeds.length} seed domains`
  );

  return SitemapRequestList.open({
    sitemapUrls,
    persistStateKey,
  });
}

const SITEMAP_DISCOVERY_TIMEOUT_MS = 30_000;

async function resolveSeedSitemapUrls(seed: SeedConfig): Promise<string[]> {
  if (seed.sitemapUrl) {
    return [seed.sitemapUrl];
  }

  const rootUrl = `https://${normalizeDomain(seed.domain)}`;
  const discovered: string[] = [];

  try {
    await withTimeout(
      (async () => {
        for await (const sitemapUrl of discoverValidSitemaps([rootUrl])) {
          discovered.push(sitemapUrl);
        }
      })(),
      SITEMAP_DISCOVERY_TIMEOUT_MS,
      `sitemap discovery for ${seed.domain} exceeded ${SITEMAP_DISCOVERY_TIMEOUT_MS}ms`
    );
  } catch (err) {
    log.warning(
      `Failed to discover sitemaps for ${seed.domain}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (discovered.length === 0) {
    log.warning(`No valid sitemaps discovered for ${seed.domain}`);
  } else {
    log.info(`Discovered ${discovered.length} sitemap URLs for ${seed.domain}`);
  }

  return discovered;
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
