import { DANISH_JSONLD_SOURCES } from "./source-registry.js";

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
  maxPages?: number;
  database?: string;
  force: boolean;
  vpn: boolean;
  vpnCountry?: string;
  jsonOut?: string;
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

  if (options.vpnCountry && !options.vpn) {
    throw new Error("--vpn-country requires --vpn");
  }

  for (const sourceId of options.sourceIds ?? []) {
    if (!DANISH_JSONLD_SOURCES.some((source) => source.id === sourceId)) {
      throw new Error(`Unknown Danish recipe source: "${sourceId}"`);
    }
  }

  return options;
}

export function selectDanishJsonLdSources(
  options: DanishJsonLdCrawlOptions
): string[] {
  return options.sourceIds ?? ["arla"];
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
