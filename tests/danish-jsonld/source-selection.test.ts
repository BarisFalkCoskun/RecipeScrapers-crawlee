import { describe, expect, it } from "vitest";
import { DANISH_JSONLD_SOURCES } from "../../src/danish-jsonld/source-registry.js";
import {
  createDanishJsonLdCrawlSelection,
  DANISH_JSONLD_PILOT_SOURCE_IDS,
  DANISH_WPRM_PILOT_SOURCE_IDS,
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
      'Unknown recipe source: "missing"'
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

  it("exposes a Danish-first WPRM pilot without international sources", () => {
    expect(DANISH_WPRM_PILOT_SOURCE_IDS).toEqual([
      "gastrofun",
      "groedgrisen",
      "ketoliv",
      "madensverden",
      "planteaederen",
    ]);
    expect(createDanishJsonLdCrawlSelection({
      sourceIds: DANISH_WPRM_PILOT_SOURCE_IDS,
      force: false,
      vpn: false,
    }).sources.every((source) => source.legacyFamily === "WprmApiSpider")).toBe(true);
  });

  it("deduplicates valid sources in first-seen order", () => {
    expect(
      parseDanishJsonLdCrawlArgs(["--sources", "arla,kenwoodworld,arla"])
        .sourceIds
    ).toEqual(["arla", "kenwoodworld"]);
  });

  it("resolves legacy command aliases to one canonical source execution", () => {
    const selection = createDanishJsonLdCrawlSelection({
      sourceIds: ["dr", "drdk"],
      force: false,
      vpn: false,
    });
    expect(selection.sourceIds).toEqual(["drdk"]);
    expect(selection.sources.map((source) => source.id)).toEqual(["drdk"]);
  });

  it("defaults to every registered source once, including sources with previous failures", () => {
    const options = parseDanishJsonLdCrawlArgs([]);
    const selection = createDanishJsonLdCrawlSelection(options);
    const canonical = DANISH_JSONLD_SOURCES.filter((source) => !source.aliasFor);
    expect(selection.sources).toEqual(canonical);
    expect(selectDanishJsonLdSources(options)).toEqual(canonical.map((source) => source.id));
    expect(new Set(selection.sourceIds).size).toBe(selection.sourceIds.length);
    expect(selection.sourceIds).toContain("arla");
    expect(selection.sourceIds).toContain("gastrofun");
    expect(selection.sourceIds).toContain("allrecipes");
    expect(selection.sourceIds).toContain("netto");
    expect(selection.sourceIds).toContain("drdk");
    expect(selection.sourceIds).not.toContain("dr");
    expect(selection.sourceIds).not.toContain("aarstiderne");
    expect(options.maxPages).toBeUndefined();
  });

  it("accepts an explicit all-sites selection for resuming a default run", () => {
    const defaults = createDanishJsonLdCrawlSelection(parseDanishJsonLdCrawlArgs([]));
    const resumed = createDanishJsonLdCrawlSelection(parseDanishJsonLdCrawlArgs(["--resume", "run-1", "--sources", "all"]));
    expect(resumed.sourceIds).toEqual(defaults.sourceIds);
    expect(() => parseDanishJsonLdCrawlArgs(["--sources", "all,arla"])).toThrow(/by itself/);
  });

  it("selects separate Danish and English catalogues while preserving the all-sites default", () => {
    const danish = createDanishJsonLdCrawlSelection(parseDanishJsonLdCrawlArgs(["--language", "da"]));
    const english = createDanishJsonLdCrawlSelection(parseDanishJsonLdCrawlArgs(["--language", "en"]));
    const all = createDanishJsonLdCrawlSelection(parseDanishJsonLdCrawlArgs([]));
    expect(danish.sourceIds).toEqual(expect.arrayContaining(["arla", "gastrofun", "danishthings", "danishcrown"]));
    expect(english.sourceIds).toEqual(expect.arrayContaining(["allrecipes", "bbcgoodfood", "scandikitchen"]));
    expect(danish.sourceIds.filter((id) => english.sourceIds.includes(id))).toEqual([]);
    expect([...danish.sourceIds, ...english.sourceIds].sort()).toEqual([...all.sourceIds].sort());
    expect(createDanishJsonLdCrawlSelection(parseDanishJsonLdCrawlArgs(["--language", "da,en"])).sourceIds).toEqual(all.sourceIds);
  });

  it.each([
    [" Danish ", ["da"]], ["dansk", ["da"]], ["ENGLISH", ["en"]], ["da,english,danish", ["da", "en"]],
  ])("normalizes language names in %s", (value, expected) => {
    expect(parseDanishJsonLdCrawlArgs(["--language", value as string]).languages).toEqual(expected);
  });

  it("combines repeated language options", () => {
    expect(parseDanishJsonLdCrawlArgs(["--language", "da", "--language", "english"]).languages).toEqual(["da", "en"]);
  });

  it.each([[], [""], ["sv"], ["en,unknown"], ["da,"], ["--list-sources"]])("rejects malformed language values %j", (...values) => {
    expect(() => parseDanishJsonLdCrawlArgs(["--language", ...values])).toThrow(/--language/);
  });

  it("intersects explicit sources with the language filter and resolves aliases", () => {
    const args = ["--sources", "dr,bbcgoodfood,drdk,aarstiderne", "--language", "da"];
    expect(createDanishJsonLdCrawlSelection(parseDanishJsonLdCrawlArgs(args)).sourceIds).toEqual(["drdk", "meny"]);
    expect(createDanishJsonLdCrawlSelection(parseDanishJsonLdCrawlArgs(["--sources", "all", "--language", "en"])).sourceIds)
      .toEqual(createDanishJsonLdCrawlSelection(parseDanishJsonLdCrawlArgs(["--language", "en"])).sourceIds);
    expect(() => createDanishJsonLdCrawlSelection(parseDanishJsonLdCrawlArgs(["--sources", "arla", "--language", "en"])))
      .toThrow(/No sources match --language en/);
  });

  it("accepts the original language filter when resuming", () => {
    const original = createDanishJsonLdCrawlSelection(parseDanishJsonLdCrawlArgs(["--language", "da"]));
    const resumed = createDanishJsonLdCrawlSelection(parseDanishJsonLdCrawlArgs(["--resume", "run-1", "--language", "da"]));
    expect(resumed.sourceIds).toEqual(original.sourceIds);
    expect(resumed.resumeRunId).toBe("run-1");
    expect(() => parseDanishJsonLdCrawlArgs(["--resume", "run-1"])).toThrow(/original --sources or --language/);
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
