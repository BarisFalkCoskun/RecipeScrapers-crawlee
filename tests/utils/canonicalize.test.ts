import { describe, it, expect } from "vitest";
import { canonicalizeUrl } from "../../src/utils/canonicalize.js";

describe("canonicalizeUrl", () => {
  it("strips utm query params", () => {
    expect(canonicalizeUrl("https://example.dk/page?utm_source=google&utm_medium=cpc"))
      .toBe("https://example.dk/page");
  });

  it("strips fbclid and gclid", () => {
    expect(canonicalizeUrl("https://example.dk/page?fbclid=abc123&gclid=xyz"))
      .toBe("https://example.dk/page");
  });

  it("preserves non-tracking query params", () => {
    expect(canonicalizeUrl("https://example.dk/search?q=kage&page=2"))
      .toBe("https://example.dk/search?page=2&q=kage");
  });

  it("removes fragments", () => {
    expect(canonicalizeUrl("https://example.dk/page#section"))
      .toBe("https://example.dk/page");
  });

  it("strips trailing slashes", () => {
    expect(canonicalizeUrl("https://example.dk/opskrifter/"))
      .toBe("https://example.dk/opskrifter");
  });

  it("does not strip trailing slash from root path", () => {
    expect(canonicalizeUrl("https://example.dk/"))
      .toBe("https://example.dk/");
  });

  it("lowercases hostname", () => {
    expect(canonicalizeUrl("https://Example.DK/Page"))
      .toBe("https://example.dk/Page");
  });

  it("removes /amp/ prefix", () => {
    expect(canonicalizeUrl("https://example.dk/amp/opskrift/kage"))
      .toBe("https://example.dk/opskrift/kage");
  });

  it("removes /m/ mobile prefix", () => {
    expect(canonicalizeUrl("https://example.dk/m/opskrift/kage"))
      .toBe("https://example.dk/opskrift/kage");
  });

  it("handles combined transforms", () => {
    expect(canonicalizeUrl("https://Example.DK/amp/page/?utm_source=fb#top"))
      .toBe("https://example.dk/page");
  });

  it("resolves relative URL with baseUrl", () => {
    expect(canonicalizeUrl("/opskrift/kage", "https://example.dk/page"))
      .toBe("https://example.dk/opskrift/kage");
  });

  it("throws on relative URL without baseUrl", () => {
    expect(() => canonicalizeUrl("/opskrift/kage")).toThrow();
  });

  it("strips www. prefix", () => {
    expect(canonicalizeUrl("https://www.example.dk/page"))
      .toBe("https://example.dk/page");
  });

  it("normalizes www and non-www to same URL", () => {
    const a = canonicalizeUrl("https://www.valdemarsro.dk/opskrift/kage");
    const b = canonicalizeUrl("https://valdemarsro.dk/opskrift/kage");
    expect(a).toBe(b);
  });
});
