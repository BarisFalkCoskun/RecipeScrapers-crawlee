import http from "node:http";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Configuration, RequestQueue } from "crawlee";
import { expect, it } from "vitest";
import { createDanishJsonLdCheerioCrawler, createDanishJsonLdPlaywrightCrawler } from "../../src/danish-jsonld/crawler-factories.js";
import { DanishJsonLdSiteSession } from "../../src/danish-jsonld/site-session.js";
import { DANISH_JSONLD_SOURCES } from "../../src/danish-jsonld/source-registry.js";

it("restores local storage and IndexedDB before page scripts, persists deletions, and uses the configured language on both transports", async () => {
  const headers: Array<{ path: string; language?: string; cookie?: string }> = [];
  const server = http.createServer((request, response) => {
    headers.push({ path: request.url!, language: request.headers["accept-language"], cookie: request.headers.cookie });
    response.setHeader("content-type", "text/html");
    response.end(`<html><body><script>
      window.ready = (async () => {
        const open = indexedDB.open('recipe-preferences', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('settings');
        const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
        const transaction = db.transaction('settings', 'readwrite');
        const store = transaction.objectStore('settings');
        const reading = store.get('units');
        const units = await new Promise((resolve, reject) => { reading.onsuccess = () => resolve(reading.result); reading.onerror = () => reject(reading.error); });
        window.observed = { local: localStorage.getItem('units'), units: units ?? null, language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
        if (location.pathname === '/seed') { localStorage.setItem('units', 'metric'); store.put('metric', 'units'); document.cookie = 'visitor=saved; Path=/'; }
        if (location.pathname === '/delete') { localStorage.removeItem('units'); store.delete('units'); document.cookie = 'visitor=; Max-Age=0; Path=/'; }
        await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
        db.close();
      })();
    </script></body></html>`);
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const directory = await mkdtemp(join(tmpdir(), "browser-state-integration-"));
  const source = { ...DANISH_JSONLD_SOURCES.find((s) => s.id === "bbcgoodfood")!,
    requestProfile: { locale: "en-GB", timezoneId: "Europe/London" },
    requestSettings: { delaySeconds: 0, maxRetries: 0, maxConcurrency: 1, rateLimitPerMinute: null } };
  const config = new Configuration({ persistStorage: false, purgeOnStart: false, storageClientOptions: { localDataDirectory: join(directory, "native") } });
  const queues: RequestQueue[] = [];
  const state = () => new DanishJsonLdSiteSession({ directory, identity: "fixture-en-GB", allowedDomains: ["127.0.0.1"] });
  const queue = async () => {
    const result = await RequestQueue.open(`browser-state-${randomUUID()}`, { config });
    queues.push(result); return result;
  };
  try {
    const render = async (path: string) => Configuration.storage.run(config, async () => {
      let observed: unknown;
      const crawler = createDanishJsonLdPlaywrightCrawler({ source, siteSession: state(),
        crawlerOptions: { requestQueue: await queue(), launchContext: { launchOptions: { headless: true } } },
        requestHandler: async ({ page }) => { await page.evaluate("window.ready"); observed = await page.evaluate("window.observed"); },
      });
      await crawler.run([`${base}${path}`]);
      return observed;
    });
    expect(await render("/seed")).toMatchObject({ local: null, units: null, language: "en-GB", timezone: "Europe/London" });
    await Configuration.storage.run(config, async () => {
      const httpCrawler = createDanishJsonLdCheerioCrawler({ source, siteSession: state(),
        crawlerOptions: { requestQueue: await queue() }, requestHandler: async () => {},
      });
      await httpCrawler.run([`${base}/http`]);
    });
    expect(headers.find((h) => h.path === "/http")).toMatchObject({ cookie: "visitor=saved", language: "en-GB,en;q=0.9" });
    expect(await render("/delete")).toMatchObject({ local: "metric", units: "metric" });
    expect(await render("/after-delete")).toMatchObject({ local: null, units: null });
    expect(headers.find((h) => h.path === "/after-delete")?.cookie).toBeUndefined();
    // Chromium may reduce Accept-Language to the primary locale. Both transports
    // must negotiate the configured locale; browser fallback weights are native.
    expect([...new Set(headers.filter((h) => ["/seed", "/delete", "/after-delete"].includes(h.path)).map((h) => h.language?.split(",")[0]))])
      .toEqual(["en-GB"]);
  } finally {
    await Promise.all(queues.map((q) => q.drop()));
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);
