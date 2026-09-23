import http from "node:http";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { Configuration, RequestQueue } from "crawlee";
import { describe, expect, it, vi } from "vitest";
import {
  createDanishJsonLdCheerioCrawler,
  createDanishJsonLdPlaywrightCrawler,
} from "../../src/danish-jsonld/crawler-factories.js";
import { DanishJsonLdSiteSession } from "../../src/danish-jsonld/site-session.js";
import { DANISH_JSONLD_SOURCES } from "../../src/danish-jsonld/source-registry.js";

describe("HTTP and browser session continuity", () => {
  it("shares cookies through redirects, rendered pages and late browser updates, then clears them on rotation", async () => {
    const observed = new Map<string, string>();
    const server = http.createServer((request, response) => {
      const path = request.url ?? "/";
      observed.set(path, request.headers.cookie ?? "");
      response.setHeader("content-type", "text/html");
      if (path === "/seed") response.setHeader("set-cookie", "visitor=seed; Path=/; HttpOnly");
      if (path === "/origin/redirect") {
        response.writeHead(302, { location: "/target/landing" });
        response.end();
        return;
      }
      if (path === "/target/landing") response.setHeader("set-cookie", "scoped=target");
      if (path === "/redirect") {
        response.writeHead(302, { location: "/landing", "set-cookie": "visitor=redirected; Path=/; HttpOnly" });
        response.end();
        return;
      }
      response.end("<html><body>local session fixture</body></html>");
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const source = {
      ...DANISH_JSONLD_SOURCES.find((entry) => entry.id === "arla")!,
      requestSettings: { maxConcurrency: 3, maxRetries: 0, delaySeconds: 0, rateLimitPerMinute: null },
    };
    const state = new DanishJsonLdSiteSession();
    const config = new Configuration({ persistStorage: false });
    const queues: RequestQueue[] = [];
    const queue = async () => {
      const result = await RequestQueue.open(`site-session-${randomUUID()}`, { config });
      queues.push(result);
      return result;
    };
    try {
      // Separate crawler instances exercise state surviving browser fallbacks
      // and restarts; it cannot accidentally pass through a crawler-local jar.
      const httpFetch = async (path: string) => {
        const crawler = createDanishJsonLdCheerioCrawler({
          source,
          siteSession: state,
          requestHandler: async () => {},
          crawlerOptions: { useSessionPool: false, requestQueue: await queue() },
        });
        await crawler.run([`${baseUrl}${path}`]);
      };
      await httpFetch("/origin/redirect");
      await httpFetch("/origin/check");
      expect(observed.get("/origin/check")).not.toContain("scoped=target");
      await httpFetch("/target/check");
      expect(observed.get("/target/check")).toContain("scoped=target");
      await httpFetch("/seed");
      await httpFetch("/redirect");
      expect(observed.get("/redirect")).toContain("visitor=seed");
      expect(observed.get("/landing")).toContain("visitor=redirected");

      const browser = createDanishJsonLdPlaywrightCrawler({
        source,
        siteSession: state,
        crawlerOptions: {
          useSessionPool: false,
          requestQueue: await queue(),
          launchContext: { launchOptions: { headless: true } },
        },
        requestHandler: async ({ page }) => {
          // Post-navigation capture alone would miss this late change.
          await page.evaluate("document.cookie = 'rendered=late; Path=/'");
        },
      });
      await browser.run([`${baseUrl}/browser`]);
      expect(observed.get("/browser")).toContain("visitor=redirected");
      await httpFetch("/after-browser");
      expect(observed.get("/after-browser")).toContain("rendered=late");
      expect(observed.get("/after-browser")).toContain("visitor=redirected");

      await state.reset("relay-rotated");
      await httpFetch("/after-rotation");
      expect(observed.get("/after-rotation")).toBe("");
    } finally {
      await Promise.all(queues.map((entry) => entry.drop()));
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 60_000);

  it("retains cookies received before a navigation error closes the page", async () => {
    const attempts: string[] = [];
    const server = http.createServer((request, response) => {
      const cookies = request.headers.cookie ?? "";
      if (request.url === "/retry") attempts.push(cookies);
      response.setHeader("content-type", "text/html");
      response.setHeader("set-cookie", "clearance=keep; Path=/; HttpOnly");
      response.end("<html><body>ready</body></html>");
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const source = {
      ...DANISH_JSONLD_SOURCES.find((entry) => entry.id === "arla")!,
      requestSettings: { maxConcurrency: 2, maxRetries: 1, delaySeconds: 0, rateLimitPerMinute: null },
    };
    const config = new Configuration({ persistStorage: false });
    const queue = await RequestQueue.open(`site-timeout-${randomUUID()}`, { config });
    let completed = 0;
    try {
      const crawler = createDanishJsonLdPlaywrightCrawler({
        source,
        siteSession: new DanishJsonLdSiteSession(),
        requestHandler: async () => { completed += 1; },
        crawlerOptions: {
          requestQueue: queue,
          useSessionPool: false,
          navigationTimeoutSecs: 1,
          launchContext: { launchOptions: { headless: true } },
          preNavigationHooks: [async ({ page, request }) => {
            if (request.retryCount !== 0) return;
            const navigate = page.goto.bind(page);
            // Simulate a navigation disconnect after response headers arrived.
            // Keep the real browser/context and Crawlee's error handling.
            vi.spyOn(page, "goto").mockImplementationOnce(async (...args) => {
              await navigate(...args);
              throw new Error("fixture navigation disconnected after headers");
            });
          }],
          errorHandler: async () => {},
        },
      });
      await crawler.run([`${baseUrl}/retry`]);
      expect(completed).toBe(1);
      expect(attempts).toEqual(["", "clearance=keep"]);
    } finally {
      await queue.drop();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 30_000);
});
