import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { CheerioCrawler, Configuration } from "crawlee";
import {
  DANISH_JSONLD_OBSERVED_HTTP_ERROR_STATUS_CODES,
  executeDanishJsonLdSource,
  runDanishJsonLdCrawl,
  type ExecuteDanishJsonLdSource,
} from "../../src/danish-jsonld/runner.js";
import { createDanishJsonLdCrawlSelection } from "../../src/danish-jsonld/source-selection.js";
import type { CrawlStore, RecipeDocumentV2Store } from "../../src/storage/store.js";
import type { DanishJsonLdSource } from "../../src/danish-jsonld/source-registry.js";

describe("dedicated Danish JSON-LD runner", () => {
  it("routes every blocked status through response diagnostics", () => {
    expect(DANISH_JSONLD_OBSERVED_HTTP_ERROR_STATUS_CODES).toEqual([
      401, 403, 429, 526,
    ]);
  });

  it.each([403, 526])(
    "delivers blocked HTTP %i response metadata and body to source diagnostics",
    async (statusCode) => {
      const configuration = Configuration.getGlobalConfig();
      const previousMemoryMbytes = configuration.get("memoryMbytes");
      configuration.set("memoryMbytes", 1_024);
      const body = `blocked fixture ${statusCode}`;
      const requestFunction = vi.spyOn(
        CheerioCrawler.prototype as unknown as {
          _requestFunction: () => Promise<unknown>;
        },
        "_requestFunction"
      ).mockImplementation(async () => Object.assign(Readable.from([body]), {
        statusCode,
        statusMessage: "Blocked fixture",
        headers: {
          "content-type": "text/html; charset=utf-8",
          "retry-after": "45",
          "cf-ray": "fixture-ray",
          server: "fixture-edge",
        },
        rawHeaders: [],
        trailers: {},
        rawTrailers: [],
        httpVersion: "1.1",
        httpVersionMajor: 1,
        httpVersionMinor: 1,
        complete: true,
        url: "https://fixture.invalid/listing",
      }));

      try {
        const url = "https://fixture.invalid/listing";
        const source: DanishJsonLdSource = {
          id: `blocked-${statusCode}`,
          domain: "fixture.invalid",
          allowedDomains: ["fixture.invalid"],
          legacySpider: "BlockedFixtureSpider",
          legacyFamily: "JsonLdListingSpider",
          discovery: "listing",
          sitemapUrls: [],
          startUrls: [url],
          recipeUrlPatterns: ["/opskrifter/"],
          fetchMode: "cheerio",
          requestSettings: {
            delaySeconds: 0,
            rateLimitPerMinute: null,
            maxConcurrency: 1,
            maxRetries: 0,
          },
          requireCompleteJsonLd: true,
          migrationState: "configured",
          latestScrapyOutcome: "not_audited",
        };
        const diagnostics: Array<{
          event: string;
          data: Record<string, unknown>;
        }> = [];

        const result = await executeDanishJsonLdSource({
          source,
          store: {} as CrawlStore & RecipeDocumentV2Store,
          crawlRunId: "blocked-run",
          crawlAttemptId: `blocked-${statusCode}-${randomUUID()}`,
          maxPages: 2,
          diagnosticSink: (event) => diagnostics.push(event),
        });

        expect(result.outcome).toEqual({
          sourceId: `blocked-${statusCode}`,
          outcome: "blocked",
          outcomeReasons: ["discovery-incomplete", "requests-blocked"],
        });
        expect(diagnostics).toContainEqual(
          expect.objectContaining({
            event: "http-response",
            data: expect.objectContaining({
              statusCode,
              retryAfter: "45",
              cfRay: "fixture-ray",
              server: "fixture-edge",
              snippet: `blocked fixture ${statusCode}`,
            }),
          })
        );
      } finally {
        requestFunction.mockRestore();
        configuration.set("memoryMbytes", previousMemoryMbytes);
      }
    }
  );

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

  it("bounds source diagnostics and source-failed with one shared event budget", async () => {
    const selection = createDanishJsonLdCrawlSelection({
      sourceIds: ["arla"],
      maxPages: 2,
      force: false,
      vpn: false,
    });
    const diagnostics: Array<{ event: string; data: Record<string, unknown> }> = [];

    await runDanishJsonLdCrawl({
      selection,
      store: {} as CrawlStore & RecipeDocumentV2Store,
      crawlRunId: "budget-run",
      executeSource: async (input) => {
        for (let index = 0; index < 1_005; index += 1) {
          input.diagnosticSink?.({ event: "fixture-event", data: { index } });
        }
        throw new Error("source failure after budget exhaustion");
      },
      diagnosticSink: (event) => diagnostics.push(event),
    });

    expect(diagnostics).toHaveLength(1_001);
    expect(diagnostics.slice(0, 1_000).every(
      (diagnostic) => diagnostic.event === "fixture-event"
    )).toBe(true);
    expect(diagnostics.at(-1)).toEqual({
      event: "diagnostic-budget-exhausted",
      data: { maxEvents: 1_000 },
    });
    expect(diagnostics.some((diagnostic) => diagnostic.event === "source-failed"))
      .toBe(false);
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
