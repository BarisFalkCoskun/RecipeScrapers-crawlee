import { sourceHealth, type SourceHealth } from "./source-health.js";
import type { DanishJsonLdCrawlRunDocument } from "../types.js";

/** Polls are read-only; emit only a changed alert or recovery, never unchanged health. */
export class SourceHealthMonitor {
  private readonly previous = new Map<string, string>();
  private pending?: Promise<void>;
  constructor(private readonly options: {
    sourceIds: string[];
    readRuns: (sourceId: string) => Promise<DanishJsonLdCrawlRunDocument[]>;
    emit: (event: { event: "source-health-alert" | "source-health-recovered"; health: SourceHealth }) => void;
    now?: () => Date;
    maxAgeHours?: number;
  }) {}

  check(): Promise<void> {
    if (this.pending) return this.pending;
    this.pending = this.poll().finally(() => { this.pending = undefined; });
    return this.pending;
  }
  private async poll(): Promise<void> {
    for (let offset = 0; offset < this.options.sourceIds.length; offset += 8) {
      await Promise.all(this.options.sourceIds.slice(offset, offset + 8).map(async (sourceId) => {
        const health = sourceHealth({ sourceId, runs: await this.options.readRuns(sourceId),
          now: this.options.now?.(), maxAgeHours: this.options.maxAgeHours });
        const signature = JSON.stringify([health.status, health.alerts]);
        const previous = this.previous.get(sourceId);
        if (signature === previous) return;
        this.previous.set(sourceId, signature);
        if (health.status !== "healthy") this.options.emit({ event: "source-health-alert", health });
        else if (previous !== undefined) this.options.emit({ event: "source-health-recovered", health });
      }));
    }
  }
}
