import { DANISH_JSONLD_SOURCES } from "./source-registry.js";

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

export interface CrawleeAdmission {
  sourceId: string;
  canonicalUrl: string;
}

export interface MigrationComparisonObservation {
  sourceId: string;
  mongoFailures?: number;
}

export interface MigrationComparisonInput {
  sourceIds: string[];
  legacy: LegacyComparisonRecipe[];
  crawlee: CrawleeComparisonRecipe[];
  admissions: CrawleeAdmission[];
  observations: MigrationComparisonObservation[];
}

export interface MigrationComparisonSourceReport {
  sourceId: string;
  legacyUrlCount: number;
  crawleeUrlCount: number;
  intersectionUrlCount: number;
  urlCoverage: number;
  requiredFieldChecks: number;
  requiredFieldAgreements: number;
  requiredFieldAgreement: number;
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
  readCrawleeAdmissions: (
    database: string,
    sourceIds: string[]
  ) => Promise<CrawleeAdmission[]>;
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
    crawleeEvidencePath: required("--crawlee-evidence"),
  };
}

export async function executeMigrationComparison(
  options: MigrationComparisonOptions,
  dependencies: MigrationComparisonDependencies
): Promise<MigrationComparisonReport> {
  const [legacy, crawlee, admissions, evidence] = await Promise.all([
    dependencies.readLegacy(options.legacyDatabase, options.sourceIds),
    dependencies.readCrawlee(options.crawleeDatabase, options.sourceIds),
    dependencies.readCrawleeAdmissions(options.crawleeDatabase, options.sourceIds),
    dependencies.readCrawleeEvidence(options.crawleeEvidencePath),
  ]);
  assertEvidenceScope(evidence, options);
  const report = createMigrationComparisonReport({
    sourceIds: options.sourceIds,
    legacy,
    crawlee,
    admissions,
    observations: toObservations(evidence.observations),
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
    requiredFieldChecks: total.requiredFieldChecks + source.requiredFieldChecks,
    requiredFieldAgreements: total.requiredFieldAgreements + source.requiredFieldAgreements,
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
  let requiredFieldAgreements = 0;
  let missingCrawleeRequiredFields = 0;
  for (const url of intersection) {
    const legacyRecipe = legacy.get(url)!;
    const crawleeRecipe = crawlee.get(url)!;
    for (const field of REQUIRED_NORMALIZED_FIELDS) {
      const crawleePresent = fieldPresent(crawleeRecipe.normalized[field]);
      if (!crawleePresent) missingCrawleeRequiredFields += 1;
      if (fieldPresent(legacyRecipe[field]) && crawleePresent) {
        requiredFieldAgreements += 1;
      }
    }
  }
  const counts = {
    legacyUrlCount: legacy.size,
    crawleeUrlCount: crawlee.size,
    intersectionUrlCount: intersection.length,
    requiredFieldChecks: intersection.length * REQUIRED_NORMALIZED_FIELDS.length,
    requiredFieldAgreements,
    missingCrawleeRequiredFields,
    mongoErrors: input.observations
      .filter((observation) => observation.sourceId === sourceId)
      .reduce((total, observation) => total + (observation.mongoFailures ?? 0), 0),
    unintendedOffDomainAdmissions: input.admissions
      .filter((admission) => admission.sourceId === sourceId)
      .filter((admission) => !isAllowedSourceUrl(sourceId, admission.canonicalUrl)).length,
  };
  return { sourceId, ...withGates(counts) };
}

function emptyCounts() {
  return {
    legacyUrlCount: 0,
    crawleeUrlCount: 0,
    intersectionUrlCount: 0,
    requiredFieldChecks: 0,
    requiredFieldAgreements: 0,
    missingCrawleeRequiredFields: 0,
    mongoErrors: 0,
    unintendedOffDomainAdmissions: 0,
  };
}

function withGates(counts: ReturnType<typeof emptyCounts>) {
  const urlCoverage = counts.legacyUrlCount === 0
    ? 0
    : counts.intersectionUrlCount / counts.legacyUrlCount;
  const requiredFieldAgreement = counts.requiredFieldChecks === 0
    ? 0
    : counts.requiredFieldAgreements / counts.requiredFieldChecks;
  return {
    ...counts,
    urlCoverage,
    requiredFieldAgreement,
    passed:
      urlCoverage >= MIN_URL_COVERAGE &&
      requiredFieldAgreement >= MIN_REQUIRED_FIELD_AGREEMENT &&
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

function isAllowedSourceUrl(sourceId: string, value: string): boolean {
  const source = DANISH_JSONLD_SOURCES.find((candidate) => candidate.id === sourceId);
  if (!source) return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return source.allowedDomains.some((domain) =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

function assertEvidenceScope(
  evidence: { database?: unknown; selectedSources?: unknown },
  options: MigrationComparisonOptions
): void {
  if (evidence.database !== options.crawleeDatabase) {
    throw new Error("Crawlee evidence database does not match --crawlee-db");
  }
  if (!Array.isArray(evidence.selectedSources) ||
    evidence.selectedSources.join(",") !== options.sourceIds.join(",")) {
    throw new Error("Crawlee evidence sources do not match --sources");
  }
}

function toObservations(value: unknown): MigrationComparisonObservation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.sourceId !== "string") return [];
    return [{
      sourceId: candidate.sourceId,
      ...(typeof candidate.mongoFailures === "number"
        ? { mongoFailures: candidate.mongoFailures }
        : {}),
    }];
  });
}
