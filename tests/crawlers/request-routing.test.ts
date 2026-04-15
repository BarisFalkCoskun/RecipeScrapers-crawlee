import { describe, expect, it } from "vitest";
import {
  REQUEST_LABELS,
  classifyCheerioRequest,
  classifyPlaywrightRequest,
} from "../../src/crawlers/request-routing.js";

describe("request routing", () => {
  it("classifies cheerio sitemap requests from label", () => {
    expect(
      classifyCheerioRequest({ label: REQUEST_LABELS.sitemapPage })
    ).toBe(REQUEST_LABELS.sitemapPage);
  });

  it("classifies legacy cheerio sitemap requests from userData", () => {
    expect(
      classifyCheerioRequest({ userData: { fromSitemap: true } })
    ).toBe(REQUEST_LABELS.sitemapPage);
  });

  it("classifies unlabeled cheerio requests as discovered pages", () => {
    expect(classifyCheerioRequest({})).toBe(REQUEST_LABELS.discoveredPage);
  });

  it("classifies explicit playwright fallback label", () => {
    expect(
      classifyPlaywrightRequest({ label: REQUEST_LABELS.playwrightFallback })
    ).toBe(REQUEST_LABELS.playwrightFallback);
  });

  it("classifies legacy playwright fallback requests from userData", () => {
    expect(
      classifyPlaywrightRequest({ userData: { playwrightRetry: true } })
    ).toBe(REQUEST_LABELS.playwrightFallback);
  });

  it("classifies legacy playwright sitemap requests before discovered pages", () => {
    expect(
      classifyPlaywrightRequest({ userData: { fromSitemap: true } })
    ).toBe(REQUEST_LABELS.sitemapPage);
  });
});
