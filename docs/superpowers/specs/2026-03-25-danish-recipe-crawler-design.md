# Danish Recipe Crawler — Design Spec

## Overview

A broad-first web crawler for discovering Danish recipe pages and recipe-like candidates across the web. Built with Crawlee (TypeScript), storing raw crawl results in a local MongoDB database. The crawler is optimized for coverage during acquisition; normalization, entity cleanup, and downstream search indexing happen after crawling, not inline during fetch.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Orchestrator                        │
│   (seeds, sitemap fetching, scoring, URL queue policy)  │
└───────────────┬─────────────────────────┬────────────────┘
                │                         │
                ▼                         ▼
      ┌────────────────┐        ┌────────────────────┐
      │ CheerioCrawler │        │ PlaywrightCrawler  │
      │   (primary)    │───────▶│   (fallback)       │
      └────────┬───────┘        └──────────┬─────────┘
               │                           │
               ▼                           ▼
      ┌──────────────────────────────────────────────┐
      │            Raw Extraction Layer              │
      │  1. JSON-LD / microdata capture             │
      │  2. Lightweight HTML heuristics             │
      │  3. Link discovery + crawl signals          │
      └──────────────────────┬───────────────────────┘
                             │
                             ▼
      ┌──────────────────────────────────────────────┐
      │          MongoDB Raw Crawl Storage           │
      │   pageFetches / recipeCandidates / state     │
      └──────────────────────┬───────────────────────┘
                             │
                             ▼
      ┌──────────────────────────────────────────────┐
      │       Post-Crawl Processing Pipeline         │
      │  normalization, dedupe, enrichment, search   │
      └──────────────────────────────────────────────┘
```

### Flow

1. Orchestrator loads seed URLs and known sitemap entry points.
2. Sitemap fetchers discover initial URLs from recipe-heavy domains.
3. CheerioCrawler processes most URLs, extracts raw recipe signals, and discovers outbound links.
4. Pages that look JS-rendered or recipe-relevant but yield poor server-side extraction are retried in PlaywrightCrawler.
5. Raw fetch results, extraction payloads, and crawl signals are stored in MongoDB.
6. Newly discovered URLs are scored and enqueued using broad-first rules with domain budgets.
7. A separate post-processing job normalizes, deduplicates, and prepares recipe entities for search or analytics.

## Crawler Strategy

### Hybrid: CheerioCrawler + PlaywrightCrawler Fallback

- **CheerioCrawler (primary):** Default fetch path. Fast, low memory, and likely sufficient for most SEO-friendly recipe sites.
- **PlaywrightCrawler (fallback):** Used selectively when server-rendered HTML looks incomplete, empty, or suspiciously JS-dependent.

### Broad-First Acquisition Mode

The crawler should start broad, not only on obviously recipe-shaped URLs. Coverage is prioritized during the acquisition phase. Recipe classification is treated as a spectrum:

- **Confirmed recipe:** Page contains Recipe structured data or strong HTML recipe signals.
- **Recipe candidate:** Page is likely recipe-related based on URL, anchor text, sitemap location, or nearby page context.
- **Generic page:** Page is crawled for discovery value, but not yet considered a recipe.

### Trigger for Playwright fallback

Cheerio processes a page and one or more of these hold:

- no usable JSON-LD or microdata was found,
- visible HTML content is thin or clearly incomplete,
- the page matches strong recipe or cooking patterns,
- the page was discovered from a recipe sitemap or high-confidence recipe page.

**Recipe-like URL patterns** remain useful hints, but not strict gates: `/opskrift/`, `/recipe/`, `/opskrifter/`, `/recipes/`, `/mad/`, `/bagning/`, `/kog/`.

## URL Discovery & Filtering

### Seed URLs

Initial high-value recipe domains:

- valdemarsro.dk
- arla.dk/opskrifter
- dk-kogebogen.dk
- madensverden.dk
- nemlig.com/opskrifter
- styrkaansen.dk (verify accessibility before implementation)

### Discovery Pipeline

1. **Sitemap phase:** For each seed domain, fetch `/sitemap.xml`, robots-declared sitemaps when available, and nested sitemaps. Prefer recipe-looking sitemap branches, but do not require them.
2. **Link-following phase:** On every crawled page, extract all `<a href>` links and score them.
3. **Broad admission phase:** Allow broad discovery within policy:
   - **Allow** if `.dk` domain and not blocked by denylist rules.
   - **Allow** if non-`.dk` but Danish language indicators are present or the page is linked from a trusted Danish recipe source.
   - **Reject** obvious non-content or low-value URLs such as login, cart, account, checkout, search results, tag spam, faceted filters, and calendar/archive loops.
4. **Priority scoring:** Raise priority when:
   - URL path contains recipe-like segments,
   - anchor text contains Danish cooking terms,
   - page was found in a sitemap branch likely related to recipes,
   - referrer is a confirmed recipe page,
   - page already exposed recipe-related structured data.

### Queue Deduplication

Because normalization is deferred, the crawler should keep deduplication simple during acquisition:

- Canonicalize URLs before queueing and storing.
- Use Crawlee queue dedupe on canonical URL keys.
- Track last fetch metadata per canonical URL.
- Do not perform content-entity deduplication inline during crawling.
- Content-level dedupe of recipes happens in the post-processing pipeline.

## Extraction Logic

### JSON-LD extraction (primary)

- Scan all `<script type="application/ld+json">` tags.
- Parse defensively, including arrays and `@graph` payloads.
- Extract raw Recipe nodes when present.
- Store raw JSON-LD payloads as collected, without restructuring them into a normalized recipe model.

### HTML signal extraction

- Look for microdata (`itemtype="https://schema.org/Recipe"`) and RDFa.
- Capture lightweight recipe signals without full normalization:
  - title candidates from `<h1>` or `og:title`,
  - ingredient-like blocks near Danish recipe keywords,
  - instruction-like ordered lists or step containers,
  - detected language cues,
  - media and canonical URL hints.
- Assign an extraction confidence and extraction method.

### Playwright retry

- If Playwright also fails to find strong recipe signals, still store the page as a crawl artifact if it had discovery value.
- Mark low-quality extraction explicitly for later review or reprocessing.

## Post-Crawl Normalization

Normalization is intentionally out of band and should be implemented as a separate job or pipeline stage:

- derive a normalized recipe entity from raw JSON-LD or HTML extractions,
- compute recipe-level deduplication hashes,
- merge duplicates across URLs and domains,
- enrich with derived metadata such as ingredient arrays, time fields, servings, and canonical titles,
- prepare downstream collections for search, analytics, or training data.

The crawler should not depend on this stage to keep fetching new pages.

## MongoDB Data Model

**Database:** `danishRecipes`

### `pageFetches`

Raw fetch records for every processed page.

```typescript
{
  _id: ObjectId;
  url: string;                  // final fetched URL
  canonicalUrl?: string;        // canonicalized URL if detected
  urlKey: string;               // normalized key used for queue dedupe
  domain: string;
  fetchedAt: Date;
  statusCode?: number;
  fetchMode: "cheerio" | "playwright";
  contentType?: string;
  contentHash?: string;         // hash of raw page content or extracted text
  extractionMethod: "json-ld" | "html-signals" | "partial" | "none";
  extractionConfidence: number; // 0..1
  recipeSignals: object;        // lightweight structured signals, not normalized entity data
  rawJsonLd?: object[];
  rawHtml?: string;             // optional, preferably only for failures or sampled pages
  outboundLinks: string[];
  outboundRecipeLinks: string[];
  labels: string[];
  referrer?: string;
}
```

### `recipeCandidates`

Candidate recipe records derived from page fetches, still unnormalized.

```typescript
{
  _id: ObjectId;
  pageFetchId: ObjectId;
  url: string;
  domain: string;
  discoveredAt: Date;
  candidateType: "confirmed" | "likely" | "weak";
  rawRecipePayload?: object;    // raw Recipe JSON-LD node or HTML-derived candidate
  candidateHash?: string;       // optional raw-payload hash, not the final entity hash
  signals: object;
}
```

### `crawlState`

Queue and recrawl metadata keyed by canonical URL.

```typescript
{
  _id: ObjectId;
  urlKey: string;
  url: string;
  domain: string;
  lastFetchedAt?: Date;
  lastStatusCode?: number;
  lastContentHash?: string;
  lastSeenInSitemapAt?: Date;
  priority: number;
  labels: string[];
}
```

## Crawling Boundaries

- **Domain scope:** Start broad. `.dk` domains are first-class targets. Non-`.dk` pages are allowed when they appear Danish or are strongly connected to trusted Danish recipe sources.
- **Rate limiting:** Use Crawlee's global settings, but also add per-domain budgets and denylist rules to prevent runaway exploration.
  - CheerioCrawler: `maxConcurrency: 10`, `maxRequestsPerMinute: 60`
  - PlaywrightCrawler: `maxConcurrency: 3`, `maxRequestsPerMinute: 20`
- **robots.txt:** Not respected by default. `respectRobotsTxt` is disabled unless explicitly enabled per run or per target set.
- **Depth:** No hard global depth limit, but exploration should still be constrained with:
  - max non-recipe hops from a confirmed recipe page,
  - per-domain crawl caps,
  - query-parameter filtering,
  - denylist rules for low-value route families.

## Error Handling

- **HTTP errors:** Use Crawlee retries with `maxRequestRetries: 3`. Persist failed fetch metadata for debugging.
- **Malformed JSON-LD:** Wrap parsing in `try/catch`. Preserve the raw script content when useful for later reprocessing.
- **MongoDB unavailable:** Pause ingestion and retry connection. If MongoDB remains unavailable beyond a configured timeout, shut down gracefully.
- **Graceful shutdown:** Let Crawlee persist the `RequestQueue` locally so the crawl can resume.
- **Observability:** Track counts for fetches, recipe confirmations, recipe candidates, Playwright fallbacks, dropped URLs, and per-domain crawl volume.

## Project Structure

```
RecipeScrapers-crawlee/
├── src/
│   ├── main.ts                   # Entry point — orchestrator
│   ├── config.ts                 # Seeds, budgets, rate limits, constants
│   ├── crawlers/
│   │   ├── cheerio-crawler.ts    # Primary CheerioCrawler setup
│   │   └── playwright-crawler.ts # Fallback PlaywrightCrawler setup
│   ├── extractors/
│   │   ├── json-ld.ts            # Raw JSON-LD extraction
│   │   ├── html-signals.ts       # Lightweight HTML recipe signal extraction
│   │   └── canonical-url.ts      # URL canonicalization helpers
│   ├── discovery/
│   │   ├── sitemap.ts            # Sitemap fetching & parsing
│   │   ├── link-filter.ts        # URL filtering and scoring logic
│   │   ├── priority.ts           # Crawl scoring and budgets
│   │   └── seeds.ts              # Seed URL list
│   ├── storage/
│   │   └── mongodb.ts            # MongoDB client and persistence
│   ├── processing/
│   │   └── normalize.ts          # Separate post-crawl normalization pipeline
│   └── utils/
│       └── hash.ts               # Hash helpers
├── package.json
├── tsconfig.json
├── .env                          # MongoDB connection string, config overrides
└── .gitignore                    # Excludes .env, node_modules, crawlee storage
```

## Dependencies

- `crawlee` — CheerioCrawler + PlaywrightCrawler
- `playwright` — browser automation for fallback
- `mongodb` — native MongoDB driver
- `node-object-hash` — hashing utilities
- `typescript`, `tsx` — dev tooling
