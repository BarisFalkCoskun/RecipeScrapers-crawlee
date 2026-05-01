import { SitemapRequestList, discoverValidSitemaps, log } from "crawlee";
import type { SeedConfig } from "../types.js";
import { normalizeDomain } from "../utils/canonicalize.js";

type SitemapDiscoveryFn = (rootUrls: string[]) => AsyncIterable<string>;

export async function createSitemapRequestList(
  seeds: SeedConfig[],
  persistStateKey: string,
  options: { discoverSitemaps?: SitemapDiscoveryFn } = {}
) {
  if (seeds.length === 0) {
    return undefined;
  }

  const sitemapUrls = (
    await Promise.all(
      seeds.map((seed) =>
        resolveSeedSitemapUrls(seed, {
          discoverSitemaps: options.discoverSitemaps,
        })
      )
    )
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

export async function resolveSeedSitemapUrls(
  seed: SeedConfig,
  options: { discoverSitemaps?: SitemapDiscoveryFn } = {}
): Promise<string[]> {
  const configured = unique([
    ...(seed.sitemapUrl ? [seed.sitemapUrl] : []),
    ...(seed.sitemapUrls ?? []),
  ]);

  const rootUrls = getSitemapDiscoveryRootUrls(seed, configured);
  const discovered: string[] = [];
  const discoverSitemaps = options.discoverSitemaps ?? discoverValidSitemaps;

  try {
    await withTimeout(
      (async () => {
        for await (const sitemapUrl of discoverSitemaps(rootUrls)) {
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

  if (configured.length > 0 && discovered.length > 0) {
    log.info(
      `Using ${configured.length} configured sitemap URLs and ${discovered.length} discovered fallback sitemap URLs for ${seed.domain}`
    );
  } else if (configured.length > 0) {
    log.info(
      `Using ${configured.length} configured sitemap URLs for ${seed.domain}; no fallback sitemaps discovered`
    );
  } else if (discovered.length === 0) {
    log.warning(`No valid sitemaps discovered for ${seed.domain}`);
  } else {
    log.info(`Discovered ${discovered.length} sitemap URLs for ${seed.domain}`);
  }

  return unique([...configured, ...discovered]);
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

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function getSitemapDiscoveryRootUrls(
  seed: SeedConfig,
  configuredSitemapUrls: string[]
): string[] {
  const roots = [`https://${normalizeDomain(seed.domain)}`];

  for (const sitemapUrl of configuredSitemapUrls) {
    try {
      roots.push(new URL("/", sitemapUrl).toString().replace(/\/$/, ""));
    } catch {
      continue;
    }
  }

  return unique(roots);
}
