# Danish Recipe Crawler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a broad web crawler that discovers and extracts Danish recipes from the internet, storing them in a local MongoDB database.

**Architecture:** Hybrid Crawlee crawlers — CheerioCrawler as primary, PlaywrightCrawler as JS-rendering fallback. Two separate RequestQueues. MongoDB with two collections (`pages` and `recipes`) separating fetch metadata from extracted content. URL canonicalization, content-based dedup via node-object-hash, sitemap-first discovery expanding to broad `.dk` link-following.

**Tech Stack:** TypeScript, Crawlee (CheerioCrawler + PlaywrightCrawler), MongoDB native driver, node-object-hash, Playwright, vitest for testing, tsx for dev execution.

**Spec:** `docs/superpowers/specs/2026-03-25-danish-recipe-crawler-design.md`

---

## File Structure

```
src/
├── main.ts                    # Entry point — orchestrates sitemap loading, queue seeding, runs both crawlers
├── config.ts                  # All constants: rate limits, denylist patterns, extraction signals, extractor version
├── types.ts                   # TypeScript interfaces: PageDocument, RecipeDocument, SeedConfig, ExtractionResult
├── crawlers/
│   ├── cheerio-crawler.ts     # CheerioCrawler factory — request handler extracts recipes, discovers links, detects JS fallback
│   └── playwright-crawler.ts  # PlaywrightCrawler factory — request handler for JS-rendered pages
├── extractors/
│   ├── json-ld.ts             # Extracts Recipe JSON-LD from HTML string — handles @graph, @type arrays, mainEntity
│   └── html-fallback.ts       # Heuristic extraction from Cheerio $ — title, ingredients, instructions
├── discovery/
│   ├── sitemap.ts             # Fetches and parses sitemap.xml (including nested sitemaps), returns URL+lastmod pairs
│   ├── link-filter.ts         # Filters URLs: denylist, .dk check, recipe-like detection, per-domain budget tracking
│   └── seeds.ts               # Seed domain configurations array
├── storage/
│   └── mongodb.ts             # MongoClient wrapper — connect, ensureIndexes, upsertPage, insertRecipe, close
└── utils/
    ├── hash.ts                # node-object-hash wrapper — hashRecipe(), hashHtml()
    └── canonicalize.ts        # Static URL canonicalization — strip params, fragments, normalize
tests/
├── utils/
│   ├── canonicalize.test.ts
│   └── hash.test.ts
├── extractors/
│   ├── json-ld.test.ts
│   └── html-fallback.test.ts
├── discovery/
│   └── link-filter.test.ts
└── storage/
    └── mongodb.test.ts
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.env`
- Create: `.gitignore`

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "recipe-scrapers-crawlee",
  "version": "1.0.0",
  "type": "module",
  "description": "Danish recipe web crawler",
  "scripts": {
    "start": "tsx src/main.ts",
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create .env.example (template) and .env (local, gitignored)**

`.env.example` (committed):
```
MONGODB_URI=mongodb://localhost:27017
DB_NAME=danishRecipes
```

Copy to `.env` for local use:
```bash
cp .env.example .env
```

- [ ] **Step 4: Create .gitignore**

```
node_modules/
dist/
storage/
.env
*.log
```

- [ ] **Step 5: Install dependencies**

Run: `npm install crawlee playwright mongodb node-object-hash dotenv`
Run: `npm install -D typescript tsx vitest @types/node`

- [ ] **Step 6: Install Playwright browsers**

Run: `npx playwright install chromium`

- [ ] **Step 7: Create empty source files to verify structure**

Create all directories and empty placeholder files:
```bash
mkdir -p src/crawlers src/extractors src/discovery src/storage src/utils tests/utils tests/extractors tests/discovery tests/storage
```

- [ ] **Step 8: Commit**

```bash
git init
git add package.json tsconfig.json .gitignore .env.example src/ tests/
git commit -m "chore: scaffold project with dependencies"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write all shared interfaces**

```typescript
import { Binary, ObjectId } from "mongodb";

export interface SeedConfig {
  domain: string;
  sitemapUrl: string;
  requiresJs: boolean;
  respectRobotsTxt: boolean;
  maxPages: number;
}

export interface PageDocument {
  _id?: ObjectId;
  canonicalUrl: string;
  domain: string;
  fetchedAt: Date;
  httpStatus: number;
  redirectChain?: string[];
  extractionMethod: "json-ld" | "html-parsing" | "partial" | "failed";
  extractorVersion: string;
  extractionConfidence: number;
  extractionSignals: string[];
  recipeCount: number;
  rawHtml?: Binary;
  pageContentHash: string;
  sitemapLastmod?: Date;
  etag?: string;
  lastModified?: string;
  outboundRecipeLinks: string[];
}

export interface RecipeDocument {
  _id?: ObjectId;
  pageUrl: string;
  domain: string;
  extractedAt: Date;
  extractionMethod: "json-ld" | "html-parsing" | "partial";
  extractorVersion: string;
  extractionConfidence: number;
  rawRecipe: Record<string, unknown>;
  extractionSignals: string[];
  contentHash: string;
  sourceHash: string;
}

export interface ExtractionResult {
  recipes: Record<string, unknown>[];
  method: "json-ld" | "html-parsing" | "partial";
  confidence: number;
  signals: string[];
}

export interface SitemapEntry {
  url: string;
  lastmod?: Date;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared TypeScript interfaces"
```

---

### Task 3: Configuration

**Files:**
- Create: `src/config.ts`
- Create: `src/discovery/seeds.ts`

- [ ] **Step 1: Write config.ts with all constants**

```typescript
export const EXTRACTOR_VERSION = "1.0.0";

export const CHEERIO_CONFIG = {
  maxConcurrency: 10,
  maxRequestsPerMinute: 60,
  maxRequestRetries: 3,
};

export const PLAYWRIGHT_CONFIG = {
  maxConcurrency: 3,
  maxRequestsPerMinute: 20,
  maxRequestRetries: 3,
};

export const DISCOVERY = {
  defaultMaxPagesPerDomain: 5000,
  maxNonRecipeHops: 1,
  globalQueueCap: 50_000,
  recrawlAfterDays: 30,
};

export const RECIPE_PATH_PATTERNS = [
  /\/opskrift\//i,
  /\/recipe\//i,
  /\/opskrifter\//i,
  /\/recipes\//i,
  /\/bagning\//i,
];

export const DENYLIST_PATTERNS = [
  /\/tag\//i,
  /\/kategori\//i,
  /\/category\//i,
  /\/search(?:$|[/?])/i,
  /\/login(?:$|[/?])/i,
  /\/cart(?:$|[/?])/i,
  /\/kurv(?:$|[/?])/i,
  /\/print\//i,
  /\/feed\//i,
  /\/wp-json\//i,
  /\/page\/\d+/i,
  /\/\d{4}\/\d{2}\/$/,
];

export const DANISH_KEYWORDS = [
  "ingredienser",
  "tilberedning",
  "opskrift",
  "portioner",
  "minutter",
];

export const JS_FRAMEWORK_MARKERS = [
  "__NEXT_DATA__",
  "__NUXT__",
  "window.__INITIAL_STATE__",
];

export const STRIP_QUERY_PARAMS = [
  /^utm_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^ref$/i,
  /^print$/i,
  /^amp$/i,
];

export const MIN_BODY_TEXT_LENGTH = 200;
```

- [ ] **Step 2: Write seeds.ts with seed domain configurations**

```typescript
import type { SeedConfig } from "../types.js";

export const SEEDS: SeedConfig[] = [
  {
    domain: "valdemarsro.dk",
    sitemapUrl: "https://valdemarsro.dk/sitemap.xml",
    requiresJs: false,
    respectRobotsTxt: false,
    maxPages: 5000,
  },
  {
    domain: "arla.dk",
    sitemapUrl: "https://arla.dk/sitemap.xml",
    requiresJs: false,
    respectRobotsTxt: false,
    maxPages: 5000,
  },
  {
    domain: "dk-kogebogen.dk",
    sitemapUrl: "https://www.dk-kogebogen.dk/sitemap.xml",
    requiresJs: false,
    respectRobotsTxt: false,
    maxPages: 5000,
  },
  {
    domain: "madensverden.dk",
    sitemapUrl: "https://madensverden.dk/sitemap.xml",
    requiresJs: false,
    respectRobotsTxt: false,
    maxPages: 5000,
  },
  {
    domain: "nemlig.com",
    sitemapUrl: "https://www.nemlig.com/sitemap.xml",
    requiresJs: false,
    respectRobotsTxt: false,
    maxPages: 5000,
  },
];
```

- [ ] **Step 3: Commit**

```bash
git add src/config.ts src/discovery/seeds.ts
git commit -m "feat: add configuration constants and seed domains"
```

---

### Task 4: URL Canonicalization

**Files:**
- Create: `src/utils/canonicalize.ts`
- Create: `tests/utils/canonicalize.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/utils/canonicalize.test.ts
import { describe, it, expect } from "vitest";
import { canonicalizeUrl } from "../../src/utils/canonicalize.js";

describe("canonicalizeUrl", () => {
  it("strips utm query params", () => {
    expect(canonicalizeUrl("https://example.dk/page?utm_source=google&utm_medium=cpc"))
      .toBe("https://example.dk/page");
  });

  it("strips fbclid and gclid", () => {
    expect(canonicalizeUrl("https://example.dk/page?fbclid=abc123&gclid=xyz"))
      .toBe("https://example.dk/page");
  });

  it("preserves non-tracking query params", () => {
    expect(canonicalizeUrl("https://example.dk/search?q=kage&page=2"))
      .toBe("https://example.dk/search?page=2&q=kage");
  });

  it("removes fragments", () => {
    expect(canonicalizeUrl("https://example.dk/page#section"))
      .toBe("https://example.dk/page");
  });

  it("strips trailing slashes", () => {
    expect(canonicalizeUrl("https://example.dk/opskrifter/"))
      .toBe("https://example.dk/opskrifter");
  });

  it("does not strip trailing slash from root path", () => {
    expect(canonicalizeUrl("https://example.dk/"))
      .toBe("https://example.dk/");
  });

  it("lowercases hostname", () => {
    expect(canonicalizeUrl("https://Example.DK/Page"))
      .toBe("https://example.dk/Page");
  });

  it("removes /amp/ prefix", () => {
    expect(canonicalizeUrl("https://example.dk/amp/opskrift/kage"))
      .toBe("https://example.dk/opskrift/kage");
  });

  it("removes /m/ mobile prefix", () => {
    expect(canonicalizeUrl("https://example.dk/m/opskrift/kage"))
      .toBe("https://example.dk/opskrift/kage");
  });

  it("handles combined transforms", () => {
    expect(canonicalizeUrl("https://Example.DK/amp/page/?utm_source=fb#top"))
      .toBe("https://example.dk/page");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/utils/canonicalize.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/utils/canonicalize.ts
import { STRIP_QUERY_PARAMS } from "../config.js";

export function canonicalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);

  // Lowercase hostname
  url.hostname = url.hostname.toLowerCase();

  // Remove fragments
  url.hash = "";

  // Strip tracking query params
  const keysToDelete: string[] = [];
  url.searchParams.forEach((_value, key) => {
    if (STRIP_QUERY_PARAMS.some((pattern) => pattern.test(key))) {
      keysToDelete.push(key);
    }
  });
  for (const key of keysToDelete) {
    url.searchParams.delete(key);
  }

  // Sort remaining params for consistency
  url.searchParams.sort();

  // Remove AMP/mobile path prefixes
  url.pathname = url.pathname.replace(/^\/(amp|m)\//, "/");

  // Strip trailing slash (but not from root "/")
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/utils/canonicalize.test.ts`
Expected: All 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/canonicalize.ts tests/utils/canonicalize.test.ts
git commit -m "feat: add URL canonicalization with param stripping and normalization"
```

---

### Task 5: Hash Utility

**Files:**
- Create: `src/utils/hash.ts`
- Create: `tests/utils/hash.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/utils/hash.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/utils/hash.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/utils/hash.ts
import { hasher } from "node-object-hash";
import { createHash } from "crypto";

const objectHasher = hasher({
  sort: true,
  coerce: true,
  trim: true,
});

export function hashRecipe(recipe: Record<string, unknown>): string {
  return objectHasher.hash(recipe);
}

export function hashHtml(html: string): string {
  return createHash("sha256").update(html).digest("hex");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/utils/hash.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/hash.ts tests/utils/hash.test.ts
git commit -m "feat: add hash utilities for recipe dedup and page content"
```

---

### Task 6: JSON-LD Extractor

**Files:**
- Create: `src/extractors/json-ld.ts`
- Create: `tests/extractors/json-ld.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/extractors/json-ld.test.ts
import { describe, it, expect } from "vitest";
import { extractJsonLdRecipes } from "../../src/extractors/json-ld.js";

describe("extractJsonLdRecipes", () => {
  it("extracts a simple Recipe from JSON-LD script tag", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@type": "Recipe", "name": "Kanelsnurrer", "recipeIngredient": ["mel", "sukker"]}
      </script>
    </head><body></body></html>`;

    const result = extractJsonLdRecipes(html);
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]["name"]).toBe("Kanelsnurrer");
    expect(result.signals).toContain("json-ld-found");
  });

  it("handles @graph wrapper", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@graph": [
          {"@type": "WebPage", "name": "Page"},
          {"@type": "Recipe", "name": "Rugbrod"}
        ]}
      </script>
    </head><body></body></html>`;

    const result = extractJsonLdRecipes(html);
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]["name"]).toBe("Rugbrod");
    expect(result.signals).toContain("graph-wrapper");
  });

  it("handles @type as array", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@type": ["Recipe", "HowTo"], "name": "Boller"}
      </script>
    </head><body></body></html>`;

    const result = extractJsonLdRecipes(html);
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]["name"]).toBe("Boller");
  });

  it("handles mainEntity wrapper", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@type": "WebPage", "mainEntity": {"@type": "Recipe", "name": "Kartofler"}}
      </script>
    </head><body></body></html>`;

    const result = extractJsonLdRecipes(html);
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]["name"]).toBe("Kartofler");
    expect(result.signals).toContain("main-entity-wrapper");
  });

  it("extracts multiple recipes from one page", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@type": "Recipe", "name": "Recipe1"}
      </script>
      <script type="application/ld+json">
        {"@type": "Recipe", "name": "Recipe2"}
      </script>
    </head><body></body></html>`;

    const result = extractJsonLdRecipes(html);
    expect(result.recipes).toHaveLength(2);
    expect(result.signals).toContain("multiple-recipes");
  });

  it("returns empty for no JSON-LD", () => {
    const html = `<html><body><h1>No recipes here</h1></body></html>`;
    const result = extractJsonLdRecipes(html);
    expect(result.recipes).toHaveLength(0);
  });

  it("handles malformed JSON gracefully", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        {"@type": "Recipe", "name": "Bad JSON",}
      </script>
    </head><body></body></html>`;

    const result = extractJsonLdRecipes(html);
    // Should not throw — either recovers or returns empty
    expect(result.signals.some((s) => s.startsWith("malformed-json"))).toBe(true);
  });

  it("handles JSON-LD that is an array at top level", () => {
    const html = `<html><head>
      <script type="application/ld+json">
        [{"@type": "Recipe", "name": "ArrayRecipe"}]
      </script>
    </head><body></body></html>`;

    const result = extractJsonLdRecipes(html);
    expect(result.recipes).toHaveLength(1);
    expect(result.recipes[0]["name"]).toBe("ArrayRecipe");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/extractors/json-ld.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/extractors/json-ld.ts
import * as cheerio from "cheerio";

interface JsonLdResult {
  recipes: Record<string, unknown>[];
  signals: string[];
}

export function extractJsonLdRecipes(html: string): JsonLdResult {
  const $ = cheerio.load(html);
  const recipes: Record<string, unknown>[] = [];
  const signals: string[] = [];

  $('script[type="application/ld+json"]').each((_i, el) => {
    const raw = $(el).html();
    if (!raw) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try lenient parsing: strip trailing commas
      try {
        const cleaned = raw.replace(/,\s*([\]}])/g, "$1");
        parsed = JSON.parse(cleaned);
        signals.push("malformed-json-recovered");
      } catch {
        signals.push("malformed-json-failed");
        return;
      }
    }

    const found = findRecipes(parsed, signals);
    recipes.push(...found);
  });

  if (recipes.length > 0) {
    signals.push("json-ld-found");
  }
  if (recipes.length > 1) {
    signals.push("multiple-recipes");
  }

  return { recipes, signals };
}

function isRecipeType(type: unknown): boolean {
  if (typeof type === "string") {
    return type === "Recipe" || type === "https://schema.org/Recipe";
  }
  if (Array.isArray(type)) {
    return type.some(
      (t) => t === "Recipe" || t === "https://schema.org/Recipe"
    );
  }
  return false;
}

function findRecipes(
  data: unknown,
  signals: string[]
): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];

  // Handle top-level array
  if (Array.isArray(data)) {
    return data.flatMap((item) => findRecipes(item, signals));
  }

  const obj = data as Record<string, unknown>;

  // Handle @graph
  if (Array.isArray(obj["@graph"])) {
    if (!signals.includes("graph-wrapper")) signals.push("graph-wrapper");
    return (obj["@graph"] as unknown[]).flatMap((item) =>
      findRecipes(item, signals)
    );
  }

  // Handle mainEntity
  if (obj["mainEntity"] && typeof obj["mainEntity"] === "object") {
    if (!signals.includes("main-entity-wrapper"))
      signals.push("main-entity-wrapper");
    const mainResult = findRecipes(obj["mainEntity"], signals);
    if (mainResult.length > 0) return mainResult;
  }

  // Check if this object itself is a Recipe
  if (isRecipeType(obj["@type"])) {
    return [obj];
  }

  return [];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/extractors/json-ld.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/extractors/json-ld.ts tests/extractors/json-ld.test.ts
git commit -m "feat: add JSON-LD recipe extractor with defensive parsing"
```

---

### Task 7: HTML Heuristic Fallback Extractor

**Files:**
- Create: `src/extractors/html-fallback.ts`
- Create: `tests/extractors/html-fallback.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/extractors/html-fallback.test.ts
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
    // Only title found — low confidence
    expect(result.confidence).toBeLessThan(0.5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/extractors/html-fallback.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/extractors/html-fallback.ts
import type { CheerioAPI } from "cheerio";

interface HtmlExtractionResult {
  recipes: Record<string, unknown>[];
  confidence: number;
  signals: string[];
}

const INGREDIENT_KEYWORDS = ["ingredienser", "ingrediens", "ingredients"];
const INSTRUCTION_KEYWORDS = [
  "fremgangsmaade",
  "fremgangsmåde",
  "tilberedning",
  "instructions",
  "method",
  "steps",
];

export function extractHtmlFallback($: CheerioAPI): HtmlExtractionResult {
  const signals: string[] = [];
  const recipe: Record<string, unknown> = {};
  let fieldsFound = 0;

  // Extract title
  const h1 = $("h1").first().text().trim();
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();

  if (h1) {
    recipe["title"] = h1;
    signals.push("heuristic-title-from-h1");
    fieldsFound++;
  } else if (ogTitle) {
    recipe["title"] = ogTitle;
    signals.push("heuristic-title-from-og");
    fieldsFound++;
  } else {
    signals.push("missing-title");
  }

  // Extract ingredients — find ul near ingredient keywords
  const ingredients = findListNearKeyword($, INGREDIENT_KEYWORDS, "ul");
  if (ingredients.length > 0) {
    recipe["ingredients"] = ingredients;
    signals.push("heuristic-ingredients-from-ul");
    fieldsFound++;
  } else {
    signals.push("missing-ingredients");
  }

  // Extract instructions — find ol near instruction keywords
  const instructions = findListNearKeyword($, INSTRUCTION_KEYWORDS, "ol");
  if (instructions.length > 0) {
    recipe["instructions"] = instructions;
    signals.push("heuristic-instructions-from-ol");
    fieldsFound++;
  } else {
    signals.push("missing-instructions");
  }

  const confidence = fieldsFound / 3; // 3 core fields: title, ingredients, instructions
  const recipes = fieldsFound > 0 ? [recipe] : [];

  return { recipes, confidence, signals };
}

function findListNearKeyword(
  $: CheerioAPI,
  keywords: string[],
  listTag: string
): string[] {
  // Look for headings containing keywords, then grab the next list
  const headings = $("h1, h2, h3, h4, h5, h6");
  for (let i = 0; i < headings.length; i++) {
    const headingText = $(headings[i]).text().toLowerCase().trim();
    if (keywords.some((kw) => headingText.includes(kw))) {
      // Find the next list sibling
      const list = $(headings[i]).nextAll(listTag).first();
      if (list.length > 0) {
        const items: string[] = [];
        list.find("li").each((_j, li) => {
          const text = $(li).text().trim();
          if (text) items.push(text);
        });
        if (items.length > 0) return items;
      }
    }
  }
  return [];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/extractors/html-fallback.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/extractors/html-fallback.ts tests/extractors/html-fallback.test.ts
git commit -m "feat: add HTML heuristic fallback recipe extractor"
```

---

### Task 8: Link Filter

**Files:**
- Create: `src/discovery/link-filter.ts`
- Create: `tests/discovery/link-filter.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/discovery/link-filter.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { LinkFilter } from "../../src/discovery/link-filter.js";

describe("LinkFilter", () => {
  let filter: LinkFilter;

  beforeEach(() => {
    filter = new LinkFilter();
  });

  it("allows .dk domains", () => {
    expect(filter.shouldEnqueue("https://example.dk/page")).toBe(true);
  });

  it("rejects non-.dk domains without recipe signals", () => {
    expect(filter.shouldEnqueue("https://example.com/page")).toBe(false);
  });

  it("allows non-.dk domains with isDanishRecipe flag", () => {
    expect(filter.shouldEnqueue("https://example.com/page", { isDanishRecipe: true })).toBe(true);
  });

  it("rejects denylist patterns", () => {
    expect(filter.shouldEnqueue("https://example.dk/tag/kage")).toBe(false);
    expect(filter.shouldEnqueue("https://example.dk/search?q=kage")).toBe(false);
    expect(filter.shouldEnqueue("https://example.dk/login")).toBe(false);
    expect(filter.shouldEnqueue("https://example.dk/wp-json/api")).toBe(false);
    expect(filter.shouldEnqueue("https://example.dk/page/3")).toBe(false);
  });

  it("identifies recipe-like URLs", () => {
    expect(filter.isRecipeLikeUrl("https://example.dk/opskrift/kage")).toBe(true);
    expect(filter.isRecipeLikeUrl("https://example.dk/opskrifter/dessert")).toBe(true);
    expect(filter.isRecipeLikeUrl("https://example.dk/recipe/cake")).toBe(true);
    expect(filter.isRecipeLikeUrl("https://example.dk/about")).toBe(false);
  });

  it("enforces per-domain page budget", () => {
    const smallFilter = new LinkFilter(2); // budget of 2 per domain
    expect(smallFilter.shouldEnqueue("https://example.dk/page1")).toBe(true);
    smallFilter.recordPageCrawled("example.dk");
    expect(smallFilter.shouldEnqueue("https://example.dk/page2")).toBe(true);
    smallFilter.recordPageCrawled("example.dk");
    expect(smallFilter.shouldEnqueue("https://example.dk/page3")).toBe(false);
  });

  it("tracks domain budgets independently", () => {
    const smallFilter = new LinkFilter(1);
    smallFilter.recordPageCrawled("a.dk");
    expect(smallFilter.shouldEnqueue("https://b.dk/page")).toBe(true);
  });

  it("enforces global queue cap", () => {
    // Temporarily override DISCOVERY.globalQueueCap via a filter that quickly fills
    const f = new LinkFilter(100_000);
    // Enqueue up to global cap
    for (let i = 0; i < 50_000; i++) {
      f.shouldEnqueue(`https://test${i}.dk/page`);
    }
    expect(f.shouldEnqueue("https://one-more.dk/page")).toBe(false);
  });

  it("shouldFollowLink allows recipe URLs always", () => {
    expect(filter.shouldFollowLink("https://a.dk/opskrift/kage", false, true, 5)).toBe(true);
  });

  it("shouldFollowLink allows 1 non-recipe hop from recipe page", () => {
    expect(filter.shouldFollowLink("https://a.dk/about", true, false, 0)).toBe(true);
    expect(filter.shouldFollowLink("https://a.dk/about2", true, false, 1)).toBe(false);
  });

  it("shouldFollowLink blocks non-recipe from non-recipe page", () => {
    expect(filter.shouldFollowLink("https://a.dk/about", false, false, 0)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/discovery/link-filter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/discovery/link-filter.ts
import {
  DENYLIST_PATTERNS,
  RECIPE_PATH_PATTERNS,
  DISCOVERY,
} from "../config.js";

interface EnqueueOptions {
  isDanishRecipe?: boolean;
}

export class LinkFilter {
  private domainPageCounts = new Map<string, number>();
  private maxPagesPerDomain: number;
  private totalEnqueued = 0;

  constructor(maxPagesPerDomain?: number) {
    this.maxPagesPerDomain =
      maxPagesPerDomain ?? DISCOVERY.defaultMaxPagesPerDomain;
  }

  shouldEnqueue(url: string, options?: EnqueueOptions): boolean {
    // Global queue cap
    if (this.totalEnqueued >= DISCOVERY.globalQueueCap) {
      return false;
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }

    // Check denylist
    if (DENYLIST_PATTERNS.some((pattern) => pattern.test(parsed.pathname))) {
      return false;
    }

    // Check domain budget
    const domain = parsed.hostname;
    const count = this.domainPageCounts.get(domain) ?? 0;
    if (count >= this.maxPagesPerDomain) {
      return false;
    }

    // Check domain scope
    if (domain.endsWith(".dk")) {
      this.totalEnqueued++;
      return true;
    }

    // Non-.dk allowed only if flagged as Danish recipe
    if (options?.isDanishRecipe) {
      this.totalEnqueued++;
      return true;
    }

    return false;
  }

  /**
   * Check if a link should be followed based on non-recipe hop limit.
   * fromRecipePage: was the referring page a recipe page?
   * isRecipe: does this URL look like a recipe?
   * nonRecipeHops: how many non-recipe hops have occurred in this chain
   */
  shouldFollowLink(
    url: string,
    fromRecipePage: boolean,
    isRecipe: boolean,
    nonRecipeHops: number
  ): boolean {
    // Recipe URLs are always followed
    if (isRecipe) return true;
    // Non-recipe URLs from recipe pages: allow 1 hop
    if (fromRecipePage && nonRecipeHops < DISCOVERY.maxNonRecipeHops)
      return true;
    // Non-recipe URLs from non-recipe pages: stop
    return false;
  }

  isRecipeLikeUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return RECIPE_PATH_PATTERNS.some((pattern) =>
        pattern.test(parsed.pathname)
      );
    } catch {
      return false;
    }
  }

  recordPageCrawled(domain: string): void {
    const count = this.domainPageCounts.get(domain) ?? 0;
    this.domainPageCounts.set(domain, count + 1);
  }

  getDomainCount(domain: string): number {
    return this.domainPageCounts.get(domain) ?? 0;
  }

  getTotalEnqueued(): number {
    return this.totalEnqueued;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/discovery/link-filter.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/discovery/link-filter.ts tests/discovery/link-filter.test.ts
git commit -m "feat: add link filter with denylist, domain scope, and budget tracking"
```

---

### Task 9: MongoDB Storage Layer

**Files:**
- Create: `src/storage/mongodb.ts`
- Create: `tests/storage/mongodb.test.ts`

- [ ] **Step 1: Write the failing tests**

These tests require a running local MongoDB instance.

```typescript
// tests/storage/mongodb.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RecipeStore } from "../../src/storage/mongodb.js";
import type { PageDocument, RecipeDocument } from "../../src/types.js";

describe("RecipeStore", () => {
  let store: RecipeStore;

  beforeAll(async () => {
    store = new RecipeStore("mongodb://localhost:27017", "danishRecipes_test");
    await store.connect();
  });

  afterAll(async () => {
    // Clean up test database
    await store.dropDatabase();
    await store.close();
  });

  it("upserts a page document", async () => {
    const page: Omit<PageDocument, "_id"> = {
      canonicalUrl: "https://example.dk/opskrift/kage",
      domain: "example.dk",
      fetchedAt: new Date(),
      httpStatus: 200,
      extractionMethod: "json-ld",
      extractorVersion: "1.0.0",
      extractionConfidence: 1.0,
      extractionSignals: ["json-ld-found"],
      recipeCount: 1,
      pageContentHash: "abc123",
      outboundRecipeLinks: [],
    };

    await store.upsertPage(page);

    const found = await store.findPageByUrl("https://example.dk/opskrift/kage");
    expect(found).not.toBeNull();
    expect(found!.domain).toBe("example.dk");
  });

  it("upserts same page URL without duplicating", async () => {
    const page: Omit<PageDocument, "_id"> = {
      canonicalUrl: "https://example.dk/opskrift/kage",
      domain: "example.dk",
      fetchedAt: new Date(),
      httpStatus: 200,
      extractionMethod: "json-ld",
      extractorVersion: "1.0.0",
      extractionConfidence: 1.0,
      extractionSignals: ["json-ld-found"],
      recipeCount: 2,
      pageContentHash: "def456",
      outboundRecipeLinks: [],
    };

    await store.upsertPage(page);

    const count = await store.countPages("example.dk");
    expect(count).toBe(1); // Still 1, not 2
  });

  it("inserts a recipe document", async () => {
    const recipe: Omit<RecipeDocument, "_id"> = {
      pageUrl: "https://example.dk/opskrift/kage",
      domain: "example.dk",
      extractedAt: new Date(),
      extractionMethod: "json-ld",
      extractorVersion: "1.0.0",
      extractionConfidence: 1.0,
      rawRecipe: { "@type": "Recipe", "name": "Kage" },
      extractionSignals: ["json-ld-found"],
      contentHash: "recipe_hash_1",
      sourceHash: "recipe_hash_1",
    };

    await store.insertRecipe(recipe);
    const count = await store.countRecipes("example.dk");
    expect(count).toBe(1);
  });

  it("silently skips duplicate recipe by contentHash", async () => {
    const recipe: Omit<RecipeDocument, "_id"> = {
      pageUrl: "https://other.dk/different-url",
      domain: "other.dk",
      extractedAt: new Date(),
      extractionMethod: "json-ld",
      extractorVersion: "1.0.0",
      extractionConfidence: 1.0,
      rawRecipe: { "@type": "Recipe", "name": "Kage" },
      extractionSignals: ["json-ld-found"],
      contentHash: "recipe_hash_1", // Same hash as above
      sourceHash: "recipe_hash_1",
    };

    await store.insertRecipe(recipe); // Should not throw
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/storage/mongodb.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/storage/mongodb.ts
import { MongoClient, type Db, type Collection, Binary } from "mongodb";
import type { PageDocument, RecipeDocument } from "../types.js";

export class RecipeStore {
  private client: MongoClient;
  private dbName: string;
  private db!: Db;
  private pages!: Collection<PageDocument>;
  private recipes!: Collection<RecipeDocument>;

  constructor(uri: string, dbName: string) {
    this.client = new MongoClient(uri);
    this.dbName = dbName;
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    this.pages = this.db.collection<PageDocument>("pages");
    this.recipes = this.db.collection<RecipeDocument>("recipes");
    await this.ensureIndexes();
  }

  private async ensureIndexes(): Promise<void> {
    await this.pages.createIndex({ canonicalUrl: 1 }, { unique: true });
    await this.pages.createIndex({ domain: 1, fetchedAt: 1 });
    await this.pages.createIndex({ extractionMethod: 1 });
    await this.pages.createIndex({ pageContentHash: 1 });

    await this.recipes.createIndex({ contentHash: 1 }, { unique: true });
    await this.recipes.createIndex({ domain: 1 });
    await this.recipes.createIndex({ pageUrl: 1 });
  }

  async upsertPage(page: Omit<PageDocument, "_id">): Promise<void> {
    await this.pages.updateOne(
      { canonicalUrl: page.canonicalUrl },
      { $set: page },
      { upsert: true }
    );
  }

  async insertRecipe(recipe: Omit<RecipeDocument, "_id">): Promise<void> {
    try {
      await this.recipes.insertOne(recipe as RecipeDocument);
    } catch (err: unknown) {
      // Silently skip duplicate contentHash (error code 11000)
      if (
        err instanceof Error &&
        "code" in err &&
        (err as { code: number }).code === 11000
      ) {
        return;
      }
      throw err;
    }
  }

  async findPageByUrl(canonicalUrl: string): Promise<PageDocument | null> {
    return this.pages.findOne({ canonicalUrl });
  }

  async countPages(domain: string): Promise<number> {
    return this.pages.countDocuments({ domain });
  }

  async countRecipes(domain: string): Promise<number> {
    return this.recipes.countDocuments({ domain });
  }

  async dropDatabase(): Promise<void> {
    await this.db.dropDatabase();
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/storage/mongodb.test.ts`
Expected: All 4 tests PASS (requires local MongoDB running)

- [ ] **Step 5: Commit**

```bash
git add src/storage/mongodb.ts tests/storage/mongodb.test.ts
git commit -m "feat: add MongoDB storage layer with pages and recipes collections"
```

---

### Task 10: Sitemap Discovery

**Files:**
- Create: `src/discovery/sitemap.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/discovery/sitemap.ts
import { Sitemap } from "crawlee";
import type { SitemapEntry } from "../types.js";
import type { SeedConfig } from "../types.js";
import { log } from "crawlee";

export async function fetchSitemapUrls(
  seed: SeedConfig
): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];

  try {
    const { urls } = await Sitemap.load(seed.sitemapUrl);
    for (const url of urls) {
      entries.push({ url });
    }
    log.info(`Loaded ${entries.length} URLs from sitemap: ${seed.sitemapUrl}`);
  } catch (err) {
    log.warning(
      `Failed to load sitemap for ${seed.domain}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return entries;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/discovery/sitemap.ts
git commit -m "feat: add sitemap fetching and parsing"
```

---

### Task 11: CheerioCrawler

**Files:**
- Create: `src/crawlers/cheerio-crawler.ts`

- [ ] **Step 1: Write the implementation**

This is the core crawler. It uses the extractor modules, link filter, storage, and canonicalization.

```typescript
// src/crawlers/cheerio-crawler.ts
import {
  CheerioCrawler,
  createCheerioRouter,
  type RequestQueue,
  log,
} from "crawlee";
import { extractJsonLdRecipes } from "../extractors/json-ld.js";
import { extractHtmlFallback } from "../extractors/html-fallback.js";
import { canonicalizeUrl } from "../utils/canonicalize.js";
import { hashRecipe, hashHtml } from "../utils/hash.js";
import { LinkFilter } from "../discovery/link-filter.js";
import { RecipeStore } from "../storage/mongodb.js";
import {
  CHEERIO_CONFIG,
  EXTRACTOR_VERSION,
  DANISH_KEYWORDS,
  JS_FRAMEWORK_MARKERS,
  MIN_BODY_TEXT_LENGTH,
} from "../config.js";
import type { ExtractionResult } from "../types.js";
import { gzipSync } from "zlib";
import { Binary } from "mongodb";

interface CreateCheerioCrawlerOptions {
  store: RecipeStore;
  linkFilter: LinkFilter;
  playwrightQueue: RequestQueue;
  cheerioQueue: RequestQueue;
  seedDomains: Map<string, { requiresJs: boolean }>;
}

export function createCheerioCrawlerInstance(
  options: CreateCheerioCrawlerOptions
) {
  const { store, linkFilter, playwrightQueue, cheerioQueue, seedDomains } =
    options;
  const router = createCheerioRouter();

  router.addDefaultHandler(async ({ request, $, body, enqueueLinks }) => {
    const html = typeof body === "string" ? body : body.toString();
    const requestUrl = request.loadedUrl ?? request.url;
    const domain = new URL(requestUrl).hostname;

    // Dynamic canonicalization: check <link rel="canonical">
    const canonicalTag = $('link[rel="canonical"]').attr("href");
    const canonicalUrl = canonicalTag
      ? canonicalizeUrl(canonicalTag)
      : canonicalizeUrl(requestUrl);

    linkFilter.recordPageCrawled(domain);

    // Try JSON-LD extraction first
    let extraction: ExtractionResult;
    const jsonLdResult = extractJsonLdRecipes(html);

    if (jsonLdResult.recipes.length > 0) {
      extraction = {
        recipes: jsonLdResult.recipes,
        method: "json-ld",
        confidence: 1.0,
        signals: jsonLdResult.signals,
      };
    } else {
      // Fallback to HTML heuristics
      const htmlResult = extractHtmlFallback($);
      if (htmlResult.recipes.length > 0) {
        extraction = {
          recipes: htmlResult.recipes,
          method: "html-parsing",
          confidence: htmlResult.confidence,
          signals: htmlResult.signals,
        };
      } else {
        extraction = {
          recipes: [],
          method: "partial",
          confidence: 0,
          signals: htmlResult.signals,
        };
      }
    }

    // Check if page needs Playwright fallback
    const needsPlaywright = shouldFallbackToPlaywright(
      $,
      html,
      extraction,
      request.userData?.["fromSitemap"] === true
    );

    if (needsPlaywright && extraction.recipes.length === 0) {
      log.info(`Enqueueing to Playwright: ${canonicalUrl}`);
      await playwrightQueue.addRequest({
        url: requestUrl,
        uniqueKey: canonicalizeUrl(requestUrl),
        userData: { ...request.userData, playwrightRetry: true },
      });
    }

    // Determine if we should store rawHtml
    const shouldStoreHtml =
      extraction.method !== "json-ld" || extraction.confidence < 0.5;

    // Build and store page document
    const pageContentHash = hashHtml(html);

    // Collect outbound recipe links
    const outboundRecipeLinks: string[] = [];
    $("a[href]").each((_i, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      try {
        const absolute = new URL(href, requestUrl).toString();
        const canonical = canonicalizeUrl(absolute);
        if (linkFilter.isRecipeLikeUrl(canonical)) {
          outboundRecipeLinks.push(canonical);
        }
      } catch {
        // Invalid URL, skip
      }
    });

    await store.upsertPage({
      canonicalUrl,
      domain,
      fetchedAt: new Date(),
      httpStatus: 200,
      redirectChain:
        request.loadedUrl && request.loadedUrl !== request.url
          ? [request.url, request.loadedUrl]
          : undefined,
      extractionMethod: extraction.method,
      extractorVersion: EXTRACTOR_VERSION,
      extractionConfidence: extraction.confidence,
      extractionSignals: extraction.signals,
      recipeCount: extraction.recipes.length,
      rawHtml: shouldStoreHtml
        ? new Binary(gzipSync(Buffer.from(html)))
        : undefined,
      pageContentHash,
      outboundRecipeLinks,
    });

    // Store each extracted recipe
    for (const rawRecipe of extraction.recipes) {
      const recipeObj = rawRecipe as Record<string, unknown>;
      const contentHash = hashRecipe(recipeObj);
      await store.insertRecipe({
        pageUrl: canonicalUrl,
        domain,
        extractedAt: new Date(),
        extractionMethod: extraction.method as
          | "json-ld"
          | "html-parsing"
          | "partial",
        extractorVersion: EXTRACTOR_VERSION,
        extractionConfidence: extraction.confidence,
        rawRecipe: recipeObj,
        extractionSignals: extraction.signals,
        contentHash,
        sourceHash: contentHash,
      });
    }

    // Discover and enqueue links
    const pageHasDanishRecipe =
      extraction.recipes.length > 0 &&
      (domain.endsWith(".dk") ||
        DANISH_KEYWORDS.some((kw) => html.toLowerCase().includes(kw)));

    const isRecipePage = extraction.recipes.length > 0;
    const currentNonRecipeHops =
      (request.userData?.["nonRecipeHops"] as number) ?? 0;

    await enqueueLinks({
      strategy: "all",
      transformRequestFunction: (req) => {
        try {
          const absUrl = new URL(req.url, requestUrl).toString();
          const canonical = canonicalizeUrl(absUrl);
          const isRecipeLink = linkFilter.isRecipeLikeUrl(canonical);

          // Check non-recipe hop limit
          if (
            !linkFilter.shouldFollowLink(
              canonical,
              isRecipePage,
              isRecipeLink,
              currentNonRecipeHops
            )
          ) {
            return false;
          }

          const shouldQueue = linkFilter.shouldEnqueue(canonical, {
            isDanishRecipe: pageHasDanishRecipe,
          });
          if (!shouldQueue) return false;

          // Route requiresJs domains to Playwright queue
          const linkDomain = new URL(canonical).hostname;
          const seedConfig = seedDomains.get(linkDomain);
          if (seedConfig?.requiresJs) {
            playwrightQueue.addRequest({
              url: canonical,
              uniqueKey: canonical,
              userData: { fromRecipePage: isRecipePage, nonRecipeHops: 0 },
            }).catch((err) =>
              log.warning(`Failed to enqueue to Playwright: ${err}`)
            );
            return false; // Don't add to cheerio queue
          }

          req.url = canonical;
          req.uniqueKey = canonical;
          req.userData = {
            fromRecipePage: isRecipePage,
            nonRecipeHops: isRecipeLink ? 0 : currentNonRecipeHops + 1,
          };
          return req;
        } catch {
          return false;
        }
      },
    });
  });

  return new CheerioCrawler({
    requestQueue: cheerioQueue,
    requestHandler: router,
    maxConcurrency: CHEERIO_CONFIG.maxConcurrency,
    maxRequestsPerMinute: CHEERIO_CONFIG.maxRequestsPerMinute,
    maxRequestRetries: CHEERIO_CONFIG.maxRequestRetries,
    async failedRequestHandler({ request }, error) {
      const requestUrl = request.url;
      const domain = new URL(requestUrl).hostname;
      log.error(`Failed after retries: ${requestUrl} - ${error.message}`);
      await store.upsertPage({
        canonicalUrl: canonicalizeUrl(requestUrl),
        domain,
        fetchedAt: new Date(),
        httpStatus: 0,
        extractionMethod: "failed",
        extractorVersion: EXTRACTOR_VERSION,
        extractionConfidence: 0,
        extractionSignals: [],
        recipeCount: 0,
        pageContentHash: "",
        outboundRecipeLinks: [],
      });
    },
  });
}

function shouldFallbackToPlaywright(
  $: ReturnType<typeof import("cheerio").load>,
  html: string,
  extraction: ExtractionResult,
  fromSitemap: boolean
): boolean {
  if (extraction.recipes.length > 0) return false;

  // Check for low visible text content
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  if (bodyText.length < MIN_BODY_TEXT_LENGTH) return true;

  // Check for JS framework markers
  if (JS_FRAMEWORK_MARKERS.some((marker) => html.includes(marker)))
    return true;

  // From sitemap but nothing found
  if (fromSitemap) return true;

  return false;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/crawlers/cheerio-crawler.ts
git commit -m "feat: add CheerioCrawler with extraction, link discovery, and Playwright fallback detection"
```

---

### Task 12: PlaywrightCrawler

**Files:**
- Create: `src/crawlers/playwright-crawler.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/crawlers/playwright-crawler.ts
import {
  PlaywrightCrawler,
  createPlaywrightRouter,
  log,
  type RequestQueue,
} from "crawlee";
import { extractJsonLdRecipes } from "../extractors/json-ld.js";
import { extractHtmlFallback } from "../extractors/html-fallback.js";
import { canonicalizeUrl } from "../utils/canonicalize.js";
import { hashRecipe, hashHtml } from "../utils/hash.js";
import { RecipeStore } from "../storage/mongodb.js";
import { PLAYWRIGHT_CONFIG, EXTRACTOR_VERSION } from "../config.js";
import type { ExtractionResult } from "../types.js";
import { gzipSync } from "zlib";
import { Binary } from "mongodb";
import * as cheerio from "cheerio";

interface CreatePlaywrightCrawlerOptions {
  store: RecipeStore;
  playwrightQueue: RequestQueue;
}

export function createPlaywrightCrawlerInstance(
  options: CreatePlaywrightCrawlerOptions
) {
  const { store, playwrightQueue } = options;
  const router = createPlaywrightRouter();

  router.addDefaultHandler(async ({ request, page }) => {
    const requestUrl = request.loadedUrl ?? request.url;
    const domain = new URL(requestUrl).hostname;

    // Wait for content to render
    await page.waitForLoadState("networkidle");

    const html = await page.content();

    // Dynamic canonicalization
    const canonicalTag = await page
      .locator('link[rel="canonical"]')
      .first()
      .getAttribute("href")
      .catch(() => null);
    const canonicalUrl = canonicalTag
      ? canonicalizeUrl(canonicalTag)
      : canonicalizeUrl(requestUrl);

    // Try JSON-LD extraction on rendered HTML
    let extraction: ExtractionResult;
    const jsonLdResult = extractJsonLdRecipes(html);

    if (jsonLdResult.recipes.length > 0) {
      extraction = {
        recipes: jsonLdResult.recipes,
        method: "json-ld",
        confidence: 1.0,
        signals: [...jsonLdResult.signals, "playwright-js-rendered"],
      };
    } else {
      const $ = cheerio.load(html);
      const htmlResult = extractHtmlFallback($);
      if (htmlResult.recipes.length > 0) {
        extraction = {
          recipes: htmlResult.recipes,
          method: "html-parsing",
          confidence: htmlResult.confidence,
          signals: [
            ...htmlResult.signals,
            "playwright-fallback",
            "playwright-js-rendered",
          ],
        };
      } else {
        extraction = {
          recipes: [],
          method: "partial",
          confidence: 0,
          signals: ["playwright-fallback", "playwright-js-rendered"],
        };
      }
    }

    const pageContentHash = hashHtml(html);
    const shouldStoreHtml = extraction.method !== "json-ld";

    log.info(
      `Playwright extracted ${extraction.recipes.length} recipes from ${canonicalUrl}`
    );

    await store.upsertPage({
      canonicalUrl,
      domain,
      fetchedAt: new Date(),
      httpStatus: 200,
      extractionMethod: extraction.method,
      extractorVersion: EXTRACTOR_VERSION,
      extractionConfidence: extraction.confidence,
      extractionSignals: extraction.signals,
      recipeCount: extraction.recipes.length,
      rawHtml: shouldStoreHtml
        ? new Binary(gzipSync(Buffer.from(html)))
        : undefined,
      pageContentHash,
      outboundRecipeLinks: [],
    });

    for (const rawRecipe of extraction.recipes) {
      const recipeObj = rawRecipe as Record<string, unknown>;
      const contentHash = hashRecipe(recipeObj);
      await store.insertRecipe({
        pageUrl: canonicalUrl,
        domain,
        extractedAt: new Date(),
        extractionMethod: extraction.method as
          | "json-ld"
          | "html-parsing"
          | "partial",
        extractorVersion: EXTRACTOR_VERSION,
        extractionConfidence: extraction.confidence,
        rawRecipe: recipeObj,
        extractionSignals: extraction.signals,
        contentHash,
        sourceHash: contentHash,
      });
    }
  });

  return new PlaywrightCrawler({
    requestQueue: playwrightQueue,
    requestHandler: router,
    maxConcurrency: PLAYWRIGHT_CONFIG.maxConcurrency,
    maxRequestsPerMinute: PLAYWRIGHT_CONFIG.maxRequestsPerMinute,
    maxRequestRetries: PLAYWRIGHT_CONFIG.maxRequestRetries,
    launchContext: {
      launchOptions: {
        headless: true,
      },
    },
    async failedRequestHandler({ request }, error) {
      const requestUrl = request.url;
      const domain = new URL(requestUrl).hostname;
      log.error(`Playwright failed after retries: ${requestUrl} - ${error.message}`);
      await store.upsertPage({
        canonicalUrl: canonicalizeUrl(requestUrl),
        domain,
        fetchedAt: new Date(),
        httpStatus: 0,
        extractionMethod: "failed",
        extractorVersion: EXTRACTOR_VERSION,
        extractionConfidence: 0,
        extractionSignals: ["playwright-fallback"],
        recipeCount: 0,
        pageContentHash: "",
        outboundRecipeLinks: [],
      });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/crawlers/playwright-crawler.ts
git commit -m "feat: add PlaywrightCrawler for JS-rendered recipe pages"
```

---

### Task 13: Main Orchestrator

**Files:**
- Create: `src/main.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/main.ts
import { RequestQueue, log, LogLevel } from "crawlee";
import { config } from "dotenv";
import { RecipeStore } from "./storage/mongodb.js";
import { LinkFilter } from "./discovery/link-filter.js";
import { fetchSitemapUrls } from "./discovery/sitemap.js";
import { SEEDS } from "./discovery/seeds.js";
import { createCheerioCrawlerInstance } from "./crawlers/cheerio-crawler.js";
import { createPlaywrightCrawlerInstance } from "./crawlers/playwright-crawler.js";
import { canonicalizeUrl } from "./utils/canonicalize.js";

config(); // Load .env

log.setLevel(LogLevel.INFO);

async function main() {
  const mongoUri = process.env["MONGODB_URI"] ?? "mongodb://localhost:27017";
  const dbName = process.env["DB_NAME"] ?? "danishRecipes";

  // Initialize MongoDB
  const store = new RecipeStore(mongoUri, dbName);
  await store.connect();
  log.info("Connected to MongoDB");

  // Initialize link filter
  const linkFilter = new LinkFilter();

  // Initialize request queues
  const cheerioQueue = await RequestQueue.open("cheerio-queue");
  const playwrightQueue = await RequestQueue.open("playwright-queue");

  // Seed from sitemaps
  log.info(`Loading sitemaps from ${SEEDS.length} seed domains...`);

  for (const seed of SEEDS) {
    const entries = await fetchSitemapUrls(seed);
    const requests = entries.map((entry) => {
      const canonical = canonicalizeUrl(entry.url);
      return {
        url: entry.url,
        uniqueKey: canonical,
        userData: {
          fromSitemap: true,
          domain: seed.domain,
        },
      };
    });

    // Add to appropriate queue based on requiresJs flag
    if (seed.requiresJs) {
      await playwrightQueue.addRequests(requests);
    } else {
      await cheerioQueue.addRequests(requests);
    }

    log.info(`Enqueued ${requests.length} URLs from ${seed.domain}`);
  }

  // Also add seed domain root pages for link discovery
  for (const seed of SEEDS) {
    const rootUrl = `https://${seed.domain}`;
    const queue = seed.requiresJs ? playwrightQueue : cheerioQueue;
    await queue.addRequest({
      url: rootUrl,
      uniqueKey: canonicalizeUrl(rootUrl),
      userData: { fromSitemap: false, domain: seed.domain },
    });
  }

  // Build seed domain lookup
  const seedDomains = new Map(
    SEEDS.map((s) => [s.domain, { requiresJs: s.requiresJs }])
  );

  // Create crawlers (queues passed at construction)
  const cheerioCrawler = createCheerioCrawlerInstance({
    store,
    linkFilter,
    playwrightQueue,
    cheerioQueue,
    seedDomains,
  });

  const playwrightCrawler = createPlaywrightCrawlerInstance({
    store,
    playwrightQueue,
  });

  // Run both crawlers
  log.info("Starting crawlers...");

  try {
    await Promise.all([
      cheerioCrawler.run(),
      playwrightCrawler.run(),
    ]);
  } finally {
    await store.close();
    log.info("Crawl complete. MongoDB connection closed.");
  }
}

main().catch((err) => {
  log.error(`Fatal error: ${err}`);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add src/main.ts
git commit -m "feat: add main orchestrator — seeds sitemaps, runs both crawlers"
```

---

### Task 14: Integration Smoke Test

- [ ] **Step 1: Ensure MongoDB is running locally**

Run: `mongosh --eval "db.runCommand({ ping: 1 })"`
Expected: `{ ok: 1 }`

- [ ] **Step 2: Run all unit tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run the crawler briefly to verify it starts**

Run: `npx tsx src/main.ts`
Expected: Logs showing sitemap loading, URL enqueuing, and crawling starting. Kill with Ctrl+C after a few pages are processed.

- [ ] **Step 4: Verify data in MongoDB**

Run: `mongosh danishRecipes --eval "db.pages.countDocuments()"`
Expected: Non-zero count

Run: `mongosh danishRecipes --eval "db.recipes.countDocuments()"`
Expected: Non-zero count (if any recipes were found)

Run: `mongosh danishRecipes --eval "db.recipes.findOne({}, { rawRecipe: 1 })"`
Expected: A document with a `rawRecipe` field containing recipe data

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: complete Danish recipe crawler — ready for broad crawling"
```
