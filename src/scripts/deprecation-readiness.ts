import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DANISH_JSONLD_SOURCES } from "../danish-jsonld/source-registry.js";
import { createDeprecationReadinessReport } from "../migration/deprecation-readiness.js";
import type { OperationalDeprecationEvidence } from "../migration/deprecation-readiness.js";
import { loadLegacyDanishSpiders } from "../migration/legacy-danish-inventory.js";

function parseArgs(args: string[]): {
  legacyDirectory: string;
  jsonOut?: string;
  operationalEvidencePath?: string;
} {
  let legacyDirectory = process.env.LEGACY_RECIPE_SCRAPERS_DIR ??
    "/home/scraper/scripts/RecipeScrapers";
  let jsonOut: string | undefined;
  let operationalEvidencePath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      flag !== "--legacy-dir" &&
      flag !== "--json-out" &&
      flag !== "--operational-evidence"
    ) {
      throw new Error(`Unknown option: ${flag}`);
    }
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    if (flag === "--legacy-dir") legacyDirectory = value;
    else if (flag === "--json-out") jsonOut = value;
    else operationalEvidencePath = value;
    index += 1;
  }
  return {
    legacyDirectory: resolve(legacyDirectory),
    ...(jsonOut ? { jsonOut: resolve(jsonOut) } : {}),
    ...(operationalEvidencePath
      ? { operationalEvidencePath: resolve(operationalEvidencePath) }
      : {}),
  };
}

const options = parseArgs(process.argv.slice(2));
const legacySpiders = await loadLegacyDanishSpiders(options.legacyDirectory);
const operationalEvidence = options.operationalEvidencePath
  ? JSON.parse(await readFile(options.operationalEvidencePath, "utf8")) as OperationalDeprecationEvidence
  : undefined;
const report = createDeprecationReadinessReport(
  legacySpiders,
  DANISH_JSONLD_SOURCES,
  operationalEvidence
);
const output = `${JSON.stringify({
  legacyDirectory: options.legacyDirectory,
  operationalEvidencePath: options.operationalEvidencePath ?? null,
  ...report,
}, null, 2)}\n`;
if (options.jsonOut) await writeFile(options.jsonOut, output, "utf8");
console.log(output.trimEnd());
if (!report.readyForScrapyDeprecation) process.exitCode = 1;
