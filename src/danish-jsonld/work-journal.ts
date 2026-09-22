import { createHash } from "node:crypto";
import { mkdir, open, readFile, unlink, type FileHandle } from "node:fs/promises";
import { dirname, join } from "node:path";
import { hostname } from "node:os";
import type { DanishJsonLdRequest } from "./crawler.js";
import type { SourceRunObservation } from "./source-outcome.js";

export type WorkDisposition = "pending" | "fetched" | "rejected" | "skipped" | "failed" | "blocked";
export interface CrawlWork {
  key: string;
  mode: "cheerio" | "playwright";
  request: DanishJsonLdRequest;
  disposition: WorkDisposition;
  queued: boolean;
  retryCount?: number;
}
export interface WorkAccounting {
  admitted: number;
  queued: number;
  fetched: number;
  rejected: number;
  skipped: number;
  failed: number;
  blocked: number;
  pending: number;
}
export interface SessionCheckpoint {
  observation: SourceRunObservation;
  sets: Record<string, string[]>;
  values: { helloFreshToken?: string; madForFattigroeveBuildId?: string; nemligStamp?: string };
}
type JournalEvent =
  | { type: "identity"; fingerprint: string; runId?: string; sourceId?: string }
  | { type: "admit"; entries: CrawlWork[] }
  | { type: "queued"; keys: string[] }
  | { type: "retry"; key: string; retryCount: number }
  | { type: "commit"; key: string; disposition: WorkDisposition; checkpoint: SessionCheckpoint }
  | { type: "stop"; checkpoint: SessionCheckpoint; complete: boolean };

export function workKey(mode: CrawlWork["mode"], request: DanishJsonLdRequest): string {
  return `${mode}:${request.uniqueKey ?? `${request.kind}:${request.method ?? "GET"}:${request.url}:${request.payload ?? ""}`}`;
}

export function checkpointPath(directory: string, runId: string, sourceId: string): string {
  const key = createHash("sha256").update(`${runId}:${sourceId}`).digest("hex");
  return join(directory, "checkpoints", `${key}.jsonl`);
}

/** A write-ahead frontier. One durable line commits response state before Crawlee handles its request. */
export class CrawlWorkJournal {
  readonly entries = new Map<string, CrawlWork>();
  checkpoint?: SessionCheckpoint;
  complete = false;
  private file?: FileHandle;
  private lockPath?: string;
  private writes: Promise<void> = Promise.resolve();

  static async open(options: { path?: string; fingerprint: string; resume?: boolean; runId?: string; sourceId?: string }): Promise<CrawlWorkJournal> {
    const journal = new CrawlWorkJournal();
    if (!options.path) return journal; // In-memory probes and isolated tests.
    await mkdir(dirname(options.path), { recursive: true, mode: 0o700 });
    const lockPath = `${options.path}.lock`;
    try {
      const lock = await open(lockPath, "wx", 0o600);
      await lock.writeFile(JSON.stringify({ pid: process.pid, hostname: hostname() }));
      await lock.close();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const owner = JSON.parse(await readFile(lockPath, "utf8")) as { pid: number; hostname: string };
      if (owner.hostname !== hostname() || !Number.isInteger(owner.pid) || owner.pid <= 0) {
        throw new Error(`Checkpoint is locked: ${options.path}`);
      }
      try { process.kill(owner.pid, 0); }
      catch (failure) {
        if ((failure as NodeJS.ErrnoException).code === "ESRCH") {
          await unlink(lockPath);
          return CrawlWorkJournal.open(options);
        }
        throw failure;
      }
      throw new Error(`Checkpoint is in use by process ${owner.pid}`);
    }
    journal.lockPath = lockPath;
    try {
      if (options.resume) {
        const content = await readFile(options.path, "utf8");
        // Only a partial final line can be discarded after an interrupted append.
        const end = content.lastIndexOf("\n") + 1;
        const lines = content.slice(0, end).split("\n").filter(Boolean);
        const identity = JSON.parse(lines.shift() ?? "null") as JournalEvent | null;
        if (identity?.type !== "identity" || identity.fingerprint !== options.fingerprint) {
          throw new Error("Resume requires the same source configuration, database, and extractor build");
        }
        for (const line of lines) journal.apply(JSON.parse(line) as JournalEvent);
        journal.file = await open(options.path, "r+", 0o600);
        await journal.file.truncate(Buffer.byteLength(content.slice(0, end)));
        await journal.file.close();
        journal.file = await open(options.path, "a", 0o600);
      } else {
        journal.file = await open(options.path, "wx", 0o600);
        await journal.append({ type: "identity", fingerprint: options.fingerprint, runId: options.runId, sourceId: options.sourceId });
      }
      return journal;
    } catch (error) {
      await journal.close();
      throw error;
    }
  }

  pending(): CrawlWork[] { return [...this.entries.values()].filter((entry) => entry.disposition === "pending"); }
  isTerminal(key: string): boolean { const entry = this.entries.get(key); return !!entry && entry.disposition !== "pending"; }

  async admit(mode: CrawlWork["mode"], requests: DanishJsonLdRequest[]): Promise<void> {
    const seen = new Set<string>();
    const entries: CrawlWork[] = [];
    for (const request of requests) {
      const key = workKey(mode, request);
      if (this.entries.has(key) || seen.has(key)) continue;
      seen.add(key);
      entries.push({ key, mode, request, disposition: "pending", queued: false });
    }
    if (entries.length) await this.append({ type: "admit", entries });
  }
  async queued(keys: string[]): Promise<void> { if (keys.length) await this.append({ type: "queued", keys }); }
  async retried(key: string, retryCount: number): Promise<void> {
    await this.append({ type: "retry", key, retryCount });
  }
  async commit(key: string, disposition: WorkDisposition, checkpoint: SessionCheckpoint): Promise<void> {
    if (!this.entries.has(key)) throw new Error(`Unaccounted request: ${key}`);
    await this.append({ type: "commit", key, disposition, checkpoint });
  }
  async stop(checkpoint: SessionCheckpoint, complete: boolean): Promise<void> {
    await this.append({ type: "stop", checkpoint, complete });
  }
  accounting(): WorkAccounting {
    const counts: WorkAccounting = { admitted: this.entries.size, queued: 0, fetched: 0, rejected: 0, skipped: 0, failed: 0, blocked: 0, pending: 0 };
    for (const entry of this.entries.values()) {
      if (entry.queued) counts.queued++;
      counts[entry.disposition]++;
    }
    return counts;
  }
  async close(): Promise<void> {
    try { await this.writes; } finally {
      try { await this.file?.close(); } finally { if (this.lockPath) await unlink(this.lockPath); }
    }
  }
  private async append(event: JournalEvent): Promise<void> {
    this.writes = this.writes.then(async () => {
      if (this.file) {
        await this.file.writeFile(`${JSON.stringify(event)}\n`);
        await this.file.sync();
      }
      this.apply(event);
    });
    await this.writes;
  }
  private apply(event: JournalEvent): void {
    if (!event || !["identity", "admit", "queued", "retry", "commit", "stop"].includes(event.type)) {
      throw new Error("Invalid checkpoint event");
    }
    if (event.type === "admit") for (const entry of event.entries) this.entries.set(entry.key, entry);
    if (event.type === "retry") {
      const entry = this.entries.get(event.key);
      if (!entry || !Number.isSafeInteger(event.retryCount) || event.retryCount < 0) throw new Error("Invalid checkpoint retry");
      entry.retryCount = event.retryCount;
    }
    if (event.type === "queued") for (const key of event.keys) {
      const entry = this.entries.get(key);
      if (entry) entry.queued = true;
    }
    if (event.type === "commit") {
      const entry = this.entries.get(event.key);
      if (!entry) throw new Error("Invalid checkpoint: commit without admission");
      entry.disposition = event.disposition;
    }
    if (event.type === "commit" || event.type === "stop") {
      const sets = this.checkpoint?.sets ?? {};
      for (const [name, additions] of Object.entries(event.checkpoint.sets)) {
        (sets[name] ??= []).push(...additions);
      }
      this.checkpoint = { ...event.checkpoint, sets };
    }
    if (event.type === "stop") this.complete = event.complete;
  }
}
