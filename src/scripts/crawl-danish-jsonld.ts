import { config } from "dotenv";
import { executeDanishJsonLdCli } from "../danish-jsonld/cli.js";
import { totalmem } from "node:os";
import { configureDanishJsonLdRuntimeResources } from "../danish-jsonld/runtime-resources.js";

config();

async function main() {
  const resourceBudget = configureDanishJsonLdRuntimeResources({
    hostMemoryMbytes: totalmem() / (1024 * 1024),
  });
  console.info(JSON.stringify(resourceBudget));
  await executeDanishJsonLdCli(process.argv.slice(2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
