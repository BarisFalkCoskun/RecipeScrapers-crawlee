import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { CheerioCrawler, Configuration, ProxyConfiguration } from "crawlee";
import {
  DANISH_JSONLD_OBSERVED_HTTP_ERROR_STATUS_CODES,
  executeDanishJsonLdSource,
  runDanishJsonLdCrawl,
  type ExecuteDanishJsonLdSource,
} from "../../src/danish-jsonld/runner.js";
import { createDanishJsonLdCrawlSelection } from "../../src/danish-jsonld/source-selection.js";
import type { CrawlStore, RecipeDocumentV2Store } from "../../src/storage/store.js";
import type { DanishJsonLdSource } from "../../src/danish-jsonld/source-registry.js";
import type { DanishJsonLdVpnTransport } from "../../src/danish-jsonld/vpn-transport.js";

describe("dedicated Danish JSON-LD runner", () => {
  it("routes every blocked status through response diagnostics", () => {
    expect(DANISH_JSONLD_OBSERVED_HTTP_ERROR_STATUS_CODES).toEqual([
      401, 403, 429, 526,
    ]);
  });

  it("counts an off-domain URL only after the runner admits it to a request queue", async () => {
    const configuration = Configuration.getGlobalConfig();
    const previousMemoryMbytes = configuration.get("memoryMbytes");
    configuration.set("memoryMbytes", 1_024);
    const requestFunction = vi.spyOn(
      CheerioCrawler.prototype as unknown as { _requestFunction: () => Promise<unknown> },
      "_requestFunction"
    ).mockImplementation(async () => Object.assign(Readable.from(["<html></html>"]), {
      statusCode: 200, statusMessage: "OK", headers: { "content-type": "text/html" },
      rawHeaders: [], trailers: {}, rawTrailers: {}, httpVersion: "1.1",
      httpVersionMajor: 1, httpVersionMinor: 1, complete: true,
      url: "https://outside.example/listing",
    }));
    const diagnostics: Array<{ event: string; data: Record<string, unknown> }> = [];
    const source: DanishJsonLdSource = {
      id: "admission-fixture", domain: "fixture.invalid", allowedDomains: ["fixture.invalid"],
      legacySpider: "AdmissionFixtureSpider", legacyFamily: "JsonLdListingSpider",
      discovery: "listing", sitemapUrls: [], startUrls: ["https://outside.example/listing"],
      recipeUrlPatterns: ["/opskrifter/"], fetchMode: "cheerio",
      requestSettings: { delaySeconds: 0, rateLimitPerMinute: null, maxConcurrency: 1, maxRetries: 0 },
      requireCompleteJsonLd: true, migrationState: "configured", latestScrapyOutcome: "not_audited",
    };
    try {
      const result = await executeDanishJsonLdSource({
        source, store: {} as CrawlStore & RecipeDocumentV2Store, crawlRunId: "admission-run",
        crawlAttemptId: `admission-${randomUUID()}`, maxPages: 2,
        diagnosticSink: (event) => diagnostics.push(event),
      });
      expect(result.observation.unintendedOffDomainAdmissions).toBe(1);
      expect(diagnostics).toContainEqual(expect.objectContaining({
        event: "off-domain-admission", data: expect.objectContaining({ hostname: "outside.example" }),
      }));
    } finally {
      requestFunction.mockRestore();
      configuration.set("memoryMbytes", previousMemoryMbytes);
    }
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

  it("preserves blocked response diagnostics before retrying on a rotated relay", async () => {
    const configuration = Configuration.getGlobalConfig();
    const previousMemoryMbytes = configuration.get("memoryMbytes");
    configuration.set("memoryMbytes", 1_024);
    const statuses = [403, 200];
    const requestFunction = vi.spyOn(
      CheerioCrawler.prototype as unknown as {
        _requestFunction: () => Promise<unknown>;
      },
      "_requestFunction"
    ).mockImplementation(async () => {
      const statusCode = statuses.shift() ?? 200;
      const body = statusCode === 403 ? "access denied fixture" : "<html></html>";
      return Object.assign(Readable.from([body]), {
        statusCode,
        statusMessage: "Fixture",
        headers: { "content-type": "text/html; charset=utf-8" },
        rawHeaders: [],
        trailers: {},
        rawTrailers: [],
        httpVersion: "1.1",
        httpVersionMajor: 1,
        httpVersionMinor: 1,
        complete: true,
        url: "https://fixture.invalid/listing",
      });
    });
    const handleResponse = vi.fn(async (input: { statusCode: number }) =>
      input.statusCode === 403
        ? { rotated: true, eligible: true, exhausted: false, reason: "http-403" }
        : { rotated: false, eligible: false, exhausted: false }
    );
    const handleFailure = vi.fn(async () => ({
      rotated: false,
      eligible: false,
      exhausted: false,
    }));
    const release = vi.fn(async () => undefined);
    const vpnTransport: DanishJsonLdVpnTransport = {
      proxyConfiguration: new ProxyConfiguration({
        newUrlFunction: async () => "http://127.0.0.1:4311",
      }),
      initialize: async () => undefined,
      cleanup: async () => undefined,
      handleResponse,
      handleFailure,
      release,
    };
    const diagnostics: Array<{ event: string; data: Record<string, unknown> }> = [];
    const source: DanishJsonLdSource = {
      id: "rotation-fixture",
      domain: "fixture.invalid",
      allowedDomains: ["fixture.invalid"],
      legacySpider: "RotationFixtureSpider",
      legacyFamily: "JsonLdListingSpider",
      discovery: "listing",
      sitemapUrls: [],
      startUrls: ["https://fixture.invalid/listing"],
      recipeUrlPatterns: ["/opskrifter/"],
      fetchMode: "cheerio",
      requestSettings: {
        delaySeconds: 0,
        rateLimitPerMinute: null,
        maxConcurrency: 1,
        maxRetries: 1,
      },
      requireCompleteJsonLd: true,
      migrationState: "configured",
      latestScrapyOutcome: "not_audited",
    };

    try {
      await executeDanishJsonLdSource({
        source,
        store: {} as CrawlStore & RecipeDocumentV2Store,
        crawlRunId: "rotation-run",
        crawlAttemptId: `rotation-${randomUUID()}`,
        maxPages: 5,
        vpnTransport,
        diagnosticSink: (event) => diagnostics.push(event),
      });

      expect(requestFunction).toHaveBeenCalledTimes(2);
      expect(handleResponse.mock.calls.map(([input]) => input.statusCode)).toEqual([403, 200]);
      expect(handleResponse.mock.calls[0][0].sessionId).toBe(
        handleResponse.mock.calls[1][0].sessionId
      );
      expect(handleFailure).toHaveBeenCalledOnce();
      expect(release).toHaveBeenCalledOnce();
      expect(release).toHaveBeenCalledWith(
        handleResponse.mock.calls[1][0].sessionId
      );
      expect(diagnostics).toContainEqual(expect.objectContaining({
        event: "http-response",
        data: expect.objectContaining({ statusCode: 403, snippet: "access denied fixture" }),
      }));
    } finally {
      requestFunction.mockRestore();
      configuration.set("memoryMbytes", previousMemoryMbytes);
    }
  });

  it("releases both handled and unprocessed request leases when the source cap stops the crawl", async () => {
    const configuration = Configuration.getGlobalConfig();
    const previousMemoryMbytes = configuration.get("memoryMbytes");
    configuration.set("memoryMbytes", 1_024);
    const requestFunction = vi.spyOn(
      CheerioCrawler.prototype as unknown as {
        _requestFunction: () => Promise<unknown>;
      },
      "_requestFunction"
    ).mockImplementation(async () => Object.assign(Readable.from(["<html></html>"]), {
      statusCode: 200,
      statusMessage: "OK",
      headers: { "content-type": "text/html; charset=utf-8" },
      rawHeaders: [],
      trailers: {},
      rawTrailers: [],
      httpVersion: "1.1",
      httpVersionMajor: 1,
      httpVersionMinor: 1,
      complete: true,
      url: "https://fixture.invalid/listing-a",
    }));
    const release = vi.fn(async () => undefined);
    const noRotation = async () => ({
      rotated: false,
      eligible: false,
      exhausted: false,
    });
    const vpnTransport: DanishJsonLdVpnTransport = {
      proxyConfiguration: new ProxyConfiguration({
        newUrlFunction: async () => "http://127.0.0.1:4312",
      }),
      initialize: async () => undefined,
      cleanup: async () => undefined,
      handleResponse: noRotation,
      handleFailure: noRotation,
      release,
    };
    const source: DanishJsonLdSource = {
      id: "cap-release-fixture",
      domain: "fixture.invalid",
      allowedDomains: ["fixture.invalid"],
      legacySpider: "CapReleaseFixtureSpider",
      legacyFamily: "JsonLdListingSpider",
      discovery: "listing",
      sitemapUrls: [],
      startUrls: [
        "https://fixture.invalid/listing-a",
        "https://fixture.invalid/listing-b",
      ],
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

    try {
      await executeDanishJsonLdSource({
        source,
        store: {} as CrawlStore & RecipeDocumentV2Store,
        crawlRunId: "cap-release-run",
        crawlAttemptId: `cap-release-${randomUUID()}`,
        maxPages: 1,
        vpnTransport,
      });

      expect(requestFunction).toHaveBeenCalledOnce();
      expect(release).toHaveBeenCalledTimes(2);
      expect(new Set(release.mock.calls.map(([sessionId]) => sessionId)).size).toBe(2);
    } finally {
      requestFunction.mockRestore();
      configuration.set("memoryMbytes", previousMemoryMbytes);
    }
  });

  it("releases the request lease after a terminal transport failure", async () => {
    const configuration = Configuration.getGlobalConfig();
    const previousMemoryMbytes = configuration.get("memoryMbytes");
    configuration.set("memoryMbytes", 1_024);
    const requestFunction = vi.spyOn(
      CheerioCrawler.prototype as unknown as {
        _requestFunction: () => Promise<unknown>;
      },
      "_requestFunction"
    ).mockRejectedValue(Object.assign(new Error("fixture socket failed"), {
      code: "ECONNRESET",
    }));
    const release = vi.fn(async () => undefined);
    const noRotation = async () => ({
      rotated: false,
      eligible: false,
      exhausted: false,
    });
    const vpnTransport: DanishJsonLdVpnTransport = {
      proxyConfiguration: new ProxyConfiguration({
        newUrlFunction: async () => "http://127.0.0.1:4313",
      }),
      initialize: async () => undefined,
      cleanup: async () => undefined,
      handleResponse: noRotation,
      handleFailure: noRotation,
      release,
    };
    const source: DanishJsonLdSource = {
      id: "terminal-release-fixture",
      domain: "fixture.invalid",
      allowedDomains: ["fixture.invalid"],
      legacySpider: "TerminalReleaseFixtureSpider",
      legacyFamily: "JsonLdListingSpider",
      discovery: "listing",
      sitemapUrls: [],
      startUrls: ["https://fixture.invalid/listing"],
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

    try {
      await executeDanishJsonLdSource({
        source,
        store: {} as CrawlStore & RecipeDocumentV2Store,
        crawlRunId: "terminal-release-run",
        crawlAttemptId: `terminal-release-${randomUUID()}`,
        maxPages: 3,
        vpnTransport,
      });

      expect(requestFunction).toHaveBeenCalledOnce();
      expect(release).toHaveBeenCalledOnce();
    } finally {
      requestFunction.mockRestore();
      configuration.set("memoryMbytes", previousMemoryMbytes);
    }
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
            ? []
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
          outcomeReasons: [],
        },
        {
          sourceId: "coop",
          outcome: "no_data",
          outcomeReasons: ["no-recipe-candidates"],
        },
      ],
    });
  });

  it("passes one initialized VPN transport through every selected source", async () => {
    const selection = createDanishJsonLdCrawlSelection({
      sourceIds: ["arla", "coop"],
      maxPages: 1,
      force: false,
      vpn: true,
    });
    const vpnTransport = { marker: "fixture-vpn" } as unknown as DanishJsonLdVpnTransport;
    const observedTransports: unknown[] = [];

    await runDanishJsonLdCrawl({
      selection,
      store: {} as CrawlStore & RecipeDocumentV2Store,
      crawlRunId: "vpn-run",
      vpnTransport,
      executeSource: async (input) => {
        observedTransports.push(input.vpnTransport);
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
      },
    });

    expect(observedTransports).toEqual([vpnTransport, vpnTransport]);
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
