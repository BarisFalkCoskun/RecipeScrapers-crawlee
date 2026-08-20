import { resolve } from "node:path";
import { DANISH_WPRM_SOURCE_DEFINITIONS } from "../wprm/danish-sources.js";
import { loadLegacyDanishWprmSources } from "../wprm/legacy-inventory.js";

const defaultLegacyDirectory = "/home/scraper/scripts/RecipeScrapers";
const legacyDirectory = resolve(
  process.env.LEGACY_RECIPE_SCRAPERS_DIR ?? process.argv[2] ?? defaultLegacyDirectory
);

const actual = await loadLegacyDanishWprmSources(legacyDirectory);
const expected = DANISH_WPRM_SOURCE_DEFINITIONS.map(([
  id,
  legacySpider,
  domain,
  apiUrl,
  usePlaywright,
  delaySeconds,
  maxConcurrency,
]) => ({
  id,
  legacySpider,
  domain,
  apiUrl,
  usePlaywright,
  delaySeconds,
  maxConcurrency,
})).sort((left, right) => left.id.localeCompare(right.id));

const actualById = new Map(actual.map(({ file: _file, ...source }) => [source.id, source]));
const expectedById = new Map<string, (typeof expected)[number]>(
  expected.map((source) => [source.id, source])
);
const missing = expected.filter((source) => !actualById.has(source.id)).map((source) => source.id);
const unexpected = actual.filter((source) => !expectedById.has(source.id)).map((source) => source.id);
const mismatches = expected.flatMap((source) => {
  const legacy = actualById.get(source.id);
  if (!legacy || JSON.stringify(legacy) === JSON.stringify(source)) return [];
  return [{ source: source.id, expected: source, actual: legacy }];
});
const passed = missing.length === 0 && unexpected.length === 0 && mismatches.length === 0;

console.log(JSON.stringify({
  passed,
  legacyDirectory,
  expectedCount: expected.length,
  actualCount: actual.length,
  missing,
  unexpected,
  mismatches,
}, null, 2));

if (!passed) process.exitCode = 1;
