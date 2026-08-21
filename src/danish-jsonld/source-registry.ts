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
    },
  {
    "id": "40aprons",
    "domain": "40aprons.com",
    "allowedDomains": [
      "40aprons.com",
      "www.40aprons.com"
    ],
    "legacySpider": "N40apronsSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.40aprons.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "acedarspoon",
    "domain": "acedarspoon.com",
    "allowedDomains": [
      "acedarspoon.com",
      "www.acedarspoon.com"
    ],
    "legacySpider": "AcedarspoonSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.acedarspoon.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "acozykitchen",
    "domain": "acozykitchen.com",
    "allowedDomains": [
      "acozykitchen.com",
      "www.acozykitchen.com"
    ],
    "legacySpider": "AcozykitchenSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.acozykitchen.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "addapinch",
    "domain": "addapinch.com",
    "allowedDomains": [
      "addapinch.com",
      "www.addapinch.com"
    ],
    "legacySpider": "AddapinchSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.addapinch.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "addictedtodates",
    "domain": "addictedtodates.com",
    "allowedDomains": [
      "addictedtodates.com",
      "www.addictedtodates.com"
    ],
    "legacySpider": "AddictedtodatesSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.addictedtodates.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "africanbites",
    "domain": "africanbites.com",
    "allowedDomains": [
      "africanbites.com",
      "www.africanbites.com"
    ],
    "legacySpider": "AfricanbitesSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.africanbites.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "afullliving",
    "domain": "afullliving.com",
    "allowedDomains": [
      "afullliving.com",
      "www.afullliving.com"
    ],
    "legacySpider": "AfulllivingSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://afullliving.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "agirldefloured",
    "domain": "agirldefloured.com",
    "allowedDomains": [
      "agirldefloured.com",
      "www.agirldefloured.com",
        "atabledefloured.com",
        "www.atabledefloured.com"],
    "legacySpider": "AgirldeflouredSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.agirldefloured.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "ahintofrosemary",
    "domain": "ahintofrosemary.com",
    "allowedDomains": [
      "ahintofrosemary.com",
      "www.ahintofrosemary.com"
    ],
    "legacySpider": "AhintofrosemarySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.ahintofrosemary.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "aimadeitforyou",
    "domain": "aimadeitforyou.com",
    "allowedDomains": [
      "aimadeitforyou.com",
      "www.aimadeitforyou.com"
    ],
    "legacySpider": "AimadeitforyouSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.aimadeitforyou.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "airfryeryum",
    "domain": "airfryeryum.com",
    "allowedDomains": [
      "airfryeryum.com",
      "www.airfryeryum.com"
    ],
    "legacySpider": "AirfryeryumSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.airfryeryum.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "alattefood",
    "domain": "alattefood.com",
    "allowedDomains": [
      "alattefood.com",
      "www.alattefood.com"
    ],
    "legacySpider": "AlattefoodSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.alattefood.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "alittlebitofspice",
    "domain": "alittlebitofspice.com",
    "allowedDomains": [
      "alittlebitofspice.com",
      "www.alittlebitofspice.com"
    ],
    "legacySpider": "AlittlebitofspiceSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.alittlebitofspice.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "alldayidreamaboutfood",
    "domain": "alldayidreamaboutfood.com",
    "allowedDomains": [
      "alldayidreamaboutfood.com",
      "www.alldayidreamaboutfood.com"
    ],
    "legacySpider": "AlldayidreamaboutfoodSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.alldayidreamaboutfood.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "allshecooks",
    "domain": "allshecooks.com",
    "allowedDomains": [
      "allshecooks.com",
      "www.allshecooks.com"
    ],
    "legacySpider": "AllshecooksSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.allshecooks.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "alphafoodie",
    "domain": "alphafoodie.com",
    "allowedDomains": [
      "alphafoodie.com",
      "www.alphafoodie.com"
    ],
    "legacySpider": "AlphafoodieSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.alphafoodie.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "altonbrown",
    "domain": "altonbrown.com",
    "allowedDomains": [
      "altonbrown.com",
      "www.altonbrown.com"
    ],
    "legacySpider": "AltonbrownSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.altonbrown.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "alwaysusebutter",
    "domain": "alwaysusebutter.com",
    "allowedDomains": [
      "alwaysusebutter.com",
      "www.alwaysusebutter.com"
    ],
    "legacySpider": "AlwaysusebutterSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.alwaysusebutter.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "amandascookin",
    "domain": "amandascookin.com",
    "allowedDomains": [
      "amandascookin.com",
      "www.amandascookin.com"
    ],
    "legacySpider": "AmandascookinSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.amandascookin.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "amiraspantry",
    "domain": "amiraspantry.com",
    "allowedDomains": [
      "amiraspantry.com",
      "www.amiraspantry.com"
    ],
    "legacySpider": "AmiraspantrySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.amiraspantry.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "amuseyourbouche",
    "domain": "amuse-your-bouche.com",
    "allowedDomains": [
      "amuse-your-bouche.com",
      "www.amuse-your-bouche.com",
        "easycheesyvegetarian.com",
        "www.easycheesyvegetarian.com"],
    "legacySpider": "AmuseYourBoucheSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.amuse-your-bouche.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "amyinthekitchen",
    "domain": "amyinthekitchen.com",
    "allowedDomains": [
      "amyinthekitchen.com",
      "www.amyinthekitchen.com"
    ],
    "legacySpider": "AmyinthekitchenSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.amyinthekitchen.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "amyshealthybaking",
    "domain": "amyshealthybaking.com",
    "allowedDomains": [
      "amyshealthybaking.com",
      "www.amyshealthybaking.com"
    ],
    "legacySpider": "AmyshealthybakingSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.amyshealthybaking.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "anaffairfromtheheart",
    "domain": "anaffairfromtheheart.com",
    "allowedDomains": [
      "anaffairfromtheheart.com",
      "www.anaffairfromtheheart.com"
    ],
    "legacySpider": "AnaffairfromtheheartSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.anaffairfromtheheart.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "andiemitchell",
    "domain": "andiemitchell.com",
    "allowedDomains": [
      "andiemitchell.com",
      "www.andiemitchell.com"
    ],
    "legacySpider": "AndiemitchellSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.andiemitchell.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "anitalianinmykitchen",
    "domain": "anitalianinmykitchen.com",
    "allowedDomains": [
      "anitalianinmykitchen.com",
      "www.anitalianinmykitchen.com"
    ],
    "legacySpider": "AnitalianinmykitchenSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.anitalianinmykitchen.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "anoregoncottage",
    "domain": "anoregoncottage.com",
    "allowedDomains": [
      "anoregoncottage.com",
      "www.anoregoncottage.com"
    ],
    "legacySpider": "AnoregoncottageSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.anoregoncottage.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "apeachyplate",
    "domain": "apeachyplate.com",
    "allowedDomains": [
      "apeachyplate.com",
      "www.apeachyplate.com"
    ],
    "legacySpider": "ApeachyplateSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.apeachyplate.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "aprettylifeinthesuburbs",
    "domain": "aprettylifeinthesuburbs.com",
    "allowedDomains": [
      "aprettylifeinthesuburbs.com",
      "www.aprettylifeinthesuburbs.com"
    ],
    "legacySpider": "AprettylifeinthesuburbsSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://aprettylifeinthesuburbs.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "artofnaturalliving",
    "domain": "artofnaturalliving.com",
    "allowedDomains": [
      "artofnaturalliving.com",
      "www.artofnaturalliving.com"
    ],
    "legacySpider": "ArtofnaturallivingSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.artofnaturalliving.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "aseasyasapplepie",
    "domain": "aseasyasapplepie.com",
    "allowedDomains": [
      "aseasyasapplepie.com",
      "www.aseasyasapplepie.com"
    ],
    "legacySpider": "AseasyasapplepieSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.aseasyasapplepie.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "asimplepalate",
    "domain": "asimplepalate.com",
    "allowedDomains": [
      "asimplepalate.com",
      "www.asimplepalate.com"
    ],
    "legacySpider": "AsimplepalateSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.asimplepalate.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "askchefdennis",
    "domain": "askchefdennis.com",
    "allowedDomains": [
      "askchefdennis.com",
      "www.askchefdennis.com"
    ],
    "legacySpider": "AskchefdennisSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.askchefdennis.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "aspicyperspective",
    "domain": "aspicyperspective.com",
    "allowedDomains": [
      "aspicyperspective.com",
      "www.aspicyperspective.com"
    ],
    "legacySpider": "AspicyperspectiveSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.aspicyperspective.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "athomewithshay",
    "domain": "athomewithshay.com",
    "allowedDomains": [
      "athomewithshay.com",
      "www.athomewithshay.com"
    ],
    "legacySpider": "AthomewithshaySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.athomewithshay.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "averiecooks",
    "domain": "averiecooks.com",
    "allowedDomains": [
      "averiecooks.com",
      "www.averiecooks.com"
    ],
    "legacySpider": "AveriecooksSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.averiecooks.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bakedambrosia",
    "domain": "bakedambrosia.com",
    "allowedDomains": [
      "bakedambrosia.com",
      "www.bakedambrosia.com"
    ],
    "legacySpider": "BakedambrosiaSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bakedambrosia.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bakedbyrachel",
    "domain": "bakedbyrachel.com",
    "allowedDomains": [
      "bakedbyrachel.com",
      "www.bakedbyrachel.com"
    ],
    "legacySpider": "BakedbyrachelSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bakedbyrachel.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bakefromscratch",
    "domain": "bakefromscratch.com",
    "allowedDomains": [
      "bakefromscratch.com",
      "www.bakefromscratch.com"
    ],
    "legacySpider": "BakefromscratchSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bakefromscratch.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bakeitwithlove",
    "domain": "bakeitwithlove.com",
    "allowedDomains": [
      "bakeitwithlove.com",
      "www.bakeitwithlove.com"
    ],
    "legacySpider": "BakeitwithloveSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bakeitwithlove.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bakeorbreak",
    "domain": "bakeorbreak.com",
    "allowedDomains": [
      "bakeorbreak.com",
      "www.bakeorbreak.com"
    ],
    "legacySpider": "BakeorbreakSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bakeorbreak.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bakeplate",
    "domain": "bakeplate.com",
    "allowedDomains": [
      "bakeplate.com",
      "www.bakeplate.com"
    ],
    "legacySpider": "BakeplateSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://bakeplate.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bakeplaysmile",
    "domain": "bakeplaysmile.com",
    "allowedDomains": [
      "bakeplaysmile.com",
      "www.bakeplaysmile.com"
    ],
    "legacySpider": "BakeplaysmileSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bakeplaysmile.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bakerbynature",
    "domain": "bakerbynature.com",
    "allowedDomains": [
      "bakerbynature.com",
      "www.bakerbynature.com"
    ],
    "legacySpider": "BakerbynatureSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bakerbynature.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bakerita",
    "domain": "bakerita.com",
    "allowedDomains": [
      "bakerita.com",
      "www.bakerita.com"
    ],
    "legacySpider": "BakeritaSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bakerita.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bakesbybrownsugar",
    "domain": "bakesbybrownsugar.com",
    "allowedDomains": [
      "bakesbybrownsugar.com",
      "www.bakesbybrownsugar.com"
    ],
    "legacySpider": "BakesbybrownsugarSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bakesbybrownsugar.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bakingamoment",
    "domain": "bakingamoment.com",
    "allowedDomains": [
      "bakingamoment.com",
      "www.bakingamoment.com"
    ],
    "legacySpider": "BakingamomentSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bakingamoment.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bakingbeauty",
    "domain": "bakingbeauty.net",
    "allowedDomains": [
      "bakingbeauty.net",
      "www.bakingbeauty.net"
    ],
    "legacySpider": "BakingbeautySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bakingbeauty.net/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bakingginger",
    "domain": "baking-ginger.com",
    "allowedDomains": [
      "baking-ginger.com",
      "www.baking-ginger.com"
    ],
    "legacySpider": "BakingGingerSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.baking-ginger.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bakingmischief",
    "domain": "bakingmischief.com",
    "allowedDomains": [
      "bakingmischief.com",
      "www.bakingmischief.com"
    ],
    "legacySpider": "BakingmischiefSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bakingmischief.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "barefeetinthekitchen",
    "domain": "barefeetinthekitchen.com",
    "allowedDomains": [
      "barefeetinthekitchen.com",
      "www.barefeetinthekitchen.com"
    ],
    "legacySpider": "BarefeetinthekitchenSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.barefeetinthekitchen.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "barleyandsage",
    "domain": "barleyandsage.com",
    "allowedDomains": [
      "barleyandsage.com",
      "www.barleyandsage.com"
    ],
    "legacySpider": "BarleyandsageSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.barleyandsage.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "beamingbaker",
    "domain": "beamingbaker.com",
    "allowedDomains": [
      "beamingbaker.com",
      "www.beamingbaker.com"
    ],
    "legacySpider": "BeamingbakerSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.beamingbaker.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bellyfull",
    "domain": "bellyfull.net",
    "allowedDomains": [
      "bellyfull.net",
      "www.bellyfull.net"
    ],
    "legacySpider": "BellyfullSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bellyfull.net/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "berlyskitchen",
    "domain": "berlyskitchen.com",
    "allowedDomains": [
      "berlyskitchen.com",
      "www.berlyskitchen.com"
    ],
    "legacySpider": "BerlyskitchenSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.berlyskitchen.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "berrymaple",
    "domain": "berrymaple.com",
    "allowedDomains": [
      "berrymaple.com",
      "www.berrymaple.com"
    ],
    "legacySpider": "BerrymapleSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.berrymaple.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bessiebakes",
    "domain": "bessiebakes.com",
    "allowedDomains": [
      "bessiebakes.com",
      "www.bessiebakes.com"
    ],
    "legacySpider": "BessiebakesSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bessiebakes.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bestrecipebox",
    "domain": "bestrecipebox.com",
    "allowedDomains": [
      "bestrecipebox.com",
      "www.bestrecipebox.com"
    ],
    "legacySpider": "BestrecipeboxSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bestrecipebox.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "beyondkimchee",
    "domain": "beyondkimchee.com",
    "allowedDomains": [
      "beyondkimchee.com",
      "www.beyondkimchee.com"
    ],
    "legacySpider": "BeyondkimcheeSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.beyondkimchee.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "biancazapatka",
    "domain": "biancazapatka.com",
    "allowedDomains": [
      "biancazapatka.com",
      "www.biancazapatka.com"
    ],
    "legacySpider": "BiancazapatkaSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.biancazapatka.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "biggerbolderbaking",
    "domain": "biggerbolderbaking.com",
    "allowedDomains": [
      "biggerbolderbaking.com",
      "www.biggerbolderbaking.com"
    ],
    "legacySpider": "BiggerbolderbakingSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.biggerbolderbaking.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bigrecipe",
    "domain": "bigrecipe.com",
    "allowedDomains": [
      "bigrecipe.com",
      "www.bigrecipe.com"
    ],
    "legacySpider": "BigrecipeSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bigrecipe.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "biscuitsandburlap",
    "domain": "biscuitsandburlap.com",
    "allowedDomains": [
      "biscuitsandburlap.com",
      "www.biscuitsandburlap.com"
    ],
    "legacySpider": "BiscuitsandburlapSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.biscuitsandburlap.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "biteswithbri",
    "domain": "biteswithbri.com",
    "allowedDomains": [
      "biteswithbri.com",
      "www.biteswithbri.com"
    ],
    "legacySpider": "BiteswithbriSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.biteswithbri.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "blackberrybabe",
    "domain": "blackberrybabe.com",
    "allowedDomains": [
      "blackberrybabe.com",
      "www.blackberrybabe.com"
    ],
    "legacySpider": "BlackberrybabeSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.blackberrybabe.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "blackpeoplesrecipes",
    "domain": "blackpeoplesrecipes.com",
    "allowedDomains": [
      "blackpeoplesrecipes.com",
      "www.blackpeoplesrecipes.com"
    ],
    "legacySpider": "BlackpeoplesrecipesSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.blackpeoplesrecipes.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "blendwithspices",
    "domain": "blendwithspices.com",
    "allowedDomains": [
      "blendwithspices.com",
      "www.blendwithspices.com"
    ],
    "legacySpider": "BlendwithspicesSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.blendwithspices.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bluebowlrecipes",
    "domain": "bluebowlrecipes.com",
    "allowedDomains": [
      "bluebowlrecipes.com",
      "www.bluebowlrecipes.com"
    ],
    "legacySpider": "BluebowlrecipesSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bluebowlrecipes.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "boulderlocavore",
    "domain": "boulderlocavore.com",
    "allowedDomains": [
      "boulderlocavore.com",
      "www.boulderlocavore.com"
    ],
    "legacySpider": "BoulderlocavoreSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://boulderlocavore.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bowlofdelicious",
    "domain": "bowlofdelicious.com",
    "allowedDomains": [
      "bowlofdelicious.com",
      "www.bowlofdelicious.com"
    ],
    "legacySpider": "BowlofdeliciousSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bowlofdelicious.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "breadboozebacon",
    "domain": "breadboozebacon.com",
    "allowedDomains": [
      "breadboozebacon.com",
      "www.breadboozebacon.com"
    ],
    "legacySpider": "BreadboozebaconSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.breadboozebacon.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "brighteyedbaker",
    "domain": "brighteyedbaker.com",
    "allowedDomains": [
      "brighteyedbaker.com",
      "www.brighteyedbaker.com"
    ],
    "legacySpider": "BrighteyedbakerSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.brighteyedbaker.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "browneyedbaker",
    "domain": "browneyedbaker.com",
    "allowedDomains": [
      "browneyedbaker.com",
      "www.browneyedbaker.com"
    ],
    "legacySpider": "BrowneyedbakerSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.browneyedbaker.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "budgetbytes",
    "domain": "budgetbytes.com",
    "allowedDomains": [
      "budgetbytes.com",
      "www.budgetbytes.com"
    ],
    "legacySpider": "BudgetBytesSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.budgetbytes.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "buildyourbite",
    "domain": "buildyourbite.com",
    "allowedDomains": [
      "buildyourbite.com",
      "www.buildyourbite.com"
    ],
    "legacySpider": "BuildyourbiteSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.buildyourbite.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "bunnyswarmoven",
    "domain": "bunnyswarmoven.net",
    "allowedDomains": [
      "bunnyswarmoven.net",
      "www.bunnyswarmoven.net"
    ],
    "legacySpider": "BunnyswarmovenSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.bunnyswarmoven.net/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "butterandbaggage",
    "domain": "butterandbaggage.com",
    "allowedDomains": [
      "butterandbaggage.com",
      "www.butterandbaggage.com"
    ],
    "legacySpider": "ButterandbaggageSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.butterandbaggage.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "butterandbliss",
    "domain": "butterandbliss.com",
    "allowedDomains": [
      "butterandbliss.com",
      "www.butterandbliss.com",
      "butterandbliss.net",
      "www.butterandbliss.net"
    ],
    "legacySpider": "ButterandblissSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.butterandbliss.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "butteryourbiscuit",
    "domain": "butteryourbiscuit.com",
    "allowedDomains": [
      "butteryourbiscuit.com",
      "www.butteryourbiscuit.com"
    ],
    "legacySpider": "ButteryourbiscuitSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.butteryourbiscuit.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cafedelites",
    "domain": "cafedelites.com",
    "allowedDomains": [
      "cafedelites.com",
      "www.cafedelites.com"
    ],
    "legacySpider": "CafedelitesSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cafedelites.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cakebycourtney",
    "domain": "cakebycourtney.com",
    "allowedDomains": [
      "cakebycourtney.com",
      "www.cakebycourtney.com"
    ],
    "legacySpider": "CakebycourtneySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cakebycourtney.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cakenknife",
    "domain": "cakenknife.com",
    "allowedDomains": [
      "cakenknife.com",
      "www.cakenknife.com"
    ],
    "legacySpider": "CakenknifeSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cakenknife.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cakewhiz",
    "domain": "cakewhiz.com",
    "allowedDomains": [
      "cakewhiz.com",
      "www.cakewhiz.com"
    ],
    "legacySpider": "CakewhizSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cakewhiz.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "callmepmc",
    "domain": "callmepmc.com",
    "allowedDomains": [
      "callmepmc.com",
      "www.callmepmc.com"
    ],
    "legacySpider": "CallmepmcSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.callmepmc.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "caramelandcashews",
    "domain": "caramelandcashews.com",
    "allowedDomains": [
      "caramelandcashews.com",
      "www.caramelandcashews.com"
    ],
    "legacySpider": "CaramelandcashewsSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.caramelandcashews.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "caribbeangreenliving",
    "domain": "caribbeangreenliving.com",
    "allowedDomains": [
      "caribbeangreenliving.com",
      "www.caribbeangreenliving.com"
    ],
    "legacySpider": "CaribbeangreenlivingSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.caribbeangreenliving.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "caribbeanpot",
    "domain": "caribbeanpot.com",
    "allowedDomains": [
      "caribbeanpot.com",
      "www.caribbeanpot.com"
    ],
    "legacySpider": "CaribbeanpotSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.caribbeanpot.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "carlsbadcravings",
    "domain": "carlsbadcravings.com",
    "allowedDomains": [
      "carlsbadcravings.com",
      "www.carlsbadcravings.com"
    ],
    "legacySpider": "CarlsbadcravingsSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.carlsbadcravings.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "casuallypeckish",
    "domain": "casuallypeckish.com",
    "allowedDomains": [
      "casuallypeckish.com",
      "www.casuallypeckish.com"
    ],
    "legacySpider": "CasuallypeckishSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.casuallypeckish.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "centercutcook",
    "domain": "centercutcook.com",
    "allowedDomains": [
      "centercutcook.com",
      "www.centercutcook.com"
    ],
    "legacySpider": "CentercutcookSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.centercutcook.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cheerfulcook",
    "domain": "cheerfulcook.com",
    "allowedDomains": [
      "cheerfulcook.com",
      "www.cheerfulcook.com"
    ],
    "legacySpider": "CheerfulcookSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cheerfulcook.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "chefjeanpierre",
    "domain": "chefjeanpierre.com",
    "allowedDomains": [
      "chefjeanpierre.com",
      "www.chefjeanpierre.com"
    ],
    "legacySpider": "ChefjeanpierreSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.chefjeanpierre.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cheflindseyfarr",
    "domain": "cheflindseyfarr.com",
    "allowedDomains": [
      "cheflindseyfarr.com",
      "www.cheflindseyfarr.com"
    ],
    "legacySpider": "CheflindseyfarrSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cheflindseyfarr.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cheflolaskitchen",
    "domain": "cheflolaskitchen.com",
    "allowedDomains": [
      "cheflolaskitchen.com",
      "www.cheflolaskitchen.com"
    ],
    "legacySpider": "CheflolaskitchenSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cheflolaskitchen.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "chefnotrequired",
    "domain": "chefnotrequired.com",
    "allowedDomains": [
      "chefnotrequired.com",
      "www.chefnotrequired.com"
    ],
    "legacySpider": "ChefnotrequiredSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.chefnotrequired.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "chelseasmessyapron",
    "domain": "chelseasmessyapron.com",
    "allowedDomains": [
      "chelseasmessyapron.com",
      "www.chelseasmessyapron.com"
    ],
    "legacySpider": "ChelseasmessyapronSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.chelseasmessyapron.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cheneetoday",
    "domain": "cheneetoday.com",
    "allowedDomains": [
      "cheneetoday.com",
      "www.cheneetoday.com"
    ],
    "legacySpider": "CheneetodaySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cheneetoday.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "chewoutloud",
    "domain": "chewoutloud.com",
    "allowedDomains": [
      "chewoutloud.com",
      "www.chewoutloud.com"
    ],
    "legacySpider": "ChewoutloudSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.chewoutloud.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "chicagojogger",
    "domain": "chicagojogger.com",
    "allowedDomains": [
      "chicagojogger.com",
      "www.chicagojogger.com"
    ],
    "legacySpider": "ChicagojoggerSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://chicagojogger.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "chocolatecoveredkatie",
    "domain": "chocolatecoveredkatie.com",
    "allowedDomains": [
      "chocolatecoveredkatie.com",
      "www.chocolatecoveredkatie.com"
    ],
    "legacySpider": "ChocolatecoveredkatieSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.chocolatecoveredkatie.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "ciaoflorentina",
    "domain": "ciaoflorentina.com",
    "allowedDomains": [
      "ciaoflorentina.com",
      "www.ciaoflorentina.com"
    ],
    "legacySpider": "CiaoflorentinaSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.ciaoflorentina.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cinnamonandcoriander",
    "domain": "cinnamonandcoriander.com",
    "allowedDomains": [
      "cinnamonandcoriander.com",
      "www.cinnamonandcoriander.com"
    ],
    "legacySpider": "CinnamonandcorianderSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cinnamonandcoriander.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cleanfoodcrush",
    "domain": "cleanfoodcrush.com",
    "allowedDomains": [
      "cleanfoodcrush.com",
      "www.cleanfoodcrush.com"
    ],
    "legacySpider": "CleanfoodcrushSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cleanfoodcrush.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "coleycooks",
    "domain": "coleycooks.com",
    "allowedDomains": [
      "coleycooks.com",
      "www.coleycooks.com"
    ],
    "legacySpider": "ColeycooksSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.coleycooks.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "completelydelicious",
    "domain": "completelydelicious.com",
    "allowedDomains": [
      "completelydelicious.com",
      "www.completelydelicious.com"
    ],
    "legacySpider": "CompletelydeliciousSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.completelydelicious.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "connoisseurusveg",
    "domain": "connoisseurusveg.com",
    "allowedDomains": [
      "connoisseurusveg.com",
      "www.connoisseurusveg.com"
    ],
    "legacySpider": "ConnoisseurusvegSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.connoisseurusveg.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cookathomemom",
    "domain": "cookathomemom.com",
    "allowedDomains": [
      "cookathomemom.com",
      "www.cookathomemom.com"
    ],
    "legacySpider": "CookathomemomSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cookathomemom.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cookcookgo",
    "domain": "cookcookgo.com",
    "allowedDomains": [
      "cookcookgo.com",
      "www.cookcookgo.com"
    ],
    "legacySpider": "CookCookGoSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://cookcookgo.com/dk/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cookiemadness",
    "domain": "cookiemadness.net",
    "allowedDomains": [
      "cookiemadness.net",
      "www.cookiemadness.net"
    ],
    "legacySpider": "CookiemadnessSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cookiemadness.net/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cookincanuck",
    "domain": "cookincanuck.com",
    "allowedDomains": [
      "cookincanuck.com",
      "www.cookincanuck.com"
    ],
    "legacySpider": "CookincanuckSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cookincanuck.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cookingchew",
    "domain": "cookingchew.com",
    "allowedDomains": [
      "cookingchew.com",
      "www.cookingchew.com"
    ],
    "legacySpider": "CookingchewSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cookingchew.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cookingclassy",
    "domain": "cookingclassy.com",
    "allowedDomains": [
      "cookingclassy.com",
      "www.cookingclassy.com"
    ],
    "legacySpider": "CookingclassySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cookingclassy.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cookingforkeeps",
    "domain": "cookingforkeeps.com",
    "allowedDomains": [
      "cookingforkeeps.com",
      "www.cookingforkeeps.com"
    ],
    "legacySpider": "CookingforkeepsSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cookingforkeeps.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cookingformysoul",
    "domain": "cookingformysoul.com",
    "allowedDomains": [
      "cookingformysoul.com",
      "www.cookingformysoul.com"
    ],
    "legacySpider": "CookingformysoulSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cookingformysoul.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cookingfromheart",
    "domain": "cookingfromheart.com",
    "allowedDomains": [
      "cookingfromheart.com",
      "www.cookingfromheart.com"
    ],
    "legacySpider": "CookingfromheartSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cookingfromheart.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cookinglsl",
    "domain": "cookinglsl.com",
    "allowedDomains": [
      "cookinglsl.com",
      "www.cookinglsl.com"
    ],
    "legacySpider": "CookinglslSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://cookinglsl.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cookjunkie",
    "domain": "cookjunkie.com",
    "allowedDomains": [
      "cookjunkie.com",
      "www.cookjunkie.com"
    ],
    "legacySpider": "CookjunkieSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cookjunkie.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cookrepublic",
    "domain": "cookrepublic.com",
    "allowedDomains": [
      "cookrepublic.com",
      "www.cookrepublic.com"
    ],
    "legacySpider": "CookrepublicSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cookrepublic.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cookshideout",
    "domain": "cookshideout.com",
    "allowedDomains": [
      "cookshideout.com",
      "www.cookshideout.com"
    ],
    "legacySpider": "CookshideoutSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cookshideout.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cooktoria",
    "domain": "cooktoria.com",
    "allowedDomains": [
      "cooktoria.com",
      "www.cooktoria.com"
    ],
    "legacySpider": "CooktoriaSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cooktoria.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cookwithkushi",
    "domain": "cookwithkushi.com",
    "allowedDomains": [
      "cookwithkushi.com",
      "www.cookwithkushi.com"
    ],
    "legacySpider": "CookwithkushiSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cookwithkushi.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cookwithmanali",
    "domain": "cookwithmanali.com",
    "allowedDomains": [
      "cookwithmanali.com",
      "www.cookwithmanali.com"
    ],
    "legacySpider": "CookwithmanaliSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cookwithmanali.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cookwithnabeela",
    "domain": "cookwithnabeela.com",
    "allowedDomains": [
      "cookwithnabeela.com",
      "www.cookwithnabeela.com"
    ],
    "legacySpider": "CookwithnabeelaSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cookwithnabeela.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "copykat",
    "domain": "copykat.com",
    "allowedDomains": [
      "copykat.com",
      "www.copykat.com"
    ],
    "legacySpider": "CopykatSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.copykat.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "craftbeering",
    "domain": "craftbeering.com",
    "allowedDomains": [
      "craftbeering.com",
      "www.craftbeering.com"
    ],
    "legacySpider": "CraftbeeringSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.craftbeering.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "crazyforcrust",
    "domain": "crazyforcrust.com",
    "allowedDomains": [
      "crazyforcrust.com",
      "www.crazyforcrust.com"
    ],
    "legacySpider": "CrazyforcrustSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.crazyforcrust.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "createbakemake",
    "domain": "createbakemake.com",
    "allowedDomains": [
      "createbakemake.com",
      "www.createbakemake.com"
    ],
    "legacySpider": "CreatebakemakeSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.createbakemake.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "crunchycreamysweet",
    "domain": "crunchycreamysweet.com",
    "allowedDomains": [
      "crunchycreamysweet.com",
      "www.crunchycreamysweet.com"
    ],
    "legacySpider": "CrunchycreamysweetSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.crunchycreamysweet.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cubesnjuliennes",
    "domain": "cubesnjuliennes.com",
    "allowedDomains": [
      "cubesnjuliennes.com",
      "www.cubesnjuliennes.com"
    ],
    "legacySpider": "CubesnjuliennesSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cubesnjuliennes.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cuisineandtravel",
    "domain": "cuisineandtravel.com",
    "allowedDomains": [
      "cuisineandtravel.com",
      "www.cuisineandtravel.com"
    ],
    "legacySpider": "CuisineandtravelSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cuisineandtravel.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "culinaryginger",
    "domain": "culinaryginger.com",
    "allowedDomains": [
      "culinaryginger.com",
      "www.culinaryginger.com"
    ],
    "legacySpider": "CulinarygingerSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.culinaryginger.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "culinaryhill",
    "domain": "culinaryhill.com",
    "allowedDomains": [
      "culinaryhill.com",
      "www.culinaryhill.com"
    ],
    "legacySpider": "CulinaryhillSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.culinaryhill.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "cupcakesandkalechips",
    "domain": "cupcakesandkalechips.com",
    "allowedDomains": [
      "cupcakesandkalechips.com",
      "www.cupcakesandkalechips.com"
    ],
    "legacySpider": "CupcakesandkalechipsSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.cupcakesandkalechips.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "curiouscuisiniere",
    "domain": "curiouscuisiniere.com",
    "allowedDomains": [
      "curiouscuisiniere.com",
      "www.curiouscuisiniere.com"
    ],
    "legacySpider": "CuriouscuisiniereSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.curiouscuisiniere.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "curlygirlkitchen",
    "domain": "curlygirlkitchen.com",
    "allowedDomains": [
      "curlygirlkitchen.com",
      "www.curlygirlkitchen.com"
    ],
    "legacySpider": "CurlygirlkitchenSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.curlygirlkitchen.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "currytrail",
    "domain": "currytrail.in",
    "allowedDomains": [
      "currytrail.in",
      "www.currytrail.in"
    ],
    "legacySpider": "CurrytrailSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.currytrail.in/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "dadwithapan",
    "domain": "dadwithapan.com",
    "allowedDomains": [
      "dadwithapan.com",
      "www.dadwithapan.com"
    ],
    "legacySpider": "DadwithapanSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.dadwithapan.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "dailydishrecipes",
    "domain": "dailydishrecipes.com",
    "allowedDomains": [
      "dailydishrecipes.com",
      "www.dailydishrecipes.com"
    ],
    "legacySpider": "DailydishrecipesSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.dailydishrecipes.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "damnspicy",
    "domain": "damnspicy.com",
    "allowedDomains": [
      "damnspicy.com",
      "www.damnspicy.com"
    ],
    "legacySpider": "DamnspicySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.damnspicy.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "dancearoundthekitchen",
    "domain": "dancearoundthekitchen.com",
    "allowedDomains": [
      "dancearoundthekitchen.com",
      "www.dancearoundthekitchen.com"
    ],
    "legacySpider": "DancearoundthekitchenSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.dancearoundthekitchen.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "daringgourmet",
    "domain": "daringgourmet.com",
    "allowedDomains": [
      "daringgourmet.com",
      "www.daringgourmet.com"
    ],
    "legacySpider": "DaringgourmetSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.daringgourmet.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "davidlebovitz",
    "domain": "davidlebovitz.com",
    "allowedDomains": [
      "davidlebovitz.com",
      "www.davidlebovitz.com"
    ],
    "legacySpider": "DavidlebovitzSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.davidlebovitz.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "deliciousfromscratch",
    "domain": "deliciousfromscratch.com",
    "allowedDomains": [
      "deliciousfromscratch.com",
      "www.deliciousfromscratch.com"
    ],
    "legacySpider": "DeliciousfromscratchSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.deliciousfromscratch.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "deliciouslysprinkled",
    "domain": "deliciouslysprinkled.com",
    "allowedDomains": [
      "deliciouslysprinkled.com",
      "www.deliciouslysprinkled.com"
    ],
    "legacySpider": "DeliciouslysprinkledSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.deliciouslysprinkled.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "deliciousmeetshealthy",
    "domain": "deliciousmeetshealthy.com",
    "allowedDomains": [
      "deliciousmeetshealthy.com",
      "www.deliciousmeetshealthy.com"
    ],
    "legacySpider": "DeliciousmeetshealthySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.deliciousmeetshealthy.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "delicioustable",
    "domain": "delicioustable.com",
    "allowedDomains": [
      "delicioustable.com",
      "www.delicioustable.com"
    ],
    "legacySpider": "DelicioustableSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.delicioustable.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "delightfuladventures",
    "domain": "delightfuladventures.com",
    "allowedDomains": [
      "delightfuladventures.com",
      "www.delightfuladventures.com"
    ],
    "legacySpider": "DelightfuladventuresSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.delightfuladventures.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "dessertfortwo",
    "domain": "dessertfortwo.com",
    "allowedDomains": [
      "dessertfortwo.com",
      "www.dessertfortwo.com"
    ],
    "legacySpider": "DessertfortwoSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.dessertfortwo.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "dessertswithbenefits",
    "domain": "dessertswithbenefits.com",
    "allowedDomains": [
      "dessertswithbenefits.com",
      "www.dessertswithbenefits.com"
    ],
    "legacySpider": "DessertswithbenefitsSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.dessertswithbenefits.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "detoxinista",
    "domain": "detoxinista.com",
    "allowedDomains": [
      "detoxinista.com",
      "www.detoxinista.com"
    ],
    "legacySpider": "DetoxinistaSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.detoxinista.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "diethood",
    "domain": "diethood.com",
    "allowedDomains": [
      "diethood.com",
      "www.diethood.com"
    ],
    "legacySpider": "DiethoodSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.diethood.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "dineanddish",
    "domain": "dineanddish.net",
    "allowedDomains": [
      "dineanddish.net",
      "www.dineanddish.net"
    ],
    "legacySpider": "DineanddishSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.dineanddish.net/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "dinneratthezoo",
    "domain": "dinneratthezoo.com",
    "allowedDomains": [
      "dinneratthezoo.com",
      "www.dinneratthezoo.com"
    ],
    "legacySpider": "DinneratthezooSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.dinneratthezoo.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "dinnersdishesanddesserts",
    "domain": "dinnersdishesanddesserts.com",
    "allowedDomains": [
      "dinnersdishesanddesserts.com",
      "www.dinnersdishesanddesserts.com"
    ],
    "legacySpider": "DinnersdishesanddessertsSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.dinnersdishesanddesserts.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "dishesdelish",
    "domain": "dishesdelish.com",
    "allowedDomains": [
      "dishesdelish.com",
      "www.dishesdelish.com"
    ],
    "legacySpider": "DishesdelishSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.dishesdelish.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "dizzybusyandhungry",
    "domain": "dizzybusyandhungry.com",
    "allowedDomains": [
      "dizzybusyandhungry.com",
      "www.dizzybusyandhungry.com"
    ],
    "legacySpider": "DizzybusyandhungrySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.dizzybusyandhungry.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "dobbyssignature",
    "domain": "dobbyssignature.com",
    "allowedDomains": [
      "dobbyssignature.com",
      "www.dobbyssignature.com"
    ],
    "legacySpider": "DobbyssignatureSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.dobbyssignature.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "domesticateme",
    "domain": "domesticate-me.com",
    "allowedDomains": [
      "domesticate-me.com",
      "www.domesticate-me.com"
    ],
    "legacySpider": "DomesticateMeSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.domesticate-me.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "domesticgothess",
    "domain": "domesticgothess.com",
    "allowedDomains": [
      "domesticgothess.com",
      "www.domesticgothess.com"
    ],
    "legacySpider": "DomesticgothessSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.domesticgothess.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "domesticsuperhero",
    "domain": "domesticsuperhero.com",
    "allowedDomains": [
      "domesticsuperhero.com",
      "www.domesticsuperhero.com"
    ],
    "legacySpider": "DomesticsuperheroSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://domesticsuperhero.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "dontgobaconmyheart",
    "domain": "dontgobaconmyheart.co.uk",
    "allowedDomains": [
      "dontgobaconmyheart.co.uk",
      "www.dontgobaconmyheart.co.uk"
    ],
    "legacySpider": "DontgobaconmyheartSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.dontgobaconmyheart.co.uk/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "dontsweattherecipe",
    "domain": "dontsweattherecipe.com",
    "allowedDomains": [
      "dontsweattherecipe.com",
      "www.dontsweattherecipe.com"
    ],
    "legacySpider": "DontsweattherecipeSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.dontsweattherecipe.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "downredbuddrive",
    "domain": "downredbuddrive.com",
    "allowedDomains": [
      "downredbuddrive.com",
      "www.downredbuddrive.com"
    ],
    "legacySpider": "DownredbuddriveSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.downredbuddrive.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "downshiftology",
    "domain": "downshiftology.com",
    "allowedDomains": [
      "downshiftology.com",
      "www.downshiftology.com"
    ],
    "legacySpider": "DownshiftologySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.downshiftology.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "drizzleanddip",
    "domain": "drizzleanddip.com",
    "allowedDomains": [
      "drizzleanddip.com",
      "www.drizzleanddip.com"
    ],
    "legacySpider": "DrizzleanddipSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.drizzleanddip.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "easyanddelish",
    "domain": "easyanddelish.com",
    "allowedDomains": [
      "easyanddelish.com",
      "www.easyanddelish.com"
    ],
    "legacySpider": "EasyanddelishSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.easyanddelish.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "easycheesyvegetarian",
    "domain": "easycheesyvegetarian.com",
    "allowedDomains": [
      "easycheesyvegetarian.com",
      "www.easycheesyvegetarian.com"
    ],
    "legacySpider": "EasycheesyvegetarianSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.easycheesyvegetarian.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "easypeasyfoodie",
    "domain": "easypeasyfoodie.com",
    "allowedDomains": [
      "easypeasyfoodie.com",
      "www.easypeasyfoodie.com"
    ],
    "legacySpider": "EasypeasyfoodieSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.easypeasyfoodie.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "easyrecipedepot",
    "domain": "easyrecipedepot.com",
    "allowedDomains": [
      "easyrecipedepot.com",
      "www.easyrecipedepot.com"
    ],
    "legacySpider": "EasyrecipedepotSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.easyrecipedepot.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "easysavory",
    "domain": "easysavory.com",
    "allowedDomains": [
      "easysavory.com",
      "www.easysavory.com"
    ],
    "legacySpider": "EasysavorySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.easysavory.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "eatingbirdfood",
    "domain": "eatingbirdfood.com",
    "allowedDomains": [
      "eatingbirdfood.com",
      "www.eatingbirdfood.com"
    ],
    "legacySpider": "EatingbirdfoodSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.eatingbirdfood.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "eatingeuropean",
    "domain": "eatingeuropean.com",
    "allowedDomains": [
      "eatingeuropean.com",
      "www.eatingeuropean.com"
    ],
    "legacySpider": "EatingeuropeanSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.eatingeuropean.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "eatingrules",
    "domain": "eatingrules.com",
    "allowedDomains": [
      "eatingrules.com",
      "www.eatingrules.com"
    ],
    "legacySpider": "EatingrulesSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.eatingrules.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "eatthegains",
    "domain": "eatthegains.com",
    "allowedDomains": [
      "eatthegains.com",
      "www.eatthegains.com"
    ],
    "legacySpider": "EatthegainsSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.eatthegains.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "eatwithclarity",
    "domain": "eatwithclarity.com",
    "allowedDomains": [
      "eatwithclarity.com",
      "www.eatwithclarity.com"
    ],
    "legacySpider": "EatwithclaritySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.eatwithclarity.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "eatwithohashi",
    "domain": "eatwithohashi.com",
    "allowedDomains": [
      "eatwithohashi.com",
      "www.eatwithohashi.com"
    ],
    "legacySpider": "EatwithohashiSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.eatwithohashi.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "eatyourselfskinny",
    "domain": "eatyourselfskinny.com",
    "allowedDomains": [
      "eatyourselfskinny.com",
      "www.eatyourselfskinny.com"
    ],
    "legacySpider": "EatyourselfskinnySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.eatyourselfskinny.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "effortlessfoodie",
    "domain": "effortlessfoodie.com",
    "allowedDomains": [
      "effortlessfoodie.com",
      "www.effortlessfoodie.com"
    ],
    "legacySpider": "EffortlessfoodieSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.effortlessfoodie.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "egglesscooking",
    "domain": "egglesscooking.com",
    "allowedDomains": [
      "egglesscooking.com",
      "www.egglesscooking.com"
    ],
    "legacySpider": "EgglesscookingSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.egglesscooking.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "elanaspantry",
    "domain": "elanaspantry.com",
    "allowedDomains": [
      "elanaspantry.com",
      "www.elanaspantry.com"
    ],
    "legacySpider": "ElanaspantrySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.elanaspantry.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "elavegan",
    "domain": "elavegan.com",
    "allowedDomains": [
      "elavegan.com",
      "www.elavegan.com"
    ],
    "legacySpider": "ElaveganSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.elavegan.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "elephantasticvegan",
    "domain": "elephantasticvegan.com",
    "allowedDomains": [
      "elephantasticvegan.com",
      "www.elephantasticvegan.com"
    ],
    "legacySpider": "ElephantasticveganSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.elephantasticvegan.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "elizabethskitchendiary",
    "domain": "elizabethskitchendiary.co.uk",
    "allowedDomains": [
      "elizabethskitchendiary.co.uk",
      "www.elizabethskitchendiary.co.uk"
    ],
    "legacySpider": "ElizabethskitchendiarySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.elizabethskitchendiary.co.uk/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "emilybites",
    "domain": "emilybites.com",
    "allowedDomains": [
      "emilybites.com",
      "www.emilybites.com"
    ],
    "legacySpider": "EmilybitesSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.emilybites.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "emilyenchanted",
    "domain": "emilyenchanted.com",
    "allowedDomains": [
      "emilyenchanted.com",
      "www.emilyenchanted.com"
    ],
    "legacySpider": "EmilyenchantedSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.emilyenchanted.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "entertainingwithbeth",
    "domain": "entertainingwithbeth.com",
    "allowedDomains": [
      "entertainingwithbeth.com",
      "www.entertainingwithbeth.com"
    ],
    "legacySpider": "EntertainingwithbethSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.entertainingwithbeth.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "errenskitchen",
    "domain": "errenskitchen.com",
    "allowedDomains": [
      "errenskitchen.com",
      "www.errenskitchen.com"
    ],
    "legacySpider": "ErrenskitchenSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.errenskitchen.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "evergreenkitchen",
    "domain": "evergreenkitchen.ca",
    "allowedDomains": [
      "evergreenkitchen.ca",
      "www.evergreenkitchen.ca"
    ],
    "legacySpider": "EvergreenkitchenSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.evergreenkitchen.ca/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "everydaymaven",
    "domain": "everydaymaven.com",
    "allowedDomains": [
      "everydaymaven.com",
      "www.everydaymaven.com"
    ],
    "legacySpider": "EverydaymavenSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.everydaymaven.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "everylastbite",
    "domain": "everylastbite.com",
    "allowedDomains": [
      "everylastbite.com",
      "www.everylastbite.com"
    ],
    "legacySpider": "EverylastbiteSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.everylastbite.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "evolvingtable",
    "domain": "evolvingtable.com",
    "allowedDomains": [
      "evolvingtable.com",
      "www.evolvingtable.com"
    ],
    "legacySpider": "EvolvingtableSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.evolvingtable.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "fabfood4all",
    "domain": "fabfood4all.co.uk",
    "allowedDomains": [
      "fabfood4all.co.uk",
      "www.fabfood4all.co.uk"
    ],
    "legacySpider": "Fabfood4allSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.fabfood4all.co.uk/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "fabulesslyfrugal",
    "domain": "fabulesslyfrugal.com",
    "allowedDomains": [
      "fabulesslyfrugal.com",
      "www.fabulesslyfrugal.com"
    ],
    "legacySpider": "FabulesslyfrugalSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.fabulesslyfrugal.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "familyfreshmeals",
    "domain": "familyfreshmeals.com",
    "allowedDomains": [
      "familyfreshmeals.com",
      "www.familyfreshmeals.com"
    ],
    "legacySpider": "FamilyfreshmealsSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.familyfreshmeals.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "familystylefood",
    "domain": "familystylefood.com",
    "allowedDomains": [
      "familystylefood.com",
      "www.familystylefood.com"
    ],
    "legacySpider": "FamilystylefoodSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.familystylefood.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "farmgirlgourmet",
    "domain": "farmgirlgourmet.com",
    "allowedDomains": [
      "farmgirlgourmet.com",
      "www.farmgirlgourmet.com"
    ],
    "legacySpider": "FarmgirlgourmetSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.farmgirlgourmet.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "fatgirlskinny",
    "domain": "fatgirlskinny.net",
    "allowedDomains": [
      "fatgirlskinny.net",
      "www.fatgirlskinny.net"
    ],
    "legacySpider": "FatgirlskinnySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.fatgirlskinny.net/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "fearlessdining",
    "domain": "fearlessdining.com",
    "allowedDomains": [
      "fearlessdining.com",
      "www.fearlessdining.com"
    ],
    "legacySpider": "FearlessdiningSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.fearlessdining.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "feastandfarm",
    "domain": "feastandfarm.com",
    "allowedDomains": [
      "feastandfarm.com",
      "www.feastandfarm.com"
    ],
    "legacySpider": "FeastandfarmSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.feastandfarm.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "fedandfit",
    "domain": "fedandfit.com",
    "allowedDomains": [
      "fedandfit.com",
      "www.fedandfit.com"
    ],
    "legacySpider": "FedandfitSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.fedandfit.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "feelgoodfoodie",
    "domain": "feelgoodfoodie.net",
    "allowedDomains": [
      "feelgoodfoodie.net",
      "www.feelgoodfoodie.net"
    ],
    "legacySpider": "FeelgoodfoodieSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.feelgoodfoodie.net/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "feistytapas",
    "domain": "feistytapas.com",
    "allowedDomains": [
      "feistytapas.com",
      "www.feistytapas.com"
    ],
    "legacySpider": "FeistytapasSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.feistytapas.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "firstdayofhome",
    "domain": "firstdayofhome.com",
    "allowedDomains": [
      "firstdayofhome.com",
      "www.firstdayofhome.com"
    ],
    "legacySpider": "FirstdayofhomeSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.firstdayofhome.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "fitfoodiefinds",
    "domain": "fitfoodiefinds.com",
    "allowedDomains": [
      "fitfoodiefinds.com",
      "www.fitfoodiefinds.com"
    ],
    "legacySpider": "FitfoodiefindsSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.fitfoodiefinds.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "fivehearthome",
    "domain": "fivehearthome.com",
    "allowedDomains": [
      "fivehearthome.com",
      "www.fivehearthome.com"
    ],
    "legacySpider": "FivehearthomeSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.fivehearthome.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "flavcity",
    "domain": "flavcity.com",
    "allowedDomains": [
      "flavcity.com",
      "www.flavcity.com"
    ],
    "legacySpider": "FlavcitySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.flavcity.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "flavourandsavour",
    "domain": "flavourandsavour.com",
    "allowedDomains": [
      "flavourandsavour.com",
      "www.flavourandsavour.com"
    ],
    "legacySpider": "FlavourandsavourSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.flavourandsavour.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "flawlessfood",
    "domain": "flawlessfood.co.uk",
    "allowedDomains": [
      "flawlessfood.co.uk",
      "www.flawlessfood.co.uk"
    ],
    "legacySpider": "FlawlessfoodSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.flawlessfood.co.uk/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "flouronmyface",
    "domain": "flouronmyface.com",
    "allowedDomains": [
      "flouronmyface.com",
      "www.flouronmyface.com"
    ],
    "legacySpider": "FlouronmyfaceSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.flouronmyface.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "floursandfrostings",
    "domain": "floursandfrostings.com",
    "allowedDomains": [
      "floursandfrostings.com",
      "www.floursandfrostings.com"
    ],
    "legacySpider": "FloursandfrostingsSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.floursandfrostings.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "foodbanjo",
    "domain": "foodbanjo.com",
    "allowedDomains": [
      "foodbanjo.com",
      "www.foodbanjo.com"
    ],
    "legacySpider": "FoodbanjoSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.foodbanjo.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "foodfaithfitness",
    "domain": "foodfaithfitness.com",
    "allowedDomains": [
      "foodfaithfitness.com",
      "www.foodfaithfitness.com"
    ],
    "legacySpider": "FoodfaithfitnessSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.foodfaithfitness.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "foodieandwine",
    "domain": "foodieandwine.com",
    "allowedDomains": [
      "foodieandwine.com",
      "www.foodieandwine.com"
    ],
    "legacySpider": "FoodieandwineSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.foodieandwine.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "foodiewithfamily",
    "domain": "foodiewithfamily.com",
    "allowedDomains": [
      "foodiewithfamily.com",
      "www.foodiewithfamily.com"
    ],
    "legacySpider": "FoodiewithfamilySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.foodiewithfamily.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "foodmeanderings",
    "domain": "foodmeanderings.com",
    "allowedDomains": [
      "foodmeanderings.com",
      "www.foodmeanderings.com"
    ],
    "legacySpider": "FoodmeanderingsSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.foodmeanderings.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "foodnourish",
    "domain": "foodnourish.net",
    "allowedDomains": [
      "foodnourish.net",
      "www.foodnourish.net"
    ],
    "legacySpider": "FoodnourishSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://foodnourish.net/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "foodwithfeeling",
    "domain": "foodwithfeeling.com",
    "allowedDomains": [
      "foodwithfeeling.com",
      "www.foodwithfeeling.com"
    ],
    "legacySpider": "FoodwithfeelingSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.foodwithfeeling.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "foolproofliving",
    "domain": "foolproofliving.com",
    "allowedDomains": [
      "foolproofliving.com",
      "www.foolproofliving.com"
    ],
    "legacySpider": "FoolprooflivingSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.foolproofliving.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "forkandtwist",
    "domain": "forkandtwist.com",
    "allowedDomains": [
      "forkandtwist.com",
      "www.forkandtwist.com"
    ],
    "legacySpider": "ForkandtwistSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.forkandtwist.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "fortheloveofcooking",
    "domain": "fortheloveofcooking.net",
    "allowedDomains": [
      "fortheloveofcooking.net",
      "www.fortheloveofcooking.net"
    ],
    "legacySpider": "FortheloveofcookingSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.fortheloveofcooking.net/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "foxandbriar",
    "domain": "foxandbriar.com",
    "allowedDomains": [
      "foxandbriar.com",
      "www.foxandbriar.com"
    ],
    "legacySpider": "FoxandbriarSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.foxandbriar.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "freshsavory",
    "domain": "freshsavory.com",
    "allowedDomains": [
      "freshsavory.com",
      "www.freshsavory.com"
    ],
    "legacySpider": "FreshsavorySpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.freshsavory.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "fromachefskitchen",
    "domain": "fromachefskitchen.com",
    "allowedDomains": [
      "fromachefskitchen.com",
      "www.fromachefskitchen.com"
    ],
    "legacySpider": "FromachefskitchenSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.fromachefskitchen.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "frommybowl",
    "domain": "frommybowl.com",
    "allowedDomains": [
      "frommybowl.com",
      "www.frommybowl.com"
    ],
    "legacySpider": "FrommybowlSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.frommybowl.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "fromscratchfast",
    "domain": "fromscratchfast.com",
    "allowedDomains": [
      "fromscratchfast.com",
      "www.fromscratchfast.com"
    ],
    "legacySpider": "FromscratchfastSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.fromscratchfast.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "fromvalerieskitchen",
    "domain": "fromvalerieskitchen.com",
    "allowedDomains": [
      "fromvalerieskitchen.com",
      "www.fromvalerieskitchen.com"
    ],
    "legacySpider": "FromvalerieskitchenSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.fromvalerieskitchen.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "fullofplants",
    "domain": "fullofplants.com",
    "allowedDomains": [
      "fullofplants.com",
      "www.fullofplants.com"
    ],
    "legacySpider": "FullofplantsSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.fullofplants.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "funfoodfrolic",
    "domain": "funfoodfrolic.com",
    "allowedDomains": [
      "funfoodfrolic.com",
      "www.funfoodfrolic.com"
    ],
    "legacySpider": "FunfoodfrolicSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.funfoodfrolic.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "garnishandglaze",
    "domain": "garnishandglaze.com",
    "allowedDomains": [
      "garnishandglaze.com",
      "www.garnishandglaze.com"
    ],
    "legacySpider": "GarnishandglazeSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.garnishandglaze.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
      "rateLimitPerMinute": null,
      "maxConcurrency": 2,
      "maxRetries": 3
    },
    "requireCompleteJsonLd": true,
    "migrationState": "not_started",
    "latestScrapyOutcome": "not_audited"
  },
  {
    "id": "gatheringdreams",
    "domain": "gatheringdreams.com",
    "allowedDomains": [
      "gatheringdreams.com",
      "www.gatheringdreams.com"
    ],
    "legacySpider": "GatheringdreamsSpider",
    "legacyFamily": "WprmApiSpider",
    "discovery": "listing",
    "sitemapUrls": [],
    "startUrls": [
      "https://www.gatheringdreams.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=1"
    ],
    "recipeUrlPatterns": [
      "^https?://"
    ],
    "fetchMode": "cheerio",
    "requestSettings": {
      "delaySeconds": 1,
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
  "40aprons": WP_POSTS_LISTING_DISCOVERY,
  acedarspoon: WP_POSTS_LISTING_DISCOVERY,
  acozykitchen: WP_POSTS_LISTING_DISCOVERY,
  addapinch: WP_POSTS_LISTING_DISCOVERY,
  addictedtodates: WP_POSTS_LISTING_DISCOVERY,
  africanbites: WP_POSTS_LISTING_DISCOVERY,
  afullliving: WP_POSTS_LISTING_DISCOVERY,
  agirldefloured: WP_POSTS_LISTING_DISCOVERY,
  ahintofrosemary: WP_POSTS_LISTING_DISCOVERY,
  aimadeitforyou: WP_POSTS_LISTING_DISCOVERY,
  airfryeryum: WP_POSTS_LISTING_DISCOVERY,
  alattefood: WP_POSTS_LISTING_DISCOVERY,
  alittlebitofspice: WP_POSTS_LISTING_DISCOVERY,
  alldayidreamaboutfood: WP_POSTS_LISTING_DISCOVERY,
  allshecooks: WP_POSTS_LISTING_DISCOVERY,
  alphafoodie: WP_POSTS_LISTING_DISCOVERY,
  altonbrown: WP_POSTS_LISTING_DISCOVERY,
  alwaysusebutter: WP_POSTS_LISTING_DISCOVERY,
  amandascookin: WP_POSTS_LISTING_DISCOVERY,
  amiraspantry: WP_POSTS_LISTING_DISCOVERY,
  amuseyourbouche: WP_POSTS_LISTING_DISCOVERY,
  amyinthekitchen: WP_POSTS_LISTING_DISCOVERY,
  amyshealthybaking: WP_POSTS_LISTING_DISCOVERY,
  anaffairfromtheheart: WP_POSTS_LISTING_DISCOVERY,
  andiemitchell: WP_POSTS_LISTING_DISCOVERY,
  anitalianinmykitchen: WP_POSTS_LISTING_DISCOVERY,
  anoregoncottage: WP_POSTS_LISTING_DISCOVERY,
  apeachyplate: WP_POSTS_LISTING_DISCOVERY,
  aprettylifeinthesuburbs: WP_POSTS_LISTING_DISCOVERY,
  artofnaturalliving: WP_POSTS_LISTING_DISCOVERY,
  aseasyasapplepie: WP_POSTS_LISTING_DISCOVERY,
  asimplepalate: WP_POSTS_LISTING_DISCOVERY,
  askchefdennis: WP_POSTS_LISTING_DISCOVERY,
  aspicyperspective: WP_POSTS_LISTING_DISCOVERY,
  athomewithshay: WP_POSTS_LISTING_DISCOVERY,
  averiecooks: WP_POSTS_LISTING_DISCOVERY,
  bakedambrosia: WP_POSTS_LISTING_DISCOVERY,
  bakedbyrachel: WP_POSTS_LISTING_DISCOVERY,
  bakefromscratch: WP_POSTS_LISTING_DISCOVERY,
  bakeitwithlove: WP_POSTS_LISTING_DISCOVERY,
  bakeorbreak: WP_POSTS_LISTING_DISCOVERY,
  bakeplate: WP_POSTS_LISTING_DISCOVERY,
  bakeplaysmile: WP_POSTS_LISTING_DISCOVERY,
  bakerbynature: WP_POSTS_LISTING_DISCOVERY,
  bakerita: WP_POSTS_LISTING_DISCOVERY,
  bakesbybrownsugar: WP_POSTS_LISTING_DISCOVERY,
  bakingamoment: WP_POSTS_LISTING_DISCOVERY,
  bakingbeauty: WP_POSTS_LISTING_DISCOVERY,
  bakingginger: WP_POSTS_LISTING_DISCOVERY,
  bakingmischief: WP_POSTS_LISTING_DISCOVERY,
  barefeetinthekitchen: WP_POSTS_LISTING_DISCOVERY,
  barleyandsage: WP_POSTS_LISTING_DISCOVERY,
  beamingbaker: WP_POSTS_LISTING_DISCOVERY,
  bellyfull: WP_POSTS_LISTING_DISCOVERY,
  berlyskitchen: WP_POSTS_LISTING_DISCOVERY,
  berrymaple: WP_POSTS_LISTING_DISCOVERY,
  bessiebakes: WP_POSTS_LISTING_DISCOVERY,
  bestrecipebox: WP_POSTS_LISTING_DISCOVERY,
  beyondkimchee: WP_POSTS_LISTING_DISCOVERY,
  biancazapatka: WP_POSTS_LISTING_DISCOVERY,
  biggerbolderbaking: WP_POSTS_LISTING_DISCOVERY,
  bigrecipe: WP_POSTS_LISTING_DISCOVERY,
  biscuitsandburlap: WP_POSTS_LISTING_DISCOVERY,
  biteswithbri: WP_POSTS_LISTING_DISCOVERY,
  blackberrybabe: WP_POSTS_LISTING_DISCOVERY,
  blackpeoplesrecipes: WP_POSTS_LISTING_DISCOVERY,
  blendwithspices: WP_POSTS_LISTING_DISCOVERY,
  bluebowlrecipes: WP_POSTS_LISTING_DISCOVERY,
  boulderlocavore: WP_POSTS_LISTING_DISCOVERY,
  bowlofdelicious: WP_POSTS_LISTING_DISCOVERY,
  breadboozebacon: WP_POSTS_LISTING_DISCOVERY,
  brighteyedbaker: WP_POSTS_LISTING_DISCOVERY,
  browneyedbaker: WP_POSTS_LISTING_DISCOVERY,
  budgetbytes: WP_POSTS_LISTING_DISCOVERY,
  buildyourbite: WP_POSTS_LISTING_DISCOVERY,
  bunnyswarmoven: WP_POSTS_LISTING_DISCOVERY,
  butterandbaggage: WP_POSTS_LISTING_DISCOVERY,
  butterandbliss: WP_POSTS_LISTING_DISCOVERY,
  butteryourbiscuit: WP_POSTS_LISTING_DISCOVERY,
  cafedelites: WP_POSTS_LISTING_DISCOVERY,
  cakebycourtney: WP_POSTS_LISTING_DISCOVERY,
  cakenknife: WP_POSTS_LISTING_DISCOVERY,
  cakewhiz: WP_POSTS_LISTING_DISCOVERY,
  callmepmc: WP_POSTS_LISTING_DISCOVERY,
  caramelandcashews: WP_POSTS_LISTING_DISCOVERY,
  caribbeangreenliving: WP_POSTS_LISTING_DISCOVERY,
  caribbeanpot: WP_POSTS_LISTING_DISCOVERY,
  carlsbadcravings: WP_POSTS_LISTING_DISCOVERY,
  casuallypeckish: WP_POSTS_LISTING_DISCOVERY,
  centercutcook: WP_POSTS_LISTING_DISCOVERY,
  cheerfulcook: WP_POSTS_LISTING_DISCOVERY,
  chefjeanpierre: WP_POSTS_LISTING_DISCOVERY,
  cheflindseyfarr: WP_POSTS_LISTING_DISCOVERY,
  cheflolaskitchen: WP_POSTS_LISTING_DISCOVERY,
  chefnotrequired: WP_POSTS_LISTING_DISCOVERY,
  chelseasmessyapron: WP_POSTS_LISTING_DISCOVERY,
  cheneetoday: WP_POSTS_LISTING_DISCOVERY,
  chewoutloud: WP_POSTS_LISTING_DISCOVERY,
  chicagojogger: WP_POSTS_LISTING_DISCOVERY,
  chocolatecoveredkatie: WP_POSTS_LISTING_DISCOVERY,
  ciaoflorentina: WP_POSTS_LISTING_DISCOVERY,
  cinnamonandcoriander: WP_POSTS_LISTING_DISCOVERY,
  cleanfoodcrush: WP_POSTS_LISTING_DISCOVERY,
  coleycooks: WP_POSTS_LISTING_DISCOVERY,
  completelydelicious: WP_POSTS_LISTING_DISCOVERY,
  connoisseurusveg: WP_POSTS_LISTING_DISCOVERY,
  cookathomemom: WP_POSTS_LISTING_DISCOVERY,
  cookcookgo: WP_POSTS_LISTING_DISCOVERY,
  cookiemadness: WP_POSTS_LISTING_DISCOVERY,
  cookincanuck: WP_POSTS_LISTING_DISCOVERY,
  cookingchew: WP_POSTS_LISTING_DISCOVERY,
  cookingclassy: WP_POSTS_LISTING_DISCOVERY,
  cookingforkeeps: WP_POSTS_LISTING_DISCOVERY,
  cookingformysoul: WP_POSTS_LISTING_DISCOVERY,
  cookingfromheart: WP_POSTS_LISTING_DISCOVERY,
  cookinglsl: WP_POSTS_LISTING_DISCOVERY,
  cookjunkie: WP_POSTS_LISTING_DISCOVERY,
  cookrepublic: WP_POSTS_LISTING_DISCOVERY,
  cookshideout: WP_POSTS_LISTING_DISCOVERY,
  cooktoria: WP_POSTS_LISTING_DISCOVERY,
  cookwithkushi: WP_POSTS_LISTING_DISCOVERY,
  cookwithmanali: WP_POSTS_LISTING_DISCOVERY,
  cookwithnabeela: WP_POSTS_LISTING_DISCOVERY,
  copykat: WP_POSTS_LISTING_DISCOVERY,
  craftbeering: WP_POSTS_LISTING_DISCOVERY,
  crazyforcrust: WP_POSTS_LISTING_DISCOVERY,
  createbakemake: WP_POSTS_LISTING_DISCOVERY,
  crunchycreamysweet: WP_POSTS_LISTING_DISCOVERY,
  cubesnjuliennes: WP_POSTS_LISTING_DISCOVERY,
  cuisineandtravel: WP_POSTS_LISTING_DISCOVERY,
  culinaryginger: WP_POSTS_LISTING_DISCOVERY,
  culinaryhill: WP_POSTS_LISTING_DISCOVERY,
  cupcakesandkalechips: WP_POSTS_LISTING_DISCOVERY,
  curiouscuisiniere: WP_POSTS_LISTING_DISCOVERY,
  curlygirlkitchen: WP_POSTS_LISTING_DISCOVERY,
  currytrail: WP_POSTS_LISTING_DISCOVERY,
  dadwithapan: WP_POSTS_LISTING_DISCOVERY,
  dailydishrecipes: WP_POSTS_LISTING_DISCOVERY,
  damnspicy: WP_POSTS_LISTING_DISCOVERY,
  dancearoundthekitchen: WP_POSTS_LISTING_DISCOVERY,
  daringgourmet: WP_POSTS_LISTING_DISCOVERY,
  davidlebovitz: WP_POSTS_LISTING_DISCOVERY,
  deliciousfromscratch: WP_POSTS_LISTING_DISCOVERY,
  deliciouslysprinkled: WP_POSTS_LISTING_DISCOVERY,
  deliciousmeetshealthy: WP_POSTS_LISTING_DISCOVERY,
  delicioustable: WP_POSTS_LISTING_DISCOVERY,
  delightfuladventures: WP_POSTS_LISTING_DISCOVERY,
  dessertfortwo: WP_POSTS_LISTING_DISCOVERY,
  dessertswithbenefits: WP_POSTS_LISTING_DISCOVERY,
  detoxinista: WP_POSTS_LISTING_DISCOVERY,
  diethood: WP_POSTS_LISTING_DISCOVERY,
  dineanddish: WP_POSTS_LISTING_DISCOVERY,
  dinneratthezoo: WP_POSTS_LISTING_DISCOVERY,
  dinnersdishesanddesserts: WP_POSTS_LISTING_DISCOVERY,
  dishesdelish: WP_POSTS_LISTING_DISCOVERY,
  dizzybusyandhungry: WP_POSTS_LISTING_DISCOVERY,
  dobbyssignature: WP_POSTS_LISTING_DISCOVERY,
  domesticateme: WP_POSTS_LISTING_DISCOVERY,
  domesticgothess: WP_POSTS_LISTING_DISCOVERY,
  domesticsuperhero: WP_POSTS_LISTING_DISCOVERY,
  dontgobaconmyheart: WP_POSTS_LISTING_DISCOVERY,
  dontsweattherecipe: WP_POSTS_LISTING_DISCOVERY,
  downredbuddrive: WP_POSTS_LISTING_DISCOVERY,
  downshiftology: WP_POSTS_LISTING_DISCOVERY,
  drizzleanddip: WP_POSTS_LISTING_DISCOVERY,
  easyanddelish: WP_POSTS_LISTING_DISCOVERY,
  easycheesyvegetarian: WP_POSTS_LISTING_DISCOVERY,
  easypeasyfoodie: WP_POSTS_LISTING_DISCOVERY,
  easyrecipedepot: WP_POSTS_LISTING_DISCOVERY,
  easysavory: WP_POSTS_LISTING_DISCOVERY,
  eatingbirdfood: WP_POSTS_LISTING_DISCOVERY,
  eatingeuropean: WP_POSTS_LISTING_DISCOVERY,
  eatingrules: WP_POSTS_LISTING_DISCOVERY,
  eatthegains: WP_POSTS_LISTING_DISCOVERY,
  eatwithclarity: WP_POSTS_LISTING_DISCOVERY,
  eatwithohashi: WP_POSTS_LISTING_DISCOVERY,
  eatyourselfskinny: WP_POSTS_LISTING_DISCOVERY,
  effortlessfoodie: WP_POSTS_LISTING_DISCOVERY,
  egglesscooking: WP_POSTS_LISTING_DISCOVERY,
  elanaspantry: WP_POSTS_LISTING_DISCOVERY,
  elavegan: WP_POSTS_LISTING_DISCOVERY,
  elephantasticvegan: WP_POSTS_LISTING_DISCOVERY,
  elizabethskitchendiary: WP_POSTS_LISTING_DISCOVERY,
  emilybites: WP_POSTS_LISTING_DISCOVERY,
  emilyenchanted: WP_POSTS_LISTING_DISCOVERY,
  entertainingwithbeth: WP_POSTS_LISTING_DISCOVERY,
  errenskitchen: WP_POSTS_LISTING_DISCOVERY,
  evergreenkitchen: WP_POSTS_LISTING_DISCOVERY,
  everydaymaven: WP_POSTS_LISTING_DISCOVERY,
  everylastbite: WP_POSTS_LISTING_DISCOVERY,
  evolvingtable: WP_POSTS_LISTING_DISCOVERY,
  fabfood4all: WP_POSTS_LISTING_DISCOVERY,
  fabulesslyfrugal: WP_POSTS_LISTING_DISCOVERY,
  familyfreshmeals: WP_POSTS_LISTING_DISCOVERY,
  familystylefood: WP_POSTS_LISTING_DISCOVERY,
  farmgirlgourmet: WP_POSTS_LISTING_DISCOVERY,
  fatgirlskinny: WP_POSTS_LISTING_DISCOVERY,
  fearlessdining: WP_POSTS_LISTING_DISCOVERY,
  feastandfarm: WP_POSTS_LISTING_DISCOVERY,
  fedandfit: WP_POSTS_LISTING_DISCOVERY,
  feelgoodfoodie: WP_POSTS_LISTING_DISCOVERY,
  feistytapas: WP_POSTS_LISTING_DISCOVERY,
  firstdayofhome: WP_POSTS_LISTING_DISCOVERY,
  fitfoodiefinds: WP_POSTS_LISTING_DISCOVERY,
  fivehearthome: WP_POSTS_LISTING_DISCOVERY,
  flavcity: WP_POSTS_LISTING_DISCOVERY,
  flavourandsavour: WP_POSTS_LISTING_DISCOVERY,
  flawlessfood: WP_POSTS_LISTING_DISCOVERY,
  flouronmyface: WP_POSTS_LISTING_DISCOVERY,
  floursandfrostings: WP_POSTS_LISTING_DISCOVERY,
  foodbanjo: WP_POSTS_LISTING_DISCOVERY,
  foodfaithfitness: WP_POSTS_LISTING_DISCOVERY,
  foodieandwine: WP_POSTS_LISTING_DISCOVERY,
  foodiewithfamily: WP_POSTS_LISTING_DISCOVERY,
  foodmeanderings: WP_POSTS_LISTING_DISCOVERY,
  foodnourish: WP_POSTS_LISTING_DISCOVERY,
  foodwithfeeling: WP_POSTS_LISTING_DISCOVERY,
  foolproofliving: WP_POSTS_LISTING_DISCOVERY,
  forkandtwist: WP_POSTS_LISTING_DISCOVERY,
  fortheloveofcooking: WP_POSTS_LISTING_DISCOVERY,
  foxandbriar: WP_POSTS_LISTING_DISCOVERY,
  freshsavory: WP_POSTS_LISTING_DISCOVERY,
  fromachefskitchen: WP_POSTS_LISTING_DISCOVERY,
  frommybowl: WP_POSTS_LISTING_DISCOVERY,
  fromscratchfast: WP_POSTS_LISTING_DISCOVERY,
  fromvalerieskitchen: WP_POSTS_LISTING_DISCOVERY,
  fullofplants: WP_POSTS_LISTING_DISCOVERY,
  funfoodfrolic: WP_POSTS_LISTING_DISCOVERY,
  garnishandglaze: WP_POSTS_LISTING_DISCOVERY,
  gatheringdreams: WP_POSTS_LISTING_DISCOVERY,
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
  /**
   * The site moved its recipes under five category routes and turned
   * /opskrifter/ into a hub that lists those categories rather than any
   * recipes, which is where the legacy spider still starts and why it emits
   * nothing. The categories are the current authoritative route.
   */
  madrejsen: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "failed",
    latestCanary: "2026-08-20T13-57-00.000Z",
    shadowParity:
      "legacy-unhealthy; 149 stable records over two uncapped runs against the five current category routes",
    deferOrBlockReason:
      "The legacy spider cannot produce a comparison for this source: its only start URL, /opskrifter/, now answers 200 with a category hub carrying no recipe links at all, and the full legacy run emitted nothing. Parity rests on the documented legacy-unhealthy route instead - two uncapped runs over the five current category routes emitted identical 149-record keys and normalized content with complete discovery, idempotent upserts, and no failed, blocked, rejected, storage or domain record, and a manual read of 25 stored records found every one complete. The source sits behind the simply.com browser check, which the rendered path now waits out rather than recording as a block",
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
    migrationState: "shadow_passed",
    latestScrapyOutcome: "failed",
    latestCanary: "2026-08-20T06-29-23.252Z-attempt-823b9c33-a088-4f54-bab8-320e4fb91af5",
    shadowParity:
      "legacy-unhealthy; 246 stable records over two uncapped runs, and every recipe the legacy run did emit matches on every material field",
    deferOrBlockReason:
      "The legacy spider cannot produce a sound comparison for this source: the domain now redirects to athomebyheather.com, which the legacy spider's allowed_domains does not list, so every response is filtered off-domain and it emits nothing. Parity therefore rests on the documented legacy-unhealthy route instead — discovery reached the site's whole post catalogue, two uncapped runs emitted identical 246-record keys and normalized content with idempotent upserts, and a manual read of 25 stored records found every one complete. Legacy's output is a strict subset of Crawlee's and every overlapping record matches on every material field",
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
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T01-51-32.159Z-attempt-bf8dd063-7eee-4129-ae25-f12daedf63de",
    shadowParity:
      "290/290 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 290-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 290 recipes with every material field matching; 290 records keep a cuisine legacy has no field for",
  },
  breadtopia: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T01-47-17.589Z-attempt-4da2795a-7294-42af-b4f9-39187059a32d",
    shadowParity:
      "353/353 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 353-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 353 recipes with every material field matching; 9 records keep a cuisine legacy has no field for and 87 keep a yield legacy reduces to its first integer",
  },
  thecastawaykitchen: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-20T01-44-10.244Z-attempt-d2a2eae9-a45d-4adf-804a-96cbd8f8d315",
    deferOrBlockReason:
      "Uncapped run persisted 367 recipes from 452 posts with complete discovery and no blocked, failed or rejected record",
  },
  butternutbakeryblog: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "failed",
    latestCanary: "2026-08-20T02-02-14.600Z-attempt-794c2d48-c249-4c0f-ade0-5075636c9577",
    shadowParity:
      "legacy-unhealthy; 369 stable records over two uncapped runs, and every recipe the legacy run did emit matches on every material field",
    deferOrBlockReason:
      "The legacy spider cannot produce a sound comparison for this source: 188 of the site's detail requests answered HTTP 403 to the legacy spider on a comparable source, which it records as pages without a recipe. Parity therefore rests on the documented legacy-unhealthy route instead — discovery reached all 388 posts the site's API reports, two uncapped runs emitted identical 369-record keys and normalized content with idempotent upserts, and a manual read of 25 stored records found every one complete. Legacy's output is a strict subset of Crawlee's and every overlapping record matches on every material field",
  },
  tasteandsee: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "failed",
    latestCanary: "2026-08-20T02-08-33.437Z-attempt-f3ef8a1f-368d-4dc8-803e-a21e80c81133",
    shadowParity:
      "legacy-unhealthy; 411 stable records over two uncapped runs, and every recipe the legacy run did emit matches on every material field",
    deferOrBlockReason:
      "The legacy spider cannot produce a sound comparison for this source: the legacy run emitted 222 of the site's recipes because the site answered a large share of its detail requests with HTTP 403, which it records as pages without a recipe. Parity therefore rests on the documented legacy-unhealthy route instead — discovery reached all 458 posts the site's API reports, two uncapped runs emitted identical 411-record keys and normalized content with idempotent upserts, and a manual read of 25 stored records found every one complete. Legacy's output is a strict subset of Crawlee's and every overlapping record matches on every material field",
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
  "40aprons": {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-20-43.684Z-attempt-5d3cb7aa-7db9-4118-a6b0-ed5de5d602e6",
    deferOrBlockReason:
      "Uncapped run persisted 1545 recipes from 1550 API records; 5 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  acedarspoon: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-20-51.783Z-attempt-94459148-b829-48c2-87d1-1c41fb443401",
    deferOrBlockReason:
      "Uncapped run persisted 1023 recipes from 1028 API records; 5 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  acozykitchen: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-20-59.916Z-attempt-91b4596e-b82c-43d2-b2f7-f26643aca92e",
    deferOrBlockReason:
      "Uncapped run persisted 711 recipes from 714 API records; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  addapinch: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-21-35.062Z-attempt-ad9ed500-b1e0-4c80-9851-4ef9f0765e9b",
    deferOrBlockReason:
      "Uncapped run persisted 1303 recipes from 1304 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  addictedtodates: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-21-25.125Z-attempt-43711552-bdb7-4616-8955-70cb6e40701c",
    deferOrBlockReason:
      "Uncapped run persisted 448 recipes from 448 API records with complete discovery and no blocked, failed or rejected record",
  },
  africanbites: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-21-26.838Z-attempt-56d78ee3-9c33-4856-a770-472670dda861",
    deferOrBlockReason:
      "Uncapped run persisted 1497 recipes from 1498 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  afullliving: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-22-14.073Z-attempt-ed876368-6acd-4e3f-b6ca-2549b05617f0",
    deferOrBlockReason:
      "Uncapped run persisted 507 recipes from 507 API records with complete discovery and no blocked, failed or rejected record",
  },
  agirldefloured: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-58-41.687Z-attempt-9e165b92-fa90-4c38-b85a-a8b2b621d10a",
    deferOrBlockReason:
      "Uncapped run persisted 260 recipes from 260 API records with complete discovery and no blocked, failed or rejected record",
  },
  ahintofrosemary: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-22-24.144Z-attempt-a2470017-f9cf-4ec4-b44e-d8144b873c46",
    deferOrBlockReason:
      "Uncapped run persisted 410 recipes from 410 API records with complete discovery and no blocked, failed or rejected record",
  },
  aimadeitforyou: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-22-37.164Z-attempt-a727d347-fa3b-4b7b-bcf4-c4dbc4051233",
    deferOrBlockReason:
      "Uncapped run persisted 195 recipes from 195 API records with complete discovery and no blocked, failed or rejected record",
  },
  airfryeryum: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-21-53.705Z-attempt-d9a9f4e2-fb42-4863-9c56-f71cfe623cfd",
    deferOrBlockReason:
      "Uncapped run persisted 221 recipes from 221 API records with complete discovery and no blocked, failed or rejected record",
  },
  alattefood: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-22-47.857Z-attempt-123802b6-b719-4e30-8f24-e699417ee184",
    deferOrBlockReason:
      "Uncapped run persisted 647 recipes from 647 API records with complete discovery and no blocked, failed or rejected record",
  },
  alittlebitofspice: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-22-47.486Z-attempt-140c89e3-ad10-4ec9-877f-84f3c657722a",
    deferOrBlockReason:
      "Uncapped run persisted 165 recipes from 167 API records; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  alldayidreamaboutfood: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-22-06.980Z-attempt-f05cb952-1b99-46cc-bcc0-1eea4d4db7b6",
    deferOrBlockReason:
      "Uncapped run persisted 1151 recipes from 1152 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  allshecooks: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-23-16.943Z-attempt-19b73b68-e458-4d91-b0f9-aebbc999d2c2",
    deferOrBlockReason:
      "Uncapped run persisted 865 recipes from 891 API records; 26 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  alphafoodie: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-23-00.647Z-attempt-dc395e3e-e1c7-4abd-a0d7-01670871e7bf",
    deferOrBlockReason:
      "Uncapped run persisted 1207 recipes from 1214 API records; 7 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  altonbrown: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-22-40.870Z-attempt-8f4e5394-50cc-410b-9ec4-7b4887d65437",
    deferOrBlockReason:
      "Uncapped run persisted 947 recipes from 947 API records with complete discovery and no blocked, failed or rejected record",
  },
  alwaysusebutter: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-23-44.368Z-attempt-fc3e7463-fb93-4525-a852-439fe97ac2ef",
    deferOrBlockReason:
      "Uncapped run persisted 379 recipes from 379 API records with complete discovery and no blocked, failed or rejected record",
  },
  amandascookin: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-23-36.140Z-attempt-a82d00d0-5e2b-47c4-a5c0-86ecc55dea5c",
    deferOrBlockReason:
      "Uncapped run persisted 1978 recipes from 1978 API records with complete discovery and no blocked, failed or rejected record",
  },
  amiraspantry: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-23-14.077Z-attempt-dc26c309-2a6b-481b-a0f6-4553595c5e36",
    deferOrBlockReason:
      "Uncapped run persisted 816 recipes from 816 API records with complete discovery and no blocked, failed or rejected record",
  },
  amuseyourbouche: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T11-02-19.546Z-attempt-e50f6910-8a2e-4470-9f4b-33cd5be4b2d6",
    deferOrBlockReason:
      "Uncapped run persisted 584 recipes from 584 API records with complete discovery and no blocked, failed or rejected record",
  },
  amyinthekitchen: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-24-27.939Z-attempt-d9eec8e4-ca95-40b8-bdcc-1f8de5c00f71",
    deferOrBlockReason:
      "Uncapped run persisted 71 recipes from 72 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  amyshealthybaking: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-23-47.138Z-attempt-f78ec68b-6671-45da-97c6-c8e298c1d96c",
    deferOrBlockReason:
      "Uncapped run persisted 371 recipes from 371 API records with complete discovery and no blocked, failed or rejected record",
  },
  anaffairfromtheheart: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-24-09.492Z-attempt-46e42710-601d-489f-ac5c-49f184bcc98c",
    deferOrBlockReason:
      "Uncapped run persisted 1180 recipes from 1205 API records; 25 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  andiemitchell: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-24-36.178Z-attempt-be3a339b-f364-4f41-934d-cda7a3820e06",
    deferOrBlockReason:
      "Uncapped run persisted 349 recipes from 350 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  anitalianinmykitchen: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-24-03.821Z-attempt-51f71364-564b-4fd6-8d3b-fd25027516a6",
    deferOrBlockReason:
      "Uncapped run persisted 1260 recipes from 1261 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  anoregoncottage: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-24-49.157Z-attempt-1d6648f5-9b3b-4126-9ca0-1062535fa31c",
    deferOrBlockReason:
      "Uncapped run persisted 500 recipes from 501 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  apeachyplate: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-24-50.340Z-attempt-e53bf3fa-3bd8-403b-a87a-141cdf79d04e",
    deferOrBlockReason:
      "Uncapped run persisted 157 recipes from 157 API records with complete discovery and no blocked, failed or rejected record",
  },
  aprettylifeinthesuburbs: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-24-39.309Z-attempt-c1dd23f3-a8d9-491f-bb4a-3e77df07665c",
    deferOrBlockReason:
      "Uncapped run persisted 2284 recipes from 2297 API records; 13 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  artofnaturalliving: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-25-10.378Z-attempt-e44e942d-be56-430d-8360-cdfeaf30a2e1",
    deferOrBlockReason:
      "Uncapped run persisted 808 recipes from 809 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  aseasyasapplepie: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-28-17.791Z-attempt-538f67ad-9583-4622-8d21-6e9712feb27d",
    deferOrBlockReason:
      "Uncapped run persisted 156 recipes from 156 API records with complete discovery and no blocked, failed or rejected record",
  },
  asimplepalate: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-28-23.650Z-attempt-17bfa713-5089-414b-af38-b7746d362026",
    deferOrBlockReason:
      "Uncapped run persisted 257 recipes from 257 API records with complete discovery and no blocked, failed or rejected record",
  },
  askchefdennis: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-28-29.574Z-attempt-68153808-c7f8-4457-98d8-22c707f63c5f",
    deferOrBlockReason:
      "Uncapped run persisted 1228 recipes from 1237 API records; 9 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  aspicyperspective: {
    migrationState: "blocked",
    latestCanary: "2026-08-21T10-28-28.655Z-attempt-543c5741-a12c-4306-a7a1-8137991fee71",
    deferOrBlockReason:
      "Uncapped run persisted no recipes: 1 requests were blocked, so discovery could not complete",
  },
  athomewithshay: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-28-36.663Z-attempt-daf37c97-f7f1-4a1f-9501-9452e33a8212",
    deferOrBlockReason:
      "Uncapped run persisted 326 recipes from 327 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  averiecooks: {
    migrationState: "blocked",
    latestCanary: "2026-08-21T10-29-07.165Z-attempt-9f3b9dc8-fe3e-4cd7-a78a-c2abc7510503",
    deferOrBlockReason:
      "Uncapped run persisted no recipes: 1 requests were blocked, so discovery could not complete",
  },
  bakedambrosia: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-28-34.096Z-attempt-f5d1557c-d7b0-4686-bf88-e660de2ac778",
    deferOrBlockReason:
      "Uncapped run persisted 313 recipes from 315 API records; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  bakedbyrachel: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-28-52.043Z-attempt-a22b5fee-a894-450a-b747-2a27e1b5861c",
    deferOrBlockReason:
      "Uncapped run persisted 830 recipes from 830 API records with complete discovery and no blocked, failed or rejected record",
  },
  bakefromscratch: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-29-12.815Z-attempt-f71f740c-f356-4b02-b116-4385c8f65623",
    deferOrBlockReason:
      "Uncapped run persisted 1585 recipes from 1587 API records; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  bakeitwithlove: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-28-49.413Z-attempt-b384f84f-d316-4461-ba5b-ef35b019579a",
    deferOrBlockReason:
      "Uncapped run persisted 2951 recipes from 2951 API records with complete discovery and no blocked, failed or rejected record",
  },
  bakeorbreak: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-30-15.414Z-attempt-c10672a9-951f-4ecc-a21e-fedc0effb542",
    deferOrBlockReason:
      "Uncapped run persisted 936 recipes from 950 API records; 14 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  bakeplate: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-30-09.780Z-attempt-645a8a33-b44e-4c57-9fb7-543041cc3630",
    deferOrBlockReason:
      "Uncapped run persisted 178 recipes from 178 API records with complete discovery and no blocked, failed or rejected record",
  },
  bakeplaysmile: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-30-07.653Z-attempt-f19bf97a-72d2-40b3-9d43-ef4517c098ac",
    deferOrBlockReason:
      "Uncapped run persisted 735 recipes from 737 API records; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  bakerbynature: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-31-03.656Z-attempt-2735d880-70f2-48dc-bb9e-c3ecc9d02a5e",
    deferOrBlockReason:
      "Uncapped run persisted 1045 recipes from 1050 API records; 5 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  bakerita: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-30-23.696Z-attempt-c403b240-8af0-4200-a63f-b8abddf02784",
    deferOrBlockReason:
      "Uncapped run persisted 1574 recipes from 1577 API records; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  bakesbybrownsugar: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-30-34.152Z-attempt-334c3502-ab6d-41cf-97f9-e42333143dd2",
    deferOrBlockReason:
      "Uncapped run persisted 306 recipes from 306 API records with complete discovery and no blocked, failed or rejected record",
  },
  bakingamoment: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-31-34.963Z-attempt-cb0dc935-75b1-4fff-8aa1-b7355f9e90ea",
    deferOrBlockReason:
      "Uncapped run persisted 0 recipes from 1 API records; 1 record the source publishes incomplete or malformed and discovery that did not complete keeps it short of a canary",
  },
  bakingbeauty: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-31-04.514Z-attempt-ca2a7c8e-87f8-4297-a605-6b57881ee17a",
    deferOrBlockReason:
      "Uncapped run persisted 627 recipes from 628 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  bakingginger: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-30-57.810Z-attempt-9eaa49d5-a533-47d3-bea6-7f044e794199",
    deferOrBlockReason:
      "Uncapped run persisted 214 recipes from 217 API records; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  bakingmischief: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-31-46.332Z-attempt-56db9635-b6b0-4b7c-a20b-310b92725af4",
    deferOrBlockReason:
      "Uncapped run persisted 422 recipes from 422 API records with complete discovery and no blocked, failed or rejected record",
  },
  barefeetinthekitchen: {
    migrationState: "blocked",
    latestCanary: "2026-08-21T10-31-27.219Z-attempt-aac264cf-d8b6-436a-b759-f026d765406a",
    deferOrBlockReason:
      "Uncapped run persisted no recipes: 1 requests were blocked, so discovery could not complete",
  },
  barleyandsage: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-31-10.527Z-attempt-f73f4998-05f4-4b46-a70e-35244cc98071",
    deferOrBlockReason:
      "Uncapped run persisted 592 recipes from 594 API records; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  beamingbaker: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-32-09.360Z-attempt-d2a73ea5-ec97-4054-9823-0770d1e6755c",
    deferOrBlockReason:
      "Uncapped run persisted 853 recipes from 856 API records; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  bellyfull: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-31-32.708Z-attempt-4e880752-7320-41cd-b8df-38ae2b6d28fa",
    deferOrBlockReason:
      "Uncapped run persisted 1940 recipes from 1941 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  berlyskitchen: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-31-31.538Z-attempt-73378f4c-6239-4af1-a3e6-38735a01e178",
    deferOrBlockReason:
      "Uncapped run persisted 1518 recipes from 1518 API records with complete discovery and no blocked, failed or rejected record",
  },
  berrymaple: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-32-49.933Z-attempt-d51f6eac-2a0e-4188-83dc-b7638552dcaf",
    deferOrBlockReason:
      "Uncapped run persisted 265 recipes from 265 API records with complete discovery and no blocked, failed or rejected record",
  },
  bessiebakes: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-32-25.560Z-attempt-cbdf419a-4bd5-4b7d-9242-5d3c2c141f9f",
    deferOrBlockReason:
      "Uncapped run persisted 112 recipes from 112 API records with complete discovery and no blocked, failed or rejected record",
  },
  bestrecipebox: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-32-39.093Z-attempt-1a9fa944-0167-450a-a988-abd906d1f4e5",
    deferOrBlockReason:
      "Uncapped run persisted 529 recipes from 529 API records with complete discovery and no blocked, failed or rejected record",
  },
  beyondkimchee: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-33-04.893Z-attempt-b50a23bc-361e-4885-8a9d-440e8c876e76",
    deferOrBlockReason:
      "Uncapped run persisted 525 recipes from 525 API records with complete discovery and no blocked, failed or rejected record",
  },
  biancazapatka: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-32-40.497Z-attempt-27a4ff51-c9b1-4847-a9a8-c9a46f099cb1",
    deferOrBlockReason:
      "Uncapped run persisted 1527 recipes from 1527 API records with complete discovery and no blocked, failed or rejected record",
  },
  biggerbolderbaking: {
    migrationState: "blocked",
    latestCanary: "2026-08-21T10-33-04.790Z-attempt-2e66bd3a-929d-4e30-a056-07406fc20f55",
    deferOrBlockReason:
      "Uncapped run persisted no recipes: 1 requests were blocked, so discovery could not complete",
  },
  bigrecipe: {
    migrationState: "blocked",
    latestCanary: "2026-08-21T10-33-26.268Z-attempt-657bab85-9156-4746-958b-c0c12ce1848d",
    deferOrBlockReason:
      "Uncapped run persisted no recipes: 1 requests were blocked, so discovery could not complete",
  },
  biscuitsandburlap: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-33-48.895Z-attempt-31c3d2eb-baa6-4695-8793-db720265b593",
    deferOrBlockReason:
      "Uncapped run persisted 377 recipes from 379 API records; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  biteswithbri: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-33-10.683Z-attempt-d3a270e2-81a5-48d6-bae1-83117f40bd7e",
    deferOrBlockReason:
      "Uncapped run persisted 441 recipes from 442 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  blackberrybabe: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-33-32.442Z-attempt-d133b537-c519-4420-97a5-98ab7754428b",
    deferOrBlockReason:
      "Uncapped run persisted 590 recipes from 601 API records; 11 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  blackpeoplesrecipes: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-34-04.870Z-attempt-87c342ec-88f1-4736-8734-ff5572733eab",
    deferOrBlockReason:
      "Uncapped run persisted 342 recipes from 342 API records with complete discovery and no blocked, failed or rejected record",
  },
  blendwithspices: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-33-32.108Z-attempt-29266fa6-09b5-47ad-a436-ebe530a113d6",
    deferOrBlockReason:
      "Uncapped run persisted 507 recipes from 507 API records with complete discovery and no blocked, failed or rejected record",
  },
  bluebowlrecipes: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-33-55.078Z-attempt-984c6a9a-3fc1-4eae-8e50-67b7bec18fb7",
    deferOrBlockReason:
      "Uncapped run persisted 533 recipes from 533 API records with complete discovery and no blocked, failed or rejected record",
  },
  boulderlocavore: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-34-23.900Z-attempt-500699a8-3416-4ed2-955b-cb5000f8a6ab",
    deferOrBlockReason:
      "Uncapped run persisted 1392 recipes from 1395 API records; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  bowlofdelicious: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-33-51.700Z-attempt-dcc62d7d-d8f0-4611-908f-52528c21389c",
    deferOrBlockReason:
      "Uncapped run persisted 619 recipes from 620 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  breadboozebacon: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-34-18.034Z-attempt-3d95de3d-8b4d-49a2-87c3-f836f39f97e7",
    deferOrBlockReason:
      "Uncapped run persisted 672 recipes from 673 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  brighteyedbaker: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-35-05.718Z-attempt-dd809143-a7d9-4568-8efa-eb20aeaa9ed1",
    deferOrBlockReason:
      "Uncapped run persisted 51 recipes from 51 API records with complete discovery and no blocked, failed or rejected record",
  },
  browneyedbaker: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-34-15.552Z-attempt-b66dee5d-8104-4658-a48a-8195fd7222ac",
    deferOrBlockReason:
      "Uncapped run persisted 1203 recipes from 1204 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  budgetbytes: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-34-41.787Z-attempt-813d6843-528b-4acf-96ec-6b597863ff44",
    deferOrBlockReason:
      "Uncapped run persisted 1864 recipes from 1864 API records with complete discovery and no blocked, failed or rejected record",
  },
  buildyourbite: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-35-13.810Z-attempt-8cae2fa3-adf3-4cfd-892e-82f4bf0ca362",
    deferOrBlockReason:
      "Uncapped run persisted 502 recipes from 527 API records; 25 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  bunnyswarmoven: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-34-52.226Z-attempt-7c532bb6-6676-4751-8e8f-17c26e678ff8",
    deferOrBlockReason:
      "Uncapped run persisted 490 recipes from 496 API records; 6 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  butterandbaggage: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-35-47.849Z-attempt-b5edef58-d437-4e04-b299-1460d8884e2e",
    deferOrBlockReason:
      "Uncapped run persisted 749 recipes from 759 API records; 10 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  butterandbliss: {
    migrationState: "blocked",
    latestCanary: "2026-08-21T10-35-42.283Z-attempt-3c3c99bb-6894-4556-ad53-e6db0986cb0d",
    deferOrBlockReason:
      "Uncapped run persisted no recipes: 1 requests were blocked, so discovery could not complete",
  },
  butteryourbiscuit: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-35-11.915Z-attempt-7844cf75-f674-4d81-b5e6-e324c8893aef",
    deferOrBlockReason:
      "Uncapped run persisted 998 recipes from 1003 API records; 5 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  cafedelites: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-36-16.033Z-attempt-7cd5c891-6f4e-4384-80b6-2ae5453f69d7",
    deferOrBlockReason:
      "Uncapped run persisted 655 recipes from 659 API records; 4 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  cakebycourtney: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-35-48.848Z-attempt-661c6647-f268-48d9-a6ba-8a553db8c7fa",
    deferOrBlockReason:
      "Uncapped run persisted 452 recipes from 452 API records with complete discovery and no blocked, failed or rejected record",
  },
  cakenknife: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-35-53.717Z-attempt-1c6cd831-ec4e-44d8-80a1-21933082f7ad",
    deferOrBlockReason:
      "Uncapped run persisted 1328 recipes from 1393 API records; 65 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  cakewhiz: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-36-43.687Z-attempt-ae87b813-d071-413c-9e71-eec156650cf4",
    deferOrBlockReason:
      "Uncapped run persisted 765 recipes from 765 API records with complete discovery and no blocked, failed or rejected record",
  },
  callmepmc: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-36-22.647Z-attempt-e044448d-6840-42cc-a727-36fb5189c7ad",
    deferOrBlockReason:
      "Uncapped run persisted 2035 recipes from 2035 API records with complete discovery and no blocked, failed or rejected record",
  },
  caramelandcashews: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-36-33.498Z-attempt-f87f7a2c-63b2-4b2c-bc68-13ae829e5560",
    deferOrBlockReason:
      "Uncapped run persisted 389 recipes from 390 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  caribbeangreenliving: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-37-15.866Z-attempt-71d19532-d6e7-4212-9227-297ec8ff361e",
    deferOrBlockReason:
      "Uncapped run persisted 807 recipes from 814 API records; 7 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  caribbeanpot: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-37-49.226Z-attempt-e2173e8f-3765-491f-a85f-3e6269140422",
    deferOrBlockReason:
      "Uncapped run persisted 255 recipes from 261 API records; 6 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  carlsbadcravings: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-36-48.091Z-attempt-b7bc3659-16ef-40b1-91c5-913b0cdeca97",
    deferOrBlockReason:
      "Uncapped run persisted 1474 recipes from 1478 API records; 4 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  casuallypeckish: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-37-58.613Z-attempt-3fe2e2e8-27c8-4f69-b460-cdadd23fcaa9",
    deferOrBlockReason:
      "Uncapped run persisted 126 recipes from 126 API records with complete discovery and no blocked, failed or rejected record",
  },
  centercutcook: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-38-02.808Z-attempt-7cb78e3d-e5da-49ce-a73b-2e66672e88c7",
    deferOrBlockReason:
      "Uncapped run persisted 424 recipes from 424 API records with complete discovery and no blocked, failed or rejected record",
  },
  cheerfulcook: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-37-50.089Z-attempt-01445280-806d-49f4-be82-5d4f27d6337e",
    deferOrBlockReason:
      "Uncapped run persisted 606 recipes from 606 API records with complete discovery and no blocked, failed or rejected record",
  },
  chefjeanpierre: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-38-12.181Z-attempt-3a1198f6-b8a2-451c-ba0e-4401a1e7b1ba",
    deferOrBlockReason:
      "Uncapped run persisted 516 recipes from 522 API records; 6 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  cheflindseyfarr: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-38-20.222Z-attempt-22ee28d9-444d-4b81-a68b-255578359c56",
    deferOrBlockReason:
      "Uncapped run persisted 686 recipes from 691 API records; 5 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  cheflolaskitchen: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-38-22.761Z-attempt-f49b4e04-7efe-46b2-88c3-d3d361c3a307",
    deferOrBlockReason:
      "Uncapped run persisted 543 recipes from 557 API records; 14 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  chefnotrequired: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-38-40.547Z-attempt-28e4f715-621c-4398-962c-bb918ec2d360",
    deferOrBlockReason:
      "Uncapped run persisted 420 recipes from 420 API records with complete discovery and no blocked, failed or rejected record",
  },
  chelseasmessyapron: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-38-45.294Z-attempt-b2754a50-5ad8-4588-9bb3-d050caf86bb7",
    deferOrBlockReason:
      "Uncapped run persisted 1797 recipes from 1797 API records with complete discovery and no blocked, failed or rejected record",
  },
  cheneetoday: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-38-44.068Z-attempt-42a50a87-ef24-412a-9ea3-b2ce258c76b3",
    deferOrBlockReason:
      "Uncapped run persisted 288 recipes from 289 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  chewoutloud: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-39-00.755Z-attempt-dcde88e2-f9c3-44eb-8fd9-665fe3b8dedb",
    deferOrBlockReason:
      "Uncapped run persisted 858 recipes from 903 API records; 45 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  chicagojogger: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-39-51.183Z-attempt-e316bee3-054c-48c4-8138-7c553c5c53dd",
    deferOrBlockReason:
      "Uncapped run persisted 103 recipes from 103 API records with complete discovery and no blocked, failed or rejected record",
  },
  chocolatecoveredkatie: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-39-00.530Z-attempt-975d0ebc-05e4-4974-b5b8-a5205bcd98c1",
    deferOrBlockReason:
      "Uncapped run persisted 720 recipes from 727 API records; 7 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  ciaoflorentina: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-39-39.692Z-attempt-014935e0-7436-4675-b711-c27adc7ea01f",
    deferOrBlockReason:
      "Uncapped run persisted 479 recipes from 479 API records with complete discovery and no blocked, failed or rejected record",
  },
  cinnamonandcoriander: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-40-02.784Z-attempt-3761e708-5462-448b-a0df-bea737d7243c",
    deferOrBlockReason:
      "Uncapped run persisted 783 recipes from 783 API records with complete discovery and no blocked, failed or rejected record",
  },
  cleanfoodcrush: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-39-26.296Z-attempt-4af53e19-43ea-4465-afdc-4e2b19e09ef2",
    deferOrBlockReason:
      "Uncapped run persisted 2167 recipes from 2177 API records; 10 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  coleycooks: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-40-06.170Z-attempt-5649abc1-f3c9-4b2c-8e17-7f5861677592",
    deferOrBlockReason:
      "Uncapped run persisted 535 recipes from 536 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  completelydelicious: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-40-27.821Z-attempt-78056d8c-1de3-4d1d-8b50-4bea9b73dd59",
    deferOrBlockReason:
      "Uncapped run persisted 829 recipes from 830 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  connoisseurusveg: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-40-59.547Z-attempt-56d62e2a-a8f5-4e9a-8619-f35bbc383e21",
    deferOrBlockReason:
      "Uncapped run persisted 1272 recipes from 1272 API records with complete discovery and no blocked, failed or rejected record",
  },
  cookathomemom: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-40-26.387Z-attempt-1fa29682-1c79-43e7-997d-72bdcbae815c",
    deferOrBlockReason:
      "Uncapped run persisted 373 recipes from 374 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  cookcookgo: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-40-54.775Z-attempt-c10c0094-e773-4c97-b866-59741e02f92e",
    deferOrBlockReason:
      "Uncapped run persisted 137 recipes from 137 API records with complete discovery and no blocked, failed or rejected record",
  },
  cookiemadness: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-41-53.279Z-attempt-42269a30-bd4a-4130-88bd-caba872367c6",
    deferOrBlockReason:
      "Uncapped run persisted 2879 recipes from 2880 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  cookincanuck: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-40-47.999Z-attempt-213eb5bf-0453-4004-a86b-1f8c8fde3924",
    deferOrBlockReason:
      "Uncapped run persisted 1206 recipes from 1206 API records with complete discovery and no blocked, failed or rejected record",
  },
  cookingchew: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-41-07.568Z-attempt-8bf7562e-189f-4a46-9e08-d9402b7b1181",
    deferOrBlockReason:
      "Uncapped run persisted 3329 recipes from 3385 API records; 56 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  cookingclassy: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-43-27.182Z-attempt-ae9b9928-4a81-4f0b-95c2-99ed3403e79a",
    deferOrBlockReason:
      "Uncapped run persisted 1454 recipes from 1457 API records; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  cookingforkeeps: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-41-25.472Z-attempt-682de362-c835-45fc-ad3c-ae6a22f72ee8",
    deferOrBlockReason:
      "Uncapped run persisted 517 recipes from 522 API records; 5 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  cookingformysoul: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-42-33.890Z-attempt-2084b3ef-3727-44ba-9bc9-38db3f2e06b6",
    deferOrBlockReason:
      "Uncapped run persisted 443 recipes from 443 API records with complete discovery and no blocked, failed or rejected record",
  },
  cookingfromheart: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-44-09.838Z-attempt-f3f49773-f8b1-41a9-9bcc-9ebd437b71bd",
    deferOrBlockReason:
      "Uncapped run persisted 707 recipes from 708 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  cookinglsl: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-41-53.863Z-attempt-fa3d8e63-f8d9-410e-b57e-345dac5bc305",
    deferOrBlockReason:
      "Uncapped run persisted 1135 recipes from 1150 API records; 15 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  cookjunkie: {
    migrationState: "blocked",
    latestCanary: "2026-08-21T10-42-52.385Z-attempt-2015497c-5b48-46dc-a77f-5cafa27c0002",
    deferOrBlockReason:
      "Uncapped run persisted no recipes: 1 requests were blocked, so discovery could not complete",
  },
  cookrepublic: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-44-35.375Z-attempt-f75156cd-c77d-4dfc-81f6-b67dd9f669f2",
    deferOrBlockReason:
      "Uncapped run persisted 479 recipes from 481 API records; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  cookshideout: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-42-42.436Z-attempt-6ffdc699-3e31-4c37-9112-423679e92f9f",
    deferOrBlockReason:
      "Uncapped run persisted 753 recipes from 756 API records; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  cooktoria: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-42-57.918Z-attempt-2b82afbc-7aee-46aa-adc9-3f8599f86526",
    deferOrBlockReason:
      "Uncapped run persisted 481 recipes from 481 API records with complete discovery and no blocked, failed or rejected record",
  },
  cookwithkushi: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-44-52.536Z-attempt-c1355b91-69a9-4e00-9378-3bb0b404c9e0",
    deferOrBlockReason:
      "Uncapped run persisted 949 recipes from 952 API records; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  cookwithmanali: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-43-07.678Z-attempt-8ce21e2b-24f2-4117-9103-3443fb9961a0",
    deferOrBlockReason:
      "Uncapped run persisted 1078 recipes from 1078 API records with complete discovery and no blocked, failed or rejected record",
  },
  cookwithnabeela: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-43-17.358Z-attempt-e86d85ba-6124-4525-b37e-0c19d04a47cf",
    deferOrBlockReason:
      "Uncapped run persisted 698 recipes from 698 API records with complete discovery and no blocked, failed or rejected record",
  },
  copykat: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-45-28.128Z-attempt-f5d407a4-5db1-4219-9d92-92163b6b995d",
    deferOrBlockReason:
      "Uncapped run persisted 2005 recipes from 2005 API records with complete discovery and no blocked, failed or rejected record",
  },
  craftbeering: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-43-39.884Z-attempt-914d86e8-1b47-40c6-aee7-6ebe2279e8c3",
    deferOrBlockReason:
      "Uncapped run persisted 438 recipes from 443 API records; 5 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  crazyforcrust: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-43-44.826Z-attempt-69614326-2e67-46e6-93d0-d70ee537d012",
    deferOrBlockReason:
      "Uncapped run persisted 1913 recipes from 1925 API records; 12 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  createbakemake: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-47-02.058Z-attempt-8b229386-321f-4cef-b75f-8e583c65628a",
    deferOrBlockReason:
      "Uncapped run persisted 489 recipes from 490 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  crunchycreamysweet: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-43-58.123Z-attempt-495879e9-f164-4c9d-ab0d-ae8f3f2f4ad5",
    deferOrBlockReason:
      "Uncapped run persisted 1085 recipes from 1085 API records with complete discovery and no blocked, failed or rejected record",
  },
  cubesnjuliennes: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-44-35.315Z-attempt-1dcce09a-efb5-4381-a872-804f48a9329b",
    deferOrBlockReason:
      "Uncapped run persisted 358 recipes from 358 API records with complete discovery and no blocked, failed or rejected record",
  },
  cuisineandtravel: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-47-20.854Z-attempt-32f64bdc-2cf3-4c26-a885-69080e306c9b",
    deferOrBlockReason:
      "Uncapped run persisted 134 recipes from 134 API records with complete discovery and no blocked, failed or rejected record",
  },
  culinaryginger: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-44-29.143Z-attempt-e6367864-6dc9-4074-98d1-bbb34333df4f",
    deferOrBlockReason:
      "Uncapped run persisted 636 recipes from 636 API records with complete discovery and no blocked, failed or rejected record",
  },
  culinaryhill: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-44-57.306Z-attempt-37af04ec-b65b-42ba-89a3-d3819308e3cd",
    deferOrBlockReason:
      "Uncapped run persisted 1309 recipes from 1321 API records; 12 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  cupcakesandkalechips: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-47-32.329Z-attempt-1e0d4597-597d-4b50-ae19-f1d5ef3057b7",
    deferOrBlockReason:
      "Uncapped run persisted 1078 recipes from 1081 API records; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  curiouscuisiniere: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-44-51.479Z-attempt-fb104d39-beef-4192-9f54-3b3f1368bcdc",
    deferOrBlockReason:
      "Uncapped run persisted 701 recipes from 701 API records with complete discovery and no blocked, failed or rejected record",
  },
  curlygirlkitchen: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-45-36.380Z-attempt-09d16b3f-9d78-4150-9e47-0d92f9f146a6",
    deferOrBlockReason:
      "Uncapped run persisted 1065 recipes from 1065 API records with complete discovery and no blocked, failed or rejected record",
  },
  currytrail: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-48-07.726Z-attempt-90e36ddf-c4c3-47bb-b964-0a0ae90491b8",
    deferOrBlockReason:
      "Uncapped run persisted 539 recipes from 539 API records with complete discovery and no blocked, failed or rejected record",
  },
  dadwithapan: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-45-33.527Z-attempt-efc2c254-a828-446f-a3b0-ab71c43e6ff3",
    deferOrBlockReason:
      "Uncapped run persisted 499 recipes from 505 API records; 6 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  dailydishrecipes: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-46-08.027Z-attempt-528b5bc7-c9a1-456d-961d-fec9c48438b1",
    deferOrBlockReason:
      "Uncapped run persisted 914 recipes from 916 API records; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  damnspicy: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-48-31.620Z-attempt-8b971dac-406f-4944-bf98-2be76a7121bf",
    deferOrBlockReason:
      "Uncapped run persisted 270 recipes from 270 API records with complete discovery and no blocked, failed or rejected record",
  },
  dancearoundthekitchen: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-46-00.690Z-attempt-c830a324-0a5b-4242-8e77-86a0104dec9b",
    deferOrBlockReason:
      "Uncapped run persisted 535 recipes from 536 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  daringgourmet: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-46-56.213Z-attempt-37e94090-18af-4345-bb5b-d6eeda44a065",
    deferOrBlockReason:
      "Uncapped run persisted 900 recipes from 903 API records; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  davidlebovitz: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-48-46.260Z-attempt-cbd1ba03-c247-43b0-9a2c-f13063b2ea3f",
    deferOrBlockReason:
      "Uncapped run persisted 700 recipes from 707 API records; 7 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  deliciousfromscratch: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-46-22.024Z-attempt-a5bd3015-c184-48b6-8183-75b90a1ddf34",
    deferOrBlockReason:
      "Uncapped run persisted 130 recipes from 130 API records with complete discovery and no blocked, failed or rejected record",
  },
  deliciouslysprinkled: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-47-38.176Z-attempt-6f57e1b0-051e-4902-8d41-136f78bd00f4",
    deferOrBlockReason:
      "Uncapped run persisted 358 recipes from 361 API records; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  deliciousmeetshealthy: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-49-10.469Z-attempt-dfb7ccbe-5ea3-4061-8b62-8629c835c655",
    deferOrBlockReason:
      "Uncapped run persisted 488 recipes from 488 API records with complete discovery and no blocked, failed or rejected record",
  },
  delicioustable: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-46-31.772Z-attempt-5d7c4c6d-d448-4ffb-bba0-0b499756295d",
    deferOrBlockReason:
      "Uncapped run persisted 277 recipes from 277 API records with complete discovery and no blocked, failed or rejected record",
  },
  delightfuladventures: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-47-55.231Z-attempt-222eb6a9-7dce-4064-8670-31b8bb81d562",
    deferOrBlockReason:
      "Uncapped run persisted 305 recipes from 305 API records with complete discovery and no blocked, failed or rejected record",
  },
  dessertfortwo: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-49-37.004Z-attempt-08d526e3-a971-4608-8a4b-7d57e3b28170",
    deferOrBlockReason:
      "Uncapped run persisted 55 recipes from 55 API records with complete discovery and no blocked, failed or rejected record",
  },
  dessertswithbenefits: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-46-48.678Z-attempt-06272401-381f-4944-a95a-a50ddf45d6bb",
    deferOrBlockReason:
      "Uncapped run persisted 644 recipes from 645 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  detoxinista: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-48-12.940Z-attempt-56821501-14ae-46ca-93c1-7b9f713dd9c7",
    deferOrBlockReason:
      "Uncapped run persisted 946 recipes from 946 API records with complete discovery and no blocked, failed or rejected record",
  },
  diethood: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-49-44.478Z-attempt-ee787c26-dcc1-45db-b8d7-dc597829d68b",
    deferOrBlockReason:
      "Uncapped run persisted 1849 recipes from 1852 API records; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  dineanddish: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-47-12.988Z-attempt-885f4781-5e5e-40b8-ae5f-5f810012a02c",
    deferOrBlockReason:
      "Uncapped run persisted 584 recipes from 586 API records; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  dinneratthezoo: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-48-55.621Z-attempt-f661de85-bab6-4699-b6b7-477a833b1dc1",
    deferOrBlockReason:
      "Uncapped run persisted 1359 recipes from 1359 API records with complete discovery and no blocked, failed or rejected record",
  },
  dinnersdishesanddesserts: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-50-46.057Z-attempt-0d62bfed-3dd7-4e40-8cce-97eea9d42749",
    deferOrBlockReason:
      "Uncapped run persisted 2943 recipes from 3017 API records; 74 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  dishesdelish: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-47-31.989Z-attempt-343790e2-fc9f-496d-afb2-0b05464166d1",
    deferOrBlockReason:
      "Uncapped run persisted 549 recipes from 550 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  dizzybusyandhungry: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-49-32.676Z-attempt-990a6281-4aac-46f5-b372-13637349b0dc",
    deferOrBlockReason:
      "Uncapped run persisted 519 recipes from 519 API records with complete discovery and no blocked, failed or rejected record",
  },
  dobbyssignature: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-52-12.639Z-attempt-3ba27188-f676-47f7-b4d0-bc340f1ff3a4",
    deferOrBlockReason:
      "Uncapped run persisted 19 recipes from 19 API records with complete discovery and no blocked, failed or rejected record",
  },
  domesticateme: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-47-53.485Z-attempt-cde81188-5024-4f5f-967f-2bc8e7ebf7bf",
    deferOrBlockReason:
      "Uncapped run persisted 469 recipes from 469 API records with complete discovery and no blocked, failed or rejected record",
  },
  domesticgothess: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-49-52.385Z-attempt-cede1d6d-5753-49e9-9ed5-3c5cceb02bcf",
    deferOrBlockReason:
      "Uncapped run persisted 671 recipes from 671 API records with complete discovery and no blocked, failed or rejected record",
  },
  domesticsuperhero: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-52-23.364Z-attempt-fdfbd6fd-0459-49a3-9ddd-20bdac2d9255",
    deferOrBlockReason:
      "Uncapped run persisted 608 recipes from 609 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  dontgobaconmyheart: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-48-16.036Z-attempt-8ff72428-9f8a-4ff3-9ede-ad12bf1ea092",
    deferOrBlockReason:
      "Uncapped run persisted 687 recipes from 687 API records with complete discovery and no blocked, failed or rejected record",
  },
  dontsweattherecipe: {
    migrationState: "blocked",
    latestCanary: "2026-08-21T10-50-16.262Z-attempt-da5ddbad-2625-4760-adc5-d425b71ea6d2",
    deferOrBlockReason:
      "Uncapped run persisted no recipes: 1 requests were blocked, so discovery could not complete",
  },
  downredbuddrive: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-52-45.117Z-attempt-1d4cf657-d569-48f1-b62f-a1db8132d9db",
    deferOrBlockReason:
      "Uncapped run persisted 98 recipes from 100 API records; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  downshiftology: {
    migrationState: "blocked",
    latestCanary: "2026-08-21T10-48-39.590Z-attempt-2018057b-f1d3-4a4a-bfdb-0d804e39f081",
    deferOrBlockReason:
      "Uncapped run persisted no recipes: 1 requests were blocked, so discovery could not complete",
  },
  drizzleanddip: {
    migrationState: "blocked",
    latestCanary: "2026-08-21T10-50-22.005Z-attempt-11469035-00e7-4ddf-83a8-87b230bb00f3",
    deferOrBlockReason:
      "Uncapped run persisted no recipes: 1 requests were blocked, so discovery could not complete",
  },
  easyanddelish: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-52-54.262Z-attempt-a4b9a08a-09b8-4111-9b35-e6610e6e872c",
    deferOrBlockReason:
      "Uncapped run persisted 903 recipes from 904 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  easycheesyvegetarian: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-48-45.223Z-attempt-0abdf67f-4f8c-4af0-9626-1e1e9f793f4b",
    deferOrBlockReason:
      "Uncapped run persisted 584 recipes from 584 API records with complete discovery and no blocked, failed or rejected record",
  },
  easypeasyfoodie: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-50-27.722Z-attempt-091473f5-2fc3-445d-aba7-fbaa3832e686",
    deferOrBlockReason:
      "Uncapped run persisted 626 recipes from 626 API records with complete discovery and no blocked, failed or rejected record",
  },
  easyrecipedepot: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-53-25.541Z-attempt-982efc87-7d84-44aa-908f-6a3e237b1588",
    deferOrBlockReason:
      "Uncapped run persisted 219 recipes from 219 API records with complete discovery and no blocked, failed or rejected record",
  },
  easysavory: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-49-04.443Z-attempt-b0d0b5aa-a92f-4266-84d8-e04e18306c4d",
    deferOrBlockReason:
      "Uncapped run persisted 200 recipes from 200 API records; 1 failed request and discovery that did not complete keeps it short of a canary",
  },
  eatingbirdfood: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-50-51.174Z-attempt-7ba12311-e771-4938-bdd4-bbc8597b783f",
    deferOrBlockReason:
      "Uncapped run persisted 1647 recipes from 1647 API records with complete discovery and no blocked, failed or rejected record",
  },
  eatingeuropean: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-53-39.543Z-attempt-f54c502c-5ff6-411e-9ea4-fb76a3c5324d",
    deferOrBlockReason:
      "Uncapped run persisted 254 recipes from 254 API records with complete discovery and no blocked, failed or rejected record",
  },
  eatingrules: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-49-29.647Z-attempt-4f8f3c30-ab15-4eae-b543-8b0de616451c",
    deferOrBlockReason:
      "Uncapped run persisted 325 recipes from 326 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  eatthegains: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-51-36.689Z-attempt-a6af9ce9-29ec-4933-b1ea-310db5283ed2",
    deferOrBlockReason:
      "Uncapped run persisted 519 recipes from 519 API records with complete discovery and no blocked, failed or rejected record",
  },
  eatwithclarity: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-53-53.210Z-attempt-ab727b57-e0b4-425f-b348-1c299fab9066",
    deferOrBlockReason:
      "Uncapped run persisted 703 recipes from 705 API records; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  eatwithohashi: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-49-44.685Z-attempt-41ac7297-a348-4e57-8628-caa9860cc924",
    deferOrBlockReason:
      "Uncapped run persisted 13 recipes from 13 API records with complete discovery and no blocked, failed or rejected record",
  },
  eatyourselfskinny: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-51-57.539Z-attempt-2f4fa10d-10b6-4f9b-aab2-676b02cccf7a",
    deferOrBlockReason:
      "Uncapped run persisted 454 recipes from 454 API records with complete discovery and no blocked, failed or rejected record",
  },
  effortlessfoodie: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-54-17.999Z-attempt-ccad58f2-82f7-4028-9563-bd118e58c50c",
    deferOrBlockReason:
      "Uncapped run persisted 472 recipes from 472 API records with complete discovery and no blocked, failed or rejected record",
  },
  egglesscooking: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-49-53.103Z-attempt-b0db7099-0791-4050-9a9b-99320a8b2563",
    deferOrBlockReason:
      "Uncapped run persisted 455 recipes from 455 API records with complete discovery and no blocked, failed or rejected record",
  },
  elanaspantry: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-52-14.665Z-attempt-ac96e291-cff7-49a7-a158-e94d0e324abd",
    deferOrBlockReason:
      "Uncapped run persisted 640 recipes from 640 API records with complete discovery and no blocked, failed or rejected record",
  },
  elavegan: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-54-36.153Z-attempt-5d3f8b65-1051-43cd-926d-9d0836cdb289",
    deferOrBlockReason:
      "Uncapped run persisted 523 recipes from 523 API records with complete discovery and no blocked, failed or rejected record",
  },
  elephantasticvegan: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-50-13.381Z-attempt-056da79a-82ce-42e5-aa55-3c1456d6eb0e",
    deferOrBlockReason:
      "Uncapped run persisted 273 recipes from 273 API records with complete discovery and no blocked, failed or rejected record",
  },
  elizabethskitchendiary: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-52-36.804Z-attempt-7a4ba97a-f984-498e-8357-60584a46306f",
    deferOrBlockReason:
      "Uncapped run persisted 458 recipes from 458 API records with complete discovery and no blocked, failed or rejected record",
  },
  emilybites: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-55-00.314Z-attempt-a389c956-4743-48e9-ae9d-80f609214ed7",
    deferOrBlockReason:
      "Uncapped run persisted 879 recipes from 880 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  emilyenchanted: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-50-26.558Z-attempt-13a06639-567b-4f59-8478-9673ee7c9b9a",
    deferOrBlockReason:
      "Uncapped run persisted 584 recipes from 584 API records with complete discovery and no blocked, failed or rejected record",
  },
  entertainingwithbeth: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-52-55.962Z-attempt-ac9528e0-0757-4f08-89db-180d0e3cb527",
    deferOrBlockReason:
      "Uncapped run persisted 1 recipes from 2 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  errenskitchen: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-55-27.631Z-attempt-c3969008-174a-4d30-993e-8cd73cfc9cfa",
    deferOrBlockReason:
      "Uncapped run persisted 742 recipes from 744 API records; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  evergreenkitchen: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-50-46.246Z-attempt-5dce2ae5-ee24-4f44-861e-79bd056ebe72",
    deferOrBlockReason:
      "Uncapped run persisted 268 recipes from 268 API records with complete discovery and no blocked, failed or rejected record",
  },
  everydaymaven: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-53-03.498Z-attempt-19fe4bfa-ab0b-4375-a5d3-f8b014ec2f2a",
    deferOrBlockReason:
      "Uncapped run persisted 416 recipes from 416 API records with complete discovery and no blocked, failed or rejected record",
  },
  everylastbite: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-55-56.280Z-attempt-88756179-8fc0-4278-b18c-87780d4d90fd",
    deferOrBlockReason:
      "Uncapped run persisted 758 recipes from 761 API records; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  evolvingtable: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-51-00.014Z-attempt-4862dd41-0f8b-4a68-8bd0-275c7ac00ee8",
    deferOrBlockReason:
      "Uncapped run persisted 853 recipes from 922 API records; 69 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  fabfood4all: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-53-22.408Z-attempt-e0905cc6-76cc-4e9d-b3c0-5346565e3fc9",
    deferOrBlockReason:
      "Uncapped run persisted 426 recipes from 426 API records with complete discovery and no blocked, failed or rejected record",
  },
  fabulesslyfrugal: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-56-20.897Z-attempt-14f77864-b37d-4f15-b1f5-10fd5bce0e7b",
    deferOrBlockReason:
      "Uncapped run persisted 897 recipes from 900 API records; 1 blocked request, 3 records the source publishes incomplete or malformed and discovery that did not complete keeps it short of a canary",
  },
  familyfreshmeals: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-51-35.026Z-attempt-152cc76d-79d7-4b84-b32b-cd4063f9c57e",
    deferOrBlockReason:
      "Uncapped run persisted 0 recipes from 1 API records; 1 record the source publishes incomplete or malformed and discovery that did not complete keeps it short of a canary",
  },
  familystylefood: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-53-44.038Z-attempt-1adf2881-a1cc-45ea-84ea-2db239766898",
    deferOrBlockReason:
      "Uncapped run persisted 469 recipes from 469 API records with complete discovery and no blocked, failed or rejected record",
  },
  farmgirlgourmet: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-57-01.250Z-attempt-d297b05b-de93-498e-9b9b-31451ce8face",
    deferOrBlockReason:
      "Uncapped run persisted 338 recipes from 338 API records with complete discovery and no blocked, failed or rejected record",
  },
  fatgirlskinny: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-51-42.667Z-attempt-c8ffb17d-65b5-4a15-a280-8265b48333c3",
    deferOrBlockReason:
      "Uncapped run persisted 229 recipes from 240 API records; 11 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  fearlessdining: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-54-03.022Z-attempt-d9b3cfea-3ceb-4a5d-8392-0ed1a33599d8",
    deferOrBlockReason:
      "Uncapped run persisted 852 recipes from 864 API records; 12 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  feastandfarm: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-57-17.743Z-attempt-6d372abd-62f5-4cb5-97aa-77132ccce59d",
    deferOrBlockReason:
      "Uncapped run persisted 390 recipes from 392 API records; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  fedandfit: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-51-55.163Z-attempt-4f6a25e9-89c4-40aa-bcda-e0a42ae02b49",
    deferOrBlockReason:
      "Uncapped run persisted 1124 recipes from 1126 API records; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  feelgoodfoodie: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-54-38.358Z-attempt-e4bb0232-0d31-4383-a447-60e8881f3ff5",
    deferOrBlockReason:
      "Uncapped run persisted 1524 recipes from 1524 API records with complete discovery and no blocked, failed or rejected record",
  },
  feistytapas: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-57-39.600Z-attempt-fcb925d6-0f10-47a4-93b2-3ad34714e8d4",
    deferOrBlockReason:
      "Uncapped run persisted 176 recipes from 176 API records with complete discovery and no blocked, failed or rejected record",
  },
  firstdayofhome: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-52-29.533Z-attempt-1643a1a4-0181-493a-a393-1889aef404f5",
    deferOrBlockReason:
      "Uncapped run persisted 81 recipes from 81 API records with complete discovery and no blocked, failed or rejected record",
  },
  fitfoodiefinds: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-55-21.537Z-attempt-15c14edb-b2cd-4b50-92e3-966588903add",
    deferOrBlockReason:
      "Uncapped run persisted 1930 recipes from 1975 API records; 45 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  fivehearthome: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-58-00.454Z-attempt-bcbbe56f-1ae7-41cf-a6d5-e4e85fd5b835",
    deferOrBlockReason:
      "Uncapped run persisted 638 recipes from 638 API records with complete discovery and no blocked, failed or rejected record",
  },
  flavcity: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-52-37.863Z-attempt-120f836c-6b16-4e12-9ddd-db2ed0e2f1ac",
    deferOrBlockReason:
      "Uncapped run reached no recipe candidates (malformed-listing-payload), so the route needs review before a canary",
  },
  flavourandsavour: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-56-15.715Z-attempt-f8906059-aba3-4592-8059-f07dc19eaf97",
    deferOrBlockReason:
      "Uncapped run persisted 657 recipes from 657 API records with complete discovery and no blocked, failed or rejected record",
  },
  flawlessfood: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-58-22.293Z-attempt-aa411041-4a42-4098-8d4f-03193d590c00",
    deferOrBlockReason:
      "Uncapped run persisted 294 recipes from 294 API records with complete discovery and no blocked, failed or rejected record",
  },
  flouronmyface: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-52-43.504Z-attempt-b862dba7-7bb4-470e-b2f9-a2a20ec8139a",
    deferOrBlockReason:
      "Uncapped run persisted 1192 recipes from 1194 API records; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  floursandfrostings: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-56-53.426Z-attempt-b0d24493-8fec-4106-a9e7-34b1ecf00e01",
    deferOrBlockReason:
      "Uncapped run persisted 277 recipes from 280 API records; 3 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  foodbanjo: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-58-37.868Z-attempt-ffa3e350-6180-470b-b096-e5f623930f08",
    deferOrBlockReason:
      "Uncapped run persisted 616 recipes from 616 API records with complete discovery and no blocked, failed or rejected record",
  },
  foodfaithfitness: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-53-37.736Z-attempt-cca07d99-7fd1-4012-99a3-3cdc91ddc935",
    deferOrBlockReason:
      "Uncapped run persisted 4848 recipes from 4854 API records; 6 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  foodieandwine: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-57-10.016Z-attempt-084c5713-f08a-40d9-a74e-0bb0a8b10004",
    deferOrBlockReason:
      "Uncapped run persisted 478 recipes from 478 API records with complete discovery and no blocked, failed or rejected record",
  },
  foodiewithfamily: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-58-59.065Z-attempt-f34fc0e4-b2fc-49b3-8e48-26ca120d99c3",
    deferOrBlockReason:
      "Uncapped run persisted 1100 recipes from 1110 API records; 10 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  foodmeanderings: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-58-43.930Z-attempt-f6f11d06-4cdd-4691-a4e0-3f20acbbae83",
    deferOrBlockReason:
      "Uncapped run persisted 603 recipes from 603 API records with complete discovery and no blocked, failed or rejected record",
  },
  foodnourish: {
    migrationState: "blocked",
    latestCanary: "2026-08-21T10-57-29.979Z-attempt-8d557882-3efc-4568-8c77-396080740620",
    deferOrBlockReason:
      "Uncapped run persisted no recipes: 1 requests were blocked, so discovery could not complete",
  },
  foodwithfeeling: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-59-59.319Z-attempt-a63a2c50-6372-40df-8ad3-ecd33940432c",
    deferOrBlockReason:
      "Uncapped run persisted 991 recipes from 997 API records; 6 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  foolproofliving: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-59-15.521Z-attempt-74dfcc98-d7c0-4699-ac8e-802a91dbb735",
    deferOrBlockReason:
      "Uncapped run persisted 757 recipes from 757 API records with complete discovery and no blocked, failed or rejected record",
  },
  forkandtwist: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-57-35.707Z-attempt-46033acf-20bc-41c1-9f82-23ed50e50c70",
    deferOrBlockReason:
      "Uncapped run persisted 64 recipes from 64 API records with complete discovery and no blocked, failed or rejected record",
  },
  fortheloveofcooking: {
    migrationState: "configured",
    latestCanary: "2026-08-21T11-00-37.296Z-attempt-61f1ddea-f164-4075-b141-20e95aa00275",
    deferOrBlockReason:
      "Uncapped run persisted 399 recipes from 400 API records; 1 blocked request, 1 record the source publishes incomplete or malformed and discovery that did not complete keeps it short of a canary",
  },
  foxandbriar: {
    migrationState: "configured",
    latestCanary: "2026-08-21T10-59-41.972Z-attempt-0d2bc0de-be55-4684-97f7-619119e87580",
    deferOrBlockReason:
      "Uncapped run persisted 477 recipes from 478 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  freshsavory: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-57-44.144Z-attempt-6beff3ea-29a0-4298-8548-2409d27dc4da",
    deferOrBlockReason:
      "Uncapped run persisted 587 recipes from 587 API records with complete discovery and no blocked, failed or rejected record",
  },
  fromachefskitchen: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T11-00-59.462Z-attempt-cc956a31-6f7e-4df9-8b5c-4ee19a694def",
    deferOrBlockReason:
      "Uncapped run persisted 596 recipes from 596 API records with complete discovery and no blocked, failed or rejected record",
  },
  frommybowl: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T11-00-02.010Z-attempt-82a4cc5c-de00-400c-9c9f-bcbdcef5ce9e",
    deferOrBlockReason:
      "Uncapped run persisted 418 recipes from 418 API records with complete discovery and no blocked, failed or rejected record",
  },
  fromscratchfast: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-58-04.911Z-attempt-0cd7d3d5-4fea-4d22-bc83-0c551d094221",
    deferOrBlockReason:
      "Uncapped run persisted 391 recipes from 391 API records with complete discovery and no blocked, failed or rejected record",
  },
  fromvalerieskitchen: {
    migrationState: "configured",
    latestCanary: "2026-08-21T11-01-24.371Z-attempt-220005a9-2858-4ab1-950c-ef6d77274e8b",
    deferOrBlockReason:
      "Uncapped run persisted 848 recipes from 850 API records; 2 records the source publishes incomplete or malformed keeps it short of a canary",
  },
  fullofplants: {
    migrationState: "blocked",
    latestCanary: "2026-08-21T11-00-22.184Z-attempt-7b57fd11-b5d2-40e0-bb90-25b685f4197c",
    deferOrBlockReason:
      "Uncapped run persisted no recipes: 1 requests were blocked, so discovery could not complete",
  },
  funfoodfrolic: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-21T10-58-22.093Z-attempt-3f4021f8-da6e-4625-8c0a-745ac3aa1efd",
    deferOrBlockReason:
      "Uncapped run persisted 592 recipes from 592 API records with complete discovery and no blocked, failed or rejected record",
  },
  garnishandglaze: {
    migrationState: "configured",
    latestCanary: "2026-08-21T11-01-51.160Z-attempt-a535aedd-a179-4af6-9ec0-f9ae22c911d3",
    deferOrBlockReason:
      "Uncapped run persisted 558 recipes from 559 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
  },
  gatheringdreams: {
    migrationState: "configured",
    latestCanary: "2026-08-21T11-00-27.767Z-attempt-cc63bd4a-8028-4bdd-bba4-dc3be5d91925",
    deferOrBlockReason:
      "Uncapped run persisted 237 recipes from 238 API records; 1 record the source publishes incomplete or malformed keeps it short of a canary",
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
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T16-34-42.000Z",
    shadowParity:
      "722/722 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 722-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 722 recipes with every material field matching; all 722 keep a cuisine legacy has no field for and all 722 keep a yield legacy reduces to its first integer",
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
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T14-00-00.000Z",
    shadowParity:
      "161/161 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 161-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 161 recipes with every material field matching; the record at /opskrift/pok%C3%A9-bowl-med-torpedorejer is the one the percent-encoded URL fix recovered, without which the run came back one short",
  },
  christinaskoekken: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-16T08-04-11.505Z-attempt-a06f7670-5bde-451d-86ed-d075b801b8aa",
    deferOrBlockReason:
      "Uncapped run persisted 168 recipes with complete discovery and no blocked, failed or rejected record",
  },
  skalvibage: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T14-00-00.000Z",
    shadowParity:
      "175/175 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 175-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 175 recipes with every material field matching; 175 records keep a yield legacy reduces to its first integer",
  },
  kokke: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T14-00-00.000Z",
    shadowParity:
      "200/200 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 200-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 200 recipes with every material field matching; 200 records keep a cuisine legacy has no field for and the same 200 keep a yield legacy reduces to its first integer",
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
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T14-00-00.000Z",
    shadowParity:
      "203/203 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 203-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 203 recipes with every material field matching; 56 records keep a cuisine legacy has no field for, and 59 of the 262 sitemap candidates carry no Recipe JSON-LD in either implementation",
  },
  madfolket: {
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T14-00-00.000Z",
    shadowParity:
      "283/283 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 283-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 283 recipes with every material field matching; all 283 keep a cuisine legacy has no field for and all 283 keep a yield legacy reduces to its first integer",
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
    migrationState: "shadow_passed",
    latestScrapyOutcome: "succeeded",
    latestCanary: "2026-08-20T16-06-27.000Z",
    shadowParity:
      "365/365 recipes and every material field match exactly",
    deferOrBlockReason:
      "Two uncapped Crawlee runs emitted identical 365-record keys and normalized content with complete discovery and no failed, blocked, rejected, storage, or domain record, and the full isolated Scrapy run emitted the same 365 recipes with every material field matching; 147 records keep a cuisine legacy has no field for and 347 keep a yield legacy reduces to its first integer. The source states some section headings as double-escaped markup, which both implementations carry and which renders to the same text",
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
  /**
   * Cloudflare on this source gates browsers rather than clients: the WPRM
   * collection answers a plain client HTTP 200 with the full payload and a
   * browser user agent HTTP 403. Crawlee's generated headers therefore have
   * to come off for it, which is the inverse of the usual arrangement.
   */
  juliekarla: {
    migrationState: "blocked",
    latestCanary: "2026-08-20T07-08-06.457Z-attempt-0fe28461-f50e-4cd0-9c34-65b662b91ca9",
    deferOrBlockReason:
      "Cloudflare on this source gates clients by fingerprint rather than by user agent, and gates them the opposite way round from usual: curl with its own default user agent is answered HTTP 200 with the full 51 KB WPRM payload, while a browser user agent, an empty one, and Crawlee with header generation disabled are all answered HTTP 403. Matching it needs the HTTP client itself to present differently, not a header change, so the source stays blocked",
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
