import { Sitemap, log } from "crawlee";
import type { SitemapEntry } from "../types.js";
import type { SeedConfig } from "../types.js";

export async function fetchSitemapUrls(
  seed: SeedConfig
): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];

  try {
    const { urls } = await Sitemap.load(seed.sitemapUrl);
    for (const url of urls) {
      entries.push({ url });
    }
    log.info(`Loaded ${entries.length} URLs from sitemap: ${seed.sitemapUrl}`);
  } catch (err) {
    log.warning(
      `Failed to load sitemap for ${seed.domain}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return entries;
}
