const REQUEST_LABEL_VALUES = {
  seedRoot: "seed-root",
  sitemapPage: "sitemap-page",
  discoveredPage: "discovered-page",
  playwrightFallback: "playwright-fallback",
} as const;

export const REQUEST_LABELS = REQUEST_LABEL_VALUES;

export type RequestLabel =
  (typeof REQUEST_LABEL_VALUES)[keyof typeof REQUEST_LABEL_VALUES];

interface RequestLike {
  label?: string | null;
  userData?: Record<string, unknown>;
}

export function classifyCheerioRequest(request: RequestLike): RequestLabel {
  if (request.label === REQUEST_LABELS.seedRoot) {
    return REQUEST_LABELS.seedRoot;
  }

  if (
    request.label === REQUEST_LABELS.sitemapPage ||
    request.userData?.["fromSitemap"] === true
  ) {
    return REQUEST_LABELS.sitemapPage;
  }

  return REQUEST_LABELS.discoveredPage;
}

export function classifyPlaywrightRequest(request: RequestLike): RequestLabel {
  if (request.label === REQUEST_LABELS.playwrightFallback) {
    return REQUEST_LABELS.playwrightFallback;
  }

  if (request.label === REQUEST_LABELS.seedRoot) {
    return REQUEST_LABELS.seedRoot;
  }

  if (
    request.label === REQUEST_LABELS.sitemapPage ||
    request.userData?.["fromSitemap"] === true
  ) {
    return REQUEST_LABELS.sitemapPage;
  }

  if (request.userData?.["playwrightRetry"] === true) {
    return REQUEST_LABELS.playwrightFallback;
  }

  return REQUEST_LABELS.discoveredPage;
}
