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
  recrawlSkips: number;
  fallbacksEnqueued: number;
  offDomainAdmissions: number;
  processedByMode: FetchModeCounters;
  recrawlSkipsByMode: FetchModeCounters;
}

interface PageProcessedArgs {
  domain: string;
  fetchMode: FetchMode;
  recipeCount: number;
}

interface RecrawlSkipArgs {
  domain: string;
  fetchMode: FetchMode;
}

interface OffDomainAdmissionArgs {
  sourceDomain: string;
  targetDomain: string;
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

  recordPageProcessed({ domain, fetchMode, recipeCount }: PageProcessedArgs): void {
    const metrics = this.ensureDomain(domain);
    this.updateProcessedCounters(this.totals, fetchMode, recipeCount);
    this.updateProcessedCounters(metrics, fetchMode, recipeCount);
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
        `offDomainAdmissions=${summary.offDomainAdmissions}, newlyAdmittedDomains=${summary.newlyAdmittedDomains.length}`
    );

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
          `offDomainAdmissions=${domain.offDomainAdmissions}`
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
      recrawlSkips: 0,
      fallbacksEnqueued: 0,
      offDomainAdmissions: 0,
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
      ...metrics,
      recipePageYield:
        metrics.processedPages === 0 ? 0 : metrics.recipePages / metrics.processedPages,
      fallbackRate:
        metrics.processedByMode.cheerio === 0
          ? 0
          : metrics.fallbacksEnqueued / metrics.processedByMode.cheerio,
    };
  }
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
