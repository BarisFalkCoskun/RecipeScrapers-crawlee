import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { RecipeStore } from "../storage/mongodb.js";
import { MONGODB_CONFIG } from "../config.js";
import { DANISH_JSONLD_SOURCES } from "../danish-jsonld/source-registry.js";
import { sourceHealth, renderSourceHealthHtml, type SourceHealth } from "../operations/source-health.js";

async function main() {
  const args = process.argv.slice(2);
  let sourceIds = DANISH_JSONLD_SOURCES.filter((s) => s.migrationState === "cutover").map((s) => s.id);
  let html: string | undefined;
  let json = false;
  let check = false;
  let maxAgeHours = 36;
  for (let i = 0; i < args.length; i++) {
    const value = () => { const next = args[++i]; if (!next || next.startsWith("--")) throw new Error("Option requires a value"); return next; };
    switch (args[i]) {
      case "--sources": sourceIds = value().split(",").filter(Boolean); break;
      case "--html": html = value(); break;
      case "--json": json = true; break;
      case "--check": check = true; break;
      case "--max-age-hours": maxAgeHours = Number(value()); break;
      default: throw new Error(`Unknown option: ${args[i]}`);
    }
  }
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) throw new Error("--max-age-hours must be positive");
  sourceIds = [...new Set(sourceIds)];
  if (!sourceIds.length) throw new Error("No cutover sources; use --sources to select sources explicitly");
  for (const id of sourceIds) if (!DANISH_JSONLD_SOURCES.some((s) => s.id === id)) throw new Error(`Unknown source: ${id}`);
  const store = new RecipeStore(process.env["MONGODB_URI"] ?? "mongodb://localhost:27017", process.env["DB_NAME"] ?? MONGODB_CONFIG.defaultDatabaseName);
  try {
    await store.connect();
    const rows: SourceHealth[] = [];
    // Bound database concurrency while retaining enough history per source.
    for (let i = 0; i < sourceIds.length; i += 8) {
      rows.push(...await Promise.all(sourceIds.slice(i, i + 8).map(async (sourceId) =>
        sourceHealth({ sourceId, runs: await store.recentDanishRecipeRuns([sourceId], 30), maxAgeHours }))));
    }
    if (html) await writeFile(html, renderSourceHealthHtml(rows), "utf8");
    if (json) console.log(JSON.stringify(rows, null, 2));
    else console.table(rows.map((r) => ({ source: r.sourceId, health: r.status, lastComplete: r.lastCompleteAt,
      recipes: r.recipes, new: r.inserted, changed: r.changed, unchanged: r.unchanged, pending: r.pendingRequests, alerts: r.alerts.join("; ") })));
    if (check && rows.some((r) => r.status !== "healthy")) process.exitCode = 1;
  } finally { await store.close(); }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
