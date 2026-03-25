import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";
import { extractHtmlFallback } from "../../src/extractors/html-fallback.js";

function $(html: string) {
  return cheerio.load(html);
}

describe("extractHtmlFallback", () => {
  it("extracts title from h1", () => {
    const result = extractHtmlFallback($("<html><body><h1>Kanelsnurrer</h1></body></html>"));
    expect(result.recipes[0]?.["title"]).toBe("Kanelsnurrer");
    expect(result.signals).toContain("heuristic-title-from-h1");
  });

  it("extracts title from og:title if no h1", () => {
    const result = extractHtmlFallback($(
      '<html><head><meta property="og:title" content="Rugbrod Opskrift"></head><body></body></html>'
    ));
    expect(result.recipes[0]?.["title"]).toBe("Rugbrod Opskrift");
    expect(result.signals).toContain("heuristic-title-from-og");
  });

  it("extracts ingredients from ul near ingredienser keyword", () => {
    const html = `<html><body>
      <h2>Ingredienser</h2>
      <ul><li>200g mel</li><li>100g sukker</li><li>2 aeg</li></ul>
    </body></html>`;
    const result = extractHtmlFallback($(html));
    expect(result.recipes[0]?.["ingredients"]).toEqual(["200g mel", "100g sukker", "2 aeg"]);
    expect(result.signals).toContain("heuristic-ingredients-from-ul");
  });

  it("extracts instructions from ol", () => {
    const html = `<html><body>
      <h2>Fremgangsmaade</h2>
      <ol><li>Bland mel og sukker</li><li>Tilsaet aeg</li></ol>
    </body></html>`;
    const result = extractHtmlFallback($(html));
    expect(result.recipes[0]?.["instructions"]).toEqual(["Bland mel og sukker", "Tilsaet aeg"]);
    expect(result.signals).toContain("heuristic-instructions-from-ol");
  });

  it("reports missing fields in signals", () => {
    const result = extractHtmlFallback($("<html><body><p>Nothing here</p></body></html>"));
    expect(result.signals).toContain("missing-title");
    expect(result.signals).toContain("missing-ingredients");
    expect(result.signals).toContain("missing-instructions");
  });

  it("returns partial confidence based on fields found", () => {
    const html = `<html><body><h1>Kage</h1></body></html>`;
    const result = extractHtmlFallback($(html));
    expect(result.confidence).toBeLessThan(0.5);
  });
});
