import { config as loadEnv } from "dotenv";
import { hostname } from "node:os";
import { schedulerHeartbeatIsFresh } from "../operations/danish-scheduler.js";

loadEnv();

async function main(): Promise<void> {
  const path = process.env["CRAWLEE_SCHEDULER_HEARTBEAT_PATH"] ??
    "data/crawlee-scheduler-heartbeat.json";
  const maxAgeSeconds = Number(
    process.env["CRAWLEE_SCHEDULER_HEARTBEAT_MAX_AGE_SECONDS"] ?? "180"
  );
  if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds < 1) {
    throw new Error("CRAWLEE_SCHEDULER_HEARTBEAT_MAX_AGE_SECONDS must be a positive integer");
  }
  const healthy = await schedulerHeartbeatIsFresh({
    path,
    now: new Date(),
    maxAgeSeconds,
    expectedHostname: hostname(),
  });
  if (!healthy) throw new Error(`Scheduler heartbeat is missing, stale, foreign, or its process is not alive: ${path}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
