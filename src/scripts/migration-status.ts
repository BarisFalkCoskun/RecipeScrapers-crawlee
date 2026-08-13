import { writeFile } from "node:fs/promises";
import {
  createMigrationStatusReport,
  renderMigrationStatus,
  type MigrationStatusFormat,
} from "../danish-jsonld/migration-status.js";

function parseArgs(args: string[]): { format: MigrationStatusFormat; jsonOut?: string } {
  let format: MigrationStatusFormat = "console";
  let jsonOut: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (argument === "--format") {
      if (value !== "console" && value !== "markdown" && value !== "json") {
        throw new Error("--format must be console, markdown, or json");
      }
      format = value;
      index += 1;
    } else if (argument === "--json-out") {
      if (!value) throw new Error("--json-out requires a path");
      jsonOut = value;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  return { format, jsonOut };
}

async function main() {
  const { format, jsonOut } = parseArgs(process.argv.slice(2));
  const report = createMigrationStatusReport();
  if (jsonOut) {
    await writeFile(jsonOut, `${renderMigrationStatus(report, "json")}\n`, "utf8");
  }
  console.log(renderMigrationStatus(report, format));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
