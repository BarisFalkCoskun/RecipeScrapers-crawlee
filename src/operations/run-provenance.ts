import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXTRACTOR_VERSION } from "../config.js";
import { hashRecipe } from "../utils/hash.js";

/** Hash deployed code as well as Git revision: local edits and container builds remain distinguishable. */
export function buildRevision(env: NodeJS.ProcessEnv = process.env): string {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const hash = createHash("sha256");
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.(?:js|ts)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
        hash.update(path.slice(root.length)).update(readFileSync(path));
      }
    }
  };
  visit(root);
  let revision = env["BUILD_REVISION"];
  if (!revision) {
    try { revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
    catch { revision = "unversioned"; }
  }
  return `${revision}:${hash.digest("hex").slice(0, 16)}`;
}

export function runProvenance(configuration: Record<string, unknown>, env?: NodeJS.ProcessEnv) {
  return { buildRevision: buildRevision(env), configHash: hashRecipe(configuration), extractorVersion: EXTRACTOR_VERSION };
}
