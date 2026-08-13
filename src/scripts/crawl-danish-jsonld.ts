import { writeFile } from "node:fs/promises";
import {
  createDanishJsonLdCrawlSelection,
  parseDanishJsonLdCrawlArgs,
} from "../danish-jsonld/source-selection.js";

async function main() {
  const options = parseDanishJsonLdCrawlArgs(process.argv.slice(2));
  const selection = createDanishJsonLdCrawlSelection(options);
  const output = JSON.stringify(selection, null, 2);

  if (options.jsonOut) {
    await writeFile(options.jsonOut, `${output}\n`, "utf8");
  }

  console.log(output);
  console.log(
    "Selection prepared only; source execution remains gated on a later migration task."
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
