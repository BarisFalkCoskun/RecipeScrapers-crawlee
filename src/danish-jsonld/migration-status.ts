import { DANISH_JSONLD_SOURCES } from "./source-registry.js";

export type MigrationStatusFormat = "console" | "markdown" | "json";

export interface MigrationStatusRow {
  source: string;
  domain: string;
  discoveryMode: string;
  fetchMode: string;
  scrapyOutcome: string;
  crawleeState: string;
  latestCanary: string | null;
  shadowParity: string | null;
  cutoverDate: string | null;
  reason: string | null;
}

export interface MigrationStatusReport {
  sources: MigrationStatusRow[];
}

export function createMigrationStatusReport(): MigrationStatusReport {
  return {
    sources: DANISH_JSONLD_SOURCES.map((source) => ({
      source: source.id,
      domain: source.domain,
      discoveryMode: source.discovery,
      fetchMode: source.fetchMode,
      scrapyOutcome: source.latestScrapyOutcome,
      crawleeState: source.migrationState,
      latestCanary: source.latestCanary ?? null,
      shadowParity: source.shadowParity ?? null,
      cutoverDate: source.cutoverDate ?? null,
      reason: source.deferOrBlockReason ?? null,
    })),
  };
}

export function renderMigrationStatus(
  report: MigrationStatusReport,
  format: MigrationStatusFormat
): string {
  if (format === "json") return JSON.stringify(report, null, 2);

  const headers = [
    "Source",
    "Domain",
    "Discovery",
    "Fetch",
    "Scrapy",
    "Crawlee",
    "Canary",
    "Shadow parity",
    "Cutover date",
    "Reason",
  ];
  const values = (row: MigrationStatusRow) => [
    row.source,
    row.domain,
    row.discoveryMode,
    row.fetchMode,
    row.scrapyOutcome,
    row.crawleeState,
    row.latestCanary ?? "",
    row.shadowParity ?? "",
    row.cutoverDate ?? "",
    row.reason ?? "",
  ];

  if (format === "markdown") {
    return [
      `| ${headers.join(" | ")} |`,
      `| ${headers.map(() => "---").join(" | ")} |`,
      ...report.sources.map((row) => `| ${values(row).join(" | ")} |`),
    ].join("\n");
  }

  return [
    "Danish JSON-LD migration status",
    headers.join("\t"),
    ...report.sources.map((row) => values(row).join("\t")),
  ].join("\n");
}
