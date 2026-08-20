import { hostname } from "node:os";
import { open, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";
import type { MigrationState } from "../danish-jsonld/source-registry.js";
import { DANISH_JSONLD_SOURCES } from "../danish-jsonld/source-registry.js";
import type { DanishJsonLdRunSummary, SourceOutcomeReason } from "../types.js";

export type ScheduledRunStatus = "running" | "completed" | "failed" | "interrupted";

export interface ScheduledRunEntry {
  sourceId: string;
  scheduledFor: string;
  status: ScheduledRunStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export interface SchedulerLedgerDocument {
  schemaVersion: 1;
  runs: Record<string, ScheduledRunEntry>;
}

export interface SchedulerHeartbeat {
  schemaVersion: 1;
  pid: number;
  hostname: string;
  updatedAt: string;
  scheduledSourceIds: string[];
  activeSourceId?: string;
}

interface SchedulerLeaseDocument {
  schemaVersion: 1;
  token: string;
  pid: number;
  hostname: string;
  updatedAt: string;
}

export interface DailySchedule {
  minute: number;
  hour: number;
}

export interface DanishSchedulerConfig {
  sourceIds: string[];
  allowedStates: MigrationState[];
  schedules: Map<string, DailySchedule>;
  timezone: string;
  catchupMinutes: number;
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  heartbeatPath: string;
  ledgerPath: string;
  evidenceDirectory: string;
}

export interface DanishSchedulerDependencies {
  now: () => Date;
  runSource: (sourceId: string, evidencePath: string) => Promise<void>;
  output: (line: string) => void;
}

export function createSchedulerConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): DanishSchedulerConfig {
  const allowedStates = parseAllowedStates(env["CRAWLEE_SCHEDULER_ALLOWED_STATES"]);
  const sourceIds = selectScheduledSources({
    requested: env["CRAWLEE_SCHEDULED_SOURCES"],
    allowedStates,
  });
  const baseHour = integerOption(env["CRAWLEE_SCRAPE_HOUR"], 1, "CRAWLEE_SCRAPE_HOUR", 0);
  if (baseHour > 23) throw new Error("CRAWLEE_SCRAPE_HOUR must be an integer from 0 to 23");
  const schedules = new Map(sourceIds.map((sourceId, index) => {
    const envKey = `CRAWLEE_SCHEDULE_${sourceId.toUpperCase().replace(/[^A-Z0-9]/gu, "_")}`;
    const expression = env[envKey] ?? defaultDailyCron(baseHour, index * 20);
    return [sourceId, parseDailyCron(expression)] as const;
  }));
  return {
    sourceIds,
    allowedStates,
    schedules,
    timezone: env["CRAWLEE_SCHEDULER_TIMEZONE"] ?? "Europe/Copenhagen",
    catchupMinutes: integerOption(env["CRAWLEE_SCHEDULE_CATCHUP_MINUTES"], 1800, "CRAWLEE_SCHEDULE_CATCHUP_MINUTES", 1),
    pollIntervalMs: integerOption(env["CRAWLEE_SCHEDULER_POLL_MS"], 15_000, "CRAWLEE_SCHEDULER_POLL_MS", 100),
    heartbeatIntervalMs: integerOption(env["CRAWLEE_SCHEDULER_HEARTBEAT_MS"], 30_000, "CRAWLEE_SCHEDULER_HEARTBEAT_MS", 100),
    heartbeatPath: env["CRAWLEE_SCHEDULER_HEARTBEAT_PATH"] ?? "data/crawlee-scheduler-heartbeat.json",
    ledgerPath: env["CRAWLEE_SCHEDULER_LEDGER_PATH"] ?? "data/crawlee-scheduler-ledger.json",
    evidenceDirectory: env["CRAWLEE_SCHEDULER_EVIDENCE_DIR"] ?? "data/crawlee-scheduler-evidence",
  };
}

function integerOption(
  raw: string | undefined,
  fallback: number,
  name: string,
  minimum: number
): number {
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}`);
  }
  return value;
}

const STATE_ORDER: MigrationState[] = [
  "not_started",
  "configured",
  "canary_passed",
  "shadow_passed",
  "cutover",
];

const ACCEPTED_PARTIAL_REASONS = new Set<SourceOutcomeReason>([
  "recipes-persisted",
  "recipe-candidates-discovered",
  "incomplete-json-ld-rejected",
  "incomplete-wprm-rejected",
  "incomplete-custom-recipe-rejected",
]);

export function scheduledOutcomeIsHealthy(
  summary: DanishJsonLdRunSummary,
  sourceId: string
): boolean {
  const outcome = summary.sourceOutcomes.find((entry) => entry.sourceId === sourceId);
  if (!outcome) return false;
  if (outcome.outcome === "succeeded") return true;
  return outcome.outcome === "partial" &&
    outcome.outcomeReasons.includes("recipes-persisted") &&
    outcome.outcomeReasons.every((reason) => ACCEPTED_PARTIAL_REASONS.has(reason));
}

export function parseAllowedStates(raw: string | undefined): MigrationState[] {
  const values = (raw ?? "cutover").split(",").map((value) => value.trim()).filter(Boolean);
  const invalid = values.filter((value) => !STATE_ORDER.includes(value as MigrationState));
  if (invalid.length > 0) throw new Error(`Unknown scheduler state: ${invalid.join(", ")}`);
  return [...new Set(values as MigrationState[])];
}

export function selectScheduledSources(input: {
  requested?: string;
  allowedStates: MigrationState[];
}): string[] {
  const requested = input.requested
    ? input.requested.split(/[\s,]+/u).map((value) => value.trim()).filter(Boolean)
    : DANISH_JSONLD_SOURCES
      .filter((source) => input.allowedStates.includes(source.migrationState))
      .map((source) => source.id);
  const unique = [...new Set(requested)];
  for (const sourceId of unique) {
    const source = DANISH_JSONLD_SOURCES.find((candidate) => candidate.id === sourceId);
    if (!source) throw new Error(`Unknown scheduled Danish source: ${sourceId}`);
    if (!input.allowedStates.includes(source.migrationState)) {
      throw new Error(
        `Scheduled source ${sourceId} is ${source.migrationState}; allowed states: ${input.allowedStates.join(", ")}`
      );
    }
  }
  if (unique.length === 0) {
    throw new Error("No Danish sources are eligible for scheduling; keep production fail-closed or explicitly allow an observation state");
  }
  return unique;
}

/** Supports the daily cron shape used by the legacy scheduler: `minute hour * * *`. */
export function parseDailyCron(expression: string): DailySchedule {
  const match = /^\s*(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*\s*$/u.exec(expression);
  if (!match) throw new Error(`Only daily cron expressions are supported: ${expression}`);
  const minute = Number(match[1]);
  const hour = Number(match[2]);
  if (minute > 59 || hour > 23) throw new Error(`Invalid daily cron expression: ${expression}`);
  return { minute, hour };
}

export function defaultDailyCron(baseHour: number, offsetMinutes: number): string {
  if (!Number.isInteger(baseHour) || baseHour < 0 || baseHour > 23) {
    throw new Error("CRAWLEE_SCRAPE_HOUR must be an integer from 0 to 23");
  }
  const total = baseHour * 60 + offsetMinutes;
  return `${total % 60} ${Math.floor(total / 60) % 24} * * *`;
}

export function latestScheduleSlot(input: {
  now: Date;
  schedule: DailySchedule;
  timezone: string;
  catchupMinutes: number;
}): Date | undefined {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: input.timezone,
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const rounded = new Date(input.now);
  rounded.setUTCSeconds(0, 0);
  for (let offset = 0; offset <= input.catchupMinutes; offset += 1) {
    const candidate = new Date(rounded.getTime() - offset * 60_000);
    const parts = Object.fromEntries(
      formatter.formatToParts(candidate)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)])
    );
    if (parts["hour"] === input.schedule.hour && parts["minute"] === input.schedule.minute) {
      return candidate;
    }
  }
  return undefined;
}

export function scheduleSlotKey(sourceId: string, scheduledFor: Date): string {
  return `${sourceId}:${scheduledFor.toISOString()}`;
}

export class SchedulerLedger {
  private document: SchedulerLedgerDocument = { schemaVersion: 1, runs: {} };

  constructor(private readonly path: string) {}

  async open(now: Date): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as SchedulerLedgerDocument;
      if (parsed.schemaVersion !== 1 || typeof parsed.runs !== "object" || parsed.runs === null) {
        throw new Error("invalid scheduler ledger shape");
      }
      this.document = parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    for (const entry of Object.values(this.document.runs)) {
      if (entry.status === "running") {
        entry.status = "interrupted";
        entry.finishedAt = now.toISOString();
        entry.error ??= "scheduler stopped before recording completion";
      }
    }
    await this.flush();
  }

  get(key: string): ScheduledRunEntry | undefined {
    return this.document.runs[key];
  }

  async start(key: string, sourceId: string, scheduledFor: Date, now: Date): Promise<void> {
    this.document.runs[key] = {
      sourceId,
      scheduledFor: scheduledFor.toISOString(),
      status: "running",
      startedAt: now.toISOString(),
    };
    await this.flush();
  }

  async finish(key: string, status: "completed" | "failed", now: Date, error?: string): Promise<void> {
    const entry = this.document.runs[key];
    if (!entry) throw new Error(`Unknown scheduler ledger entry: ${key}`);
    entry.status = status;
    entry.finishedAt = now.toISOString();
    if (error) entry.error = error.slice(0, 2000);
    await this.flush();
  }

  private async flush(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(this.document, null, 2)}\n`, "utf8");
    await rename(temporaryPath, this.path);
  }
}

/**
 * A small cross-process lease prevents two scheduler replicas from mutating
 * the file-backed ledger. Stale leases are renamed for diagnosis, not erased.
 */
export class SchedulerLease {
  private readonly token = randomUUID();
  private owned = false;

  constructor(
    private readonly path: string,
    private readonly staleAfterMs: number,
    private readonly ownerHostname = hostname(),
    private readonly ownerPid = process.pid,
    private readonly processAlive: (pid: number) => boolean = defaultProcessAlive
  ) {}

  async acquire(now: Date): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const handle = await open(this.path, "wx");
        try {
          await handle.writeFile(`${JSON.stringify(this.document(now))}\n`, "utf8");
        } finally {
          await handle.close();
        }
        this.owned = true;
        return;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }

      const existing = await this.read();
      const updatedAt = existing ? new Date(existing.updatedAt).getTime() : Number.NaN;
      const staleByAge = !Number.isFinite(updatedAt) || now.getTime() - updatedAt > this.staleAfterMs;
      const deadLocalProcess = existing?.hostname === this.ownerHostname &&
        !this.processAlive(existing.pid);
      if (!staleByAge && !deadLocalProcess) {
        throw new Error(
          `Another Crawlee scheduler owns ${this.path} (pid ${existing?.pid ?? "unknown"} on ${existing?.hostname ?? "unknown"})`
        );
      }
      try {
        await rename(
          this.path,
          `${this.path}.stale-${now.toISOString().replaceAll(":", "-")}-${randomUUID()}`
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    throw new Error(`Unable to acquire Crawlee scheduler lease: ${this.path}`);
  }

  async renew(now: Date): Promise<void> {
    if (!this.owned) throw new Error("Cannot renew an unowned scheduler lease");
    const existing = await this.read();
    if (existing?.token !== this.token) {
      this.owned = false;
      throw new Error(`Crawlee scheduler lease ownership was lost: ${this.path}`);
    }
    const temporaryPath = `${this.path}.${this.token}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(this.document(now))}\n`, "utf8");
    await rename(temporaryPath, this.path);
  }

  async release(): Promise<void> {
    if (!this.owned) return;
    const existing = await this.read();
    if (existing?.token === this.token) {
      try {
        await unlink(this.path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    this.owned = false;
  }

  private document(now: Date): SchedulerLeaseDocument {
    return {
      schemaVersion: 1,
      token: this.token,
      pid: this.ownerPid,
      hostname: this.ownerHostname,
      updatedAt: now.toISOString(),
    };
  }

  private async read(): Promise<SchedulerLeaseDocument | undefined> {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as SchedulerLeaseDocument;
      if (parsed.schemaVersion !== 1 || typeof parsed.token !== "string") return undefined;
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      if (error instanceof SyntaxError) return undefined;
      throw error;
    }
  }
}

export async function writeSchedulerHeartbeat(
  path: string,
  heartbeat: SchedulerHeartbeat
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(heartbeat)}\n`, "utf8");
  await rename(temporaryPath, path);
}

export async function schedulerHeartbeatIsFresh(input: {
  path: string;
  now: Date;
  maxAgeSeconds: number;
  expectedHostname?: string;
  processAlive?: (pid: number) => boolean;
}): Promise<boolean> {
  try {
    const heartbeat = JSON.parse(await readFile(input.path, "utf8")) as SchedulerHeartbeat;
    if (heartbeat.schemaVersion !== 1 || !Number.isInteger(heartbeat.pid) || heartbeat.pid <= 0) return false;
    if (input.expectedHostname && heartbeat.hostname !== input.expectedHostname) return false;
    const updatedAt = new Date(heartbeat.updatedAt);
    const ageSeconds = (input.now.getTime() - updatedAt.getTime()) / 1000;
    if (!Number.isFinite(ageSeconds) || ageSeconds < 0 || ageSeconds > input.maxAgeSeconds) return false;
    return (input.processAlive ?? defaultProcessAlive)(heartbeat.pid);
  } catch {
    return false;
  }
}

function defaultProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export class DanishRecipeScheduler {
  private activeSourceId: string | undefined;
  private heartbeatTimer: NodeJS.Timeout | undefined;
  private readonly ledger: SchedulerLedger;
  private readonly lease: SchedulerLease;

  constructor(
    private readonly config: DanishSchedulerConfig,
    private readonly dependencies: DanishSchedulerDependencies
  ) {
    this.ledger = new SchedulerLedger(config.ledgerPath);
    this.lease = new SchedulerLease(
      `${config.ledgerPath}.lock`,
      Math.max(config.heartbeatIntervalMs * 4, 10_000)
    );
  }

  async initialize(): Promise<void> {
    await this.lease.acquire(this.dependencies.now());
    try {
      await this.ledger.open(this.dependencies.now());
      await this.heartbeat();
      this.heartbeatTimer = setInterval(() => {
        void this.heartbeat().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.dependencies.output(`Scheduler heartbeat failed: ${message}`);
        });
      }, this.config.heartbeatIntervalMs);
    } catch (error) {
      await this.lease.release();
      throw error;
    }
  }

  async runDue(): Promise<number> {
    let completed = 0;
    for (const sourceId of this.config.sourceIds) {
      const schedule = this.config.schedules.get(sourceId);
      if (!schedule) throw new Error(`Missing schedule for ${sourceId}`);
      const scheduledFor = latestScheduleSlot({
        now: this.dependencies.now(),
        schedule,
        timezone: this.config.timezone,
        catchupMinutes: this.config.catchupMinutes,
      });
      if (!scheduledFor) continue;
      const key = scheduleSlotKey(sourceId, scheduledFor);
      const previous = this.ledger.get(key);
      // A schedule slot is attempted at most once automatically. Repeating a
      // failed slot every poll would create an unbounded retry storm; operators
      // can use --run-now after correcting the fault.
      if (previous) continue;
      await this.runOne(sourceId, scheduledFor, key);
      completed += 1;
    }
    return completed;
  }

  async runOne(sourceId: string, scheduledFor = this.dependencies.now(), key = scheduleSlotKey(sourceId, scheduledFor)): Promise<boolean> {
    const startedAt = this.dependencies.now();
    await this.ledger.start(key, sourceId, scheduledFor, startedAt);
    this.activeSourceId = sourceId;
    await this.heartbeat();
    const evidencePath = `${this.config.evidenceDirectory}/${sourceId}-${scheduledFor.toISOString().replaceAll(":", "-")}.json`;
    try {
      await this.dependencies.runSource(sourceId, evidencePath);
      await this.ledger.finish(key, "completed", this.dependencies.now());
      this.dependencies.output(`Scheduled source completed: ${sourceId}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.ledger.finish(key, "failed", this.dependencies.now(), message);
      this.dependencies.output(`Scheduled source failed: ${sourceId}: ${message}`);
      return false;
    } finally {
      this.activeSourceId = undefined;
      await this.heartbeat();
    }
  }

  async runForever(): Promise<never> {
    await this.initialize();
    while (true) {
      await this.runDue();
      await new Promise((resolve) => setTimeout(resolve, this.config.pollIntervalMs));
    }
  }

  async dispose(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = undefined;
    await this.lease.release();
  }

  private async heartbeat(): Promise<void> {
    await this.lease.renew(this.dependencies.now());
    await writeSchedulerHeartbeat(this.config.heartbeatPath, {
      schemaVersion: 1,
      pid: process.pid,
      hostname: hostname(),
      updatedAt: this.dependencies.now().toISOString(),
      scheduledSourceIds: this.config.sourceIds,
      ...(this.activeSourceId ? { activeSourceId: this.activeSourceId } : {}),
    });
  }
}
