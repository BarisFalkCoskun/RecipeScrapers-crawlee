import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { CheerioCrawler, Configuration, ProxyConfiguration, RequestQueue } from "crawlee";
import {
  DANISH_JSONLD_OBSERVED_HTTP_ERROR_STATUS_CODES,
  cleanupDanishJsonLdAttemptQueues,
  executeDanishJsonLdSource,
  parseHttpStatusForDiagnostics,
  httpErrorStatusCodesForSources,
  readSettledPageContent,
  shouldEscalateBrowserCheck,
  shouldRetryBrowserCheck,
  shouldRotateRelayOnFailure,
  BrowserCheckRetryError,
  runDanishJsonLdCrawl,
  type ExecuteDanishJsonLdSource,
} from "../../src/danish-jsonld/runner.js";
import { createDanishJsonLdCrawlSelection } from "../../src/danish-jsonld/source-selection.js";
import type { CrawlStore, RecipeDocumentV2Store } from "../../src/storage/store.js";
import type { DanishJsonLdSource } from "../../src/danish-jsonld/source-registry.js";
import type { DanishJsonLdVpnTransport } from "../../src/danish-jsonld/vpn-transport.js";

describe("dedicated Danish JSON-LD runner", () => {
  it("parses only contextual HTTP status codes from failures", () => {
    expect(parseHttpStatusForDiagnostics(
      new Error("Response code 429 (Too Many Requests)"),
      []
    )).toBe(429);
    expect(parseHttpStatusForDiagnostics(
      Object.assign(new Error("fixture socket failed"), {
        stack: "Error: fixture socket failed\n    at run (/srv/runner.ts:281:15)",
      }),
      []
    )).toBeUndefined();
  });

  it("tolerates HTTP 400 only for sources whose window ends in a terminal payload", () => {
    const plain = {
      id: "plain",
      listingDiscovery: { payload: { kind: "json-paths", expectedRoot: "array", recipePaths: ["[].url"] } },
    } as unknown as DanishJsonLdSource;
    const wpPosts = {
      id: "wp",
      listingDiscovery: {
        payload: {
          kind: "json-paths",
          expectedRoot: "array",
          recipePaths: ["[].link"],
          terminalPayload: { path: "code", equals: "rest_post_invalid_page_number" },
        },
      },
    } as unknown as DanishJsonLdSource;

    // A real 400 anywhere else must still register as a failed request.
    expect(httpErrorStatusCodesForSources([plain]))
      .toEqual([...DANISH_JSONLD_OBSERVED_HTTP_ERROR_STATUS_CODES]);
    expect(httpErrorStatusCodesForSources([wpPosts])).toContain(400);
    expect(httpErrorStatusCodesForSources([plain, wpPosts])).toContain(400);
  });

  it("retries a rendered browser check while retries remain, then accepts it", () => {
    // A real browser clears the challenge for the rest of the session, so the
    // first challenged page is worth re-requesting rather than losing.
    expect(shouldRetryBrowserCheck({ statusCode: 454, retryCount: 0, maxRetries: 3 }))
      .toBe(true);
    expect(shouldRetryBrowserCheck({ statusCode: 455, retryCount: 2, maxRetries: 3 }))
      .toBe(true);
    expect(shouldRetryBrowserCheck({ statusCode: 454, retryCount: 3, maxRetries: 3 }))
      .toBe(false);
  });

  it("escalates plain HTTP browser checks to Chromium only without a VPN", () => {
    expect(shouldEscalateBrowserCheck({
      statusCode: 454,
      fetchMode: "cheerio",
      vpnEnabled: false,
    })).toBe(true);
    expect(shouldEscalateBrowserCheck({
      statusCode: 455,
      fetchMode: "cheerio",
      vpnEnabled: false,
    })).toBe(true);
    expect(shouldEscalateBrowserCheck({
      statusCode: 454,
      fetchMode: "playwright",
      vpnEnabled: false,
    })).toBe(false);
    expect(shouldEscalateBrowserCheck({
      statusCode: 454,
      fetchMode: "cheerio",
      vpnEnabled: true,
    })).toBe(false);
    expect(shouldEscalateBrowserCheck({
      statusCode: 403,
      fetchMode: "cheerio",
      vpnEnabled: false,
    })).toBe(false);
  });

  it("waits for a WAF interstitial to replace itself with the real page", async () => {
    const challenge = readFileSync(
      new URL("../fixtures/simply-waf-browser-check.html", import.meta.url),
      "utf-8"
    );
    const real = "<html><body><article><a class=\"entry-title-link\" href=\"/kage\">Kage</a>"
      + "</article></body></html>";
    // The simply.com challenge resolves after about three seconds; reading the
    // moment navigation settles captures the interstitial instead of the page.
    let reads = 0;
    const page = {
      content: async () => (reads++ < 3 ? challenge : real),
      waitForTimeout: async () => {},
    };

    const result = await readSettledPageContent(page, { timeoutMs: 5_000, pollMs: 500 });

    expect(result.clearedBrowserCheck).toBe(true);
    expect(result.body).toBe(real);
  });

  it("gives up on an interstitial that never clears, and never waits on a normal page", async () => {
    const challenge = readFileSync(
      new URL("../fixtures/simply-waf-browser-check.html", import.meta.url),
      "utf-8"
    );
    let waits = 0;
    const stuck = {
      content: async () => challenge,
      waitForTimeout: async () => { waits += 1; },
    };

    const gaveUp = await readSettledPageContent(stuck, { timeoutMs: 1_500, pollMs: 500 });

    expect(gaveUp.clearedBrowserCheck).toBe(false);
    expect(gaveUp.body).toBe(challenge);
    expect(waits).toBe(3);

    // An ordinary page never enters the loop, so the wait costs nothing.
    let ordinaryWaits = 0;
    const ordinary = {
      content: async () => "<html><body><h1>Opskrifter</h1></body></html>",
      waitForTimeout: async () => { ordinaryWaits += 1; },
    };
    const straight = await readSettledPageContent(ordinary);

    expect(straight.clearedBrowserCheck).toBe(false);
    expect(ordinaryWaits).toBe(0);
  });

  it("treats a WAF challenge served under a 5xx status as a browser check", () => {
    // simply.com alternates between 454 and 500 for the same interstitial, so
    // the status alone cannot separate a challenge from a server error.
    const challenge = readFileSync(
      new URL("../fixtures/simply-waf-browser-check.html", import.meta.url),
      "utf-8"
    );

    expect(shouldRetryBrowserCheck({
      statusCode: 500,
      retryCount: 0,
      maxRetries: 3,
      body: challenge,
    })).toBe(true);
    expect(shouldEscalateBrowserCheck({
      statusCode: 500,
      fetchMode: "cheerio",
      vpnEnabled: false,
      body: challenge,
    })).toBe(true);
    // The retry budget still bounds it, so a challenge cannot loop forever.
    expect(shouldRetryBrowserCheck({
      statusCode: 500,
      retryCount: 3,
      maxRetries: 3,
      body: challenge,
    })).toBe(false);
  });

  it("leaves a genuine server error a failure rather than a browser check", () => {
    const wpFatal = "<!DOCTYPE html><html><head><title>Error</title></head><body>"
      + "<p>There has been a critical error on this website.</p></body></html>";

    expect(shouldRetryBrowserCheck({
      statusCode: 500,
      retryCount: 0,
      maxRetries: 3,
      body: wpFatal,
    })).toBe(false);
    expect(shouldEscalateBrowserCheck({
      statusCode: 500,
      fetchMode: "cheerio",
      vpnEnabled: false,
      body: wpFatal,
    })).toBe(false);
    // Without a body there is nothing to distinguish it, so it stays a failure.
    expect(shouldRetryBrowserCheck({ statusCode: 500, retryCount: 0, maxRetries: 3 }))
      .toBe(false);
    // A 4xx that is not a declared challenge status stays a failure too.
    expect(shouldRetryBrowserCheck({
      statusCode: 404,
      retryCount: 0,
      maxRetries: 3,
      body: wpFatal,
    })).toBe(false);
  });

  it("keeps the relay across a browser-check retry and rotates for anything else", () => {
    // The browser clears the challenge for its own session, so rotating to a
    // fresh relay would discard that and spend the pool on every challenge.
    expect(shouldRotateRelayOnFailure(new BrowserCheckRetryError(454))).toBe(false);
    expect(shouldRotateRelayOnFailure(new Error("net::ERR_CONNECTION_RESET")))
      .toBe(true);
  });

  it("never retries a non-browser-check status as a browser check", () => {
    for (const statusCode of [200, 401, 403, 429, 500, 526]) {
      expect(shouldRetryBrowserCheck({ statusCode, retryCount: 0, maxRetries: 3 }))
        .toBe(false);
    }
  });

  it("waits out Crawlee's same-domain reclaim window before dropping attempt queues", async () => {
    let releaseGracePeriod: (() => void) | undefined;
    const sleep = vi.fn(() => new Promise<void>((resolve) => {
      releaseGracePeriod = resolve;
    }));
    const cheerioDrop = vi.fn(async () => undefined);
    const playwrightDrop = vi.fn(async () => undefined);
    const diagnostics: Array<{ event: string; data: Record<string, unknown> }> = [];

    const cleanup = cleanupDanishJsonLdAttemptQueues({
      queues: [
        { kind: "cheerio", queue: { drop: cheerioDrop } },
        { kind: "playwright", queue: { drop: playwrightDrop } },
      ],
      sameDomainDelaySecs: 3,
      sourceId: "queue-race-fixture",
      crawlRunId: "queue-race-run",
      crawlAttemptId: "queue-race-attempt",
      diagnosticSink: (event) => diagnostics.push(event),
      sleep,
    });

    await vi.waitFor(() => expect(sleep).toHaveBeenCalledWith(3_100));
    expect(cheerioDrop).not.toHaveBeenCalled();
    expect(playwrightDrop).not.toHaveBeenCalled();

    releaseGracePeriod?.();
    await cleanup;

    expect(cheerioDrop).toHaveBeenCalledOnce();
    expect(playwrightDrop).toHaveBeenCalledOnce();
    expect(diagnostics).toContainEqual({
      event: "queue-cleanup-grace",
      data: {
        sourceId: "queue-race-fixture",
        crawlRunId: "queue-race-run",
        crawlAttemptId: "queue-race-attempt",
        reclaimGraceMillis: 3_100,
      },
    });
  });

  it("drops both dedicated attempt queues and reports a drop failure without replacing the source outcome", async () => {
    const originalDrop = RequestQueue.prototype.drop;
    let drops = 0;
    const drop = vi.spyOn(RequestQueue.prototype, "drop").mockImplementation(async function () {
      const dropNumber = ++drops;
      await originalDrop.call(this);
      if (dropNumber === 1) throw new Error("fixture queue drop failed");
    });
    const diagnostics: Array<{ event: string; data: Record<string, unknown> }> = [];
    const source: DanishJsonLdSource = {
      id: "queue-cleanup-fixture", domain: "fixture.invalid", allowedDomains: ["fixture.invalid"],
      legacySpider: "QueueCleanupFixtureSpider", legacyFamily: "JsonLdListingSpider",
      discovery: "listing", sitemapUrls: [], startUrls: [], recipeUrlPatterns: ["/opskrifter/"],
      fetchMode: "cheerio",
      requestSettings: { delaySeconds: 0, rateLimitPerMinute: null, maxConcurrency: 1, maxRetries: 0 },
      requireCompleteJsonLd: true, migrationState: "configured", latestScrapyOutcome: "not_audited",
    };

    try {
      const result = await executeDanishJsonLdSource({
        source,
        store: {} as CrawlStore & RecipeDocumentV2Store,
        crawlRunId: "queue-cleanup-run",
        crawlAttemptId: `queue-cleanup-${randomUUID()}`,
        maxPages: 5,
        diagnosticSink: (event) => diagnostics.push(event),
      });

      expect(drop).toHaveBeenCalledTimes(2);
      expect(result.outcome).toEqual({
        sourceId: "queue-cleanup-fixture",
        outcome: "no_data",
        outcomeReasons: ["no-recipe-candidates"],
      });
      expect(diagnostics).toContainEqual(expect.objectContaining({
        event: "queue-cleanup-failed",
        data: expect.objectContaining({
          queue: "cheerio",
          error: "fixture queue drop failed",
        }),
      }));
    } finally {
      drop.mockRestore();
    }
  });

  it("routes every blocked status through response diagnostics", () => {
    expect(DANISH_JSONLD_OBSERVED_HTTP_ERROR_STATUS_CODES).toEqual([
      401, 403, 429, 454, 455, 526,
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
      const result = await executeDanishJsonLdSource({
        source,
        store: {} as CrawlStore & RecipeDocumentV2Store,
        crawlRunId: "rotation-run",
        crawlAttemptId: `rotation-${randomUUID()}`,
        maxPages: 5,
        vpnTransport,
        diagnosticSink: (event) => diagnostics.push(event),
      });

      expect(result.outcome).toEqual({
        sourceId: "rotation-fixture",
        outcome: "no_data",
        outcomeReasons: ["no-recipe-candidates"],
      });
      expect(result.observation.blockedRequests).toBe(0);
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
    const transportError = Object.assign(new Error("fixture socket failed"), {
      code: "ECONNRESET",
    });
    transportError.stack = [
      "Error: fixture socket failed",
      "    at executeRequest (/srv/recipe/runner.ts:281:15)",
    ].join("\n");
    const requestFunction = vi.spyOn(
      CheerioCrawler.prototype as unknown as {
        _requestFunction: () => Promise<unknown>;
      },
      "_requestFunction"
    ).mockRejectedValue(transportError);
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
    const diagnostics: Array<{ event: string; data: Record<string, unknown> }> = [];
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
        diagnosticSink: (event) => diagnostics.push(event),
      });

      expect(requestFunction).toHaveBeenCalledOnce();
      expect(release).toHaveBeenCalledOnce();
      expect(diagnostics).toContainEqual(expect.objectContaining({
        event: "request-failed",
        data: expect.objectContaining({ statusCode: "undefined" }),
      }));
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
      robotsEnforced: false,
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
