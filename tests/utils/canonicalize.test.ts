import { describe, it, expect } from "vitest";
import {
  canonicalizeUrl,
  stripTrackingParams,
} from "../../src/utils/canonicalize.js";

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

describe("stripTrackingParams", () => {
  // oetker publishes its Recipe @id as the page URL with a marketing query
  // string attached and a fresh fbclid on every request. That @id feeds the
  // upsert key, so seven of its recipes accumulated one document per crawl
  // while each run reported a clean 806.
  it("makes an oetker @id stable across two crawls", () => {
    const first =
      "https://www.oetker.dk/opskrifter/r/banankage" +
      "?utm_source=meta&utm_medium=post&utm_campaign=Kagerullen" +
      "&fbclid=PAcGRvZgJleHRuA2FlbQEwAGFkaWQBqzndblYRwXNydGMGYXBwX2lk";
    const second =
      "https://www.oetker.dk/opskrifter/r/banankage" +
      "?utm_source=meta&utm_medium=post&utm_campaign=Kagerullen" +
      "&fbclid=IwcGRvZgVleHRuA2FlbQEwAGFkaWQBqzndblYRwXNydGMGYXBwX2lk";
    expect(stripTrackingParams(first)).toBe(stripTrackingParams(second));
    expect(stripTrackingParams(first)).toBe(
      "https://www.oetker.dk/opskrifter/r/banankage"
    );
  });

  // Returning a URL with nothing to strip byte-identical is what keeps this
  // from re-keying every record whose @id merely spells its URL differently.
  it("returns a URL with nothing to strip unchanged", () => {
    for (const url of [
      "https://www.oetker.dk/opskrifter/r/banankage",
      "https://WWW.Example.dk/Opskrift/Kage/",
      "https://example.dk/recipe?b=2&a=1",
      "https://example.dk/recipe#method",
    ]) {
      expect(stripTrackingParams(url)).toBe(url);
    }
  });

  it("leaves a non-URL @id alone", () => {
    for (const id of ["#recipe", "12345", "urn:uuid:abc", ""]) {
      expect(stripTrackingParams(id)).toBe(id);
    }
  });

  it("keeps the parameters that are not tracking", () => {
    expect(
      stripTrackingParams("https://example.dk/recipe?id=7&utm_source=meta&page=2")
    ).toBe("https://example.dk/recipe?id=7&page=2");
  });
});
