# Danish JSON-LD migration operations

This guide covers the dedicated `RecipeDocumentV2` migration path. It is not a
claim that any source or downstream consumer has completed migration.

## Local checks only

Run these checks locally; they do not contact recipe sites or MongoDB:

```bash
npm run build
npm test
npm run migration:status -- --format markdown
```

The fixture-only smoke crawl also needs Playwright Chromium. If the browser is
not installed, install it before running the smoke check:

```bash
npx playwright install chromium
npm run smoke:crawl
```

## Twelve-source pilot

The exact ordered pilot is exposed as `DANISH_JSONLD_PILOT_SOURCE_IDS` in
`src/danish-jsonld/source-selection.ts`:

```text
arla,coop,kitchenaid,surdejsentusiasten,sundpaabudget,klinksgaard,madoghave,netto,madrejsen,tv2mad,kikkoman,gamleopskrifter
```

Do **not** run a canary from a developer machine. On an approved remote worker,
set a dedicated database that is neither the legacy database nor a shared
production database, then run a bounded pilot canary:

```bash
export PILOT_SOURCES='arla,coop,kitchenaid,surdejsentusiasten,sundpaabudget,klinksgaard,madoghave,netto,madrejsen,tv2mad,kikkoman,gamleopskrifter'
MONGODB_URI='mongodb://USER:PASSWORD@REMOTE_HOST:27017/?authSource=admin' \
DB_NAME='crawlee_danish_jsonld_canary_YYYYMMDD' \
npm run crawl:danish-jsonld -- --sources "$PILOT_SOURCES" --max-pages 50 --force --json-out pilot-canary.json
```

Keep `pilot-canary.json` with the remote run record. It includes the run ID,
exact selected sources, cap, database name, source outcomes, and observations.
Never copy access credentials into the evidence file or a ticket.

The source registry is the checklist record. Inspect it without contacting any
site:

```bash
npm run migration:status -- --format markdown
```

Currently, this command records configuration state only. It must not be read
as a passed canary, shadow run, or cutover for any source.

## Evidence-backed source-by-source transition

Advance one source at a time; do not advance the whole pilot as a group.

| Transition | Required evidence |
| --- | --- |
| `not_started` to `configured` | Reviewed registry entry, expected discovery route, request limits, and a documented owner. |
| `configured` to `canary_passed` | Remote isolated-DB canary JSON with complete discovery, no cap reached, no blocked/failed outcome, and complete JSON-LD recipes persisted. A capped run is not a passing canary. |
| `canary_passed` to `shadow_passed` | Remote isolated-DB shadow evidence over the agreed window plus source-level parity against the legacy run: canonical URL coverage, accepted recipe count, rejected JSON-LD reasons, and duplicate/content-match rate are within the agreed gate. Investigate drift; do not average it away across sources. |
| `shadow_passed` to `cutover` | Recorded parity approval, verified consumer reads of `RecipeDocumentV2.normalized`, rollback owner, and an individually scheduled source cutover. Keep the legacy source available until the source's rollback window ends. |

Each transition must attach the run ID, timestamp, source ID, comparison scope,
and the reviewed evidence to the migration record. No currently registered
source is represented here as having passed any of these gates. Arla is
`configured`; it has not passed a canary, shadow, or cutover gate.

## Remote-only full shadow and comparison

Run the same pilot as two separate, full, uncapped remote jobs. Do not use a
page cap for either job. Both databases must be fresh isolated databases, and
the commands must run from their respective checkouts.

First, in the Scrapy checkout, produce normalized legacy recipes and a JSON
summary. `--no-state` prevents a previous cycle from hiding URLs; `full` writes
the normalized `recipes` collection. The command has no page cap.

```bash
export PILOT_SPIDERS='arla coop kitchenaid surdejsentusiasten sundpaabudget klinksgaard madoghave netto madrejsen tv2mad kikkoman gamleopskrifter'
MONGODB_URL='mongodb://USER:PASSWORD@REMOTE_HOST:27017/?authSource=admin' \
MONGODB_DATABASE='recipescrapers_danish_jsonld_shadow_YYYYMMDD' \
RECIPE_FEED_EXPORT_ENABLED=false \
uv run python -m tools.run_all_spiders \
  --spiders $PILOT_SPIDERS --processing-mode full --no-state --parallel 2 \
  --summary-file scrapy-shadow.json
```

Next, in this Crawlee checkout, crawl that same ordered cohort to a different
isolated database. Omitting `--max-pages` makes this a full, uncapped run.

```bash
export PILOT_SOURCES='arla,coop,kitchenaid,surdejsentusiasten,sundpaabudget,klinksgaard,madoghave,netto,madrejsen,tv2mad,kikkoman,gamleopskrifter'
MONGODB_URI='mongodb://USER:PASSWORD@REMOTE_HOST:27017/?authSource=admin' \
DB_NAME='crawlee_danish_jsonld_shadow_YYYYMMDD' \
npm run crawl:danish-jsonld -- --sources "$PILOT_SOURCES" --force --json-out crawlee-shadow.json
```

Finally, run the read-only comparison from this checkout. It explicitly names
both databases and sources, reads legacy normalized `recipes` (`source_site`,
`url`, title/ingredients/instructions) and Crawlee `recipes_v2`, and writes one
JSON report to standard output. The credentials stay in environment variables.

```bash
LEGACY_MONGODB_URI='mongodb://USER:PASSWORD@REMOTE_HOST:27017/?authSource=admin' \
CRAWLEE_MONGODB_URI='mongodb://USER:PASSWORD@REMOTE_HOST:27017/?authSource=admin' \
npm run migration:compare -- \
  --legacy-db recipescrapers_danish_jsonld_shadow_YYYYMMDD \
  --crawlee-db crawlee_danish_jsonld_shadow_YYYYMMDD \
  --sources "$PILOT_SOURCES" \
  --crawlee-evidence crawlee-shadow.json > shadow-comparison.json
```

The report contains per-source and aggregate legacy/Crawlee URL counts,
intersection, coverage, required-field checks, Mongo errors, and off-domain
page-admission counts. It passes only when every source and the aggregate meet all
of these gates:

- Crawlee URL coverage is at least 95% of the source-scoped legacy canonical
  URL set.
- At least 99% of title, ingredients, and instructions checks agree on URL
  intersections, with zero missing Crawlee required fields.
- Evidence reports zero Mongo failures and no admitted page URL is outside the
  source's registered allowed domains.

A missing/mismatched Crawlee evidence file, source cohort, or Crawlee database
fails the comparison rather than producing an unscoped pass.

## Storage and consumer contract

The native MongoDB collections for this path are:

| Collection | Role |
| --- | --- |
| `recipes_v2` | Strict JSON-LD `RecipeDocumentV2` records, keyed by `sourceRecipeKey`. |
| `pages` | Page provenance; exact `application/ld+json` script bodies are stored in compressed `rawJsonLdScripts`. |
| `recipe_content_matches` | Cross-source and same-source content-hash match audit records. |
| `crawl_runs` | Both legacy run summaries and dedicated V2 run records. Danish records have `kind: "danish-jsonld-v2"`, `schemaVersion: 2`, source IDs, source outcomes, and observations; legacy reports exclude those records. Retention is managed by the TTL index. |

Consumers must read `RecipeDocumentV2.normalized` for the portable recipe
payload: title, ingredients, ordered instructions, durations, yield, images,
categories, cuisines, keywords, and optional nutrition. Preserve `rawRecipe`
for provenance/debugging only; do not make it a downstream parsing contract.

Consumer migration is an external-repository task:

1. Add a V2 read path that consumes `normalized` and retains source identity.
2. Test the consumer against an isolated `recipes_v2` fixture/database.
3. Compare its output with its legacy read path for one source.
4. Record the consumer repository, version, owner, and rollback behavior before
   that source is cut over.

This repository does not assert that any external consumer has been migrated.

## Open constraint

The requested permanent robots-off behavior remains unresolved and tool-blocked.
The dedicated runner observes the crawler's current state, but no permanent
source/factory invariant was applied. Do not treat a run as evidence that this
requirement has been completed; resolve it before declaring the migration fully
ready.
