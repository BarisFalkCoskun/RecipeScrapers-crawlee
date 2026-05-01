import { DISCOVERY, RECIPE_DISCOVERY_KEYWORDS } from "../config.js";
import type { DiscoverySource } from "../types.js";
import { normalizeDomain } from "../utils/canonicalize.js";
import type { RequestCandidate } from "./enqueue-fresh.js";
import { LinkFilter } from "./link-filter.js";

export interface AdmissionDecision {
  allowed: boolean;
  score: number;
  reasons: string[];
  crossDomain: boolean;
}

interface EvaluateAdmissionOptions {
  sourceDomain: string;
  sourceIsTrusted: boolean;
  sourceIsRecipePage: boolean;
  sourceDiscoverySource: DiscoverySource;
  sourceHasRecipeSignals: boolean;
  trustedSeedDomains: Set<string>;
  linkFilter: LinkFilter;
}

interface FollowLinkOptions {
  decision: AdmissionDecision;
  isRecipeLike: boolean;
  sourceIsTrusted: boolean;
  nonRecipeHops: number;
}

export function evaluateAdmission(
  candidate: RequestCandidate,
  options: EvaluateAdmissionOptions
): AdmissionDecision {
  const sourceDomain = normalizeDomain(options.sourceDomain);
  const candidateDomain = normalizeDomain(candidate.domain);
  const crossDomain = candidateDomain !== sourceDomain;

  const queueEligibility = options.linkFilter.getQueueEligibility(
    candidate.canonicalUrl,
    {
      allowSoftDiscovery: options.sourceIsTrusted,
    }
  );
  if (!queueEligibility.allowed) {
    return {
      allowed: false,
      score: 0,
      reasons: queueEligibility.reasons,
      crossDomain,
    };
  }

  const reasons = [...queueEligibility.reasons];
  let score = 0;

  if (options.linkFilter.isRecipeLikeUrl(candidate.canonicalUrl)) {
    score += 1;
    reasons.push("recipe-like-url");
  }

  if (hasRecipeAnchorText(candidate.anchorText)) {
    score += 1;
    reasons.push("recipe-anchor-text");
  }

  if (options.sourceDiscoverySource === "sitemap") {
    score += 1;
    reasons.push("sitemap-referrer");
  }

  if (options.sourceIsRecipePage) {
    score += 1;
    reasons.push("confirmed-recipe-referrer");
  }

  if (options.sourceHasRecipeSignals) {
    score += 1;
    reasons.push("source-recipe-signals");
  }

  if (!crossDomain) {
    if (
      options.sourceIsTrusted &&
      options.trustedSeedDomains.has(candidateDomain)
    ) {
      reasons.push("same-domain-trusted-seed");
      return {
        allowed: true,
        score: Math.max(score, 1),
        reasons: uniqueReasons(reasons),
        crossDomain: false,
      };
    }

    if (options.sourceIsTrusted || score > 0) {
      reasons.push(
        options.sourceIsTrusted
          ? "same-domain-trusted-source"
          : "same-domain-recipe-evidence"
      );
      return {
        allowed: true,
        score,
        reasons: uniqueReasons(reasons),
        crossDomain: false,
      };
    }

    reasons.push("same-domain-insufficient-evidence");
    return {
      allowed: false,
      score,
      reasons: uniqueReasons(reasons),
      crossDomain: false,
    };
  }

  if (!options.sourceIsTrusted) {
    reasons.push("untrusted-cross-domain-source");
    return {
      allowed: false,
      score,
      reasons: uniqueReasons(reasons),
      crossDomain: true,
    };
  }

  if (score < DISCOVERY.minCrossDomainAdmissionScore) {
    reasons.push("insufficient-cross-domain-score");
    return {
      allowed: false,
      score,
      reasons: uniqueReasons(reasons),
      crossDomain: true,
    };
  }

  reasons.push("trusted-cross-domain-admission");
  return {
    allowed: true,
    score,
    reasons: uniqueReasons(reasons),
    crossDomain: true,
  };
}

export function shouldFollowCandidate({
  decision,
  isRecipeLike,
  sourceIsTrusted,
  nonRecipeHops,
}: FollowLinkOptions): boolean {
  if (!decision.allowed) {
    return false;
  }

  if (isRecipeLike) {
    return true;
  }

  if (decision.crossDomain) {
    return nonRecipeHops < DISCOVERY.maxOffDomainNonRecipeHops;
  }

  if (sourceIsTrusted) {
    return nonRecipeHops < DISCOVERY.maxTrustedDomainNonRecipeHops;
  }

  return false;
}

function hasRecipeAnchorText(anchorText: string | undefined): boolean {
  if (!anchorText) {
    return false;
  }

  const normalized = anchorText.toLowerCase();
  return RECIPE_DISCOVERY_KEYWORDS.some((keyword) =>
    normalized.includes(keyword)
  );
}

function uniqueReasons(reasons: string[]): string[] {
  return Array.from(new Set(reasons));
}
