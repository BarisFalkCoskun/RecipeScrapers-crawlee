import { config } from "dotenv";
import { RecipeStore } from "../storage/mongodb.js";

config();

const DEFAULT_LIMIT = 10;

async function main() {
  const mongoUri = process.env["MONGODB_URI"] ?? "mongodb://localhost:27017";
  const dbName = process.env["DB_NAME"] ?? "danishRecipes";
  const limit = parseLimit(process.env["LIMIT"]);

  const store = new RecipeStore(mongoUri, dbName);
  await store.connect();

  try {
    const runs = (await store.listCrawlRuns())
      .sort(
        (a, b) => b.finishedAt.getTime() - a.finishedAt.getTime()
      )
      .slice(0, limit);

    if (runs.length === 0) {
      console.log("No crawl runs found.");
      return;
    }

    console.log(
      "Finished At           Processed  Recipes  Yield   Fallback  OffDom  NewDom  Skips  Seeds"
    );

    for (const run of runs) {
      const summary = run.summary;
      const offDomainAdmissions = summary.offDomainAdmissions ?? 0;
      const newlyAdmittedDomains = summary.newlyAdmittedDomains ?? [];
      const fallbacksByReason = summary.playwrightFallbacksByReason ?? {};
      console.log(
        [
          run.finishedAt.toISOString(),
          padLeft(summary.processedPages, 9),
          padLeft(summary.extractedRecipes, 7),
          padLeft(formatPercent(summary.recipePageYield), 6),
          padLeft(formatPercent(summary.fallbackRate), 8),
          padLeft(offDomainAdmissions, 6),
          padLeft(newlyAdmittedDomains.length, 6),
          padLeft(summary.recrawlSkips, 5),
          run.seeds.length,
        ].join("  ")
      );

      if (newlyAdmittedDomains.length > 0) {
        console.log(
          `  new domains: ${newlyAdmittedDomains.join(", ")}`
        );
      }

      if (Object.keys(fallbacksByReason).length > 0) {
        console.log(
          `  fallback reasons: ${Object.entries(fallbacksByReason)
            .map(([reason, count]) => `${reason}=${count}`)
            .join(", ")}`
        );
      }
    }

    if (runs.length >= 2) {
      const latest = runs[0];
      const previous = runs[1];
      console.log("");
      console.log(
        `Latest vs previous: processed ${formatDelta(
          latest.summary.processedPages - previous.summary.processedPages
        )}, recipes ${formatDelta(
          latest.summary.extractedRecipes - previous.summary.extractedRecipes
        )}, yield ${formatPercentDelta(
          latest.summary.recipePageYield - previous.summary.recipePageYield
        )}, fallback ${formatPercentDelta(
          latest.summary.fallbackRate - previous.summary.fallbackRate
        )}, off-domain ${formatDelta(
          (latest.summary.offDomainAdmissions ?? 0) -
            (previous.summary.offDomainAdmissions ?? 0)
        )}, new domains ${formatDelta(
          (latest.summary.newlyAdmittedDomains ?? []).length -
            (previous.summary.newlyAdmittedDomains ?? []).length
        )}, skips ${formatDelta(
          latest.summary.recrawlSkips - previous.summary.recrawlSkips
        )}`
      );
    }
  } finally {
    await store.close();
  }
}

function parseLimit(rawValue: string | undefined): number {
  if (!rawValue) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return parsed;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDelta(value: number): string {
  return value === 0 ? "0" : value > 0 ? `+${value}` : `${value}`;
}

function formatPercentDelta(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}pp`;
}

function padLeft(value: number | string, width: number): string {
  return String(value).padStart(width, " ");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
