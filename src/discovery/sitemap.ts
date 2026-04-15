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

async function resolveSeedSitemapUrls(seed: SeedConfig): Promise<string[]> {
  if (seed.sitemapUrl) {
    return [seed.sitemapUrl];
  }

  const rootUrl = `https://${normalizeDomain(seed.domain)}`;
  const discovered: string[] = [];

  try {
    for await (const sitemapUrl of discoverValidSitemaps([rootUrl])) {
      discovered.push(sitemapUrl);
    }
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
