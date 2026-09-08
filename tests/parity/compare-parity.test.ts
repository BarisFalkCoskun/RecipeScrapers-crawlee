import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = join(process.cwd(), "tools/parity/compare-parity.cjs");

type LegacyRecord = Record<string, unknown>;
type CrawleeRecord = Record<string, unknown>;

function compare(
  legacy: LegacyRecord[],
  crawlee: CrawleeRecord[],
  scrapyLog?: string
): string {
  const dir = mkdtempSync(join(tmpdir(), "compare-parity-"));
  const legacyPath = join(dir, "legacy.json");
  const crawleePath = join(dir, "crawlee.json");
  const logPath = join(dir, "legacy.scrapy.log");
  writeFileSync(legacyPath, JSON.stringify(legacy));
  writeFileSync(crawleePath, JSON.stringify(crawlee));
  writeFileSync(logPath, scrapyLog ?? "");
  // The script exits non-zero on a mismatch, which is the verdict some of
  // these cases are asserting, so the output is read rather than the status.
  try {
    // Deliberately passes only the two dump paths, the way shadow-parity.sh
    // calls it, so the log has to be found by derivation from legacy.json.
    void logPath;
    return execFileSync("node", [SCRIPT, legacyPath, crawleePath], {
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

describe("compare-parity field normalisation", () => {
  // meny's legacy records read "1.0 liter vand" and "100.0 g hindbaer" where V2
  // reads "1 liter vand" and "100 g hindbaer". All 100 records the two sides
  // shared were reported as differing on ingredients, and not one quantity was
  // actually different. pillsbury and tastesbetterfromscratch carry it too.
  it("treats a whole number written with a redundant decimal as the same amount", () => {
    const legacy = legacyRecipe("https://example.com/r/1", "Iste");
    legacy.ingredients = [
      { original: "1.0 liter vand" },
      { original: "100.0 g hindbaer" },
      { original: "1.5 dl mynte" },
    ];
    const crawlee = crawleeRecipe(
      "https://example.com/r/1",
      "https://example.com/r/1",
      "Iste"
    );
    (crawlee.normalized as Record<string, unknown>).ingredients = [
      { original: "1 liter vand" },
      { original: "100 g hindbaer" },
      { original: "1.5 dl mynte" },
    ];
    const out = compare([legacy], [crawlee]);
    expect(out).toContain("ALL MATERIAL FIELDS MATCH");
    expect(out).not.toContain("### ingredients");
  });

  // spisbedre divides a recipe three ways: legacy renders "2.08333 g gaer" and
  // "133.333 g oksemoerbrad" while V2 carries 2.0833333333333 and
  // 133.3333333 at full float precision. 373 of its records were reported as
  // differing on ingredients and not one quantity was different. Legacy's own
  // rounding is not one convention either -- three decimals on one value and
  // four on the next in the same record -- so both sides round to three.
  it("treats the same amount at two precisions as one amount", () => {
    const legacy = legacyRecipe("https://example.com/r/3", "Broed");
    legacy.ingredients = [
      { original: "2.08333 g gaer" },
      { original: "133.333 g oksemoerbrad" },
      { original: "0.3333 spsk. olivenolie" },
      { original: "1.25 dl vand" },
    ];
    const crawlee = crawleeRecipe(
      "https://example.com/r/3",
      "https://example.com/r/3",
      "Broed"
    );
    (crawlee.normalized as Record<string, unknown>).ingredients = [
      { original: "2.0833333333333 g gaer" },
      { original: "133.3333333 g oksemoerbrad" },
      { original: "0.333333 spsk. olivenolie" },
      { original: "1.25 dl vand" },
    ];
    const out = compare([legacy], [crawlee]);
    expect(out).toContain("ALL MATERIAL FIELDS MATCH");
    expect(out).not.toContain("### ingredients");
  });

  // Rounding must not reach amounts that were never imprecise.
  it("leaves a two-decimal amount alone and still reports a real difference", () => {
    const legacy = legacyRecipe("https://example.com/r/4", "Kage");
    legacy.ingredients = [{ original: "0.125 tsk salt" }];
    const crawlee = crawleeRecipe(
      "https://example.com/r/4",
      "https://example.com/r/4",
      "Kage"
    );
    (crawlee.normalized as Record<string, unknown>).ingredients = [
      { original: "0.126 tsk salt" },
    ];
    expect(compare([legacy], [crawlee])).toContain("### ingredients");
  });

  // The collapse must not swallow a real difference: only a trailing .0 goes.
  it("still reports a genuinely different amount", () => {
    const legacy = legacyRecipe("https://example.com/r/2", "Kage");
    legacy.ingredients = [{ original: "2.0 dl fløde" }];
    const crawlee = crawleeRecipe(
      "https://example.com/r/2",
      "https://example.com/r/2",
      "Kage"
    );
    (crawlee.normalized as Record<string, unknown>).ingredients = [
      { original: "3 dl fløde" },
    ];
    const out = compare([legacy], [crawlee]);
    expect(out).toContain("### ingredients");
  });
});

describe("compare-parity legacy health", () => {
  // Sixteen sources were compared on 2026-08-29 against a legacy run
  // Cloudflare had stopped mid-pagination. theseasonedmom took two pages of its
  // WPRM API and got 403 on the third, and its 200 records were published as a
  // 1868-record V2 surplus. The same URL answered 200 on 2026-09-03 to both a
  // browser and the spider's own user agent, so the block was pacing, and the
  // verdict was simply wrong.
  const blockedLog =
    "2026-08-29 19:31:04 [fixture] WARNING: WPRM API request blocked: " +
    "block_reason=http_403 status=403 " +
    "url=https://example.com/wp-json/wp/v2/wprm_recipe?per_page=100&page=3\n";

  it("refuses to publish a verdict built on a blocked legacy run", () => {
    const out = compare(
      [legacyRecipe("https://www.example.com/recipes/pie/aaa", "Pie")],
      [
        crawleeRecipe(
          "https://example.com/recipes/pie/aaa",
          "https://www.example.com/recipes/pie/aaa",
          "Pie"
        ),
        crawleeRecipe(
          "https://example.com/recipes/cake/bbb",
          "https://www.example.com/recipes/cake/bbb",
          "Cake"
        ),
      ],
      blockedLog
    );
    expect(out).toContain("INCONCLUSIVE: the legacy run was blocked");
    expect(out).toContain("block_reason=http_403");
    expect(out).not.toContain("MISMATCH");
  });

  it("still reports a real verdict when the legacy run was healthy", () => {
    const out = compare(
      [legacyRecipe("https://www.example.com/recipes/pie/aaa", "Pie")],
      [
        crawleeRecipe(
          "https://example.com/recipes/pie/aaa",
          "https://www.example.com/recipes/pie/aaa",
          "Pie"
        ),
      ],
      "2026-08-29 19:31:04 [fixture] INFO: Closing spider (finished)\n"
    );
    expect(out).toContain("ALL MATERIAL FIELDS MATCH");
  });
});
