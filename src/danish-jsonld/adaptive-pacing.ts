import { createHash } from "node:crypto";
import { join } from "node:path";
import { RetryRequestError } from "crawlee";
import { readPrivateState, writePrivateState } from "./private-state.js";

export class PacingPendingError extends RetryRequestError {
  constructor() { super("Adaptive pacing active; returning request to its queue"); }
}
interface PaceState {
  version: 1;
  updatedAt: number;
  delayMs: number;
  latencyMs: number;
  healthy: number;
  denials: number;
  nextAt: number;
  pauseUntil: number;
  lastStartedAt: number;
}
const MAX_AGE_MS = 7 * 24 * 60 * 60_000;

/** One source's HTTP/browser queues share this controller. The scheduler already
 * serializes sources with overlapping hosts. Snapshots retain learning on restart;
 * website Retry-After deadlines remain a separate, cross-process lower bound.
 */
export class AdaptiveRequestPacing {
  private readonly hosts = new Set<string>();
  private readonly states = new Map<string, PaceState>();
  private readonly attempts = new WeakMap<object, { url: string; at: number }>();
  private readonly now: () => number;
  private readonly minimum: number;
  private readonly maximum: number;

  constructor(private readonly options: {
    minimumDelayMs: number;
    directory?: string;
    now?: () => number;
    maximumDelayMs?: number;
    denialPauseMs?: number;
    diagnostic?: (data: Record<string, unknown>) => void;
  }) {
    this.now = options.now ?? Date.now;
    this.minimum = Math.max(0, options.minimumDelayMs);
    this.maximum = Math.max(this.minimum, options.maximumDelayMs ?? 300_000);
  }

  private host(url: string) { return new URL(url).hostname.toLowerCase().replace(/^www\./u, ""); }
  register(url: string): void { this.hosts.add(this.host(url)); }
  private path(host: string) {
    return this.options.directory && join(this.options.directory, "pacing", `${createHash("sha256").update(host).digest("hex")}.json`);
  }
  private async state(host: string): Promise<PaceState> {
    const known = this.states.get(host);
    if (known) return known;
    const now = this.now();
    const path = this.path(host);
    const saved = path ? await readPrivateState(path, 4096) as PaceState | undefined : undefined;
    const valid = saved?.version === 1 && [saved.updatedAt, saved.delayMs, saved.latencyMs, saved.healthy,
      saved.denials, saved.nextAt, saved.pauseUntil, saved.lastStartedAt].every((value) => Number.isFinite(value) && value >= 0)
      && saved.updatedAt <= now && now - saved.updatedAt < MAX_AGE_MS;
    const state: PaceState = valid ? { ...saved, delayMs: Math.max(this.minimum, Math.min(this.maximum, saved.delayMs)) }
      : { version: 1, updatedAt: now, delayMs: this.minimum, latencyMs: 0, healthy: 0, denials: 0,
        nextAt: 0, pauseUntil: 0, lastStartedAt: 0 };
    this.states.set(host, state);
    return state;
  }
  private async save(host: string, state: PaceState) {
    state.updatedAt = this.now();
    const path = this.path(host);
    if (path) await writePrivateState(path, state);
  }
  async remaining(url: string): Promise<number> {
    const state = await this.state(this.host(url));
    return Math.max(0, state.nextAt - this.now(), state.pauseUntil - this.now());
  }
  async ready(): Promise<boolean> {
    for (const host of this.hosts) if (await this.remaining(`https://${host}`) > 0) return false;
    return true;
  }
  async start(request: object, url: string): Promise<void> {
    this.register(url);
    if (await this.remaining(url) > 0) throw new PacingPendingError();
    const host = this.host(url);
    const state = await this.state(host);
    const at = this.now();
    state.lastStartedAt = at;
    state.nextAt = at + state.delayMs;
    await this.save(host, state);
    this.attempts.set(request, { url, at });
  }
  async finish(request: object, status: number): Promise<void> {
    const attempt = this.attempts.get(request);
    if (!attempt) return; // Error and terminal hooks can see the same attempt.
    this.attempts.delete(request);
    await this.observe(attempt.url, status, Math.max(0, this.now() - attempt.at));
  }
  async observe(url: string, status: number, durationMs: number): Promise<void> {
    this.register(url);
    const host = this.host(url);
    const state = await this.state(host);
    const previous = state.delayMs;
    const denied = [401, 403, 454, 455].includes(status);
    const failed = denied || status === 0 || status === 429 || status >= 500;
    const success = status >= 200 && status < 400;
    const slow = success && state.latencyMs > 0 && durationMs > Math.max(1000, state.latencyMs * 2);
    state.denials = denied ? state.denials + 1 : 0;
    if (failed || slow) {
      state.healthy = 0;
      state.delayMs = Math.min(this.maximum, Math.max(1000, state.delayMs * (failed ? 1.5 : 1.25)));
    } else if (success) {
      state.healthy += 1;
      if (state.healthy >= 10) {
        state.delayMs = Math.max(this.minimum, state.delayMs * 0.9);
        state.healthy = 0;
      }
    } else state.healthy = 0;
    // Failed responses and challenge pages must not teach the healthy baseline.
    if (success && Number.isFinite(durationMs) && durationMs >= 0) {
      state.latencyMs = state.latencyMs ? state.latencyMs * 0.9 + durationMs * 0.1 : Math.max(1, durationMs);
    }
    if (state.denials >= 3) {
      state.pauseUntil = Math.max(state.pauseUntil, this.now() + (this.options.denialPauseMs ?? 900_000));
    }
    state.nextAt = Math.max(state.nextAt, state.lastStartedAt + state.delayMs);
    await this.save(host, state);
    if (state.delayMs !== previous || state.denials >= 3) this.options.diagnostic?.({
      hostname: host, statusCode: status, delayMs: Math.round(state.delayMs),
      reason: state.denials >= 3 ? "repeated-access-denial" : failed ? "request-failed" : slow ? "response-slowed" : "healthy-recovery",
      pauseUntil: state.pauseUntil || null,
    });
  }
}
