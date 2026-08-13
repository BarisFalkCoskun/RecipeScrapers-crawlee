import type {
  DanishJsonLdRunSummary,
  SourceOutcomeReason,
  SourceRunOutcomeSummary,
} from "../types.js";

export interface SourceRunObservation {
  sourceId: string;
  persistedRecipes?: number;
  completedRequests?: number;
  failedRequests?: number;
  blockedRequests?: number;
  discoveredRecipeCandidates?: number;
  rejectedIncompleteJsonLd?: number;
  playwrightFailures?: number;
  mongoFailures?: number;
  discoveryComplete: boolean;
}

export function classifySourceOutcome(
  observation: SourceRunObservation
): SourceRunOutcomeSummary {
  const reasons = outcomeReasons(observation);
  const persistedRecipes = observation.persistedRecipes ?? 0;

  if ((observation.mongoFailures ?? 0) > 0) {
    return { sourceId: observation.sourceId, outcome: "failed", outcomeReasons: reasons };
  }
  if (persistedRecipes === 0 && (observation.playwrightFailures ?? 0) > 0) {
    return { sourceId: observation.sourceId, outcome: "failed", outcomeReasons: reasons };
  }
  if (persistedRecipes === 0 && (observation.failedRequests ?? 0) > 0) {
    return { sourceId: observation.sourceId, outcome: "failed", outcomeReasons: reasons };
  }
  if (persistedRecipes === 0 && (observation.blockedRequests ?? 0) > 0) {
    return { sourceId: observation.sourceId, outcome: "blocked", outcomeReasons: reasons };
  }
  if (persistedRecipes > 0 && hasIncompleteWork(observation)) {
    return { sourceId: observation.sourceId, outcome: "partial", outcomeReasons: reasons };
  }
  if (persistedRecipes > 0) {
    return { sourceId: observation.sourceId, outcome: "succeeded", outcomeReasons: reasons };
  }
  if (hasIncompleteWork(observation) || (observation.discoveredRecipeCandidates ?? 0) > 0) {
    return { sourceId: observation.sourceId, outcome: "partial", outcomeReasons: reasons };
  }
  return { sourceId: observation.sourceId, outcome: "no_data", outcomeReasons: reasons };
}

export function createDanishJsonLdRunSummary(
  sourceOutcomes: SourceRunOutcomeSummary[]
): DanishJsonLdRunSummary {
  return { robotsEnforced: false, sourceOutcomes };
}

function hasIncompleteWork(observation: SourceRunObservation): boolean {
  return (
    (observation.failedRequests ?? 0) > 0 ||
    (observation.rejectedIncompleteJsonLd ?? 0) > 0 ||
    (observation.playwrightFailures ?? 0) > 0 ||
    (observation.mongoFailures ?? 0) > 0 ||
    !observation.discoveryComplete
  );
}

function outcomeReasons(observation: SourceRunObservation): SourceOutcomeReason[] {
  const reasons: SourceOutcomeReason[] = [];
  if ((observation.persistedRecipes ?? 0) > 0) reasons.push("recipes-persisted");
  if ((observation.failedRequests ?? 0) > 0) reasons.push("failed-requests");
  if ((observation.blockedRequests ?? 0) > 0) reasons.push("requests-blocked");
  if ((observation.discoveredRecipeCandidates ?? 0) > 0) reasons.push("recipe-candidates-discovered");
  if ((observation.rejectedIncompleteJsonLd ?? 0) > 0) reasons.push("incomplete-json-ld-rejected");
  if ((observation.playwrightFailures ?? 0) > 0) reasons.push("playwright-failure");
  if ((observation.mongoFailures ?? 0) > 0) reasons.push("mongo-failure");
  if (!observation.discoveryComplete) reasons.push("discovery-incomplete");
  if (reasons.length === 0) reasons.push("no-recipe-candidates");
  return reasons.sort();
}
