import { createHash, randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { Cookie, CookieJar } from "tough-cookie";
import type { BrowserContext, Cookie as BrowserCookie } from "playwright";
import { createBoundedDiagnostic, type BoundedDiagnostic } from "./diagnostics.js";
import { readPrivateState, writePrivateState } from "./private-state.js";

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;
interface Snapshot {
  version: 1;
  expiresAt: number;
  transportHash: string;
  state: StorageState;
}
interface SessionOptions {
  diagnosticSink?: (event: BoundedDiagnostic) => void;
  directory?: string;
  /** Include source ID, allowed hosts and request/browser profile in the identity. */
  identity?: string;
  allowedDomains?: string[];
  maxAgeMs?: number;
  now?: () => number;
}
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/** One source attempt owns its state across HTTP requests and rendered pages. */
export class DanishJsonLdSiteSession {
  readonly cookieJar = new CookieJar();
  readonly id = randomUUID();
  private currentGeneration = 0;
  private transportInitialized = false;
  private transportKey?: string;
  private readonly diagnosticSink?: (event: BoundedDiagnostic) => void;
  private origins: StorageState["origins"] = [];
  private partitionedCookies: BrowserCookie[] = [];
  private readonly restoredContexts = new WeakMap<BrowserContext, number>();
  private loaded = false;
  private expiresAt: number;
  private readonly now: () => number;
  private readonly path?: string;

  constructor(private readonly options: SessionOptions = {}) {
    this.diagnosticSink = options.diagnosticSink;
    this.now = options.now ?? Date.now;
    this.expiresAt = this.now() + (options.maxAgeMs ?? 24 * 60 * 60_000);
    this.path = options.directory && options.identity
      ? join(options.directory, "browser-state", `${digest(options.identity)}.json`) : undefined;
  }

  get generation(): number {
    return this.currentGeneration;
  }

  async prepareRequest(proxyUrl?: string): Promise<void> {
    if (!this.loaded) {
      this.loaded = true;
      const snapshot = this.path ? await readPrivateState(this.path) as Snapshot | undefined : undefined;
      if (snapshot?.version === 1 && Number.isFinite(snapshot.expiresAt) && snapshot.expiresAt > this.now()
        && snapshot.expiresAt <= this.now() + (this.options.maxAgeMs ?? 24 * 60 * 60_000)
        && snapshot.transportHash === digest(proxyUrl ?? "direct")
        && this.validState(snapshot.state)) {
        this.expiresAt = snapshot.expiresAt;
        this.origins = snapshot.state.origins.filter((entry) => this.allowsOrigin(entry.origin));
        await this.replaceCookies(snapshot.state.cookies);
        this.emit("site-session-loaded", { originCount: this.origins.length });
      } else if (this.path) await rm(this.path, { force: true });
    }
    if (this.now() >= this.expiresAt) await this.reset("state-expired");
    if (this.transportInitialized && proxyUrl !== this.transportKey) {
      await this.reset("egress-changed");
    }
    this.transportInitialized = true;
    this.transportKey = proxyUrl;
    this.emit("site-session-request", { storedEntries: (await this.cookieJar.serialize()).cookies.length });
  }

  async reset(reason: string): Promise<void> {
    this.currentGeneration += 1;
    // Keep the object stable: an HTTP client may retain a reference to this jar.
    await this.cookieJar.removeAllCookies();
    this.origins = [];
    this.partitionedCookies = [];
    this.expiresAt = this.now() + (this.options.maxAgeMs ?? 24 * 60 * 60_000);
    this.transportInitialized = false;
    this.transportKey = undefined;
    this.loaded = true;
    if (this.path) await rm(this.path, { force: true });
    this.emit("site-session-reset", { reason });
  }

  private async cookiesForBrowser(): Promise<BrowserCookie[]> {
    const serialized = await this.cookieJar.serialize();
    const cookies: BrowserCookie[] = [];
    for (const entry of serialized.cookies) {
      const cookie = Cookie.fromJSON(entry);
      if (!cookie?.domain) continue;
      const expiry = cookie.expiryTime() ?? Infinity;
      if (expiry <= this.now()) continue;
      cookies.push({
        name: cookie.key,
        value: cookie.value,
        domain: `${cookie.hostOnly ? "" : "."}${cookie.domain}`,
        path: cookie.path ?? "/",
        expires: Number.isFinite(expiry) ? expiry / 1000 : -1,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite === "strict" ? "Strict" : cookie.sameSite === "none" ? "None" : "Lax",
      });
    }
    return [...cookies.filter((cookie) => this.allowsCookie(cookie)), ...this.partitionedCookies.filter((cookie) =>
      cookie.expires < 0 || cookie.expires * 1000 > this.now())];
  }

  async restoreBrowser(context: BrowserContext): Promise<number> {
    const cookies = await this.cookiesForBrowser();
    if (this.restoredContexts.get(context) !== this.currentGeneration) {
      // Native restoration includes IndexedDB, clears old origins, and runs
      // before page scripts. Avoid replaying stale local storage on every page.
      await context.setStorageState({ cookies, origins: this.origins });
      this.restoredContexts.set(context, this.currentGeneration);
    } else {
      await context.clearCookies();
      await context.addCookies(cookies);
    }
    this.emit("site-session-browser-restored", { storedEntries: cookies.length });
    return this.currentGeneration;
  }

  async captureBrowser(context: BrowserContext, generation: number): Promise<void> {
    if (generation !== this.currentGeneration) return;
    let state: StorageState;
    try {
      state = await context.storageState({ indexedDB: true });
    } catch (error) {
      if (error instanceof Error && /Target (?:page, context or browser has been closed|closed)/u.test(error.message)) {
        this.emit("site-session-browser-unavailable", { reason: "context-closed" });
        return;
      }
      throw error;
    }
    if (generation !== this.currentGeneration) return;
    this.origins = state.origins.filter((entry) => this.allowsOrigin(entry.origin));
    await this.replaceCookies(state.cookies);
    await this.persist();
    this.emit("site-session-browser-captured", { storedEntries: state.cookies.length, originCount: this.origins.length });
  }

  private async replaceCookies(cookies: BrowserCookie[]): Promise<void> {
    // Replace, rather than merge: deletions must survive browser replacement.
    await this.cookieJar.removeAllCookies();
    this.partitionedCookies = [];
    for (const entry of cookies) {
      if (!this.allowsCookie(entry)) continue;
      if (entry.partitionKey) {
        this.partitionedCookies.push(entry); // Never send partitioned cookies as ordinary HTTP cookies.
        continue;
      }
      const domain = entry.domain.replace(/^\./u, "");
      const cookie = new Cookie({
        key: entry.name,
        value: entry.value,
        // Supplying Domain for an IP host is invalid; let the URL establish
        // host-only scope, just as a Set-Cookie header without Domain does.
        ...(entry.domain.startsWith(".") ? { domain } : {}),
        hostOnly: !entry.domain.startsWith("."),
        path: entry.path,
        secure: entry.secure,
        httpOnly: entry.httpOnly,
        expires: entry.expires < 0 ? "Infinity" : new Date(entry.expires * 1000),
        sameSite: entry.sameSite.toLowerCase(),
      });
      await this.cookieJar.setCookie(cookie, `${entry.secure ? "https" : "http"}://${domain}${entry.path}`, { ignoreError: true });
    }
  }

  /** Called after HTTP responses as well as browser captures and graceful shutdown. */
  async persist(): Promise<void> {
    if (!this.path || !this.transportInitialized) return;
    const state = { cookies: await this.cookiesForBrowser(), origins: this.origins };
    if (Buffer.byteLength(JSON.stringify(state)) > 10 * 1024 * 1024) {
      await rm(this.path, { force: true });
      this.emit("site-session-not-persisted", { reason: "state-too-large" });
      return;
    }
    await writePrivateState(this.path, { version: 1, expiresAt: this.expiresAt,
      transportHash: digest(this.transportKey ?? "direct"), state } satisfies Snapshot);
  }

  private allowsOrigin(origin: string): boolean {
    try {
      const url = new URL(origin);
      return ["http:", "https:"].includes(url.protocol)
        && (!this.options.allowedDomains || this.options.allowedDomains.includes(url.hostname));
    } catch { return false; }
  }

  private allowsCookie(cookie: BrowserCookie): boolean {
    const domain = cookie.domain.replace(/^\./u, "");
    return !this.options.allowedDomains || this.options.allowedDomains.some((host) =>
      host === domain || (cookie.domain.startsWith(".") && host.endsWith(`.${domain}`)));
  }

  private validState(state: StorageState | undefined): state is StorageState {
    return !!state && Array.isArray(state.cookies) && state.cookies.every((c) => c &&
      typeof c.name === "string" && typeof c.value === "string" && typeof c.domain === "string"
      && typeof c.path === "string" && Number.isFinite(c.expires) && ["Strict", "Lax", "None"].includes(c.sameSite))
      && Array.isArray(state.origins) && state.origins.every((o) => o && typeof o.origin === "string"
        && Array.isArray(o.localStorage) && o.localStorage.every((v) => v && typeof v.name === "string" && typeof v.value === "string"));
  }

  private emit(event: string, data: Record<string, unknown>): void {
    this.diagnosticSink?.(createBoundedDiagnostic(event, {
      sessionId: this.id,
      generation: this.currentGeneration,
      ...data,
    }));
  }
}
