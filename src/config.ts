export const EXTRACTOR_VERSION = "1.0.0";

export const CHEERIO_CONFIG = {
  maxConcurrency: 10,
  maxRequestsPerMinute: 60,
  maxRequestRetries: 3,
};

export const PLAYWRIGHT_CONFIG = {
  maxConcurrency: 3,
  maxRequestsPerMinute: 20,
  maxRequestRetries: 3,
};

export const DISCOVERY = {
  defaultMaxPagesPerDomain: 5000,
  maxNonRecipeHops: 1,
  globalQueueCap: 50_000,
  recrawlAfterDays: 30,
};

export const RECIPE_PATH_PATTERNS = [
  /\/opskrift\//i,
  /\/recipe\//i,
  /\/opskrifter\//i,
  /\/recipes\//i,
  /\/bagning\//i,
];

export const DENYLIST_PATTERNS = [
  /\/tag\//i,
  /\/kategori\//i,
  /\/category\//i,
  /\/search(?:$|[/?])/i,
  /\/login(?:$|[/?])/i,
  /\/cart(?:$|[/?])/i,
  /\/kurv(?:$|[/?])/i,
  /\/print\//i,
  /\/feed\//i,
  /\/wp-json\//i,
  /\/page\/\d+/i,
  /\/\d{4}\/\d{2}\/$/,
];

export const DANISH_KEYWORDS = [
  "ingredienser",
  "tilberedning",
  "opskrift",
  "portioner",
  "minutter",
];

export const JS_FRAMEWORK_MARKERS = [
  "__NEXT_DATA__",
  "__NUXT__",
  "window.__INITIAL_STATE__",
];

export const STRIP_QUERY_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^ref$/i,
  /^print$/i,
  /^amp$/i,
];

export const MIN_BODY_TEXT_LENGTH = 200;
