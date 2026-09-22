import { describe, expect, it } from "vitest";
import { DANISH_JSONLD_SOURCES } from "../../src/danish-jsonld/source-registry.js";
import { requestProfileFor } from "../../src/danish-jsonld/request-profile.js";
import { createDanishJsonLdBrowserIdentity } from "../../src/danish-jsonld/crawler-factories.js";

describe("source request profiles", () => {
  const source = (id: string) => DANISH_JSONLD_SOURCES.find((s) => s.id === id)!;
  it("uses language metadata including localized international domains", () => {
    expect(requestProfileFor(source("danishthings"))).toEqual({ locale: "da-DK", timezoneId: "Europe/Copenhagen", acceptLanguage: "da-DK,da;q=0.9,en-US;q=0.8,en;q=0.7" });
    expect(requestProfileFor(source("bbcgoodfood"))).toEqual({ locale: "en-US", timezoneId: "UTC", acceptLanguage: "en-US,en;q=0.9" });
    expect(createDanishJsonLdBrowserIdentity(source("allrecipes"))["accept-language"]).toBe("en-US,en;q=0.9");
  });
  it("supports explicit regional overrides without changing language-based site selection", () => {
    expect(requestProfileFor({ ...source("bbcgoodfood"), requestProfile: { locale: "en-gb", timezoneId: "Europe/London" } }))
      .toEqual({ locale: "en-GB", timezoneId: "Europe/London", acceptLanguage: "en-GB,en;q=0.9" });
    expect(() => requestProfileFor({ ...source("arla"), requestProfile: { locale: "" } })).toThrow();
    expect(() => requestProfileFor({ ...source("arla"), requestProfile: { timezoneId: "Invalid/Zone" } })).toThrow();
  });
});
