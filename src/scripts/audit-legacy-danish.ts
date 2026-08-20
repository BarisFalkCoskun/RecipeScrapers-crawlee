import { resolve } from "node:path";
import { DANISH_JSONLD_SOURCES } from "../danish-jsonld/source-registry.js";
import {
  createLegacyDanishCoverageReport,
  loadLegacyDanishSpiders,
} from "../migration/legacy-danish-inventory.js";

const legacyDirectory = resolve(
  process.env.LEGACY_RECIPE_SCRAPERS_DIR ??
  process.argv[2] ??
  "/home/scraper/scripts/RecipeScrapers"
);
const spiders = await loadLegacyDanishSpiders(legacyDirectory);
const report = createLegacyDanishCoverageReport(
  spiders,
  DANISH_JSONLD_SOURCES.map((source) => source.id)
);
console.log(JSON.stringify({ legacyDirectory, ...report }, null, 2));
if (report.remaining > 0) process.exitCode = 1;
