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

The registry also carries the effective legacy discovery contract: listing
selectors, next-page selectors/patterns, skip paths, JSON payload paths, and
sitemap follow/skip patterns. Malformed or unexpected JSON listings and HTTP
200 challenge shells make discovery incomplete with a stable reason; they are
never reported as `no_data`. Redirect targets and resolved canonical hosts must
remain within that source's `allowedDomains` before extraction or persistence.

The source registry is the checklist record. Inspect it without contacting any
site:

```bash
npm run migration:status -- --format markdown
```

The checklist includes the bounded pilot evidence from crawl run
`2026-08-13T13-52-17.460Z-attempt-e656480c-a774-4c00-aa02-1fa3fdd898e0`.
Arla, Coop, and KitchenAid remain `configured` because the run reached the
50-page cap. The source reason column records each remaining block or defer
decision; no source is `cutover`.

A listing that continues through a script-only load-more control exposes no
continuation URL, so link-based discovery stops on the first page while looking
terminal. Discovery now reports that page as incomplete with the stable reason
`script-gated-continuation`, which keeps the source out of a `succeeded`
outcome. TV2 Mad was the known instance: its `Vis flere` control calls an
offset-paginated JSON service, so the pilot canary saw only the first 20 recipes
of a much larger catalogue and was demoted from `canary_passed` to `configured`.

Such a source is reached by giving the registry the service route directly.
`listingDiscovery.payload.continuationOffset` pages a JSON listing by a query
offset when the service exposes no continuation URL: paging stops on a short
page, and a full page at `maxOffset` records `listing-window-exhausted` because
the service result window, not the catalogue, ended discovery. A root array is
read with a leading `[]` path segment, as in `[].url`.

`listingDiscovery.listingHosts` names hosts that serve the listing route but not
the recipes. They are admitted for listing and continuation requests only and do
not count as off-domain admissions; recipes and canonical URLs stay bound to
`allowedDomains`. TV2 Mad uses both: it starts at
`recipe-front.services.tv2.dk/search/%20?from=0`, pages by `from` in steps of
50 up to 9950, and still admits recipes only on `livsstil.tv2.dk`.

Run one crawl at a time per checkout, or give each concurrent crawl its own
`CRAWLEE_STORAGE_DIR`. Crawlee purges its storage directory on start, so a
second crawl launched from the same checkout deletes the request queue the
first one is still using; the first then dies on a missing lock file with
`ECOMPROMISED` and writes no evidence JSON.

Some sources answer plain HTTP clients with an HTTP 454 or 455 browser check
that a real browser clears once and then keeps clearing for the rest of its
session. Configure those sources with `fetchMode: "playwright"`; the rendered
path re-requests a browser check while retries remain instead of recording it
as a terminal block. Sund på Budget is the known instance.

Such a source must not be crawled behind `--vpn`. The transport leases a relay
per request, so each request arrives from a new address and earns a new
challenge, and rotating on a challenge discards the very session that would
have cleared it. An uncapped Sund på Budget run with `--vpn` produced 801
relay-exhaustion errors and 276 blocked requests; the same source without the
VPN cleared every challenge in session and reported zero blocked requests. This
is currently an operating rule, not something the registry enforces.

What actually triggers that check is Chromium's automation markers, not the
user agent and not the address. Crawlee injects a browser fingerprint on both
fetch paths, so the user agent already reads as Chrome with no headless marker;
the giveaway was `--enable-automation` and `navigator.webdriver`. The Playwright
factory now launches with `--disable-blink-features=AutomationControlled`,
ignores the default `--enable-automation`, and clears `navigator.webdriver`
through an init script. On an identical 40-page capped run against Sund på
Budget this took browser checks from ten to zero and raised processed recipe
pages from 31 to 38.

Before blaming an address or a user agent for a block, check the markers. A
plain HTTP client with perfect browser headers still fails these checks because
its TLS fingerprint gives it away, which is why the rendered path exists.

## Evidence-backed source-by-source transition

Advance one source at a time; do not advance the whole pilot as a group.

| Transition | Required evidence |
| --- | --- |
| `not_started` to `configured` | Reviewed registry entry, expected discovery route, request limits, and a documented owner. |

The bulk `configured` transition rests on a read-only route audit: one request
per source, no crawling and no persistence, feeding the live response through
the real `discoverSitemapDocument` and `discoverListingPage`. A source passed
when its configured route resolved and produced recipe URLs matching the
registry patterns, or a sitemap index to follow. All 87 audited sources
resolved; none was configured against a dead route. **Owners are still
unassigned**, so that half of the `configured` bar is outstanding and no source
should reach `canary_passed` on route evidence alone.

The audit also caught Kenwood World continuing through a script-only load-more
control after twelve recipes, the same shape as TV2 Mad. Its reason column
records that rather than presenting it as ready.

Route yields vary by three orders of magnitude, so order canaries by size
rather than alphabetically: `opskrifterdk` alone lists 4,128 recipe URLs, and at
the configured two-second delay that is a multi-hour run on its own.
| `configured` to `canary_passed` | Remote isolated-DB canary JSON with complete discovery, no cap reached, no blocked/failed outcome, and complete JSON-LD recipes persisted. A capped run is not a passing canary. |
| `canary_passed` to `shadow_passed` | Remote isolated-DB shadow evidence over the agreed window plus source-level parity against the legacy run: canonical URL coverage, required-field presence, clean JSON-LD rejection counters, Mongo health, and queue-admission telemetry meet the stated gates. Investigate drift; do not average it away across sources. |
| `shadow_passed` to `cutover` | Recorded parity approval, verified consumer reads of `RecipeDocumentV2.normalized`, rollback owner, and an individually scheduled source cutover. Keep the legacy source available until the source's rollback window ends. |

Each transition must attach the run ID, timestamp, source ID, comparison scope,
and the reviewed evidence to the migration record. The current registry records
Mad og Have as `canary_passed` and Surdejsentusiasten as `shadow_passed`;
**no source is `cutover`.**

When the legacy spider is itself unhealthy for a source, legacy parity cannot
carry the `canary_passed` to `shadow_passed` transition. That source instead
needs its discovery proven complete against the live listing contract, two
complete successful uncapped runs whose second run upserts rather than
duplicates, and a manual read of at least twenty stored records.

The strict JSON-LD runtime preserves each exact source script. When an otherwise
valid script contains illegal literal JSON control characters inside a quoted
value, the parser may escape only those characters for the parsed recipe node
and records `json-ld-control-character-repaired`. Other malformed JSON remains
rejected. HTTP 454 and 455 WAF responses are treated as blocked; with `--vpn`,
an explicit WAF block body is eligible for reactive Mullvad relay rotation.
Access-block relay cooldown is scoped to the target hostname, so one blocked
source does not exhaust relays for unrelated sources. Playwright retires
inactive proxy-specific browsers after five seconds and closes them after ten.

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
JSON report to standard output. Crawlee evidence is validated first; its exact
`crawlRunId` and selected source IDs are then used in the `recipes_v2` query.
The credentials stay in environment variables.

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

The report contains per-source and aggregate legacy/Crawlee URL and recipe
counts, intersection, URL and recipe coverage, per-URL count mismatches,
required-field **presence** checks, Mongo errors, and off-domain
queue-admission counts. Recipes sharing one canonical URL are compared as
multisets; they are not collapsed to one record. It passes only when every
source and the aggregate meet all of these gates:

- Crawlee URL coverage is at least 95% of the source-scoped legacy canonical
  URL set.
- Recipe coverage is at least 95%, and every intersecting canonical URL has the
  same number of legacy and Crawlee recipes. Two legacy recipes versus one
  Crawlee recipe on the same page is a parity failure.
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
rejected incomplete/malformed required JSON-LD. Crawlee evidence must also have
a non-empty `crawlRunId`; mixed-run or wrong-source recipe rows are rejected.
Extra Crawlee URLs do not lower legacy URL coverage, but a recipe-count mismatch
on an intersecting URL fails parity. The URL coverage denominator is the
source-scoped legacy canonical URL set. Legacy Mongo reads use the registry's effective
`source_site` domain mapping and emit the registry source ID in the report.

Both summary schemas must include an explicit empty outcome-reasons array for a
successful source: Scrapy `outcome_reasons: []`, Crawlee `outcomeReasons: []`.
Missing, non-array, non-string, or non-empty reasons are fatal. Current Scrapy
`SpiderRunResult.to_dict()` emits `outcome_reasons`, and `run_all_spiders`
serializes each result through that method, so a fresh summary from the command
above supplies the required field. Older saved summaries may predate that
schema; regenerate them rather than using them as shadow evidence. The
comparator deliberately does not infer an empty array from `outcome`,
`blocked_reason`, or `error_message`.

## Storage and consumer contract

The native MongoDB collections for this path are:

| Collection | Role |
| --- | --- |
| `recipes_v2` | Strict JSON-LD `RecipeDocumentV2` records, keyed by `sourceRecipeKey`; indexed by `(sourceId, crawlRunId)` for exact-run evidence reads. |
| `pages` | Page provenance; exact `application/ld+json` script bodies are stored in compressed `rawJsonLdScripts`. |
| `recipe_content_matches` | Cross-source and same-source content-hash match audit records. |
| `crawl_runs` | Both legacy run summaries and dedicated V2 run records. Danish records have `kind: "danish-jsonld-v2"`, `schemaVersion: 2`, source IDs, source outcomes, and observations; legacy reports exclude those records. Retention is managed by the TTL index. |

Consumers must read `RecipeDocumentV2.normalized` for the portable recipe
payload: title, ingredients, ordered instructions, durations, yield, images,
categories, cuisines, keywords, and optional nutrition. Preserve `rawRecipe`
for provenance/debugging only; do not make it a downstream parsing contract.

`sourceRecipeKey` is stable across ingredient/instruction updates. With an
upstream `@id`, it derives from source, canonical URL, and that ID. Without
`@id`, a single recipe uses source plus canonical URL; multi-recipe pages add a
deterministic positional discriminator so records on the same page remain
distinct.

Each dedicated source attempt owns unique Cheerio and Playwright queues. After
handlers finish and the source result is captured, cleanup waits for the
configured same-domain delay plus a bounded grace buffer before both queues are
dropped in `finally`. This lets Crawlee's delayed request-reclaim callbacks
finish before their queue is deleted. The wait is visible as
`queue-cleanup-grace`; a drop failure is bounded and visible as
`queue-cleanup-failed` and does not replace the source's already-computed crawl
outcome. These attempt queues have no resume contract.

Consumer migration is an external-repository task:

1. Add a V2 read path that consumes `normalized` and retains source identity.
2. Test the consumer against an isolated `recipes_v2` fixture/database.
3. Compare its output with its legacy read path for one source.
4. Record the consumer repository, version, owner, and rollback behavior before
   that source is cut over.

This repository does not assert that any external consumer has been migrated.

## Robots policy

Robots.txt enforcement is permanently disabled. Both generic and Danish JSON-LD
Cheerio/Playwright factories set `respectRobotsTxtFile: false` at the final
constructor boundary. Seed and source configuration cannot re-enable it, and
run summaries always record `robotsEnforced: false`.
