import { crawlExitCode } from "../danish-jsonld/source-outcome.js";
import { config } from "dotenv";
import { executeDanishJsonLdCli } from "../danish-jsonld/cli.js";
import { totalmem } from "node:os";
import { configureDanishJsonLdRuntimeResources } from "../danish-jsonld/runtime-resources.js";

config({ quiet: true });

async function main() {
  const args = process.argv.slice(2);
  if (!args.some((arg) => ["--help", "-h", "--list-sources"].includes(arg))) {
    const resourceBudget = configureDanishJsonLdRuntimeResources({
      hostMemoryMbytes: totalmem() / (1024 * 1024),
    });
    console.info(JSON.stringify(resourceBudget));
  }
  const controller = new AbortController();
  let interruptedCode: number | undefined;
  const onInterrupt = () => { interruptedCode = 130; controller.abort(); };
  const onTerminate = () => { interruptedCode = 143; controller.abort(); };
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);
  try {
    const result = await executeDanishJsonLdCli(args, { signal: controller.signal });
    process.exitCode = interruptedCode ?? (result.informational ? 0 : crawlExitCode(result.summary));
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
  }
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
