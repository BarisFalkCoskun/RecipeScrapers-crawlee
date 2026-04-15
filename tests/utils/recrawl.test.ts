import { describe, expect, it } from "vitest";
import {
  getRecrawlCutoff,
  shouldSkipRecrawl,
  wasFetchedSince,
} from "../../src/utils/recrawl.js";

describe("recrawl utils", () => {
  it("computes a recrawl cutoff from the configured TTL", () => {
    const now = new Date("2026-03-28T12:00:00.000Z");
    const cutoff = getRecrawlCutoff(30, now);

    expect(cutoff.toISOString()).toBe("2026-02-26T12:00:00.000Z");
  });

  it("treats pages fetched after the cutoff as fresh", () => {
    const cutoff = new Date("2026-03-01T00:00:00.000Z");

    expect(wasFetchedSince(new Date("2026-03-15T00:00:00.000Z"), cutoff)).toBe(
      true
    );
    expect(wasFetchedSince(new Date("2026-02-15T00:00:00.000Z"), cutoff)).toBe(
      false
    );
  });

  it("decides whether to skip recrawling from an existing page document", () => {
    const cutoff = new Date("2026-03-01T00:00:00.000Z");

    expect(
      shouldSkipRecrawl({ fetchedAt: new Date("2026-03-20T00:00:00.000Z") }, cutoff)
    ).toBe(true);
    expect(
      shouldSkipRecrawl({ fetchedAt: new Date("2026-02-01T00:00:00.000Z") }, cutoff)
    ).toBe(false);
    expect(shouldSkipRecrawl(null, cutoff)).toBe(false);
  });
});
