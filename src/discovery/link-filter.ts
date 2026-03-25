import {
  DENYLIST_PATTERNS,
  RECIPE_PATH_PATTERNS,
  DISCOVERY,
} from "../config.js";

interface EnqueueOptions {
  isDanishRecipe?: boolean;
}

export class LinkFilter {
  private domainPageCounts = new Map<string, number>();
  private maxPagesPerDomain: number;
  private totalEnqueued = 0;

  constructor(maxPagesPerDomain?: number) {
    this.maxPagesPerDomain =
      maxPagesPerDomain ?? DISCOVERY.defaultMaxPagesPerDomain;
  }

  shouldEnqueue(url: string, options?: EnqueueOptions): boolean {
    if (this.totalEnqueued >= DISCOVERY.globalQueueCap) {
      return false;
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }

    if (DENYLIST_PATTERNS.some((pattern) => pattern.test(parsed.pathname))) {
      return false;
    }

    const domain = parsed.hostname;
    const count = this.domainPageCounts.get(domain) ?? 0;
    if (count >= this.maxPagesPerDomain) {
      return false;
    }

    if (domain.endsWith(".dk")) {
      this.totalEnqueued++;
      return true;
    }

    if (options?.isDanishRecipe) {
      this.totalEnqueued++;
      return true;
    }

    return false;
  }

  shouldFollowLink(
    url: string,
    fromRecipePage: boolean,
    isRecipe: boolean,
    nonRecipeHops: number
  ): boolean {
    if (isRecipe) return true;
    if (fromRecipePage && nonRecipeHops < DISCOVERY.maxNonRecipeHops)
      return true;
    return false;
  }

  isRecipeLikeUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return RECIPE_PATH_PATTERNS.some((pattern) =>
        pattern.test(parsed.pathname)
      );
    } catch {
      return false;
    }
  }

  recordPageCrawled(domain: string): void {
    const count = this.domainPageCounts.get(domain) ?? 0;
    this.domainPageCounts.set(domain, count + 1);
  }

  getDomainCount(domain: string): number {
    return this.domainPageCounts.get(domain) ?? 0;
  }

  getTotalEnqueued(): number {
    return this.totalEnqueued;
  }
}
