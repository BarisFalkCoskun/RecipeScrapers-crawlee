import { describe, expect, it } from "vitest";
import {
  classifySourceOutcome,
  createDanishJsonLdRunSummary,
} from "../../src/danish-jsonld/source-outcome.js";

describe("Danish JSON-LD source outcomes", () => {
  it.each([
    [
      "succeeded",
      { persistedRecipes: 1, completedRequests: 1, discoveryComplete: true },
      "succeeded",
      [],
    ],
    [
      "partial",
      {
        persistedRecipes: 1,
        completedRequests: 2,
        failedRequests: 1,
        discoveryComplete: true,
      },
      "partial",
      ["failed-requests", "recipes-persisted"],
    ],
    [
      "blocked",
      { blockedRequests: 1, completedRequests: 0, discoveryComplete: true },
      "blocked",
      ["requests-blocked"],
    ],
    [
      "no_data",
      { completedRequests: 3, discoveryComplete: true },
      "no_data",
      ["no-recipe-candidates"],
    ],
    [
      "failed",
      { completedRequests: 0, mongoFailures: 1, discoveryComplete: true },
      "failed",
      ["mongo-failure"],
    ],
    [
      "partial after a Mongo failure when recipes were persisted",
      { persistedRecipes: 1, mongoFailures: 1, discoveryComplete: true },
      "partial",
      ["mongo-failure", "recipes-persisted"],
    ],
    [
      "partial after access blocking when recipes were persisted",
      { persistedRecipes: 1, blockedRequests: 1, discoveryComplete: true },
      "partial",
      ["recipes-persisted", "requests-blocked"],
    ],
  ] as const)("classifies %s sources with stable reasons", (_name, observation, outcome, reasons) => {
    expect(classifySourceOutcome({ sourceId: "arla", ...observation })).toEqual({
      sourceId: "arla",
      outcome,
      outcomeReasons: reasons,
    });
  });

  it.each([
    ["failed request", { failedRequests: 1 }],
    ["recipe candidate", { discoveredRecipeCandidates: 1 }],
    ["rejected JSON-LD", { rejectedIncompleteJsonLd: 1 }],
    ["malformed JSON-LD", { rejectedMalformedJsonLd: 1 }],
    ["rejected WPRM recipe", { rejectedIncompleteWprm: 1 }],
    ["malformed WPRM recipe", { rejectedMalformedWprm: 1 }],
    ["rejected custom recipe", { rejectedIncompleteCustom: 1 }],
    ["malformed custom payload", { rejectedMalformedCustom: 1 }],
    ["Playwright failure", { playwrightFailures: 1 }],
    ["Mongo failure", { mongoFailures: 1 }],
    ["incomplete discovery", { discoveryComplete: false }],
  ])("does not misclassify zero-item %s sources as no_data", (_name, observation) => {
    expect(
      classifySourceOutcome({
        sourceId: "arla",
        persistedRecipes: 0,
        completedRequests: 1,
        discoveryComplete: true,
        ...observation,
      }).outcome
    ).not.toBe("no_data");
  });

  it("uses WPRM-specific reasons for direct API rejection evidence", () => {
    expect(classifySourceOutcome({
      sourceId: "gastrofun",
      persistedRecipes: 0,
      completedRequests: 1,
      rejectedIncompleteWprm: 2,
      rejectedMalformedWprm: 1,
      discoveryComplete: true,
    })).toEqual({
      sourceId: "gastrofun",
      outcome: "failed",
      outcomeReasons: ["incomplete-wprm-rejected", "malformed-wprm-rejected"],
    });
  });

  it("uses embedded-payload reasons for custom structured extraction evidence", () => {
    expect(classifySourceOutcome({
      sourceId: "spisbedre",
      persistedRecipes: 0,
      completedRequests: 1,
      rejectedIncompleteCustom: 2,
      rejectedMalformedCustom: 1,
      discoveryComplete: true,
    })).toEqual({
      sourceId: "spisbedre",
      outcome: "failed",
      outcomeReasons: [
        "incomplete-custom-recipe-rejected",
        "malformed-custom-payload-rejected",
      ],
    });
  });

  it("classifies malformed JSON-LD with no persisted recipes as failed", () => {
    expect(
      classifySourceOutcome({
        sourceId: "arla",
        persistedRecipes: 0,
        completedRequests: 1,
        rejectedMalformedJsonLd: 2,
        discoveryComplete: true,
      })
    ).toEqual({
      sourceId: "arla",
      outcome: "failed",
      outcomeReasons: ["malformed-json-ld-rejected"],
    });
  });

  it("reports structured extraction empty when discovered recipe pages yield no Recipe node", () => {
    expect(
      classifySourceOutcome({
        sourceId: "madrejsen",
        persistedRecipes: 0,
        completedRequests: 11,
        discoveredRecipeCandidates: 5,
        processedRecipePages: 10,
        discoveryComplete: true,
      })
    ).toEqual({
      sourceId: "madrejsen",
      outcome: "failed",
      outcomeReasons: [
        "recipe-candidates-discovered",
        "structured-extraction-empty",
      ],
    });
  });

  it("marks every V2 run summary as robots unenforced", () => {
    expect(
      createDanishJsonLdRunSummary([
        classifySourceOutcome({
          sourceId: "arla",
          persistedRecipes: 0,
          completedRequests: 1,
          discoveryComplete: true,
        }),
      ])
    ).toEqual({
      robotsEnforced: false,
      sourceOutcomes: [
        {
          sourceId: "arla",
          outcome: "no_data",
          outcomeReasons: ["no-recipe-candidates"],
        },
      ],
    });
  });
});
