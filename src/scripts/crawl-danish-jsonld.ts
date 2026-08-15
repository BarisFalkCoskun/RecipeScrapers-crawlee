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

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => {
    // The evidence file and every store write are complete here. A Playwright
    // fallback can leave a browser handle open, which held one run alive for
    // hours and stalled everything queued behind it, so the run ends here
    // rather than waiting on the event loop to drain.
    process.exit(process.exitCode ?? 0);
  });
