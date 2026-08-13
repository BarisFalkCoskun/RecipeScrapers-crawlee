import { readFile } from "node:fs/promises";
import { MongoClient } from "mongodb";
import { canonicalizeUrl } from "../utils/canonicalize.js";
import {
  legacyMongoQueryFor,
  legacyRecipeSourceId,
  parseMigrationComparisonArgs,
  runMigrationComparisonCli,
  type CrawleeComparisonRecipe,
  type LegacyComparisonRecipe,
} from "../danish-jsonld/migration-compare.js";

async function main() {
  const options = parseMigrationComparisonArgs(process.argv.slice(2));
  const legacyClient = new MongoClient(requiredEnv("LEGACY_MONGODB_URI"));
  const crawleeClient = new MongoClient(requiredEnv("CRAWLEE_MONGODB_URI"));
  await runMigrationComparisonCli({
    options,
    clients: [legacyClient, crawleeClient],
    dependencies: {
      readLegacy: async (database, sourceIds) => {
        const documents = await legacyClient.db(database).collection("recipes")
          .find(legacyMongoQueryFor(sourceIds))
          .project({ source_site: 1, url: 1, title: 1, ingredients: 1, instructions: 1 })
          .toArray();
        return documents.flatMap((document): LegacyComparisonRecipe[] => {
          if (typeof document.source_site !== "string" || typeof document.url !== "string") return [];
          const sourceId = legacyRecipeSourceId(document.source_site);
          if (!sourceId || !sourceIds.includes(sourceId)) return [];
          return [{
            sourceId,
            canonicalUrl: canonicalizeUrl(document.url),
            title: document.title,
            ingredients: document.ingredients,
            instructions: document.instructions,
          }];
        });
      },
      readCrawlee: async (database, sourceIds, crawlRunId) => {
        const documents = await crawleeClient.db(database).collection("recipes_v2")
          .find({ sourceId: { $in: sourceIds }, crawlRunId })
          .project({ sourceId: 1, sourceRecipeKey: 1, crawlRunId: 1, canonicalUrl: 1, normalized: 1 })
          .toArray();
        return documents.flatMap((document): CrawleeComparisonRecipe[] => {
          if (typeof document.sourceId !== "string" || typeof document.canonicalUrl !== "string" ||
            !document.normalized || typeof document.normalized !== "object") return [];
          return [{
            sourceId: document.sourceId,
            canonicalUrl: document.canonicalUrl,
            sourceRecipeKey: document.sourceRecipeKey,
            crawlRunId: document.crawlRunId,
            normalized: document.normalized as Record<string, unknown>,
          }];
        });
      },
      readScrapyEvidence: async (path) => JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>,
      readCrawleeEvidence: async (path) => JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>,
      output: console.log,
    },
    setExitCode: (code) => { process.exitCode = code; },
  });
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
