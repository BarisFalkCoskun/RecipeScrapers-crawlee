import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CooldownPendingError, retryAfterDeadline, WebsiteCooldowns } from "../../src/danish-jsonld/website-cooldowns.js";

describe("website cooldowns", () => {
  it("accepts seconds and HTTP dates, rejecting malformed delays", () => {
    const now = Date.parse("2026-09-22T12:00:00Z");
    expect(retryAfterDeadline("60", now)).toBe(now + 60_000);
    expect(retryAfterDeadline("Tue, 22 Sep 2026 12:01:00 GMT", now)).toBe(now + 60_000);
    expect(retryAfterDeadline("Tue, 22 Sep 2026 11:59:00 GMT", now)).toBe(now);
    for (const value of [undefined, "", "-1", "1.5", "nonsense", "999999999999999999999999"]) {
      expect(retryAfterDeadline(value, now)).toBeUndefined();
    }
  });

  it("backs off progressively, resets after success, and never shortens Retry-After", async () => {
    let now = 1_000;
    const cooldown = new WebsiteCooldowns({ now: () => now, baseDelayMs: 100, maxDelayMs: 400 });
    await cooldown.observe("https://example.com/a", 429, {});
    expect(await cooldown.remaining("http://www.example.com/b")).toBe(100);
    expect(await cooldown.remaining("https://other.example/b")).toBe(0);
    await expect(cooldown.beforeRequest("https://example.com/c")).rejects.toBeInstanceOf(CooldownPendingError);
    now += 100;
    await cooldown.observe("https://example.com/b", 503, {});
    expect(await cooldown.remaining("https://example.com/a")).toBe(200);
    now += 200;
    await cooldown.observe("https://example.com/a", 429, { "Retry-After": "3600" });
    expect(await cooldown.remaining("https://example.com/b")).toBe(3_600_000);
    now += 1;
    await cooldown.observe("https://example.com/a", 200, {});
    expect(await cooldown.remaining("https://example.com/b")).toBe(3_599_999);
    now += 3_600_000;
    await cooldown.observe("https://example.com/a", 503, {});
    expect(await cooldown.remaining("https://example.com/b")).toBe(100);
  });

  it("shares deadlines across processes/transports and restart without lost extensions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cooldown-test-"));
    let now = 1_000;
    try {
      const http = new WebsiteCooldowns({ directory, now: () => now, baseDelayMs: 10 });
      const browser = new WebsiteCooldowns({ directory, now: () => now, baseDelayMs: 10 });
      browser.register("https://example.com/browser");
      await Promise.all([
        http.observe("https://www.example.com/a", 429, { "retry-after": "120" }),
        browser.observe("https://example.com/b", 503, { "retry-after": "30" }),
      ]);
      expect(await browser.ready()).toBe(false);
      expect(await http.remaining("https://example.com/c")).toBe(120_000);
      const resumed = new WebsiteCooldowns({ directory, now: () => now });
      expect(await resumed.remaining("https://example.com/d")).toBe(120_000);
      now += 120_000;
      expect(await browser.ready()).toBe(true);
      now += 900_001;
      expect(await resumed.remaining("https://example.com/d")).toBe(0);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
