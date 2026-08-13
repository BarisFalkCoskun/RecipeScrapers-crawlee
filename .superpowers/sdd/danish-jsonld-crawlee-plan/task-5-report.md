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

## Fix round 1 — actionable shadow comparison and V2 run records

Added a tested, read-only `migration:compare` path that requires explicit
legacy/Crawlee database names, source IDs, and Crawlee run evidence. It compares
source-scoped canonical URL sets from legacy normalized `recipes` with
`recipes_v2`; it reports source and aggregate coverage, required-field
agreement, observed Mongo failures, and off-domain page admissions. A report
passes only when every source and the aggregate have at least 95% URL coverage,
at least 99% required-field agreement, zero missing Crawlee required fields,
zero Mongo failures, and zero unintended off-domain admissions.

Dedicated CLI runs now persist a `kind: "danish-jsonld-v2"`, `schemaVersion: 2`
record in native `crawl_runs` after every completed run, including partial
outcomes. Persistence failures surface to the CLI while its existing cleanup
still closes the store. Legacy `report:runs` ignores the discriminated V2
records, avoiding the structural collision with legacy metric summaries.

The operations guide now supplies exact remote-only full/uncapped Scrapy and
Crawlee commands plus the read-only comparison command. It also explicitly says
Arla is configured only; no source has passed a canary, shadow, or cutover.

### Fix-round TDD evidence

Red command:

```bash
npm test -- tests/danish-jsonld/migration-compare.test.ts tests/danish-jsonld/cli.test.ts tests/storage/mongodb.test.ts
```

The new comparator suite could not import the missing module; dedicated run
tests then showed zero persistence calls, a persistence failure incorrectly
resolved, and no store method. After the minimal implementation, a stale fake
store contract and legacy-run filtering were updated to reflect the V2 method
and discriminator.

Green focused verification:

```bash
npm test -- tests/danish-jsonld/migration-compare.test.ts tests/danish-jsonld/cli.test.ts tests/storage/mongodb.test.ts
npm run build
```

The focused suite passed 23 tests and TypeScript compilation passed. Full-suite
verification passed: `npm run build`, `npm test` (33 files, 226 tests), and
`git diff --check` all completed with zero failures.

### Original checkout limitation

The current four modified paths in
`/Users/boris/Repositories/RecipeScrapers/RecipeScrapers-crawlee` remain present,
but byte-for-byte preservation cannot be proven because initial hashes were not
captured. This is not claimed as a completed preservation requirement.

## Fix round 2 — fail-closed shadow evidence and admission telemetry

The read-only `migration:compare` CLI now requires both `--scrapy-evidence` and
`--crawlee-evidence`, in addition to explicit isolated database names and the
selected source cohort. It rejects malformed evidence rather than turning
missing counters into zero. Each file must identify exactly the selected source
set and provide one terminal result per source. Scrapy evidence additionally
requires a full/uncapped successful run with a complete health/statistics
record, no timeout, and no interruption. Crawlee evidence additionally requires
an uncapped successful source outcome, complete discovery, zero Mongo failures,
and zero rejected incomplete/malformed required JSON-LD records.

Parity remains a **required-field presence** contract, not a title, ingredient,
or instruction text-equality contract. The JSON report names the metric
`requiredFieldPresenceAgreement`: for intersecting canonical URLs it compares
non-empty presence of `title`, `ingredients`, and `instructions` on both sides.
Extra Crawlee recipes do not reduce legacy URL coverage. The report only passes
at 95% source-scoped legacy URL coverage and 99% required-field presence
agreement, with zero missing Crawlee required fields, Mongo errors, and
off-domain queue admissions. A non-passing JSON report is emitted before the
CLI returns exit code 2.

Legacy normalized recipe reads now query the registry's effective
`source_site` domain mapping and emit the registry source ID. This is tested for
Arla (`arla` -> `arla.dk`), Coop (`coop` -> `opskrifter.coop.dk`), and every
selected pilot source; the comparator no longer assumes `source_site` is the
spider/source ID.

Dedicated `unintendedOffDomainAdmissions` telemetry is initialized per source
attempt and recorded only after a request batch has been successfully submitted
to a Crawlee queue. Rejected discovery links do not increment it. The persisted
run observation is the comparator input, so an admitted off-domain request
fails parity even if no page was stored. The bounded `off-domain-admission`
diagnostic records only the hostname, which made the queue-boundary check
observable without adding URL-bearing logs.

Comparison Mongo clients are now closed in `finally` even when the other
client's connection fails. The CLI cleanup test also now proves the native V2
run record was inserted before a simulated store-close failure; cleanup still
surfaces that failure and cleans up VPN transport.

### Fix-round TDD and verification

Initial focused RED run:

```bash
npm test -- tests/danish-jsonld/migration-compare.test.ts tests/danish-jsonld/crawler-session.test.ts
```

It failed for the new required `--scrapy-evidence` option, absent legacy
source-site mapper, missing uncapped-evidence validation, and absent
queue-admission counter. The implementation was then added only to satisfy
those contracts. The runner queue-boundary test uses a mocked Crawlee request
function; it makes no external request.

Final verification (all local, no DB/network/crawl):

```bash
npm test -- tests/danish-jsonld/runner.test.ts tests/danish-jsonld/migration-compare.test.ts tests/danish-jsonld/crawler-session.test.ts tests/danish-jsonld/cli.test.ts
npm run build
npm test
git diff --check
```

Passed: focused suite 43 tests, TypeScript build, full suite **33 files / 233
tests**, and whitespace diff check. No live MongoDB, remote worker, recipe-site,
or local browser crawl was run in this fix round.

Arla remains configured only. No source has passed a canary, shadow, or cutover
gate. Permanent robots-off also remains unresolved/tool-blocked. The original
dirty checkout at
`/Users/boris/Repositories/RecipeScrapers/RecipeScrapers-crawlee` still has the
same four modified paths (`src/crawlers/cheerio-crawler.ts`,
`src/discovery/link-filter.ts`, `src/main.ts`, and
`tests/discovery/link-filter.test.ts`); byte-for-byte preservation cannot be
proven because no initial hashes were captured.

## Fix round 3 — portable evidence paths and terminal-reason contract

The remote-only Scrapy, Crawlee, and comparison snippets now share one explicit
absolute evidence directory, created once with
`EVIDENCE_DIR="/var/tmp/recipescrapers-danish-jsonld-shadow-$(date -u +%Y%m%dT%H%M%SZ)"`.
All three evidence paths and the JSON comparison output use
that directory. The guide says to retain the exported value while changing
checkout directories, or re-export that exact printed path in a new shell.

The comparator now fails closed on terminal outcome reasons. Every Scrapy result
must provide `outcome_reasons` as an array of strings; every successful Crawlee
source outcome must provide `outcomeReasons` as an array of strings. In either
case a non-empty array fails comparison. Successful Crawlee source outcomes are
now emitted with an empty reasons array, while partial/blocked/failed outcomes
retain diagnostic reasons.

Read-only source inspection found that the current legacy Scrapy
`SpiderRunResult.to_dict()` summary emits no `outcome_reasons` field. The
comparator intentionally does not infer an empty array from `outcome`,
`blocked_reason`, or `error_message`; the upstream summary schema must add the
explicit field before a Scrapy shadow can pass. This is documented as an
unresolved cross-repository prerequisite, not hidden by a compatibility
fallback.

### Fix-round TDD and verification

The new focused reason-contract test first failed because missing
`outcome_reasons` was accepted, and the existing successful-source outcome test
first failed because Crawlee emitted `recipes-persisted` as a successful reason.
After the minimal validation and success-outcome changes:

```bash
npm test -- tests/danish-jsonld/migration-compare.test.ts tests/danish-jsonld/source-outcome.test.ts tests/danish-jsonld/runner.test.ts tests/danish-jsonld/cli.test.ts
```

passed with 49 tests. Final verification passed: `npm run build`, `npm test`
(**33 files / 234 tests**), and `git diff --check`. No DB, network, or crawl
action was run.

## Fix round 4 — correct current Scrapy summary contract

Corrected the operations guide and this report after verifying the current
Scrapy checkout at commit `b51018d`. Six possible explanations for the reported
schema mismatch were checked: a missing `to_dict()` field, runner serialization
bypassing `to_dict()`, post-serialization field removal, a different command
path, an outdated checkout inspection, and an older saved summary. The current
source rules out the first four: `SpiderRunResult.to_dict()` emits
`outcome_reasons`, and `run_all_spiders` writes each result via `to_dict()`.

The most likely source of the obsolete blocker was an outdated source snapshot
or saved evidence generated before the field existed. A fresh summary produced
by the documented shadow command includes the required field; older summaries
must be regenerated. The comparator remains intentionally fail-closed and does
not infer missing outcome reasons from other fields.

This round changes documentation only. No code, tests, DB, network, or crawl
action was run.
