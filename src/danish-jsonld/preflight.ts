import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { MongoClient } from "mongodb";
import { chromium } from "playwright";
import type { DanishJsonLdSource } from "./source-registry.js";
import { requestProfileFor } from "./request-profile.js";
import { sourceWebsiteHosts } from "./website-lock.js";

export interface PreflightInput {
  sources: DanishJsonLdSource[];
  directory: string;
  mongoUri: string;
  database: string;
}
export interface PreflightResult { name: string; ok: boolean; message: string }
export interface PreflightChecks {
  storage: (directory: string) => Promise<void>;
  browser: () => Promise<void>;
  mongo: (uri: string, database: string) => Promise<void>;
}
const checks: PreflightChecks = {
  async storage(directory) {
    await mkdir(directory, { recursive: true });
    const temporary = await mkdtemp(join(directory, ".preflight-"));
    try {
      const path = join(temporary, "probe");
      await writeFile(path, "ok", { mode: 0o600 });
      if (await readFile(path, "utf8") !== "ok") throw new Error("Storage read failed");
    } finally { await rm(temporary, { recursive: true, force: true }); }
  },
  async browser() {
    const browser = await chromium.launch({ channel: "chromium", headless: true, timeout: 15_000 });
    await browser.close();
  },
  async mongo(uri, database) {
    // A short, read-only diagnostic needs one connection and bounded waits.
    const client = new MongoClient(uri, { maxPoolSize: 1, minPoolSize: 0,
      serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000, socketTimeoutMS: 5000 });
    try { await client.connect(); await client.db(database).command({ ping: 1 }); }
    finally { await client.close(); }
  },
};

export async function runPreflight(input: PreflightInput, overrides: Partial<PreflightChecks> = {}): Promise<PreflightResult[]> {
  const dependencies = { ...checks, ...overrides };
  const tasks = [
    { name: "Configuration", run: async () => {
      if (!input.database.trim() || !input.directory.trim() || !input.sources.length) throw new Error("Empty setting");
      if (!/^mongodb(?:\+srv)?:\/\//u.test(input.mongoUri)) throw new Error("Invalid MongoDB URI");
      for (const source of input.sources) {
        requestProfileFor(source); sourceWebsiteHosts(source);
        for (const url of [...source.startUrls, ...source.sitemapUrls]) {
          if (!["http:", "https:"].includes(new URL(url).protocol)) throw new Error("Invalid source URL");
        }
      }
    }, failure: "Check source URLs, request profiles, MONGODB_URI, DB_NAME and CRAWLEE_STORAGE_DIR." },
    { name: "Storage", run: () => dependencies.storage(input.directory), failure: "Check free space and write permissions for CRAWLEE_STORAGE_DIR (default: storage)." },
    { name: "Chromium", run: dependencies.browser, failure: "Install Chromium with npx playwright install chromium; check PLAYWRIGHT_BROWSERS_PATH." },
    { name: "MongoDB", run: () => dependencies.mongo(input.mongoUri, input.database), failure: "Check MongoDB availability, credentials and MONGODB_URI; connection/ping failed." },
  ];
  // Do not echo driver errors: they can contain credentials or private connection details.
  return Promise.all(tasks.map(async ({ name, run, failure }) => {
    try { await run(); return { name, ok: true, message: "OK" }; }
    catch { return { name, ok: false, message: failure }; }
  }));
}
