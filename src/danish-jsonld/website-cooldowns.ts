import { randomUUID, createHash } from "node:crypto";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RetryRequestError } from "crawlee";

type Headers = Record<string, string | string[] | undefined>;
export function responseHeader(headers: Headers, name: string): string | undefined {
  const value = Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
  return Array.isArray(value) ? value[0] : value;
}

export function retryAfterDeadline(value: string | undefined, now: number): number | undefined {
  if (!value?.trim()) return undefined;
  const text = value.trim();
  if (/^\d+$/u.test(text)) {
    const deadline = now + Number(text) * 1000;
    return Number.isSafeInteger(deadline) ? deadline : undefined;
  }
  // Do not let Date.parse interpret negative or fractional seconds as dates.
  if (!/[a-z]/iu.test(text)) return undefined;
  const date = Date.parse(text);
  return Number.isFinite(date) ? Math.max(now, date) : undefined;
}

export class CooldownPendingError extends RetryRequestError {
  constructor() { super("Website cooldown active; returning request to its queue"); }
}
export class WebsiteResponseRetryError extends Error {
  constructor(readonly statusCode: number) {
    super(`HTTP ${statusCode}; retry after the website cooldown`);
  }
}

interface Event { at: number; until: number; success: boolean }
const STREAK_WINDOW_MS = 15 * 60_000;

/** Shared by both transports. Immutable deadline files cannot overwrite a longer
 * cooldown from another worker. They also survive process restarts and VPN changes.
 * A success resets exponential backoff, but never cancels an announced deadline.
 */
export class WebsiteCooldowns {
  private readonly events = new Map<string, Event[]>();
  private readonly hosts = new Set<string>();
  private readonly now: () => number;
  constructor(private readonly options: {
    directory?: string;
    now?: () => number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    diagnostic?: (data: Record<string, unknown>) => void;
  } = {}) { this.now = options.now ?? Date.now; }

  register(url: string): void { this.hosts.add(this.host(url)); }
  private host(url: string): string { return new URL(url).hostname.toLowerCase().replace(/^www\./u, ""); }
  private directory(host: string): string | undefined {
    return this.options.directory && join(this.options.directory, "cooldowns", createHash("sha256").update(host).digest("hex"));
  }
  private async read(host: string): Promise<Event[]> {
    const directory = this.directory(host);
    if (!directory) return this.events.get(host) ?? [];
    let names: string[];
    try { names = await readdir(directory); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
    const events: Event[] = [];
    const now = this.now();
    for (const name of names) {
      const match = /^(\d+)-(\d+)-(success|failure)-[a-f0-9-]+$/u.exec(name);
      if (!match) continue;
      const event = { at: Number(match[1]), until: Number(match[2]), success: match[3] === "success" };
      if (event.until <= now && event.at < now - STREAK_WINDOW_MS) {
        await unlink(join(directory, name)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
      } else events.push(event);
    }
    return events;
  }
  private async append(host: string, event: Event): Promise<void> {
    const directory = this.directory(host);
    if (directory) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(join(directory, `${event.at}-${event.until}-${event.success ? "success" : "failure"}-${randomUUID()}`), "", { flag: "wx", mode: 0o600 });
    } else {
      const events = (this.events.get(host) ?? []).filter((e) => e.until > this.now() || e.at >= this.now() - STREAK_WINDOW_MS);
      events.push(event);
      this.events.set(host, events);
    }
  }
  async remaining(url: string): Promise<number> {
    const events = await this.read(this.host(url));
    return Math.max(0, ...events.map((e) => e.until - this.now()));
  }
  async ready(): Promise<boolean> {
    for (const host of this.hosts) if (await this.remaining(`https://${host}`) > 0) return false;
    return true;
  }
  async beforeRequest(url: string): Promise<void> {
    this.register(url);
    if (await this.remaining(url) > 0) throw new CooldownPendingError();
  }
  async observe(url: string, status: number, headers: Headers): Promise<void> {
    this.register(url);
    const host = this.host(url);
    const now = this.now();
    const deadline = retryAfterDeadline(responseHeader(headers, "retry-after"), now);
    const failure = status === 429 || status >= 500;
    const events = await this.read(host);
    const lastSuccess = Math.max(0, ...events.filter((e) => e.success).map((e) => e.at));
    const failures = events.filter((e) => !e.success && e.at >= lastSuccess && e.at >= now - STREAK_WINDOW_MS).length;
    if (!failure && deadline === undefined) {
      if (status >= 200 && status < 400 && failures) await this.append(host, { at: now, until: 0, success: true });
      return;
    }
    const delay = failure ? Math.min(this.options.maxDelayMs ?? 900_000, (this.options.baseDelayMs ?? 30_000) * 2 ** Math.min(failures, 16)) : 0;
    const until = Math.max(now + delay, deadline ?? now);
    await this.append(host, { at: now, until, success: false });
    this.options.diagnostic?.({ hostname: host, statusCode: status, notBefore: new Date(Math.min(until, 8.64e15)).toISOString(), delayMs: until - now });
  }
}
