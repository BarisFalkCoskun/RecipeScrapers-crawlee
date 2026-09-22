# Crawl reliability and source health

The `npm start` / `crawl:danish-jsonld` pipeline keeps durable work accounting,
resumable checkpoints, rejected-candidate evidence, and per-source health.
These features apply to the dedicated JSON-LD/WPRM/custom-source runner; the
older seed-based crawler remains available as `npm run crawl:legacy`.

`npm start` attempts every distinct source in the registry once, regardless of
historical migration or availability status. Aliases are deduplicated. Use
`npm start -- --sources arla,gastrofun` to restrict a run, `--list-sources` to
list sites without connecting to MongoDB, or `--help` for all options. The
standalone scheduler retains its explicitly configured source selection.

## Completion and exit codes

Each unique transport request is admitted to a journal **before** it enters a
Crawlee queue. Its final state is `fetched`, `rejected`, `skipped`, `failed`, or
`blocked`; anything else remains `pending`. HTTP-to-browser handoffs create a
second transport request. API listing requests can contain many recipes, so
request counts and recipe counts are deliberately separate.

`workAccounting` reconciles admitted requests with their final dispositions.
`uniqueRecipeUrls` deduplicates discovered HTML recipe URLs, and
`unaccountedRecipeCandidates` detects recipe URLs admitted by discovery but
missing from the journal. Nonzero pending or unaccounted counts prevent success.
The original `discoveredRecipeCandidates` remains an occurrence count for
compatibility with existing migration evidence.

The standalone CLI exits 0 only when every selected source succeeded, 1 for
partial/failed/blocked/no-data outcomes or errors, 130 after SIGINT, and 143 after
SIGTERM. Bounded canaries that hit their cap intentionally exit nonzero; their
JSON evidence is still written. The scheduler retains its existing explicit
allowance for partial outcomes caused solely by incomplete upstream recipes.

`collectionComplete` answers whether discovery and fetching finished without
unexplained work, fetch failures, blocks, storage failures, or a page cap.
Extraction rejection counts answer a separate quality question. A complete
collection can therefore contain rejected candidates, while its strict overall
outcome remains partial. Existing migration promotion rules are unchanged.

## Resume and interruption

```bash
CRAWLEE_STORAGE_DIR=./storage npm run crawl:danish-jsonld -- \
  --sources arla --database crawl_canary --max-pages 100 --json-out evidence/arla.json

# Use the crawlRunId printed in diagnostics or saved in the evidence file.
CRAWLEE_STORAGE_DIR=./storage npm run crawl:danish-jsonld -- \
  --sources arla --database crawl_canary --resume RUN_ID --json-out evidence/arla-resumed.json
```

Keep the original source selection, storage directory, database server,
database name, source configuration, and build. `--resume` and `--force` are
mutually exclusive. The page cap is per invocation and may be increased or
omitted when resuming. A changed build or configuration is rejected rather than
silently mixing incompatible state. Compatible saved site state can be restored;
the request queues and transport leases are new for each attempt.
For a default all-sites run, use `npm start -- --resume RUN_ID --sources all`.
For a language-selected run, repeat that filter, e.g.
`npm start -- --resume RUN_ID --language da`. If the original command also used
`--sources`, repeat both filters. `--language` selects a site's configured
catalogue language; it does not discard individual recipes by detected language.

SIGINT/SIGTERM stop scheduling new requests and let active handlers commit their
state. Checkpoints are append-only, flushed before native queue acknowledgement,
and recover an interrupted final write. Resume rebuilds fresh native queues from
the unfinished frontier, bypassing stale native queue locks. A crash between a
MongoDB write and a journal commit may replay that request; recipe and candidate
upserts are idempotent. Per-operation new/changed counters can differ after that
crash window, so they are operational indicators, not billing counters.

Resume continues **pending** work. Terminal failures and rejected candidates
remain evidence from that logical run; use a fresh run to recheck those URLs
against a changed upstream site. Sources not yet started in an interrupted batch
have empty checkpoints and start normally on resume.

Checkpoints use an exclusive process lock and owner-only files. They can include
request headers and short-lived API metadata needed to continue the source;
keep the storage volume private. Expired upstream authentication may require a
fresh run. Checkpoints are local to that volume, not a distributed work queue.

```bash
npm run operations:checkpoints
npm run operations:checkpoints -- --prune-completed --older-than-days 30
```

Pruning removes only completed, unlocked journals older than the selected age.
Unfinished journals are retained. Back up the storage volume if recovery after
host loss is required. Do not change builds mid-run if you intend to resume.

## Incremental fetching and website cooldowns

Incremental HTTP fetching is enabled by default for public recipe GET requests.
The first successful extraction saves a compressed response under
`CRAWLEE_STORAGE_DIR/incremental`. Subsequent runs send `If-None-Match` when an
ETag exists, or `If-Modified-Since` when only Last-Modified exists. A 304 reuses
the saved body, runs extraction, and checks database writes normally; recipes
still belong to the current run and contribute to coverage and unchanged counts.
This saves response transfer, not extraction or database work. Listings and
sitemaps always fetch live, so the cache cannot hide new recipe URLs.

```bash
# Default: revalidate recipe pages on every run.
npm run crawl:danish-jsonld -- --sources arla

# Explicit refresh interval: reuse eligible recipe responses for up to 12 hours.
npm run crawl:danish-jsonld -- --sources arla --refresh-hours 12

# Fetch every page again, ignoring saved validators and freshness.
npm run crawl:danish-jsonld -- --sources arla --full-refresh
```

`--refresh-hours` accepts 0–168; the default is 0. Cache-Control restrictions
can shorten that interval. `--full-refresh` is independent of `--force`, which
retains its existing run-ID behavior. Both controls can be used when resuming;
they apply only to pending requests, never to work already committed in the run.
No cached response is reused beyond seven days since its last full fetch.

Cache entries are scoped to the source configuration, build, and database target.
Missing, corrupt, incompatible, or old entries cause a full fetch. Only successful
recipe extraction with no new storage failures or rejected candidates populates
the cache. POST requests, rendered browser pages, explicit authenticated/cookie
requests, Set-Cookie responses, private/no-store responses, and unsupported Vary
variants are excluded. Individual response bodies are limited to 4 MiB.
Saved headers exclude cookies and credentials. The cache is disposable: removing
the `incremental` directory makes the next crawl fetch all recipe pages again.
Files from old builds can be removed along with other disposable cache entries.

Run observations include `notModifiedResponses` and `cachedRecipePages`. An
explicit refresh interval means some pages were reused without contacting the
site; default runs always revalidate. The scheduler uses the default behavior.

HTTP and browser queues share website cooldowns. A valid `Retry-After` sets a
deadline, supporting both delay seconds and HTTP dates. HTTP 429 and 5xx responses
also apply exponential backoff starting at 30 seconds, capped at 15 minutes;
a server's longer Retry-After is honored in full. Success resets the failure
streak but never shortens an existing deadline. Per-source retry limits remain
in force; exhausted requests still report a failure or block.

The queue waits before dispatch instead of sleeping inside a timed request
handler. SIGINT/SIGTERM remain responsive, and pending work remains resumable.
Immutable deadline files under `CRAWLEE_STORAGE_DIR/cooldowns` share the longest
deadline across workers and restarts, including after VPN changes. Expired
events older than the 15-minute failure window are removed when that host is
checked. Share the storage volume across workers to share cooldowns.
Cooldowns group a hostname with its `www` alias; a source pauses if any of its
registered hosts is cooling down. Other source workers can continue.
This controls scheduled page/API requests, not every browser subresource.

## Browser state and request languages

HTTP cookies, browser cookies, local storage and IndexedDB are saved under
`CRAWLEE_STORAGE_DIR/browser-state`. A browser replacement or a subsequent run
restores compatible state before page scripts execute. Cookie and storage
deletions replace the snapshot; deleted values do not reappear after restart.
Partitioned browser cookies stay in the browser and are never sent as ordinary
HTTP cookies. Session storage, browser cache, and service workers are not saved.

Snapshots expire 24 hours after the session starts, even if the file is updated.
They are isolated by source, allowed hosts and request/browser profile, and bound
to the current proxy URL (or direct connection). A proxy change clears cookies
and origin storage. A new VPN bridge therefore starts fresh; a direct connection
cannot detect an external IP change. Corrupt, expired and incompatible snapshots
are discarded. Only registered source and listing hosts are retained. Individual
snapshots are capped at 10 MiB. Writes are atomic and files have owner-only access;
these files can contain session credentials and should remain on private storage.
Remove `browser-state` while the crawler is stopped to start fresh.

Request profiles follow the source language metadata: Danish sources use
`da-DK` / `Europe/Copenhagen`; English sources use `en-US` / `UTC`. The profile
sets HTTP Accept-Language, browser language and timezone. Chromium can reduce
its Accept-Language header to the primary locale. To configure a regional
profile for one source, add this to its registry entry:

```typescript
requestProfile: { locale: "en-GB", timezoneId: "Europe/London" },
```

Locale and timezone values are validated before crawling. Profiles apply to
each source even in a mixed-language run; they do not relabel extracted recipes
or change which sites `--language` selects. The Playwright minimum is 1.59.1 for
native storage restoration, already resolved in the lockfile.

## Adaptive request pacing

Each source's HTTP and browser queues share a pacing controller. The lower bound
is the larger of its configured delay and the interval implied by its requests
per minute limit. Existing random delays and website cooldowns still apply.

- Network failures, HTTP 429, server errors, and access-denial statuses increase
  the learned interval by 50%, with a 1-second floor on an increased delay.
- A successful response taking more than twice the recent average and more than
  one second increases the interval by 25%.
- Ten consecutive healthy responses reduce it by 10%, never below the configured
  lower bound. The learned interval is capped at five minutes (or the configured
  minimum, when that is longer).
- Three consecutive HTTP 401/403/454/455 responses pause the website for 15 minutes.
  Another denial after that pause extends it; successful responses reset the count.

Pacing snapshots live under `CRAWLEE_STORAGE_DIR/pacing`, survive restarts and
expire after seven days without use. The scheduler serializes overlapping source
hosts; independent crawler processes do not share an atomic pacing reservation.
Website cooldowns continue to share the longest Retry-After deadline across
processes. Neither pacing recovery nor a successful response shortens that deadline.

Waiting happens in queue readiness checks, outside timed request handlers.
SIGINT/SIGTERM can interrupt a pause and leave pending work resumable. Cached
recipe-page reuse does not contribute network latency samples. The
`adaptive-pacing` diagnostic reports the hostname, status, new delay, pause
deadline and reason without cookies or credentials.

## Rejected candidates

Published documents in `recipes_v2` still require a title, ingredients, and
instructions. Rejected data goes to the separate `recipe_candidates` collection:

- JSON-LD and WPRM incomplete candidates retain their raw object and named
  missing fields, such as `missing-instructions`.
- Malformed JSON-LD/WPRM and custom-extractor rejections retain compressed
  response evidence. For custom extractors this is one evidence document per
  rejected response, with a candidate count; it does not claim to have isolated
  every missing recipe object.
- Each record includes source, URL, run ID, extraction time, and extractor
  version. Unique candidate keys make retry writes idempotent.
- Evidence expires after the existing 90-day run-retention period. A failed
  candidate write is a storage failure, never silent loss.

`incomplete-structured-data` describes what was published in structured data;
it does not prove that the visible page omits the recipe. `extractor-rejected`
explicitly leaves that diagnosis open. Ephemeral probe stores without candidate
persistence emit `quarantine-unavailable` diagnostics.

## Scheduler workers and monitoring

`CRAWLEE_SCHEDULER_WORKERS` defaults to 2. Each source runs in its own process;
overlapping allowed/listing domains remain serialized. Per-source pacing and
retry settings remain in force. File ledger and heartbeat writes are serialized,
and the heartbeat lists every active source. SIGTERM drains active workers,
with a 60-second child-process shutdown limit. An interrupted schedule slot is
not automatically retried; inspect its evidence and resume the run explicitly.
For containers, allow at least 70 seconds of stop grace.

Every 15 minutes, the scheduler checks source history and emits structured
`source-health-alert` or `source-health-recovered` events only when health changes.
These are log events, ready for your log alerting system; no external messages
are sent. `CRAWLEE_HEALTH_MAX_AGE_HOURS` defaults to 36. Recipe-count, rejection-rate,
and duration anomalies use at least three recent complete runs as a baseline.
Old runs without the new accounting are reported as unverified.

```bash
npm run report:health -- --sources arla,gastrofun
npm run report:health -- --sources arla,gastrofun --json --check
npm run report:health -- --sources arla,gastrofun --html /tmp/recipe-health.html
```

The report defaults to cutover sources. `--check` exits nonzero for warnings,
overdue sources, or missing evidence. `--max-age-hours` overrides the freshness
window. The standalone HTML report needs no server or external assets.

Run documents and JSON evidence include a build revision/content fingerprint,
configuration hash, and extractor version. The database URI is hashed rather
than stored in the evidence.

## Validation

```bash
npm run build
npm test
npm run smoke:crawl
MONGODB_TEST_URI=mongodb://127.0.0.1:27017 npm run test:integration
```

The MongoDB suite uses a uniquely named `recipe_crawlee_test_*` database and
removes only that database. Ordinary unit runs skip it when no test URI is set;
`test:integration` requires the URI. CI supplies a MongoDB 7 service, so integration
tests run there automatically. Local HTTP/browser fixtures never contact recipe
websites. Tests cover interrupted and capped resume, duplicate delivery, torn
journal writes, configuration mismatch, real unique/TTL indexes, candidate
isolation, source health alerts, and concurrent scheduler workers.
