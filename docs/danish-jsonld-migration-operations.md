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
| `canary_passed` to `shadow_passed` | Remote isolated-DB shadow evidence over the agreed window plus source-level parity against the legacy run: canonical URL coverage, required-field presence, clean JSON-LD rejection counters, Mongo health, and queue-admission telemetry meet the stated gates. Investigate drift; do not average it away across sources. |
| `shadow_passed` to `cutover` | Recorded parity approval, verified consumer reads of `RecipeDocumentV2.normalized`, rollback owner, and an individually scheduled source cutover. Keep the legacy source available until the source's rollback window ends. |

Each transition must attach the run ID, timestamp, source ID, comparison scope,
and the reviewed evidence to the migration record. No currently registered
source is represented here as having passed any of these gates. Arla is
`configured`; **no source is `canary_passed`, `shadow_passed`, or `cutover`.**

## Remote-only full shadow and comparison

Run the same pilot as two separate, full, uncapped remote jobs. Do not use a
page cap for either job. Both databases must be fresh isolated databases, and
the commands must run from their respective checkouts on the same remote worker
or a worker that shares the same absolute evidence directory. Set this once,
then retain the exported value while changing checkout directories:

```bash
export EVIDENCE_DIR="/var/tmp/recipescrapers-danish-jsonld-shadow-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$EVIDENCE_DIR"
printf 'Evidence directory: %s\n' "$EVIDENCE_DIR"
```

If using a new remote shell for the other checkout, re-export the printed
absolute path exactly; do not create a second timestamped directory.

First, in the Scrapy checkout, produce normalized legacy recipes and a JSON
summary. `--no-state` prevents a previous cycle from hiding URLs; `full` writes
the normalized `recipes` collection. The command has no page cap.

```bash
export PILOT_SPIDERS='arla coop kitchenaid surdejsentusiasten sundpaabudget klinksgaard madoghave netto madrejsen tv2mad kikkoman gamleopskrifter'
MONGODB_URL='mongodb://USER:PASSWORD@REMOTE_HOST:27017/?authSource=admin' \
MONGODB_DATABASE='recipescrapers_danish_jsonld_shadow_YYYYMMDD' \
RECIPE_STORAGE_BACKEND=mongodb \
RECIPE_FEED_EXPORT_ENABLED=false \
uv run python -m tools.run_all_spiders \
  --spiders $PILOT_SPIDERS --processing-mode full --no-state --parallel 2 \
  --summary-file "$EVIDENCE_DIR/scrapy-shadow.json"
```

Next, in this Crawlee checkout, crawl that same ordered cohort to a different
isolated database. Omitting `--max-pages` makes this a full, uncapped run.

```bash
export PILOT_SOURCES='arla,coop,kitchenaid,surdejsentusiasten,sundpaabudget,klinksgaard,madoghave,netto,madrejsen,tv2mad,kikkoman,gamleopskrifter'
MONGODB_URI='mongodb://USER:PASSWORD@REMOTE_HOST:27017/?authSource=admin' \
DB_NAME='crawlee_danish_jsonld_shadow_YYYYMMDD' \
npm run crawl:danish-jsonld -- --sources "$PILOT_SOURCES" --force \
  --json-out "$EVIDENCE_DIR/crawlee-shadow.json"
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
  --scrapy-evidence "$EVIDENCE_DIR/scrapy-shadow.json" \
  --crawlee-evidence "$EVIDENCE_DIR/crawlee-shadow.json" \
  > "$EVIDENCE_DIR/shadow-comparison.json"
```

The report contains per-source and aggregate legacy/Crawlee URL counts,
intersection, coverage, required-field **presence** checks, Mongo errors, and
off-domain queue-admission counts. It passes only when every source and the
aggregate meet all of these gates:

- Crawlee URL coverage is at least 95% of the source-scoped legacy canonical
  URL set.
- At least 99% of title, ingredients, and instructions **presence** checks
  agree on URL intersections, with zero missing Crawlee required fields. This
  checks non-empty field presence on each side; it does not compare title,
  ingredient, or instruction text equality.
- Evidence reports zero Mongo failures, zero rejected incomplete/malformed
  required JSON-LD records, and no off-domain request that actually entered a
  source queue. Rejected discovery links are not admissions.

A missing/malformed evidence result is fatal. Both evidence files must name the
exact selected source set and have one completed terminal result per source.
Scrapy evidence must be full/uncapped with no timeout, interruption, failed
source, or incomplete health/statistics record. Crawlee evidence must be uncapped with
complete discovery, no partial/blocked/failed outcome, no Mongo error, and no
rejected incomplete/malformed required JSON-LD. Extra Crawlee recipes do not
lower legacy URL coverage; the coverage denominator is the source-scoped legacy
canonical URL set. Legacy Mongo reads use the registry's effective
`source_site` domain mapping and emit the registry source ID in the report.

Both summary schemas must include an explicit empty outcome-reasons array for a
successful source: Scrapy `outcome_reasons: []`, Crawlee `outcomeReasons: []`.
Missing, non-array, non-string, or non-empty reasons are fatal. The inspected
current Scrapy `SpiderRunResult.to_dict()` summary does **not** emit
`outcome_reasons`; update that upstream summary schema before treating a Scrapy
shadow run as comparable. The comparator deliberately does not infer an empty
array from `outcome`, `blocked_reason`, or `error_message`.

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
