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
  processedRecipePages?: number;
  rejectedIncompleteJsonLd?: number;
  rejectedMalformedJsonLd?: number;
  playwrightFailures?: number;
  mongoFailures?: number;
  /** Requests that reached a queue despite falling outside the source allowlist. */
  unintendedOffDomainAdmissions?: number;
  pageCapReached?: boolean;
  discoveryComplete: boolean;
  discoveryFailureReasons?: SourceOutcomeReason[];
  /** Bounded sample of canonical URLs rejected at the domain boundary. */
  rejectedCanonicalUrls?: string[];
  /** Bounded sample of terminally failed requests, with their cause. */
  failedRequestSamples?: Array<{
    url: string;
    statusCode: number | null;
    error: string;
  }>;
}

export function classifySourceOutcome(
  observation: SourceRunObservation
): SourceRunOutcomeSummary {
  const persistedRecipes = observation.persistedRecipes ?? 0;

  if (persistedRecipes > 0 && !hasIncompleteWork(observation) && (observation.blockedRequests ?? 0) === 0) {
    return { sourceId: observation.sourceId, outcome: "succeeded", outcomeReasons: [] };
  }
  const reasons = outcomeReasons(observation);
  if (persistedRecipes > 0 && (hasIncompleteWork(observation) || (observation.blockedRequests ?? 0) > 0)) {
    return { sourceId: observation.sourceId, outcome: "partial", outcomeReasons: reasons };
  }
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
  if (persistedRecipes === 0 && (
    (observation.discoveredRecipeCandidates ?? 0) > 0 ||
    (observation.rejectedIncompleteJsonLd ?? 0) > 0 ||
    (observation.rejectedMalformedJsonLd ?? 0) > 0 ||
    hasIncompleteWork(observation)
  )) {
    return { sourceId: observation.sourceId, outcome: "failed", outcomeReasons: reasons };
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
    (observation.rejectedMalformedJsonLd ?? 0) > 0 ||
    (observation.playwrightFailures ?? 0) > 0 ||
    (observation.mongoFailures ?? 0) > 0 ||
    observation.pageCapReached === true ||
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
  if ((observation.rejectedMalformedJsonLd ?? 0) > 0) reasons.push("malformed-json-ld-rejected");
  if ((observation.playwrightFailures ?? 0) > 0) reasons.push("playwright-failure");
  if ((observation.mongoFailures ?? 0) > 0) reasons.push("mongo-failure");
  if (observation.pageCapReached === true) reasons.push("max-pages-cap-reached");
  if (!observation.discoveryComplete) reasons.push("discovery-incomplete");
  if (
    (observation.persistedRecipes ?? 0) === 0 &&
    (observation.processedRecipePages ?? 0) > 0 &&
    (observation.rejectedIncompleteJsonLd ?? 0) === 0 &&
    (observation.rejectedMalformedJsonLd ?? 0) === 0
  ) reasons.push("structured-extraction-empty");
  reasons.push(...(observation.discoveryFailureReasons ?? []));
  if (reasons.length === 0) reasons.push("no-recipe-candidates");
  return reasons.sort();
}
