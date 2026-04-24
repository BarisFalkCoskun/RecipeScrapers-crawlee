export interface CrawlRunStorageKeys {
  cheerioQueueName: string;
  playwrightQueueName: string;
  linkFilterStateKey: string;
  cheerioSitemapStateKey: string;
  playwrightSitemapStateKey: string;
}

export function resolveCrawlRunId(
  startedAt: Date,
  env: NodeJS.ProcessEnv = process.env
): string {
  const configuredRunId = env["CRAWL_RUN_ID"]?.trim();
  if (configuredRunId) {
    return sanitizeStorageKey(configuredRunId);
  }

  return sanitizeStorageKey(startedAt.toISOString());
}

export function createCrawlRunStorageKeys(
  runId: string
): CrawlRunStorageKeys {
  const scopedRunId = sanitizeStorageKey(runId);

  return {
    cheerioQueueName: `cheerio-queue-${scopedRunId}`,
    playwrightQueueName: `playwright-queue-${scopedRunId}`,
    linkFilterStateKey: `link-filter-state-${scopedRunId}`,
    cheerioSitemapStateKey: `cheerio-sitemap-request-list-${scopedRunId}`,
    playwrightSitemapStateKey: `playwright-sitemap-request-list-${scopedRunId}`,
  };
}

function sanitizeStorageKey(input: string): string {
  const sanitized = input
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || "run";
}
