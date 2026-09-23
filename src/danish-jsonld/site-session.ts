import { randomUUID } from "node:crypto";
import { Cookie, CookieJar } from "tough-cookie";
import type { BrowserContext, Cookie as BrowserCookie } from "playwright";
import { createBoundedDiagnostic, type BoundedDiagnostic } from "./diagnostics.js";

/** One source attempt owns its state across HTTP requests and rendered pages. */
export class DanishJsonLdSiteSession {
  readonly cookieJar = new CookieJar();
  readonly id = randomUUID();
  private currentGeneration = 0;
  private transportInitialized = false;
  private transportKey?: string;
  private readonly diagnosticSink?: (event: BoundedDiagnostic) => void;

  constructor(options: { diagnosticSink?: (event: BoundedDiagnostic) => void } = {}) {
    this.diagnosticSink = options.diagnosticSink;
  }

  get generation(): number {
    return this.currentGeneration;
  }

  async prepareRequest(proxyUrl?: string): Promise<void> {
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
    this.transportInitialized = false;
    this.transportKey = undefined;
    this.emit("site-session-reset", { reason });
  }

  async restoreBrowser(context: BrowserContext): Promise<number> {
    const serialized = await this.cookieJar.serialize();
    const cookies: BrowserCookie[] = [];
    for (const entry of serialized.cookies) {
      const cookie = Cookie.fromJSON(entry);
      if (!cookie?.domain) continue;
      const expiry = cookie.expiryTime() ?? Infinity;
      if (expiry <= Date.now()) continue;
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
    // A reused browser can still contain the previous relay's state.
    await context.clearCookies();
    await context.addCookies(cookies);
    this.emit("site-session-browser-restored", { storedEntries: cookies.length });
    return this.currentGeneration;
  }

  async captureBrowser(context: BrowserContext, generation: number): Promise<void> {
    if (generation !== this.currentGeneration) return;
    let cookies: BrowserCookie[];
    try {
      cookies = await context.cookies();
    } catch (error) {
      if (error instanceof Error && /Target (?:page, context or browser has been closed|closed)/u.test(error.message)) {
        this.emit("site-session-browser-unavailable", { reason: "context-closed" });
        return;
      }
      throw error;
    }
    if (generation !== this.currentGeneration) return;
    // The browser received the complete jar. Replace its snapshot so a cookie
    // deleted by the site does not reappear on the next HTTP request.
    await this.cookieJar.removeAllCookies();
    for (const entry of cookies) {
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
    this.emit("site-session-browser-captured", { storedEntries: cookies.length });
  }

  private emit(event: string, data: Record<string, unknown>): void {
    this.diagnosticSink?.(createBoundedDiagnostic(event, {
      sessionId: this.id,
      generation: this.currentGeneration,
      ...data,
    }));
  }
}
