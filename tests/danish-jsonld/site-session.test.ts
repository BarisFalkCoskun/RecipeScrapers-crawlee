import { describe, expect, it } from "vitest";
import type { BrowserContext, Cookie as BrowserCookie } from "playwright";
import { DanishJsonLdSiteSession } from "../../src/danish-jsonld/site-session.js";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Only the browser boundary is substituted; cookie scoping and persistence use
// the real tough-cookie jar. Live HTTP/browser transfer is covered separately.
function browserContext(initial: BrowserCookie[] = []) {
  let values = initial;
  let origins: Awaited<ReturnType<BrowserContext["storageState"]>>["origins"] = [];
  return {
    cookies: async () => values,
    clearCookies: async () => { values = []; },
    addCookies: async (cookies: BrowserCookie[]) => { values = cookies; },
    storageState: async () => structuredClone({ cookies: values, origins }),
    setStorageState: async (state: { cookies: BrowserCookie[]; origins: typeof origins }) => {
      values = structuredClone(state.cookies); origins = structuredClone(state.origins);
    },
  } as unknown as BrowserContext;
}

describe("site session state", () => {
  it("transfers HTTP cookies into a browser and returns browser updates to HTTP", async () => {
    const session = new DanishJsonLdSiteSession();
    await session.cookieJar.setCookie("visitor=first; Path=/; HttpOnly; Secure; SameSite=Lax", "https://recipes.test/start");
    await session.cookieJar.setCookie("private=yes; Path=/account; Secure", "https://recipes.test/account");
    const context = browserContext();
    const generation = await session.restoreBrowser(context);
    const cookies = await context.cookies();
    expect(cookies.find((cookie) => cookie.name === "visitor")).toMatchObject({
      value: "first", domain: "recipes.test", path: "/", httpOnly: true, secure: true, sameSite: "Lax",
    });
    await context.addCookies(cookies.filter((cookie) => cookie.name !== "private").map((cookie) => ({ ...cookie, value: "updated" })));
    await session.captureBrowser(context, generation);
    expect(await session.cookieJar.getCookieString("https://recipes.test/next")).toBe("visitor=updated");
    expect(await session.cookieJar.getCookieString("https://recipes.test/account")).toBe("visitor=updated");
    expect(await session.cookieJar.getCookieString("https://unrelated.test/")).toBe("");
    expect(await session.cookieJar.getCookieString("http://recipes.test/")).toBe("");
  });

  it("preserves domain scope, expiry and session-cookie lifetime across the browser", async () => {
    const session = new DanishJsonLdSiteSession();
    const context = browserContext([
      { name: "shared", value: "yes", domain: ".recipes.test", path: "/", expires: -1, httpOnly: false, secure: true, sameSite: "None" },
      { name: "local", value: "yes", domain: "recipes.test", path: "/", expires: 4_102_444_800, httpOnly: true, secure: true, sameSite: "Strict" },
    ]);
    await session.captureBrowser(context, session.generation);
    expect(await session.cookieJar.getCookieString("https://sub.recipes.test/")).toBe("shared=yes");
    const restored = browserContext();
    await session.restoreBrowser(restored);
    expect(await restored.cookies()).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "shared", domain: ".recipes.test", expires: -1, sameSite: "None" }),
      expect.objectContaining({ name: "local", domain: "recipes.test", expires: 4_102_444_800, sameSite: "Strict" }),
    ]));
  });

  it("clears cookies on an egress change and refuses stale browser state", async () => {
    const diagnostics: unknown[] = [];
    const session = new DanishJsonLdSiteSession({ diagnosticSink: (event) => diagnostics.push(event) });
    await session.prepareRequest("http://user:secret@127.0.0.1:1000");
    await session.cookieJar.setCookie("visitor=secret-value; Path=/", "https://recipes.test/");
    const context = browserContext();
    const oldGeneration = await session.restoreBrowser(context);
    await session.prepareRequest("http://user:secret@127.0.0.1:1000");
    expect(await session.cookieJar.getCookieString("https://recipes.test/")).toBe("visitor=secret-value");
    await session.prepareRequest("http://user:secret@127.0.0.1:1001");
    await session.captureBrowser(context, oldGeneration);
    expect(await session.cookieJar.getCookieString("https://recipes.test/")).toBe("");
    await session.restoreBrowser(context);
    expect(await context.cookies()).toEqual([]);
    expect(JSON.stringify(diagnostics)).not.toMatch(/secret|127\.0\.0\.1|visitor/);
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ event: "site-session-reset", data: expect.objectContaining({ reason: "egress-changed", generation: 1 }) }),
    ]));
  });

  it("retains the jar object across explicit rotation resets", async () => {
    const session = new DanishJsonLdSiteSession();
    const jar = session.cookieJar;
    await jar.setCookie("visitor=old; Path=/", "https://recipes.test/");
    await session.reset("relay-rotated");
    expect(session.cookieJar).toBe(jar);
    expect(await jar.getCookieString("https://recipes.test/")).toBe("");
    expect(session.generation).toBe(1);
  });

  it("keeps known state if the entire browser context has closed", async () => {
    const session = new DanishJsonLdSiteSession();
    await session.cookieJar.setCookie("visitor=known; Path=/", "https://recipes.test/");
    const closedContext = {
      storageState: async () => { throw new Error("browserContext.storageState: Target page, context or browser has been closed"); },
    } as unknown as BrowserContext;
    await expect(session.captureBrowser(closedContext, session.generation)).resolves.toBeUndefined();
    expect(await session.cookieJar.getCookieString("https://recipes.test/")).toBe("visitor=known");
  });

  it("persists cookies and origin state privately across restarts with a fixed expiry and source isolation", async () => {
    const directory = await mkdtemp(join(tmpdir(), "browser-state-test-"));
    let now = Date.now();
    const diagnostics: unknown[] = [];
    const options = { directory, identity: "source-a-en", allowedDomains: ["recipes.test"], now: () => now,
      maxAgeMs: 1000, diagnosticSink: (event: unknown) => diagnostics.push(event) };
    try {
      const first = new DanishJsonLdSiteSession(options);
      await first.prepareRequest();
      const context = browserContext();
      await context.setStorageState({ cookies: [{ name: "visitor", value: "private", domain: "recipes.test", path: "/",
        expires: -1, httpOnly: true, secure: true, sameSite: "Lax" }], origins: [
        { origin: "https://recipes.test", localStorage: [{ name: "preference", value: "private-value" }] },
        { origin: "https://unrelated.test", localStorage: [{ name: "tracking", value: "discard" }] },
      ] });
      await first.captureBrowser(context, first.generation);
      const file = join(directory, "browser-state", (await readdir(join(directory, "browser-state")))[0]);
      expect((await stat(file)).mode & 0o777).toBe(0o600);
      expect(JSON.parse(await readFile(file, "utf8")).state.origins).toHaveLength(1);
      now += 500;
      const resumed = new DanishJsonLdSiteSession(options);
      await resumed.prepareRequest();
      const restored = browserContext();
      await resumed.restoreBrowser(restored);
      expect((await restored.storageState()).origins).toEqual([
        { origin: "https://recipes.test", localStorage: [{ name: "preference", value: "private-value" }] },
      ]);
      expect(await resumed.cookieJar.getCookieString("https://recipes.test/")).toBe("visitor=private");
      const other = new DanishJsonLdSiteSession({ ...options, identity: "source-b-en" });
      await other.prepareRequest();
      expect(await other.cookieJar.getCookieString("https://recipes.test/")).toBe("");
      await resumed.persist();
      now += 501;
      const expired = new DanishJsonLdSiteSession(options);
      await expired.prepareRequest();
      const empty = browserContext();
      await expired.restoreBrowser(empty);
      expect(await empty.storageState()).toEqual({ cookies: [], origins: [] });
      expect(JSON.stringify(diagnostics)).not.toMatch(/private|tracking|preference/);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it("preserves deletions and clears all origins on rotation without accepting stale snapshots", async () => {
    const session = new DanishJsonLdSiteSession();
    await session.prepareRequest("http://127.0.0.1:1000");
    const browser = browserContext();
    const oldGeneration = await session.restoreBrowser(browser);
    await browser.setStorageState({ cookies: [], origins: [{ origin: "https://recipes.test", localStorage: [{ name: "key", value: "old" }] }] });
    await session.captureBrowser(browser, oldGeneration);
    const replacement = browserContext();
    await session.restoreBrowser(replacement);
    expect((await replacement.storageState()).origins).toHaveLength(1);
    await replacement.setStorageState({ cookies: [], origins: [] });
    await session.captureBrowser(replacement, oldGeneration);
    const afterDeletion = browserContext();
    await session.restoreBrowser(afterDeletion);
    expect((await afterDeletion.storageState()).origins).toEqual([]);
    await session.prepareRequest("http://127.0.0.1:1001");
    await session.captureBrowser(browser, oldGeneration);
    await session.restoreBrowser(browser);
    expect(await browser.storageState()).toEqual({ cookies: [], origins: [] });
  });

  it("discards corrupt snapshots and state belonging to a different proxy", async () => {
    const directory = await mkdtemp(join(tmpdir(), "browser-state-test-"));
    const options = { directory, identity: "source-a" };
    try {
      const first = new DanishJsonLdSiteSession(options);
      await first.prepareRequest("http://proxy:1000");
      await first.cookieJar.setCookie("visitor=old; Path=/", "https://recipes.test/");
      await first.persist();
      const changed = new DanishJsonLdSiteSession(options);
      await changed.prepareRequest("http://proxy:1001");
      expect(await changed.cookieJar.getCookieString("https://recipes.test/")).toBe("");
      await changed.persist();
      const file = join(directory, "browser-state", (await readdir(join(directory, "browser-state")))[0]);
      await writeFile(file, '{"version":');
      await expect(new DanishJsonLdSiteSession(options).prepareRequest("http://proxy:1001")).resolves.toBeUndefined();
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
