import { describe, it, expect } from "vitest";
import { hashRecipe, hashHtml } from "../../src/utils/hash.js";

describe("hashRecipe", () => {
  it("returns a hex string", () => {
    const result = hashRecipe({ name: "Kage" });
    expect(result).toMatch(/^[a-f0-9]+$/);
  });

  it("produces same hash regardless of key order", () => {
    const a = hashRecipe({ name: "Kage", time: "30min" });
    const b = hashRecipe({ time: "30min", name: "Kage" });
    expect(a).toBe(b);
  });

  it("produces different hash for different content", () => {
    const a = hashRecipe({ name: "Kage" });
    const b = hashRecipe({ name: "Suppe" });
    expect(a).not.toBe(b);
  });

  it("handles nested objects", () => {
    const a = hashRecipe({ nutrition: { calories: 200 }, name: "Kage" });
    const b = hashRecipe({ name: "Kage", nutrition: { calories: 200 } });
    expect(a).toBe(b);
  });
});

describe("hashHtml", () => {
  it("returns a hex string", () => {
    const result = hashHtml("<html><body>Hello</body></html>");
    expect(result).toMatch(/^[a-f0-9]+$/);
  });

  it("produces same hash for same content", () => {
    const html = "<html><body>Test</body></html>";
    expect(hashHtml(html)).toBe(hashHtml(html));
  });

  it("produces different hash for different content", () => {
    expect(hashHtml("<p>A</p>")).not.toBe(hashHtml("<p>B</p>"));
  });
});
