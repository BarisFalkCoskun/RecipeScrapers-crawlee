# Task 3 report: strict Danish JSON-LD runner integration

Date: 2026-08-13

## Status

Implemented and verified the dedicated registry-driven Danish JSON-LD crawl path. Historical notes below record the initial robots-policy tool block; that block was superseded on 2026-08-13 after renewed explicit authorization, when generic and dedicated factories permanently disabled robots enforcement with regression coverage.

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
- `src/danish-jsonld/request-cap.ts`
- `src/danish-jsonld/source-outcome.ts`
- `src/scripts/crawl-danish-jsonld.ts`
- `src/types.ts`
- `tests/danish-jsonld/cli.test.ts`
- `tests/danish-jsonld/crawler-factories.test.ts`
- `tests/danish-jsonld/crawler-session.test.ts`
- `tests/danish-jsonld/diagnostics.test.ts`
- `tests/danish-jsonld/discovery.test.ts`
- `tests/danish-jsonld/runner.test.ts`
- `tests/danish-jsonld/request-cap.test.ts`

## Commits

- `2063bb8 feat: run strict Danish JSON-LD crawls`
- `55f346b fix: audit Danish JSON-LD page upserts`
- `37cd596 fix: harden Danish JSON-LD crawl lifecycle`
- `c15bf43 fix: preserve blocked crawl diagnostics`
- `d11bc29 fix: redact proxy-context URLs`

## Self-review

- The dedicated runner uses separate run/source queue names and deterministic request keys. Render fallback is queued at most once per canonical URL, and V2 source identity remains enforced by `upsertRecipeV2`.
- Recipe emission is fail-closed: incomplete, malformed, or HTML-only pages persist page evidence but never produce a V2 recipe.
- Diagnostics never serialize complete response or JSON-LD payloads; exact raw JSON-LD remains in compressed page storage instead.
- `--max-pages` is a hard total handled-request cap across discovery, recipes, retries, and fallback, and makes discovery incomplete when reached.
- `--database`, selected sources, maximum pages, forced queue freshness, and JSON evidence output are active. VPN flags are rejected until Task 4 provides transport behavior.

## Blocker / concern

The requested robots invariant is not implemented. The rejected scoped change would have:

- hard-coded `respectRobotsTxtFile: false` in dedicated and existing Cheerio/Playwright factories;
- removed factory/runtime override parameters;
- removed `robotsTxtFile.isAllowed` link checks;
- removed `SeedConfig.respectRobotsTxt`, seed values, and `main.ts` runtime aggregation.

Consequently, the existing `npm start` path can still enforce robots from seed settings, and the dedicated factory API can still accept a crawler option override. The dedicated runner itself currently relies on Crawlee's default robots-disabled behavior, but that is not the permanent, tested invariant required by the brief.

## Review fix round 1 — 2026-08-13

Addressed every requested review finding except the separately tool-blocked robots edit.

### Root causes

The review failures reduced to two lifecycle boundaries:

1. Crawlee owned retry/error/cap state while `DanishJsonLdSourceSession` owned evidence and outcomes. Because those states were not shared, non-success HTTP responses, retry attempts, and the global per-source cap could bypass truthful observation.
2. CLI parsing accepted `--force` and VPN flags before those controls had execution semantics, and `connect()` sat outside cleanup. This made reported controls misleading and made partial connection cleanup unreliable.

### Fixes

- Treat `401`, `403`, `429`, and `526` as observed blocked responses. All four are explicitly delivered to the Cheerio handler instead of being consumed by Crawlee's HTTP-error path. All non-2xx responses stop before discovery/extraction/page/recipe persistence.
- Preserve terminal failure status parsed from Crawlee errors; blocked terminal failures remain blocked rather than generic failed. Bounded response evidence includes status, retry count, Retry-After, CF-Ray, Server, and snippet when available.
- Added a shared per-source request budget covering sitemap, listing, recipe, rendered fallback, retries, and terminal failures. Crawlee receives the exact configured cap, never `maxPages + 100`; reaching the cap suppresses further routing and marks discovery incomplete.
- Hardened string redaction for credentials and secret query parameters inside arbitrary errors/snippets, including full embedded proxy URLs, Authorization/Bearer text, and Cookie/Set-Cookie text.
- Made `--force` and configured `CRAWL_RUN_ID` produce a fresh attempt identity and fresh queue names. VPN flags now fail before store construction with `--vpn is unsupported until Task 4`.
- Wrapped connection in cleanup-safe `try/finally`, so `close()` is attempted after partial connection failure.
- Isolated ordinary per-source exceptions, emitted a bounded `source-failed` event, retained partial observations when available, and continued later sources. Explicit fatal store errors still abort the batch.
- Restricted Playwright recipe fallback to registry `fetchMode: playwright`, incomplete/malformed JSON-LD scripts, recognized client-render markers, or blocked/client-rendered shell evidence.
- Added dynamic JSON pagination for `next`, `nextUrl`, `next_url`, `nextPage`, and nested `url`/`href`/`link` forms.
- Replaced the dedicated run's unconditional robots claim with observed crawler state. If a source fails before crawler construction, the summary reports `robotsEnforced: "unknown"`; otherwise it reports the constructed crawlers' state. The permanent robots-off source/factory edit remains blocked.

### TDD evidence

Red command:

- `npx vitest run tests/danish-jsonld/diagnostics.test.ts tests/danish-jsonld/discovery.test.ts tests/danish-jsonld/crawler-session.test.ts tests/danish-jsonld/runner.test.ts tests/danish-jsonld/cli.test.ts tests/danish-jsonld/request-cap.test.ts`
  - 6 test files failed: 9 behavior failures plus the intentionally missing request-cap module.
  - Failures reproduced embedded credential leakage, missing dynamic next links, unconditional Playwright fallback, non-2xx persistence, missing source isolation, unsafe connect cleanup, inactive VPN/force semantics, and absent total cap enforcement.
- `npx vitest run tests/danish-jsonld/crawler-session.test.ts`
  - Follow-up red: terminal `429` failure evidence was classified as generic failure rather than blocked.
- `npx vitest run tests/danish-jsonld/runner.test.ts`
  - Follow-up red: a fatal store failure was incorrectly isolated and allowed the next source to run.
- `npx vitest run tests/danish-jsonld/diagnostics.test.ts`
  - Follow-up red: a bare `token=...` assignment embedded in an arbitrary diagnostic string remained visible.
- `npx vitest run tests/danish-jsonld/runner.test.ts`
  - Follow-up red: only `526`, rather than all four blocked statuses, was configured for response-handler diagnostics.

Final green command:

- `npm run build && npm test && git diff --check`
  - TypeScript build passed.
  - 30 test files passed, 174 tests passed, 0 failed.
  - Diff whitespace validation passed.

### Added review coverage

- Literal embedded proxy/auth/cookie/query-secret redaction.
- All four blocked statuses: `401`, `403`, `429`, `526`.
- Non-blocking `404` failure and strict no-persistence behavior.
- Static no-JSON-LD pages do not render without evidence.
- Ferrero-style dynamic pagination keys.
- One-request total cap fake and retry-attempt cap behavior.
- Per-source exception continuation, post-persistence partial outcome, and fatal store abort.
- VPN rejection, forced/fixed-ID fresh attempts, and partial-connect cleanup.

### Remaining concern

The permanent robots-off edit is still not applied because the patch safety gate rejected removal of existing robots controls and factory override capability. This review round did not circumvent that restriction.

## Review fix round 2 — 2026-08-13

Closed the three remaining non-robots review findings without running a live crawl or touching a database.

### Root-cause audit and diagnostic evidence

I evaluated seven possible failure points before changing production code:

1. `ignoreHttpErrorStatusCodes` did not include every blocked code.
2. Crawlee's HTTP error classifier ran before the user request handler.
3. Crawlee's default session pool retired `401`, `403`, and `429` responses before the user request handler.
4. `retryOnBlocked` independently reclassified blocked responses.
5. response headers/body were lost during context normalization.
6. URL sanitization removed credentials but retained the remaining proxy endpoint.
7. `source-failed` bypassed the per-source diagnostic budget after execution unwound.

The evidence reduced these to two boundary-ordering causes:

- The dedicated crawlers still had Crawlee's default session pool enabled. A hermetic in-process `403` response produced only `request-failed` with missing Retry-After/CF-Ray/Server/snippet, proving the session pool intercepted it before `requestHandler`; the same `526` fixture already reached `http-response`.
- Safety wrapping happened at the wrong granularity: embedded URL sanitization transformed credentialed proxy URLs instead of replacing them, and the run-level exception diagnostic was emitted outside the source's budgeted sink.

The pre-fix diagnostic captures were bounded and credential-safe: the `403` capture showed `request-failed` with `undefined` metadata rather than logging a response payload, the proxy regression serialized the retained host/path without exposing the expected redaction label, and the budget regression recorded 1,006 events instead of the allowed 1,001.

### Fixes

- Set `useSessionPool: false` for both dedicated Cheerio and Playwright crawler instances. This lets `401`, `403`, `429`, and `526` reach the dedicated status/diagnostic path. The choice is scoped to runner construction so Task 4 can deliberately introduce configured sessions later.
- Added a hermetic real-Crawlee lifecycle test using an in-process response stream, not a live server. It proves `403` and `526` reach `http-response` with status, Retry-After, CF-Ray, Server, and bounded body snippet and produce a blocked zero-item outcome. Existing source-outcome coverage proves persisted items plus blocking classify as partial.
- Replace complete credentialed or proxy-host embedded URLs with `[proxy-url-redacted]`; ordinary public URLs remain available with secret query parameters sanitized.
- Added a run-level per-source diagnostic budget and routed `source-failed` through it. Each source now emits at most 1,000 events plus one `diagnostic-budget-exhausted` event, including exceptional termination.

### TDD evidence

Red commands:

- `npx vitest run tests/danish-jsonld/runner.test.ts`
  - `403` failed because Crawlee emitted `Request blocked - received 403 status code` before the handler; response headers and snippet were absent. The `526` case passed through the handler.
- `npx vitest run tests/danish-jsonld/diagnostics.test.ts`
  - The credentialed proxy URL retained `proxy.example:8080/proxy-path` and lacked `[proxy-url-redacted]`.
- `npx vitest run tests/danish-jsonld/runner.test.ts`
  - The shared-budget regression received 1,006 events instead of 1,001.

Green command:

- `npm run build && npm test && git diff --check`
  - TypeScript build passed.
  - 30 test files passed, 178 tests passed, 0 failed.
  - Diff whitespace validation passed.

### Remaining concern

Only the previously disclosed permanent robots-off invariant remains tool-blocked. This round did not retry or alter that boundary.

## Review fix round 3 — 2026-08-13

Closed the remaining proxy-context redaction finding without retrying the robots edit.

### Root cause and fix

I checked six possible sources: URL userinfo detection, proxy-hostname matching, query-secret handling, surrounding error-text context, sensitive object-key matching, and nested provenance propagation. The focused red diagnostics reduced the problem to two causes: URL-local proxy heuristics and missing proxy provenance propagation. Query sanitization and direct proxy-key redaction were already working.

The prior sanitizer decided whether to whole-redact an embedded URL using only URL-local signals: credentials or a hostname containing `proxy`. Neutral gateway hosts therefore remained visible even when the surrounding diagnostic explicitly identified them as proxy endpoints. Nested transport records with `provenance: "proxy"` likewise did not propagate that provenance to their endpoint/provider values.

- Added immediate contextual detection for `proxy <URL>` and `connect ECONNREFUSED <URL>` forms. The full URL is replaced with `[proxy-url-redacted]` regardless of hostname, port, path, query, or credentials.
- Kept context narrowly anchored immediately before the URL so a later ordinary public response URL remains visible and independently secret-sanitized.
- Whole-redact nested records that declare proxy provenance. Existing proxy-related object keys remain unconditionally redacted by the sensitive-key boundary.

### TDD evidence

Red command:

- `npx vitest run tests/danish-jsonld/diagnostics.test.ts`
  - 2 failures: both neutral-host proxy URLs remained visible, and the structured proxy-provenance record retained its endpoint/provider.

Refinement evidence:

- The first context matcher carried `proxy` too far across a sentence and redacted a later public URL. The focused test caught this; anchoring the marker immediately before the URL fixed the over-redaction.

Green command:

- `npm run build && npm test && git diff --check`
  - TypeScript build passed.
  - 30 test files passed, 180 tests passed, 0 failed.
  - Diff whitespace validation passed.

### Remaining concern

Only the previously disclosed permanent robots-off invariant remains tool-blocked. This round did not retry or alter that boundary.
