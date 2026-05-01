import {
  HARD_DENYLIST_PATTERNS,
  RECIPE_PATH_PATTERNS,
  DISCOVERY,
  SKIP_EXTENSIONS,
  SOFT_DISCOVERY_PATTERNS,
} from "../config.js";
import { KeyValueStore, log } from "crawlee";
import { normalizeDomain } from "../utils/canonicalize.js";

interface LinkFilterOptions {
  defaultMaxPagesPerDomain?: number;
  maxPagesByDomain?: Map<string, number>;
  persistStateKey?: string;
  stateStore?: LinkFilterStateStore;
}

interface LinkFilterState {
  domainPageCounts: [string, number][];
  domainAdmissionCounts: [string, number][];
  totalEnqueued: number;
}

interface LinkFilterStateStore {
  getValue<T = unknown>(key: string): Promise<T | null>;
  setValue(key: string, value: unknown): Promise<unknown>;
}

export interface QueueEligibilityResult {
  allowed: boolean;
  reasons: string[];
  domain?: string;
}

export interface QueueEligibilityOptions {
  allowSoftDiscovery?: boolean;
}

export class LinkFilter {
  private domainPageCounts = new Map<string, number>();
  private domainAdmissionCounts = new Map<string, number>();
  private maxPagesPerDomain: number;
  private maxPagesByDomain: Map<string, number>;
  private totalEnqueued = 0;
  private persistStateKey?: string;
  private stateStore?: LinkFilterStateStore;
  private pendingPersist: Promise<void> = Promise.resolve();
  private persistTimer?: ReturnType<typeof setTimeout>;

  constructor(options?: number | LinkFilterOptions) {
    if (typeof options === "number") {
      this.maxPagesPerDomain = options;
      this.maxPagesByDomain = new Map();
      return;
    }

    this.maxPagesPerDomain =
      options?.defaultMaxPagesPerDomain ?? DISCOVERY.defaultMaxPagesPerDomain;
    this.maxPagesByDomain = new Map(
      Array.from(options?.maxPagesByDomain ?? []).map(([domain, maxPages]) => [
        normalizeDomain(domain),
        maxPages,
      ])
    );
    this.persistStateKey = options?.persistStateKey;
    this.stateStore = options?.stateStore;
  }

  static async open(options?: number | LinkFilterOptions): Promise<LinkFilter> {
    const filter = new LinkFilter(options);
    await filter.restoreState();
    return filter;
  }

  getQueueEligibility(
    url: string,
    options: QueueEligibilityOptions = {}
  ): QueueEligibilityResult {
    if (this.totalEnqueued >= DISCOVERY.globalQueueCap) {
      return {
        allowed: false,
        reasons: ["global-queue-cap"],
      };
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return {
        allowed: false,
        reasons: ["invalid-url"],
      };
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        allowed: false,
        reasons: ["unsupported-protocol"],
      };
    }

    if (SKIP_EXTENSIONS.test(parsed.pathname)) {
      return {
        allowed: false,
        reasons: ["skip-extension"],
      };
    }

    if (HARD_DENYLIST_PATTERNS.some((pattern) => pattern.test(parsed.pathname))) {
      return {
        allowed: false,
        reasons: ["hard-denylist-pattern"],
      };
    }

    const softDiscoveryMatch = SOFT_DISCOVERY_PATTERNS.some((pattern) =>
      pattern.test(parsed.pathname)
    );
    if (softDiscoveryMatch && !options.allowSoftDiscovery) {
      return {
        allowed: false,
        reasons: ["soft-discovery-pattern"],
      };
    }

    const domain = normalizeDomain(parsed.hostname);
    const count = this.domainAdmissionCounts.get(domain) ?? 0;
    if (count >= this.getMaxPagesForDomain(domain)) {
      return {
        allowed: false,
        domain,
        reasons: ["domain-page-cap"],
      };
    }

    return {
      allowed: true,
      domain,
      reasons: [
        "queue-eligible",
        ...(softDiscoveryMatch ? ["trusted-soft-discovery"] : []),
      ],
    };
  }

  shouldEnqueue(url: string, options?: QueueEligibilityOptions): boolean {
    return this.getQueueEligibility(url, options).allowed;
  }

  shouldFollowLink(
    url: string,
    fromRecipePage: boolean,
    isRecipe: boolean,
    nonRecipeHops: number
  ): boolean {
    if (isRecipe) return true;
    if (
      fromRecipePage &&
      nonRecipeHops < DISCOVERY.maxOffDomainNonRecipeHops
    )
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
    const normalizedDomain = normalizeDomain(domain);
    const count = this.domainPageCounts.get(normalizedDomain) ?? 0;
    const nextCount = count + 1;
    this.domainPageCounts.set(normalizedDomain, nextCount);
    this.domainAdmissionCounts.set(
      normalizedDomain,
      Math.max(this.domainAdmissionCounts.get(normalizedDomain) ?? 0, nextCount)
    );
    this.schedulePersist();
  }

  getDomainCount(domain: string): number {
    return this.domainPageCounts.get(normalizeDomain(domain)) ?? 0;
  }

  getDomainAdmissionCount(domain: string): number {
    return this.domainAdmissionCounts.get(normalizeDomain(domain)) ?? 0;
  }

  recordEnqueued(items: number | string | string[] = 1): void {
    if (typeof items === "number") {
      this.totalEnqueued += items;
      this.schedulePersist();
      return;
    }

    const urls = Array.isArray(items) ? items : [items];
    this.totalEnqueued += urls.length;

    for (const url of urls) {
      try {
        const domain = normalizeDomain(new URL(url).hostname);
        this.domainAdmissionCounts.set(
          domain,
          (this.domainAdmissionCounts.get(domain) ?? 0) + 1
        );
      } catch {
        continue;
      }
    }

    this.schedulePersist();
  }

  getTotalEnqueued(): number {
    return this.totalEnqueued;
  }

  async close(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = undefined;
    }

    await this.pendingPersist;
    await this.persistState();
  }

  private getMaxPagesForDomain(domain: string): number {
    return this.maxPagesByDomain.get(normalizeDomain(domain)) ?? this.maxPagesPerDomain;
  }

  private async restoreState(): Promise<void> {
    if (!this.persistStateKey) {
      return;
    }

    const stateStore = await this.getStateStore();
    const savedState = await stateStore.getValue<LinkFilterState>(
      this.persistStateKey
    );

    if (!savedState) {
      return;
    }

    this.domainPageCounts = new Map(
      savedState.domainPageCounts.map(([domain, count]) => [
        normalizeDomain(domain),
        count,
      ])
    );
    this.domainAdmissionCounts = new Map(
      (
        savedState.domainAdmissionCounts ?? savedState.domainPageCounts
      ).map(([domain, count]) => [normalizeDomain(domain), count])
    );
    this.totalEnqueued = savedState.totalEnqueued ?? 0;
  }

  private schedulePersist(): void {
    if (!this.persistStateKey || this.persistTimer) {
      return;
    }

    this.persistTimer = setTimeout(() => {
      this.persistTimer = undefined;
      this.pendingPersist = this.persistState().catch((error: unknown) => {
        log.warning(
          `Failed to persist link filter state: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      });
    }, 250);
  }

  private async persistState(): Promise<void> {
    if (!this.persistStateKey) {
      return;
    }

    const stateStore = await this.getStateStore();
    await stateStore.setValue(this.persistStateKey, {
      domainPageCounts: Array.from(this.domainPageCounts.entries()),
      domainAdmissionCounts: Array.from(this.domainAdmissionCounts.entries()),
      totalEnqueued: this.totalEnqueued,
    } satisfies LinkFilterState);
  }

  private async getStateStore(): Promise<LinkFilterStateStore> {
    if (this.stateStore) {
      return this.stateStore;
    }

    this.stateStore = await KeyValueStore.open();
    return this.stateStore;
  }
}
