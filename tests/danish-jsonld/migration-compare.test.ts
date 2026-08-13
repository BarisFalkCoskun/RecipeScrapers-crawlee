import { describe, expect, it } from "vitest";
import {
  createMigrationComparisonReport,
  executeMigrationComparison,
  legacyMongoQueryFor,
  legacyRecipeSourceId,
  migrationComparisonExitCode,
  parseMigrationComparisonArgs,
  runMigrationComparisonCli,
  withComparisonClients,
} from "../../src/danish-jsonld/migration-compare.js";
import { legacySourceSitesFor } from "../../src/danish-jsonld/source-registry.js";

const requiredNormalizedRecipe = {
  title: "Kage",
  ingredients: ["1 æg"],
  instructions: [{ position: 1, text: "Bag." }],
};

function completeScrapyEvidence(sourceIds: string[]) {
  return {
    selected_spiders: sourceIds,
    processing_mode: "full",
    results: sourceIds.map((spider) => ({
      spider,
      outcome: "succeeded",
      timed_out: false,
      interrupted: false,
      process_completed: true,
      crawl_healthy: true,
      stats_dump_observed: true,
      stats: { "finish_reason": "finished" },
      outcome_reasons: [],
    })),
  };
}

function completeCrawleeEvidence(sourceIds: string[], database = "crawlee_shadow") {
  return {
    database,
    selectedSources: sourceIds,
    maxPages: null,
    summary: {
      sourceOutcomes: sourceIds.map((sourceId) => ({
        sourceId,
        outcome: "succeeded",
        outcomeReasons: [],
      })),
    },
    observations: sourceIds.map((sourceId) => ({
      sourceId,
      discoveryComplete: true,
      pageCapReached: false,
      mongoFailures: 0,
      rejectedIncompleteJsonLd: 0,
      rejectedMalformedJsonLd: 0,
      unintendedOffDomainAdmissions: 0,
    })),
  };
}

describe("Danish JSON-LD shadow comparison", () => {
  it("requires both isolated database names and an explicit source cohort", () => {
    expect(
      parseMigrationComparisonArgs([
        "--legacy-db", "scrapy_shadow",
        "--crawlee-db", "crawlee_shadow",
        "--sources", "arla,coop",
        "--scrapy-evidence", "scrapy.json",
        "--crawlee-evidence", "crawlee.json",
      ])
    ).toEqual({
      legacyDatabase: "scrapy_shadow",
      crawleeDatabase: "crawlee_shadow",
      sourceIds: ["arla", "coop"],
      scrapyEvidencePath: "scrapy.json",
      crawleeEvidencePath: "crawlee.json",
    });
    expect(() => parseMigrationComparisonArgs(["--legacy-db", "legacy"])).toThrow(
      "--crawlee-db is required"
    );
    expect(() => parseMigrationComparisonArgs([
      "--legacy-db", "legacy",
      "--crawlee-db", "crawlee",
      "--sources", "unknown",
      "--crawlee-evidence", "evidence.json",
    ])).toThrow('Unknown Danish JSON-LD source: "unknown"');
  });

  it("maps every selected source ID to the legacy source_site domain used for Mongo queries", () => {
    expect(legacySourceSitesFor("arla")).toEqual(["arla.dk"]);
    expect(legacySourceSitesFor("coop")).toEqual(["opskrifter.coop.dk"]);
    expect(Object.fromEntries([
      ["arla", "arla.dk"], ["coop", "opskrifter.coop.dk"],
      ["kitchenaid", "kitchenaid.dk"], ["surdejsentusiasten", "surdejsentusiasten.dk"],
      ["sundpaabudget", "sundpaabudget.dk"], ["klinksgaard", "klinksgaard.dk"],
      ["madoghave", "madoghave.dk"], ["netto", "netto.dk"],
      ["madrejsen", "madrejsen.dk"], ["tv2mad", "livsstil.tv2.dk"],
      ["kikkoman", "kikkoman.dk"], ["gamleopskrifter", "gamleopskrifter.com"],
    ].map(([sourceId, domain]) => [sourceId, legacySourceSitesFor(sourceId)]))).toEqual({
      arla: ["arla.dk"], coop: ["opskrifter.coop.dk"], kitchenaid: ["kitchenaid.dk"],
      surdejsentusiasten: ["surdejsentusiasten.dk"], sundpaabudget: ["sundpaabudget.dk"],
      klinksgaard: ["klinksgaard.dk"], madoghave: ["madoghave.dk"], netto: ["netto.dk"],
      madrejsen: ["madrejsen.dk"], tv2mad: ["livsstil.tv2.dk"],
      kikkoman: ["kikkoman.dk"], gamleopskrifter: ["gamleopskrifter.com"],
    });
    expect(legacyMongoQueryFor(["arla", "coop"])).toEqual({
      source_site: { $in: ["arla.dk", "opskrifter.coop.dk"] },
    });
    expect(legacyRecipeSourceId("arla.dk")).toBe("arla");
    expect(legacyRecipeSourceId("opskrifter.coop.dk")).toBe("coop");
  });

  it("rejects capped or incomplete Crawlee evidence instead of treating missing counters as zero", async () => {
    await expect(executeMigrationComparison(
      {
        legacyDatabase: "scrapy_shadow",
        crawleeDatabase: "crawlee_shadow",
        sourceIds: ["arla"],
        scrapyEvidencePath: "scrapy.json",
        crawleeEvidencePath: "crawlee.json",
      },
      {
        readLegacy: async () => [],
        readCrawlee: async () => [],
        readScrapyEvidence: async () => completeScrapyEvidence(["arla"]),
        readCrawleeEvidence: async () => ({
          database: "crawlee_shadow", selectedSources: ["arla"], maxPages: 1,
          summary: { sourceOutcomes: [{ sourceId: "arla", outcome: "succeeded" }] },
          observations: [{ sourceId: "arla", discoveryComplete: true }],
        }),
        output: () => undefined,
      }
    )).rejects.toThrow("Crawlee evidence must be uncapped");
  });

  it("rejects missing Scrapy terminal results and malformed Crawlee observations", async () => {
    const options = {
      legacyDatabase: "scrapy_shadow", crawleeDatabase: "crawlee_shadow", sourceIds: ["arla"],
      scrapyEvidencePath: "scrapy.json", crawleeEvidencePath: "crawlee.json",
    };
    const dependencies = {
      readLegacy: async () => [], readCrawlee: async () => [], output: () => undefined,
      readScrapyEvidence: async () => ({ selected_spiders: ["arla"], processing_mode: "full", results: [] }),
      readCrawleeEvidence: async () => completeCrawleeEvidence(["arla"]),
    };
    await expect(executeMigrationComparison(options, dependencies)).rejects
      .toThrow("Scrapy evidence must contain one terminal result per selected source");
    await expect(executeMigrationComparison(options, {
      ...dependencies,
      readScrapyEvidence: async () => completeScrapyEvidence(["arla"]),
      readCrawleeEvidence: async () => ({ ...completeCrawleeEvidence(["arla"]), observations: [{
        sourceId: "arla", discoveryComplete: true, pageCapReached: false, mongoFailures: 0,
        rejectedIncompleteJsonLd: 0, rejectedMalformedJsonLd: 0,
      }] }),
    })).rejects.toThrow("missing or malformed unintendedOffDomainAdmissions");
  });

  it("fails closed on missing, malformed, or non-empty terminal outcome reasons", async () => {
    const options = {
      legacyDatabase: "scrapy_shadow", crawleeDatabase: "crawlee_shadow", sourceIds: ["arla"],
      scrapyEvidencePath: "scrapy.json", crawleeEvidencePath: "crawlee.json",
    };
    const base = {
      readLegacy: async () => [], readCrawlee: async () => [], output: () => undefined,
      readScrapyEvidence: async () => completeScrapyEvidence(["arla"]),
      readCrawleeEvidence: async () => completeCrawleeEvidence(["arla"]),
    };
    const scrapyMissing = completeScrapyEvidence(["arla"]);
    delete (scrapyMissing.results[0] as Record<string, unknown>).outcome_reasons;
    await expect(executeMigrationComparison(options, {
      ...base, readScrapyEvidence: async () => scrapyMissing,
    })).rejects.toThrow("missing or malformed outcome_reasons");
    const scrapyWrongType = completeScrapyEvidence(["arla"]);
    (scrapyWrongType.results[0] as Record<string, unknown>).outcome_reasons = "none";
    await expect(executeMigrationComparison(options, {
      ...base, readScrapyEvidence: async () => scrapyWrongType,
    })).rejects.toThrow("missing or malformed outcome_reasons");
    const scrapyNonEmpty = completeScrapyEvidence(["arla"]);
    (scrapyNonEmpty.results[0] as Record<string, unknown>).outcome_reasons = ["recoverable-error"];
    await expect(executeMigrationComparison(options, {
      ...base, readScrapyEvidence: async () => scrapyNonEmpty,
    })).rejects.toThrow("has outcome reasons");

    const crawleeMissing = completeCrawleeEvidence(["arla"]);
    delete (crawleeMissing.summary.sourceOutcomes[0] as Record<string, unknown>).outcomeReasons;
    await expect(executeMigrationComparison(options, {
      ...base, readCrawleeEvidence: async () => crawleeMissing,
    })).rejects.toThrow("missing or malformed outcomeReasons");
    const crawleeWrongType = completeCrawleeEvidence(["arla"]);
    (crawleeWrongType.summary.sourceOutcomes[0] as Record<string, unknown>).outcomeReasons = "none";
    await expect(executeMigrationComparison(options, {
      ...base, readCrawleeEvidence: async () => crawleeWrongType,
    })).rejects.toThrow("missing or malformed outcomeReasons");
    const crawleeNonEmpty = completeCrawleeEvidence(["arla"]);
    (crawleeNonEmpty.summary.sourceOutcomes[0] as Record<string, unknown>).outcomeReasons = ["recipes-persisted"];
    await expect(executeMigrationComparison(options, {
      ...base, readCrawleeEvidence: async () => crawleeNonEmpty,
    })).rejects.toThrow("has outcome reasons");
  });

  it("returns machine-readable comparison evidence from injected read-only inputs", async () => {
    const output: string[] = [];
    const report = await executeMigrationComparison(
      {
        legacyDatabase: "scrapy_shadow",
        crawleeDatabase: "crawlee_shadow",
        sourceIds: ["arla"],
        scrapyEvidencePath: "scrapy.json",
        crawleeEvidencePath: "crawlee.json",
      },
      {
        readLegacy: async (database, sourceIds) => {
          expect(database).toBe("scrapy_shadow");
          expect(sourceIds).toEqual(["arla"]);
          return [{
            sourceId: "arla",
            canonicalUrl: "https://arla.dk/opskrifter/kage",
            ...requiredNormalizedRecipe,
          }];
        },
        readCrawlee: async (database, sourceIds) => {
          expect(database).toBe("crawlee_shadow");
          expect(sourceIds).toEqual(["arla"]);
          return [{
            sourceId: "arla",
            canonicalUrl: "https://arla.dk/opskrifter/kage",
            normalized: requiredNormalizedRecipe,
          }];
        },
        readScrapyEvidence: async () => completeScrapyEvidence(["arla"]),
        readCrawleeEvidence: async () => completeCrawleeEvidence(["arla"]),
        output: (line) => output.push(line),
      }
    );

    expect(report.aggregate.passed).toBe(true);
    expect(JSON.parse(output[0])).toMatchObject({
      legacyDatabase: "scrapy_shadow",
      crawleeDatabase: "crawlee_shadow",
      sourceIds: ["arla"],
      aggregate: { passed: true },
    });
  });

  it("passes a source only when URL coverage, required fields, Mongo health, and domain admission gates all pass", () => {
    const legacy = Array.from({ length: 20 }, (_, index) => ({
      sourceId: "arla",
      canonicalUrl: `https://arla.dk/opskrifter/${index + 1}`,
      ...requiredNormalizedRecipe,
    }));
    const crawlee = legacy.slice(0, 19).map((recipe) => ({
      sourceId: recipe.sourceId,
      canonicalUrl: recipe.canonicalUrl,
      normalized: requiredNormalizedRecipe,
    }));

    const report = createMigrationComparisonReport({
      sourceIds: ["arla"],
      legacy,
      crawlee,
      observations: [{ sourceId: "arla", mongoFailures: 0 }],
    });

    expect(report.aggregate).toMatchObject({
      legacyUrlCount: 20,
      crawleeUrlCount: 19,
      intersectionUrlCount: 19,
      urlCoverage: 0.95,
      requiredFieldPresenceAgreement: 1,
      missingCrawleeRequiredFields: 0,
      mongoErrors: 0,
      unintendedOffDomainAdmissions: 0,
      passed: true,
    });
    expect(report.sources).toEqual([
      expect.objectContaining({ sourceId: "arla", passed: true }),
    ]);
  });

  it("fails the aggregate when an intersection is missing a Crawlee field, Mongo records an error, or Crawlee persists an off-domain URL", () => {
    const report = createMigrationComparisonReport({
      sourceIds: ["coop"],
      legacy: [{
        sourceId: "coop",
        canonicalUrl: "https://opskrifter.coop.dk/opskrifter/kage",
        ...requiredNormalizedRecipe,
      }],
      crawlee: [{
        sourceId: "coop",
        canonicalUrl: "https://not-coop.example/opskrifter/kage",
        normalized: { ...requiredNormalizedRecipe, title: "" },
      }, {
        sourceId: "coop",
        canonicalUrl: "https://opskrifter.coop.dk/opskrifter/kage",
        normalized: { ...requiredNormalizedRecipe, title: "" },
      }],
      observations: [{ sourceId: "coop", mongoFailures: 1, unintendedOffDomainAdmissions: 1 }],
    });

    expect(report.sources[0]).toMatchObject({
      sourceId: "coop",
      urlCoverage: 1,
      requiredFieldPresenceAgreement: 2 / 3,
      missingCrawleeRequiredFields: 1,
      mongoErrors: 1,
      unintendedOffDomainAdmissions: 1,
      passed: false,
    });
    expect(report.aggregate.passed).toBe(false);
  });

  it("fails an otherwise matching source when an off-domain request was admitted without being persisted", () => {
    const report = createMigrationComparisonReport({
      sourceIds: ["arla"],
      legacy: [{
        sourceId: "arla",
        canonicalUrl: "https://arla.dk/opskrifter/kage",
        ...requiredNormalizedRecipe,
      }],
      crawlee: [{
        sourceId: "arla",
        canonicalUrl: "https://arla.dk/opskrifter/kage",
        normalized: requiredNormalizedRecipe,
      }],
      observations: [{ sourceId: "arla", mongoFailures: 0, unintendedOffDomainAdmissions: 1 }],
    });

    expect(report.sources[0]).toMatchObject({
      unintendedOffDomainAdmissions: 1,
      passed: false,
    });
  });

  it("closes both Mongo clients if one connection fails and returns a failing process code", async () => {
    const calls: string[] = [];
    const first = { connect: async () => { calls.push("first-connect"); }, close: async () => { calls.push("first-close"); } };
    const second = { connect: async () => { calls.push("second-connect"); throw new Error("unavailable"); }, close: async () => { calls.push("second-close"); } };
    await expect(withComparisonClients([first, second], async () => undefined)).rejects.toThrow("unavailable");
    expect(calls).toEqual(expect.arrayContaining(["first-close", "second-close"]));
    expect(migrationComparisonExitCode({ sources: [], aggregate: {
      legacyUrlCount: 1, crawleeUrlCount: 0, intersectionUrlCount: 0,
      requiredFieldPresenceChecks: 0, requiredFieldPresenceAgreements: 0,
      requiredFieldPresenceAgreement: 0, missingCrawleeRequiredFields: 0,
      mongoErrors: 0, unintendedOffDomainAdmissions: 0, urlCoverage: 0, passed: false,
    } })).toBe(2);
  });

  it("writes the failing JSON report before setting the nonzero CLI exit code", async () => {
    const order: string[] = [];
    const client = { connect: async () => undefined, close: async () => undefined };
    await runMigrationComparisonCli({
      options: {
        legacyDatabase: "scrapy_shadow", crawleeDatabase: "crawlee_shadow", sourceIds: ["arla"],
        scrapyEvidencePath: "scrapy.json", crawleeEvidencePath: "crawlee.json",
      },
      clients: [client, client],
      dependencies: {
        readLegacy: async () => [], readCrawlee: async () => [],
        readScrapyEvidence: async () => completeScrapyEvidence(["arla"]),
        readCrawleeEvidence: async () => completeCrawleeEvidence(["arla"]),
        output: () => { order.push("json-output"); },
      },
      setExitCode: (code) => { order.push(`exit-${code}`); },
    });
    expect(order).toEqual(["json-output", "exit-2"]);
  });
});
