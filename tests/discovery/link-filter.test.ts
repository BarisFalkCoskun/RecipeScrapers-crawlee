import { describe, it, expect, beforeEach } from "vitest";
import { LinkFilter } from "../../src/discovery/link-filter.js";

describe("LinkFilter", () => {
  let filter: LinkFilter;

  beforeEach(() => {
    filter = new LinkFilter();
  });

  it("allows .dk domains", () => {
    expect(filter.shouldEnqueue("https://example.dk/page")).toBe(true);
  });

  it("rejects non-.dk domains without recipe signals", () => {
    expect(filter.shouldEnqueue("https://example.com/page")).toBe(false);
  });

  it("allows non-.dk domains with isDanishRecipe flag", () => {
    expect(filter.shouldEnqueue("https://example.com/page", { isDanishRecipe: true })).toBe(true);
  });

  it("rejects denylist patterns", () => {
    expect(filter.shouldEnqueue("https://example.dk/tag/kage")).toBe(false);
    expect(filter.shouldEnqueue("https://example.dk/search?q=kage")).toBe(false);
    expect(filter.shouldEnqueue("https://example.dk/login")).toBe(false);
    expect(filter.shouldEnqueue("https://example.dk/wp-json/api")).toBe(false);
    expect(filter.shouldEnqueue("https://example.dk/page/3")).toBe(false);
  });

  it("identifies recipe-like URLs", () => {
    expect(filter.isRecipeLikeUrl("https://example.dk/opskrift/kage")).toBe(true);
    expect(filter.isRecipeLikeUrl("https://example.dk/opskrifter/dessert")).toBe(true);
    expect(filter.isRecipeLikeUrl("https://example.dk/recipe/cake")).toBe(true);
    expect(filter.isRecipeLikeUrl("https://example.dk/about")).toBe(false);
  });

  it("enforces per-domain page budget", () => {
    const smallFilter = new LinkFilter(2);
    expect(smallFilter.shouldEnqueue("https://example.dk/page1")).toBe(true);
    smallFilter.recordPageCrawled("example.dk");
    expect(smallFilter.shouldEnqueue("https://example.dk/page2")).toBe(true);
    smallFilter.recordPageCrawled("example.dk");
    expect(smallFilter.shouldEnqueue("https://example.dk/page3")).toBe(false);
  });

  it("tracks domain budgets independently", () => {
    const smallFilter = new LinkFilter(1);
    smallFilter.recordPageCrawled("a.dk");
    expect(smallFilter.shouldEnqueue("https://b.dk/page")).toBe(true);
  });

  it("shouldFollowLink allows recipe URLs always", () => {
    expect(filter.shouldFollowLink("https://a.dk/opskrift/kage", false, true, 5)).toBe(true);
  });

  it("shouldFollowLink allows 1 non-recipe hop from recipe page", () => {
    expect(filter.shouldFollowLink("https://a.dk/about", true, false, 0)).toBe(true);
    expect(filter.shouldFollowLink("https://a.dk/about2", true, false, 1)).toBe(false);
  });

  it("shouldFollowLink blocks non-recipe from non-recipe page", () => {
    expect(filter.shouldFollowLink("https://a.dk/about", false, false, 0)).toBe(false);
  });
});
