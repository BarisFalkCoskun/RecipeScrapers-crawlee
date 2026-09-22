import type { DanishJsonLdCrawlRunDocument } from "../types.js";
import type { SourceRunObservation } from "../danish-jsonld/source-outcome.js";

export interface SourceHealth {
  sourceId: string;
  status: "healthy" | "warning" | "overdue" | "unknown";
  lastRunAt: string | null;
  lastCompleteAt: string | null;
  recipes: number;
  inserted: number | null;
  changed: number | null;
  unchanged: number | null;
  rejectionRate: number;
  blockingRate: number;
  durationSeconds: number | null;
  pendingRequests: number | null;
  alerts: string[];
}
const count = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const rejected = (o: SourceRunObservation) => count(o.rejectedIncompleteJsonLd) + count(o.rejectedMalformedJsonLd)
  + count(o.rejectedIncompleteWprm) + count(o.rejectedMalformedWprm) + count(o.rejectedIncompleteCustom) + count(o.rejectedMalformedCustom);
const rejectionRate = (o: SourceRunObservation) => rejected(o) / Math.max(1, rejected(o) + count(o.persistedRecipes));
const median = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0; };

export function sourceHealth(input: {
  sourceId: string;
  runs: DanishJsonLdCrawlRunDocument[];
  now?: Date;
  maxAgeHours?: number;
}): SourceHealth {
  const now = input.now ?? new Date();
  const seen = new Set<string>();
  const runs = input.runs.filter((run) => run.sourceIds.includes(input.sourceId))
    .sort((a, b) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime())
    .filter((run) => { if (seen.has(run.crawlRunId)) return false; seen.add(run.crawlRunId); return true; });
  const observation = (run: DanishJsonLdCrawlRunDocument) => run.observations.find((o) =>
    o && typeof o === "object" && "sourceId" in o && o.sourceId === input.sourceId) as SourceRunObservation | undefined;
  const complete = (run: DanishJsonLdCrawlRunDocument) => observation(run)?.collectionComplete === true;
  const latest = runs[0];
  const latestObservation = latest ? observation(latest) : undefined;
  const o = latestObservation ?? { sourceId: input.sourceId, discoveryComplete: false };
  const lastComplete = runs.find(complete);
  const health: SourceHealth = {
    sourceId: input.sourceId, status: latest ? "healthy" : "unknown",
    lastRunAt: latest ? new Date(latest.finishedAt).toISOString() : null,
    lastCompleteAt: lastComplete ? new Date(lastComplete.finishedAt).toISOString() : null,
    recipes: count(o.persistedRecipes), inserted: o.insertedRecipes ?? null, changed: o.changedRecipes ?? null,
    unchanged: o.unchangedRecipes ?? null, rejectionRate: rejectionRate(o),
    blockingRate: count(o.blockedRequests) / Math.max(1, count(o.completedRequests) + count(o.failedRequests)),
    durationSeconds: o.durationSeconds ?? null, pendingRequests: o.workAccounting?.pending ?? null, alerts: [],
  };
  if (!latest) health.alerts.push("No crawl evidence");
  else {
    if (health.recipes === 0) health.alerts.push("No publishable recipes in the latest run");
    if (!latestObservation?.workAccounting) health.alerts.push("Run predates completion accounting; coverage is unverified");
    else if (!complete(latest)) health.alerts.push(`Latest crawl incomplete (${health.pendingRequests} requests pending)`);
    if (count(o.blockedRequests)) health.alerts.push(`${o.blockedRequests} requests blocked`);
    if (count(o.failedRequests) || count(o.mongoFailures)) health.alerts.push("Fetch or storage failures");
    const baseline = runs.slice(1).filter(complete).map(observation).filter((value): value is SourceRunObservation => !!value).slice(0, 7);
    if (baseline.length >= 3) {
      const recipes = median(baseline.map((entry) => count(entry.persistedRecipes)));
      if (recipes > 0 && health.recipes < recipes * 0.5) health.alerts.push("Recipe count below 50% of recent complete-run median");
      const rate = median(baseline.map(rejectionRate));
      if (health.rejectionRate > Math.max(rate * 2, rate + 0.05)) health.alerts.push("Recipe rejection rate increased materially");
      const duration = median(baseline.map((entry) => count(entry.durationSeconds)));
      if (duration > 0 && count(o.durationSeconds) > duration * 2) health.alerts.push("Crawl duration exceeds twice its recent median");
    }
    if (!lastComplete || now.getTime() - new Date(lastComplete.finishedAt).getTime() > (input.maxAgeHours ?? 36) * 3_600_000) {
      health.status = "overdue";
      health.alerts.push(lastComplete ? "Complete crawl overdue" : "No verified complete crawl in retained history");
    } else if (health.alerts.length) health.status = "warning";
  }
  return health;
}

export function renderSourceHealthHtml(rows: SourceHealth[]): string {
  const escape = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Recipe source health</title>
<style>body{font:15px system-ui;margin:2rem;color:#17212d}table{border-collapse:collapse;width:100%}th,td{text-align:left;border-bottom:1px solid #dce2e8;padding:.7rem}th{background:#eef2f6}.healthy{color:#087443}.warning,.overdue,.unknown{color:#ad4300}small{color:#546474}</style>
<h1>Recipe source health</h1><p>Collection completeness and extraction quality are tracked separately. Unknown values are shown as —.</p>
<table><thead><tr>${["Source", "Health", "Last complete (UTC)", "Recipes", "New / changed / unchanged", "Rejected", "Blocked", "Seconds", "Pending", "Alerts"].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>
${rows.map((r) => `<tr><td>${escape(r.sourceId)}</td><td class="${r.status}">${r.status}</td><td>${escape(r.lastCompleteAt)}</td><td>${r.recipes}</td><td>${escape(r.inserted)} / ${escape(r.changed)} / ${escape(r.unchanged)}</td><td>${(r.rejectionRate * 100).toFixed(1)}%</td><td>${(r.blockingRate * 100).toFixed(1)}%</td><td>${escape(r.durationSeconds)}</td><td>${escape(r.pendingRequests)}</td><td>${r.alerts.map(escape).join("; ")}</td></tr>`).join("\n")}
</tbody></table></html>`;
}
