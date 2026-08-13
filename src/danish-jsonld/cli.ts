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
import {
  createDefaultMullvadVpnTransport,
  type DanishJsonLdVpnTransport,
} from "./vpn-transport.js";
import { createBoundedDiagnostic } from "./diagnostics.js";

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
    vpnTransport?: DanishJsonLdVpnTransport;
  }) => Promise<{ summary: DanishJsonLdRunSummary; observations: unknown[] }>;
  createVpnTransport: (country?: string) => DanishJsonLdVpnTransport;
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
    createVpnTransport: (country) => createDefaultMullvadVpnTransport({
      country,
      env: dependencies.env ?? process.env,
      diagnosticSink: (event) => {
        logVpnDiagnostic(event);
      },
    }),
    writeFile,
    output: console.log,
    ...dependencies,
  };
  const options = parseDanishJsonLdCrawlArgs(args);
  const selection = createDanishJsonLdCrawlSelection(options);
  const startedAt = resolved.now();
  const baseCrawlRunId = resolveCrawlRunId(startedAt, resolved.env);
  const crawlRunId = options.force || resolved.env["CRAWL_RUN_ID"]
    ? `${baseCrawlRunId}-attempt-${randomUUID()}`
    : baseCrawlRunId;
  const database = options.database ?? resolved.env["DB_NAME"] ??
    MONGODB_CONFIG.defaultDatabaseName;
  const mongoUri = resolved.env["MONGODB_URI"] ?? "mongodb://localhost:27017";
  let store: CliStore | undefined;
  let vpnTransport: DanishJsonLdVpnTransport | undefined;

  try {
    if (options.vpn) {
      vpnTransport = resolved.createVpnTransport(options.vpnCountry);
      await vpnTransport.initialize();
    }
    store = resolved.createStore(mongoUri, database);
    await store.connect();
    const result = await resolved.runCrawl({
      selection,
      store,
      crawlRunId,
      ...(vpnTransport ? { vpnTransport } : {}),
    });
    const evidence = {
      crawlRunId,
      selectedSources: selection.sourceIds,
      maxPages: selection.maxPages ?? null,
      database,
      vpn: options.vpn,
      vpnCountry: options.vpnCountry ?? null,
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
    try {
      if (store) await store.close();
    } finally {
      if (vpnTransport) await vpnTransport.cleanup();
    }
  }
}

function logVpnDiagnostic(event: {
  event: string;
  data: Record<string, unknown>;
}): void {
  console.info(JSON.stringify(createBoundedDiagnostic(event.event, event.data)));
}
