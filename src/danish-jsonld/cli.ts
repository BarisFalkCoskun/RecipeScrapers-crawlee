import type { RecipeDocumentV2Store, CrawlStore } from "../storage/store.js";
import type { DanishJsonLdRunSummary } from "../types.js";
import { RecipeStore } from "../storage/mongodb.js";
import { MONGODB_CONFIG } from "../config.js";
import { resolveCrawlRunId } from "../crawl-run.js";
import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  runDanishJsonLdCrawl,
  type DanishJsonLdCrawlSelection,
} from "./runner.js";
import {
  createDanishJsonLdCrawlSelection,
  parseDanishJsonLdCrawlArgs,
} from "./source-selection.js";

interface CliStore extends CrawlStore, RecipeDocumentV2Store {
  connect(): Promise<void>;
  close(): Promise<void>;
}

export interface DanishJsonLdCliDependencies {
  env: NodeJS.ProcessEnv;
  now: () => Date;
  createStore: (uri: string, database: string) => CliStore;
  runCrawl: (input: {
    selection: DanishJsonLdCrawlSelection;
    store: CliStore;
    crawlRunId: string;
  }) => Promise<{ summary: DanishJsonLdRunSummary; observations: unknown[] }>;
  writeFile: (path: string, data: string, encoding: "utf8") => Promise<unknown>;
  output: (line: string) => void;
}

export async function executeDanishJsonLdCli(
  args: string[],
  dependencies: Partial<DanishJsonLdCliDependencies> = {}
): Promise<{ summary: DanishJsonLdRunSummary; observations: unknown[] }> {
  const resolved: DanishJsonLdCliDependencies = {
    env: process.env,
    now: () => new Date(),
    createStore: (uri, database) => new RecipeStore(uri, database),
    runCrawl: runDanishJsonLdCrawl,
    writeFile,
    output: console.log,
    ...dependencies,
  };
  const options = parseDanishJsonLdCrawlArgs(args);
  if (options.vpn || options.vpnCountry) {
    throw new Error("--vpn is unsupported until Task 4; omit --vpn and --vpn-country");
  }
  const selection = createDanishJsonLdCrawlSelection(options);
  const startedAt = resolved.now();
  const baseCrawlRunId = resolveCrawlRunId(startedAt, resolved.env);
  const crawlRunId = options.force || resolved.env["CRAWL_RUN_ID"]
    ? `${baseCrawlRunId}-attempt-${randomUUID()}`
    : baseCrawlRunId;
  const database = options.database ?? resolved.env["DB_NAME"] ??
    MONGODB_CONFIG.defaultDatabaseName;
  const mongoUri = resolved.env["MONGODB_URI"] ?? "mongodb://localhost:27017";
  const store = resolved.createStore(mongoUri, database);

  try {
    await store.connect();
    const result = await resolved.runCrawl({ selection, store, crawlRunId });
    const evidence = {
      crawlRunId,
      selectedSources: selection.sourceIds,
      maxPages: selection.maxPages ?? null,
      database,
      summary: result.summary,
      observations: result.observations,
    };
    const output = JSON.stringify(evidence, null, 2);
    if (options.jsonOut) {
      await resolved.writeFile(options.jsonOut, `${output}\n`, "utf8");
    }
    resolved.output(output);
    return result;
  } finally {
    await store.close();
  }
}
