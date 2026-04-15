function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
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

export const CHEERIO_CONFIG = {
  maxConcurrency: 10,
  maxRequestsPerMinute: 60,
  maxRequestRetries: 3,
  sameDomainDelaySecs: 1,
  statusMessageLoggingIntervalSecs: 30,
};

export const PLAYWRIGHT_CONFIG = {
  maxConcurrency: 3,
  maxRequestsPerMinute: 20,
  maxRequestRetries: 3,
  sameDomainDelaySecs: 2,
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
  defaultMaxPagesPerDomain: 5000,
  maxTrustedDomainNonRecipeHops: 2,
  maxOffDomainNonRecipeHops: 1,
  minCrossDomainAdmissionScore: 1,
  globalQueueCap: 50_000,
  recrawlAfterDays: 30,
};

export const STORAGE = {
  crawlRunRetentionDays: 90,
};

export const RECIPE_PATH_PATTERNS = [
  /\/opskrift\//i,
  /\/recipe\//i,
  /\/opskrifter\//i,
  /\/recipes\//i,
  /\/bagning\//i,
  /\/mad\//i,
  /\/kog\//i,
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
  /\/\d{4}\/\d{2}\/?$/,
  /\/account(?:$|[/?])/i,
  /\/konto(?:$|[/?])/i,
  /\/checkout(?:$|[/?])/i,
  /\/betaling(?:$|[/?])/i,
];

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
