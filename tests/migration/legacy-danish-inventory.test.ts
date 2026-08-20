import { describe, expect, it } from "vitest";
import { createLegacyDanishCoverageReport } from "../../src/migration/legacy-danish-inventory.js";

describe("legacy Danish migration coverage", () => {
  it("groups registered and remaining spiders by their direct base class", () => {
    const report = createLegacyDanishCoverageReport([
      { id: "api", legacySpider: "ApiSpider", baseClass: "WprmApiSpider", domain: "api.dk" },
      { id: "custom", legacySpider: "CustomSpider", baseClass: "SitemapSpider", domain: "custom.dk" },
      { id: "direct", legacySpider: "DirectSpider", baseClass: "Spider", domain: "direct.dk" },
    ], ["api"]);

    expect(report).toEqual({
      totalDanishSpiders: 3,
      registered: 1,
      remaining: 2,
      registeredByBaseClass: { WprmApiSpider: 1 },
      remainingByBaseClass: {
        SitemapSpider: ["custom"],
        Spider: ["direct"],
      },
    });
  });
});
