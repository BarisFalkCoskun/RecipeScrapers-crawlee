import { config } from "dotenv";
import { executeDanishJsonLdCli } from "../danish-jsonld/cli.js";

config();

async function main() {
  await executeDanishJsonLdCli(process.argv.slice(2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
