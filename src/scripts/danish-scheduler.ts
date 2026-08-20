import { config as loadEnv } from "dotenv";
import { executeDanishJsonLdCli } from "../danish-jsonld/cli.js";
import {
  createSchedulerConfigFromEnv,
  DanishRecipeScheduler,
  scheduledOutcomeIsHealthy,
} from "../operations/danish-scheduler.js";

loadEnv();

async function main(): Promise<void> {
  const config = createSchedulerConfigFromEnv();
  const scheduler = new DanishRecipeScheduler(config, {
    now: () => new Date(),
    runSource: async (sourceId, evidencePath) => {
      const result = await executeDanishJsonLdCli([
        "--sources", sourceId,
        "--force",
        "--json-out", evidencePath,
      ]);
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
  await scheduler.runForever();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
