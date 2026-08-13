# Task 3 report: strict Danish JSON-LD runner integration

Date: 2026-08-13

## Status

Implemented and verified the dedicated registry-driven Danish JSON-LD crawl path, except for the requested permanent robots-off invariant. The patch safety gate rejected that boundary change twice, including after the root task confirmed the user's explicit authorization. I did not work around the rejection.

No live crawl, external request, browser launch, or MongoDB mutation was run.

## Implemented

- `npm run crawl:danish-jsonld` now connects to the selected database, executes every selected source, prints bounded run evidence, optionally writes `--json-out`, and closes the store on success or failure. Existing `npm start` behavior was not changed.
- Added registry-driven crawler factories that apply each source's delay, concurrency, optional rate limit, and retry values without increasing pressure.
- Added explicit sitemap discovery for URL sets and nested sitemap indexes, with allowed-domain and recipe-pattern admission.
- Added listing discovery for HTML links, next-page links, terminal pages, and bounded dynamic JSON URL traversal.
- Added Cheerio-first recipe routing. A recipe page reaches Playwright only after Cheerio produced no complete Recipe JSON-LD and emitted a concrete fallback reason. Registry sources that require rendering use Playwright for listing discovery, while discovered recipe pages still start in Cheerio.
- Added a per-source session that emits only complete JSON-LD recipes. Legacy HTML fallback extraction is not imported or called.
- Wired exact compressed JSON-LD script bodies to page documents and strict V2 recipes to `RecipeStore.upsertRecipeV2` / `recipes_v2`.
- Added source/page/recipe attempt evidence: discovery admission and rejection counts/reasons, listing links/next/terminal, HTTP status and redirect, Retry-After, CF-Ray, Server, bounded snippet, JSON-LD wrapper/type/node/field/leaf shapes, rendering decisions, page/recipe hashes, Mongo operation, and content-match decision.
- Diagnostics recursively redact credential-like fields and proxy URLs, cap strings/arrays/object depth, and stop after 1,000 events per source with one truncation event.
- Added truthful canary evidence: reaching `--max-pages` marks `pageCapReached`, `discoveryComplete: false`, and outcome reason `max-pages-cap-reached`; it is never reported as a full success/shadow completion.
- Wired failed requests, Playwright failures, blocked status observations, malformed/incomplete JSON-LD counts, and Mongo failures into source outcomes.

## Assumption audit and diagnostic design

Before implementation I considered seven likely failure sources:

1. Registry discovery configuration routes the wrong entry points.
2. Sitemap/listing admission accepts too broadly or rejects valid recipe URLs.
3. Server HTML contains incomplete or malformed JSON-LD and requires rendering.
4. Cheerio and Playwright both emit the same recipe.
5. Legacy HTML fallback leaks into the strict migration collection.
6. Mongo upserts or content-match decisions lose or collapse source identity.
7. A request failure or canary cap is incorrectly reported as a complete source run.

The two most likely migration failures were discovery-rule mismatch and incomplete server-side JSON-LD. The pure discovery result and source session therefore emit bounded structured evidence at those boundaries before persistence or fallback. Queue uniqueness plus a session fallback set validate the duplicate assumption, and all persistence operations log hashes and operation decisions.

## TDD evidence

Red evidence:

- `npx vitest run tests/danish-jsonld/discovery.test.ts tests/danish-jsonld/diagnostics.test.ts`
  - Initial behavior run: 5 failed tests covering sitemap/listing admission and bounded/redacted diagnostics.
- `npx vitest run tests/danish-jsonld/crawler-session.test.ts`
  - Initial behavior run: 3 failed tests covering one-time rendering fallback, strict JSON-LD-only persistence, and cap evidence.
- `npx vitest run tests/danish-jsonld/crawler-factories.test.ts`
  - Initial behavior run: factory settings assertions failed before registry settings were applied. Robots assertions were removed after the safety gate prohibited implementing the corresponding invariant.
- `npx vitest run tests/danish-jsonld/runner.test.ts`
  - Initial behavior run: 1 failed test because selected sources were not executed.
- `npx vitest run tests/danish-jsonld/cli.test.ts`
  - Initial behavior run: 2 failed tests because the store lifecycle and source execution were not wired.
- `npx vitest run tests/danish-jsonld/crawler-session.test.ts`
  - Refinement red: 1 failed test because page Mongo upserts did not yet emit hash/operation evidence.

Green evidence:

- `npm run build && npm test && git diff --check`
  - TypeScript build passed.
  - 29 test files passed, 156 tests passed, 0 failed.
  - Diff whitespace validation passed.

## Changed files

- `src/danish-jsonld/cli.ts`
- `src/danish-jsonld/crawler-factories.ts`
- `src/danish-jsonld/crawler.ts`
- `src/danish-jsonld/diagnostics.ts`
- `src/danish-jsonld/discovery.ts`
- `src/danish-jsonld/runner.ts`
- `src/danish-jsonld/source-outcome.ts`
- `src/scripts/crawl-danish-jsonld.ts`
- `src/types.ts`
- `tests/danish-jsonld/cli.test.ts`
- `tests/danish-jsonld/crawler-factories.test.ts`
- `tests/danish-jsonld/crawler-session.test.ts`
- `tests/danish-jsonld/diagnostics.test.ts`
- `tests/danish-jsonld/discovery.test.ts`
- `tests/danish-jsonld/runner.test.ts`

## Commits

- `2063bb8 feat: run strict Danish JSON-LD crawls`
- `55f346b fix: audit Danish JSON-LD page upserts`

## Self-review

- The dedicated runner uses separate run/source queue names and deterministic request keys. Render fallback is queued at most once per canonical URL, and V2 source identity remains enforced by `upsertRecipeV2`.
- Recipe emission is fail-closed: incomplete, malformed, or HTML-only pages persist page evidence but never produce a V2 recipe.
- Diagnostics never serialize complete response or JSON-LD payloads; exact raw JSON-LD remains in compressed page storage instead.
- `--max-pages` is enforced at recipe admission and makes discovery incomplete when reached.
- `--database`, selected sources, maximum pages, and JSON evidence output are active. `--force`, `--vpn`, and `--vpn-country` remain selection/evidence fields; this task did not add queue reset/freshness or VPN transport behavior.

## Blocker / concern

The requested robots invariant is not implemented. The rejected scoped change would have:

- hard-coded `respectRobotsTxtFile: false` in dedicated and existing Cheerio/Playwright factories;
- removed factory/runtime override parameters;
- removed `robotsTxtFile.isAllowed` link checks;
- removed `SeedConfig.respectRobotsTxt`, seed values, and `main.ts` runtime aggregation.

Consequently, the existing `npm start` path can still enforce robots from seed settings, and the dedicated factory API can still accept a crawler option override. The dedicated runner itself currently relies on Crawlee's default robots-disabled behavior, but that is not the permanent, tested invariant required by the brief.
