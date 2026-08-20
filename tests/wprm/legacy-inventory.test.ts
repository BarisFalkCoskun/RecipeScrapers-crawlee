import { describe, expect, it } from "vitest";
import { parseLegacyWprmSource } from "../../src/wprm/legacy-inventory.js";

describe("legacy Danish WPRM inventory parser", () => {
  it("reads multiline endpoints and effective transport overrides", () => {
    expect(parseLegacyWprmSource(`
class ExampleSpider(WprmApiSpider):
    name = 'example'
    source_site = 'example.dk'
    api_url = (
        'https://example.dk/wp-json/wp/v2/wprm_recipe'
    )
    use_playwright_api = True
    custom_settings = {
        'DOWNLOAD_DELAY': 20,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 1,
    }
`, "example.py")).toEqual({
      id: "example",
      legacySpider: "ExampleSpider",
      domain: "example.dk",
      apiUrl: "https://example.dk/wp-json/wp/v2/wprm_recipe",
      usePlaywright: true,
      delaySeconds: 20,
      maxConcurrency: 1,
      file: "example.py",
    });
  });

  it("applies base defaults and excludes explicitly English spiders", () => {
    const declaration = (country: string) => `
class ExampleSpider(WprmApiSpider):
    name = "example"
    source_site = "example.com"
    country = "${country}"
    api_url = "https://example.com/wp-json/wp/v2/wprm_recipe"
`;

    expect(parseLegacyWprmSource(declaration("danish_recipes"), "example.py"))
      .toMatchObject({ usePlaywright: false, delaySeconds: 1, maxConcurrency: 2 });
    expect(parseLegacyWprmSource(declaration("english_recipes"), "example.py"))
      .toBeNull();
  });
});
