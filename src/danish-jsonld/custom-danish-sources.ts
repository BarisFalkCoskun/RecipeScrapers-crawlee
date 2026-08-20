/** Custom legacy sitemap spiders that fit the strict JSON-LD runtime unchanged. */
export const DANISH_CUSTOM_JSONLD_SOURCE_DEFINITIONS = [
  {
    id: "beetrootbakery",
    legacySpider: "BeetrootBakerySpider",
    domain: "beetrootbakery.dk",
    sitemapUrl: "https://www.beetrootbakery.dk/wp-sitemap.xml",
    recipeUrlPattern: "^https?://(?:www\\.)?beetrootbakery\\.dk/[a-z0-9æøå-]+/?$",
    followPatterns: ["post-sitemap"],
    skipUrlFragments: [
      "/opskrifter/",
      "/category/",
      "/tag/",
      "/page/",
      "/forfatter/",
      "/om-mig",
      "/kontakt",
      "/privatlivspolitik",
      "/samarbejde",
      "/nyhedsbrev",
    ],
    delaySeconds: 2,
    maxConcurrency: 2,
  },
] as const;

/** Custom listing spiders that still fit strict Recipe JSON-LD extraction. */
export const DANISH_CUSTOM_LISTING_JSONLD_SOURCE_DEFINITIONS = [
  {
    id: "vegetariskhverdag",
    legacySpider: "VegetariskhverdagSpider",
    domain: "vegetariskhverdag.dk",
    startUrl: "https://vegetariskhverdag.dk/opskrifter",
    recipeUrlPattern: "^/\\d{4}/\\d{2}/[a-z0-9æøå-]+/?$",
    skipPathFragments: [
      "/opskrifter",
      "/category/",
      "/tag/",
      "/page/",
      "/author/",
      "/feed/",
      "/om-",
      "/kontakt/",
      "/privatlivspolitik/",
      "/wp-content/",
      "/wp-admin/",
    ],
    delaySeconds: 2,
    maxConcurrency: 2,
  },
  {
    id: "kagerogsager",
    legacySpider: "KagerOgSagerSpider",
    domain: "kagerogsager.dk",
    startUrl: "https://kagerogsager.dk/blogs/gratis-opskrifter",
    recipeUrlPattern: "^/blogs/gratis-opskrifter/[a-z0-9-]+/?$",
    skipPathFragments: [
      "/blogs/gratis-opskrifter/tagged/",
      "/category/",
      "/tag/",
      "/page/",
      "/author/",
    ],
    delaySeconds: 2,
    maxConcurrency: 2,
  },
] as const;

/** Custom sitemap spiders whose complete recipe is carried in embedded page JSON. */
export const DANISH_EMBEDDED_JSON_SOURCE_DEFINITIONS = [
  {
    id: "spisbedre",
    legacySpider: "SpisbedreSpider",
    domain: "spisbedre.dk",
    sitemapUrl: "https://spisbedre.dk/opskrifter/sitemap.xml",
    recipeUrlPattern: "^https?://(?:www\\.)?spisbedre\\.dk/opskrifter/[^/?#]+/?$",
    extractor: "spisbedre-inertia" as const,
    delaySeconds: 2,
    maxConcurrency: 2,
  },
] as const;

/** Custom sitemap spiders with complete Schema.org recipe microdata in HTML. */
export const DANISH_HTML_RECIPE_SOURCE_DEFINITIONS = [
  {
    id: "webopskrifter",
    legacySpider: "WebopskrifterSpider",
    domain: "webopskrifter.dk",
    sitemapUrl: "https://www.webopskrifter.dk/sitemap.xml",
    recipeUrlPattern:
      "^https?://(?:www\\.)?webopskrifter\\.dk/(?:opskrifter|madopskrifter|drinksopskrifter)/",
    followPatterns: ["sitemap-recipes"],
    extractor: "webopskrifter-microdata" as const,
    delaySeconds: 2,
    maxConcurrency: 2,
  },
] as const;

/** Hand-written legacy spiders whose payload is nevertheless standard WPRM. */
export const DANISH_CUSTOM_WPRM_SOURCE_DEFINITIONS = [
  {
    id: "foodfanatic",
    legacySpider: "FoodfanaticSpider",
    domain: "foodfanatic.dk",
    apiUrl: "https://www.foodfanatic.dk/wp-json/wp/v2/wprm_recipe",
    delaySeconds: 1,
    maxConcurrency: 2,
  },
  {
    id: "scandikitchen",
    legacySpider: "ScandiKitchenSpider",
    domain: "scandikitchen.co.uk",
    apiUrl: "https://www.scandikitchen.co.uk/wp-json/wp/v2/wprm_recipe",
    delaySeconds: 1,
    maxConcurrency: 1,
  },
] as const;

export const DANISH_SHOPIFY_BLOG_SOURCE_DEFINITIONS = [
  {
    id: "vinpusheren" as const,
    legacySpider: "VinpusherenSpider",
    domain: "vinpusheren.dk",
    sitemapUrl: "https://vinpusheren.dk/sitemap_blogs_1.xml",
    recipeUrlPattern: "^https?://(?:www\\.)?vinpusheren\\.dk/blogs/blog/[^/?#]+$",
  },
  {
    id: "hvidlogvin" as const,
    legacySpider: "HvidlogvinSpider",
    domain: "hvidlog-vin.dk",
    sitemapUrl: "https://www.hvidlog-vin.dk/sitemap_blogs_1.xml",
    recipeUrlPattern: "^https?://(?:www\\.)?hvidlog-vin\\.dk/blogs/artikler/[^/?#]+$",
  },
  {
    id: "hejholger" as const,
    legacySpider: "HejholgerSpider",
    domain: "hejholger.dk",
    sitemapUrl: "https://hejholger.dk/sitemap_blogs_1.xml",
    recipeUrlPattern: "^https?://(?:www\\.)?hejholger\\.dk/blogs/opskrift/[^/?#]+$",
  },
  {
    id: "mondaybliss" as const,
    legacySpider: "MondayBlissSpider",
    domain: "mondaybliss.dk",
    sitemapUrl: "https://mondaybliss.dk/sitemap_blogs_1.xml",
    recipeUrlPattern: "^https?://(?:www\\.)?mondaybliss\\.dk/blogs/madopskrifter/[^/?#]+$",
  },
] as const;

export const DANISH_ARTICLE_HTML_SOURCE_DEFINITIONS = [
  {
    id: "femina" as const,
    legacySpider: "FeminaSpider",
    domain: "femina.dk",
    sitemapUrl: "https://www.femina.dk/sitemap.xml",
    recipeUrlPattern: "^https?://(?:www\\.)?femina\\.dk/mad/[^?#]+$",
  },
] as const;

export const DANISH_JSONLD_HTML_SOURCE_DEFINITIONS = [
  {
    id: "gocook" as const,
    legacySpider: "GocookSpider",
    domain: "gocook.dk",
    sitemapUrl: "https://gocook.dk/sitemap.xml",
    recipeUrlPattern: "^https?://gocook\\.dk/opskrift/[a-z0-9æøå-]+/?$",
  },
] as const;

export const DANISH_REDIRECTED_JSONLD_SOURCE_DEFINITIONS = [
  {
    id: "samvirke" as const,
    legacySpider: "SamvirkeSpider",
    domain: "samvirke.dk",
    allowedDomains: ["samvirke.dk", "opskrifter.coop.dk"],
    sitemapUrl: "https://samvirke.dk/sitemap.xml",
    recipeUrlPattern: "^https?://(?:(?:www\\.)?samvirke\\.dk|opskrifter\\.coop\\.dk)/opskrifter/(?!emner/)[^/?#]+/?$",
    canonicalFollowStatuses: [200, 404],
  },
] as const;

export const DANISH_ALT_HTML_SOURCE_DEFINITIONS = [
  {
    id: "alt" as const,
    legacySpider: "AltSpider",
    domain: "alt.dk",
    sitemapUrl: "https://www.alt.dk/sitemapindex.xml",
    recipeUrlPattern: "^https?://(?:www\\.)?alt\\.dk/mad/[a-z0-9æøå-]+/\\d+$",
    followPatterns: ["sitemap\\?start="],
  },
] as const;

/** Umbraco text-container pages that may carry several recipes per URL. */
export const DANISH_MULTI_RECIPE_HTML_SOURCE_DEFINITIONS = [
  {
    id: "365discount" as const,
    legacySpider: "Discount365Spider",
    domain: "365discount.coop.dk",
    allowedDomains: ["365discount.coop.dk", "365discount.dk"],
    sitemapUrl: "https://365discount.coop.dk/sitemap.xml",
    recipeUrlPattern:
      "^https?://(?:www\\.)?365discount\\.coop\\.dk/inspiration/opskrifter/[^?#]+/?$",
  },
] as const;

/** DR's canonical GraphQL spider plus its legacy command-name alias. */
export const DANISH_DR_GRAPHQL_SOURCE_DEFINITIONS = [
  {
    id: "drdk" as const,
    legacySpider: "DrDkSpider",
    domain: "dr.dk",
  },
  {
    id: "dr" as const,
    legacySpider: "DrSpider",
    domain: "dr.dk",
    aliasFor: "drdk" as const,
  },
] as const;

export const DANISH_AUTHENTICATED_API_SOURCE_DEFINITIONS = [
  {
    id: "hellofresh" as const,
    legacySpider: "HellofreshSpider",
    domain: "hellofresh.dk",
    startUrl: "https://www.hellofresh.dk/recipes",
    extractor: "hellofresh-api" as const,
  },
  {
    id: "madforfattigroeve" as const,
    legacySpider: "MadForFattigroeveSpider",
    domain: "madforfattigroeve.dk",
    startUrl: "https://madforfattigroeve.dk/",
    extractor: "madforfattigroeve-nextjs" as const,
  },
] as const;

export const DANISH_DAGROFA_API_SOURCE_DEFINITIONS = [
  {
    id: "meny" as const,
    legacySpider: "MenySpider",
    domain: "meny.dk",
  },
  {
    id: "aarstiderne" as const,
    legacySpider: "AarstiderneSpider",
    domain: "meny.dk",
    aliasFor: "meny" as const,
  },
] as const;

export const DANISH_SITECORE_API_SOURCE_DEFINITIONS = [
  {
    id: "nemlig" as const,
    legacySpider: "NemligSpider",
    domain: "nemlig.com",
    startUrl: "https://www.nemlig.com/webapi/v2/AppSettings/Website",
  },
] as const;

/** Old WordPress articles whose recipes live in consistent body text. */
export const DANISH_LEGACY_BODY_HTML_SOURCE_DEFINITIONS = [
  {
    id: "nipunijulie" as const,
    legacySpider: "NipunijulieSpider",
    domain: "nipunijulie.dk",
    sitemapUrl: "https://nipunijulie.dk/post-sitemap.xml",
    recipeUrlPattern: "^https?://(?:www\\.)?nipunijulie\\.dk/[^/?#]+/?$",
    extractor: "nipunijulie-body-html" as const,
  },
  {
    id: "thefoodclub" as const,
    legacySpider: "ThefoodclubSpider",
    domain: "thefoodclub.dk",
    sitemapUrl: "https://www.thefoodclub.dk/post-sitemap.xml",
    recipeUrlPattern: "^https?://(?:www\\.)?thefoodclub\\.dk/[^/?#]+/?$",
    extractor: "thefoodclub-body-html" as const,
  },
] as const;
