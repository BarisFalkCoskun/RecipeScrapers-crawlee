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
  legacyFamily: "JsonLdSitemapRecipeSpider" | "JsonLdListingSpider";
  discovery: DiscoveryMode;
  sitemapUrls: string[];
  startUrls: string[];
  recipeUrlPatterns: string[];
  listingDiscovery?: ListingDiscoveryStrategy;
  sitemapDiscovery?: SitemapDiscoveryStrategy;
  fetchMode: FetchMode;
  requestSettings: {
    delaySeconds: number;
    rateLimitPerMinute: number | null;
    maxConcurrency: number;
    maxRetries: number;
  };
  requireCompleteJsonLd: true;
  migrationState: MigrationState;
  latestScrapyOutcome: "not_audited";
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

const LEGACY_LISTING_DISCOVERY_OVERRIDES: Record<
  string,
  Partial<ListingDiscoveryStrategy>
> = {
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
    migrationState: "configured",
    latestCanary: PILOT_CANARY_RUN,
    deferOrBlockReason: "Pilot persisted recipes but reached the canary page cap",
  },
  coop: {
    migrationState: "configured",
    latestCanary: PILOT_CANARY_RUN,
    deferOrBlockReason: "Pilot persisted recipes but reached the canary page cap",
  },
  kitchenaid: {
    migrationState: "configured",
    latestCanary: PILOT_CANARY_RUN,
    deferOrBlockReason: "Pilot persisted recipes but reached the canary page cap",
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
  /** Sitemap did not answer within the audit timeout; route unverified. */
  ricardocuisine: {
    migrationState: "not_started",
    deferOrBlockReason: "Sitemap request timed out during the route audit; route unverified",
  },
  aperol: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T20-03-09.220Z-attempt-4abcc7ae-5fcc-4119-9b75-44036466910b",
    deferOrBlockReason:
      "Uncapped run persisted 1 recipes with complete discovery and no blocked or failed request",
  },
  ferrerorocher: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T20-03-32.139Z-attempt-f3b7a390-cb11-42ae-9782-728099d8e443",
    deferOrBlockReason:
      "Uncapped run persisted 3 recipes with complete discovery and no blocked or failed request",
  },
  friluftslageret: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T20-08-35.579Z-attempt-53fdc75c-e4dd-4a03-bc06-000512c6b8c2",
    deferOrBlockReason:
      "Uncapped run persisted 1 recipes with complete discovery and no blocked or failed request",
  },
  glutenfrimagi: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T20-07-53.129Z-attempt-25799574-7bc4-42c5-820a-09518a4eda5c",
    deferOrBlockReason:
      "Uncapped run persisted 8 recipes with complete discovery and no blocked or failed request",
  },
  knaehoejkarse: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T20-07-13.596Z-attempt-bf40d0e4-7bed-4947-90c6-45049106452d",
    deferOrBlockReason:
      "Uncapped run persisted 12 recipes with complete discovery and no blocked or failed request",
  },
  madrejsen: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T19-38-50.433Z-attempt-1f798f5f-9220-44bf-93af-19824fa1e326",
    deferOrBlockReason:
      "Uncapped run persisted 149 recipes with complete discovery and no blocked or failed request",
  },
  parcelhuslykke: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T20-06-39.804Z-attempt-7f38470e-f0f5-422d-a434-ff152b40e681",
    deferOrBlockReason:
      "Uncapped run persisted 11 recipes with complete discovery and no blocked or failed request",
  },
  recipesairfryer_dk: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T20-04-00.259Z-attempt-a7db1f8a-4133-459e-b30a-448c35056fdb",
    deferOrBlockReason:
      "Uncapped run persisted 47 recipes with complete discovery and no blocked or failed request",
  },
  rema1000: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T20-11-01.445Z-attempt-828a9ea6-ce87-48af-a902-ae534a4956fd",
    deferOrBlockReason:
      "Uncapped run persisted 671 recipes with complete discovery and no blocked or failed request",
  },
  beauvais: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T22-55-14.681Z-attempt-06bf543f-0df8-4464-ade7-6f2e174603ea",
    deferOrBlockReason:
      "Uncapped run persisted 69 recipes with complete discovery and no blocked or failed request",
  },
  cocktaily: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T22-30-27.302Z-attempt-0bf7133d-8283-4f60-ab3f-d884a91e03c1",
    deferOrBlockReason:
      "Uncapped run persisted 36 recipes with complete discovery and no blocked or failed request",
  },
  evatrio: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T22-38-28.666Z-attempt-c7c07bee-eb1a-4a4d-ac8d-dd2076b6bd38",
    deferOrBlockReason:
      "Uncapped run persisted 28 recipes with complete discovery and no blocked or failed request",
  },
  hannerobinson: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T22-58-02.099Z-attempt-abadfe8b-8410-42e3-bad2-e58c6494762f",
    deferOrBlockReason:
      "Uncapped run persisted 2 recipes with complete discovery and no blocked or failed request",
  },
  ketomums: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T22-36-27.112Z-attempt-74639a33-c169-4513-8e20-2ace0ba01e74",
    deferOrBlockReason:
      "Uncapped run persisted 47 recipes with complete discovery and no blocked or failed request",
  },
  kornkammeret: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T22-20-20.119Z-attempt-63551004-a723-4094-b327-09787d4eb087",
    deferOrBlockReason:
      "Uncapped run persisted 33 recipes with complete discovery and no blocked or failed request",
  },
  nescafe: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T22-31-51.255Z-attempt-0b93a2d3-9e6e-4148-9306-66190afe12d9",
    deferOrBlockReason:
      "Uncapped run persisted 34 recipes with complete discovery and no blocked or failed request",
  },
  nutella: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T22-47-10.442Z-attempt-90370b42-f322-432f-aafe-ec630944c6b2",
    deferOrBlockReason:
      "Uncapped run persisted 55 recipes with complete discovery and no blocked or failed request",
  },
  violife: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T22-15-06.343Z-attempt-b9e38ccf-4d5d-4af5-8098-6134e4f46703",
    deferOrBlockReason:
      "Uncapped run persisted 28 recipes with complete discovery and no blocked or failed request",
  },
  frokenkraesen_com: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-14T22-44-17.709Z-attempt-7b4df030-3d95-4e7d-8b6f-599570b741cd",
    deferOrBlockReason:
      "Uncapped run persisted 51 recipes with complete discovery and no blocked or failed request",
  },
  schulstad: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-15T05-52-37.152Z-attempt-092a30f7-537d-42bc-930c-67427da152d3",
    deferOrBlockReason:
      "Uncapped run persisted 94 recipes with complete discovery and no blocked or failed request",
  },
  madformadelskere: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-15T05-56-27.179Z-attempt-ad2aa124-2f05-469e-ad64-a2edfea11329",
    deferOrBlockReason:
      "Uncapped run persisted 72 recipes with complete discovery and no blocked or failed request",
  },
  semper: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-15T06-53-38.420Z-attempt-fe65cdc2-cd7e-4dba-9d90-9007e80ed99e",
    deferOrBlockReason:
      "Served its recipe HTML as text/plain and returned no data until that content type was accepted; now 25 recipes with complete discovery and no blocked or failed request",
  },
  stinna: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-15T06-54-38.846Z-attempt-eaf3d49d-5daf-4a18-99af-552e24708b88",
    deferOrBlockReason:
      "Uncapped run persisted 1430 recipes over 1934 pages with complete discovery and no blocked or failed request; six pages carry Recipe JSON-LD without required fields and stay rejected",
  },
  bodylab: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-15T08-26-32.970Z-attempt-c3922faf-ed16-463b-ba0d-92d0823f08af",
    deferOrBlockReason:
      "Uncapped run persisted 149 recipes with complete discovery and no blocked or failed request; two pages carry Recipe JSON-LD without required fields and stay rejected",
  },
  starbucksathome: {
    migrationState: "configured",
    latestCanary: "2026-08-15T08-24-54.313Z-attempt-38f62583-6ad2-4d4f-8e4f-9744e05bcbc8",
    deferOrBlockReason:
      "Crawl is clean but the source rejects more than it keeps: 96 pages carry Recipe JSON-LD without required fields against 28 persisted, so its JSON-LD coverage needs review before a canary",
  },
  klank: {
    migrationState: "canary_passed",
    latestCanary: "2026-08-15T08-36-39.727Z-attempt-0f50f57c-d0a3-491c-a921-fc0c6c9e81da",
    deferOrBlockReason:
      "Uncapped run persisted 52 recipes with complete discovery and no blocked or failed request; two pages carry Recipe JSON-LD without required fields and stay rejected",
  },
  kenwoodworld: {
    migrationState: "configured",
    deferOrBlockReason:
      "Listing continues through a script-only load-more control; needs a discovery contract for its continuation route",
  },
  kikkoman: {
    migrationState: "configured",
    latestCanary: PILOT_CANARY_RUN,
    deferOrBlockReason: "Literal-control-character JSON-LD repair awaits canary validation",
  },
  gamleopskrifter: {
    discovery: "sitemap",
    sitemapUrls: ["https://gamleopskrifter.com/sitemap.xml"],
    startUrls: [],
    recipeUrlPatterns: [
      "^https://gamleopskrifter\\.com/g/home/r/[^/?#]+/?$",
    ],
    migrationState: "configured",
    latestCanary: PILOT_CANARY_RUN,
    deferOrBlockReason: "Current sitemap discovery repair awaits canary validation",
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
    latestCanary: PILOT_CANARY_RUN,
    deferOrBlockReason: "HTTP 401 security verification on configured sitemap",
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
export const DANISH_JSONLD_SOURCES: DanishJsonLdSource[] =
  RAW_DANISH_JSONLD_SOURCES.map((source) => {
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
  });

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
