import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export interface LegacyWprmSource {
  id: string;
  legacySpider: string;
  domain: string;
  apiUrl: string;
  usePlaywright: boolean;
  delaySeconds: number;
  maxConcurrency: number;
  file: string;
}

function stringAssignment(source: string, name: string): string | undefined {
  const match = source.match(
    new RegExp(`^\\s{4}${name}\\s*=\\s*(?:\\(\\s*)?['\"]([^'\"]+)['\"]`, "mu")
  );
  return match?.[1];
}

function numericSetting(
  source: string,
  name: string,
  fallback: number
): number {
  const block = source.match(
    /^\s{4}custom_settings\s*=\s*\{([\s\S]*?)^\s{4}\}/mu
  )?.[1];
  if (!block) return fallback;
  const value = block.match(new RegExp(`['\"]${name}['\"]\\s*:\\s*(\\d+)`, "u"))?.[1];
  return value === undefined ? fallback : Number(value);
}

/** Parse the intentionally declarative legacy one-class spider modules. */
export function parseLegacyWprmSource(
  source: string,
  file: string
): LegacyWprmSource | null {
  const legacySpider = source.match(
    /^class\s+(\w+)\(WprmApiSpider\):/mu
  )?.[1];
  if (!legacySpider) return null;

  const country = stringAssignment(source, "country") ?? "danish_recipes";
  if (country !== "danish_recipes") return null;

  const id = stringAssignment(source, "name");
  const domain = stringAssignment(source, "source_site");
  const apiUrl = stringAssignment(source, "api_url");
  if (!id || !domain || !apiUrl) {
    throw new Error(`Incomplete Danish WPRM declaration in ${file}`);
  }

  return {
    id,
    legacySpider,
    domain,
    apiUrl,
    usePlaywright: /^\s{4}use_playwright_api\s*=\s*True\s*$/mu.test(source),
    delaySeconds: numericSetting(source, "DOWNLOAD_DELAY", 1),
    maxConcurrency: numericSetting(
      source,
      "CONCURRENT_REQUESTS_PER_DOMAIN",
      2
    ),
    file,
  };
}

export async function loadLegacyDanishWprmSources(
  legacyProjectDirectory: string
): Promise<LegacyWprmSource[]> {
  const spiderDirectory = join(legacyProjectDirectory, "danish_recipes", "spiders");
  const files = (await readdir(spiderDirectory))
    .filter((file) => file.endsWith(".py") && file !== "base.py")
    .sort();
  const parsed = await Promise.all(files.map(async (file) =>
    parseLegacyWprmSource(await readFile(join(spiderDirectory, file), "utf8"), file)
  ));
  return parsed.filter((source): source is LegacyWprmSource => source !== null)
    .sort((left, right) => left.id.localeCompare(right.id));
}
