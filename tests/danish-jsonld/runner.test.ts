import { describe, expect, it, vi } from "vitest";
import {
  runDanishJsonLdCrawl,
  type ExecuteDanishJsonLdSource,
} from "../../src/danish-jsonld/runner.js";
import { createDanishJsonLdCrawlSelection } from "../../src/danish-jsonld/source-selection.js";
import type { CrawlStore, RecipeDocumentV2Store } from "../../src/storage/store.js";

describe("dedicated Danish JSON-LD runner", () => {
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
      robotsEnforced: false,
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
});
