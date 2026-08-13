import { DANISH_JSONLD_SOURCES } from "./source-registry.js";

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

    switch (argument) {
      case "--sources":
        if (!value) throw new Error("--sources requires a comma-separated value");
        options.sourceIds = value.split(",").map((id) => id.trim()).filter(Boolean);
        index += 1;
        break;
      case "--max-pages":
        if (!value || !/^\d+$/.test(value) || Number(value) < 1) {
          throw new Error("--max-pages must be a positive integer");
        }
        options.maxPages = Number(value);
        index += 1;
        break;
      case "--database":
        if (!value) throw new Error("--database requires a value");
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
        if (!value) throw new Error("--vpn-country requires a value");
        options.vpnCountry = value;
        index += 1;
        break;
      case "--json-out":
        if (!value) throw new Error("--json-out requires a path");
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
      throw new Error(`Unknown Danish JSON-LD source: "${sourceId}"`);
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
  const sourceIds = selectDanishJsonLdSources(options);

  return {
    ...options,
    sourceIds,
    sources: DANISH_JSONLD_SOURCES.filter((source) => sourceIds.includes(source.id)),
  };
}
