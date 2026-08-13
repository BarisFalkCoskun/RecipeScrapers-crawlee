import { describe, expect, it } from "vitest";
import {
  createDanishJsonLdCrawlSelection,
  DANISH_JSONLD_PILOT_SOURCE_IDS,
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
    expect(() => parseDanishJsonLdCrawlArgs(["--sources", ","])).toThrow(
      "--sources requires at least one source id"
    );
    expect(() => parseDanishJsonLdCrawlArgs(["--database", "--force"])).toThrow(
      "--database requires a value"
    );
  });

  it("deduplicates valid sources in first-seen order", () => {
    expect(
      parseDanishJsonLdCrawlArgs(["--sources", "arla,kenwoodworld,arla"])
        .sourceIds
    ).toEqual(["arla", "kenwoodworld"]);
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

  it("exposes the exact twelve-source Danish JSON-LD pilot as a registered selection", () => {
    expect(DANISH_JSONLD_PILOT_SOURCE_IDS).toEqual([
      "arla",
      "coop",
      "kitchenaid",
      "surdejsentusiasten",
      "sundpaabudget",
      "klinksgaard",
      "madoghave",
      "netto",
      "madrejsen",
      "tv2mad",
      "kikkoman",
      "gamleopskrifter",
    ]);

    expect(
      createDanishJsonLdCrawlSelection({
        sourceIds: DANISH_JSONLD_PILOT_SOURCE_IDS,
        force: false,
        vpn: false,
      }).sources.map((source) => source.id)
    ).toEqual(DANISH_JSONLD_PILOT_SOURCE_IDS);
  });
});
