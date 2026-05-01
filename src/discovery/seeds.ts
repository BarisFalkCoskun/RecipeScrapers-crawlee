import type { SeedConfig } from "../types.js";
import { DISCOVERY } from "../config.js";

const DEFAULT_MAX_PAGES = DISCOVERY.defaultMaxPagesPerDomain;

export const SEEDS: SeedConfig[] = [
  {
    domain: "valdemarsro.dk",
    sitemapUrl: "https://www.valdemarsro.dk/sitemap.xml",
    startUrls: ["https://www.valdemarsro.dk/opskrifter/"],
    requiresJs: false,
    respectRobotsTxt: true,
    maxPages: DEFAULT_MAX_PAGES,
    admissionRole: "trusted",
  },
  {
    domain: "arla.dk",
    sitemapUrl: "https://arla.dk/sitemap.xml",
    startUrls: ["https://arla.dk/opskrifter/"],
    requiresJs: false,
    respectRobotsTxt: true,
    maxPages: DEFAULT_MAX_PAGES,
    admissionRole: "trusted",
  },
  {
    domain: "dk-kogebogen.dk",
    sitemapUrl: "https://www.dk-kogebogen.dk/sitemap/sitemap.xml",
    startUrls: ["https://www.dk-kogebogen.dk/opskrifter/"],
    requiresJs: false,
    respectRobotsTxt: true,
    maxPages: DEFAULT_MAX_PAGES,
    admissionRole: "trusted",
  },
  {
    domain: "madensverden.dk",
    sitemapUrl: "https://madensverden.dk/sitemap.xml",
    startUrls: ["https://madensverden.dk/opskrifter/"],
    requiresJs: false,
    respectRobotsTxt: true,
    maxPages: DEFAULT_MAX_PAGES,
    admissionRole: "trusted",
  },
  {
    domain: "nemlig.com",
    sitemapUrl: undefined,
    startUrls: ["https://www.nemlig.com/opskrifter"],
    requiresJs: false,
    respectRobotsTxt: true,
    maxPages: DEFAULT_MAX_PAGES,
    admissionRole: "trusted",
  },
  {
    domain: "spisbedre.dk",
    sitemapUrl: "https://spisbedre.dk/sitemap.xml",
    startUrls: ["https://spisbedre.dk/opskrifter"],
    requiresJs: false,
    respectRobotsTxt: true,
    maxPages: DEFAULT_MAX_PAGES,
    admissionRole: "trusted",
  },
  {
    domain: "mummum.dk",
    sitemapUrl: "https://mummum.dk/sitemap_index.xml",
    startUrls: ["https://mummum.dk/opskrifter/"],
    requiresJs: false,
    respectRobotsTxt: true,
    maxPages: DEFAULT_MAX_PAGES,
    admissionRole: "trusted",
  },
  {
    domain: "juliebruun.com",
    sitemapUrl: "https://juliebruun.com/sitemap_index.xml",
    startUrls: ["https://juliebruun.com/opskrifter/"],
    requiresJs: false,
    respectRobotsTxt: true,
    maxPages: DEFAULT_MAX_PAGES,
    admissionRole: "trusted",
  },
];
