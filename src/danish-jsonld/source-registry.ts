import { DANISH_WPRM_SOURCE_DEFINITIONS } from "../wprm/danish-sources.js";
import { DANISH_WP_POSTS_SOURCE_DEFINITIONS } from "./danish-wp-posts-sources.js";
import {
  DANISH_CUSTOM_JSONLD_SOURCE_DEFINITIONS,
  DANISH_CUSTOM_LISTING_JSONLD_SOURCE_DEFINITIONS,
  DANISH_CUSTOM_WPRM_SOURCE_DEFINITIONS,
  DANISH_ARTICLE_HTML_SOURCE_DEFINITIONS,
  DANISH_JSONLD_HTML_SOURCE_DEFINITIONS,
  DANISH_REDIRECTED_JSONLD_SOURCE_DEFINITIONS,
  DANISH_ALT_HTML_SOURCE_DEFINITIONS,
  DANISH_MULTI_RECIPE_HTML_SOURCE_DEFINITIONS,
  DANISH_DR_GRAPHQL_SOURCE_DEFINITIONS,
  DANISH_AUTHENTICATED_API_SOURCE_DEFINITIONS,
  DANISH_DAGROFA_API_SOURCE_DEFINITIONS,
  DANISH_SITECORE_API_SOURCE_DEFINITIONS,
  DANISH_LEGACY_BODY_HTML_SOURCE_DEFINITIONS,
  DANISH_SHOPIFY_BLOG_SOURCE_DEFINITIONS,
  DANISH_EMBEDDED_JSON_SOURCE_DEFINITIONS,
  DANISH_HTML_RECIPE_SOURCE_DEFINITIONS,
} from "./custom-danish-sources.js";
import { MEYERS_SANITY_URL } from "../custom/meyers.js";

export const MIGRATION_STATES = [
  "not_started",
  "configured",
  "canary_passed",
  "shadow_passed",
  "cutover",
  "blocked",
  "deferred",
] as const;

export type MigrationState = (typeof MIGRATION_STATES)[number];
export type DiscoveryMode = "sitemap" | "listing";
export type FetchMode = "cheerio" | "playwright";

export interface ListingDiscoveryStrategy {
  recipeLinkSelectors: string[];
  skipPathFragments: string[];
  continuationSelectors: string[];
  continuationUrlPatterns: string[];
  /** Prefer depth-first traversal for deeply nested listing hierarchies. */
  continuationForefront?: boolean;
  /** Process discovered recipes before exploring more listing branches. */
  recipeForefront?: boolean;
  /**
   * Hosts that serve this source's listing route without serving its recipes.
   * They are admitted for listing and continuation requests only; recipes and
   * canonical URLs stay bound to `allowedDomains`.
   */
  listingHosts?: string[];
  payload?: {
    kind: "json-paths";
    expectedRoot: "object" | "array";
    recipePaths: string[];
    continuationPaths?: string[];
    /**
     * Offset pagination for services that expose no continuation URL. Paging
     * stops on a short page; a full page at `maxOffset` means the service
     * result window truncated discovery.
     */
    continuationOffset?: {
      parameter: string;
      step: number;
      maxOffset: number;
    };
    /**
     * Document a paginated service serves once the window is past its last
     * page. Reaching it ends discovery cleanly rather than reporting the
     * error document as an unexpected shape. WordPress localises its
     * `message`, so the signal has to be the stable `code`.
     */
    terminalPayload?: {
      path: string;
      equals: string;
    };
  };
}

export interface SitemapDiscoveryStrategy {
  followPatterns: string[];
  skipUrlFragments: string[];
}

export interface DanishJsonLdSource {
  id: string;
  domain: string;
  allowedDomains: string[];
  legacySpider: string;
  legacyFamily:
    | "JsonLdSitemapRecipeSpider"
    | "JsonLdListingSpider"
    | "WpPostsJsonLdSpider"
    | "WprmApiSpider"
    | "CustomSitemapSpider"
    | "CustomListingSpider"
    | "EmbeddedJsonSitemapSpider"
    | "HtmlMicrodataSitemapSpider"
    | "SanityRecipeApiSpider"
    | "CustomWprmApiSpider"
    | "DirectRecipeApiSpider"
    | "HtmlRecipeSitemapSpider";
  discovery: DiscoveryMode;
  sitemapUrls: string[];
  startUrls: string[];
  recipeUrlPatterns: string[];
  canonicalFollowStatuses?: number[];
  /** A legacy command name that resolves to one canonical source execution. */
  aliasFor?: string;
  listingDiscovery?: ListingDiscoveryStrategy;
  sitemapDiscovery?: SitemapDiscoveryStrategy;
  fetchMode: FetchMode;
  /** Disable Crawlee's browser-like HTTP headers for JSON APIs that gate browsers. */
  disableHeaderGenerator?: true;
  /** Match legacy spiders that persisted only the first integer from recipeYield. */
  numericYieldOnly?: true;
  requestSettings: {
    delaySeconds: number;
    rateLimitPerMinute: number | null;
    maxConcurrency: number;
    maxRetries: number;
  };
  requireCompleteJsonLd: true;
  recipeExtractor?:
    | "strict-json-ld"
    | "wprm-api"
    | "shopify-blog-html"
    | "femina-html"
    | "gocook-jsonld-html"
    | "alt-html"
    | "discount365-html"
    | "dr-graphql"
    | "hellofresh-api"
    | "madforfattigroeve-nextjs"
    | "meny-api"
    | "nemlig-sitecore"
    | "spisbedre-inertia"
    | "dkkogebogen-microdata"
    | "nipunijulie-body-html"
    | "thefoodclub-body-html"
    | "webopskrifter-microdata"
    | "gigtforeningen-wp-html";
  migrationState: MigrationState;
  latestScrapyOutcome:
    | "not_audited"
    | "succeeded"
    | "partial"
    | "blocked"
    | "no_data"
    | "failed";
  deferOrBlockReason?: string;
  latestCanary?: string;
  shadowParity?: string;
  cutoverDate?: string;
}

/**
 * Read-only migration inventory generated from legacy spider class attributes.
 * It deliberately does not reuse `SEEDS`: those pre-phase seeds are unverified.
 */
const RAW_DANISH_JSONLD_SOURCES: DanishJsonLdSource[] = [
  {
    "id": "amo",
    "domain": "amo.dk",
    "allowedDomains": [
      "amo.dk",
      "www.amo.dk"
    ],
    "legacySpider": "AmoSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.amo.dk/opskrifter/"
    ],
    "recipeUrlPatterns": [
      "^/opskrifter/[a-z0-9æøåé-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "aperol",
    "domain": "aperol.com",
    "allowedDomains": [
      "aperol.com",
      "www.aperol.com"
    ],
    "legacySpider": "AperolSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.aperol.com/da-dk/page-sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.aperol\\.com/da-dk/aperol-spritz-cocktail/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "arla",
    "domain": "arla.dk",
    "allowedDomains": [
      "arla.dk",
      "www.arla.dk"
    ],
    "legacySpider": "ArlaSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.arla.dk/sitemap.xml?type=Modules.Recipes.Business.SitemapUrlWriter.RecipeSitemapUrlWriter"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "arla\\.dk/opskrifter/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "configured",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "aurion",
    "domain": "aurion.dk",
    "allowedDomains": [
      "aurion.dk",
      "www.aurion.dk"
    ],
    "legacySpider": "AurionSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.aurion.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.aurion\\.dk/opskrifter/(?:baelgfrugter|brod-boller|food-service|glutenfri|kager-desserter|mad-med-korn)/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bareencocktail",
    "domain": "bareencocktail.dk",
    "allowedDomains": [
      "bareencocktail.dk",
      "www.bareencocktail.dk"
    ],
    "legacySpider": "BareEnCocktailSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://bareencocktail.dk/opskrifter/cocktails/"
    ],
    "recipeUrlPatterns": [
      "^/opskrifter/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "playwright",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "beauvais",
    "domain": "beauvais.dk",
    "allowedDomains": [
      "beauvais.dk",
      "www.beauvais.dk"
    ],
    "legacySpider": "BeauvaisSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.beauvais.dk/opskrifter-sitemap.xml",
      "https://www.beauvais.dk/recipes-sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.beauvais\\.dk/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "becel",
    "domain": "becel.com",
    "allowedDomains": [
      "becel.com",
      "www.becel.com"
    ],
    "legacySpider": "BecelSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.becel.com/da-dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.becel\\.com/da-dk/recipes/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bedstedrinks",
    "domain": "bedstedrinks.dk",
    "allowedDomains": [
      "bedstedrinks.dk",
      "www.bedstedrinks.dk"
    ],
    "legacySpider": "BedsteDrinksSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://bedstedrinks.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://bedstedrinks\\.dk/opskrift/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "blenderopskrifter",
    "domain": "blenderopskrifter.dk",
    "allowedDomains": [
      "blenderopskrifter.dk",
      "www.blenderopskrifter.dk"
    ],
    "legacySpider": "BlenderopskrifterSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://blenderopskrifter.dk/opskrifter"
    ],
    "recipeUrlPatterns": [
      "^/opskrift/[a-z0-9æøåé-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bobedre",
    "domain": "bobedre.dk",
    "allowedDomains": [
      "bobedre.dk"
    ],
    "legacySpider": "BobedreSPider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://bobedre.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "bobedre\\.dk/opskrifter/.+"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bodylab",
    "domain": "bodylab.dk",
    "allowedDomains": [
      "bodylab.dk",
      "www.bodylab.dk"
    ],
    "legacySpider": "BodylabSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bodylab.dk/opskrifter"
    ],
    "recipeUrlPatterns": [
      "^/opskrifter/[a-z0-9æøåé-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bornemenuen",
    "domain": "bornemenuen.kk.dk",
    "allowedDomains": [
      "bornemenuen.kk.dk"
    ],
    "legacySpider": "BornemenuenSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://bornemenuen.kk.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://bornemenuen\\.kk\\.dk/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bornholms",
    "domain": "bornholms.dk",
    "allowedDomains": [
      "bornholms.dk",
      "www.bornholms.dk"
    ],
    "legacySpider": "BornholmsSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://bornholms.dk/opskriftsamling/"
    ],
    "recipeUrlPatterns": [
      "^/opskrifter/[a-z0-9æøåé-]+/?$"
    ],
    "fetchMode": "playwright",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "campari",
    "domain": "campari.com",
    "allowedDomains": [
      "campari.com",
      "www.campari.com"
    ],
    "legacySpider": "CampariSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.campari.com/da-dk/page-sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.campari\\.com/da-dk/vores-cocktails/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "castello",
    "domain": "castellocheese.com",
    "allowedDomains": [
      "castellocheese.com",
      "www.castellocheese.com"
    ],
    "legacySpider": "CastelloSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.castellocheese.com/recipessitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.castellocheese\\.com/da/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "christinaskoekken",
    "domain": "christinaskoekken.dk",
    "allowedDomains": [
      "christinaskoekken.dk"
    ],
    "legacySpider": "ChristinaskoekkenSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://christinaskoekken.dk/post-sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "christinaskoekken\\.dk/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cocktaily",
    "domain": "cocktaily.dk",
    "allowedDomains": [
      "cocktaily.dk",
      "www.cocktaily.dk"
    ],
    "legacySpider": "CocktailySpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.cocktaily.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.cocktaily\\.dk/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "coop",
    "domain": "opskrifter.coop.dk",
    "allowedDomains": [
      "opskrifter.coop.dk"
    ],
    "legacySpider": "CoopSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://opskrifter.coop.dk/sitemap"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "opskrifter\\.coop\\.dk/opskrifter/[^/?#]+-\\d+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 3,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "copenhagendistillery_da",
    "domain": "da.copenhagendistillery.com",
    "allowedDomains": [
      "da.copenhagendistillery.com"
    ],
    "legacySpider": "CopenhagenDistilleryDaSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://da.copenhagendistillery.com/recipes"
    ],
    "recipeUrlPatterns": [
      "^/cocktails/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "danishcrown",
    "domain": "danishcrown.com",
    "allowedDomains": [
      "danishcrown.com",
      "www.danishcrown.com"
    ],
    "legacySpider": "DanishCrownSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.danishcrown.com/da-dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/da-dk/opskrifter/[^/]+/?$",
      "/da-dk/vores-brands/friland/opskrifter/[^/]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "diabetesopskrifter",
    "domain": "diabetesopskrifter.dk",
    "allowedDomains": [
      "diabetesopskrifter.dk",
      "www.diabetesopskrifter.dk"
    ],
    "legacySpider": "DiabetesopskrifterSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://diabetesopskrifter.dk/opskrifter"
    ],
    "recipeUrlPatterns": [
      "^/opskrift/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "evatrio",
    "domain": "evatrio.com",
    "allowedDomains": [
      "evatrio.com",
      "www.evatrio.com"
    ],
    "legacySpider": "EvaTrioSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.evatrio.com/da/opskrifter/forretter-og-snacks",
      "https://www.evatrio.com/da/opskrifter/hovedretter",
      "https://www.evatrio.com/da/opskrifter/kager-og-desserter",
      "https://www.evatrio.com/da/opskrifter/drinks"
    ],
    "recipeUrlPatterns": [
      "^/da/opskrifter/(?:forretter-og-snacks|hovedretter|kager-og-desserter|drinks)/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "familiejournal",
    "domain": "familiejournal.dk",
    "allowedDomains": [
      "familiejournal.dk",
      "www.familiejournal.dk"
    ],
    "legacySpider": "FamilieJournalSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.familiejournal.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.familiejournal\\.dk/opskrifter/(?!(?:dessert-kage|drikkevarer|forretter-tilbehoer|hjemmebag|hovedretter|morgenmad-brunch)/?$)(?:(?:dessert-kage|drikkevarer|forretter-tilbehoer|hjemmebag|hovedretter|morgenmad-brunch)/)?[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "ferrerorocher",
    "domain": "ferrerorocher.com",
    "allowedDomains": [
      "ferrerorocher.com",
      "www.ferrerorocher.com"
    ],
    "legacySpider": "FerreroRocherSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [],
    "recipeUrlPatterns": [],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "fevertree",
    "domain": "fever-tree.com",
    "allowedDomains": [
      "fever-tree.com",
      "www.fever-tree.com"
    ],
    "legacySpider": "FeverTreeSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://fever-tree.com/sitemaps/da-dk-sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://fever-tree\\.com/da-dk/cocktails/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "foodnotes",
    "domain": "foodnotes.dk",
    "allowedDomains": [
      "foodnotes.dk",
      "www.foodnotes.dk"
    ],
    "legacySpider": "FoodnotesSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://foodnotes.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://foodnotes\\.dk/recipes/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "frederikkewaerens",
    "domain": "frederikkewaerens.dk",
    "allowedDomains": [
      "frederikkewaerens.dk"
    ],
    "legacySpider": "FrederikkewaerensSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://frederikkewaerens.dk/post-sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "frederikkewaerens\\.dk/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "friluftslageret",
    "domain": "friluftslageret.dk",
    "allowedDomains": [
      "friluftslageret.dk",
      "www.friluftslageret.dk"
    ],
    "legacySpider": "FriluftslageretSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://friluftslageret.dk/opskrifter"
    ],
    "recipeUrlPatterns": [
      "^/opskrifter/[a-z0-9æøåé-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "frokenkraesen_com",
    "domain": "frokenkraesen.com",
    "allowedDomains": [
      "frokenkraesen.com",
      "www.frokenkraesen.com"
    ],
    "legacySpider": "FrokenkraesenComSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.frokenkraesen.com/opskrifter"
    ],
    "recipeUrlPatterns": [],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "gamleopskrifter",
    "domain": "gamleopskrifter.com",
    "allowedDomains": [
      "gamleopskrifter.com",
      "www.gamleopskrifter.com"
    ],
    "legacySpider": "GamleOpskrifterSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://gamleopskrifter.com/opskrifter/alle-opskrifter"
    ],
    "recipeUrlPatterns": [
      "^/opskrift/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "gastrologik",
    "domain": "gastrologik.dk",
    "allowedDomains": [
      "gastrologik.dk",
      "www.gastrologik.dk"
    ],
    "legacySpider": "GastrologikSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.gastrologik.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.gastrologik\\.dk/(?!404/?$|alle-opskrifter/?$|alle-opslag/?$|blog/?$|indeks/?$|ingredienser/?$|kontakt/?$|om/?$|opskrifter/?$|soeg/?$)[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "gastrotools",
    "domain": "gastrotools.dk",
    "allowedDomains": [
      "gastrotools.dk",
      "www.gastrotools.dk"
    ],
    "legacySpider": "GastrotoolsSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.gastrotools.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/blogs/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "gigtforeningen",
    "domain": "gigtforeningen.dk",
    "allowedDomains": [
      "gigtforeningen.dk",
      "www.gigtforeningen.dk"
    ],
    "legacySpider": "GigtforeningenSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.gigtforeningen.dk/sitemap_index.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.gigtforeningen\\.dk/hverdagen/kost/madopskrifter/(?:fisk-og-fjerkrae|vegetar|snacks-og-soedt)/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "glutenfrimagi",
    "domain": "glutenfrimagi.dk",
    "allowedDomains": [
      "glutenfrimagi.dk",
      "www.glutenfrimagi.dk"
    ],
    "legacySpider": "GlutenfriMagiSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://glutenfrimagi.dk/opskrifter"
    ],
    "recipeUrlPatterns": [
      "^/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "playwright",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "glyngoere",
    "domain": "glyngoere.dk",
    "allowedDomains": [
      "glyngoere.dk",
      "www.glyngoere.dk"
    ],
    "legacySpider": "GlyngoereSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.glyngoere.dk/recipes/"
    ],
    "recipeUrlPatterns": [
      "^/recipes/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "playwright",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "hannerobinson",
    "domain": "hannerobinson.dk",
    "allowedDomains": [
      "hannerobinson.dk",
      "www.hannerobinson.dk"
    ],
    "legacySpider": "HanneRobinsonSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.hannerobinson.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.hannerobinson\\.dk/opskrifter-2/(?:\\d{4}/\\d{1,2}/\\d{1,2}/)?[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "heidiogper",
    "domain": "heidiogper.dk",
    "allowedDomains": [
      "heidiogper.dk",
      "www.heidiogper.dk"
    ],
    "legacySpider": "HeidiOgPerSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "http://www.heidiogper.dk/opskrifter/Forside"
    ],
    "recipeUrlPatterns": [
      "^/opskrifter/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "heinz",
    "domain": "heinz.com",
    "allowedDomains": [
      "heinz.com",
      "www.heinz.com"
    ],
    "legacySpider": "HeinzSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.heinz.com/sitemap-recipes.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.heinz\\.com/da-DK/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "hverdagskoekken",
    "domain": "hverdagskoekken.dk",
    "allowedDomains": [
      "hverdagskoekken.dk",
      "www.hverdagskoekken.dk"
    ],
    "legacySpider": "HverdagskoekkenSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://hverdagskoekken.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://hverdagskoekken\\.dk/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "iform",
    "domain": "iform.dk",
    "allowedDomains": [
      "iform.dk"
    ],
    "legacySpider": "IformSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://iform.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "iform\\.dk/sunde-opskrifter/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "imerco",
    "domain": "imerco.dk",
    "allowedDomains": [
      "imerco.dk",
      "www.imerco.dk"
    ],
    "legacySpider": "ImercoSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.imerco.dk/sitemap/content"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.imerco\\.dk/inspiration/opskrifter/[^/?#]+/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "ingridhornshoj",
    "domain": "ingridhornshoj.dk",
    "allowedDomains": [
      "ingridhornshoj.dk",
      "www.ingridhornshoj.dk"
    ],
    "legacySpider": "IngridHornshojSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://ingridhornshoj.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "ingridhornshoj\\.dk/opskrift/[a-z0-9æøåé-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "jonsmadklub",
    "domain": "jonsmadklub.dk",
    "allowedDomains": [
      "jonsmadklub.dk",
      "www.jonsmadklub.dk"
    ],
    "legacySpider": "JonsMadklubSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://jonsmadklub.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/blogs/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "kenwoodworld",
    "domain": "kenwoodworld.com",
    "allowedDomains": [
      "kenwoodworld.com",
      "www.kenwoodworld.com"
    ],
    "legacySpider": "KenwoodWorldSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.kenwoodworld.com/da-dk/r/recipes"
    ],
    "recipeUrlPatterns": [
      "^/da-dk/r/recipes/[^/]+/blt[a-z0-9]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "ketomums",
    "domain": "ketomums.dk",
    "allowedDomains": [
      "ketomums.dk",
      "www.ketomums.dk"
    ],
    "legacySpider": "KetomumsSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://ketomums.dk/keto-opskrifter"
    ],
    "recipeUrlPatterns": [
      "^/keto-[a-z0-9æøå-]+/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "kikkoman",
    "domain": "kikkoman.dk",
    "allowedDomains": [
      "kikkoman.dk",
      "www.kikkoman.dk"
    ],
    "legacySpider": "KikkomanSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.kikkoman.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.kikkoman\\.dk/opskrifter/detail/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "kitchenaid",
    "domain": "kitchenaid.dk",
    "allowedDomains": [
      "kitchenaid.dk",
      "www.kitchenaid.dk"
    ],
    "legacySpider": "KitchenAidSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.kitchenaid.dk/opskrifter/alle"
    ],
    "recipeUrlPatterns": [
      "^/opskrifter/(?!alle(?:/|$))[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "klank",
    "domain": "klank.dk",
    "allowedDomains": [
      "klank.dk",
      "www.klank.dk"
    ],
    "legacySpider": "KlankSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://klank.dk/index.php/opskrifter-koekken/"
    ],
    "recipeUrlPatterns": [
      "^/index\\.php/opskrifter/[a-z0-9æøåé-]+/?$"
    ],
    "fetchMode": "playwright",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "klinksgaard",
    "domain": "klinksgaard.dk",
    "allowedDomains": [
      "klinksgaard.dk",
      "www.klinksgaard.dk"
    ],
    "legacySpider": "KlinksgaardSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://klinksgaard.dk/wp-sitemap-posts-page-1.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://klinksgaard\\.dk/(?:weber-grill|bageopskrifter|lette-retter|aftensmad|saucer|salater|tilbehor|pandekager|sund-mad|chokoladekage|flaeskesteg|fastelavnsboller|kage|desserter|opskrifter|paaske|forretter)(?:/[^/?#]+){0,3}/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "knaehoejkarse",
    "domain": "knaehoejkarse.dk",
    "allowedDomains": [
      "knaehoejkarse.dk",
      "www.knaehoejkarse.dk"
    ],
    "legacySpider": "KnaehoejKarseSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "http://knaehoejkarse.dk/alle-opskrifter/"
    ],
    "recipeUrlPatterns": [
      "^/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "playwright",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "kokke",
    "domain": "kokke.dk",
    "allowedDomains": [
      "kokke.dk",
      "www.kokke.dk"
    ],
    "legacySpider": "KokkeSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.kokke.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.kokke\\.dk/opskrifter/(?!kategori(?:/|$)|koekken(?:/|$)|protein(?:/|$)|saeson(?:/|$)|tema(?:/|$)|tag(?:/|$))[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "kornkammeret",
    "domain": "kornkammeret.dk",
    "allowedDomains": [
      "kornkammeret.dk",
      "www.kornkammeret.dk"
    ],
    "legacySpider": "KornkammeretSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.kornkammeret.dk/Sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.kornkammeret\\.dk/opskrifter/(?:bagning|mad|morgenmad)/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "kystfisken",
    "domain": "kystfisken.dk",
    "allowedDomains": [
      "kystfisken.dk",
      "www.kystfisken.dk"
    ],
    "legacySpider": "KystfiskenSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://kystfisken.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://kystfisken\\.dk/blogs/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "lurpak",
    "domain": "lurpak.com",
    "allowedDomains": [
      "lurpak.com",
      "www.lurpak.com"
    ],
    "legacySpider": "LurpakSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.lurpak.com/recipessitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.lurpak\\.com/da/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "madenimitliv",
    "domain": "madenimitliv.dk",
    "allowedDomains": [
      "madenimitliv.dk",
      "www.madenimitliv.dk"
    ],
    "legacySpider": "MadenimitlivSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://madenimitliv.dk/opskrifter"
    ],
    "recipeUrlPatterns": [],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "madfolket",
    "domain": "madfolket.dk",
    "allowedDomains": [
      "madfolket.dk",
      "www.madfolket.dk"
    ],
    "legacySpider": "MadfolketSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://madfolket.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://madfolket\\.dk/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "madformadelskere",
    "domain": "madformadelskere.dk",
    "allowedDomains": [
      "madformadelskere.dk",
      "www.madformadelskere.dk"
    ],
    "legacySpider": "MadformadelskereSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.madformadelskere.dk/"
    ],
    "recipeUrlPatterns": [],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "madogdrikke",
    "domain": "mad-og-drikke.dk",
    "allowedDomains": [
      "mad-og-drikke.dk",
      "www.mad-og-drikke.dk"
    ],
    "legacySpider": "MadOgDrikkeSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://mad-og-drikke.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/opskrift/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "madoghave",
    "domain": "madoghave.dk",
    "allowedDomains": [
      "madoghave.dk",
      "www.madoghave.dk"
    ],
    "legacySpider": "MadOgHaveSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://madoghave.dk/opskrifter/"
    ],
    "recipeUrlPatterns": [
      "^/recipe-items/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "madrejsen",
    "domain": "madrejsen.dk",
    "allowedDomains": [
      "madrejsen.dk",
      "www.madrejsen.dk"
    ],
    "legacySpider": "MadRejsenSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://madrejsen.dk/sous-vide/",
      "https://madrejsen.dk/morgenmad/",
      "https://madrejsen.dk/frokost/",
      "https://madrejsen.dk/aftensmad/",
      "https://madrejsen.dk/tilbehor/"
    ],
    "recipeUrlPatterns": [
      "^/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "playwright",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "madsvin",
    "domain": "madsvin.com",
    "allowedDomains": [
      "madsvin.com"
    ],
    "legacySpider": "MadsvinSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://madsvin.com/post-sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "madsvin\\.com/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 3,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "maduniverset",
    "domain": "maduniverset.dk",
    "allowedDomains": [
      "maduniverset.dk",
      "www.maduniverset.dk"
    ],
    "legacySpider": "MaduniversetSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.maduniverset.dk/sitemapindex.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/opskrift/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "mambeno",
    "domain": "mambeno.dk",
    "allowedDomains": [
      "mambeno.dk",
      "www.mambeno.dk"
    ],
    "legacySpider": "MambenoSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://mambeno.dk/sitemap_index.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "mambeno\\.dk/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "mariavestergaard",
    "domain": "mariavestergaard.dk",
    "allowedDomains": [
      "mariavestergaard.dk"
    ],
    "legacySpider": "MariavestergaardSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://mariavestergaard.dk/post-sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "mariavestergaard\\.dk/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 3,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "micadeli",
    "domain": "micadeli.dk",
    "allowedDomains": [
      "micadeli.dk",
      "www.micadeli.dk"
    ],
    "legacySpider": "MicadeliSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://micadeli.dk/sitemap_index.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://micadeli\\.dk/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "mutti",
    "domain": "mutti-parma.com",
    "allowedDomains": [
      "mutti-parma.com",
      "www.mutti-parma.com"
    ],
    "legacySpider": "MuttiSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://mutti-parma.com/dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://mutti-parma\\.com/dk/tomatopskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "nescafe",
    "domain": "nescafe.com",
    "allowedDomains": [
      "nescafe.com",
      "www.nescafe.com"
    ],
    "legacySpider": "NescafeSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.nescafe.com/dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.nescafe\\.com/dk/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "netto",
    "domain": "netto.dk",
    "allowedDomains": [
      "netto.dk"
    ],
    "legacySpider": "NettoSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://netto.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "netto\\.dk/opskrifter/[a-z0-9æøå-]+"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "nogetiovnen",
    "domain": "nogetiovnen.dk",
    "allowedDomains": [
      "nogetiovnen.dk"
    ],
    "legacySpider": "NogetiovnenSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://nogetiovnen.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "nogetiovnen\\.dk/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 3,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "nordmad",
    "domain": "nordmad.dk",
    "allowedDomains": [
      "nordmad.dk",
      "www.nordmad.dk"
    ],
    "legacySpider": "NordmadSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.nordmad.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.nordmad\\.dk/recipes/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "nutella",
    "domain": "nutella.com",
    "allowedDomains": [
      "nutella.com",
      "www.nutella.com"
    ],
    "legacySpider": "NutellaSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.nutella.com/se/da/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.nutella\\.com/se/da/(?:bliv-inspireret/opskrifter/.+|get-inspired/recipes/.+|inspiration/recipes/.+|opskrifter/.+)$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "oatly",
    "domain": "oatly.com",
    "allowedDomains": [
      "oatly.com",
      "www.oatly.com"
    ],
    "legacySpider": "OatlySpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.oatly.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://(?:www\\.)?oatly\\.com/da-dk/recipes/[^?#]+$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "odensemarcipan",
    "domain": "odense-marcipan.dk",
    "allowedDomains": [
      "odense-marcipan.dk",
      "www.odense-marcipan.dk"
    ],
    "legacySpider": "OdenseMarcipanSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.odense-marcipan.dk/sitemap"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "odense-marcipan\\.dk/opskrift/[a-z0-9æøåé-]+/[a-z0-9æøåé-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "oetker",
    "domain": "oetker.dk",
    "allowedDomains": [
      "oetker.dk",
      "www.oetker.dk"
    ],
    "legacySpider": "OetkerSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.oetker.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.oetker\\.dk/opskrifter/r/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "opskrifterdk",
    "domain": "opskrifter.dk",
    "allowedDomains": [
      "opskrifter.dk",
      "www.opskrifter.dk"
    ],
    "legacySpider": "OpskrifterDkSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.opskrifter.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.opskrifter\\.dk/opskrift/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "parcelhuslykke",
    "domain": "parcelhuslykke.dk",
    "allowedDomains": [
      "parcelhuslykke.dk",
      "www.parcelhuslykke.dk"
    ],
    "legacySpider": "ParcelhuslykkeSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.parcelhuslykke.dk/wp-sitemap-posts-recipe-1.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.parcelhuslykke\\.dk/recipe/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "planetariskkogebog",
    "domain": "planetariskkogebog.dk",
    "allowedDomains": [
      "planetariskkogebog.dk",
      "www.planetariskkogebog.dk"
    ],
    "legacySpider": "PlanetariskKogebogSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://planetariskkogebog.dk/opskrifter"
    ],
    "recipeUrlPatterns": [
      "^/opskrift/[a-z0-9æøåé-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "plantepusherne",
    "domain": "plantepusherne.dk",
    "allowedDomains": [
      "plantepusherne.dk",
      "www.plantepusherne.dk"
    ],
    "legacySpider": "PlantepusherneSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://plantepusherne.dk/"
    ],
    "recipeUrlPatterns": [],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "puredansk",
    "domain": "puredansk.dk",
    "allowedDomains": [
      "puredansk.dk",
      "www.puredansk.dk"
    ],
    "legacySpider": "PureDanskSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://puredansk.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://puredansk\\.dk/blogs/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "recipesairfryer_dk",
    "domain": "recipes-airfryer.com",
    "allowedDomains": [
      "recipes-airfryer.com",
      "www.recipes-airfryer.com"
    ],
    "legacySpider": "RecipesAirfryerDkSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://recipes-airfryer.com/da/opskrifter/"
    ],
    "recipeUrlPatterns": [
      "^/da/(?!opskrifter(?:/|$))[^/]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "rema1000",
    "domain": "madogdrikke.rema1000.dk",
    "allowedDomains": [
      "madogdrikke.rema1000.dk"
    ],
    "legacySpider": "Rema1000Spider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://madogdrikke.rema1000.dk/opskrifter/alle"
    ],
    "recipeUrlPatterns": [
      "^/opskrifter/(?!alle(?:/|$)|temaer(?:/|$)|opskrifter(?:/|$))[a-z0-9-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "revivafit",
    "domain": "revivafit.dk",
    "allowedDomains": [
      "revivafit.dk",
      "www.revivafit.dk"
    ],
    "legacySpider": "RevivaFitSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.revivafit.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.revivafit\\.dk/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "rosekylling",
    "domain": "rosekylling.dk",
    "allowedDomains": [
      "rosekylling.dk",
      "www.rosekylling.dk"
    ],
    "legacySpider": "RoseKyllingSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.rosekylling.dk/sitemapindex.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.rosekylling\\.dk/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "santamariaworld",
    "domain": "santamariaworld.com",
    "allowedDomains": [
      "santamariaworld.com",
      "www.santamariaworld.com"
    ],
    "legacySpider": "SantaMariaWorldSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.santamariaworld.com/Sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.santamariaworld\\.com/dk/opskrifter/[^?#]+$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "schulstad",
    "domain": "schulstad.dk",
    "allowedDomains": [
      "schulstad.dk",
      "www.schulstad.dk"
    ],
    "legacySpider": "SchulstadSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.schulstad.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.schulstad\\.dk/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "semper",
    "domain": "semper.dk",
    "allowedDomains": [
      "semper.dk",
      "www.semper.dk"
    ],
    "legacySpider": "SemperSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.semper.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.semper\\.dk/opskrifter-pa-babymad/[^/?#]+/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "skalvibage",
    "domain": "skalvibage.dk",
    "allowedDomains": [
      "skalvibage.dk",
      "www.skalvibage.dk"
    ],
    "legacySpider": "SkalViBageSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://skalvibage.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://skalvibage\\.dk/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "skolemaelk",
    "domain": "skolemaelk.dk",
    "allowedDomains": [
      "skolemaelk.dk",
      "www.skolemaelk.dk"
    ],
    "legacySpider": "SkolemaelkSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.skolemaelk.dk/sitemap"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.skolemaelk\\.dk/madpakker-og-opskrifter/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "slagterlampe",
    "domain": "slagterlampe.dk",
    "allowedDomains": [
      "slagterlampe.dk",
      "www.slagterlampe.dk"
    ],
    "legacySpider": "SlagterLampeSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://slagterlampe.dk/sitemap_index.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/opskrifter/[^/?#]+/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "spicytwist",
    "domain": "spicytwist.dk",
    "allowedDomains": [
      "spicytwist.dk",
      "www.spicytwist.dk"
    ],
    "legacySpider": "SpicyTwistSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://spicytwist.dk/"
    ],
    "recipeUrlPatterns": [
      "^/opskrift/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "playwright",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "spisekunst",
    "domain": "spisekunst.dk",
    "allowedDomains": [
      "spisekunst.dk",
      "www.spisekunst.dk"
    ],
    "legacySpider": "SpisekunstSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.spisekunst.dk/recipes"
    ],
    "recipeUrlPatterns": [
      "^/recipes/[^/?#]+/?$"
    ],
    "fetchMode": "playwright",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "starbucksathome",
    "domain": "starbucksathome.com",
    "allowedDomains": [
      "starbucksathome.com",
      "www.starbucksathome.com"
    ],
    "legacySpider": "StarbucksAtHomeSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.starbucksathome.com/dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.starbucksathome\\.com/dk/opskrifter/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "stinna",
    "domain": "stinna.dk",
    "allowedDomains": [
      "stinna.dk",
      "www.stinna.dk"
    ],
    "legacySpider": "StinnaSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://stinna.dk/opskrifter"
    ],
    "recipeUrlPatterns": [],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "sundpaabudget",
    "domain": "sundpaabudget.dk",
    "allowedDomains": [
      "sundpaabudget.dk",
      "www.sundpaabudget.dk"
    ],
    "legacySpider": "SundpaabudgetSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://sundpaabudget.dk/post-sitemap.xml",
      "https://sundpaabudget.dk/post-sitemap2.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "sundpaabudget\\.dk/.+"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "surdejsentusiasten",
    "domain": "surdejsentusiasten.dk",
    "allowedDomains": [
      "surdejsentusiasten.dk",
      "www.surdejsentusiasten.dk"
    ],
    "legacySpider": "SurdejsentusiastenSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://surdejsentusiasten.dk/"
    ],
    "recipeUrlPatterns": [
      "^/index\\.php/\\d{4}/\\d{2}/\\d{2}/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "playwright",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "sydhavnsbloggen",
    "domain": "sydhavnsbloggen.dk",
    "allowedDomains": [
      "sydhavnsbloggen.dk",
      "www.sydhavnsbloggen.dk"
    ],
    "legacySpider": "SydhavnsbloggenSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://sydhavnsbloggen.dk/opskrifter"
    ],
    "recipeUrlPatterns": [],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "tv2mad",
    "domain": "livsstil.tv2.dk",
    "allowedDomains": [
      "livsstil.tv2.dk"
    ],
    "legacySpider": "Tv2MadSpider",
    "legacyFamily": "JsonLdListingSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://livsstil.tv2.dk/mad/opskrifter"
    ],
    "recipeUrlPatterns": [
      "^/mad/opskrift/[a-z0-9æøå-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "udeoghjemme",
    "domain": "udeoghjemme.dk",
    "allowedDomains": [
      "udeoghjemme.dk",
      "www.udeoghjemme.dk"
    ],
    "legacySpider": "UdeOgHjemmeSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.udeoghjemme.dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.udeoghjemme\\.dk/opskrifter/(?!(?:bagvaerk|fisk|fjerkrae|kage-dessert|koed|slankeopskrifter|stop-madspild|taerter|vegetar)/?$)(?:[^/?#]+/){0,2}[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "violife",
    "domain": "violife.com",
    "allowedDomains": [
      "violife.com",
      "www.violife.com"
    ],
    "legacySpider": "ViolifeSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.violife.com/da-dk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "^https://www\\.violife\\.com/da-dk/recipe/[^/?#]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 1,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "allrecipes",
    "domain": "allrecipes.com",
    "allowedDomains": [
      "allrecipes.com",
      "www.allrecipes.com"
    ],
    "legacySpider": "AllRecipesSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.allrecipes.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipe/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "avocadosfrommexico",
    "domain": "avocadosfrommexico.com",
    "allowedDomains": [
      "avocadosfrommexico.com",
      "www.avocadosfrommexico.com"
    ],
    "legacySpider": "AvocadosfrommexicoSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.avocadosfrommexico.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipe/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bbcgoodfood",
    "domain": "bbcgoodfood.com",
    "allowedDomains": [
      "bbcgoodfood.com",
      "www.bbcgoodfood.com"
    ],
    "legacySpider": "BBCGoodFoodSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.bbcgoodfood.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bertolli",
    "domain": "bertolli.com",
    "allowedDomains": [
      "bertolli.com",
      "www.bertolli.com"
    ],
    "legacySpider": "BertolliSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://bertolli.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bettycrocker",
    "domain": "bettycrocker.com",
    "allowedDomains": [
      "bettycrocker.com",
      "www.bettycrocker.com"
    ],
    "legacySpider": "BettycrockerSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.bettycrocker.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bobsredmill",
    "domain": "bobsredmill.com",
    "allowedDomains": [
      "bobsredmill.com",
      "www.bobsredmill.com"
    ],
    "legacySpider": "BobsredmillSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.bobsredmill.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "canadianliving",
    "domain": "canadianliving.com",
    "allowedDomains": [
      "canadianliving.com",
      "www.canadianliving.com"
    ],
    "legacySpider": "CanadianLivingSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.canadianliving.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/food/recipe/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "chelsea_nz",
    "domain": "chelsea.co.nz",
    "allowedDomains": [
      "chelsea.co.nz",
      "www.chelsea.co.nz"
    ],
    "legacySpider": "ChelseaNzSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.chelsea.co.nz/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/browse-recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "delmonte",
    "domain": "delmonte.com",
    "allowedDomains": [
      "delmonte.com",
      "www.delmonte.com"
    ],
    "legacySpider": "DelmonteSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.delmonte.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "edmonds_nz",
    "domain": "edmondscooking.co.nz",
    "allowedDomains": [
      "edmondscooking.co.nz",
      "www.edmondscooking.co.nz"
    ],
    "legacySpider": "EdmondsNzSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.edmondscooking.co.nz/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "foodnetwork_uk",
    "domain": "foodnetwork.co.uk",
    "allowedDomains": [
      "foodnetwork.co.uk",
      "www.foodnetwork.co.uk"
    ],
    "legacySpider": "FoodnetworkUkSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://foodnetwork.co.uk/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "greatbritishchefs",
    "domain": "greatbritishchefs.com",
    "allowedDomains": [
      "greatbritishchefs.com",
      "www.greatbritishchefs.com"
    ],
    "legacySpider": "GreatBritishChefsSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.greatbritishchefs.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "jamieoliver",
    "domain": "jamieoliver.com",
    "allowedDomains": [
      "jamieoliver.com",
      "www.jamieoliver.com"
    ],
    "legacySpider": "JamieOliverSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.jamieoliver.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "landolakes",
    "domain": "landolakes.com",
    "allowedDomains": [
      "landolakes.com",
      "www.landolakes.com"
    ],
    "legacySpider": "LandolakesSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.landolakes.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipe/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "nordicfoodliving",
    "domain": "nordicfoodliving.com",
    "allowedDomains": [
      "nordicfoodliving.com"
    ],
    "legacySpider": "NordicFoodLivingSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://nordicfoodliving.com/post-sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "nordicfoodliving\\.com/[a-z0-9-]+/?$"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "olivemagazine",
    "domain": "olivemagazine.com",
    "allowedDomains": [
      "olivemagazine.com",
      "www.olivemagazine.com"
    ],
    "legacySpider": "OliveMagazineSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.olivemagazine.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "pillsbury",
    "domain": "pillsbury.com",
    "allowedDomains": [
      "pillsbury.com",
      "www.pillsbury.com"
    ],
    "legacySpider": "PillsburySpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.pillsbury.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "progresso",
    "domain": "progresso.com",
    "allowedDomains": [
      "progresso.com",
      "www.progresso.com"
    ],
    "legacySpider": "ProgressoSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.progresso.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "ricardocuisine",
    "domain": "ricardocuisine.com",
    "allowedDomains": [
      "ricardocuisine.com",
      "www.ricardocuisine.com"
    ],
    "legacySpider": "RicardoCuisineSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.ricardocuisine.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/en/recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "spam",
    "domain": "spam.com",
    "allowedDomains": [
      "spam.com",
      "www.spam.com"
    ],
    "legacySpider": "SpamSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.spam.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "sunset",
    "domain": "sunset.com",
    "allowedDomains": [
      "sunset.com",
      "www.sunset.com"
    ],
    "legacySpider": "SunsetSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://sunset.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipe/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "tasteofhome",
    "domain": "tasteofhome.com",
    "allowedDomains": [
      "tasteofhome.com",
      "www.tasteofhome.com"
    ],
    "legacySpider": "TasteofhomeSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.tasteofhome.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "tesco_recipes",
    "domain": "tesco.com",
    "allowedDomains": [
      "tesco.com",
      "realfood.tesco.com"
    ],
    "legacySpider": "TescoRecipesSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://realfood.tesco.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "tillamook",
    "domain": "tillamook.com",
    "allowedDomains": [
      "tillamook.com",
      "www.tillamook.com"
    ],
    "legacySpider": "TillamookSpider",
    "legacyFamily": "JsonLdSitemapRecipeSpider",
    "discovery": "sitemap",
    "sitemapUrls": [
      "https://www.tillamook.com/sitemap.xml"
    ],
    "startUrls": [],
    "recipeUrlPatterns": [
      "/recipes/"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 2,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
{
      "id": "abakershouse",
      "domain": "abakershouse.com",
      "allowedDomains": [
        "abakershouse.com",
        "www.abakershouse.com"
      ],
      "legacySpider": "AbakershouseSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.abakershouse.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "acouplecooks",
      "domain": "acouplecooks.com",
      "allowedDomains": [
        "acouplecooks.com",
        "www.acouplecooks.com"
      ],
      "legacySpider": "AcouplecooksSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.acouplecooks.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "afamilyfeast",
      "domain": "afamilyfeast.com",
      "allowedDomains": [
        "afamilyfeast.com",
        "www.afamilyfeast.com"
      ],
      "legacySpider": "AfamilyfeastSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.afamilyfeast.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "aggieskitchen",
      "domain": "aggieskitchen.com",
      "allowedDomains": [
        "aggieskitchen.com",
        "www.aggieskitchen.com"
      ],
      "legacySpider": "AggieskitchenSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.aggieskitchen.com/wp-json/wp/v2/posts?per_page=20&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "allergylicious",
      "domain": "allergylicious.com",
      "allowedDomains": [
        "allergylicious.com",
        "www.allergylicious.com"
      ],
      "legacySpider": "AllergyliciousSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.allergylicious.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "anicula",
      "domain": "anicula.dk",
      "allowedDomains": [
        "anicula.dk",
        "www.anicula.dk"
      ],
      "legacySpider": "AniculaSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://anicula.dk/wp-json/wp/v2/rpr/recipes?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "annsentitledlife",
      "domain": "annsentitledlife.com",
      "allowedDomains": [
        "annsentitledlife.com",
        "www.annsentitledlife.com"
      ],
      "legacySpider": "AnnsentitledlifeSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.annsentitledlife.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "artfuldishes",
      "domain": "artfuldishes.com",
      "allowedDomains": [
        "artfuldishes.com",
        "www.artfuldishes.com"
      ],
      "legacySpider": "ArtfuldishesSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.artfuldishes.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "asweetspoonful",
      "domain": "asweetspoonful.com",
      "allowedDomains": [
        "asweetspoonful.com",
        "www.asweetspoonful.com"
      ],
      "legacySpider": "AsweetspoonfulSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.asweetspoonful.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "babybite",
      "domain": "babybite.dk",
      "allowedDomains": [
        "babybite.dk",
        "www.babybite.dk"
      ],
      "legacySpider": "BabyBiteSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://babybite.dk/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "bakerella",
      "domain": "bakerella.com",
      "allowedDomains": [
        "bakerella.com",
        "www.bakerella.com"
      ],
      "legacySpider": "BakerellaSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.bakerella.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "basisvarer",
      "domain": "basisvarer.dk",
      "allowedDomains": [
        "basisvarer.dk",
        "www.basisvarer.dk"
      ],
      "legacySpider": "BasisvarerSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.basisvarer.dk/wp-json/wp/v2/cooked_recipe?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "bellalimento",
      "domain": "bellalimento.com",
      "allowedDomains": [
        "bellalimento.com",
        "www.bellalimento.com"
      ],
      "legacySpider": "BellalimentoSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.bellalimento.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "breadtopia",
      "domain": "breadtopia.com",
      "allowedDomains": [
        "breadtopia.com",
        "www.breadtopia.com"
      ],
      "legacySpider": "BreadtopiaSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.breadtopia.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "brownedbutterblondie",
      "domain": "brownedbutterblondie.com",
      "allowedDomains": [
        "brownedbutterblondie.com",
        "www.brownedbutterblondie.com",
      "athomebyheather.com",
      "www.athomebyheather.com"],
      "legacySpider": "BrownedbutterblondieSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.brownedbutterblondie.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "butternutbakeryblog",
      "domain": "butternutbakeryblog.com",
      "allowedDomains": [
        "butternutbakeryblog.com",
        "www.butternutbakeryblog.com"
      ],
      "legacySpider": "ButternutbakeryblogSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.butternutbakeryblog.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "carrotstick",
      "domain": "carrotstick.dk",
      "allowedDomains": [
        "carrotstick.dk",
        "www.carrotstick.dk"
      ],
      "legacySpider": "CarrotstickSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://carrotstick.dk/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "choosingchia",
      "domain": "choosingchia.com",
      "allowedDomains": [
        "choosingchia.com",
        "www.choosingchia.com"
      ],
      "legacySpider": "ChoosingchiaSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.choosingchia.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "closetcooking",
      "domain": "closetcooking.com",
      "allowedDomains": [
        "closetcooking.com",
        "www.closetcooking.com"
      ],
      "legacySpider": "ClosetcookingSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.closetcooking.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "cookieandkate",
      "domain": "cookieandkate.com",
      "allowedDomains": [
        "cookieandkate.com",
        "www.cookieandkate.com"
      ],
      "legacySpider": "CookieandkateSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.cookieandkate.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "cookiesandcups",
      "domain": "cookiesandcups.com",
      "allowedDomains": [
        "cookiesandcups.com",
        "www.cookiesandcups.com"
      ],
      "legacySpider": "CookiesandcupsSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.cookiesandcups.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "cookingwithruthie",
      "domain": "cookingwithruthie.com",
      "allowedDomains": [
        "cookingwithruthie.com",
        "www.cookingwithruthie.com"
      ],
      "legacySpider": "CookingwithruthieSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.cookingwithruthie.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "coupleinthekitchen",
      "domain": "coupleinthekitchen.com",
      "allowedDomains": [
        "coupleinthekitchen.com",
        "www.coupleinthekitchen.com"
      ],
      "legacySpider": "CoupleinthekitchenSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.coupleinthekitchen.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "fannetasticfood",
      "domain": "fannetasticfood.com",
      "allowedDomains": [
        "fannetasticfood.com",
        "www.fannetasticfood.com"
      ],
      "legacySpider": "FannetasticfoodSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.fannetasticfood.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "gatheranddine",
      "domain": "gatheranddine.com",
      "allowedDomains": [
        "gatheranddine.com",
        "www.gatheranddine.com"
      ],
      "legacySpider": "GatheranddineSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.gatheranddine.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "gimmesomeoven",
      "domain": "gimmesomeoven.com",
      "allowedDomains": [
        "gimmesomeoven.com",
        "www.gimmesomeoven.com"
      ],
      "legacySpider": "GimmesomeovenSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.gimmesomeoven.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "goodlifeeats",
      "domain": "goodlifeeats.com",
      "allowedDomains": [
        "goodlifeeats.com",
        "www.goodlifeeats.com"
      ],
      "legacySpider": "GoodlifeeatsSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.goodlifeeats.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "greedygourmet",
      "domain": "greedygourmet.com",
      "allowedDomains": [
        "greedygourmet.com",
        "www.greedygourmet.com"
      ],
      "legacySpider": "GreedygourmetSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.greedygourmet.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "grownupdish",
      "domain": "grownupdish.com",
      "allowedDomains": [
        "grownupdish.com",
        "www.grownupdish.com"
      ],
      "legacySpider": "GrownupdishSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.grownupdish.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "gunris",
      "domain": "gunris.dk",
      "allowedDomains": [
        "gunris.dk",
        "www.gunris.dk"
      ],
      "legacySpider": "GunrisSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://gunris.dk/wp-json/wp/v2/recipe?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "inspiredtaste",
      "domain": "inspiredtaste.net",
      "allowedDomains": [
        "inspiredtaste.net",
        "www.inspiredtaste.net"
      ],
      "legacySpider": "InspiredtasteSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.inspiredtaste.net/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "joyfulhealthyeats",
      "domain": "joyfulhealthyeats.com",
      "allowedDomains": [
        "joyfulhealthyeats.com",
        "www.joyfulhealthyeats.com"
      ],
      "legacySpider": "JoyfulhealthyeatsSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.joyfulhealthyeats.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "joythebaker",
      "domain": "joythebaker.com",
      "allowedDomains": [
        "joythebaker.com",
        "www.joythebaker.com"
      ],
      "legacySpider": "JoythebakerSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.joythebaker.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "kalynskitchen",
      "domain": "kalynskitchen.com",
      "allowedDomains": [
        "kalynskitchen.com",
        "www.kalynskitchen.com"
      ],
      "legacySpider": "KalynskitchenSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.kalynskitchen.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "kokkeriermedpassion",
      "domain": "kokkeriermedpassion.dk",
      "allowedDomains": [
        "kokkeriermedpassion.dk",
        "www.kokkeriermedpassion.dk"
      ],
      "legacySpider": "KokkerierMedPassionSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://kokkeriermedpassion.dk/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "lavenderandlovage",
      "domain": "lavenderandlovage.com",
      "allowedDomains": [
        "lavenderandlovage.com",
        "www.lavenderandlovage.com"
      ],
      "legacySpider": "LavenderandlovageSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.lavenderandlovage.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "lazycatkitchen",
      "domain": "lazycatkitchen.com",
      "allowedDomains": [
        "lazycatkitchen.com",
        "www.lazycatkitchen.com"
      ],
      "legacySpider": "LazycatkitchenSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.lazycatkitchen.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "lowcarbdelish",
      "domain": "lowcarbdelish.com",
      "allowedDomains": [
        "lowcarbdelish.com",
        "www.lowcarbdelish.com",
      "wellportionedplate.com",
      "www.wellportionedplate.com"],
      "legacySpider": "LowcarbdelishSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.lowcarbdelish.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "lundoaagaard",
      "domain": "lundoaagaard.dk",
      "allowedDomains": [
        "lundoaagaard.dk",
        "www.lundoaagaard.dk"
      ],
      "legacySpider": "LundOaagaardSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://lundoaagaard.dk/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "moderncrumb",
      "domain": "moderncrumb.com",
      "allowedDomains": [
        "moderncrumb.com",
        "www.moderncrumb.com"
      ],
      "legacySpider": "ModerncrumbSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.moderncrumb.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "nannapretzmann",
      "domain": "nannapretzmann.dk",
      "allowedDomains": [
        "nannapretzmann.dk",
        "www.nannapretzmann.dk"
      ],
      "legacySpider": "NannaPretzmannSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://nannapretzmann.dk/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "nyssaskitchen",
      "domain": "nyssaskitchen.com",
      "allowedDomains": [
        "nyssaskitchen.com",
        "www.nyssaskitchen.com"
      ],
      "legacySpider": "NyssaskitchenSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.nyssaskitchen.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "opskrifterforalle",
      "domain": "opskrifter-for-alle.dk",
      "allowedDomains": [
        "opskrifter-for-alle.dk",
        "www.opskrifter-for-alle.dk"
      ],
      "legacySpider": "OpskrifterForAlleSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://opskrifter-for-alle.dk/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "orwhateveryoudo",
      "domain": "orwhateveryoudo.com",
      "allowedDomains": [
        "orwhateveryoudo.com",
        "www.orwhateveryoudo.com"
      ],
      "legacySpider": "OrwhateveryoudoSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.orwhateveryoudo.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "peaceloveandlowcarb",
      "domain": "peaceloveandlowcarb.com",
      "allowedDomains": [
        "peaceloveandlowcarb.com",
        "www.peaceloveandlowcarb.com"
      ],
      "legacySpider": "PeaceloveandlowcarbSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.peaceloveandlowcarb.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "perrysplate",
      "domain": "perrysplate.com",
      "allowedDomains": [
        "perrysplate.com",
        "www.perrysplate.com"
      ],
      "legacySpider": "PerrysplateSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.perrysplate.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "pickledplum",
      "domain": "pickledplum.com",
      "allowedDomains": [
        "pickledplum.com",
        "www.pickledplum.com"
      ],
      "legacySpider": "PickledplumSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.pickledplum.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "pinchofyum",
      "domain": "pinchofyum.com",
      "allowedDomains": [
        "pinchofyum.com",
        "www.pinchofyum.com"
      ],
      "legacySpider": "PinchofyumSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.pinchofyum.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "projectmealplan",
      "domain": "projectmealplan.com",
      "allowedDomains": [
        "projectmealplan.com",
        "www.projectmealplan.com"
      ],
      "legacySpider": "ProjectmealplanSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.projectmealplan.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "rachlmansfield",
      "domain": "rachlmansfield.com",
      "allowedDomains": [
        "rachlmansfield.com",
        "www.rachlmansfield.com"
      ],
      "legacySpider": "RachlmansfieldSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.rachlmansfield.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "rockrecipes",
      "domain": "rockrecipes.com",
      "allowedDomains": [
        "rockrecipes.com",
        "www.rockrecipes.com"
      ],
      "legacySpider": "RockrecipesSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.rockrecipes.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "shelikesfood",
      "domain": "shelikesfood.com",
      "allowedDomains": [
        "shelikesfood.com",
        "www.shelikesfood.com"
      ],
      "legacySpider": "ShelikesfoodSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.shelikesfood.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "smaagroenneskridt",
      "domain": "smaagroenneskridt.dk",
      "allowedDomains": [
        "smaagroenneskridt.dk",
        "www.smaagroenneskridt.dk"
      ],
      "legacySpider": "SmaaGroenneSkridtSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.smaagroenneskridt.dk/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "smittenkitchen",
      "domain": "smittenkitchen.com",
      "allowedDomains": [
        "smittenkitchen.com",
        "www.smittenkitchen.com"
      ],
      "legacySpider": "SmittenkitchenSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.smittenkitchen.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "stegeso",
      "domain": "stegeso.com",
      "allowedDomains": [
        "stegeso.com",
        "www.stegeso.com"
      ],
      "legacySpider": "StegesoSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://stegeso.com/?rest_route=/wp/v2/opskrifter&per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "sweetsimplevegan",
      "domain": "sweetsimplevegan.com",
      "allowedDomains": [
        "sweetsimplevegan.com",
        "www.sweetsimplevegan.com"
      ],
      "legacySpider": "SweetsimpleveganSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.sweetsimplevegan.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "tasteandsee",
      "domain": "tasteandsee.com",
      "allowedDomains": [
        "tasteandsee.com",
        "www.tasteandsee.com"
      ],
      "legacySpider": "TasteandseeSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.tasteandsee.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "thatskinnychickcanbake",
      "domain": "thatskinnychickcanbake.com",
      "allowedDomains": [
        "thatskinnychickcanbake.com",
        "www.thatskinnychickcanbake.com"
      ],
      "legacySpider": "ThatskinnychickcanbakeSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.thatskinnychickcanbake.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "thecakeblog",
      "domain": "thecakeblog.com",
      "allowedDomains": [
        "thecakeblog.com",
        "www.thecakeblog.com"
      ],
      "legacySpider": "ThecakeblogSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.thecakeblog.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "thecastawaykitchen",
      "domain": "thecastawaykitchen.com",
      "allowedDomains": [
        "thecastawaykitchen.com",
        "www.thecastawaykitchen.com"
      ],
      "legacySpider": "ThecastawaykitchenSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.thecastawaykitchen.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "thecookful",
      "domain": "thecookful.com",
      "allowedDomains": [
        "thecookful.com",
        "www.thecookful.com"
      ],
      "legacySpider": "ThecookfulSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.thecookful.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "thehappierhomemaker",
      "domain": "thehappierhomemaker.com",
      "allowedDomains": [
        "thehappierhomemaker.com",
        "www.thehappierhomemaker.com"
      ],
      "legacySpider": "ThehappierhomemakerSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.thehappierhomemaker.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "thehealthymaven",
      "domain": "thehealthymaven.com",
      "allowedDomains": [
        "thehealthymaven.com",
        "www.thehealthymaven.com"
      ],
      "legacySpider": "ThehealthymavenSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.thehealthymaven.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "therealfoodrds",
      "domain": "therealfoodrds.com",
      "allowedDomains": [
        "therealfoodrds.com",
        "www.therealfoodrds.com",
      "therealfooddietitians.com",
      "www.therealfooddietitians.com"],
      "legacySpider": "TherealfoodrdsSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.therealfoodrds.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "tidymom",
      "domain": "tidymom.net",
      "allowedDomains": [
        "tidymom.net",
        "www.tidymom.net"
      ],
      "legacySpider": "TidymomSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.tidymom.net/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    },
    {
      "id": "withspice",
      "domain": "withspice.com",
      "allowedDomains": [
        "withspice.com",
        "www.withspice.com"
      ],
      "legacySpider": "WithspiceSpider",
      "legacyFamily": "WpPostsJsonLdSpider",
      "discovery": "listing",
      "sitemapUrls": [],
      "startUrls": [
        "https://www.withspice.com/wp-json/wp/v2/posts?per_page=100&page=1"
      ],
      "recipeUrlPatterns": [
        "^https?://"
      ],
      "fetchMode": "cheerio",
      "requestSettings": {
        "delaySeconds": 2,
        "rateLimitPerMinute": null,
        "maxConcurrency": 2,
        "maxRetries": 3
      },
      "requireCompleteJsonLd": true,
      "migrationState": "not_started",
      "latestScrapyOutcome": "not_audited"
    }
] as DanishJsonLdSource[];

const LEGACY_LISTING_DEFAULT_PATTERNS = [
  "^/[a-z0-9æøå-]+/?$",
  "^/(opskrift(?:er)?|recipes?|mad)/[a-z0-9æøå-]+/?$",
];

const LEGACY_LISTING_SKIP_PATHS = [
  "/category/", "/tag/", "/page/", "/author/", "/feed/", "/om-",
  "/kontakt/", "/privatlivspolitik/", "/wp-content/", "/wp-admin/",
];

const LEGACY_LISTING_DISCOVERY_DEFAULT: ListingDiscoveryStrategy = {
  recipeLinkSelectors: ["a[href]"],
  skipPathFragments: LEGACY_LISTING_SKIP_PATHS,
  continuationSelectors: [
    "a.next[href]",
    "a.page-numbers.next[href]",
    'link[rel~="next"][href]',
  ],
  continuationUrlPatterns: [],
};

/**
 * The WordPress posts API is one shape across every site in the family: a root
 * array of posts whose `link` is the recipe URL, paged through `page`, ending
 * with an error document once the window is past its last page.
 */
const WP_POSTS_LISTING_DISCOVERY: Partial<ListingDiscoveryStrategy> = {
  recipeLinkSelectors: [],
  skipPathFragments: [],
  continuationSelectors: [],
  continuationUrlPatterns: [],
  payload: {
    kind: "json-paths",
    expectedRoot: "array",
    recipePaths: ["[].link"],
    continuationOffset: { parameter: "page", step: 1, maxOffset: 500 },
    terminalPayload: { path: "code", equals: "rest_post_invalid_page_number" },
  },
};

const LEGACY_LISTING_DISCOVERY_OVERRIDES: Record<
  string,
  Partial<ListingDiscoveryStrategy>
> = {
  bornholms: {
    skipPathFragments: [
      ...LEGACY_LISTING_SKIP_PATHS,
      "/opskrifter/bagel-med-bornholms-fiskepate",
    ],
  },
  ferrerorocher: {
    payload: {
      kind: "json-paths",
      expectedRoot: "object",
      recipePaths: ["hits.hits[]._source.url[]"],
    },
  },
  glutenfrimagi: {
    skipPathFragments: [...LEGACY_LISTING_SKIP_PATHS, "/opskrifter/", "/opskrifter", "/om-mig/"],
  },
  heidiogper: {
    skipPathFragments: [...LEGACY_LISTING_SKIP_PATHS, "/opskrifter/forside"],
  },
  kitchenaid: {
    continuationUrlPatterns: ["^/opskrifter/alle/\\d+/?$"],
  },
  klank: {
    continuationUrlPatterns: [
      "^/index\\.php/opskrifter-(?:koekken|kategori)/[a-z0-9æøåé-]+/?$",
    ],
  },
  knaehoejkarse: {
    skipPathFragments: [...LEGACY_LISTING_SKIP_PATHS, "/alle-opskrifter/", "/opskrifter/", "/about/"],
  },
  madrejsen: {
    recipeLinkSelectors: ["article.entry a.entry-title-link[href]"],
    continuationSelectors: [".pagination-next a[href]"],
    continuationUrlPatterns: ["^/(?:sous-vide|morgenmad|frokost|aftensmad|tilbehor)/page/\\d+/?$"],
    skipPathFragments: [...LEGACY_LISTING_SKIP_PATHS, "/opskrifter/", "/opskrifter", "/om-mig/"],
  },
  recipesairfryer_dk: {
    skipPathFragments: [
      ...LEGACY_LISTING_SKIP_PATHS,
      "/da/hjemmeside-da/", "/da/morgenmad-opskrifter/", "/da/snack-opskrifter/",
      "/da/opskrifter-til-frokost-og-aftensmad/", "/da/dessert-opskrifter/",
      "/da/om-os/", "/da/kontakt-os/",
    ],
  },
  rema1000: {
    continuationSelectors: ["a.sr-only[href]"],
  },
  /**
   * The HTML listing only renders the first 20 recipes and continues through a
   * script-only "Vis flere" control, so discovery reads the same service the
   * control calls. It pages by a `from` offset and rejects offsets past 9950,
   * which is the service result window rather than the end of the catalogue.
   */
  tv2mad: {
    recipeLinkSelectors: [],
    continuationSelectors: [],
    listingHosts: ["recipe-front.services.tv2.dk"],
    payload: {
      kind: "json-paths",
      expectedRoot: "array",
      recipePaths: ["[].url"],
      continuationOffset: { parameter: "from", step: 50, maxOffset: 9_950 },
    },
  },
  abakershouse: WP_POSTS_LISTING_DISCOVERY,
  acouplecooks: WP_POSTS_LISTING_DISCOVERY,
  afamilyfeast: WP_POSTS_LISTING_DISCOVERY,
  aggieskitchen: WP_POSTS_LISTING_DISCOVERY,
  allergylicious: WP_POSTS_LISTING_DISCOVERY,
  anicula: WP_POSTS_LISTING_DISCOVERY,
  annsentitledlife: WP_POSTS_LISTING_DISCOVERY,
  artfuldishes: WP_POSTS_LISTING_DISCOVERY,
  asweetspoonful: WP_POSTS_LISTING_DISCOVERY,
  babybite: WP_POSTS_LISTING_DISCOVERY,
  bakerella: WP_POSTS_LISTING_DISCOVERY,
  basisvarer: WP_POSTS_LISTING_DISCOVERY,
  bellalimento: WP_POSTS_LISTING_DISCOVERY,
  breadtopia: WP_POSTS_LISTING_DISCOVERY,
  brownedbutterblondie: WP_POSTS_LISTING_DISCOVERY,
  butternutbakeryblog: WP_POSTS_LISTING_DISCOVERY,
  carrotstick: WP_POSTS_LISTING_DISCOVERY,
  choosingchia: WP_POSTS_LISTING_DISCOVERY,
  closetcooking: WP_POSTS_LISTING_DISCOVERY,
  cookieandkate: WP_POSTS_LISTING_DISCOVERY,
  cookiesandcups: WP_POSTS_LISTING_DISCOVERY,
  cookingwithruthie: WP_POSTS_LISTING_DISCOVERY,
  coupleinthekitchen: WP_POSTS_LISTING_DISCOVERY,
  fannetasticfood: WP_POSTS_LISTING_DISCOVERY,
  gatheranddine: WP_POSTS_LISTING_DISCOVERY,
  gimmesomeoven: WP_POSTS_LISTING_DISCOVERY,
  goodlifeeats: WP_POSTS_LISTING_DISCOVERY,
  greedygourmet: WP_POSTS_LISTING_DISCOVERY,
  grownupdish: WP_POSTS_LISTING_DISCOVERY,
  gunris: WP_POSTS_LISTING_DISCOVERY,
  inspiredtaste: WP_POSTS_LISTING_DISCOVERY,
  joyfulhealthyeats: WP_POSTS_LISTING_DISCOVERY,
  joythebaker: WP_POSTS_LISTING_DISCOVERY,
  kalynskitchen: WP_POSTS_LISTING_DISCOVERY,
  kokkeriermedpassion: WP_POSTS_LISTING_DISCOVERY,
  lavenderandlovage: WP_POSTS_LISTING_DISCOVERY,
  lazycatkitchen: WP_POSTS_LISTING_DISCOVERY,
  lowcarbdelish: WP_POSTS_LISTING_DISCOVERY,
  lundoaagaard: WP_POSTS_LISTING_DISCOVERY,
  moderncrumb: WP_POSTS_LISTING_DISCOVERY,
  nannapretzmann: WP_POSTS_LISTING_DISCOVERY,
  nyssaskitchen: WP_POSTS_LISTING_DISCOVERY,
  opskrifterforalle: WP_POSTS_LISTING_DISCOVERY,
  orwhateveryoudo: WP_POSTS_LISTING_DISCOVERY,
  peaceloveandlowcarb: WP_POSTS_LISTING_DISCOVERY,
  perrysplate: WP_POSTS_LISTING_DISCOVERY,
  pickledplum: WP_POSTS_LISTING_DISCOVERY,
  pinchofyum: WP_POSTS_LISTING_DISCOVERY,
  projectmealplan: WP_POSTS_LISTING_DISCOVERY,
  rachlmansfield: WP_POSTS_LISTING_DISCOVERY,
  rockrecipes: WP_POSTS_LISTING_DISCOVERY,
  shelikesfood: WP_POSTS_LISTING_DISCOVERY,
  smaagroenneskridt: WP_POSTS_LISTING_DISCOVERY,
  smittenkitchen: WP_POSTS_LISTING_DISCOVERY,
  stegeso: WP_POSTS_LISTING_DISCOVERY,
  sweetsimplevegan: WP_POSTS_LISTING_DISCOVERY,
  tasteandsee: WP_POSTS_LISTING_DISCOVERY,
  thatskinnychickcanbake: WP_POSTS_LISTING_DISCOVERY,
  thecakeblog: WP_POSTS_LISTING_DISCOVERY,
  thecastawaykitchen: WP_POSTS_LISTING_DISCOVERY,
  thecookful: WP_POSTS_LISTING_DISCOVERY,
  thehappierhomemaker: WP_POSTS_LISTING_DISCOVERY,
  thehealthymaven: WP_POSTS_LISTING_DISCOVERY,
  therealfoodrds: WP_POSTS_LISTING_DISCOVERY,
  tidymom: WP_POSTS_LISTING_DISCOVERY,
  withspice: WP_POSTS_LISTING_DISCOVERY,
};

const LEGACY_SITEMAP_DISCOVERY_OVERRIDES: Record<
  string,
  SitemapDiscoveryStrategy
> = {
  bobedre: {
    followPatterns: ["contenthub_composite"],
    skipUrlFragments: [
      "/opskrifter/hovedret?", "/opskrifter/dessert?", "/opskrifter/forret?",
      "/opskrifter/julemad?", "/opskrifter/drinks?", "/opskrifter/bagvaerk?",
      "/opskrifter/tilbehoer?", "/opskrifter/grill?", "/opskrifter/temaer?",
      "/opskrifter/brunch?",
    ],
  },
  christinaskoekken: {
    followPatterns: [],
    skipUrlFragments: [
      "/opskrifter-med/", "/tag/", "/category/", "/page/", "/kontakt/",
      "/om-", "/privatlivspolitik/",
    ],
  },
  frederikkewaerens: {
    followPatterns: [],
    skipUrlFragments: [
      "/opskrifter/", "/category/", "/tag/", "/page/", "/kontakt/",
      "/om-", "/privatlivspolitik/",
    ],
  },
  iform: { followPatterns: ["contenthub_composite"], skipUrlFragments: [] },
  kikkoman: { followPatterns: ["sitemap=recipes"], skipUrlFragments: [] },
  madsvin: {
    followPatterns: [],
    skipUrlFragments: [
      "/category/", "/tag/", "/page/", "/author/", "/om-madsvin/",
      "/kontakt/", "/privatlivspolitik/", "/nyhedsbrev/", "/samarbejde/",
      "/kogebog/", "/opskrifter/", "/kategori/",
    ],
  },
  mariavestergaard: {
    followPatterns: [],
    skipUrlFragments: [
      "/category/", "/tag/", "/page/", "/author/", "/om-mig/", "/om/",
      "/kontakt/", "/privatlivspolitik/", "/samarbejde/", "/opskrifter/",
    ],
  },
  micadeli: { followPatterns: ["post-sitemap\\.xml$"], skipUrlFragments: [] },
  nogetiovnen: {
    followPatterns: ["post-sitemap"],
    skipUrlFragments: [
      "/category/", "/tag/", "/page/", "/author/", "/om-mig/", "/om-os/",
      "/kontakt/", "/privatlivspolitik/", "/samarbejde/", "/nyhedsbrev/",
      "/cookie/", "/opskrifter/",
    ],
  },
  sundpaabudget: {
    followPatterns: [],
    skipUrlFragments: [
      "/single-ugeplan-", "/sund-madplan-", "/vegetarisk-madplan-",
      "/flexitarisk-madplan-", "/basislager/",
    ],
  },
  allrecipes: { followPatterns: [], skipUrlFragments: ["/recipe/collection/", "/gallery/", "/article/"] },
  avocadosfrommexico: { followPatterns: [], skipUrlFragments: ["/recipe/collection/", "/recipe/category/"] },
  bbcgoodfood: { followPatterns: [], skipUrlFragments: ["/recipes/collection/", "/recipes/category/"] },
  bertolli: { followPatterns: [], skipUrlFragments: ["/recipes/collection/", "/recipes/category/"] },
  bettycrocker: { followPatterns: [], skipUrlFragments: ["/recipes/meal-type/", "/recipes/cuisine/", "/recipes/ingredient/"] },
  bobsredmill: { followPatterns: [], skipUrlFragments: ["/recipes/collection/", "/recipes/category/"] },
  canadianliving: { followPatterns: [], skipUrlFragments: ["/food/recipe/collection/"] },
  chelsea_nz: { followPatterns: [], skipUrlFragments: ["/browse-recipes/category/"] },
  delmonte: { followPatterns: [], skipUrlFragments: ["/recipes/collections/"] },
  edmonds_nz: { followPatterns: [], skipUrlFragments: ["/recipes/category/"] },
  foodnetwork_uk: { followPatterns: [], skipUrlFragments: ["/recipes/collection/"] },
  greatbritishchefs: { followPatterns: [], skipUrlFragments: ["/recipes/collections/"] },
  jamieoliver: { followPatterns: [], skipUrlFragments: ["/recipes/category/", "/recipes/meal-type/", "/recipes/cuisine/"] },
  landolakes: { followPatterns: [], skipUrlFragments: ["/recipe/category/"] },
  nordicfoodliving: { followPatterns: [], skipUrlFragments: ["/category/", "/tag/", "/page/", "/about/", "/contact/", "/privacy-policy/", "/recipes/"] },
  olivemagazine: { followPatterns: [], skipUrlFragments: ["/recipes/collection/", "/recipes/category/"] },
  pillsbury: { followPatterns: [], skipUrlFragments: ["/recipes/meal-type/", "/recipes/cuisine/"] },
  progresso: { followPatterns: [], skipUrlFragments: ["/recipes/collection/", "/recipes/category/"] },
  ricardocuisine: { followPatterns: [], skipUrlFragments: ["/en/recipes/collection/", "/fr/"] },
  spam: { followPatterns: [], skipUrlFragments: ["/recipes/collection/", "/recipes/category/"] },
  sunset: { followPatterns: [], skipUrlFragments: ["/recipe/collection/"] },
  tasteofhome: { followPatterns: [], skipUrlFragments: ["/recipes/cuisine/", "/recipes/dishes/", "/recipes/ingredients/"] },
  tesco_recipes: { followPatterns: [], skipUrlFragments: ["/recipes/collections/", "/recipes/meal-planners/"] },
  tillamook: { followPatterns: [], skipUrlFragments: ["/recipes/collection/", "/recipes/category/"] },
};

const LEGACY_DISCOVERY_OVERRIDES: Partial<
  Record<
    string,
    Partial<Pick<DanishJsonLdSource, "startUrls" | "recipeUrlPatterns">>
  >
> = {
  ferrerorocher: {
    startUrls: [
      "https://www.ferrerorocher.com/api/dk/search/_search?size=200",
    ],
    recipeUrlPatterns: ["^/dk/da/tips-og-ideer/opskrifter/[^/?#]+/?$"],
  },
  frokenkraesen_com: { recipeUrlPatterns: LEGACY_LISTING_DEFAULT_PATTERNS },
  madenimitliv: { recipeUrlPatterns: LEGACY_LISTING_DEFAULT_PATTERNS },
  madformadelskere: { recipeUrlPatterns: LEGACY_LISTING_DEFAULT_PATTERNS },
  plantepusherne: { recipeUrlPatterns: LEGACY_LISTING_DEFAULT_PATTERNS },
  stinna: { recipeUrlPatterns: LEGACY_LISTING_DEFAULT_PATTERNS },
  sydhavnsbloggen: { recipeUrlPatterns: LEGACY_LISTING_DEFAULT_PATTERNS },
};

/**
 * Sources whose configured discovery route was verified against the live site
 * by a read-only audit: the route resolved and yielded recipe URLs matching the
 * registry patterns, or a sitemap index to follow. That evidence supports
 * `configured`; it is not a canary and assigns no owner.
 */
const ROUTE_AUDITED_SOURCE_IDS = new Set([
  "amo", "aperol", "aurion", "bareencocktail",
  "beauvais", "becel", "bedstedrinks", "blenderopskrifter",
  "bobedre", "bodylab", "bornemenuen", "bornholms",
  "campari", "castello", "christinaskoekken", "cocktaily",
  "copenhagendistillery_da", "danishcrown", "diabetesopskrifter", "evatrio",
  "familiejournal", "ferrerorocher", "fevertree", "foodnotes",
  "frederikkewaerens", "friluftslageret", "frokenkraesen_com", "gastrologik",
  "gastrotools", "gigtforeningen", "glutenfrimagi", "glyngoere",
  "hannerobinson", "heidiogper", "heinz", "hverdagskoekken",
  "iform", "imerco", "ingridhornshoj", "jonsmadklub",
  "ketomums", "klank", "knaehoejkarse", "kokke",
  "kornkammeret", "kystfisken", "lurpak", "madenimitliv",
  "madfolket", "madformadelskere", "madogdrikke", "madsvin",
  "maduniverset", "mambeno", "mariavestergaard", "micadeli",
  "mutti", "nescafe", "nogetiovnen", "nordmad",
  "nutella", "oatly", "odensemarcipan", "oetker",
  "opskrifterdk", "parcelhuslykke", "planetariskkogebog", "plantepusherne",
  "puredansk", "recipesairfryer_dk", "rema1000", "revivafit",
  "rosekylling", "santamariaworld", "schulstad", "semper",
  "skalvibage", "skolemaelk", "slagterlampe", "spicytwist",
  "spisekunst", "starbucksathome", "stinna", "sydhavnsbloggen",
  "udeoghjemme", "violife",
  "allrecipes", "avocadosfrommexico", "bbcgoodfood", "bertolli",
  "bettycrocker", "bobsredmill", "canadianliving", "chelsea_nz",
  "delmonte", "edmonds_nz", "foodnetwork_uk", "greatbritishchefs",
  "jamieoliver", "landolakes", "nordicfoodliving", "olivemagazine",
  "pillsbury", "progresso", "spam", "sunset",
  "tasteofhome", "tesco_recipes", "tillamook"
]);

const PILOT_CANARY_RUN =
  "2026-08-13T13-52-17.460Z-attempt-e656480c-a774-4c00-aa02-1fa3fdd898e0";

/**
 * Current-site evidence discovered by the bounded pilot canary. Legacy family
 * metadata remains unchanged, while executable discovery and checklist state
 * reflect the live source contract.
 */
const CURRENT_SOURCE_OVERRIDES: Partial<
  Record<string, Partial<DanishJsonLdSource>>
> = {
  arla: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-15T10-06-36.443Z-attempt-0550c74a-5637-4061-9509-d715fe054fc8",
    deferOrBlockReason:
      "Uncapped run persisted all 3062 discovered recipes with complete discovery and no blocked, failed or rejected record",
  },
  /**
   * Six pages carry a canonical pointing at thise.dk, a separate brand whose
   * recipes Coop republishes. That is a real cross-site canonical, not the
   * template junk seen on Imerco and Noget i Ovnen, so the domain boundary is
   * right to reject it and the source cannot reach complete discovery while
   * the syndicated pages remain.
   */
  coop: {
    migrationState: "configured",
    latestCanary: "2026-08-18T04-14-18.237Z-attempt-d753a334-1b6d-4ab1-a48f-415ab84a90a8",
    deferOrBlockReason:
      "Uncapped run persisted 4913 recipes with no blocked or failed request, but six syndicated pages declare a thise.dk canonical and are rejected at the domain boundary, leaving discovery incomplete",
  },
  /**
   * The pagination widget mixes absolute, root-relative and document-relative
   * hrefs for the same pages. The document-relative ones resolve to duplicated
   * path segments and 404, on this crawler and in a browser alike.
   */
  kitchenaid: {
    migrationState: "configured",
    latestCanary: "2026-08-16T00-00-01.253Z-attempt-e7e4e259-69cd-453d-b21e-046f5d3f49af",
    deferOrBlockReason:
      "Uncapped run persisted 726 recipes, but the source's own malformed relative pagination links produced 60 failed requests and left discovery incomplete",
  },
  madoghave: {
    migrationState: "shadow_passed",
    latestCanary:
      "2026-08-13T20-04-47.355Z-attempt-fb13dd5c-1574-4ce6-badd-019810bd2afc",
    shadowParity: "legacy-unhealthy",
    deferOrBlockReason:
      "Legacy spider emits zero recipes, so acceptance rests on complete discovery, two clean uncapped runs, and a reviewed record sample",
  },
  tv2mad: {
    startUrls: ["https://recipe-front.services.tv2.dk/search/%20?from=0"],
    migrationState: "configured",
    latestCanary:
      "2026-08-14T13-06-56.114Z-attempt-6720a4f2-98d6-4f61-a5df-76987ce01c9c",
    deferOrBlockReason:
      "Service route persisted 9999 recipes against 20 before, but its result window stops at 10000, so discovery stays incomplete until the catalogue is partitioned",
  },
  surdejsentusiasten: {
    migrationState: "shadow_passed",
    latestCanary:
      "2026-08-13T19-21-01.957Z-attempt-4c841ddc-1d13-48c9-a02c-83587d34898e",
    shadowParity: "100%",
    deferOrBlockReason: undefined,
  },
  /**
   * The listing renders twelve recipes and continues through a script-only
   * control, so a canary here would report partial discovery as complete.
   */
  aperol: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-14T20-03-09.220Z-attempt-4abcc7ae-5fcc-4119-9b75-44036466910b",
    shadowParity: "100%",
    deferOrBlockReason:
      "Three uncapped Crawlee runs produced the same single complete recipe with complete discovery and no operational failures; the full side-effect-disabled Scrapy run emitted the same URL, and every material field matched exactly",
  },
  ferrerorocher: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-14T20-03-32.139Z-attempt-f3b7a390-cb11-42ae-9782-728099d8e443",
    shadowParity: "100%",
    deferOrBlockReason:
      "Three uncapped Crawlee runs produced the same three-recipe catalog with complete discovery and no operational failures; all three records matched the full Scrapy output on every material field after the shared normalizer decoded upstream HTML entities in JSON-LD strings",
  },
  friluftslageret: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-14T20-08-35.579Z-attempt-53fdc75c-e4dd-4a03-bc06-000512c6b8c2",
    shadowParity: "100% required fields; additive cuisine",
    deferOrBlockReason:
      "Three uncapped Crawlee runs and the full Scrapy run traversed all 17 current recipe candidates and emitted the same sole complete record with every legacy material field matching; Crawlee additionally preserves recipeCuisine=Outdoor, which the legacy item schema discards, and both reproduce the upstream page's mismatched fajitas URL and pizza Recipe payload",
  },
  glutenfrimagi: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-14T20-07-53.129Z-attempt-25799574-7bc4-42c5-820a-09518a4eda5c",
    shadowParity: "100%",
    deferOrBlockReason:
      "Three uncapped Crawlee runs and the full browser-backed Scrapy run traversed the same 15 candidates, emitted the same eight complete recipes, rejected the same seven non-recipe pages, and matched every material field; the latest Crawlee run cleared one initial HTTP 454 browser check on its in-session retry with no terminal failure",
  },
  knaehoejkarse: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-19T21-07-35.013Z",
    shadowParity: "12/12 recipes; 100% material-field parity",
    deferOrBlockReason:
      "Three uncapped browser-backed Crawlee runs and the full Scrapy run traversed the same 13 candidates, emitted the same 12 recipes, excluded the same non-recipe page, and matched every material field with no failed or blocked request",
  },
  madrejsen: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T19-38-50.433Z-attempt-1f798f5f-9220-44bf-93af-19824fa1e326",
    deferOrBlockReason:
      "Uncapped run persisted 149 recipes with complete discovery and no blocked or failed request",
  },
  parcelhuslykke: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-19T21-07-35.013Z",
    shadowParity: "11/11 recipes; 100% legacy fields with additive yield and cuisine",
    deferOrBlockReason:
      "Three uncapped Crawlee runs and the full Scrapy run completed the same 12 requests and emitted the same 11 recipes with exact URLs, titles, ingredients, instruction grouping and text, times, images, categories, and keywords; Crawlee intentionally preserves full yield text and recipeCuisine that the legacy item schema truncates or drops",
  },
  recipesairfryer_dk: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-19T21-26-09.106Z",
    shadowParity: "47/47 recipes; 100% legacy fields with richer yield text",
    deferOrBlockReason:
      "Three uncapped Crawlee runs and the full Scrapy run followed all eight listing pages, emitted the same 47 recipes, rejected the same two non-recipe articles, and matched every legacy field; Crawlee intentionally preserves full yield labels on eight records that Scrapy truncates",
  },
  rema1000: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T20-11-01.445Z-attempt-828a9ea6-ce87-48af-a902-ae534a4956fd",
    deferOrBlockReason:
      "Uncapped run persisted 671 recipes with complete discovery and no blocked or failed request",
  },
  beauvais: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-19T21-43-54.090Z",
    shadowParity: "69/69 recipes; 100% material-field parity",
    deferOrBlockReason:
      "Two uncapped Crawlee runs and the full Scrapy run completed both source sitemaps and the same 71 requests, emitted the same 69 recipes, and matched every material field exactly with no operational failure",
  },
  cocktaily: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-14T22-30-27.302Z-attempt-0bf7133d-8283-4f60-ab3f-d884a91e03c1",
    shadowParity: "100% required fields; additive yield units and cuisines",
    deferOrBlockReason:
      "Three uncapped Crawlee runs and the full Scrapy run produced the same 36 URLs with exact titles, ingredients, instructions, times, images, categories, and keywords and no operational failures; Crawlee intentionally preserves each upstream yield as '1 serving' instead of legacy numeric-only 1 and retains recipeCuisine, which the legacy item schema discards",
  },
  evatrio: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-14T22-38-28.666Z-attempt-c7c07bee-eb1a-4a4d-ac8d-dd2076b6bd38",
    shadowParity: "100% required fields; additive yield units and cuisines",
    deferOrBlockReason:
      "Three uncapped Crawlee runs and the full Scrapy run each completed 92 requests over 218 listing occurrences and 88 unique recipe pages, emitting the same 28 recipes while the other 60 pages had no Recipe JSON-LD; after normalizing zero durations, embedded HTML, and comma-separated categories, every legacy field matches, while Crawlee intentionally preserves full yield text and recipeCuisine that the legacy schema truncates or drops",
  },
  hannerobinson: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-19T21-43-54.090Z",
    shadowParity: "2/2 recipes; 100% legacy fields with richer yield and cuisine",
    deferOrBlockReason:
      "Two uncapped Crawlee runs and the full Scrapy run traversed the same 69 candidates, emitted the same two recipes, and agreed that 67 pages contain no Recipe JSON-LD; every legacy field matched, while Crawlee intentionally preserves full yield labels and the published Dansk or Italiensk cuisine",
  },
  ketomums: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-19T21-40-24.489Z",
    shadowParity: "50/50 recipes; 100% legacy fields with richer yield text",
    deferOrBlockReason:
      "Two current uncapped Crawlee runs emitted byte-identical 50-record outputs and source keys with no operational failures, confirming three recipes added since the retained runs; the full Scrapy run emitted the same 50 URLs and every legacy field matched, while Crawlee intentionally preserves full yield labels that Scrapy truncates",
  },
  kornkammeret: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-19T21-14-37.357Z",
    shadowParity: "33/33 recipes; 100% legacy fields with richer yield text",
    deferOrBlockReason:
      "Three uncapped Crawlee runs and the full Scrapy run emitted the same 33-recipe catalog with exact URLs, titles, ingredients, instructions, times, images, and taxonomy and no operational failures; Crawlee intentionally preserves full yield labels on 20 records that Scrapy truncates",
  },
  nescafe: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-19T21-23-23.709Z",
    shadowParity: "34/34 recipes; 100% legacy fields with richer yield text",
    deferOrBlockReason:
      "Three uncapped Crawlee runs and the full Scrapy run traversed the same 36 recipe candidates, emitted the same 34 recipes, excluded the same two listing pages, and matched every legacy field after ignoring presentational ingredient HTML and dropping one empty UI-label HowToStep; Crawlee intentionally preserves upstream Serving units that Scrapy discards",
  },
  nutella: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-19T21-37-39.862Z",
    shadowParity: "55/55 recipes; 100% legacy fields with richer yield text",
    deferOrBlockReason:
      "Four uncapped Crawlee runs and the full Scrapy run traversed the same 58 candidates, emitted the same 55 recipes, rejected the same three campaign pages, and matched every legacy field after preserving inline HTML text adjacency while spacing line breaks; Crawlee intentionally retains complete yield units on 22 records that Scrapy truncates",
  },
  violife: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-19T21-14-37.357Z",
    shadowParity: "28/28 recipes; 100% material-field parity",
    deferOrBlockReason:
      "Three uncapped Crawlee runs and the full Scrapy run completed the same 29 requests, emitted the same 28 recipes, and matched every material field exactly with no failed, blocked, rejected, storage, or domain record",
  },
  frokenkraesen_com: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-19T21-43-54.090Z",
    shadowParity: "51/51 recipes; 100% legacy fields with richer yield text",
    deferOrBlockReason:
      "Two uncapped Crawlee runs and the full Scrapy run completed the same 57 requests over 56 discovered candidates, emitted the same 51 recipes, excluded the same four non-recipe pages plus one redirect duplicate, and matched every legacy field except intentionally preserved yield labels",
  },
  schulstad: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-19T22-44-52.098Z",
    shadowParity:
      "94/94 recipes and all material legacy fields; richer yield labels retained",
    deferOrBlockReason:
      "Two post-fix uncapped Crawlee runs emitted identical 94-record keys and normalized content and completed all 95 requests without failure; the full Scrapy run emitted the same recipes and every legacy field matches after preserving ingredient array boundaries, while Crawlee retains yield labels that Scrapy truncates to the first integer",
  },
  madformadelskere: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-19T22-27-55.477Z",
    shadowParity:
      "72/72 recipes and all material legacy fields; additive cuisines retained",
    deferOrBlockReason:
      "Two Crawlee outputs had identical 72-record keys and normalized content; after preserving discovered fetch URLs, the uncapped rerun completed all 113 requests without failure. All 71 full-run Scrapy records plus its directly parsed redirect-deduped 72nd page match every legacy field, while Crawlee retains recipeCuisine that the JSON-LD item adapter discards",
  },
  semper: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-19T21-07-35.013Z",
    shadowParity: "25/25 recipes; 100% legacy fields with richer yield text",
    deferOrBlockReason:
      "Three uncapped Crawlee runs and the full Scrapy run completed the same 26 requests and emitted the same 25 recipes with exact legacy fields after handling text/plain recipe HTML, top-level string instructions, Danish duration text such as '1 time', and equivalent www and bare-host image URLs; Crawlee intentionally preserves yield ranges and units that Scrapy truncates to the first integer",
  },
  stinna: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-15T06-54-38.846Z-attempt-eaf3d49d-5daf-4a18-99af-552e24708b88",
    deferOrBlockReason:
      "Uncapped run persisted 1430 recipes over 1934 pages with complete discovery and no blocked or failed request; six pages carry Recipe JSON-LD without required fields and stay rejected",
  },
  bodylab: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "partial",
    latestCanary: "2026-08-20T00-15-47.667Z",
    shadowParity:
      "29/29 legacy-visible recipes match exactly; stable 149-recipe Crawlee catalog",
    deferOrBlockReason:
      "Two uncapped Crawlee runs traversed all ten current listing pages and emitted identical 149-record keys and normalized content across 175 responses with no operational failure. Scrapy stopped after the first visible-anchor listing window and emitted 29 recipes; every overlapping recipe and material field matches exactly. Crawlee correctly retains the complete paginated catalog and rejects one incomplete page",
  },
  starbucksathome: {
    migrationState: "configured",
    latestCanary: "2026-08-15T08-24-54.313Z-attempt-38f62583-6ad2-4d4f-8e4f-9744e05bcbc8",
    deferOrBlockReason:
      "Crawl is clean but the source rejects more than it keeps: 96 pages carry Recipe JSON-LD without required fields against 28 persisted, so its JSON-LD coverage needs review before a canary",
  },
  klank: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-19T23-22-41.211Z",
    shadowParity: "52/52 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two current uncapped Crawlee runs and the full Scrapy run completed the same 74 requests, emitted the same 52 recipes, and rejected the same two incomplete pages. Every material field matches, both Crawlee outputs have identical keys and normalized records, and no operational failure occurred",
  },
  glyngoere: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T00-04-32.242Z",
    shadowParity: "74/74 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two clean uncapped Crawlee runs emitted identical 74-record keys and normalized content, completed all 76 requests, and rejected the same incomplete page; the full Scrapy run emitted the same recipes with exact material-field parity. A longer cooldown let the repeat clear its initial HTTP 454 on the first in-session retry; Crawlee completed in 188 seconds versus Scrapy's 483 seconds",
  },
  bareencocktail: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-19T23-40-40.230Z",
    shadowParity: "81/81 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two current uncapped Crawlee runs and the full Scrapy run emitted the same 81 recipes with exact material-field parity, rejected the same incomplete Clover Club page, and identified the same three category pages without Recipe JSON-LD. Crawlee cleared one initial HTTP 454 in-session on the first run; the repeat completed without retries, and both outputs have identical keys and normalized records",
  },
  copenhagendistillery_da: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-19T23-48-59.237Z",
    shadowParity: "87/87 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two current uncapped Crawlee runs emitted identical 87-record keys and normalized content with complete discovery and no operational failure; the full Scrapy run emitted the same recipes and every material field matches. Both reject the same incomplete Scorpio Punch page",
  },
  bedstedrinks: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-19T22-17-03.579Z",
    shadowParity:
      "80/80 recipes and every material legacy field match exactly",
    deferOrBlockReason:
      "Two current uncapped Crawlee runs emitted identical 80-recipe outputs and stable keys; the full Scrapy run emitted the same URLs and all material fields match exactly, with no operational failure",
  },
  /**
   * Previously deferred on the claim that it published no Recipe JSON-LD. That
   * was drawn from the first 248 pages of a run that was stopped early; the
   * recipes appear deeper in the sitemap.
   */
  bobedre: {
    migrationState: "configured",
    latestCanary: "2026-08-17T23-05-35.904Z-attempt-cde2a905-dc84-49ed-b08d-ea02a68994ad",
    deferOrBlockReason:
      "Uncapped run persisted 710 recipes over 2699 pages with complete discovery; one failed request and 58 incomplete pages keep it short of a canary",
  },
  /**
   * The single failed request is a page the source itself serves as 500 on
   * every request, not a crawl defect.
   */
  danishcrown: {
    migrationState: "configured",
    latestCanary: "2026-08-18T12-31-16.022Z-attempt-01cb0baf-68b3-43fd-a41f-1cdfc52f2f66",
    deferOrBlockReason:
      "Uncapped run persisted 1891 recipes with complete discovery and no blocked or rejected record; one sitemap URL (rugbroed-med-surdej) answers 500 at the source, which keeps it short of a canary",
  },
  /**
   * The malformed blocks carry unescaped double quotes inside the Recipe
   * description string, which is invalid JSON at the source. Repairing it
   * would mean guessing where the author's quotes end, so the strict
   * contract rejects those pages.
   */
  chelsea_nz: {
    migrationState: "configured",
    latestCanary: "2026-08-18T13-05-11.809Z-attempt-0b3fbf74-dd09-438c-9849-d5c1be0dcd01",
    deferOrBlockReason:
      "Uncapped run persisted 2091 recipes with complete discovery and no blocked or failed request; 48 pages publish Recipe JSON-LD with unescaped quotes in the description and 56 more are incomplete, which keeps it short of a canary",
  },
  aurion: {
    migrationState: "configured",
    latestCanary: "2026-08-18T09-20-45.164Z-attempt-085969f5-fd04-4a17-938a-b8855227448a",
    deferOrBlockReason:
      "Uncapped run persisted 124 recipes with complete discovery; 6 malformed pages keep it short of a canary",
  },
  becel: {
    migrationState: "configured",
    latestCanary: "2026-08-14T22-52-15.704Z-attempt-5203ef6c-2a88-4012-a058-92a7cf67fdab",
    deferOrBlockReason:
      "Uncapped run persisted 66 recipes with complete discovery; 2 incomplete pages and 74 malformed pages keep it short of a canary",
  },
  blenderopskrifter: {
    migrationState: "configured",
    latestCanary: "2026-08-14T20-37-08.750Z-attempt-ff928238-b1c9-465e-9c96-0748ec465f13",
    deferOrBlockReason:
      "Uncapped run persisted 173 recipes with complete discovery; 52 failed requests keep it short of a canary",
  },
  bornholms: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-19T20-16-22.495Z",
    shadowParity:
      "11/11 unique current recipes and every material field matched; Scrapy emitted one additional query-string duplicate",
    deferOrBlockReason:
      "Two uncapped Crawlee runs completed the current listing with a stable 11-record key set and the final run had no failed, blocked, rejected, storage, or domain records; all 11 unique recipes exactly matched the 12-row legacy output after collapsing its query-string duplicate, and one known dead listing URL is explicitly skipped. One intervening fresh browser session remained on HTTP 454 through all retries, so production monitoring and retry scheduling remain required",
  },
  diabetesopskrifter: {
    migrationState: "configured",
    latestCanary: "2026-08-14T20-45-43.602Z-attempt-f42c07f8-e65e-470f-bfaf-920baa7d27a6",
    deferOrBlockReason:
      "Uncapped run persisted 132 recipes with complete discovery; 52 failed requests keep it short of a canary",
  },
  heidiogper: {
    migrationState: "configured",
    latestCanary: "2026-08-18T00-42-16.200Z-attempt-eccfc2b5-285f-413e-92d6-b3483c74c8b4",
    deferOrBlockReason:
      "Uncapped run persisted 25 recipes with complete discovery; 1 failed request keep it short of a canary",
  },
  heinz: {
    migrationState: "configured",
    latestCanary: "2026-08-14T20-03-43.529Z-attempt-17ba5f17-b778-4122-948c-800bf1b07019",
    deferOrBlockReason:
      "Uncapped run persisted 3 recipes with complete discovery; 2 failed requests keep it short of a canary",
  },
  maduniverset: {
    migrationState: "configured",
    latestCanary: "2026-08-16T00-37-52.059Z-attempt-bffad42b-d66c-49fd-8434-e1e95f0d30f2",
    deferOrBlockReason:
      "Uncapped run persisted 9811 recipes with complete discovery; 2 failed requests and 42 incomplete pages keep it short of a canary",
  },
  micadeli: {
    migrationState: "configured",
    latestCanary: "2026-08-17T00-48-14.000Z-attempt-5abdda54-3e59-44aa-a0c0-1342ce7b42fa",
    deferOrBlockReason:
      "Uncapped run persisted 409 recipes with complete discovery; 41 blocked requests and 64 incomplete pages keep it short of a canary",
  },
  opskrifterdk: {
    migrationState: "configured",
    latestCanary: "2026-08-17T12-28-13.168Z-attempt-66a5c41c-f425-45ea-a194-3f83d52bafd7",
    deferOrBlockReason:
      "Uncapped run persisted 4048 recipes with complete discovery; 76 failed requests and 8 incomplete pages keep it short of a canary",
  },
  plantepusherne: {
    migrationState: "configured",
    latestCanary: "2026-08-14T22-16-18.944Z-attempt-3228faac-3030-41d5-adf7-975860999b7f",
    deferOrBlockReason:
      "Uncapped run persisted 31 recipes but discovery did not complete; 3 blocked requests and 1 malformed page as well",
  },
  skolemaelk: {
    migrationState: "configured",
    latestCanary: "2026-08-16T07-57-37.358Z-attempt-b9143eaf-e48b-4102-9e95-d42d3d188d7c",
    deferOrBlockReason:
      "Uncapped run persisted no recipes: the configured sitemap URL serves application/rss+xml rather than a sitemap and the site answered with HTTP 455, so discovery never completed",
  },
  slagterlampe: {
    migrationState: "configured",
    latestCanary: "2026-08-16T21-56-10.861Z-attempt-c785d1b8-9ac7-4ac5-abeb-3c306bbdfbc0",
    deferOrBlockReason:
      "Uncapped run persisted 272 recipes but discovery did not complete; 22 blocked requests as well",
  },
  spicytwist: {
    migrationState: "configured",
    latestCanary: "2026-08-14T22-19-05.328Z-attempt-225f761f-f747-46a7-9414-f63d02973200",
    deferOrBlockReason:
      "Uncapped run persisted 30 recipes but discovery did not complete; 1 failed request as well",
  },
  spisekunst: {
    migrationState: "configured",
    latestCanary: "2026-08-16T23-33-26.130Z-attempt-03bc4b65-0ded-4ba6-906b-cf69afd1dcca",
    deferOrBlockReason:
      "Uncapped run persisted 410 recipes with complete discovery; 61 blocked requests and 5 failed requests keep it short of a canary",
  },
  sydhavnsbloggen: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-19T20-20-33.834Z",
    shadowParity:
      "42/42 recipes, identical URL set, and every material field matched across the complete current listing",
    deferOrBlockReason:
      "The uncapped hybrid run escalated the listing's HTTP 454 response to browser transport, cleared it on the first in-session retry, and completed all 48 admitted candidates with 42 recipes and no terminal block, failure, reject, storage error, or domain violation; the complete 42-record output exactly matched Scrapy, while its five parsed non-recipe pages emitted no items",
  },
  allrecipes: {
    migrationState: "blocked",
    latestCanary: "2026-08-16T07-10-37.070Z-attempt-0aa0d46c-d1fd-496f-81f0-ffbad7de385a",
    deferOrBlockReason:
      "Uncapped run persisted no recipes: the site answered discovery with HTTP 403 on four requests, so discovery never completed",
  },
  bbcgoodfood: {
    migrationState: "configured",
    latestCanary: "2026-08-16T08-47-33.153Z-attempt-0e25122a-89e2-4239-840e-676401df2229",
    deferOrBlockReason:
      "Uncapped run persisted 17004 recipes with complete discovery; 24 failed requests and 20 incomplete pages keep it short of a canary",
  },
  bertolli: {
    migrationState: "configured",
    latestCanary: "2026-08-18T09-25-59.830Z-attempt-7bf68bc2-a43b-4080-8e98-95efd18f2e37",
    deferOrBlockReason:
      "Uncapped run persisted 559 recipes with complete discovery; 7 blocked requests and 21 malformed pages keep it short of a canary",
  },
  bettycrocker: {
    migrationState: "configured",
    latestCanary: "2026-08-17T08-53-05.050Z-attempt-86195030-47bd-4018-bb4e-1206d9d13900",
    deferOrBlockReason:
      "Uncapped run persisted 6243 recipes with complete discovery; 52 failed requests and 4 incomplete pages keep it short of a canary",
  },
  delmonte: {
    migrationState: "configured",
    latestCanary: "2026-08-18T00-47-53.212Z-attempt-5f26efff-44f5-4df1-bd47-504a4dd1f28b",
    deferOrBlockReason:
      "Uncapped run persisted 4 recipes with complete discovery; 17 failed requests keep it short of a canary",
  },
  foodnetwork_uk: {
    migrationState: "configured",
    latestCanary: "2026-08-17T04-09-47.959Z-attempt-5442b968-b0cd-4876-a9f0-76b5dc5654bf",
    deferOrBlockReason:
      "Uncapped run persisted 12632 recipes with complete discovery; 2 failed requests and 232 incomplete pages keep it short of a canary",
  },
  jamieoliver: {
    migrationState: "configured",
    latestCanary: "2026-08-18T00-50-22.465Z-attempt-539679ea-c794-4c58-8e67-d873a0641a6b",
    deferOrBlockReason:
      "Uncapped run persisted 4466 recipes with complete discovery; 1 failed request and 12 incomplete pages keep it short of a canary",
  },
  nordicfoodliving: {
    migrationState: "configured",
    latestCanary: "2026-08-16T20-42-51.101Z-attempt-c3ccd963-f866-4391-9591-38a47075f175",
    deferOrBlockReason:
      "Uncapped run persisted 130 recipes with complete discovery; 25 blocked requests keep it short of a canary",
  },
  olivemagazine: {
    migrationState: "configured",
    latestCanary: "2026-08-17T02-09-19.447Z-attempt-46bbc79c-d951-4d5f-858a-e4dbe30e9559",
    deferOrBlockReason:
      "Uncapped run persisted 7265 recipes with complete discovery; 12 failed requests and 86 incomplete pages keep it short of a canary",
  },
  progresso: {
    migrationState: "configured",
    latestCanary: "2026-08-16T07-40-09.861Z-attempt-e4b6450c-7ba2-4a75-937a-02a646aed648",
    deferOrBlockReason:
      "Uncapped run persisted 22 recipes but discovery stopped because the listing canonicals point at a domain the source does not allow",
  },
  spam: {
    migrationState: "configured",
    latestCanary: "2026-08-16T20-08-48.852Z-attempt-418f3456-c0eb-4462-b07e-228dde978b75",
    deferOrBlockReason:
      "Uncapped run persisted 130 recipes with complete discovery; 25 failed requests and 2 malformed pages keep it short of a canary",
  },
  sunset: {
    migrationState: "configured",
    latestCanary: "2026-08-17T04-09-47.966Z-attempt-26aa1001-fc59-449a-b7bb-bc5268b4c2a0",
    deferOrBlockReason:
      "Uncapped run persisted 7230 recipes with complete discovery; 3 failed requests, 6 incomplete pages and 54 malformed pages keep it short of a canary",
  },
  tasteofhome: {
    migrationState: "configured",
    latestCanary: "2026-08-17T15-33-33.254Z-attempt-fb290c0e-c0a1-40d1-bbc3-2d1f1d2b082a",
    deferOrBlockReason:
      "Uncapped run persisted 20027 recipes with complete discovery; 5 blocked requests, 5 failed requests and 2 incomplete pages keep it short of a canary",
  },
  /**
   * A Nuxt app that serves no JSON-LD until hydration, so every page routes
   * through the browser. Only some recipes carry a Recipe block at all: a
   * rendered probe of /opskrifter/hovedretter/buche-de-noel exposes no
   * ld+json, while a persisted recipe exposes Brand, Recipe and
   * BreadcrumbList. The shortfall between candidates and recipes is that
   * source-side gap, not a rejection.
   */
  /**
   * First of the WordPress posts family to pass, and the proof its discovery
   * contract works end to end: the whole window is one page, so the run
   * exercises the terminal document rather than only continuation.
   */
  /**
   * The one rejected canonical is a syndicated guest post pointing at
   * fooddrinklife.com. Rejecting it is right — the recipe belongs to that
   * site, not this one — but it marks discovery incomplete on its own.
   */
  fannetasticfood: {
    migrationState: "configured",
    latestCanary: "2026-08-19T13-38-24.804Z-attempt-73aeb5e2-827c-4ba0-8e61-c8dd38a76625",
    deferOrBlockReason:
      "Uncapped run persisted 415 recipes from 2975 posts with no blocked request and no rejected JSON-LD; 53 requests timed out at the source and one syndicated post carries an off-domain canonical, which keeps it short of a canary",
  },
  cookingwithruthie: {
    migrationState: "blocked",
    latestCanary: "2026-08-19T15-14-32.823Z-attempt-60781b43-861d-40e1-8466-79000944db29",
    deferOrBlockReason:
      "Uncapped run persisted no recipes: 1 requests were blocked, so discovery could not complete",
  },
  smittenkitchen: {
    migrationState: "blocked",
    latestCanary: "2026-08-19T21-18-51.440Z-attempt-14b8f394-6bdf-40aa-b4d9-2015d9af785e",
    deferOrBlockReason:
      "Uncapped run persisted no recipes: 42 requests were blocked, so discovery could not complete",
  },
  allergylicious: {
    migrationState: "configured",
    latestCanary: "2026-08-19T15-14-26.506Z-attempt-e41f5546-983c-4a46-b9da-18d6f608bff7",
    deferOrBlockReason:
      "Uncapped run persisted 0 recipes from 0 posts; discovery that did not complete keeps it short of a canary",
  },
  brownedbutterblondie: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-20T06-29-23.252Z-attempt-823b9c33-a088-4f54-bab8-320e4fb91af5",
    deferOrBlockReason:
      "Uncapped run persisted 248 recipes over 283 requests with complete discovery and no blocked, failed or rejected record",
  },
  lowcarbdelish: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-41-01.873Z-attempt-bb9aaa3a-35a1-47e6-b58f-4a847fc3772d",
    deferOrBlockReason:
      "Uncapped run persisted 119 recipes from 135 candidates; 3 blocked requests keeps it short of a canary",
  },
  therealfoodrds: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-20T05-51-54.744Z-attempt-e3ba06a3-f9c8-4b2c-9f83-060a79b34e6a",
    deferOrBlockReason:
      "Uncapped run persisted 748 recipes from 928 posts with complete discovery and no blocked, failed or rejected record, once allowedDomains followed the rebrand to therealfooddietitians.com",
  },
  artfuldishes: {
    migrationState: "configured",
    latestCanary: "2026-08-19T15-09-49.512Z-attempt-3927fda5-a2bc-4bac-a576-cbc506fad67a",
    deferOrBlockReason:
      "Uncapped run persisted 0 recipes from 0 posts; 1 failed request and discovery that did not complete keeps it short of a canary",
  },
  projectmealplan: {
    migrationState: "configured",
    latestCanary: "2026-08-20T01-49-27.334Z-attempt-c2fabda1-ad6e-40f2-ae4e-0a4d3942cb8e",
    deferOrBlockReason:
      "Uncapped run persisted 0 recipes from 0 posts; 1 failed request and discovery that did not complete keeps it short of a canary",
  },
  closetcooking: {
    migrationState: "deferred",
    latestCanary: "2026-08-19T13-38-24.850Z-attempt-fd9985b7-e7dc-469a-9251-7d1be9f7d051",
    deferOrBlockReason:
      "Uncapped run processed all 1400 posts with complete discovery and no blocked or failed request, and none carried Recipe JSON-LD, so there is nothing for a strict JSON-LD crawl to extract",
  },
  asweetspoonful: {
    migrationState: "deferred",
    latestCanary: "2026-08-20T02-26-56.332Z-attempt-561591a5-f8e8-41d4-90e5-4a5bf56d3342",
    deferOrBlockReason:
      "Uncapped run processed all 388 posts with complete discovery and no blocked or failed request, and none carried Recipe JSON-LD, so there is nothing for a strict JSON-LD crawl to extract",
  },
  joyfulhealthyeats: {
    migrationState: "configured",
    latestCanary: "2026-08-19T21-40-46.724Z-attempt-3f1f02c8-a8d5-4357-a76b-9ef980cb67d2",
    deferOrBlockReason:
      "Uncapped run persisted 1078 recipes from 1191 posts; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  lavenderandlovage: {
    migrationState: "configured",
    latestCanary: "2026-08-19T16-42-48.471Z-attempt-1400462b-cccf-4d0d-99e9-5823f79c2316",
    deferOrBlockReason:
      "Uncapped run persisted 1079 recipes from 1765 posts; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  pinchofyum: {
    migrationState: "configured",
    latestCanary: "2026-08-19T20-10-56.360Z-attempt-96d2c5ca-c273-4013-9244-4f97bb464ea8",
    deferOrBlockReason:
      "Uncapped run persisted 1160 recipes from 1590 posts; discovery that did not complete keeps it short of a canary",
  },
  gimmesomeoven: {
    migrationState: "configured",
    latestCanary: "2026-08-19T20-04-01.468Z-attempt-3dfc888d-4547-4938-b601-75a753c7bbdc",
    deferOrBlockReason:
      "Uncapped run persisted 1237 recipes from 1361 posts; 19 failed requests keeps it short of a canary",
  },
  stegeso: {
    migrationState: "configured",
    latestCanary: "2026-08-19T15-11-54.184Z-attempt-127d9565-aea8-400d-ba09-bad52f84535e",
    deferOrBlockReason:
      "Uncapped run persisted 1 recipes from 26 posts; 50 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  rachlmansfield: {
    migrationState: "configured",
    latestCanary: "2026-08-19T18-57-04.004Z-attempt-a52c65fb-427c-4cbd-8a7b-0dfe00ac99a1",
    deferOrBlockReason:
      "Uncapped run persisted 1369 recipes from 1571 posts; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  orwhateveryoudo: {
    migrationState: "configured",
    latestCanary: "2026-08-19T20-39-24.554Z-attempt-876ed245-a332-48e1-be6b-6d8836b289cf",
    deferOrBlockReason:
      "Uncapped run persisted 1378 recipes from 1510 posts; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  thatskinnychickcanbake: {
    migrationState: "configured",
    latestCanary: "2026-08-19T19-34-51.297Z-attempt-e10f9b86-eb95-4ea2-96c2-27acf694c944",
    deferOrBlockReason:
      "Uncapped run persisted 1522 recipes from 1615 posts; 1 failed request keeps it short of a canary",
  },
  rockrecipes: {
    migrationState: "configured",
    latestCanary: "2026-08-19T17-10-44.450Z-attempt-803e2ab7-6591-4e32-b57c-af4caaaba5ea",
    deferOrBlockReason:
      "Uncapped run persisted 1646 recipes from 1917 posts; 6 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  aggieskitchen: {
    migrationState: "configured",
    latestCanary: "2026-08-19T23-50-16.550Z-attempt-27b6c415-e4b9-4501-b4e4-d04d55085a2a",
    deferOrBlockReason:
      "Uncapped run persisted 215 recipes from 892 posts; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  grownupdish: {
    migrationState: "configured",
    latestCanary: "2026-08-20T01-02-34.609Z-attempt-a3ff64e8-034e-4651-a138-41ebde5d90e6",
    deferOrBlockReason:
      "Uncapped run persisted 229 recipes from 539 posts; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  acouplecooks: {
    migrationState: "configured",
    latestCanary: "2026-08-19T13-38-24.768Z-attempt-255791ab-755e-4bad-b9ec-6d52d4b6a113",
    deferOrBlockReason:
      "Uncapped run persisted 3197 recipes from 4022 posts; 53 failed requests keeps it short of a canary",
  },
  nyssaskitchen: {
    migrationState: "configured",
    latestCanary: "2026-08-20T02-42-35.608Z-attempt-64b34f70-1282-4378-b57c-12980e8c34fc",
    deferOrBlockReason:
      "Uncapped run persisted 344 recipes from 350 posts; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  carrotstick: {
    migrationState: "configured",
    latestCanary: "2026-08-20T00-38-40.345Z-attempt-c7147cd9-b95a-4658-9f84-e6f81a1c1fe5",
    deferOrBlockReason:
      "Uncapped run persisted 381 recipes from 595 posts; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  peaceloveandlowcarb: {
    migrationState: "configured",
    latestCanary: "2026-08-20T01-23-36.166Z-attempt-a62f74b6-9859-4511-8a49-dd78c64e227c",
    deferOrBlockReason:
      "Uncapped run persisted 431 recipes from 500 posts; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  bellalimento: {
    migrationState: "configured",
    latestCanary: "2026-08-20T00-56-43.296Z-attempt-3d6d79a8-4143-4c87-acea-555f090a4247",
    deferOrBlockReason:
      "Uncapped run persisted 478 recipes from 645 posts; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  withspice: {
    migrationState: "configured",
    latestCanary: "2026-08-20T01-28-54.536Z-attempt-fdc1b130-f422-4ba0-92f8-129128e0d46b",
    deferOrBlockReason:
      "Uncapped run persisted 490 recipes from 491 posts; 12 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  perrysplate: {
    migrationState: "configured",
    latestCanary: "2026-08-20T01-24-27.517Z-attempt-ce8914a9-890d-4810-8a22-7af8b2fd424d",
    deferOrBlockReason:
      "Uncapped run persisted 499 recipes from 581 posts; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  greedygourmet: {
    migrationState: "configured",
    latestCanary: "2026-08-19T22-30-31.254Z-attempt-88af4181-4d11-41f1-8994-062bb6f55302",
    deferOrBlockReason:
      "Uncapped run persisted 57 recipes from 100 posts; 1 failed request and discovery that did not complete keeps it short of a canary",
  },
  joythebaker: {
    migrationState: "configured",
    latestCanary: "2026-08-19T18-25-11.630Z-attempt-452ea23c-85ce-48bf-8bab-1296ffa3bccb",
    deferOrBlockReason:
      "Uncapped run persisted 609 recipes from 1748 posts; 27 blocked requests and 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  thehealthymaven: {
    migrationState: "configured",
    latestCanary: "2026-08-19T21-44-21.936Z-attempt-63207f43-7e6a-4579-afb8-84c193befabb",
    deferOrBlockReason:
      "Uncapped run persisted 662 recipes from 1036 posts; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  goodlifeeats: {
    migrationState: "configured",
    latestCanary: "2026-08-19T21-26-49.446Z-attempt-5be79d7f-5baa-43de-8af4-68e332010d26",
    deferOrBlockReason:
      "Uncapped run persisted 927 recipes from 1102 posts; 1 failed request keeps it short of a canary",
  },
  shelikesfood: {
    migrationState: "configured",
    latestCanary: "2026-08-19T20-59-30.448Z-attempt-8f712af5-ee34-4ddc-9a62-36fbccc9de9e",
    deferOrBlockReason:
      "Uncapped run persisted 935 recipes from 1090 posts; 23 failed requests and 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  kalynskitchen: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-19T19-04-02.228Z-attempt-ab086a4d-f681-4032-ae44-c639b3a96ec0",
    deferOrBlockReason:
      "Uncapped run persisted 1071 recipes from 1660 posts with complete discovery and no blocked, failed or rejected record",
  },
  lundoaagaard: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T02-57-48.980Z-attempt-53e3b917-dd5f-4bf5-8d22-161627db0d38",
    shadowParity:
      "1/1 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 1-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 1 recipes with every material field matching; the record keeps a cuisine legacy has no field for",
  },
  smaagroenneskridt: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T02-58-55.873Z-attempt-cfa591f9-d111-42d8-a9eb-0c6589c1df1a",
    shadowParity:
      "1/1 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 1-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 1 recipes with every material field matching; the record keeps the published 1.75 yield that legacy reduces to its leading integer 1",
  },
  babybite: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T02-27-20.482Z-attempt-6ed7b7c9-3175-4d13-97f8-e7b6c977dece",
    shadowParity:
      "14/14 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 14-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 14 recipes with every material field matching; 11 records keep a cuisine legacy has no field for",
  },
  cookiesandcups: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-19T17-51-43.918Z-attempt-ed5ddaac-20f8-4ab2-a5a2-87a0aee110b1",
    deferOrBlockReason:
      "Uncapped run persisted 1474 recipes from 1632 posts with complete discovery and no blocked, failed or rejected record",
  },
  afamilyfeast: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-19T16-30-26.970Z-attempt-e245d57e-29ff-4693-a304-c404d47ea324",
    deferOrBlockReason:
      "Uncapped run persisted 1977 recipes from 2060 posts with complete discovery and no blocked, failed or rejected record",
  },
  coupleinthekitchen: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T01-07-15.917Z-attempt-84bc9ed4-2e22-4ea7-9e61-8ff89c472bd8",
    shadowParity:
      "206/206 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 206-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 206 recipes with every material field matching; 181 records keep a cuisine legacy has no field for",
  },
  bakerella: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T00-09-06.438Z-attempt-6d889840-1d5d-437a-96dd-d173caf168bf",
    shadowParity:
      "213/213 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 213-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 213 recipes with every material field matching; every taxonomy value matches as published",
  },
  kokkeriermedpassion: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T02-58-42.024Z-attempt-4f0d1e9d-9336-4d3f-854f-41bc06c1f78f",
    shadowParity:
      "2/2 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 2-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 2 recipes with every material field matching; every taxonomy value matches as published",
  },
  abakershouse: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T02-02-50.107Z-attempt-576cbb40-471f-4e53-858a-fbf7f264c47e",
    shadowParity:
      "230/230 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 230-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 230 recipes with every material field matching; 230 records keep a cuisine legacy has no field for",
  },
  gatheranddine: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-20T02-17-55.597Z-attempt-c9a21778-fa46-4728-8a3e-2d9b1db320a7",
    deferOrBlockReason:
      "Uncapped run persisted 243 recipes from 225 posts with complete discovery and no blocked, failed or rejected record",
  },
  moderncrumb: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-20T01-51-32.159Z-attempt-bf8dd063-7eee-4129-ae25-f12daedf63de",
    deferOrBlockReason:
      "Uncapped run persisted 290 recipes from 292 posts with complete discovery and no blocked, failed or rejected record",
  },
  breadtopia: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-20T01-47-17.589Z-attempt-4da2795a-7294-42af-b4f9-39187059a32d",
    deferOrBlockReason:
      "Uncapped run persisted 353 recipes from 501 posts with complete discovery and no blocked, failed or rejected record",
  },
  thecastawaykitchen: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-20T01-44-10.244Z-attempt-d2a2eae9-a45d-4adf-804a-96cbd8f8d315",
    deferOrBlockReason:
      "Uncapped run persisted 367 recipes from 452 posts with complete discovery and no blocked, failed or rejected record",
  },
  butternutbakeryblog: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-20T02-02-14.600Z-attempt-794c2d48-c249-4c0f-ade0-5075636c9577",
    deferOrBlockReason:
      "Uncapped run persisted 369 recipes from 388 posts with complete discovery and no blocked, failed or rejected record",
  },
  tasteandsee: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-20T02-08-33.437Z-attempt-f3ef8a1f-368d-4dc8-803e-a21e80c81133",
    deferOrBlockReason:
      "Uncapped run persisted 411 recipes from 458 posts with complete discovery and no blocked, failed or rejected record",
  },
  nannapretzmann: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T00-43-21.459Z-attempt-eae81eb9-758f-445f-bec9-61aa3d3f2fc0",
    shadowParity:
      "41/41 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 41-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 41 recipes with every material field matching; 3 records keep a cuisine legacy has no field for and 2 keep a yield legacy reduces to its first integer",
  },
  annsentitledlife: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-19T15-23-05.567Z-attempt-eba71083-16e0-4282-a8df-ede1473f6d54",
    deferOrBlockReason:
      "Uncapped run persisted 457 recipes from 2054 posts with complete discovery and no blocked, failed or rejected record",
  },
  thecookful: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-20T00-12-02.988Z-attempt-7346b12e-67c3-4095-aefe-c23e878f35f3",
    deferOrBlockReason:
      "Uncapped run persisted 540 recipes from 799 posts with complete discovery and no blocked, failed or rejected record",
  },
  thehappierhomemaker: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-19T23-39-29.465Z-attempt-8ba048ef-ea77-4860-b0b7-e7993eaebdae",
    deferOrBlockReason:
      "Uncapped run persisted 655 recipes from 823 posts with complete discovery and no blocked, failed or rejected record",
  },
  anicula: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T02-58-21.065Z-attempt-4d5e350b-8a85-40fd-a990-177979e360bd",
    shadowParity:
      "6/6 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 6-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 6 recipes with every material field matching; every taxonomy value matches as published",
  },
  choosingchia: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-20T00-23-59.362Z-attempt-1737d4cc-945f-40d2-8626-070f757a1e6c",
    deferOrBlockReason:
      "Uncapped run persisted 730 recipes from 821 posts with complete discovery and no blocked, failed or rejected record",
  },
  thecakeblog: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-19T22-35-18.108Z-attempt-6fdfc236-15a5-4ddf-8169-d476d995681a",
    shadowParity:
      "74/74 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 74-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 74 recipes with every material field matching; 27 records keep a cuisine legacy has no field for",
  },
  basisvarer: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T02-33-43.716Z-attempt-8281ca52-7461-46e9-9efe-e424c8884e37",
    shadowParity:
      "82/82 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 82-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 82 recipes with every material field matching; 14 records keep a cuisine legacy has no field for",
  },
  sweetsimplevegan: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-19T23-34-16.053Z-attempt-8726aa0c-d13f-424b-b8fa-e3bbf8e84fe1",
    deferOrBlockReason:
      "Uncapped run persisted 838 recipes from 879 posts with complete discovery and no blocked, failed or rejected record",
  },
  tidymom: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-19T17-51-25.388Z-attempt-5cb21c6a-2b7b-466d-95ac-255b8ab29620",
    deferOrBlockReason:
      "Uncapped run persisted 842 recipes from 1852 posts with complete discovery and no blocked, failed or rejected record",
  },
  cookieandkate: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-19T23-02-56.177Z-attempt-b6a88566-8e2d-409f-ab59-44edbb93339d",
    deferOrBlockReason:
      "Uncapped run persisted 851 recipes from 924 posts with complete discovery and no blocked, failed or rejected record",
  },
  pickledplum: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-19T22-11-04.771Z-attempt-5299ca8e-88ec-49ed-bed2-879b481d04d3",
    deferOrBlockReason:
      "Uncapped run persisted 889 recipes from 1018 posts with complete discovery and no blocked, failed or rejected record",
  },
  inspiredtaste: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-19T22-26-00.841Z-attempt-0778054c-70da-4b64-bf93-1878e41bf3bd",
    deferOrBlockReason:
      "Uncapped run persisted 891 recipes from 938 posts with complete discovery and no blocked, failed or rejected record",
  },
  lazycatkitchen: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-19T22-52-58.737Z-attempt-3dbd16c9-fa56-47ba-83b1-817b736baec2",
    deferOrBlockReason:
      "Uncapped run persisted 933 recipes from 941 posts with complete discovery and no blocked, failed or rejected record",
  },
  opskrifterforalle: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-19T23-12-00.704Z-attempt-8449e358-a32f-46f6-b474-efa64307fd35",
    deferOrBlockReason:
      "Uncapped run persisted 939 recipes from 939 posts with complete discovery and no blocked, failed or rejected record",
  },
  gunris: {
    migrationState: "shadow_passed",
    numericYieldOnly: true,
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-19T22-15-09.284Z",
    shadowParity:
      "5/5 recipes and every material legacy field match exactly",
    deferOrBlockReason:
      "The uncapped WordPress API crawl and full Scrapy run emitted the same five recipes with exact field parity and no blocked, failed, rejected, storage, or domain record",
  },
  familiejournal: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-18T15-37-57.655Z-attempt-7803e70d-5e95-4878-ab42-ba783293cbd4",
    deferOrBlockReason:
      "Uncapped run persisted 993 recipes from 6432 discovered candidates with complete discovery and no blocked, failed or rejected record; the remaining candidates publish no Recipe JSON-LD even after rendering",
  },
  /**
   * Its robots.txt advertises /sitemap.xml, and that endpoint never answers:
   * three direct attempts hung to 30s and 45s while the site root answered
   * 200 in about a second, so this is the sitemap hanging rather than the
   * host refusing us. Mullvad relays did not help; the one relay that
   * connected could not reach the root either.
   */
  ricardocuisine: {
    migrationState: "blocked",
    latestCanary: "2026-08-18T22-57-31.732Z-attempt-c4b4055c-297d-41c5-b94e-a964363de304",
    deferOrBlockReason:
      "Uncapped run persisted no recipes: the only advertised sitemap, https://www.ricardocuisine.com/sitemap.xml, times out, so discovery never started",
  },
  nordmad: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-18T14-55-50.641Z-attempt-d734001e-4e9c-42fc-807a-9047ccf5a977",
    deferOrBlockReason:
      "Uncapped run persisted 719 recipes with complete discovery and no blocked, failed or rejected record",
  },
  oetker: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-18T14-24-59.150Z-attempt-66da8895-574b-4e42-8b0f-fdc20c5d9888",
    deferOrBlockReason:
      "Uncapped run persisted 806 recipes with complete discovery and no blocked, failed or rejected record",
  },
  odensemarcipan: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-18T13-45-21.279Z-attempt-f3be8023-e4c2-4645-80e2-08752d997dc1",
    deferOrBlockReason:
      "Uncapped run persisted 1026 recipes with complete discovery and no blocked, failed or rejected record",
  },
  nogetiovnen: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-18T09-40-09.367Z-attempt-7887aaad-74c8-4c12-b66d-a12c31a16d02",
    deferOrBlockReason:
      "Uncapped run persisted 3098 recipes with complete discovery and no blocked, failed or rejected record",
  },
  bobsredmill: {
    migrationState: "configured",
    latestCanary: "2026-08-18T10-40-06.655Z-attempt-ccf075fd-ed04-4a77-9483-63fd07c5968e",
    deferOrBlockReason:
      "Uncapped run persisted 2867 recipes with complete discovery and no blocked or failed request; 30 incomplete pages keep it short of a canary",
  },
  gastrotools: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-15T21-55-50.447Z-attempt-ed8926bc-e8c3-4ebf-bdfd-5b60dcd6a759",
    deferOrBlockReason:
      "Uncapped run persisted 222 recipes with complete discovery and no blocked, failed or rejected record",
  },
  gigtforeningen: {
    discovery: "listing",
    sitemapUrls: [],
    startUrls: [
      "https://www.gigtforeningen.dk/wp-json/wp/v2/posts?per_page=100&page=1&_fields=id,link,title,content,yoast_head_json",
    ],
    recipeExtractor: "gigtforeningen-wp-html",
    migrationState: "shadow_passed",
    latestScrapyOutcome: "failed",
    latestCanary: "2026-08-19T22-16-01.893Z",
    shadowParity:
      "legacy-unhealthy; two current API runs emitted the same 70 stable normalized recipes",
    deferOrBlockReason:
      "The former recipe routes now redirect to the homepage and the full Scrapy sitemap crawl failed; two uncapped Crawlee API runs each recovered all 70 authoritative WordPress recipe bodies with identical keys and normalized records, complete discovery, and no failed, blocked, rejected, storage, or domain record",
  },
  iform: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-15T22-08-06.459Z-attempt-060c6cf8-a514-4802-be0a-2a5acc83025c",
    deferOrBlockReason:
      "Uncapped run persisted 1664 recipes with complete discovery and no blocked or failed request; eleven pages carry Recipe JSON-LD without required fields and stay rejected",
  },
  jonsmadklub: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-19T23-00-20.113Z",
    shadowParity: "106/106 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two post-fix uncapped Crawlee runs completed all 112 requests and emitted identical 106-record keys and normalized content; the full Scrapy run emitted the same recipes and every material field matches after supporting numeric Schema.org recipeYield values",
  },
  kystfisken: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-19T23-13-21.191Z",
    shadowParity: "136/136 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two current uncapped Crawlee runs completed all 145 requests and emitted identical 136-record keys and normalized content; the full Scrapy run emitted the same recipes and every material field matches after comparing escaped category markup as rendered text. Both parsers reject the same incomplete recipe page",
  },
  campari: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-16T07-11-05.017Z-attempt-fad14e1a-f942-4e10-bdd8-786fdb0bb9e3",
    shadowParity: "100% legacy coverage; 5 complete recipes recovered",
    deferOrBlockReason:
      "Three uncapped Crawlee runs stably persisted seven complete recipes with no operational failures; every material field matches on both records emitted by the full Scrapy run, Crawlee correctly retains five additional complete sibling Recipe nodes that the legacy parser drops from a multi-recipe page, and both reject the same incomplete CAMPARI & SODA node",
  },
  foodnotes: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-16T07-12-57.130Z-attempt-3dbf3ede-20bf-4260-9a6e-0e9c332d1389",
    shadowParity: "100% required fields; additive yield units and cuisines",
    deferOrBlockReason:
      "Three uncapped Crawlee runs and the full Scrapy run emitted the same 13 recipes with exact legacy-field parity and no operational failures; both reject the same five incomplete recipe pages, Crawlee now counts those only on the terminal rendered attempt instead of double-counting Cheerio plus Playwright, and V2 intentionally retains full yield text and cuisines that Scrapy truncates or drops",
  },
  /**
   * The sitemap index resolves and its one nested sitemap fetches, but nothing
   * inside matches the recipe URL patterns, so the crawl finds no candidates.
   */
  canadianliving: {
    migrationState: "deferred",
    deferOrBlockReason:
      "Sitemap resolves but yields zero recipe candidates; the inherited recipe URL patterns do not match this site's routes",
  },
  ingridhornshoj: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-16T07-57-42.724Z-attempt-cc9d33b4-376e-401c-8d21-5a1fc8d4c89b",
    deferOrBlockReason:
      "Uncapped run persisted 159 recipes with complete discovery and no blocked, failed or rejected record",
  },
  christinaskoekken: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-16T08-04-11.505Z-attempt-a06f7670-5bde-451d-86ed-d075b801b8aa",
    deferOrBlockReason:
      "Uncapped run persisted 168 recipes with complete discovery and no blocked, failed or rejected record",
  },
  skalvibage: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-16T08-10-49.446Z-attempt-0c4e7904-65bc-41b7-afe5-993835a42619",
    deferOrBlockReason:
      "Uncapped run persisted 175 recipes with complete discovery and no blocked, failed or rejected record",
  },
  kokke: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-16T08-17-59.514Z-attempt-4627bee1-e611-4f9c-acb1-8fb8ee7cf2da",
    deferOrBlockReason:
      "Uncapped run persisted 200 recipes with complete discovery and no blocked, failed or rejected record",
  },
  lurpak: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-16T08-25-46.444Z-attempt-57281cb6-110a-42b6-9766-efcee413d49f",
    deferOrBlockReason:
      "Uncapped run persisted 211 recipes with complete discovery and no blocked, failed or rejected record",
  },
  /**
   * Clean enough to crawl but the JSON-LD coverage is poor: far more pages
   * carry a Recipe node without required fields than carry a usable one.
   */
  planetariskkogebog: {
    migrationState: "configured",
    latestCanary: "2026-08-16T08-34-08.262Z-attempt-c26cc8bb-3025-4b7b-a15d-692bc5860429",
    deferOrBlockReason:
      "Uncapped run kept 72 recipes but rejected 225 incomplete and 12 malformed, and took 23 blocked requests, so JSON-LD coverage needs review before a canary",
  },
  mambeno: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-16T06-50-45.335Z-attempt-9174a211-fa66-485f-99ca-8551c4219708",
    deferOrBlockReason:
      "Uncapped run persisted all 3614 discovered recipes with complete discovery and no blocked, failed or rejected record",
  },
  mutti: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-16T19-42-28.068Z-attempt-86ce30d4-c634-408a-b7d0-446580e2ef7e",
    deferOrBlockReason:
      "Uncapped run persisted 251 recipes with complete discovery and no blocked or failed request; eighteen pages carry Recipe JSON-LD without required fields and stay rejected",
  },
  madsvin: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-16T19-53-55.878Z-attempt-26f18f5e-6460-4d1d-8ada-da0bbad623da",
    deferOrBlockReason:
      "Uncapped run persisted 203 recipes with complete discovery and no blocked, failed or rejected record",
  },
  madfolket: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-16T20-54-15.391Z-attempt-e5e15d29-2aac-43b7-9825-300a410530f3",
    deferOrBlockReason:
      "Uncapped run persisted 283 recipes with complete discovery and no blocked, failed or rejected record",
  },
  /**
   * Recipe nodes carry name, url, image, prepTime and rating but neither
   * recipeIngredient nor recipeInstructions, so nothing meets the strict
   * contract. The same shape as Netto.
   */
  edmonds_nz: {
    migrationState: "deferred",
    latestCanary: "2026-08-16T21-05-37.548Z",
    deferOrBlockReason:
      "Recipe JSON-LD omits required ingredients and instructions: 559 of 589 crawled pages rejected as incomplete and nothing persisted",
  },
  /**
   * Recipe nodes carry real ingredients, yields and times but omit
   * recipeInstructions entirely, so no page meets the strict contract.
   */
  tillamook: {
    migrationState: "deferred",
    latestCanary: "2026-08-16T21-30-44.891Z-attempt-5b482c3c-dd5c-4c8e-9ae0-8d8581d196f3",
    deferOrBlockReason:
      "Recipe JSON-LD carries ingredients but omits instructions: 592 of 593 crawled pages rejected as incomplete and nothing persisted",
  },
  amo: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-16T22-08-10.261Z-attempt-ef57339f-1f89-4d73-a389-8d94d0643f39",
    deferOrBlockReason:
      "Uncapped run persisted 307 recipes with complete discovery and no blocked, failed or rejected record",
  },
  gastrologik: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-16T22-50-44.665Z-attempt-a553d41f-f674-4742-bbe1-da3ca5ce024d",
    deferOrBlockReason:
      "Uncapped run persisted 312 recipes with complete discovery and no blocked, failed or rejected record",
  },
  hverdagskoekken: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-16T23-18-35.130Z-attempt-dfce028d-b735-4dd8-a4f7-f4701fa70722",
    deferOrBlockReason:
      "Uncapped run persisted 375 recipes with complete discovery and no blocked, failed or rejected record",
  },
  /**
   * A real recipe page emits WebPage, BreadcrumbList and SearchAction markup
   * and no Recipe node at all, so a strict JSON-LD crawl finds nothing.
   */
  avocadosfrommexico: {
    migrationState: "deferred",
    latestCanary: "2026-08-18T00-48-57.865Z-attempt-13d7c3fb-5ea4-4275-81ee-895577d9c9da",
    deferOrBlockReason:
      "No Recipe JSON-LD node on any of 440 crawled pages, only WebPage and site navigation markup; confirmed by a complete rerun after case-insensitive type matching",
  },
  /**
   * Ingredient strings carry unescaped inch marks, as in
   * "10 stk Santa Maria Tortilla 10"", which ends the JSON string early.
   * Repairing an unescaped quote inside a value is ambiguous, so those pages
   * stay rejected.
   */
  santamariaworld: {
    migrationState: "configured",
    latestCanary: "2026-08-17T01-08-09.402Z-attempt-662cae2c-d747-4791-bdad-a25aa246d76c",
    deferOrBlockReason:
      "Uncapped run persisted 422 recipes with no blocked or failed request, but 94 scripts carry an unescaped quote inside an ingredient string and stay malformed",
  },
  revivafit: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-17T01-29-50.068Z-attempt-41ecb1dc-7ac6-4406-9cae-2384040ef20a",
    deferOrBlockReason:
      "Uncapped run persisted 494 recipes with complete discovery and no blocked or failed request; four pages carry Recipe JSON-LD without required fields and stay rejected",
  },
  rosekylling: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-17T01-49-02.475Z-attempt-208ba086-e26c-4e06-a98b-f0c499ad3203",
    deferOrBlockReason:
      "Uncapped run persisted 472 recipes with complete discovery and no blocked or failed request; six pages carry Recipe JSON-LD without required fields and stay rejected",
  },
  /**
   * Cloudflare answers almost every recipe request with HTTP 403. The few that
   * pass carry only Organization and WebSite markup, so nothing is persisted.
   * Cheerio-only, so the automation-marker fix does not apply here.
   */
  tesco_recipes: {
    migrationState: "blocked",
    latestCanary: "2026-08-17T04-09-47.964Z-attempt-62c053ec-05b4-4c99-a4b3-2c85e768c78f",
    deferOrBlockReason:
      "Cloudflare returned HTTP 403 on 7724 requests across 530 processed pages and nothing was persisted",
  },
  madogdrikke: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-17T15-07-04.733Z-attempt-d21edf83-5518-40a1-9f1b-4dda2bdf7236",
    deferOrBlockReason:
      "Uncapped run persisted 4966 recipes with complete discovery and no blocked or failed request; 24 pages carry Recipe JSON-LD without required fields and stay rejected",
  },
  landolakes: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-17T16-07-23.692Z-attempt-a446a2ab-6d30-4094-a071-de1e767ee1c1",
    deferOrBlockReason:
      "Uncapped run persisted all 2782 discovered recipes with complete discovery and no blocked, failed or rejected record",
  },
  mariavestergaard: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-17T18-08-07.752Z-attempt-806f9d5e-cd86-4d2e-b94b-f6efbdf5e387",
    deferOrBlockReason:
      "Uncapped run persisted 585 recipes with complete discovery and no blocked or failed request; 26 pages carry Recipe JSON-LD without required fields and stay rejected",
  },
  madenimitliv: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-17T17-53-30.793Z-attempt-6144e967-0179-4dea-9e1b-dbe93cce986b",
    deferOrBlockReason:
      "Uncapped run persisted 1101 recipes with complete discovery and no blocked or failed request; eight pages carry Recipe JSON-LD without required fields and stay rejected",
  },
  pillsbury: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-17T19-04-36.093Z-attempt-020f6baf-8cd7-4e37-b54b-2e01f6ed2357",
    deferOrBlockReason:
      "Uncapped run persisted all 2275 discovered recipes with complete discovery and no blocked, failed or rejected record",
  },
  udeoghjemme: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-17T21-16-47.814Z-attempt-b7bc62dc-97fa-4033-a9e0-da7242d58faf",
    deferOrBlockReason:
      "Uncapped run persisted all 503 discovered recipes with complete discovery and no blocked, failed or rejected record",
  },
  /**
   * Emits its recipe type in lowercase. Before type matching folded case the
   * crawl processed 702 pages and persisted nothing, reading as an empty
   * source rather than a broken one.
   */
  frederikkewaerens: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-17T22-36-29.973Z-attempt-50710db1-c5c7-4b30-a88c-757de4e91336",
    deferOrBlockReason:
      "Uncapped run persisted 3350 recipes with complete discovery and no blocked or failed request; 37 pages carry Recipe JSON-LD without required fields and stay rejected",
  },
  greatbritishchefs: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-17T19-01-03.684Z-attempt-c5170a42-0672-4712-baf0-736039d73883",
    deferOrBlockReason:
      "Uncapped run persisted all 7020 discovered recipes with complete discovery and no blocked, failed or rejected record",
  },
  bornemenuen: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-17T23-28-26.237Z-attempt-6ad03698-68af-46a2-b017-7f194660caa1",
    deferOrBlockReason:
      "Uncapped run persisted 641 recipes with complete discovery and no blocked or failed request; four pages carry Recipe JSON-LD without required fields and stay rejected",
  },
  imerco: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-18T00-21-27.720Z-attempt-6777a367-f56e-4504-b1cc-74dbbc80957d",
    deferOrBlockReason:
      "Uncapped rerun after the concatenated-canonical fix completed discovery and persisted 175 recipes with no blocked or failed request; two pages carry Recipe JSON-LD without required fields",
  },
  castello: {
    migrationState: "configured",
    latestCanary: "2026-08-18T00-21-27.852Z-attempt-af471038-05b2-4e2b-9a3a-12aa1724f8a3",
    deferOrBlockReason:
      "Crawl is clean but the source's sitemap lists dead URLs: one sitemap URL 404s, so the run cannot reach zero failed requests",
  },
  fevertree: {
    migrationState: "configured",
    latestCanary: "2026-08-18T00-35-08.655Z-attempt-04d3507e-e389-4808-9993-f1df0505d9d4",
    deferOrBlockReason:
      "Crawl is clean but the source's sitemap lists dead URLs: sitemap lists /da-dk/cocktails/espresso-martini, which 404s, so the run cannot reach zero failed requests",
  },
  oatly: {
    migrationState: "configured",
    latestCanary: "2026-08-18T00-44-53.871Z-attempt-f587a99b-3e70-40a4-b850-295f6884a1ef",
    deferOrBlockReason:
      "Crawl is clean but the source's sitemap lists dead URLs: four sitemap URLs 404, including /da-dk/recipes/pink-dragon-mocha, so the run cannot reach zero failed requests",
  },
  /**
   * Its pages pair each recipe with a bare @type/@id reference stub. Those were
   * counted as incomplete recipes until node references were skipped, which is
   * why an otherwise clean run reported one rejection per page.
   */
  puredansk: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-18T09-06-20.859Z-attempt-6838e4c6-586c-4e74-8529-3e6a63fb77a8",
    deferOrBlockReason:
      "Uncapped rerun persisted all 365 discovered recipes with complete discovery and no blocked, failed or rejected record",
  },
  kenwoodworld: {
    migrationState: "configured",
    latestCanary: "2026-08-16T07-12-15.987Z-attempt-6419ff46-16cd-41bd-893f-ea05ac51121e",
    deferOrBlockReason:
      "Listing continues through a script-only load-more control; needs a discovery contract for its continuation route",
  },
  kikkoman: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-15T23-25-27.820Z-attempt-6f1cdd5f-5e2d-4cee-b14c-c786765a0550",
    deferOrBlockReason:
      "Uncapped run persisted 836 recipes with complete discovery and no blocked, failed or rejected record, validating the literal-control-character JSON-LD repair",
  },
  gamleopskrifter: {
    discovery: "sitemap",
    sitemapUrls: ["https://gamleopskrifter.com/sitemap.xml"],
    startUrls: [],
    recipeUrlPatterns: [
      "^https://gamleopskrifter\\.com/g/home/r/[^/?#]+/?$",
    ],
    migrationState: "shadow_passed",
    latestScrapyOutcome: "failed",
    latestCanary: "2026-08-19T23-58-25.765Z",
    shadowParity:
      "legacy-unhealthy; 5/5 representative current recipes match every material field",
    deferOrBlockReason:
      "The legacy listing route now returns 404 and the full Scrapy run emitted no data. Two current sitemap-backed Crawlee runs each completed 117 requests and emitted the same 116 recipes with identical keys and normalized records and no operational failures; direct legacy parsing of five representative current pages matched every material field after comparing escaped taxonomy as rendered text",
  },
  /**
   * Recipe pages answer plain HTTP clients with an HTTP 454 browser check that
   * a real browser clears once per session, so the source is fetched with
   * Playwright rather than Cheerio.
   */
  sundpaabudget: {
    fetchMode: "playwright",
    migrationState: "canary_passed",
    latestCanary:
      "2026-08-14T13-52-17.878Z-attempt-2ffecbef-29ff-49fe-a03d-1f755641f881",
    deferOrBlockReason:
      "Uncapped run processed all 517 discovered pages with no blocked or failed request; five pages carry Recipe JSON-LD without required fields and stay rejected",
  },
  klinksgaard: {
    migrationState: "blocked",
    latestCanary: "2026-08-19T19-59-27.000Z",
    deferOrBlockReason:
      "The configured sitemap, sitemap indexes, WordPress REST API, and homepage all return HTTP 401 Security Verification; hardened Chromium remained on the challenge after eight seconds, so no public discovery route is currently usable",
  },
  netto: {
    migrationState: "deferred",
    latestCanary: PILOT_CANARY_RUN,
    deferOrBlockReason: "Recipe JSON-LD omits required ingredients and instructions",
  },
};

const LEGACY_DEFAULT_REQUEST_SETTINGS = {
  delaySeconds: 2,
  rateLimitPerMinute: null,
  maxConcurrency: 2,
  maxRetries: 3,
} as const;

const LEGACY_REQUEST_SETTING_OVERRIDES: Record<
  string,
  Partial<DanishJsonLdSource["requestSettings"]>
> = {
  bareencocktail: { maxConcurrency: 1 },
  bornholms: { maxConcurrency: 1 },
  coop: { delaySeconds: 3, maxConcurrency: 1 },
  glutenfrimagi: { maxConcurrency: 1 },
  glyngoere: { maxConcurrency: 1 },
  kenwoodworld: { maxConcurrency: 1 },
  kitchenaid: { maxConcurrency: 1 },
  klank: { maxConcurrency: 1 },
  knaehoejkarse: { maxConcurrency: 1 },
  madrejsen: { maxConcurrency: 1 },
  madsvin: { delaySeconds: 3, maxConcurrency: 1 },
  mariavestergaard: { delaySeconds: 3, maxConcurrency: 1 },
  nogetiovnen: { delaySeconds: 3, maxConcurrency: 1 },
  spicytwist: { maxConcurrency: 1 },
  spisekunst: { maxConcurrency: 1 },
  surdejsentusiasten: { maxConcurrency: 1 },
  allrecipes: { delaySeconds: 3, maxConcurrency: 1 },
  bettycrocker: { delaySeconds: 3, maxConcurrency: 1 },
  pillsbury: { delaySeconds: 3, maxConcurrency: 1 },
  tasteofhome: { delaySeconds: 3, maxConcurrency: 1 },
};

/**
 * Effective values from the legacy project defaults plus spider-level overrides.
 * The raw class declarations are intentionally kept separate because several
 * listing spiders inherit their recipe patterns and request settings.
 */
const DANISH_WPRM_EVIDENCE_OVERRIDES: Record<
  string,
  Partial<Pick<
    DanishJsonLdSource,
    "migrationState" | "latestScrapyOutcome" | "latestCanary" | "shadowParity" | "deferOrBlockReason"
  >>
> = {
  gastrofun: {
    migrationState: "configured",
    latestScrapyOutcome: "partial",
    latestCanary: "2026-08-19T15-51-22.062Z",
    deferOrBlockReason:
      "Bounded page-1 shadow probe matched Scrapy on all 100 recipes and material normalized fields; two Crawlee probes produced identical keys and records, but the 38-page catalog still requires an uncapped run",
  },
  ketoliv: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-19T20-33-21.809Z",
    shadowParity:
      "578/578 complete records matched every required field across the full six-page catalog; 69 records intentionally add WPRM named-step prefixes",
    deferOrBlockReason:
      "The uncapped seven-request Crawlee and legacy runs both processed all 581 candidates, rejected the same three incomplete recipes, and emitted the same 578-record URL set with exact titles, ingredients, step counts, times, yields, images, and taxonomy; 509 instruction arrays are text-identical, while Crawlee intentionally preserves named-step prefixes on 69 records that legacy discards",
  },
  airfryerkogebogen: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-20T07-00-48.628Z-attempt-f6e01992-3c26-40ba-b7c1-d83c5fc54c52",
    deferOrBlockReason:
      "Uncapped run persisted the whole 4930-record catalog over 51 requests with complete discovery and no blocked, failed or rejected record, after a transient HTTP 500 on page 46 had cut an earlier run short at 4500. The legacy comparison is still outstanding: the source began answering HTTP 500 to every request at both page sizes shortly afterwards, and two legacy runs gave up on page 1, so the shadow run needs to wait for the source to recover rather than be retried against it",
  },
  airfryermad: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-28-17.136Z-attempt-5fa9d999-48a4-4c6e-932a-5ca156ce317c",
    shadowParity:
      "125/125 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 125-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 125 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  albertestengaard: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-29-31.976Z-attempt-d324335a-8bcc-435f-9628-6672d0c05073",
    shadowParity:
      "320/320 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 320-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 320 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  alcayaga: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-29-32.150Z-attempt-cfac90d7-6a88-4be1-92cf-6d2d13399508",
    deferOrBlockReason:
      "Uncapped run persisted 366 recipes from 383 candidates; 17 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  altmad: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-33-02.658Z-attempt-42ceae33-3c0c-420d-a802-d62d660f05f2",
    shadowParity:
      "159/159 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 159-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 159 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  amorsmadklub: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-28-26.169Z-attempt-3f0999e5-fca7-4fc3-9093-bc047e7e248f",
    deferOrBlockReason:
      "Uncapped run persisted 362 recipes from 363 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  annamaddk: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-46-57.244Z-attempt-19584595-ef0b-488d-a4bf-65180a7062f4",
    shadowParity:
      "662/662 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 662-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 662 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  annesondergaard: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-29-52.708Z-attempt-11988fea-e1df-41f1-8e54-0b4362b34a24",
    deferOrBlockReason:
      "Uncapped run persisted 218 recipes from 219 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  avocadoen: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-29-55.186Z-attempt-a1595929-7e9a-4b1d-80cb-e65e3c892b93",
    deferOrBlockReason:
      "Uncapped run persisted 198 recipes from 208 candidates; 10 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  bageglad: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-33-36.305Z-attempt-cb9fcdae-d1e4-44aa-8284-003ddd06d181",
    deferOrBlockReason:
      "Uncapped run persisted 453 recipes from 455 candidates; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  bagvrk: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-46-57.243Z-attempt-3b041fdb-2fd9-47b9-afa5-739f4ecd1538",
    deferOrBlockReason:
      "Uncapped run persisted 468 recipes from 469 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  baregomad: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-46-57.175Z-attempt-327013a4-410a-4fee-a6d2-2bff111afcfe",
    deferOrBlockReason:
      "Uncapped run persisted 168 recipes from 169 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  bedstemorskogebog: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-28-41.097Z-attempt-3970a0e8-c69a-4944-b293-918e5e26de6e",
    deferOrBlockReason:
      "Uncapped run persisted 2 recipes from 3 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  benedictesmad: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-30-03.339Z-attempt-25e7fe46-1f7a-4b26-8c62-d5bd3a12b517",
    deferOrBlockReason:
      "Uncapped run persisted 1139 recipes from 1145 candidates; 6 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  bergholts: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-30-12.137Z-attempt-2f16f84b-019c-481a-a4ed-27b456cf97b6",
    deferOrBlockReason:
      "Uncapped run persisted 16 recipes from 17 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  bondemad: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-20T06-47-20.826Z-attempt-b2054fb9-cead-47d1-8648-8070dcb2de1e",
    latestScrapyOutcome: "succeeded",
    shadowParity:
      "20/20 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 20-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 20 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list",
  },
  camillemaja: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-33-55.443Z-attempt-cbdbf41a-30d0-44bb-9da6-49be89faa2a0",
    shadowParity:
      "137/137 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 137-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 137 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  chilisauce: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-20T06-47-17.983Z-attempt-b07fd995-c5d2-475b-936d-02ddc4b87bb4",
    latestScrapyOutcome: "succeeded",
    shadowParity:
      "19/19 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 19-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 19 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list",
  },
  chokomils: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-28-47.165Z-attempt-555cfb64-2308-4b6a-9f19-be11c3078be4",
    deferOrBlockReason:
      "Uncapped run persisted 73 recipes from 74 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  cookingclub: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-30-34.813Z-attempt-f0bb9b08-9a70-4487-bb65-db0faa062842",
    shadowParity:
      "139/139 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 139-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 139 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list. Crawlee additionally keeps the WPRM named-step prefixes on 136 records that legacy drops",
  },
  dagenstallerken: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-53-10.208Z-attempt-3d414432-50b7-4e10-91c0-35f89e1cec1a",
    deferOrBlockReason:
      "Uncapped run persisted 517 recipes from 531 candidates; 14 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  danishthings: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-30-17.965Z-attempt-08459155-91f9-4447-92c6-6fe587c13c88",
    deferOrBlockReason:
      "Uncapped run persisted 482 recipes from 485 candidates; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  dansktang: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-34-04.178Z-attempt-3ff1c980-9281-4257-8bbb-0cefb52f5bdf",
    deferOrBlockReason:
      "Uncapped run persisted 38 recipes from 39 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  drkoch: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-47-28.501Z-attempt-bb514b70-db47-469a-ba0b-5ad39617c808",
    shadowParity:
      "185/185 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 185-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 185 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list. Crawlee additionally keeps the WPRM named-step prefix on one record that legacy drops",
  },
  emmaolsen: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-28-53.723Z-attempt-fbe88a78-f4df-48d2-8e05-0c30f02fbc27",
    shadowParity:
      "569/569 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 569-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 569 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  frahaventilmaven: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-30-50.671Z-attempt-18510c9f-434d-4066-ac69-51bac8a62165",
    shadowParity:
      "612/612 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 612-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 612 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  frukreativ: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-20T06-50-09.412Z-attempt-65ab1c84-d021-4f58-a949-d1ab3b6a75b9",
    latestScrapyOutcome: "succeeded",
    shadowParity:
      "15/15 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 15-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 15 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list",
  },
  fuldkorn: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-34-14.785Z-attempt-bd9063a9-6b43-4e40-a03d-3f25cf0e03b8",
    shadowParity:
      "164/164 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 164-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 164 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  gastromad: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-29-12.892Z-attempt-f2fcc778-b568-4449-9a00-909feb78b742",
    shadowParity:
      "761/761 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 761-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 761 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  gastromand: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-47-27.695Z-attempt-b0254fb9-9079-4cf7-bce1-0b576b50a26f",
    deferOrBlockReason:
      "Uncapped run persisted 779 recipes from 785 candidates; 6 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  gastry: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-20T06-31-13.548Z-attempt-5a0d9786-29f6-4353-b97d-5b41ccf6040b",
    latestScrapyOutcome: "succeeded",
    shadowParity:
      "93/93 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 93-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 93 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list",
  },
  gourministeriet: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-47-19.688Z-attempt-f99d21c1-d3ae-4f80-9d72-133e5b7bfea5",
    deferOrBlockReason:
      "Uncapped run persisted 1499 recipes from 1500 candidates; 1 record the source publishes incomplete or malformed and 1 failed request and discovery that did not complete (unreported) keeps it short of a canary",
  },
  grilltips: {
    migrationState: "deferred",
    latestCanary: "2026-08-20T06-31-01.633Z-attempt-a8346b55-5dcd-4cb5-bb1f-7ba4136ed886",
    deferOrBlockReason:
      "Uncapped run completed discovery with no blocked or failed request and the wprm_recipe collection is empty, while the site still publishes 499 posts carrying WPRM markup, so the legacy API route no longer exposes this source's recipes",
  },
  groedgrisen: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-34-28.232Z-attempt-524a1ccc-7446-4f8a-8ad3-54f7b76df1bd",
    deferOrBlockReason:
      "Uncapped run persisted 314 recipes from 317 candidates; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  hashtagmor: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-47-40.186Z-attempt-3e0a5788-b07c-4402-9388-1bcdacde1755",
    deferOrBlockReason:
      "Uncapped run persisted 413 recipes from 415 candidates; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  homebybianca: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-29-35.286Z-attempt-cb862c0d-7ade-4396-976a-879f300d1f96",
    deferOrBlockReason:
      "Uncapped run persisted 302 recipes from 308 candidates; 6 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  hurtigmums: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-31-22.005Z-attempt-f2b70552-8bf4-4115-9ad8-f040941481d1",
    deferOrBlockReason:
      "Uncapped run persisted 1043 recipes from 1046 candidates; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  hverdagsro: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-31-08.471Z-attempt-18b1278c-ef31-45fc-8618-7a1ad5176bbb",
    shadowParity:
      "598/598 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 598-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 598 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  italienskvinogmad: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-34-40.971Z-attempt-74761676-568a-4482-b8c6-a2d3d2257fc0",
    shadowParity:
      "119/119 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 119-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 119 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  jensensmadblog: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-20T06-29-52.699Z-attempt-743f1bf2-cc55-457e-8e9b-af6299523e0b",
    latestScrapyOutcome: "succeeded",
    shadowParity:
      "69/69 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 69-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 69 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list",
  },
  johanjohansen: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-20T06-31-57.449Z-attempt-87a368bf-6d36-4736-aa94-3b281780e931",
    latestScrapyOutcome: "succeeded",
    shadowParity:
      "92/92 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 92-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 92 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list",
  },
  juliebruun: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-31-23.345Z-attempt-921d1374-f88d-4d61-b85e-3024e46cbaf3",
    shadowParity:
      "392/392 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 392-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 392 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  juliekarla: {
    migrationState: "blocked",
    latestCanary: "2026-08-20T07-08-06.457Z-attempt-0fe28461-f50e-4cd0-9c34-65b662b91ca9",
    deferOrBlockReason:
      "Three uncapped runs across two cooldowns each reached the discovery request and stayed on an HTTP 454 browser check that the in-session browser retries did not clear, so no candidate was ever admitted",
  },
  kagefest: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-30-00.049Z-attempt-0b784ba1-5e8c-4b88-b9d6-a8c5ff9ce541",
    deferOrBlockReason:
      "Uncapped run persisted 126 recipes from 135 candidates; 9 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  karinabaagoe: {
    migrationState: "deferred",
    latestCanary: "2026-08-20T06-32-04.288Z-attempt-d90d7622-e7d5-4d14-9c73-a553f0420b94",
    deferOrBlockReason:
      "Uncapped run completed discovery with no blocked or failed request and the wprm_recipe collection is empty, while the site still publishes 72 posts carrying WPRM markup, so the legacy API route no longer exposes this source's recipes",
  },
  koudahl: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-45-51.924Z-attempt-98e4251f-e2ba-4bee-b5b7-02835da6a5da",
    deferOrBlockReason:
      "Uncapped run persisted 329 recipes from 331 candidates; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  letmad: {
    migrationState: "blocked",
    latestCanary: "2026-08-20T07-08-01.787Z-attempt-cc1043c9-10b6-4ad2-b069-7ddd7849a610",
    deferOrBlockReason:
      "The source's entire WordPress REST API answers 404, including the wprm_recipe collection the legacy spider reads, so the legacy discovery route is dead and no uncapped run is possible until a current route is identified",
  },
  louiogbearnaisen: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-45-56.807Z-attempt-440a5d45-58eb-438d-86c5-7ebdef880f99",
    deferOrBlockReason:
      "Uncapped run persisted 833 recipes from 834 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  louisesmadblog: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-32-12.202Z-attempt-a6486025-f729-42ea-b2a3-5d19cb521ecf",
    shadowParity:
      "912/912 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 912-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 912 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list. One ingredient carries zero-width characters mid-string that Crawlee strips and legacy keeps, which is the same visible text",
  },
  madbanditten: {
    migrationState: "blocked",
    latestCanary: "2026-08-20T07-00-48.718Z-attempt-71f95d80-dac5-44ea-8df9-84c8dc457a7c",
    deferOrBlockReason:
      "Two uncapped attempts had the discovery request time out after 30 seconds with no response, and the endpoint does not answer a plain request either, so the source is unreachable rather than misconfigured",
  },
  madensverden: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-34-58.364Z-attempt-9bbbfb08-9956-4f1d-9af9-bc86885b9f61",
    deferOrBlockReason:
      "Uncapped run persisted 3877 recipes from 4095 candidates; 218 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  madentusiasten: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-30-39.230Z-attempt-a0748d77-264f-49bd-a273-06cab8ed2c0c",
    deferOrBlockReason:
      "Uncapped run persisted 221 recipes from 222 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  madfilosofie: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-47-57.804Z-attempt-a860eb4d-e6e3-4e33-8136-b876ca3e833f",
    deferOrBlockReason:
      "Uncapped run persisted 99 recipes from 100 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  madmors: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-48-07.540Z-attempt-47267e8e-4035-439b-9e23-948a0af79a2f",
    deferOrBlockReason:
      "Uncapped run persisted 35 recipes from 36 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  madmusen: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-32-49.829Z-attempt-de671512-6209-4181-a2ae-ac5c3adc3f62",
    deferOrBlockReason:
      "Uncapped run persisted 998 recipes from 999 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  madogkaerlighed: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-39-01.279Z-attempt-27c98799-f899-419f-b731-11b5608ee5e7",
    shadowParity:
      "698/698 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 698-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 698 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  madogmonopolet: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-47-57.912Z-attempt-9a0b1907-015a-4921-aa47-043518f02f8c",
    deferOrBlockReason:
      "Uncapped run persisted 423 recipes from 424 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  madskribent: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-20T06-36-24.710Z-attempt-72a2e23f-76f7-477c-a55d-f3f5d717c1ad",
    latestScrapyOutcome: "succeeded",
    shadowParity:
      "22/22 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 22-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 22 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list",
  },
  majspassion: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-30-50.119Z-attempt-c906f1c7-c2d7-4d6c-a0a1-0d014ca8948c",
    deferOrBlockReason:
      "Uncapped run persisted 936 recipes from 938 candidates; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  marialottes: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-33-13.331Z-attempt-1340964a-c247-49fe-978c-0aed5cfba180",
    shadowParity:
      "1060/1060 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 1060-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 1060 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list. Crawlee additionally keeps the WPRM named-step prefix on one record that legacy drops",
  },
  mariasilje: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-39-19.884Z-attempt-0c2d7a10-3258-41d9-8cc3-58a6fca7ed92",
    shadowParity:
      "302/302 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 302-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 302 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  mettesmadmagi: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-48-07.490Z-attempt-c7bcd35d-8edb-4e94-95df-e413902882f6",
    deferOrBlockReason:
      "Uncapped run persisted 381 recipes from 382 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  minmadopskrift: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-36-30.605Z-attempt-096e3be8-cb09-4c38-86d0-fea4f97112b7",
    deferOrBlockReason:
      "Uncapped run persisted 743 recipes from 744 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  minopskrift: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-20T06-31-26.922Z-attempt-ffeb6559-91ea-4878-9459-466941d317bc",
    latestScrapyOutcome: "succeeded",
    shadowParity:
      "9/9 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 9-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 9 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list",
  },
  muttionline: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-33-43.222Z-attempt-011aba1b-3018-47b4-a52d-225378898e33",
    shadowParity:
      "502/502 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 502-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 502 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  nemlchf: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-20T06-39-34.042Z-attempt-9aa54621-fdcd-4b9c-b950-9536728998c2",
    latestScrapyOutcome: "succeeded",
    shadowParity:
      "12/12 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 12-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 12 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list",
  },
  nerdytreats: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-48-16.077Z-attempt-17785511-adcc-4f85-b0e9-93d25fea4688",
    deferOrBlockReason:
      "Uncapped run persisted 325 recipes from 327 candidates; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  newyorkerbyheart: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-36-54.628Z-attempt-27452fe1-a8e2-4a3c-9293-65d32eccb8d8",
    shadowParity:
      "496/496 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 496-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 496 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  onekitchenblog: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-31-35.126Z-attempt-37ba4a75-50a4-4987-aea1-fcd8b46e8880",
    shadowParity:
      "634/634 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 634-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 634 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  opskrifteriet: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-34-06.033Z-attempt-719d7673-050b-43ab-91b5-6647e552667c",
    deferOrBlockReason:
      "Uncapped run persisted 322 recipes from 323 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  opskriftnet: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-39-40.487Z-attempt-f673709e-e564-4e4e-b33c-a2b7b9c45cc1",
    shadowParity:
      "1408/1408 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 1408-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 1408 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  opskriftorg: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-37-09.117Z-attempt-5cee3b51-a3bf-4503-9898-1e896121f4a9",
    shadowParity:
      "911/911 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 911-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 911 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  pigenikoekkenet: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-31-55.137Z-attempt-82d35be9-0101-491d-b91f-267819c8c99c",
    deferOrBlockReason:
      "Uncapped run persisted 232 recipes from 235 candidates; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  pilenskoekken: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-48-16.568Z-attempt-24a22fd8-201f-4489-8c57-864c99fe55a7",
    shadowParity:
      "71/71 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 71-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 71 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list. The legacy spider emitted nothing on its first run after its robots preflight answered HTTP 403, and emitted all 71 on the repeat, so the comparison rests on the healthy run",
  },
  planteaederen: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-53-32.986Z-attempt-cc1802d2-7027-42c5-a0b5-d6878f9f3116",
    shadowParity:
      "36/36 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 36-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 36 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  rasmussmedstrup: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-34-16.725Z-attempt-2ebc3b49-a058-4e77-b7e1-a6856e3815e2",
    deferOrBlockReason:
      "Uncapped run persisted 142 recipes from 161 candidates; 19 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  rigeligtsmor: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-40-17.496Z-attempt-bd6e9db0-8b49-43f6-8021-2a3c1355a15e",
    shadowParity:
      "246/246 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 246-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 246 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  sabinasverden: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-37-36.586Z-attempt-8f4cc491-4c85-4003-97f7-b1a6418509a2",
    deferOrBlockReason:
      "Uncapped run persisted 4 recipes from 6 candidates; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  sixpm: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-32-09.891Z-attempt-009d5923-d5db-489d-bf32-8f2c5a30436e",
    deferOrBlockReason:
      "Uncapped run persisted 234 recipes from 235 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  sundfamiliemad: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-34-25.106Z-attempt-64125a45-f991-478a-99ca-e7194e4f2bde",
    deferOrBlockReason:
      "Uncapped run persisted 11 recipes from 37 candidates; 26 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  sundmor: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-20T06-40-28.446Z-attempt-d10edd50-1482-4b49-bd3b-34e5c3876b12",
    latestScrapyOutcome: "succeeded",
    shadowParity:
      "40/40 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 40-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 40 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list",
  },
  surdejmedsophie: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-37-44.918Z-attempt-9f213d51-a583-4c3b-b64c-9db50d3f8add",
    deferOrBlockReason:
      "Uncapped run persisted 164 recipes from 166 candidates; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  twinfood: {
    migrationState: "shadow_passed",
    latestCanary: "2026-08-20T06-48-31.739Z-attempt-4d52cb28-4a98-4da0-a7a2-f6b5c6a4eb8f",
    latestScrapyOutcome: "succeeded",
    shadowParity:
      "49/49 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 49-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 49 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list",
  },
  veganernu: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-32-21.007Z-attempt-eef36db1-83c8-4fcb-ab75-40c0f9336c9b",
    shadowParity:
      "265/265 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 265-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 265 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
  vforvegetarisk: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-48-24.902Z-attempt-af5b1e93-9a2a-4110-8596-de7ef8088309",
    deferOrBlockReason:
      "Uncapped run persisted 625 recipes from 626 candidates; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  vielskermad: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-34-31.648Z-attempt-3e19f39c-0971-49c4-a730-79212f403883",
    shadowParity:
      "270/270 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 270-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 270 recipes with every material field matching; Crawlee intentionally keeps the published cuisine in its own field instead of folding it into legacy's tag list.",
  },
};

/**
 * WPRM serves its recipe collection through one WordPress query, so a page size
 * the site cannot build answers HTTP 500 with an empty body rather than a short
 * page. koudahl fails that way at the default 100 and serves 50 reliably, so
 * the size is per-source; the offset step follows it so pagination stays whole.
 */
const WPRM_PAGE_SIZE_OVERRIDES: Record<string, number> = {
  koudahl: 50,
};

const DEFAULT_WPRM_PAGE_SIZE = 100;

const DANISH_WPRM_SOURCES: DanishJsonLdSource[] =
  DANISH_WPRM_SOURCE_DEFINITIONS.map(([
    id,
    legacySpider,
    domain,
    apiUrl,
    usePlaywright,
    delaySeconds,
    maxConcurrency,
  ]) => ({
    id,
    domain,
    allowedDomains: [domain],
    legacySpider,
    legacyFamily: "WprmApiSpider",
    discovery: "listing",
    sitemapUrls: [],
    startUrls: [
      `${apiUrl}?per_page=${WPRM_PAGE_SIZE_OVERRIDES[id] ?? DEFAULT_WPRM_PAGE_SIZE}&page=1`,
    ],
    recipeUrlPatterns: ["^https?://"],
    listingDiscovery: {
      ...LEGACY_LISTING_DISCOVERY_DEFAULT,
      ...WP_POSTS_LISTING_DISCOVERY,
    },
    fetchMode: usePlaywright ? "playwright" : "cheerio",
    requestSettings: {
      delaySeconds,
      rateLimitPerMinute: null,
      maxConcurrency,
      maxRetries: 3,
    },
    requireCompleteJsonLd: true,
    migrationState: "not_started",
    latestScrapyOutcome: "not_audited",
    ...DANISH_WPRM_EVIDENCE_OVERRIDES[id],
  }));

/**
 * Live-run evidence for the WordPress posts sources added after the generated
 * registry. Their posts APIs are browser-fetched, which is why they all sat at
 * zero recipes until the rendered JSON viewer document was unwrapped.
 */
const DANISH_WP_POSTS_EVIDENCE_OVERRIDES: Record<
  string,
  Partial<DanishJsonLdSource>
> = {
  mummum: {
    migrationState: "configured",
    latestScrapyOutcome: "partial",
    latestCanary: "2026-08-19T16-20-34.637Z",
    deferOrBlockReason:
      "Bounded three-request live canary persisted both sampled recipes without request, extraction, storage, or domain failures; both overlapping Scrapy records matched all material recipe fields, while Crawlee intentionally preserves the full yield text that legacy reduced to an integer, and the 35-page catalog remains unvalidated",
  },
  dittejulie: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-10-47.943Z-attempt-a2f54483-89a1-43a9-8721-ae2b4d6dc0e5",
    deferOrBlockReason:
      "Uncapped run persisted 386 recipes from 547 candidates; 14 records the source publishes incomplete or malformed and 5 failed requests keeps it short of a canary",
  },
  hoerup: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-32-51.851Z-attempt-c1d1e7c0-eae0-4e78-b684-703558694690",
    shadowParity:
      "38/38 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 38-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 38 recipes with every material field matching; 3 records keep a cuisine legacy has no field for, and Crawlee recovers 4 sibling recipes from a five-recipe New Year's menu page that legacy reduces to one. This source discovered nothing at all until the browser's rendered JSON viewer document was unwrapped, so the parity run is what confirms the fix",
  },
  hverdagsgourmet: {
    migrationState: "blocked",
    latestCanary: "2026-08-20T06-56-03.722Z-attempt-d2c46716-8807-4a1f-8145-26a8633edd6e",
    deferOrBlockReason:
      "The source restricts its WordPress REST API: the posts collection the legacy spider reads answers HTTP 401 itsec_rest_api_access_restricted on every attempt, so the legacy discovery route is closed for both implementations while the sitemap route remains unproven behind the host's browser check",
  },
  madhang: {
    migrationState: "configured",
    latestCanary: "2026-08-20T06-42-34.363Z-attempt-cfd8f004-bebf-4857-a6ee-e2ae1bd5c865",
    deferOrBlockReason:
      "Uncapped run persisted 55 recipes from 62 candidates; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  madopskriften: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-10-47.857Z-attempt-973ff000-3430-4220-8a99-48f9a830d437",
    shadowParity:
      "146/146 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 146-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 146 recipes with every material field matching; 143 records keep a cuisine legacy has no field for. This source discovered nothing at all until the browser's rendered JSON viewer document was unwrapped, so the parity run is what confirms the fix",
  },
  madopskriftertilairfryer: {
    migrationState: "blocked",
    latestCanary: "2026-08-20T06-56-09.488Z-attempt-ed95b5a8-b0fd-477a-b26d-a7203e56752f",
    deferOrBlockReason:
      "The whole site answers HTTP 500 with the WordPress critical-error page, homepage included, behind a simply.com browser check; the source is down rather than misconfigured",
  },
  nemmadplan: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-53-15.094Z-attempt-47c96967-a58f-42ef-806e-8f2735eae4bd",
    shadowParity:
      "32/32 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 32-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 32 recipes with every material field matching; 3 records keep a cuisine legacy has no field for. This source discovered nothing at all until the browser's rendered JSON viewer document was unwrapped, so the parity run is what confirms the fix",
  },
  opskriftslageret: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-10-47.809Z-attempt-3ce6368c-f076-4157-a511-a70982654308",
    shadowParity:
      "159/159 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 159-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 159 recipes with every material field matching; one record keeps a cuisine legacy has no field for. This source discovered nothing at all until the browser's rendered JSON viewer document was unwrapped, so the parity run is what confirms the fix",
  },
  veganermor: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T06-17-01.886Z-attempt-196a8813-cc9d-4599-ad31-0b1bab1dbea7",
    shadowParity:
      "298/298 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 298-record keys and normalized content across 586 requests with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 298 recipes with every material field matching; 10 records keep a cuisine legacy has no field for. This source discovered nothing at all until the browser's rendered JSON viewer document was unwrapped, so the parity run is what confirms the fix",
  },
};

const NEW_DANISH_WP_POSTS_SOURCES: DanishJsonLdSource[] =
  DANISH_WP_POSTS_SOURCE_DEFINITIONS.map(([
    id,
    legacySpider,
    domain,
    postsApiUrl,
    usePlaywright,
  ]) => ({
    id,
    domain,
    allowedDomains: [domain],
    legacySpider,
    legacyFamily: "WpPostsJsonLdSpider",
    discovery: "listing",
    sitemapUrls: [],
    startUrls: [`${postsApiUrl}?per_page=100&page=1`],
    recipeUrlPatterns: ["^https?://"],
    listingDiscovery: {
      ...LEGACY_LISTING_DISCOVERY_DEFAULT,
      ...WP_POSTS_LISTING_DISCOVERY,
    },
    fetchMode: usePlaywright === false ? "cheerio" : "playwright",
    requestSettings: {
      delaySeconds: 2,
      rateLimitPerMinute: null,
      maxConcurrency: 1,
      maxRetries: 3,
    },
    requireCompleteJsonLd: true,
    migrationState: "not_started",
    latestScrapyOutcome: "not_audited",
    ...DANISH_WP_POSTS_EVIDENCE_OVERRIDES[id],
  }));

const CUSTOM_DANISH_JSONLD_SOURCES: DanishJsonLdSource[] =
  DANISH_CUSTOM_JSONLD_SOURCE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    domain: definition.domain,
    allowedDomains: [definition.domain],
    legacySpider: definition.legacySpider,
    legacyFamily: "CustomSitemapSpider",
    discovery: "sitemap",
    sitemapUrls: [definition.sitemapUrl],
    startUrls: [],
    recipeUrlPatterns: [definition.recipeUrlPattern],
    sitemapDiscovery: {
      followPatterns: [...definition.followPatterns],
      skipUrlFragments: [...definition.skipUrlFragments],
    },
    fetchMode: "cheerio",
    requestSettings: {
      delaySeconds: definition.delaySeconds,
      rateLimitPerMinute: null,
      maxConcurrency: definition.maxConcurrency,
      maxRetries: 3,
    },
    requireCompleteJsonLd: true,
    migrationState: "configured",
    latestScrapyOutcome: "partial",
    latestCanary: "2026-08-19T16-01-22.287Z",
    deferOrBlockReason:
      "Bounded live crawl discovered 341 candidates and persisted complete Recipe JSON-LD without request, rejection, or domain failures; Scrapy close concurrency selected a different eight-URL window, so an uncapped shadow comparison is still required",
  }));

const CUSTOM_DANISH_LISTING_JSONLD_SOURCES: DanishJsonLdSource[] =
  DANISH_CUSTOM_LISTING_JSONLD_SOURCE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    domain: definition.domain,
    allowedDomains: [definition.domain],
    legacySpider: definition.legacySpider,
    legacyFamily: "CustomListingSpider",
    discovery: "listing",
    sitemapUrls: [],
    startUrls: [definition.startUrl],
    recipeUrlPatterns: [definition.recipeUrlPattern],
    listingDiscovery: {
      recipeLinkSelectors: ["a[href]"],
      skipPathFragments: [...definition.skipPathFragments],
      continuationSelectors: [
        "a.next[href]",
        "a.page-numbers.next[href]",
        "link[rel~=\"next\"][href]",
      ],
      continuationUrlPatterns: ["/opskrifter/page/\\d+/?$"],
    },
    fetchMode: "cheerio",
    requestSettings: {
      delaySeconds: definition.delaySeconds,
      rateLimitPerMinute: null,
      maxConcurrency: definition.maxConcurrency,
      maxRetries: 3,
    },
    requireCompleteJsonLd: true,
    ...(definition.id === "kagerogsager" ? { numericYieldOnly: true as const } : {}),
    migrationState: definition.id === "kagerogsager" ? "shadow_passed" : "configured",
    ...(definition.id === "vegetariskhverdag" ? {
      latestScrapyOutcome: "partial" as const,
      latestCanary: "2026-08-19T16-23-14.879Z",
      deferOrBlockReason:
        "Bounded four-request live canary discovered 24 candidates and persisted three complete recipes with no failures or rejections; direct Scrapy parsing of an overlapping URL matched all material recipe fields, while the legacy bounded feed run exposed its existing __provides__ exporter failure and the full paginated listing remains unvalidated",
    } : definition.id === "kagerogsager" ? {
      latestScrapyOutcome: "partial" as const,
      latestCanary: "2026-08-19T19-21-03.129Z",
      shadowParity:
        "9/9 legacy-discovered recipes and every material field matched; Crawlee recovered 106 additional complete recipes by following all 13 Shopify listing pages",
      deferOrBlockReason:
        "Two full Crawlee runs naturally completed all 13 listing pages with 115 stable complete recipes and no operational failures; the 116th article is an intentional paid-recipe notice without recipe data, while Scrapy stopped after page one because it ignores Shopify link[rel=next] pagination",
    } : {
      latestScrapyOutcome: "not_audited" as const,
      deferOrBlockReason:
        "Registered from the legacy custom listing contract; bounded live extraction and comparable Scrapy evidence are still required",
    }),
  }));

const EMBEDDED_DANISH_RECIPE_SOURCES: DanishJsonLdSource[] =
  DANISH_EMBEDDED_JSON_SOURCE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    domain: definition.domain,
    allowedDomains: [definition.domain],
    legacySpider: definition.legacySpider,
    legacyFamily: "EmbeddedJsonSitemapSpider",
    discovery: "sitemap",
    sitemapUrls: [definition.sitemapUrl],
    startUrls: [],
    recipeUrlPatterns: [definition.recipeUrlPattern],
    sitemapDiscovery: { followPatterns: [], skipUrlFragments: [] },
    fetchMode: "cheerio",
    requestSettings: {
      delaySeconds: definition.delaySeconds,
      rateLimitPerMinute: null,
      maxConcurrency: definition.maxConcurrency,
      maxRetries: 3,
    },
    requireCompleteJsonLd: true,
    recipeExtractor: definition.extractor,
    migrationState: "configured",
    latestScrapyOutcome: "partial",
    latestCanary: "2026-08-19T16-11-30.677Z",
    deferOrBlockReason:
      "Bounded live probe persisted the selected embedded recipe with material-field parity against a direct Scrapy parse and no request, extraction, or domain failures; the 2000-URL sitemap still requires uncapped validation",
  }));

const HTML_DANISH_RECIPE_SOURCES: DanishJsonLdSource[] =
  DANISH_HTML_RECIPE_SOURCE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    domain: definition.domain,
    allowedDomains: [definition.domain],
    legacySpider: definition.legacySpider,
    legacyFamily: "HtmlMicrodataSitemapSpider",
    discovery: "sitemap",
    sitemapUrls: [definition.sitemapUrl],
    startUrls: [],
    recipeUrlPatterns: [definition.recipeUrlPattern],
    sitemapDiscovery: {
      followPatterns: [...definition.followPatterns],
      skipUrlFragments: [],
    },
    fetchMode: "cheerio",
    requestSettings: {
      delaySeconds: definition.delaySeconds,
      rateLimitPerMinute: null,
      maxConcurrency: definition.maxConcurrency,
      maxRetries: 3,
    },
    requireCompleteJsonLd: true,
    recipeExtractor: definition.extractor,
    migrationState: "configured",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-19T16-16-22.434Z",
    deferOrBlockReason:
      "Bounded live probe persisted complete microdata recipes without request, extraction, or domain failures; direct Scrapy comparison matched the selected recipe while Crawlee intentionally preserves visible fractional amounts and normalized step positions, but the full catalog remains unvalidated",
  }));

const DIRECT_DANISH_RECIPE_API_SOURCES: DanishJsonLdSource[] = [{
  id: "meyers",
  domain: "meyers.dk",
  allowedDomains: ["meyers.dk", "dbvg5cs2.api.sanity.io"],
  legacySpider: "MeyersSpider",
  legacyFamily: "SanityRecipeApiSpider",
  discovery: "listing",
  sitemapUrls: [],
  startUrls: [MEYERS_SANITY_URL],
  recipeUrlPatterns: ["^https?://(?:www\\.)?meyers\\.dk/opskrifter/[^/?#]+/?$"],
  listingDiscovery: {
    recipeLinkSelectors: [],
    skipPathFragments: [],
    continuationSelectors: [],
    continuationUrlPatterns: [],
  },
  fetchMode: "cheerio",
  requestSettings: {
    delaySeconds: 1,
    rateLimitPerMinute: null,
    maxConcurrency: 1,
    maxRetries: 3,
  },
  requireCompleteJsonLd: true,
  migrationState: "shadow_passed",
  latestScrapyOutcome: "succeeded",
  latestCanary: "2026-08-19T16-28-11.559Z",
  shadowParity:
    "1123/1123 complete records matched; 30 legacy-only records were incomplete and intentionally rejected",
  deferOrBlockReason:
    "Full public Sanity catalog shadow matched all 1123 complete records across material fields; Crawlee intentionally rejected 30 incomplete legacy records and preserves instruction section headings that legacy discarded, so only downstream cutover remains",
}];

const RECURSIVE_MICRODATA_LISTING_SOURCES: DanishJsonLdSource[] = [{
  id: "dkkogebogen",
  domain: "dk-kogebogen.dk",
  allowedDomains: ["dk-kogebogen.dk"],
  legacySpider: "DkKogebogenSpider",
  legacyFamily: "CustomListingSpider",
  discovery: "listing",
  sitemapUrls: [],
  startUrls: [
    "https://www.dk-kogebogen.dk/kategorier/",
    "https://www.dk-kogebogen.dk/retter/",
  ],
  recipeUrlPatterns: ["^/opskrifter/\\d+/[^/?#]+/?$"],
  listingDiscovery: {
    recipeLinkSelectors: ['a[href*="/opskrifter/"]'],
    skipPathFragments: [],
    continuationSelectors: [
      'a[href*="/kategorier/"]',
      'a[href*="/retter/"]',
      'a[rel~="next"][href]',
    ],
    continuationUrlPatterns: ["^/(?:kategorier|retter)/"],
    continuationForefront: true,
    recipeForefront: true,
  },
  fetchMode: "cheerio",
  requestSettings: { delaySeconds: 3, rateLimitPerMinute: null, maxConcurrency: 1, maxRetries: 3 },
  requireCompleteJsonLd: true,
  recipeExtractor: "dkkogebogen-microdata",
  migrationState: "canary_passed",
  latestScrapyOutcome: "partial",
  latestCanary: "2026-08-19T18-54-31.972Z",
  deferOrBlockReason:
    "Depth-first bounded canary persisted seven recipes without operational failures and every material field matched the legacy parser on those exact pages; Crawlee uses final numeric request URLs to avoid the site's stale cross-recipe canonical collisions, while the roughly 39000-recipe hierarchy remains unvalidated",
}];

const CUSTOM_DANISH_WPRM_SOURCES: DanishJsonLdSource[] =
  DANISH_CUSTOM_WPRM_SOURCE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    domain: definition.domain,
    allowedDomains: [definition.domain],
    legacySpider: definition.legacySpider,
    legacyFamily: "CustomWprmApiSpider",
    discovery: "listing",
    sitemapUrls: [],
    startUrls: [`${definition.apiUrl}?per_page=100&page=1`],
    recipeUrlPatterns: ["^https?://"],
    listingDiscovery: {
      ...LEGACY_LISTING_DISCOVERY_DEFAULT,
      ...WP_POSTS_LISTING_DISCOVERY,
    },
    fetchMode: "cheerio",
    requestSettings: {
      delaySeconds: definition.delaySeconds,
      rateLimitPerMinute: null,
      maxConcurrency: definition.maxConcurrency,
      maxRetries: 3,
    },
    requireCompleteJsonLd: true,
    recipeExtractor: "wprm-api",
    ...(["foodfanatic", "scandikitchen"].includes(definition.id) ? {
      migrationState: "shadow_passed" as const,
      latestScrapyOutcome: "succeeded" as const,
      latestCanary: definition.id === "foodfanatic"
        ? "2026-08-19T20-30-43.490Z"
        : "2026-08-19T20-30-04.163Z",
      shadowParity:
        definition.id === "foodfanatic"
          ? "504/504 complete records and every material field matched across the complete six-page API catalog"
          : "109/109 records and every material field matched across the complete two-page API catalog, including seven same-page sibling recipes",
      deferOrBlockReason:
        definition.id === "foodfanatic"
          ? "The uncapped seven-request Crawlee run completed all six API pages without failures, blocks, malformed records, storage errors, or domain violations; Crawlee and Scrapy both rejected the same one incomplete upstream record, and all 504 complete records matched on every material field including ingredient text"
          : "The uncapped three-request Crawlee run completed discovery without terminal failures, blocks, rejects, storage errors, or domain violations after two transient terminal-page retries; all 109 records matched the complete legacy output on every material field after the parity comparator was hardened to retain same-page sibling recipes and compare ingredient text",
    } : {
      migrationState: "configured" as const,
      latestScrapyOutcome: "partial" as const,
      latestCanary: "2026-08-19T16-30-48.666Z",
      deferOrBlockReason:
        `Bounded first-page live shadow matched Scrapy on all 100 emitted records and every material field with no extraction, request, storage, or domain failures; the ${definition.id === "foodfanatic" ? "6-page" : "2-page"} catalog still requires an uncapped run`,
    }),
  }));

const SHOPIFY_BLOG_RECIPE_SOURCES: DanishJsonLdSource[] =
  DANISH_SHOPIFY_BLOG_SOURCE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    domain: definition.domain,
    allowedDomains: [definition.domain],
    legacySpider: definition.legacySpider,
    legacyFamily: "HtmlRecipeSitemapSpider",
    discovery: "sitemap",
    sitemapUrls: [definition.sitemapUrl],
    startUrls: [],
    recipeUrlPatterns: [definition.recipeUrlPattern],
    sitemapDiscovery: { followPatterns: [], skipUrlFragments: [] },
    fetchMode: "cheerio",
    requestSettings: {
      delaySeconds: 2,
      rateLimitPerMinute: null,
      maxConcurrency: 2,
      maxRetries: 3,
    },
    requireCompleteJsonLd: true,
    recipeExtractor: "shopify-blog-html",
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    ...(definition.id === "hvidlogvin" ? {
      latestCanary: "2026-08-19T16-39-51.189Z",
      shadowParity: "3/3 recipes and all material fields matched across the complete 10-page sitemap",
      deferOrBlockReason:
        "Full catalog shadow matched all three legacy recipes and every material field; seven non-recipe gardening articles were rejected by the complete-recipe contract, so only downstream cutover remains",
    } : definition.id === "vinpusheren" ? {
      latestCanary: "2026-08-19T16-47-44.354Z",
      shadowParity:
        "14/14 recipes matched across the complete 70-article sitemap; Crawlee preserves three yield units discarded by legacy",
      deferOrBlockReason:
        "Full catalog shadow matched all 14 legacy recipes and all material fields; Crawlee intentionally preserves three person yield units that legacy discarded, while 56 non-recipe articles remain rejected, so only downstream cutover remains",
    } : definition.id === "hejholger" ? {
      latestCanary: "2026-08-19T17-00-02.647Z",
      shadowParity:
        "31/31 overlapping recipes matched every material field except ten richer total durations; Crawlee also found two recipes added after the cached Scrapy crawl",
      deferOrBlockReason:
        "Full 36-page sitemap shadow matched all 31 legacy recipes on titles, ingredients, instructions, yields, images, categories, prep, and cook times; Crawlee preserves minute components in ten hour-plus durations and discovered two fresh recipes, so only downstream cutover remains",
    } : {
      latestCanary: "2026-08-19T17-18-31.929Z",
      shadowParity:
        "89/89 recipes and every material field matched across the complete 116-page sitemap",
      deferOrBlockReason:
        "Full catalog shadow matched Scrapy on all 89 emitted recipes and every material field; 27 non-recipe or incomplete articles were rejected by both implementations, so only downstream cutover remains",
    }),
  }));

const ARTICLE_HTML_RECIPE_SOURCES: DanishJsonLdSource[] =
  DANISH_ARTICLE_HTML_SOURCE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    domain: definition.domain,
    allowedDomains: [definition.domain],
    legacySpider: definition.legacySpider,
    legacyFamily: "HtmlRecipeSitemapSpider",
    discovery: "sitemap",
    sitemapUrls: [definition.sitemapUrl],
    startUrls: [],
    recipeUrlPatterns: [definition.recipeUrlPattern],
    sitemapDiscovery: { followPatterns: [], skipUrlFragments: [] },
    fetchMode: "cheerio",
    requestSettings: {
      delaySeconds: 2,
      rateLimitPerMinute: null,
      maxConcurrency: 2,
      maxRetries: 3,
    },
    requireCompleteJsonLd: true,
    recipeExtractor: "femina-html",
    migrationState: "canary_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-19T17-27-48.705Z",
    deferOrBlockReason:
      "Bounded live canary persisted both selected recipes without failures and both exact direct Scrapy parses matched every material field; the 324-candidate catalog still requires an uncapped shadow run",
  }));

const JSONLD_HTML_RECIPE_SOURCES: DanishJsonLdSource[] =
  DANISH_JSONLD_HTML_SOURCE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    domain: definition.domain,
    allowedDomains: [definition.domain],
    legacySpider: definition.legacySpider,
    legacyFamily: "HtmlRecipeSitemapSpider",
    discovery: "sitemap",
    sitemapUrls: [definition.sitemapUrl],
    startUrls: [],
    recipeUrlPatterns: [definition.recipeUrlPattern],
    sitemapDiscovery: { followPatterns: [], skipUrlFragments: [] },
    fetchMode: "cheerio",
    requestSettings: {
      delaySeconds: 2,
      rateLimitPerMinute: null,
      maxConcurrency: 2,
      maxRetries: 3,
    },
    requireCompleteJsonLd: true,
    recipeExtractor: "gocook-jsonld-html",
    migrationState: "canary_passed",
    latestScrapyOutcome: "partial",
    latestCanary: "2026-08-19T17-34-06.299Z",
    deferOrBlockReason:
      "Bounded live canary persisted all five selected recipes without failures using current responsive step rows; the legacy spider now emits zero instructions on a direct live parse, and the 1081-recipe catalog still requires an uncapped Crawlee validation",
  }));

const REDIRECTED_JSONLD_RECIPE_SOURCES: DanishJsonLdSource[] =
  DANISH_REDIRECTED_JSONLD_SOURCE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    domain: definition.domain,
    allowedDomains: [...definition.allowedDomains],
    legacySpider: definition.legacySpider,
    legacyFamily: "CustomSitemapSpider",
    discovery: "sitemap",
    sitemapUrls: [definition.sitemapUrl],
    startUrls: [],
    recipeUrlPatterns: [definition.recipeUrlPattern],
    canonicalFollowStatuses: [...definition.canonicalFollowStatuses],
    sitemapDiscovery: { followPatterns: [], skipUrlFragments: [] },
    fetchMode: "cheerio",
    requestSettings: { delaySeconds: 2, rateLimitPerMinute: null, maxConcurrency: 2, maxRetries: 3 },
    requireCompleteJsonLd: true,
    recipeExtractor: "strict-json-ld",
    migrationState: "canary_passed",
    latestScrapyOutcome: "no_data",
    latestCanary: "2026-08-19T17-45-20.157Z",
    deferOrBlockReason:
      "Bounded canary followed four validated stale-page canonicals at foreground priority and persisted three complete Coop JSON-LD recipes without failures; a direct legacy parse emitted no recipe, and the 1936-candidate archive still requires an uncapped validation",
  }));

const ALT_HTML_RECIPE_SOURCES: DanishJsonLdSource[] =
  DANISH_ALT_HTML_SOURCE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    domain: definition.domain,
    allowedDomains: [definition.domain],
    legacySpider: definition.legacySpider,
    legacyFamily: "HtmlRecipeSitemapSpider",
    discovery: "sitemap",
    sitemapUrls: [definition.sitemapUrl],
    startUrls: [],
    recipeUrlPatterns: [definition.recipeUrlPattern],
    sitemapDiscovery: { followPatterns: [...definition.followPatterns], skipUrlFragments: [] },
    fetchMode: "cheerio",
    requestSettings: { delaySeconds: 2, rateLimitPerMinute: null, maxConcurrency: 2, maxRetries: 3 },
    requireCompleteJsonLd: true,
    recipeExtractor: "alt-html",
    migrationState: "canary_passed",
    latestScrapyOutcome: "partial",
    latestCanary: "2026-08-19T17-50-45.285Z",
    deferOrBlockReason:
      "Bounded live canary followed the corrected child-sitemap regex, persisted two complete current-layout recipes without operational failures, and rejected nine editorial or incomplete candidates; the multi-sitemap catalog remains uncapped",
  }));

const MULTI_RECIPE_HTML_SOURCES: DanishJsonLdSource[] =
  DANISH_MULTI_RECIPE_HTML_SOURCE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    domain: definition.domain,
    allowedDomains: [...definition.allowedDomains],
    legacySpider: definition.legacySpider,
    legacyFamily: "HtmlRecipeSitemapSpider",
    discovery: "sitemap",
    sitemapUrls: [definition.sitemapUrl],
    startUrls: [],
    recipeUrlPatterns: [definition.recipeUrlPattern],
    sitemapDiscovery: { followPatterns: [], skipUrlFragments: [] },
    fetchMode: "cheerio",
    requestSettings: { delaySeconds: 2, rateLimitPerMinute: null, maxConcurrency: 2, maxRetries: 3 },
    requireCompleteJsonLd: true,
    recipeExtractor: "discount365-html",
    migrationState: "canary_passed",
    latestScrapyOutcome: "partial",
    latestCanary: "2026-08-19T18-03-03.842Z",
    deferOrBlockReason:
      "Bounded live shadow matched all 23 overlapping single- and multi-recipe records and every material field, with no Crawlee request, storage, malformed-payload, or domain failures; six legacy-only records came from its larger in-flight window, and the full catalog remains unvalidated",
  }));

const DR_GRAPHQL_RECIPE_SOURCES: DanishJsonLdSource[] =
  DANISH_DR_GRAPHQL_SOURCE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    domain: definition.domain,
    allowedDomains: [definition.domain],
    legacySpider: definition.legacySpider,
    legacyFamily: "DirectRecipeApiSpider",
    discovery: "listing",
    sitemapUrls: [],
    startUrls: ["https://www.dr.dk/tjenester/steffi/graphql"],
    recipeUrlPatterns: ["^https?://(?:www\\.)?dr\\.dk/[^?#]+$"],
    fetchMode: "cheerio",
    requestSettings: { delaySeconds: 1, rateLimitPerMinute: null, maxConcurrency: 2, maxRetries: 3 },
    requireCompleteJsonLd: true,
    recipeExtractor: "dr-graphql",
    migrationState: "canary_passed",
    latestScrapyOutcome: "no_data",
    latestCanary: "2026-08-19T18-10-28.791Z",
    ...("aliasFor" in definition ? { aliasFor: definition.aliasFor } : {}),
    deferOrBlockReason:
      "Bounded live canary completed five POST requests without operational failures and persisted the complete recipe among four sampled articles using DR's current nested EmphasizedList shape; the legacy query returned zero recipes across its larger 12-response in-flight window because it requests only the retired ListComponent shape, while the full 500-plus catalog remains unvalidated",
  }));

const AUTHENTICATED_API_RECIPE_SOURCES: DanishJsonLdSource[] =
  DANISH_AUTHENTICATED_API_SOURCE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    domain: definition.domain,
    allowedDomains: definition.id === "madforfattigroeve"
      ? [definition.domain, "backend.madforfattigroeve.dk"]
      : [definition.domain],
    legacySpider: definition.legacySpider,
    legacyFamily: "DirectRecipeApiSpider",
    discovery: "listing",
    sitemapUrls: [],
    startUrls: [definition.startUrl],
    recipeUrlPatterns: [definition.id === "hellofresh"
      ? "^https?://(?:www\\.)?hellofresh\\.dk/recipes/[^?#]+$"
      : "^https?://madforfattigroeve\\.dk/opskrifter/\\d+$"],
    fetchMode: "cheerio",
    requestSettings: { delaySeconds: 1, rateLimitPerMinute: null, maxConcurrency: 2, maxRetries: 3 },
    requireCompleteJsonLd: true,
    recipeExtractor: definition.extractor,
    ...(definition.id === "hellofresh" ? {
      migrationState: "canary_passed" as const,
      latestScrapyOutcome: "partial" as const,
      latestCanary: "2026-08-19T18-16-15.232Z",
      deferOrBlockReason:
        "Bounded token-plus-first-page live shadow matched all 250 recipes and every material field with no request, extraction, storage, or domain failures; the current 15465-recipe catalog spans 62 API pages and still requires uncapped validation",
    } : {
      migrationState: "canary_passed" as const,
      latestScrapyOutcome: "no_data" as const,
      latestCanary: "2026-08-19T19-09-13.765Z",
      deferOrBlockReason:
        "Two uncapped two-request runs each persisted the complete current 588-recipe GraphQL catalog with identical keys and normalized records and no failures, blocks, rejects, page cap, storage errors, or domain admissions; five rendered recipe-page payloads matched titles, ingredient identities, instructions, and images exactly, while the retired legacy numeric sitemap remains HTTP 404 and cannot provide a current shadow",
    }),
  }));

const DAGROFA_API_RECIPE_SOURCES: DanishJsonLdSource[] =
  DANISH_DAGROFA_API_SOURCE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    domain: definition.domain,
    allowedDomains: ["meny.dk", "spar.dk"],
    legacySpider: definition.legacySpider,
    legacyFamily: "DirectRecipeApiSpider",
    discovery: "listing",
    sitemapUrls: [],
    startUrls: ["https://meny.dk/dagrofa/Search/SearchRecipes?pageSize=50&pageOffset=0"],
    recipeUrlPatterns: ["^https?://(?:www\\.)?(?:meny|spar)\\.dk/opskrift/[^?#]+$"],
    fetchMode: "cheerio",
    requestSettings: { delaySeconds: 1, rateLimitPerMinute: null, maxConcurrency: 2, maxRetries: 3 },
    requireCompleteJsonLd: true,
    recipeExtractor: "meny-api",
    migrationState: "canary_passed",
    latestScrapyOutcome: "partial",
    latestCanary: "2026-08-19T18-24-35.758Z",
    ...("aliasFor" in definition ? { aliasFor: definition.aliasFor } : {}),
    deferOrBlockReason:
      "Bounded first-page live shadow matched all 50 recipes and every material field without request, extraction, storage, or domain failures; the Aarstiderne alias deduplicated to the canonical Meny execution, while the 3049-recipe catalog still requires uncapped validation",
  }));

const SITECORE_API_RECIPE_SOURCES: DanishJsonLdSource[] =
  DANISH_SITECORE_API_SOURCE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    domain: definition.domain,
    allowedDomains: [definition.domain],
    legacySpider: definition.legacySpider,
    legacyFamily: "DirectRecipeApiSpider",
    discovery: "listing",
    sitemapUrls: [],
    startUrls: [definition.startUrl],
    recipeUrlPatterns: ["^https?://(?:www\\.)?nemlig\\.com/opskrifter/[^?#]+$"],
    fetchMode: "cheerio",
    disableHeaderGenerator: true,
    requestSettings: { delaySeconds: 2, rateLimitPerMinute: null, maxConcurrency: 2, maxRetries: 3 },
    requireCompleteJsonLd: true,
    recipeExtractor: "nemlig-sitecore",
    migrationState: "canary_passed",
    latestScrapyOutcome: "partial",
    latestCanary: "2026-08-19T18-36-18.085Z",
    deferOrBlockReason:
      "Bounded 50-request live canary completed without request, extraction, storage, or domain failures, discovered 370 candidates, and persisted 25 recipes; those exact 25 live documents matched the legacy parser on every material field, while the stock legacy browser-profile middleware is now diverted into Queue-it and the full catalog remains unvalidated",
  }));

const LEGACY_BODY_HTML_RECIPE_SOURCES: DanishJsonLdSource[] =
  DANISH_LEGACY_BODY_HTML_SOURCE_DEFINITIONS.map((definition) => ({
    id: definition.id,
    domain: definition.domain,
    allowedDomains: [definition.domain],
    legacySpider: definition.legacySpider,
    legacyFamily: "HtmlRecipeSitemapSpider",
    discovery: "sitemap",
    sitemapUrls: [definition.sitemapUrl],
    startUrls: [],
    recipeUrlPatterns: [definition.recipeUrlPattern],
    sitemapDiscovery: { followPatterns: [], skipUrlFragments: [] },
    fetchMode: "cheerio",
    requestSettings: { delaySeconds: 2, rateLimitPerMinute: null, maxConcurrency: 2, maxRetries: 3 },
    requireCompleteJsonLd: true,
    recipeExtractor: definition.extractor,
    migrationState: definition.id === "nipunijulie" ? "shadow_passed" : "canary_passed",
    latestScrapyOutcome: definition.id === "nipunijulie" ? "succeeded" : "partial",
    latestCanary: definition.id === "nipunijulie"
      ? "2026-08-19T19-53-52.062Z"
      : "2026-08-19T19-31-12.779Z",
    ...(definition.id === "nipunijulie" ? {
      shadowParity:
        "140/140 recipes, identical URL set, and every material field matched across the complete 233-candidate sitemap",
    } : {}),
    deferOrBlockReason: definition.id === "nipunijulie"
      ? "Two full Crawlee traversals completed all 233 candidates with stable source keys and no terminal block, failed request, storage failure, or domain violation; the final 140-record output is exactly equal to the full legacy output, while 93 ordinary posts do not satisfy the recipe contract"
      : "Two bounded live canaries persisted complete recipes with no terminal block or request failure; a forced-browser run cleared an HTTP 454 challenge on an in-session retry, and the hybrid HTTP run completed normally. Two exact pages match the legacy parser on every material field, while all 756 sitemap candidates remain uncapped",
  }));

export const DANISH_JSONLD_SOURCES: DanishJsonLdSource[] = [
  ...RAW_DANISH_JSONLD_SOURCES.map((source) => {
    const effectiveSource: DanishJsonLdSource = {
      ...source,
      ...LEGACY_DISCOVERY_OVERRIDES[source.id],
      ...(ROUTE_AUDITED_SOURCE_IDS.has(source.id)
        ? { migrationState: "configured" as const }
        : {}),
      ...CURRENT_SOURCE_OVERRIDES[source.id],
      requestSettings: {
        ...LEGACY_DEFAULT_REQUEST_SETTINGS,
        ...LEGACY_REQUEST_SETTING_OVERRIDES[source.id],
      },
    };
    return {
      ...effectiveSource,
      ...(effectiveSource.discovery === "listing"
        ? {
            listingDiscovery: {
              ...LEGACY_LISTING_DISCOVERY_DEFAULT,
              ...LEGACY_LISTING_DISCOVERY_OVERRIDES[source.id],
            },
          }
        : {
            sitemapDiscovery: LEGACY_SITEMAP_DISCOVERY_OVERRIDES[source.id] ?? {
              followPatterns: [],
              skipUrlFragments: [],
            },
          }),
    };
  }),
  ...NEW_DANISH_WP_POSTS_SOURCES,
  ...CUSTOM_DANISH_JSONLD_SOURCES,
  ...CUSTOM_DANISH_LISTING_JSONLD_SOURCES,
  ...EMBEDDED_DANISH_RECIPE_SOURCES,
  ...HTML_DANISH_RECIPE_SOURCES,
  ...DIRECT_DANISH_RECIPE_API_SOURCES,
  ...RECURSIVE_MICRODATA_LISTING_SOURCES,
  ...CUSTOM_DANISH_WPRM_SOURCES,
  ...SHOPIFY_BLOG_RECIPE_SOURCES,
  ...ARTICLE_HTML_RECIPE_SOURCES,
  ...JSONLD_HTML_RECIPE_SOURCES,
  ...REDIRECTED_JSONLD_RECIPE_SOURCES,
  ...ALT_HTML_RECIPE_SOURCES,
  ...MULTI_RECIPE_HTML_SOURCES,
  ...DR_GRAPHQL_RECIPE_SOURCES,
  ...AUTHENTICATED_API_RECIPE_SOURCES,
  ...DAGROFA_API_RECIPE_SOURCES,
  ...SITECORE_API_RECIPE_SOURCES,
  ...LEGACY_BODY_HTML_RECIPE_SOURCES,
  ...DANISH_WPRM_SOURCES,
];

/** Legacy normalized Mongo documents identify their producer by source_site. */
export const DANISH_JSONLD_LEGACY_SOURCE_SITES: Record<string, string[]> =
  Object.fromEntries(
    DANISH_JSONLD_SOURCES.map((source) => [source.id, [source.domain]])
  );

export function legacySourceSitesFor(sourceId: string): string[] {
  return DANISH_JSONLD_LEGACY_SOURCE_SITES[sourceId] ?? [];
}

export function isMigrated(state: MigrationState): boolean {
  return state === "cutover";
}
