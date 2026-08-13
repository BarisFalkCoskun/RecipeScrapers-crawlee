import { describe, expect, it } from "vitest";
import {
  createMigrationComparisonReport,
  executeMigrationComparison,
  parseMigrationComparisonArgs,
} from "../../src/danish-jsonld/migration-compare.js";

const requiredNormalizedRecipe = {
  title: "Kage",
  ingredients: ["1 æg"],
  instructions: [{ position: 1, text: "Bag." }],
};

describe("Danish JSON-LD shadow comparison", () => {
  it("requires both isolated database names and an explicit source cohort", () => {
    expect(
      parseMigrationComparisonArgs([
        "--legacy-db", "scrapy_shadow",
        "--crawlee-db", "crawlee_shadow",
        "--sources", "arla,coop",
        "--crawlee-evidence", "crawlee.json",
      ])
    ).toEqual({
      legacyDatabase: "scrapy_shadow",
      crawleeDatabase: "crawlee_shadow",
      sourceIds: ["arla", "coop"],
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

  it("returns machine-readable comparison evidence from injected read-only inputs", async () => {
    const output: string[] = [];
    const report = await executeMigrationComparison(
      {
        legacyDatabase: "scrapy_shadow",
        crawleeDatabase: "crawlee_shadow",
        sourceIds: ["arla"],
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
        readCrawleeAdmissions: async (database, sourceIds) => {
          expect(database).toBe("crawlee_shadow");
          expect(sourceIds).toEqual(["arla"]);
          return [{
            sourceId: "arla",
            canonicalUrl: "https://arla.dk/opskrifter/kage",
          }];
        },
        readCrawleeEvidence: async () => ({
          database: "crawlee_shadow",
          selectedSources: ["arla"],
          observations: [{ sourceId: "arla", mongoFailures: 0 }],
        }),
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
      admissions: crawlee,
      observations: [{ sourceId: "arla", mongoFailures: 0 }],
    });

    expect(report.aggregate).toMatchObject({
      legacyUrlCount: 20,
      crawleeUrlCount: 19,
      intersectionUrlCount: 19,
      urlCoverage: 0.95,
      requiredFieldAgreement: 1,
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
      admissions: [{
        sourceId: "coop",
        canonicalUrl: "https://not-coop.example/opskrifter/kage",
      }, {
        sourceId: "coop",
        canonicalUrl: "https://opskrifter.coop.dk/opskrifter/kage",
      }],
      observations: [{ sourceId: "coop", mongoFailures: 1 }],
    });

    expect(report.sources[0]).toMatchObject({
      sourceId: "coop",
      urlCoverage: 1,
      requiredFieldAgreement: 2 / 3,
      missingCrawleeRequiredFields: 1,
      mongoErrors: 1,
      unintendedOffDomainAdmissions: 1,
      passed: false,
    });
    expect(report.aggregate.passed).toBe(false);
  });

  it("fails an otherwise matching source when page admission evidence contains an off-domain URL", () => {
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
      observations: [{ sourceId: "arla", mongoFailures: 0 }],
      admissions: [{
        sourceId: "arla",
        canonicalUrl: "https://unrelated.example/opskrifter/kage",
      }],
    });

    expect(report.sources[0]).toMatchObject({
      unintendedOffDomainAdmissions: 1,
      passed: false,
    });
  });
});
