function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readPositiveNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readLoadStateEnv(
  name: string,
  fallback: "load" | "domcontentloaded" | "networkidle"
): "load" | "domcontentloaded" | "networkidle" {
  const raw = process.env[name];
  if (
    raw === "load" ||
    raw === "domcontentloaded" ||
    raw === "networkidle"
  ) {
    return raw;
  }

  return fallback;
}

export const EXTRACTOR_VERSION = "1.0.0";
export const CRAWL_PROFILE =
  process.env["CRAWL_PROFILE"] === "high_coverage"
    ? "high_coverage"
    : "default";

const HIGH_COVERAGE = CRAWL_PROFILE === "high_coverage";

export const CHEERIO_CONFIG = {
  maxConcurrency: readPositiveIntEnv(
    "CHEERIO_MAX_CONCURRENCY",
    HIGH_COVERAGE ? 20 : 10
  ),
  maxRequestsPerMinute: readPositiveIntEnv(
    "CHEERIO_MAX_REQUESTS_PER_MINUTE",
    HIGH_COVERAGE ? 180 : 60
  ),
  maxRequestRetries: readPositiveIntEnv("CHEERIO_MAX_REQUEST_RETRIES", 3),
  sameDomainDelaySecs: readPositiveNumberEnv(
    "CHEERIO_SAME_DOMAIN_DELAY_SECS",
    HIGH_COVERAGE ? 0.25 : 1
  ),
  statusMessageLoggingIntervalSecs: 30,
  diagnosticsLoggingIntervalSecs: readPositiveIntEnv(
    "CHEERIO_DIAGNOSTICS_LOG_INTERVAL_SECS",
    60
  ),
  diagnosticsPageInterval: readPositiveIntEnv(
    "CHEERIO_DIAGNOSTICS_PAGE_INTERVAL",
    250
  ),
};

export const PLAYWRIGHT_CONFIG = {
  maxConcurrency: readPositiveIntEnv(
    "PLAYWRIGHT_MAX_CONCURRENCY",
    HIGH_COVERAGE ? 5 : 3
  ),
  maxRequestsPerMinute: readPositiveIntEnv(
    "PLAYWRIGHT_MAX_REQUESTS_PER_MINUTE",
    HIGH_COVERAGE ? 60 : 20
  ),
  maxRequestRetries: readPositiveIntEnv("PLAYWRIGHT_MAX_REQUEST_RETRIES", 3),
  sameDomainDelaySecs: readPositiveNumberEnv(
    "PLAYWRIGHT_SAME_DOMAIN_DELAY_SECS",
    HIGH_COVERAGE ? 1 : 2
  ),
  statusMessageLoggingIntervalSecs: 30,
  maxSessionRotations: 5,
  waitForLoadState: readLoadStateEnv(
    "PLAYWRIGHT_WAIT_FOR_LOAD_STATE",
    "networkidle"
  ),
  waitForLoadStateTimeoutMs: readPositiveIntEnv(
    "PLAYWRIGHT_WAIT_FOR_LOAD_STATE_TIMEOUT_MS",
    15_000
  ),
};

export const DISCOVERY = {
  defaultMaxPagesPerDomain: readPositiveIntEnv(
    "DEFAULT_MAX_PAGES_PER_DOMAIN",
    HIGH_COVERAGE ? 20_000 : 5000
  ),
  maxTrustedDomainNonRecipeHops: readPositiveIntEnv(
    "MAX_TRUSTED_DOMAIN_NON_RECIPE_HOPS",
    HIGH_COVERAGE ? 4 : 2
  ),
  maxOffDomainNonRecipeHops: readPositiveIntEnv(
    "MAX_OFF_DOMAIN_NON_RECIPE_HOPS",
    HIGH_COVERAGE ? 2 : 1
  ),
  minCrossDomainAdmissionScore: readPositiveIntEnv(
    "MIN_CROSS_DOMAIN_ADMISSION_SCORE",
    1
  ),
  globalQueueCap: readPositiveIntEnv(
    "GLOBAL_QUEUE_CAP",
    HIGH_COVERAGE ? 250_000 : 50_000
  ),
  recrawlAfterDays: readPositiveIntEnv("RECRAWL_AFTER_DAYS", 30),
};

export const STORAGE = {
  crawlRunRetentionDays: 90,
};

export const MONGODB_CONFIG = {
  defaultDatabaseName: "crawlee",
  collections: {
    pages: "pages",
    recipes: "recipes",
    crawlRuns: "crawl_runs",
  },
} as const;

export const RECIPE_PATH_PATTERNS = [
  /\/opskrift\//i,
  /\/recipe\//i,
  /\/opskrifter\//i,
  /\/recipes\//i,
  /\/bagning\//i,
  /\/mad\//i,
  /\/kog\//i,
  /\/mat\//i,
  /\/recept\//i,
  /\/rezepte?\//i,
  /\/oppskrift\//i,
  /\/oppskrifter\//i,
  /\/middagsretter?\//i,
  /\/aftensmad\//i,
  /\/desserts?\//i,
  /\/kuchen\//i,
];

export const HARD_DENYLIST_PATTERNS = [
  /\/search(?:$|[/?])/i,
  /\/soeg(?:$|[/?])/i,
  /\/sog(?:$|[/?])/i,
  /\/login(?:$|[/?])/i,
  /\/log-ind(?:$|[/?])/i,
  /\/cart(?:$|[/?])/i,
  /\/kurv(?:$|[/?])/i,
  /\/print\//i,
  /\/feed\//i,
  /\/wp-json\//i,
  /\/api(?:$|[/?])/i,
  /\/webapi(?:$|[/?])/i,
  /\/account(?:$|[/?])/i,
  /\/konto(?:$|[/?])/i,
  /\/checkout(?:$|[/?])/i,
  /\/betaling(?:$|[/?])/i,
  /\/privacy(?:$|[/?])/i,
  /\/cookie(?:$|[/?])/i,
];

export const SOFT_DISCOVERY_PATTERNS = [
  /\/tag\//i,
  /\/tags\//i,
  /\/kategori\//i,
  /\/kategorier\//i,
  /\/category\//i,
  /\/categories\//i,
  /\/page\/\d+/i,
  /\/side\/\d+/i,
  /\/\d{4}\/\d{2}\/?$/,
];

export const DENYLIST_PATTERNS = HARD_DENYLIST_PATTERNS;

export const DANISH_KEYWORDS = [
  "ingredienser",
  "tilberedning",
  "opskrift",
  "portioner",
  "minutter",
];

export const RECIPE_DISCOVERY_KEYWORDS = [
  "recipe",
  "recipes",
  "opskrift",
  "opskrifter",
  "mad",
  "bagning",
  "dessert",
  "middag",
  "dinner",
  "breakfast",
  "lunch",
  "cake",
  "kage",
  "soup",
  "salat",
  "salad",
  "recept",
  "recepten",
  "oppskrift",
  "oppskrifter",
  "zutaten",
  "zubereitung",
  "middag",
  "aftensmad",
  "frokost",
  "frukost",
  "morgonmad",
  "morgenmad",
  "dessert",
  "desserts",
];

export const JS_FRAMEWORK_MARKERS = [
  "__NEXT_DATA__",
  "__NUXT__",
  "window.__INITIAL_STATE__",
];

export const SKIP_EXTENSIONS = /\.(jpe?g|png|gif|webp|svg|ico|bmp|avif|tiff?|mp4|webm|avi|mov|mp3|wav|ogg|pdf|zip|gz|css|js|woff2?|ttf|eot)$/i;

export const STRIP_QUERY_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^ref$/i,
  /^print$/i,
  /^amp$/i,
];

export const MIN_BODY_TEXT_LENGTH = 200;
