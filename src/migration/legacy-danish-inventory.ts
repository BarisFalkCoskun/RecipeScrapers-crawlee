import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

export interface LegacyDanishSpider {
  id: string;
  legacySpider: string;
  baseClass: string;
  domain: string | null;
}

export interface LegacyDanishCoverageReport {
  totalDanishSpiders: number;
  registered: number;
  remaining: number;
  registeredByBaseClass: Record<string, number>;
  remainingByBaseClass: Record<string, string[]>;
}

const loaderProgram = `
import json
from scrapy.settings import Settings
from scrapy.spiderloader import SpiderLoader

settings = Settings()
settings.setmodule('danish_recipes.settings')
loader = SpiderLoader.from_settings(settings)
rows = []
for name in loader.list():
    spider = loader.load(name)
    if getattr(spider, 'country', 'danish_recipes') != 'danish_recipes':
        continue
    rows.append({
        'id': name,
        'legacySpider': spider.__name__,
        'baseClass': spider.__bases__[0].__name__,
        'domain': getattr(spider, 'source_site', None),
    })
print(json.dumps(rows, sort_keys=True))
`;

export async function loadLegacyDanishSpiders(
  legacyProjectDirectory: string
): Promise<LegacyDanishSpider[]> {
  const python = join(legacyProjectDirectory, ".venv", "bin", "python");
  const { stdout } = await execFileAsync(python, ["-c", loaderProgram], {
    cwd: legacyProjectDirectory,
    maxBuffer: 10 * 1024 * 1024,
  });
  const rows = JSON.parse(stdout) as LegacyDanishSpider[];
  return rows.sort((left, right) => left.id.localeCompare(right.id));
}

export function createLegacyDanishCoverageReport(
  spiders: LegacyDanishSpider[],
  registeredSourceIds: Iterable<string>
): LegacyDanishCoverageReport {
  const registeredIds = new Set(registeredSourceIds);
  const registered = spiders.filter((spider) => registeredIds.has(spider.id));
  const remaining = spiders.filter((spider) => !registeredIds.has(spider.id));
  const registeredByBaseClass: Record<string, number> = {};
  for (const spider of registered) {
    registeredByBaseClass[spider.baseClass] =
      (registeredByBaseClass[spider.baseClass] ?? 0) + 1;
  }
  const remainingByBaseClass: Record<string, string[]> = {};
  for (const spider of remaining) {
    (remainingByBaseClass[spider.baseClass] ??= []).push(spider.id);
  }
  return {
    totalDanishSpiders: spiders.length,
    registered: registered.length,
    remaining: remaining.length,
    registeredByBaseClass: Object.fromEntries(
      Object.entries(registeredByBaseClass).sort(([left], [right]) => left.localeCompare(right))
    ),
    remainingByBaseClass: Object.fromEntries(
      Object.entries(remainingByBaseClass).sort(([left], [right]) => left.localeCompare(right))
    ),
  };
}
