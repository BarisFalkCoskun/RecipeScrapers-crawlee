import { runPreflight } from "./preflight.js";
import { formatBatchProgress, type BatchProgress } from "./batch-progress.js";
import { hashHtml } from "../utils/hash.js";
import { runProvenance } from "../operations/run-provenance.js";
import type { RecipeDocumentV2Store, CrawlStore } from "../storage/store.js";
import type { DanishJsonLdRunSummary } from "../types.js";
import { RecipeStore } from "../storage/mongodb.js";
import { MONGODB_CONFIG } from "../config.js";
import { resolveCrawlRunId } from "../crawl-run.js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
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
import { recipeSourceLanguage } from "./source-languages.js";

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
    checkpointDirectory?: string;
    checkpointIdentity?: string;
    signal?: AbortSignal;
    onProgress?: (progress: BatchProgress) => void;
  }) => Promise<{ summary: DanishJsonLdRunSummary; observations: unknown[] }>;
  createVpnTransport: (country?: string) => DanishJsonLdVpnTransport;
  mkdir: (path: string, options: { recursive: true }) => Promise<unknown>;
  writeFile: (path: string, data: string, encoding: "utf8") => Promise<unknown>;
  output: (line: string) => void;
  progress: (line: string) => void;
  preflight: typeof runPreflight;
  signal?: AbortSignal;
}

export async function executeDanishJsonLdCli(
  args: string[],
  dependencies: Partial<DanishJsonLdCliDependencies> = {}
): Promise<{ summary: DanishJsonLdRunSummary; observations: unknown[]; informational?: true; exitCode?: number }> {
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
    mkdir,
    writeFile,
    output: console.log,
    progress: (line) => console.error(line),
    preflight: runPreflight,
    ...dependencies,
  };
  const options = parseDanishJsonLdCrawlArgs(args);
  if (options.help) {
    resolved.output(`Usage: npm start [-- options]

With no options, crawl every registered site once. Aliases are deduplicated;
sites with previous failures are attempted and their current outcomes reported.

Options:
  --sources ID,ID       Crawl only these sites (or use "all")
  --language da|en      Select Danish or English sites (names or da,en also work)
  --check              Check configuration, storage, Chromium and MongoDB without crawling
  --list-sources        List selected site IDs, domains and languages without crawling
  --max-pages N         Limit requests per site for this invocation
  --refresh-hours N    Reuse eligible recipe pages for up to N hours (default: 0)
  --full-refresh       Fetch all pending pages without cached validators
  --resume RUN_ID      Resume pending work; repeat the original source/language filters
  --database NAME      Override DB_NAME
  --json-out PATH      Save the run report
  --force              Generate a new attempt ID
  --vpn                Use the configured Mullvad transport
  --vpn-country CODE   Select a VPN country (requires --vpn)
  --help, -h           Show this help

MongoDB: MONGODB_URI (default mongodb://localhost:27017), DB_NAME (default crawlee).
Examples:
  npm start
  npm start -- --language da
  npm start -- --language en
  npm start -- --language da --list-sources
  npm start -- --sources arla,gastrofun
  npm start -- --resume RUN_ID --sources all`);
    return { informational: true, summary: { robotsEnforced: false, sourceOutcomes: [] }, observations: [] };
  }
  const selection = createDanishJsonLdCrawlSelection(options);
  if (options.listSources) {
    resolved.output(`${selection.sourceIds.length} sites\nID\tDomain\tLanguage\n${selection.sources.map((source) => `${source.id}\t${source.domain}\t${recipeSourceLanguage(source.id) ?? "und"}`).join("\n")}`);
    return { informational: true, summary: { robotsEnforced: false, sourceOutcomes: [] }, observations: [] };
  }
  if (options.check) {
    const results = await resolved.preflight({ sources: selection.sources,
      directory: resolved.env["CRAWLEE_STORAGE_DIR"] ?? "storage",
      mongoUri: resolved.env["MONGODB_URI"] ?? "mongodb://localhost:27017",
      database: options.database ?? resolved.env["DB_NAME"] ?? MONGODB_CONFIG.defaultDatabaseName });
    for (const result of results) resolved.output(`${result.ok ? "PASS" : "FAIL"} ${result.name}: ${result.message}`);
    return { informational: true, exitCode: results.every((result) => result.ok) ? 0 : 1,
      summary: { robotsEnforced: false, sourceOutcomes: [] }, observations: [] };
  }
  const startedAt = resolved.now();
  const baseCrawlRunId = resolveCrawlRunId(startedAt, resolved.env);
  const crawlRunId = options.resumeRunId ?? (options.force || resolved.env["CRAWL_RUN_ID"]
    ? `${baseCrawlRunId}-attempt-${randomUUID()}`
    : baseCrawlRunId);
  const database = options.database ?? resolved.env["DB_NAME"] ??
    MONGODB_CONFIG.defaultDatabaseName;
  const mongoUri = resolved.env["MONGODB_URI"] ?? "mongodb://localhost:27017";
  const runKind = crawlRunKind(selection);
  const provenance = runProvenance({ sources: selection.sources, database, storageTarget: hashHtml(mongoUri), vpn: options.vpn, vpnCountry: options.vpnCountry }, resolved.env);
  const checkpointIdentity = JSON.stringify({ ...provenance, database });
  const checkpointDirectory = resolved.env["CRAWLEE_STORAGE_DIR"] ?? "storage";
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
      checkpointDirectory,
      checkpointIdentity,
      signal: resolved.signal,
      onProgress: (progress) => resolved.progress(formatBatchProgress(progress)),
      ...(vpnTransport ? { vpnTransport } : {}),
    });
    await store.insertDanishJsonLdRun({
      kind: runKind,
      schemaVersion: 2,
      crawlRunId,
      startedAt,
      finishedAt: resolved.now(),
      sourceIds: selection.sourceIds,
      summary: result.summary,
      observations: result.observations,
      provenance,
    });
    const evidence = {
      crawlRunId,
      kind: runKind,
      selectedSources: selection.sourceIds,
      selectedLanguages: options.languages ?? null,
      provenance,
      resumed: Boolean(options.resumeRunId),
      incremental: { enabled: !options.fullRefresh, refreshHours: options.refreshHours ?? 0 },
      maxPages: selection.maxPages ?? null,
      database,
      vpn: options.vpn,
      vpnCountry: options.vpnCountry ?? null,
      summary: result.summary,
      observations: result.observations,
    };
    const output = JSON.stringify(evidence, null, 2);
    if (options.jsonOut) {
      await resolved.mkdir(dirname(options.jsonOut), { recursive: true });
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

function crawlRunKind(
  selection: DanishJsonLdCrawlSelection
): "danish-jsonld-v2" | "danish-wprm-v2" | "danish-recipe-v2" {
  const wprmCount = selection.sources.filter(
    (source) => source.legacyFamily === "WprmApiSpider" ||
      source.recipeExtractor === "wprm-api"
  ).length;
  if (wprmCount === selection.sources.length) return "danish-wprm-v2";
  if (wprmCount > 0) return "danish-recipe-v2";
  if (selection.sources.some(
    (source) => source.recipeExtractor !== undefined &&
      source.recipeExtractor !== "strict-json-ld"
  )) {
    return "danish-recipe-v2";
  }
  if (selection.sources.some(
    (source) => source.legacyFamily === "SanityRecipeApiSpider"
  )) return "danish-recipe-v2";
  return "danish-jsonld-v2";
}

function logVpnDiagnostic(event: {
  event: string;
  data: Record<string, unknown>;
}): void {
  console.info(JSON.stringify(createBoundedDiagnostic(event.event, event.data)));
}
