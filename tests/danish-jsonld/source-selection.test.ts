import { describe, expect, it } from "vitest";
import {
  createDanishJsonLdCrawlSelection,
  parseDanishJsonLdCrawlArgs,
  selectDanishJsonLdSources,
} from "../../src/danish-jsonld/source-selection.js";

describe("Danish JSON-LD source selection", () => {
  it("selects explicit comma-separated source ids and applies runtime controls", () => {
    const options = parseDanishJsonLdCrawlArgs([
      "--sources",
      "arla,kenwoodworld",
      "--max-pages",
      "12",
      "--database",
      "migration",
      "--force",
      "--vpn",
      "--vpn-country",
      "dk",
      "--json-out",
      "out.json",
    ]);

    expect(selectDanishJsonLdSources(options)).toEqual(["arla", "kenwoodworld"]);
    expect(options).toMatchObject({
      maxPages: 12,
      database: "migration",
      force: true,
      vpn: true,
      vpnCountry: "dk",
      jsonOut: "out.json",
    });
  });

  it("rejects unknown sources and malformed runtime options", () => {
    expect(() => parseDanishJsonLdCrawlArgs(["--sources", "missing"])).toThrow(
      'Unknown Danish JSON-LD source: "missing"'
    );
    expect(() => parseDanishJsonLdCrawlArgs(["--max-pages", "0"])).toThrow(
      "--max-pages must be a positive integer"
    );
    expect(() => parseDanishJsonLdCrawlArgs(["--vpn-country", "dk"])).toThrow(
      "--vpn-country requires --vpn"
    );
  });

  it("defaults to Arla rather than running every unverified source", () => {
    const options = parseDanishJsonLdCrawlArgs([]);
    expect(selectDanishJsonLdSources(options)).toEqual(["arla"]);
  });

  it("creates a JSON-safe selected-source handoff without invoking a crawl", () => {
    const selection = createDanishJsonLdCrawlSelection(
      parseDanishJsonLdCrawlArgs(["--sources", "arla", "--max-pages", "5"])
    );

    expect(selection).toMatchObject({
      sourceIds: ["arla"],
      maxPages: 5,
      sources: [{ id: "arla", requireCompleteJsonLd: true }],
    });
  });
});
