import { readFile } from "node:fs/promises";
import { MongoClient } from "mongodb";
import { canonicalizeUrl } from "../utils/canonicalize.js";
import { DANISH_JSONLD_SOURCES } from "../danish-jsonld/source-registry.js";
import {
  executeMigrationComparison,
  parseMigrationComparisonArgs,
  type CrawleeAdmission,
  type CrawleeComparisonRecipe,
  type LegacyComparisonRecipe,
} from "../danish-jsonld/migration-compare.js";

async function main() {
  const options = parseMigrationComparisonArgs(process.argv.slice(2));
  const legacyClient = new MongoClient(requiredEnv("LEGACY_MONGODB_URI"));
  const crawleeClient = new MongoClient(requiredEnv("CRAWLEE_MONGODB_URI"));
  await Promise.all([legacyClient.connect(), crawleeClient.connect()]);
  try {
    await executeMigrationComparison(options, {
      readLegacy: async (database, sourceIds) => {
        const documents = await legacyClient.db(database).collection("recipes")
          .find({ source_site: { $in: sourceIds } })
          .project({ source_site: 1, url: 1, title: 1, ingredients: 1, instructions: 1 })
          .toArray();
        return documents.flatMap((document): LegacyComparisonRecipe[] => {
          if (typeof document.source_site !== "string" || typeof document.url !== "string") return [];
          return [{
            sourceId: document.source_site,
            canonicalUrl: canonicalizeUrl(document.url),
            title: document.title,
            ingredients: document.ingredients,
            instructions: document.instructions,
          }];
        });
      },
      readCrawlee: async (database, sourceIds) => {
        const documents = await crawleeClient.db(database).collection("recipes_v2")
          .find({ sourceId: { $in: sourceIds } })
          .project({ sourceId: 1, canonicalUrl: 1, normalized: 1 })
          .toArray();
        return documents.flatMap((document): CrawleeComparisonRecipe[] => {
          if (typeof document.sourceId !== "string" || typeof document.canonicalUrl !== "string" ||
            !document.normalized || typeof document.normalized !== "object") return [];
          return [{
            sourceId: document.sourceId,
            canonicalUrl: document.canonicalUrl,
            normalized: document.normalized as Record<string, unknown>,
          }];
        });
      },
      readCrawleeAdmissions: async (database, sourceIds) => {
        const selected = sourceIds.map((sourceId) => {
          const source = DANISH_JSONLD_SOURCES.find((candidate) => candidate.id === sourceId);
          if (!source) throw new Error(`Unknown Danish JSON-LD source: ${sourceId}`);
          return source;
        });
        const domainToSource = new Map(selected.map((source) => [source.domain, source.id]));
        const documents = await crawleeClient.db(database).collection("pages")
          .find({ sourceDomain: { $in: selected.map((source) => source.domain) } })
          .project({ sourceDomain: 1, canonicalUrl: 1 })
          .toArray();
        return documents.flatMap((document): CrawleeAdmission[] => {
          if (typeof document.sourceDomain !== "string" || typeof document.canonicalUrl !== "string") return [];
          const sourceId = domainToSource.get(document.sourceDomain);
          return sourceId ? [{ sourceId, canonicalUrl: document.canonicalUrl }] : [];
        });
      },
      readCrawleeEvidence: async (path) => JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>,
      output: console.log,
    });
  } finally {
    await Promise.all([legacyClient.close(), crawleeClient.close()]);
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
