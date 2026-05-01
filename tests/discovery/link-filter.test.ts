import { describe, it, expect, beforeEach } from "vitest";
import { LinkFilter } from "../../src/discovery/link-filter.js";

describe("LinkFilter", () => {
  let filter: LinkFilter;

  beforeEach(() => {
    filter = new LinkFilter();
  });

  it("allows queue-eligible URLs regardless of TLD", () => {
    expect(filter.shouldEnqueue("https://example.dk/page")).toBe(true);
    expect(filter.shouldEnqueue("https://example.com/page")).toBe(true);
  });

  it("returns base eligibility reasons", () => {
    expect(filter.getQueueEligibility("notaurl")).toEqual({
      allowed: false,
      reasons: ["invalid-url"],
    });
  });

  it("rejects non-http URLs", () => {
    expect(filter.getQueueEligibility("mailto:test@example.dk")).toEqual({
      allowed: false,
      reasons: ["unsupported-protocol"],
    });
    expect(filter.shouldEnqueue("javascript:void(0)")).toBe(false);
  });

  it("rejects denylist patterns", () => {
    expect(filter.shouldEnqueue("https://example.dk/tag/kage")).toBe(false);
    expect(filter.shouldEnqueue("https://example.dk/search?q=kage")).toBe(false);
    expect(filter.shouldEnqueue("https://example.dk/login")).toBe(false);
    expect(filter.shouldEnqueue("https://example.dk/wp-json/api")).toBe(false);
    expect(filter.shouldEnqueue("https://example.dk/page/3")).toBe(false);
  });

  it("allows soft discovery pages only when trusted discovery is enabled", () => {
    expect(filter.getQueueEligibility("https://example.dk/category/dinner")).toEqual({
      allowed: false,
      reasons: ["soft-discovery-pattern"],
    });

    expect(
      filter.getQueueEligibility("https://example.dk/category/dinner", {
        allowSoftDiscovery: true,
      })
    ).toEqual({
      allowed: true,
      domain: "example.dk",
      reasons: ["queue-eligible", "trusted-soft-discovery"],
    });

    expect(
      filter.shouldEnqueue("https://example.dk/page/2", {
        allowSoftDiscovery: true,
      })
    ).toBe(true);
  });

  it("rejects URLs with image/media file extensions", () => {
    expect(filter.shouldEnqueue("https://example.dk/photo.webp")).toBe(false);
    expect(filter.shouldEnqueue("https://example.dk/recipe/image.jpg")).toBe(false);
    expect(filter.shouldEnqueue("https://example.dk/video.mp4")).toBe(false);
    expect(filter.shouldEnqueue("https://example.dk/style.css")).toBe(false);
    expect(filter.shouldEnqueue("https://example.dk/recipe/kage")).toBe(true);
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
    smallFilter.recordEnqueued("https://example.dk/page1");
    expect(smallFilter.shouldEnqueue("https://example.dk/page2")).toBe(true);
    smallFilter.recordEnqueued("https://example.dk/page2");
    expect(smallFilter.shouldEnqueue("https://example.dk/page3")).toBe(false);
  });

  it("tracks domain budgets independently", () => {
    const smallFilter = new LinkFilter(1);
    smallFilter.recordEnqueued("https://a.dk/page");
    expect(smallFilter.shouldEnqueue("https://b.dk/page")).toBe(true);
  });

  it("reserves per-domain capacity when URLs are enqueued", () => {
    const smallFilter = new LinkFilter(1);
    smallFilter.recordEnqueued("https://example.dk/page1");
    expect(smallFilter.getDomainAdmissionCount("example.dk")).toBe(1);
    expect(smallFilter.shouldEnqueue("https://example.dk/page2")).toBe(false);
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

  it("restores persisted state", async () => {
    const stateStore = {
      getValue: async () => ({
        domainPageCounts: [["example.dk", 2]],
        domainAdmissionCounts: [["example.dk", 4]],
        totalEnqueued: 7,
      }),
      setValue: async () => undefined,
    };

    const persistedFilter = await LinkFilter.open({
      persistStateKey: "link-filter-state",
      stateStore,
    });

    expect(persistedFilter.getDomainCount("example.dk")).toBe(2);
    expect(persistedFilter.getDomainAdmissionCount("example.dk")).toBe(4);
    expect(persistedFilter.getTotalEnqueued()).toBe(7);
  });

  it("persists updated state on close", async () => {
    let savedState: unknown;
    const stateStore = {
      getValue: async () => null,
      setValue: async (_key: string, value: unknown) => {
        savedState = value;
      },
    };

    const persistedFilter = await LinkFilter.open({
      persistStateKey: "link-filter-state",
      stateStore,
    });
    persistedFilter.recordPageCrawled("example.dk");
    persistedFilter.recordEnqueued([
      "https://example.dk/a",
      "https://example.dk/b",
      "https://other.dk/c",
    ]);
    await persistedFilter.close();

    expect(savedState).toEqual({
      domainPageCounts: [["example.dk", 1]],
      domainAdmissionCounts: [
        ["example.dk", 3],
        ["other.dk", 1],
      ],
      totalEnqueued: 3,
    });
  });
});
