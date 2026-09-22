import { RecipeStore } from "../storage/mongodb.js";
import { SourceHealthMonitor } from "../operations/health-monitor.js";
import { MONGODB_CONFIG } from "../config.js";
import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { DanishJsonLdRunSummary } from "../types.js";
import {
  createSchedulerConfigFromEnv,
  DanishRecipeScheduler,
  scheduledOutcomeIsHealthy,
} from "../operations/danish-scheduler.js";

loadEnv();

async function main(): Promise<void> {
  const config = createSchedulerConfigFromEnv();
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  const scheduler = new DanishRecipeScheduler(config, {
    now: () => new Date(),
    runSource: async (sourceId, evidencePath) => {
      // Each worker owns Crawlee's global configuration and browser lifecycle in its own process.
      const script = fileURLToPath(new URL(import.meta.url.endsWith(".ts") ? "./crawl-danish-jsonld.ts" : "./crawl-danish-jsonld.js", import.meta.url));
      const exitCode = await new Promise<number | null>((resolve, reject) => {
        const child = spawn(process.execPath, [...process.execArgv, script, "--sources", sourceId, "--force", "--json-out", evidencePath], { stdio: "inherit", env: {
          ...process.env, CRAWLEE_PURGE_ON_START: "false",
          CRAWLEE_DEFAULT_KEY_VALUE_STORE_ID: `scheduler-${sourceId}-${randomUUID()}`,
        } });
        let timeout: NodeJS.Timeout | undefined;
        const stop = () => {
          child.kill("SIGTERM");
          timeout = setTimeout(() => child.kill("SIGKILL"), 60_000);
          timeout.unref();
        };
        controller.signal.addEventListener("abort", stop, { once: true });
        if (controller.signal.aborted) stop();
        child.once("error", reject);
        child.once("exit", (code) => {
          controller.signal.removeEventListener("abort", stop);
          if (timeout) clearTimeout(timeout);
          resolve(code);
        });
      });
      if (controller.signal.aborted || exitCode === null || (exitCode !== 0 && exitCode !== 1)) {
        throw new Error(`Source worker stopped with exit code ${exitCode}`);
      }
      const result = JSON.parse(await readFile(evidencePath, "utf8")) as { summary: DanishJsonLdRunSummary };
      if (!scheduledOutcomeIsHealthy(result.summary, sourceId)) {
        const outcome = result.summary.sourceOutcomes.find(
          (entry) => entry.sourceId === sourceId
        );
        throw new Error(
          `Unhealthy scheduled outcome for ${sourceId}: ${JSON.stringify(outcome ?? null)}`
        );
      }
    },
    output: console.log,
    signal: controller.signal,
    onFatalError: () => { process.exitCode = 1; controller.abort(); },
  });

  const args = process.argv.slice(2);
  if (args[0] === "--list") {
    for (const sourceId of config.sourceIds) {
      const schedule = config.schedules.get(sourceId)!;
      console.log(`${sourceId}\t${schedule.minute} ${schedule.hour} * * *`);
    }
    return;
  }
  if (args[0] === "--run-now") {
    const sourceId = args[1];
    if (!sourceId) throw new Error("--run-now requires a source id");
    if (!config.sourceIds.includes(sourceId)) {
      throw new Error(`${sourceId} is not in the fail-closed scheduled source set`);
    }
    await scheduler.initialize();
    try {
      const succeeded = await scheduler.runOne(sourceId);
      if (!succeeded) process.exitCode = 1;
    } finally {
      await scheduler.dispose();
    }
    return;
  }
  if (args.length > 0) throw new Error(`Unknown scheduler option: ${args[0]}`);
  const store = new RecipeStore(process.env["MONGODB_URI"] ?? "mongodb://localhost:27017", process.env["DB_NAME"] ?? MONGODB_CONFIG.defaultDatabaseName);
  const maxAgeHours = Number(process.env["CRAWLEE_HEALTH_MAX_AGE_HOURS"] ?? 36);
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) throw new Error("CRAWLEE_HEALTH_MAX_AGE_HOURS must be positive");
  const monitor = new SourceHealthMonitor({ sourceIds: config.sourceIds, maxAgeHours,
    readRuns: (id) => store.recentDanishRecipeRuns([id], 30), emit: (event) => console.log(JSON.stringify(event)) });
  let timer: NodeJS.Timeout | undefined;
  try {
    await store.connect();
    await monitor.check();
    timer = setInterval(() => { void monitor.check().catch((error: unknown) => console.error("Source health check failed", error)); }, 15 * 60_000);
    await scheduler.runForever();
  } finally {
    if (timer) clearInterval(timer);
    await store.close();
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
