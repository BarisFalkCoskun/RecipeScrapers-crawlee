# Task 5 report: Danish JSON-LD pilot integration and operator contract

Date: 2026-08-13

## Status

Completed the local integration contract without a live crawl, remote canary,
external site request, or MongoDB operation. No source is represented as having
passed a canary, shadow, or cutover gate.

## Delivered

- Added `DANISH_JSONLD_PILOT_SOURCE_IDS` with this exact ordered cohort:
  `arla, coop, kitchenaid, surdejsentusiasten, sundpaabudget, klinksgaard,
  madoghave, netto, madrejsen, tv2mad, kikkoman, gamleopskrifter`.
- Made `createDanishJsonLdCrawlSelection()` preserve the requested source order,
  so the pilot command evidence follows the explicit operator cohort.
- Added a focused contract test that verifies the exact list and that every
  pilot ID is selectable from the registered source inventory.
- Added `docs/danish-jsonld-migration-operations.md`, linked from the README.
  It provides short local checks, the remote-only isolated-DB pilot command,
  evidence-backed transition gates, source-by-source cutover, native MongoDB
  collection roles, and the `RecipeDocumentV2.normalized` consumer contract.
- Documented the permanent robots-off requirement as unresolved/tool-blocked;
  it is explicitly not represented as complete.

## TDD evidence

Red command:

```bash
npm test -- tests/danish-jsonld/source-selection.test.ts
```

The new exact-pilot contract failed because
`DANISH_JSONLD_PILOT_SOURCE_IDS` was absent. After adding the constant it
identified a second real integration issue: `createDanishJsonLdCrawlSelection()`
returned registry order rather than requested CLI order. The minimal ordered
selection change made the same test pass.

Green command:

```bash
npm test -- tests/danish-jsonld/source-selection.test.ts
npm run build
```

Both passed: 6 focused tests and TypeScript compilation.

## Diagnostic assessment and smoke result

Before deciding whether to repair the local smoke environment, seven possible
sources of the browser failure were considered:

1. Chromium was not installed for the Playwright revision in use.
2. A stale/unused cache revision was selected.
3. The Node/Playwright launcher combination was incompatible.
4. macOS ARM browser launch permissions or hardened-runtime behavior blocked
   the executable.
5. A host browser dependency/architecture issue prevented startup.
6. The hermetic loopback fixture or its queue setup failed before Playwright.
7. A crawler regression prevented fallback requests from reaching Playwright.

The two most likely sources are local browser-launch environment/permissions and
the browser-cache revision, rather than crawler behavior. Evidence: the cache
initially reported an executable path that existed, while the smoke crawl's
Cheerio fixture phase completed and then failed exactly at browser launch. One
bounded `npx playwright install chromium` attempt replaced the unused cached
revision, but a second smoke run failed at the same launcher boundary. The
fixture logs also show Cheerio successfully enqueueing its two local Playwright
fallback routes, which rules out the pre-browser queue path. No further browser
or network troubleshooting was attempted.

The runner's existing bounded memory/queue diagnostics supplied the local smoke
evidence; no production logging change was appropriate because this task made no
crawler behavior fix.

## Verification

- `npm run migration:status -- --format markdown` ran locally and showed each
  pilot source as `not_audited`, with Arla merely `configured`; no Canary,
  Shadow parity, or Cutover fields were populated.
- `npm run build` passed.
- `npm test` passed: **32 test files, 219 tests, 0 failures**.
- `npm run smoke:crawl` was attempted twice against the hermetic loopback
  fixture. It cannot launch Playwright Chromium in this environment, even after
  the one bounded cache-repair attempt. This is documented as an environment
  prerequisite/concern, not a migration pass.
- `git diff --check` passed before staging. The final staged diff is also
  whitespace-checked before committing.

## Original checkout boundary

The original dirty Crawlee checkout
`/Users/boris/Repositories/RecipeScrapers/RecipeScrapers-crawlee` was inspected
after this task. Its four pre-existing modified paths remain present:
`src/crawlers/cheerio-crawler.ts`, `src/discovery/link-filter.ts`, `src/main.ts`,
and `tests/discovery/link-filter.test.ts`. This isolated worktree was used for
every Task 5 change, so none of those paths was modified here. Start-state hashes
were not captured, so this check confirms that their diffs remain present rather
than asserting byte-for-byte identity.

## Remaining concern

The local fixture smoke needs a functioning Playwright Chromium launch on the
target host. Also, no remote canary/shadow evidence exists yet, no external
consumer repository is claimed migrated, and permanent robots-off remains
unresolved/tool-blocked.
