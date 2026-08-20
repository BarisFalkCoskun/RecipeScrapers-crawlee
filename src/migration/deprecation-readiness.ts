import type { DanishJsonLdSource, MigrationState } from "../danish-jsonld/source-registry.js";
import type { LegacyDanishSpider } from "./legacy-danish-inventory.js";

export interface DeprecationReadinessGap {
  sourceId: string;
  effectiveSourceId: string | null;
  state: MigrationState | "missing";
  reason: string | null;
}

export const OPERATIONAL_DEPRECATION_GATES = [
  "consumer-data-contract",
  "scheduler-and-monitoring-deployed",
  "rollback-validated",
  "observation-window-complete",
  "scrapy-retirement-approved",
] as const;

export type OperationalDeprecationGate =
  (typeof OPERATIONAL_DEPRECATION_GATES)[number];

export interface OperationalGateEvidence {
  passed: boolean;
  evidence: string;
  observedAt: string;
}

export interface OperationalDeprecationEvidence {
  schemaVersion: 1;
  gates: Partial<Record<OperationalDeprecationGate, OperationalGateEvidence>>;
}

export interface OperationalReadinessGap {
  gate: OperationalDeprecationGate;
  reason: string;
}

export interface DeprecationReadinessReport {
  readyForScrapyDeprecation: boolean;
  sourcesReadyForScrapyDeprecation: boolean;
  operationalGatesReady: boolean;
  operationalReadinessGaps: OperationalReadinessGap[];
  totalLegacySpiders: number;
  registeredLegacySpiders: number;
  missingSourceIds: string[];
  effectiveStateCounts: Record<string, number>;
  notCutover: DeprecationReadinessGap[];
}

/**
 * A registry entry proves implementation coverage, not retirement readiness.
 * Aliases inherit the canonical source's state so one physical crawl can
 * retire every legacy command that intentionally resolves to it.
 */
export function createDeprecationReadinessReport(
  legacySpiders: readonly LegacyDanishSpider[],
  sources: readonly DanishJsonLdSource[],
  operationalEvidence?: OperationalDeprecationEvidence
): DeprecationReadinessReport {
  const byId = new Map(sources.map((source) => [source.id, source]));
  const missingSourceIds: string[] = [];
  const notCutover: DeprecationReadinessGap[] = [];
  const effectiveStateCounts: Record<string, number> = {};

  for (const spider of legacySpiders) {
    const registered = byId.get(spider.id);
    if (!registered) {
      missingSourceIds.push(spider.id);
      effectiveStateCounts.missing = (effectiveStateCounts.missing ?? 0) + 1;
      notCutover.push({
        sourceId: spider.id,
        effectiveSourceId: null,
        state: "missing",
        reason: "No Crawlee registry entry",
      });
      continue;
    }

    const effective = registered.aliasFor
      ? byId.get(registered.aliasFor)
      : registered;
    if (!effective) {
      effectiveStateCounts.missing = (effectiveStateCounts.missing ?? 0) + 1;
      notCutover.push({
        sourceId: spider.id,
        effectiveSourceId: registered.aliasFor ?? null,
        state: "missing",
        reason: `Alias target ${registered.aliasFor ?? "unknown"} is not registered`,
      });
      continue;
    }

    effectiveStateCounts[effective.migrationState] =
      (effectiveStateCounts[effective.migrationState] ?? 0) + 1;
    if (effective.migrationState !== "cutover") {
      notCutover.push({
        sourceId: spider.id,
        effectiveSourceId: effective.id,
        state: effective.migrationState,
        reason: effective.deferOrBlockReason ?? null,
      });
    }
  }

  missingSourceIds.sort();
  notCutover.sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  const operationalReadinessGaps = operationalGaps(operationalEvidence);
  const sourcesReadyForScrapyDeprecation =
    missingSourceIds.length === 0 && notCutover.length === 0;
  const operationalGatesReady = operationalReadinessGaps.length === 0;
  return {
    readyForScrapyDeprecation:
      sourcesReadyForScrapyDeprecation && operationalGatesReady,
    sourcesReadyForScrapyDeprecation,
    operationalGatesReady,
    operationalReadinessGaps,
    totalLegacySpiders: legacySpiders.length,
    registeredLegacySpiders: legacySpiders.length - missingSourceIds.length,
    missingSourceIds,
    effectiveStateCounts: Object.fromEntries(
      Object.entries(effectiveStateCounts).sort(([left], [right]) => left.localeCompare(right))
    ),
    notCutover,
  };
}

function operationalGaps(
  evidence?: OperationalDeprecationEvidence
): OperationalReadinessGap[] {
  if (!evidence) {
    return OPERATIONAL_DEPRECATION_GATES.map((gate) => ({
      gate,
      reason: "No operational evidence file supplied",
    }));
  }
  if (evidence.schemaVersion !== 1 || typeof evidence.gates !== "object" || evidence.gates === null) {
    return OPERATIONAL_DEPRECATION_GATES.map((gate) => ({
      gate,
      reason: "Operational evidence must use schemaVersion 1 and contain a gates object",
    }));
  }
  return OPERATIONAL_DEPRECATION_GATES.flatMap((gate) => {
    const item = evidence.gates[gate];
    if (!item) return [{ gate, reason: "Gate evidence is missing" }];
    if (item.passed !== true) return [{ gate, reason: "Gate is not marked passed" }];
    if (typeof item.evidence !== "string" || item.evidence.trim() === "") {
      return [{ gate, reason: "Gate has no evidence reference" }];
    }
    if (
      typeof item.observedAt !== "string" ||
      item.observedAt.trim() === "" ||
      !Number.isFinite(Date.parse(item.observedAt))
    ) {
      return [{ gate, reason: "Gate observedAt is not a valid timestamp" }];
    }
    return [];
  });
}
