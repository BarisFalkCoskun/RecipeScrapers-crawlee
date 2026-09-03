import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = join(process.cwd(), "tools/parity/compare-parity.cjs");

type LegacyRecord = Record<string, unknown>;
type CrawleeRecord = Record<string, unknown>;

function compare(legacy: LegacyRecord[], crawlee: CrawleeRecord[]): string {
  const dir = mkdtempSync(join(tmpdir(), "compare-parity-"));
  const legacyPath = join(dir, "legacy.json");
  const crawleePath = join(dir, "crawlee.json");
  writeFileSync(legacyPath, JSON.stringify(legacy));
  writeFileSync(crawleePath, JSON.stringify(crawlee));
  // The script exits non-zero on a mismatch, which is the verdict some of
  // these cases are asserting, so the output is read rather than the status.
  try {
    return execFileSync("node", [SCRIPT, legacyPath, crawleePath, "fixture"], {
      encoding: "utf8",
    });
  } catch (error) {
    const stdout = (error as { stdout?: string }).stdout;
    if (typeof stdout !== "string") throw error;
    return stdout;
  }
}

const legacyRecipe = (url: string, title: string): LegacyRecord => ({
  url,
  title,
  ingredients: [{ original: "1 cup flour" }],
  instructions: [{ step: 1, text: "Mix it." }],
  image_urls: ["https://example.com/a.jpg"],
  tags: [],
  servings: 4,
});

const crawleeRecipe = (
  canonicalUrl: string,
  pageUrl: string,
  title: string
): CrawleeRecord => ({
  canonicalUrl,
  pageUrl,
  normalized: {
    title,
    ingredients: [{ original: "1 cup flour" }],
    instructions: [{ position: 1, text: "Mix it." }],
    imageUrls: ["https://example.com/a.jpg"],
    keywords: [],
    cuisines: [],
    yieldText: "4",
  },
});

describe("compare-parity record keying", () => {
  // pillsbury addresses a recipe as /recipes/<slug>/<uuid> and for 21 of its
  // recipes the uuid in its sitemap is not the uuid in that page's own
  // canonical tag. Legacy stores the URL it fetched and V2 the declared
  // canonical, so those 21 were counted twice - once on each side - and the
  // source read as having a 37/59 discovery gap it did not have.
  it("pairs a record whose declared canonical disagrees with the URL it was fetched from", () => {
    const out = compare(
      [legacyRecipe("https://www.example.com/recipes/pie/aaa", "Pie")],
      [
        crawleeRecipe(
          "https://example.com/recipes/pie/bbb",
          "https://www.example.com/recipes/pie/aaa",
          "Pie"
        ),
      ]
    );
    expect(out).toContain("only legacy: 0");
    expect(out).toContain("only crawlee: 0");
  });

  it("leaves a genuinely absent record reported as absent", () => {
    const out = compare(
      [legacyRecipe("https://www.example.com/recipes/pie/aaa", "Pie")],
      [
        crawleeRecipe(
          "https://example.com/recipes/cake/bbb",
          "https://www.example.com/recipes/cake/bbb",
          "Cake"
        ),
      ]
    );
    expect(out).toContain("only legacy: 1");
    expect(out).toContain("only crawlee: 1");
  });

  it("is inert when the canonical and the fetched URL agree", () => {
    const out = compare(
      [legacyRecipe("https://www.example.com/recipes/pie/aaa", "Pie")],
      [
        crawleeRecipe(
          "https://example.com/recipes/pie/aaa",
          "https://www.example.com/recipes/pie/aaa",
          "Pie"
        ),
      ]
    );
    expect(out).toContain("only legacy: 0");
    expect(out).toContain("only crawlee: 0");
    expect(out).toContain("crawlee: 1 (unique keys 1 )");
  });

  // The fallback must not merge two distinct crawlee records onto one key, so
  // it is skipped wherever applying it would collapse the crawlee side - the
  // same guard the lowercase and .html relaxations use.
  it("does not fire when using the fetched URL would collapse two records", () => {
    const out = compare(
      [legacyRecipe("https://www.example.com/recipes/pie", "Pie")],
      [
        crawleeRecipe(
          "https://example.com/recipes/pie/aaa",
          "https://www.example.com/recipes/pie",
          "Pie"
        ),
        crawleeRecipe(
          "https://example.com/recipes/pie/bbb",
          "https://www.example.com/recipes/pie",
          "Pie"
        ),
      ]
    );
    expect(out).toContain("crawlee: 2 (unique keys 2 )");
    expect(out).toContain("only legacy: 1");
  });
});
