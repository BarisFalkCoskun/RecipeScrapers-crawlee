import type { SeedConfig } from "../types.js";

export const SEEDS: SeedConfig[] = [
  {
    domain: "arla.dk",
    sitemapUrl: "https://arla.dk/sitemap.xml",
    requiresJs: false,
    respectRobotsTxt: true,
    maxPages: 5000,
    admissionRole: "trusted",
  },
  {
    domain: "dk-kogebogen.dk",
    sitemapUrl: "https://www.dk-kogebogen.dk/sitemap.xml",
    requiresJs: false,
    respectRobotsTxt: true,
    maxPages: 5000,
    admissionRole: "trusted",
  },
  {
    domain: "madensverden.dk",
    sitemapUrl: "https://madensverden.dk/sitemap.xml",
    requiresJs: false,
    respectRobotsTxt: true,
    maxPages: 5000,
    admissionRole: "trusted",
  },
  {
    domain: "nemlig.com",
    sitemapUrl: "https://www.nemlig.com/sitemap.xml",
    requiresJs: false,
    respectRobotsTxt: true,
    maxPages: 5000,
    admissionRole: "trusted",
  },
];
