import * as cheerio from "cheerio";
import { describe, expect, it } from "vitest";
import { getPlaywrightFallbackReason } from "../../src/crawlers/fallback-policy.js";
import type { ExtractionResult } from "../../src/types.js";

describe("getPlaywrightFallbackReason", () => {
  it("prefers thin-content when the body is too small", () => {
    const html = "<html><body><div>loading</div></body></html>";
    const $ = cheerio.load(html);

    expect(
      getPlaywrightFallbackReason($, html, emptyExtraction(), false, 0)
    ).toBe("thin-content");
  });

  it("flags js-markers on non-thin pages", () => {
    const body = "ingredienser ".repeat(30);
    const html = `<html><body><main>${body}</main><script>window.__NEXT_DATA__={}</script></body></html>`;
    const $ = cheerio.load(html);

    expect(
      getPlaywrightFallbackReason($, html, emptyExtraction(), false, 0)
    ).toBe("js-markers");
  });

  it("flags sitemap pages after content and js checks", () => {
    const body = "ingredienser ".repeat(30);
    const html = `<html><body><main>${body}</main></body></html>`;
    const $ = cheerio.load(html);

    expect(
      getPlaywrightFallbackReason($, html, emptyExtraction(), true, 0)
    ).toBe("sitemap-page");
  });

  it("flags high-value discoveries when no higher-priority reason matches", () => {
    const body = "ingredienser ".repeat(30);
    const html = `<html><body><main>${body}</main></body></html>`;
    const $ = cheerio.load(html);

    expect(
      getPlaywrightFallbackReason($, html, emptyExtraction(), false, 2)
    ).toBe("high-value-discovery");
  });

  it("does not fallback when a recipe was already extracted", () => {
    const body = "ingredienser ".repeat(30);
    const html = `<html><body><main>${body}</main></body></html>`;
    const $ = cheerio.load(html);

    expect(
      getPlaywrightFallbackReason(
        $,
        html,
        {
          recipes: [{ name: "Cake" }],
          method: "json-ld",
          confidence: 1,
          signals: ["json-ld-found"],
        },
        true,
        3
      )
    ).toBeNull();
  });
});

function emptyExtraction(): ExtractionResult {
  return {
    recipes: [],
    method: "partial",
    confidence: 0,
    signals: [],
  };
}
