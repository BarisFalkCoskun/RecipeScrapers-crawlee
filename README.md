# RecipeScrapers Crawlee

Recipe crawling pipeline built on Crawlee, with JSON-LD, WPRM and custom extractors,
browser fallback, MongoDB persistence, incremental fetching, resumable runs, and
website-wide cooldowns.

With dependencies installed and MongoDB running, start a crawl of **every
registered site** with:

```bash
npm start
```

The default run attempts each distinct source once, including sites that failed
on earlier runs. Aliases are deduplicated, and each site's outcome is reported.
There is no default per-site page cap. MongoDB defaults to
`mongodb://localhost:27017`, database `crawlee`; configure `MONGODB_URI` and
`DB_NAME` in `.env` when needed.

```bash
npm start -- --sources arla,gastrofun   # Crawl selected sites
npm start -- --language da             # Crawl Danish-language sites
npm start -- --language en             # Crawl English-language sites
npm start -- --language da --list-sources # Preview the Danish selection
npm start -- --list-sources             # List sites without crawling
npm start -- --check                    # Check setup without crawling
npm start -- --help                     # Show options
npm start -- --resume RUN_ID --sources all
```

`--language` also accepts `danish`, `dansk`, `english`, or `da,en`.
It selects sites by their configured recipe catalogue language, including
localized routes on international domains. It does not filter by cuisine or
guarantee the language of every recipe on a multilingual site. Combine it with
`--sources` to narrow that list further; an empty match fails before crawling.
Site languages are maintained in `src/danish-jsonld/source-languages.ts`.
Each source also uses matching request-language defaults; its registry entry can
override the regional locale and timezone through `requestProfile`.

See [crawl reliability and source health](docs/crawl-reliability.md) for resumable runs, completion accounting, rejected candidates, and monitoring.

## Commands

- `npm run build`: type-check the project.
- `npm test`: run the unit and storage tests.
- `npm run smoke:crawl`: run a hermetic end-to-end crawl against a local fixture site. This exercises sitemap ingestion, TTL skips, Cheerio discovery, Playwright fallback, metrics, and crawl-run persistence.
- `npm run diagnose:identity`: verify the Danish HTTP identity against its Impit profile and compare native/browser WebGL on a loopback fixture. Requires the bundled Chromium; contacts no recipe sites.
- `npm run report:runs`: print recent `crawl_runs` summaries from Mongo.
- `npm run report:health`: report source completeness, freshness, changes, and quality alerts; supports `--json`, `--html <file>`, and `--check`.
- `npm run operations:checkpoints`: list resumable run journals; see the reliability guide for pruning completed journals.
- `npm run test:integration`: test real MongoDB behavior using `MONGODB_TEST_URI`.
- `npm run migration:readiness`: audit every legacy Danish command and fail
  until its effective Crawlee source is at `cutover` and the operational gates
  have auditable evidence supplied with `--operational-evidence <file>`.
- `npm run operations:scheduler`: run the fail-closed Danish scheduler or use
  `--list` / `--run-now <source>` for preflight and controlled execution.
- `npm run operations:healthcheck`: validate scheduler heartbeat freshness and
  process ownership.
- `npm start`: crawl every registered site with the improved runner.
- `npm run crawl:danish-jsonld`: compatibility command for the same runner and defaults.
- `npm run crawl:legacy`: run the older seed-based crawler.

For the strict Danish JSON-LD migration pilot, consumer contract, and
remote-only canary/shadow/cutover workflow, read
[docs/danish-jsonld-migration-operations.md](docs/danish-jsonld-migration-operations.md).

The registry now contains all 88 legacy `WprmApiSpider` sources whose effective
locale is Danish. They read complete recipes directly from the WordPress WPRM
REST API and do not fetch each recipe's HTML page. The initial live-test cohort
remains `gastrofun`, `groedgrisen`, `ketoliv`, `madensverden`, and
`planteaederen`. Verify inventory parity and run a Mongo-free bounded probe with:

```bash
npm run audit:legacy-wprm
CRAWLEE_STORAGE_DIR=/tmp/recipe-crawlee-probe \
npm run probe:danish-wprm -- --sources gastrofun --max-pages 1
```

The same in-memory probe supports JSON-LD sources through
`npm run probe:danish-source -- --sources <id> --max-pages <n>`. Use
`--uncapped` only for an intentional full-catalog run; probes otherwise default
to one page.

Run a bounded isolated-database canary with:

```bash
MONGODB_URI='mongodb://localhost:27017' \
DB_NAME='crawlee_danish_wprm_canary' \
npm run crawl:danish-wprm-pilot -- --max-pages 10 --force
```

Transport is source-specific and mirrors the effective Scrapy setting. A
bounded 100-recipe Gastrofun comparison currently has exact material-field
parity, but remains only `configured` until an uncapped run proves discovery
complete. See [the Scrapy deprecation gates](docs/scrapy-deprecation-plan.md)
before changing any source to `cutover`.

## Runtime Notes

- `npm start` expects MongoDB via `MONGODB_URI` and `DB_NAME`. Defaults are `mongodb://localhost:27017` and `crawlee`.
- `npm start` stores complete recipes in `recipes_v2`, rejected candidates in `recipe_candidates`, and run evidence in `crawl_runs`.
- Each run has its own ID and durable checkpoints. Use `--resume RUN_ID --sources all` to continue a default run, or repeat the original `--sources` and/or `--language` filters for a restricted run (e.g. `--resume RUN_ID --language da`). `CRAWL_RUN_ID` sets the base ID for a new attempt; it does not resume old work.
- Crawl-run summaries are stored in `crawl_runs` and pruned automatically with a Mongo TTL index. The retention window is configured in `src/config.ts`.
- The older `crawl:legacy` command retains its seed list, `recipes` collection, TTL checks, and Playwright wait settings:
  - `PLAYWRIGHT_WAIT_FOR_LOAD_STATE`
  - `PLAYWRIGHT_WAIT_FOR_LOAD_STATE_TIMEOUT_MS`

## Operations

Run `npm start -- --check` to validate the selected sources, writable storage,
Chromium launch and a read-only MongoDB ping. Failed checks exit with code 1;
the check does not crawl websites or write database records/indexes.

During a crawl, progress on stderr shows finished, active, paused and lock-waiting
sites, new/changed recipes and pending requests. A cooling site checkpoints its
work so the batch can crawl other sites, then returns when the pause expires.
Separate processes using the same local `CRAWLEE_STORAGE_DIR` serialize overlapping
websites and protect their saved browser state.

The dedicated runner conditionally fetches recipe pages using ETag/Last-Modified
and shares website cooldowns across HTTP/browser requests and worker restarts.
It also learns slower request intervals from errors and rising response times,
recovers gradually after healthy responses, and pauses repeatedly denied hosts.
Cookies, local storage and IndexedDB survive compatible browser replacements and
restarts using private snapshots with a 24-hour expiry.
Use `--refresh-hours 12` for an explicit reuse interval, or `--full-refresh` to
fetch every pending page again. See [incremental fetching and cooldowns](docs/crawl-reliability.md#incremental-fetching-and-website-cooldowns)
for cache scope, retry behavior, and run counters.

The dedicated Danish runner keeps one session per source attempt: one healthy
VPN lease, a cookie jar shared by HTTP and browser requests, and one request in
flight. The lease closes at source completion, failure, or page cap. Relay changes
clear cookies and saved browser storage and retire affected browsers; retry limits remain per request.
Serialization prevents one request from rotating a relay while another uses it,
and may reduce throughput for sources previously configured above concurrency one.

HTTP uses the explicit Impit `chrome151` profile with matching headers. Rendered
pages advertise Playwright's actual bundled Chromium version and host platform;
these are distinct transport profiles, not an identical fingerprint across the
HTTP/browser transition. The browser preserves native WebGL behavior. Upgrade
the HTTP profile and headers together, then rerun `npm run diagnose:identity`.
See [the implementation and validation notes](docs/danish-session-identity.md).

- Use `npm run smoke:crawl` in CI or before landing crawler changes that affect queueing, routing, fallback, or recrawl behavior.
- Use `npm run report:runs` to compare crawl yield, skip counts, and fallback rate across recent runs.
- Use the [scheduler operations runbook](docs/crawlee-scheduler-operations.md)
  for fail-closed source selection, durable scheduling, health checks,
  deployment, and rollback.
