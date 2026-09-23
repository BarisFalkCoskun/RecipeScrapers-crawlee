import { describe, expect, it } from "vitest";
import type { BrowserContext, Cookie as BrowserCookie } from "playwright";
import { DanishJsonLdSiteSession } from "../../src/danish-jsonld/site-session.js";

// Only the browser boundary is substituted; cookie scoping and persistence use
// the real tough-cookie jar. Live HTTP/browser transfer is covered separately.
function browserContext(initial: BrowserCookie[] = []) {
  let values = initial;
  return {
    cookies: async () => values,
    clearCookies: async () => { values = []; },
    addCookies: async (cookies: BrowserCookie[]) => { values = cookies; },
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
      cookies: async () => { throw new Error("browserContext.cookies: Target page, context or browser has been closed"); },
    } as unknown as BrowserContext;
    await expect(session.captureBrowser(closedContext, session.generation)).resolves.toBeUndefined();
    expect(await session.cookieJar.getCookieString("https://recipes.test/")).toBe("visitor=known");
  });
});
