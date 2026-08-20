import { readFile } from "node:fs/promises";
import { compareWprmProbeRecipes } from "../wprm/probe-parity.js";
import { DANISH_JSONLD_SOURCES } from "../danish-jsonld/source-registry.js";

const [legacyPath, crawleePath, sourceFlag, sourceId] = process.argv.slice(2);
if (!legacyPath || !crawleePath) {
  throw new Error(
    "Usage: compare-wprm-probes <scrapy.jsonl> <crawlee.json> [--source <source-id>]"
  );
}
if ((sourceFlag !== undefined || sourceId !== undefined) && sourceFlag !== "--source") {
  throw new Error("The optional filter must be --source <source-id>");
}

const legacy = (await readFile(legacyPath, "utf8"))
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line) as Record<string, unknown>);
const crawleeAll = JSON.parse(await readFile(crawleePath, "utf8")) as Array<{
  sourceId?: string;
  canonicalUrl: string;
  normalized: Parameters<typeof compareWprmProbeRecipes>[1][number]["normalized"];
}>;
const crawlee = sourceId === undefined
  ? crawleeAll
  : crawleeAll.filter((recipe) => recipe.sourceId === sourceId);
const source = sourceId === undefined
  ? undefined
  : DANISH_JSONLD_SOURCES.find((candidate) => candidate.id === sourceId);
const legacyTagsIncludeCuisines = source === undefined ||
  source.legacyFamily === "WprmApiSpider" ||
  source.legacyFamily === "CustomWprmApiSpider";
const report = compareWprmProbeRecipes(legacy, crawlee, {
  legacyTagsIncludeCuisines,
  legacyYieldIsNumericOnly: source !== undefined && !legacyTagsIncludeCuisines,
});
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
