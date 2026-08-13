import { DANISH_JSONLD_SOURCES, legacySourceSitesFor } from "./source-registry.js";

const REQUIRED_NORMALIZED_FIELDS = ["title", "ingredients", "instructions"] as const;
const MIN_URL_COVERAGE = 0.95;
const MIN_REQUIRED_FIELD_AGREEMENT = 0.99;

type RequiredField = (typeof REQUIRED_NORMALIZED_FIELDS)[number];

export interface LegacyComparisonRecipe {
  sourceId: string;
  canonicalUrl: string;
  title?: unknown;
  ingredients?: unknown;
  instructions?: unknown;
}

export interface CrawleeComparisonRecipe {
  sourceId: string;
  canonicalUrl: string;
  normalized: Record<string, unknown>;
}

export interface MigrationComparisonObservation {
  sourceId: string;
  mongoFailures?: number;
  rejectedIncompleteJsonLd?: number;
  rejectedMalformedJsonLd?: number;
  unintendedOffDomainAdmissions?: number;
}

export interface MigrationComparisonInput {
  sourceIds: string[];
  legacy: LegacyComparisonRecipe[];
  crawlee: CrawleeComparisonRecipe[];
  observations: MigrationComparisonObservation[];
}

export interface MigrationComparisonSourceReport {
  sourceId: string;
  legacyUrlCount: number;
  crawleeUrlCount: number;
  intersectionUrlCount: number;
  urlCoverage: number;
  requiredFieldPresenceChecks: number;
  requiredFieldPresenceAgreements: number;
  requiredFieldPresenceAgreement: number;
  missingCrawleeRequiredFields: number;
  mongoErrors: number;
  unintendedOffDomainAdmissions: number;
  passed: boolean;
}

export interface MigrationComparisonReport {
  sources: MigrationComparisonSourceReport[];
  aggregate: Omit<MigrationComparisonSourceReport, "sourceId">;
}

export interface MigrationComparisonOptions {
  legacyDatabase: string;
  crawleeDatabase: string;
  sourceIds: string[];
  scrapyEvidencePath: string;
  crawleeEvidencePath: string;
}

export interface MigrationComparisonDependencies {
  readLegacy: (
    database: string,
    sourceIds: string[]
  ) => Promise<LegacyComparisonRecipe[]>;
  readCrawlee: (
    database: string,
    sourceIds: string[]
  ) => Promise<CrawleeComparisonRecipe[]>;
  readScrapyEvidence: (path: string) => Promise<unknown>;
  readCrawleeEvidence: (
    path: string
  ) => Promise<{
    database?: unknown;
    selectedSources?: unknown;
    observations?: unknown;
  }>;
  output: (line: string) => void;
}

export function parseMigrationComparisonArgs(args: string[]): MigrationComparisonOptions {
  const values = new Map<string, string>();
  const expected = new Set([
    "--legacy-db",
    "--crawlee-db",
    "--sources",
    "--scrapy-evidence",
    "--crawlee-evidence",
  ]);

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!expected.has(flag)) throw new Error(`Unknown option: ${flag}`);
    if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
    if (values.has(flag)) throw new Error(`${flag} may only be supplied once`);
    values.set(flag, value);
  }

  const required = (flag: string) => {
    const value = values.get(flag);
    if (!value) throw new Error(`${flag} is required`);
    return value;
  };
  const legacyDatabase = required("--legacy-db");
  const crawleeDatabase = required("--crawlee-db");
  const sourceIds = [...new Set(required("--sources").split(",").map((value) => value.trim()).filter(Boolean))];
  if (sourceIds.length === 0) throw new Error("--sources requires at least one source id");
  for (const sourceId of sourceIds) {
    if (!DANISH_JSONLD_SOURCES.some((source) => source.id === sourceId)) {
      throw new Error(`Unknown Danish JSON-LD source: "${sourceId}"`);
    }
  }

  return {
    legacyDatabase,
    crawleeDatabase,
    sourceIds,
    scrapyEvidencePath: required("--scrapy-evidence"),
    crawleeEvidencePath: required("--crawlee-evidence"),
  };
}

export async function executeMigrationComparison(
  options: MigrationComparisonOptions,
  dependencies: MigrationComparisonDependencies
): Promise<MigrationComparisonReport> {
  const [legacy, crawlee, scrapyEvidence, crawleeEvidence] = await Promise.all([
    dependencies.readLegacy(options.legacyDatabase, options.sourceIds),
    dependencies.readCrawlee(options.crawleeDatabase, options.sourceIds),
    dependencies.readScrapyEvidence(options.scrapyEvidencePath),
    dependencies.readCrawleeEvidence(options.crawleeEvidencePath),
  ]);
  assertScrapyEvidence(scrapyEvidence, options);
  const observations = assertCrawleeEvidence(crawleeEvidence, options);
  const report = createMigrationComparisonReport({
    sourceIds: options.sourceIds,
    legacy,
    crawlee,
    observations,
  });
  dependencies.output(JSON.stringify({
    legacyDatabase: options.legacyDatabase,
    crawleeDatabase: options.crawleeDatabase,
    sourceIds: options.sourceIds,
    ...report,
  }, null, 2));
  return report;
}

export function createMigrationComparisonReport(
  input: MigrationComparisonInput
): MigrationComparisonReport {
  const sources = input.sourceIds.map((sourceId) => createSourceReport(sourceId, input));
  const aggregateCounts = sources.reduce((total, source) => ({
    legacyUrlCount: total.legacyUrlCount + source.legacyUrlCount,
    crawleeUrlCount: total.crawleeUrlCount + source.crawleeUrlCount,
    intersectionUrlCount: total.intersectionUrlCount + source.intersectionUrlCount,
    requiredFieldPresenceChecks: total.requiredFieldPresenceChecks + source.requiredFieldPresenceChecks,
    requiredFieldPresenceAgreements:
      total.requiredFieldPresenceAgreements + source.requiredFieldPresenceAgreements,
    missingCrawleeRequiredFields: total.missingCrawleeRequiredFields + source.missingCrawleeRequiredFields,
    mongoErrors: total.mongoErrors + source.mongoErrors,
    unintendedOffDomainAdmissions: total.unintendedOffDomainAdmissions + source.unintendedOffDomainAdmissions,
  }), emptyCounts());
  const aggregate = withGates(aggregateCounts);

  return {
    sources,
    aggregate: {
      ...aggregate,
      passed: aggregate.passed && sources.every((source) => source.passed),
    },
  };
}

function createSourceReport(
  sourceId: string,
  input: MigrationComparisonInput
): MigrationComparisonSourceReport {
  const legacy = new Map(input.legacy
    .filter((recipe) => recipe.sourceId === sourceId)
    .map((recipe) => [recipe.canonicalUrl, recipe]));
  const crawlee = new Map(input.crawlee
    .filter((recipe) => recipe.sourceId === sourceId)
    .map((recipe) => [recipe.canonicalUrl, recipe]));
  const intersection = [...legacy.keys()].filter((url) => crawlee.has(url));
  let requiredFieldPresenceAgreements = 0;
  let missingCrawleeRequiredFields = 0;
  for (const url of intersection) {
    const legacyRecipe = legacy.get(url)!;
    const crawleeRecipe = crawlee.get(url)!;
    for (const field of REQUIRED_NORMALIZED_FIELDS) {
      const crawleePresent = fieldPresent(crawleeRecipe.normalized[field]);
      if (!crawleePresent) missingCrawleeRequiredFields += 1;
      if (fieldPresent(legacyRecipe[field]) && crawleePresent) {
        requiredFieldPresenceAgreements += 1;
      }
    }
  }
  const counts = {
    legacyUrlCount: legacy.size,
    crawleeUrlCount: crawlee.size,
    intersectionUrlCount: intersection.length,
    requiredFieldPresenceChecks: intersection.length * REQUIRED_NORMALIZED_FIELDS.length,
    requiredFieldPresenceAgreements,
    missingCrawleeRequiredFields,
    mongoErrors: input.observations
      .filter((observation) => observation.sourceId === sourceId)
      .reduce((total, observation) => total + (observation.mongoFailures ?? 0), 0),
    unintendedOffDomainAdmissions: input.observations
      .filter((observation) => observation.sourceId === sourceId)
      .reduce((total, observation) => total + (observation.unintendedOffDomainAdmissions ?? 0), 0),
  };
  return { sourceId, ...withGates(counts) };
}

function emptyCounts() {
  return {
    legacyUrlCount: 0,
    crawleeUrlCount: 0,
    intersectionUrlCount: 0,
    requiredFieldPresenceChecks: 0,
    requiredFieldPresenceAgreements: 0,
    missingCrawleeRequiredFields: 0,
    mongoErrors: 0,
    unintendedOffDomainAdmissions: 0,
  };
}

function withGates(counts: ReturnType<typeof emptyCounts>) {
  const urlCoverage = counts.legacyUrlCount === 0
    ? 0
    : counts.intersectionUrlCount / counts.legacyUrlCount;
  const requiredFieldPresenceAgreement = counts.requiredFieldPresenceChecks === 0
    ? 0
    : counts.requiredFieldPresenceAgreements / counts.requiredFieldPresenceChecks;
  return {
    ...counts,
    urlCoverage,
    requiredFieldPresenceAgreement,
    passed:
      urlCoverage >= MIN_URL_COVERAGE &&
      requiredFieldPresenceAgreement >= MIN_REQUIRED_FIELD_AGREEMENT &&
      counts.missingCrawleeRequiredFields === 0 &&
      counts.mongoErrors === 0 &&
      counts.unintendedOffDomainAdmissions === 0,
  };
}

function fieldPresent(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
}

/** Query legacy recipes by their effective normalized `source_site` values. */
export function legacyMongoQueryFor(sourceIds: string[]): { source_site: { $in: string[] } } {
  return { source_site: { $in: sourceIds.flatMap(legacySourceSitesFor) } };
}

/** Convert a legacy normalized `source_site` value back to the V2 registry source ID. */
export function legacyRecipeSourceId(sourceSite: string): string | undefined {
  return DANISH_JSONLD_SOURCES.find((source) =>
    legacySourceSitesFor(source.id).includes(sourceSite)
  )?.id;
}

export function migrationComparisonExitCode(report: MigrationComparisonReport): number {
  return report.aggregate.passed ? 0 : 2;
}

export interface ComparisonClient {
  connect(): Promise<unknown>;
  close(): Promise<unknown>;
}

/** Always closes both clients, including when the other client's connect fails. */
export async function withComparisonClients<T>(
  clients: readonly ComparisonClient[],
  run: () => Promise<T>
): Promise<T> {
  try {
    await Promise.all(clients.map((client) => client.connect()));
    return await run();
  } finally {
    await Promise.allSettled(clients.map((client) => client.close()));
  }
}

/**
 * Injectable CLI boundary: emit the report before setting a nonzero process
 * status, while retaining connection cleanup for every connect outcome.
 */
export async function runMigrationComparisonCli(input: {
  options: MigrationComparisonOptions;
  clients: readonly ComparisonClient[];
  dependencies: MigrationComparisonDependencies;
  setExitCode: (code: number) => void;
}): Promise<MigrationComparisonReport> {
  const report = await withComparisonClients(input.clients, () =>
    executeMigrationComparison(input.options, input.dependencies)
  );
  input.setExitCode(migrationComparisonExitCode(report));
  return report;
}

function assertScrapyEvidence(evidence: unknown, options: MigrationComparisonOptions): void {
  const record = asRecord(evidence, "Scrapy evidence");
  assertExactSourceSet(record.selected_spiders, options.sourceIds, "Scrapy evidence sources", "spider");
  if (record.processing_mode !== "full") {
    throw new Error("Scrapy evidence must be a full uncapped run");
  }
  const results = exactResultBySource(record.results, options.sourceIds, "Scrapy evidence", "spider");
  for (const sourceId of options.sourceIds) {
    const result = results.get(sourceId)!;
    if (result.outcome !== "succeeded") {
      throw new Error(`Scrapy evidence source ${sourceId} did not succeed`);
    }
    if (result.timed_out !== false || result.interrupted !== false ||
      result.process_completed !== true || result.crawl_healthy !== true ||
      result.stats_dump_observed !== true) {
      throw new Error(`Scrapy evidence source ${sourceId} is incomplete`);
    }
    const stats = asRecord(result.stats, `Scrapy evidence stats for ${sourceId}`);
    if (Object.keys(stats).length === 0) {
      throw new Error(`Scrapy evidence source ${sourceId} has incomplete stats`);
    }
    if (stringArrayField(result, "outcome_reasons", `Scrapy evidence source ${sourceId}`).length > 0) {
      throw new Error(`Scrapy evidence source ${sourceId} has outcome reasons`);
    }
  }
}

function assertCrawleeEvidence(
  evidence: unknown,
  options: MigrationComparisonOptions
): MigrationComparisonObservation[] {
  const record = asRecord(evidence, "Crawlee evidence");
  if (record.database !== options.crawleeDatabase) {
    throw new Error("Crawlee evidence database does not match --crawlee-db");
  }
  assertExactSourceSet(record.selectedSources, options.sourceIds, "Crawlee evidence sources", "sourceId");
  if (record.maxPages !== null) throw new Error("Crawlee evidence must be uncapped");

  const summary = asRecord(record.summary, "Crawlee evidence summary");
  const outcomes = exactResultBySource(summary.sourceOutcomes, options.sourceIds, "Crawlee source outcomes", "sourceId");
  for (const sourceId of options.sourceIds) {
    const outcome = outcomes.get(sourceId)!;
    if (outcome.outcome !== "succeeded") {
      throw new Error(`Crawlee evidence source ${sourceId} did not succeed`);
    }
    if (stringArrayField(outcome, "outcomeReasons", `Crawlee evidence source ${sourceId}`).length > 0) {
      throw new Error(`Crawlee evidence source ${sourceId} has outcome reasons`);
    }
  }

  const rawObservations = exactResultBySource(record.observations, options.sourceIds, "Crawlee observations", "sourceId");
  return options.sourceIds.map((sourceId) => {
    const observation = rawObservations.get(sourceId)!;
    if (observation.discoveryComplete !== true || observation.pageCapReached === true) {
      throw new Error(`Crawlee evidence source ${sourceId} has incomplete discovery`);
    }
    const context = `Crawlee observation for ${sourceId}`;
    const mongoFailures = numberField(observation, "mongoFailures", context);
    const rejectedIncompleteJsonLd = numberField(observation, "rejectedIncompleteJsonLd", context);
    const rejectedMalformedJsonLd = numberField(observation, "rejectedMalformedJsonLd", context);
    const unintendedOffDomainAdmissions = numberField(observation, "unintendedOffDomainAdmissions", context);
    if (mongoFailures !== 0 || rejectedIncompleteJsonLd !== 0 || rejectedMalformedJsonLd !== 0) {
      throw new Error(`Crawlee evidence source ${sourceId} has failed quality gates`);
    }
    return {
      sourceId,
      mongoFailures,
      rejectedIncompleteJsonLd,
      rejectedMalformedJsonLd,
      unintendedOffDomainAdmissions,
    };
  });
}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} is malformed`);
  }
  return value as Record<string, unknown>;
}

function assertExactSourceSet(
  value: unknown,
  sourceIds: string[],
  context: string,
  _field: string
): void {
  if (!Array.isArray(value) || value.length !== sourceIds.length ||
    new Set(value).size !== value.length || !value.every((sourceId) => typeof sourceId === "string") ||
    [...value].sort().join(",") !== [...sourceIds].sort().join(",")) {
    throw new Error(`${context} do not match --sources`);
  }
}

function exactResultBySource(
  value: unknown,
  sourceIds: string[],
  context: string,
  field: string
): Map<string, Record<string, unknown>> {
  if (!Array.isArray(value) || value.length !== sourceIds.length) {
    throw new Error(`${context} must contain one terminal result per selected source`);
  }
  const results = new Map<string, Record<string, unknown>>();
  for (const item of value) {
    const result = asRecord(item, context);
    const sourceId = result[field];
    if (typeof sourceId !== "string" || !sourceIds.includes(sourceId) || results.has(sourceId)) {
      throw new Error(`${context} must contain one terminal result per selected source`);
    }
    results.set(sourceId, result);
  }
  if (results.size !== sourceIds.length) {
    throw new Error(`${context} must contain one terminal result per selected source`);
  }
  return results;
}

function numberField(record: Record<string, unknown>, field: string, context: string): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${context} has missing or malformed ${field}`);
  }
  return value;
}

function stringArrayField(record: Record<string, unknown>, field: string, context: string): string[] {
  const value = record[field];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${context} has missing or malformed ${field}`);
  }
  return value;
}
