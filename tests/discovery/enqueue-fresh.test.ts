import { describe, expect, it, vi } from "vitest";
import { CrawlMetrics } from "../../src/telemetry/crawl-metrics.js";
import {
  enqueueFreshRequestsFromSitemap,
  toRequestCandidate,
} from "../../src/discovery/enqueue-fresh.js";
import { REQUEST_LABELS } from "../../src/crawlers/request-routing.js";
import { MemoryCrawlStore } from "../helpers/memory-crawl-store.js";
import { LinkFilter } from "../../src/discovery/link-filter.js";

describe("enqueueFreshRequestsFromSitemap", () => {
  it("counts sitemap admissions toward queue accounting", async () => {
    const addedRequests = [
      {
        uniqueKey: "https://example.dk/opskrift/a",
        requestId: "1",
        wasAlreadyPresent: false,
        wasAlreadyHandled: false,
      },
      {
        uniqueKey: "https://example.dk/opskrift/b",
        requestId: "2",
        wasAlreadyPresent: false,
        wasAlreadyHandled: false,
      },
    ];
    const addRequestsBatched = vi.fn(async (requests: unknown[]) => ({
      addedRequests,
      waitForAllRequestsToBeAdded: Promise.resolve(addedRequests),
      unprocessedRequests: [],
    }));
    const recordEnqueued = vi.fn();

    async function* requestList() {
      yield { url: "https://example.dk/opskrift/a" };
      yield { url: "https://example.dk/opskrift/b" };
    }

    const result = await enqueueFreshRequestsFromSitemap({
      queue: { addRequestsBatched } as never,
      requestList: requestList(),
      store: new MemoryCrawlStore(),
      recrawlCutoff: new Date("2026-04-01T00:00:00.000Z"),
      metrics: new CrawlMetrics(["example.dk"]),
      fetchMode: "cheerio",
      linkFilter: { recordEnqueued, getQueueEligibility: new LinkFilter().getQueueEligibility.bind(new LinkFilter()) },
      seedRolesByDomain: new Map([["example.dk", "trusted"]]),
    });

    expect(result).toEqual({ enqueued: 2, skippedFresh: 0 });
    expect(recordEnqueued).toHaveBeenCalledWith([
      "https://example.dk/opskrift/a",
      "https://example.dk/opskrift/b",
    ]);
    expect(addRequestsBatched).toHaveBeenCalledOnce();
    expect(addRequestsBatched.mock.calls[0]?.[0]).toEqual([
      {
        url: "https://example.dk/opskrift/a",
        uniqueKey: "https://example.dk/opskrift/a",
        label: REQUEST_LABELS.sitemapPage,
        userData: {
          fromSitemap: true,
          seedDomain: "example.dk",
          isTrustedSource: true,
          discoverySource: "sitemap",
          admissionSignals: ["queue-eligible", "same-domain-trusted-seed"],
        },
      },
      {
        url: "https://example.dk/opskrift/b",
        uniqueKey: "https://example.dk/opskrift/b",
        label: REQUEST_LABELS.sitemapPage,
        userData: {
          fromSitemap: true,
          seedDomain: "example.dk",
          isTrustedSource: true,
          discoverySource: "sitemap",
          admissionSignals: ["queue-eligible", "same-domain-trusted-seed"],
        },
      },
    ]);
  });

  it("filters sitemap URLs through queue eligibility before enqueueing", async () => {
    const addedRequests = [
      {
        uniqueKey: "https://example.dk/opskrift/ok",
        requestId: "1",
        wasAlreadyPresent: false,
        wasAlreadyHandled: false,
      },
    ];
    const addRequestsBatched = vi.fn(async (requests: unknown[]) => ({
      addedRequests,
      waitForAllRequestsToBeAdded: Promise.resolve(addedRequests),
      unprocessedRequests: [],
    }));
    const linkFilter = new LinkFilter({
      maxPagesByDomain: new Map([["example.dk", 1]]),
    });
    const eligibilitySpy = vi.spyOn(linkFilter, "getQueueEligibility");
    const recordEnqueuedSpy = vi.spyOn(linkFilter, "recordEnqueued");
    const metrics = new CrawlMetrics(["example.dk"]);

    async function* requestList() {
      yield { url: "https://example.dk/opskrift/ok" };
      yield { url: "https://example.dk/search?q=blocked" };
    }

    const result = await enqueueFreshRequestsFromSitemap({
      queue: { addRequestsBatched } as never,
      requestList: requestList(),
      store: new MemoryCrawlStore(),
      recrawlCutoff: new Date("2026-04-01T00:00:00.000Z"),
      metrics,
      fetchMode: "cheerio",
      linkFilter,
      seedRolesByDomain: new Map([["example.dk", "trusted"]]),
    });

    expect(result).toEqual({ enqueued: 1, skippedFresh: 0 });
    expect(eligibilitySpy).toHaveBeenCalledTimes(2);
    expect(addRequestsBatched).toHaveBeenCalledWith(
      [
        {
          url: "https://example.dk/opskrift/ok",
          uniqueKey: "https://example.dk/opskrift/ok",
          label: REQUEST_LABELS.sitemapPage,
          userData: {
            fromSitemap: true,
            seedDomain: "example.dk",
            isTrustedSource: true,
            discoverySource: "sitemap",
            admissionSignals: ["queue-eligible", "same-domain-trusted-seed"],
          },
        },
      ],
      { waitForAllRequestsToBeAdded: true }
    );
    expect(recordEnqueuedSpy).toHaveBeenCalledWith([
      "https://example.dk/opskrift/ok",
    ]);
    expect(metrics.buildSummary().blockedUrlReasons).toEqual({
      "hard-denylist-pattern": 1,
    });
  });

  it("rejects non-http request candidates before they reach Crawlee queues", () => {
    expect(toRequestCandidate("mailto:test@example.dk")).toBeNull();
    expect(toRequestCandidate("tel:+4512345678")).toBeNull();
    expect(toRequestCandidate("javascript:void(0)")).toBeNull();
    expect(toRequestCandidate("https://example.dk/opskrift/kage")).toEqual({
      url: "https://example.dk/opskrift/kage",
      canonicalUrl: "https://example.dk/opskrift/kage",
      domain: "example.dk",
      anchorText: undefined,
    });
  });
});
