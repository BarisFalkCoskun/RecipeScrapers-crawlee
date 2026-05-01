import { log } from "crawlee";
import type {
  CrawlMetricsSummary,
  DomainMetricsSummary,
  FetchModeCounters,
} from "../types.js";

type FetchMode = "cheerio" | "playwright";

interface DomainMetrics {
  domain: string;
  processedPages: number;
  recipePages: number;
  extractedRecipes: number;
  recipeLanguages: Map<string, number>;
  recrawlSkips: number;
  fallbacksEnqueued: number;
  offDomainAdmissions: number;
  blockedUrlReasons: Map<string, number>;
  processedByMode: FetchModeCounters;
  recrawlSkipsByMode: FetchModeCounters;
}

interface PageProcessedArgs {
  domain: string;
  fetchMode: FetchMode;
  recipeCount: number;
  recipeLanguages?: string[];
}

interface RecrawlSkipArgs {
  domain: string;
  fetchMode: FetchMode;
}

interface OffDomainAdmissionArgs {
  sourceDomain: string;
  targetDomain: string;
}

interface BlockedUrlArgs {
  domain: string;
  reasons: string[];
}

export class CrawlMetrics {
  private totals: DomainMetrics = this.createDomainMetrics("all");

  private byDomain = new Map<string, DomainMetrics>();
  private seedDomains: Set<string>;
  private newlyAdmittedDomains = new Set<string>();
  private playwrightFallbacksByReason = new Map<string, number>();

  constructor(seedDomains: string[] = []) {
    this.seedDomains = new Set(seedDomains);
  }

  recordPageProcessed({
    domain,
    fetchMode,
    recipeCount,
    recipeLanguages = [],
  }: PageProcessedArgs): void {
    const metrics = this.ensureDomain(domain);
    this.updateProcessedCounters(this.totals, fetchMode, recipeCount);
    this.updateProcessedCounters(metrics, fetchMode, recipeCount);

    for (const language of recipeLanguages) {
      this.incrementMap(this.totals.recipeLanguages, language);
      this.incrementMap(metrics.recipeLanguages, language);
    }
  }

  recordFallbackQueued(domain: string, reason = "unspecified"): void {
    this.totals.fallbacksEnqueued += 1;
    this.ensureDomain(domain).fallbacksEnqueued += 1;
    this.playwrightFallbacksByReason.set(
      reason,
      (this.playwrightFallbacksByReason.get(reason) ?? 0) + 1
    );
  }

  recordRecrawlSkip({ domain, fetchMode }: RecrawlSkipArgs): void {
    const metrics = this.ensureDomain(domain);
    this.totals.recrawlSkips += 1;
    this.totals.recrawlSkipsByMode[fetchMode] += 1;
    metrics.recrawlSkips += 1;
    metrics.recrawlSkipsByMode[fetchMode] += 1;
  }

  recordOffDomainAdmission({
    sourceDomain,
    targetDomain,
  }: OffDomainAdmissionArgs): void {
    const sourceMetrics = this.ensureDomain(sourceDomain);
    sourceMetrics.offDomainAdmissions += 1;
    this.totals.offDomainAdmissions += 1;

    if (!this.seedDomains.has(targetDomain)) {
      this.newlyAdmittedDomains.add(targetDomain);
    }
  }

  recordBlockedUrl({ domain, reasons }: BlockedUrlArgs): void {
    const metrics = this.ensureDomain(domain);
    for (const reason of reasons.length > 0 ? reasons : ["unspecified"]) {
      this.incrementMap(this.totals.blockedUrlReasons, reason);
      this.incrementMap(metrics.blockedUrlReasons, reason);
    }
  }

  buildSummary(): CrawlMetricsSummary {
    const domains = Array.from(this.byDomain.values())
      .map((metrics) => this.toSummary(metrics))
      .sort((a, b) => a.domain.localeCompare(b.domain));

    return {
      ...this.toSummary(this.totals),
      newlyAdmittedDomains: Array.from(this.newlyAdmittedDomains).sort(),
      playwrightFallbacksByReason: Object.fromEntries(
        Array.from(this.playwrightFallbacksByReason.entries()).sort(([a], [b]) =>
          a.localeCompare(b)
        )
      ),
      domains,
    };
  }

  logSummary(): void {
    const summary = this.buildSummary();

    log.info(
      `Run summary: processed=${summary.processedPages} ` +
        `(cheerio=${summary.processedByMode.cheerio}, playwright=${summary.processedByMode.playwright}), ` +
        `recipePages=${summary.recipePages}, recipes=${summary.extractedRecipes}, ` +
        `yield=${formatPercent(summary.recipePageYield)}, recrawlSkips=${summary.recrawlSkips}, ` +
        `fallbacks=${summary.fallbacksEnqueued}, fallbackRate=${formatPercent(summary.fallbackRate)}, ` +
        `offDomainAdmissions=${summary.offDomainAdmissions}, newlyAdmittedDomains=${summary.newlyAdmittedDomains.length}, ` +
        `blockedUrls=${sumRecord(summary.blockedUrlReasons)}`
    );

    if (Object.keys(summary.recipeLanguages).length > 0) {
      log.info(`Recipe languages: ${formatRecord(summary.recipeLanguages)}`);
    }

    if (Object.keys(summary.blockedUrlReasons).length > 0) {
      log.info(`Blocked URL reasons: ${formatRecord(summary.blockedUrlReasons)}`);
    }

    if (Object.keys(summary.playwrightFallbacksByReason).length > 0) {
      log.info(
        `Playwright fallback reasons: ${Object.entries(
          summary.playwrightFallbacksByReason
        )
          .map(([reason, count]) => `${reason}=${count}`)
          .join(", ")}`
      );
    }

    for (const domain of summary.domains) {
      log.info(
        `Domain ${domain.domain}: processed=${domain.processedPages} ` +
          `(cheerio=${domain.processedByMode.cheerio}, playwright=${domain.processedByMode.playwright}), ` +
          `recipePages=${domain.recipePages}, recipes=${domain.extractedRecipes}, ` +
          `yield=${formatPercent(domain.recipePageYield)}, recrawlSkips=${domain.recrawlSkips}, ` +
          `fallbacks=${domain.fallbacksEnqueued}, fallbackRate=${formatPercent(domain.fallbackRate)}, ` +
          `offDomainAdmissions=${domain.offDomainAdmissions}, blockedUrls=${sumRecord(domain.blockedUrlReasons)}`
      );
    }
  }

  private ensureDomain(domain: string): DomainMetrics {
    const existing = this.byDomain.get(domain);
    if (existing) {
      return existing;
    }

    const created = this.createDomainMetrics(domain);
    this.byDomain.set(domain, created);
    return created;
  }

  private createDomainMetrics(domain: string): DomainMetrics {
    return {
      domain,
      processedPages: 0,
      recipePages: 0,
      extractedRecipes: 0,
      recipeLanguages: new Map(),
      recrawlSkips: 0,
      fallbacksEnqueued: 0,
      offDomainAdmissions: 0,
      blockedUrlReasons: new Map(),
      processedByMode: { cheerio: 0, playwright: 0 },
      recrawlSkipsByMode: { cheerio: 0, playwright: 0 },
    };
  }

  private updateProcessedCounters(
    metrics: DomainMetrics,
    fetchMode: FetchMode,
    recipeCount: number
  ): void {
    metrics.processedPages += 1;
    metrics.processedByMode[fetchMode] += 1;
    metrics.extractedRecipes += recipeCount;
    if (recipeCount > 0) {
      metrics.recipePages += 1;
    }
  }

  private toSummary(metrics: DomainMetrics): DomainMetricsSummary {
    return {
      domain: metrics.domain,
      processedPages: metrics.processedPages,
      recipePages: metrics.recipePages,
      extractedRecipes: metrics.extractedRecipes,
      recipeLanguages: mapToSortedRecord(metrics.recipeLanguages),
      recrawlSkips: metrics.recrawlSkips,
      fallbacksEnqueued: metrics.fallbacksEnqueued,
      offDomainAdmissions: metrics.offDomainAdmissions,
      blockedUrlReasons: mapToSortedRecord(metrics.blockedUrlReasons),
      processedByMode: metrics.processedByMode,
      recrawlSkipsByMode: metrics.recrawlSkipsByMode,
      recipePageYield:
        metrics.processedPages === 0 ? 0 : metrics.recipePages / metrics.processedPages,
      fallbackRate:
        metrics.processedByMode.cheerio === 0
          ? 0
          : metrics.fallbacksEnqueued / metrics.processedByMode.cheerio,
    };
  }

  private incrementMap(map: Map<string, number>, key: string): void {
    map.set(key, (map.get(key) ?? 0) + 1);
  }
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function mapToSortedRecord(map: Map<string, number>): Record<string, number> {
  return Object.fromEntries(
    Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  );
}

function formatRecord(record: Record<string, number>): string {
  return Object.entries(record)
    .map(([key, count]) => `${key}=${count}`)
    .join(", ");
}

function sumRecord(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, count) => sum + count, 0);
}
