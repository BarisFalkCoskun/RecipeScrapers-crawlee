import { DANISH_JSONLD_SOURCES } from "./source-registry.js";
import { parseRecipeSourceLanguages, recipeSourceLanguage, type RecipeSourceLanguage } from "./source-languages.js";

/**
 * Deliberately small, source-by-source migration cohort. Selecting this list
 * does not assert canary, shadow, or cutover readiness for any source.
 */
export const DANISH_JSONLD_PILOT_SOURCE_IDS = [
  "arla",
  "coop",
  "kitchenaid",
  "surdejsentusiasten",
  "sundpaabudget",
  "klinksgaard",
  "madoghave",
  "netto",
  "madrejsen",
  "tv2mad",
  "kikkoman",
  "gamleopskrifter",
] as const;

/** First Danish sources whose recipes come directly from the WPRM REST API. */
export const DANISH_WPRM_PILOT_SOURCE_IDS = [
  "gastrofun",
  "groedgrisen",
  "ketoliv",
  "madensverden",
  "planteaederen",
] as const;

export interface DanishJsonLdCrawlOptions {
  sourceIds?: string[];
  languages?: RecipeSourceLanguage[];
  maxPages?: number;
  database?: string;
  force: boolean;
  vpn: boolean;
  vpnCountry?: string;
  jsonOut?: string;
  resumeRunId?: string;
  fullRefresh?: boolean;
  refreshHours?: number;
  check?: boolean;
  help?: boolean;
  listSources?: boolean;
}

export function parseDanishJsonLdCrawlArgs(
  args: string[]
): DanishJsonLdCrawlOptions {
  const options: DanishJsonLdCrawlOptions = { force: false, vpn: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    const requiresValue = () => value !== undefined && !value.startsWith("--");

    switch (argument) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--check":
        options.check = true;
        break;
      case "--list-sources":
        options.listSources = true;
        break;
      case "--language":
        if (!requiresValue()) throw new Error("--language requires da (Danish) or en (English)");
        options.languages = [...new Set([
          ...(options.languages ?? []), ...parseRecipeSourceLanguages(value),
        ])];
        index += 1;
        break;
      case "--full-refresh":
        options.fullRefresh = true;
        break;
      case "--refresh-hours":
        if (!requiresValue() || !/^\d+(?:\.\d+)?$/u.test(value) || !Number.isFinite(Number(value)) || Number(value) > 168) {
          throw new Error("--refresh-hours must be a number from 0 to 168");
        }
        options.refreshHours = Number(value);
        index += 1;
        break;
      case "--sources":
        if (!requiresValue()) {
          throw new Error("--sources requires a comma-separated value");
        }
        options.sourceIds = [...new Set(value.split(",").map((id) => id.trim()).filter(Boolean))];
        if (options.sourceIds.length === 0) {
          throw new Error("--sources requires at least one source id");
        }
        index += 1;
        break;
      case "--max-pages":
        if (!requiresValue() || !/^\d+$/.test(value) || Number(value) < 1) {
          throw new Error("--max-pages must be a positive integer");
        }
        options.maxPages = Number(value);
        index += 1;
        break;
      case "--database":
        if (!requiresValue()) throw new Error("--database requires a value");
        options.database = value;
        index += 1;
        break;
      case "--resume":
        if (!requiresValue()) throw new Error("--resume requires a crawl run id");
        options.resumeRunId = value;
        index += 1;
        break;
      case "--force":
        options.force = true;
        break;
      case "--vpn":
        options.vpn = true;
        break;
      case "--vpn-country":
        if (!requiresValue()) throw new Error("--vpn-country requires a value");
        options.vpnCountry = value;
        index += 1;
        break;
      case "--json-out":
        if (!requiresValue()) throw new Error("--json-out requires a path");
        options.jsonOut = value;
        index += 1;
        break;
      default:
        throw new Error(`Unknown option: ${argument}`);
    }
  }

  if (options.resumeRunId && options.force) throw new Error("--resume and --force are mutually exclusive");
  if (options.fullRefresh && options.refreshHours) throw new Error("--full-refresh and --refresh-hours cannot be combined");
  if (options.resumeRunId && !options.sourceIds && !options.languages) {
    throw new Error("--resume requires the original --sources or --language selection");
  }

  if (options.vpnCountry && !options.vpn) {
    throw new Error("--vpn-country requires --vpn");
  }

  if (options.sourceIds?.includes("all")) {
    if (options.sourceIds.length !== 1) throw new Error("Use --sources all by itself, or name individual sources");
    options.sourceIds = allRecipeSourceIds();
  }

  for (const sourceId of options.sourceIds ?? []) {
    if (!DANISH_JSONLD_SOURCES.some((source) => source.id === sourceId)) {
      throw new Error(`Unknown recipe source: "${sourceId}"`);
    }
  }

  return options;
}

export function selectDanishJsonLdSources(
  options: DanishJsonLdCrawlOptions
): string[] {
  const requested = options.sourceIds ?? allRecipeSourceIds();
  if (!options.languages) return requested;
  const selected = requested.filter((sourceId) => {
    const source = DANISH_JSONLD_SOURCES.find((candidate) => candidate.id === sourceId);
    const language = recipeSourceLanguage(source?.aliasFor ?? sourceId);
    return language !== undefined && options.languages!.includes(language);
  });
  if (selected.length === 0) {
    throw new Error(`No sources match --language ${options.languages.join(",")} in the requested selection`);
  }
  return selected;
}

/** Migration/availability evidence does not restrict an explicitly requested full crawl.
 * Aliases remain accepted as input, but never cause a second crawl of the same source.
 */
function allRecipeSourceIds(): string[] {
  return DANISH_JSONLD_SOURCES.filter((source) => !source.aliasFor).map((source) => source.id);
}

export function createDanishJsonLdCrawlSelection(
  options: DanishJsonLdCrawlOptions
) {
  const requestedSourceIds = selectDanishJsonLdSources(options);
  const sourceIds = [...new Set(requestedSourceIds.map((sourceId) => {
    const source = DANISH_JSONLD_SOURCES.find((candidate) => candidate.id === sourceId);
    return source?.aliasFor ?? sourceId;
  }))];

  return {
    ...options,
    sourceIds,
    sources: sourceIds.flatMap((sourceId) =>
      DANISH_JSONLD_SOURCES.filter((source) => source.id === sourceId)
    ),
  };
}
