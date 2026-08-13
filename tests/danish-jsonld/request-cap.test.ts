import { describe, expect, it } from "vitest";
import { createSourceRequestBudget } from "../../src/danish-jsonld/request-cap.js";

describe("Danish JSON-LD per-source total request cap", () => {
  it("allows one handled request and prevents a second handler from running", async () => {
    const budget = createSourceRequestBudget(1);
    const handled: string[] = [];

    const first = await budget.handle("https://example.dk/sitemap.xml", async () => {
      handled.push("sitemap");
      return ["https://example.dk/opskrifter/one"];
    });
    const second = await budget.handle("https://example.dk/opskrifter/one", async () => {
      handled.push("recipe");
      return [];
    });

    expect(first.handled).toBe(true);
    expect(second).toEqual({ handled: false, capReached: true });
    expect(handled).toEqual(["sitemap"]);
    expect(budget.snapshot()).toEqual({
      handledRequests: 1,
      maxRequests: 1,
      capReached: true,
    });
  });

  it("counts a retry attempt against the same total cap", async () => {
    const budget = createSourceRequestBudget(1);
    let attempts = 0;

    const first = await budget.handle("https://example.dk/one", async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("retry");
      return "ok";
    }).catch(() => undefined);
    expect(first).toBeUndefined();

    const retry = await budget.handle("https://example.dk/one", async () => {
      attempts += 1;
      return "ok";
    });

    expect(retry).toEqual({ handled: false, capReached: true });
    expect(attempts).toBe(1);
  });
});
