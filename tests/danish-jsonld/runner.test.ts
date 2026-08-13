import { describe, expect, it, vi } from "vitest";
import {
  DANISH_JSONLD_OBSERVED_HTTP_ERROR_STATUS_CODES,
  runDanishJsonLdCrawl,
  type ExecuteDanishJsonLdSource,
} from "../../src/danish-jsonld/runner.js";
import { createDanishJsonLdCrawlSelection } from "../../src/danish-jsonld/source-selection.js";
import type { CrawlStore, RecipeDocumentV2Store } from "../../src/storage/store.js";

describe("dedicated Danish JSON-LD runner", () => {
  it("routes every blocked status through response diagnostics", () => {
    expect(DANISH_JSONLD_OBSERVED_HTTP_ERROR_STATUS_CODES).toEqual([
      401, 403, 429, 526,
    ]);
  });

  it("executes every selected registry source and returns truthful source outcomes", async () => {
    const selection = createDanishJsonLdCrawlSelection({
      sourceIds: ["arla", "coop"],
      maxPages: 3,
      force: false,
      vpn: false,
    });
    const executeSource = vi.fn<ExecuteDanishJsonLdSource>(async (input) => ({
      observation: {
        sourceId: input.source.id,
        persistedRecipes: input.source.id === "arla" ? 1 : 0,
        completedRequests: 1,
        discoveryComplete: true,
      },
      outcome: {
        sourceId: input.source.id,
        outcome: input.source.id === "arla" ? "succeeded" : "no_data",
        outcomeReasons:
          input.source.id === "arla"
            ? ["recipes-persisted"]
            : ["no-recipe-candidates"],
      },
    }));

    const result = await runDanishJsonLdCrawl({
      selection,
      store: {} as CrawlStore & RecipeDocumentV2Store,
      crawlRunId: "run-1",
      executeSource,
    });

    expect(executeSource).toHaveBeenCalledTimes(2);
    expect(executeSource.mock.calls.map(([input]) => ({
      id: input.source.id,
      maxPages: input.maxPages,
      attempt: input.crawlAttemptId,
    }))).toEqual([
      { id: "arla", maxPages: 3, attempt: "run-1:arla" },
      { id: "coop", maxPages: 3, attempt: "run-1:coop" },
    ]);
    expect(result.summary).toEqual({
      robotsEnforced: "unknown",
      sourceOutcomes: [
        {
          sourceId: "arla",
          outcome: "succeeded",
          outcomeReasons: ["recipes-persisted"],
        },
        {
          sourceId: "coop",
          outcome: "no_data",
          outcomeReasons: ["no-recipe-candidates"],
        },
      ],
    });
  });

  it("isolates a source exception and continues later selected sources", async () => {
    const selection = createDanishJsonLdCrawlSelection({
      sourceIds: ["arla", "coop"],
      maxPages: 2,
      force: false,
      vpn: false,
    });
    const diagnostics: Array<{ event: string; data: Record<string, unknown> }> = [];
    const executeSource = vi.fn<ExecuteDanishJsonLdSource>(async (input) => {
      if (input.source.id === "arla") throw new Error("source fixture failure");
      return {
        observation: {
          sourceId: input.source.id,
          completedRequests: 1,
          discoveryComplete: true,
        },
        outcome: {
          sourceId: input.source.id,
          outcome: "no_data",
          outcomeReasons: ["no-recipe-candidates"],
        },
      };
    });

    const result = await runDanishJsonLdCrawl({
      selection,
      store: {} as CrawlStore & RecipeDocumentV2Store,
      crawlRunId: "run-1",
      executeSource,
      diagnosticSink: (event) => diagnostics.push(event),
    });

    expect(executeSource.mock.calls.map(([input]) => input.source.id)).toEqual([
      "arla",
      "coop",
    ]);
    expect(result.summary.sourceOutcomes).toEqual([
      {
        sourceId: "arla",
        outcome: "failed",
        outcomeReasons: ["discovery-incomplete", "failed-requests"],
      },
      {
        sourceId: "coop",
        outcome: "no_data",
        outcomeReasons: ["no-recipe-candidates"],
      },
    ]);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ event: "source-failed" })
    );
  });

  it("classifies an exception after persistence as partial", async () => {
    const selection = createDanishJsonLdCrawlSelection({
      sourceIds: ["arla"],
      maxPages: 2,
      force: false,
      vpn: false,
    });
    const error = Object.assign(new Error("late source failure"), {
      observation: {
        sourceId: "arla",
        persistedRecipes: 1,
        completedRequests: 1,
        discoveryComplete: true,
      },
    });

    const result = await runDanishJsonLdCrawl({
      selection,
      store: {} as CrawlStore & RecipeDocumentV2Store,
      crawlRunId: "run-1",
      executeSource: async () => { throw error; },
    });

    expect(result.summary.sourceOutcomes).toEqual([
      {
        sourceId: "arla",
        outcome: "partial",
        outcomeReasons: [
          "discovery-incomplete",
          "failed-requests",
          "recipes-persisted",
        ],
      },
    ]);
  });

  it("does not isolate a fatal store failure", async () => {
    const selection = createDanishJsonLdCrawlSelection({
      sourceIds: ["arla", "coop"],
      maxPages: 2,
      force: false,
      vpn: false,
    });
    const fatal = Object.assign(new Error("store unavailable"), {
      fatalScope: "store" as const,
    });
    const executeSource = vi.fn<ExecuteDanishJsonLdSource>(async () => {
      throw fatal;
    });

    await expect(
      runDanishJsonLdCrawl({
        selection,
        store: {} as CrawlStore & RecipeDocumentV2Store,
        crawlRunId: "run-1",
        executeSource,
      })
    ).rejects.toThrow("store unavailable");
    expect(executeSource).toHaveBeenCalledOnce();
  });
});
