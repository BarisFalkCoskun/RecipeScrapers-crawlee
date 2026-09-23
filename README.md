# RecipeScrapers Crawlee

Recipe crawling pipeline built on Crawlee, with Cheerio-first crawling, lazy Playwright fallback, Mongo-backed persistence, recrawl TTL checks, and run-level metrics.

## Commands

- `npm run build`: type-check the project.
- `npm test`: run the unit and storage tests.
- `npm run smoke:crawl`: run a hermetic end-to-end crawl against a local fixture site. This exercises sitemap ingestion, TTL skips, Cheerio discovery, Playwright fallback, metrics, and crawl-run persistence.
- `npm run diagnose:identity`: verify the Danish HTTP identity against its Impit profile and compare native/browser WebGL on a loopback fixture. Requires the bundled Chromium; contacts no recipe sites.
- `npm run report:runs`: print recent `crawl_runs` summaries from Mongo.
- `npm run migration:readiness`: audit every legacy Danish command and fail
  until its effective Crawlee source is at `cutover` and the operational gates
  have auditable evidence supplied with `--operational-evidence <file>`.
- `npm run operations:scheduler`: run the fail-closed Danish scheduler or use
  `--list` / `--run-now <source>` for preflight and controlled execution.
- `npm run operations:healthcheck`: validate scheduler heartbeat freshness and
  process ownership.
- `npm start`: run the real crawler against the configured seeds.

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
- Recipe documents are stored in the `recipes` collection. The crawler tracks recipe language per document, so the collection name is intentionally generic unless a run is known to be Danish-only.
- Each `npm start` uses run-scoped Crawlee queues and sitemap/link-filter state. Set `CRAWL_RUN_ID=<id>` to intentionally resume or re-run against the same local Crawlee storage.
- Crawl-run summaries are stored in `crawl_runs` and pruned automatically with a Mongo TTL index. The retention window is configured in `src/config.ts`.
- Playwright wait behavior is configurable through:
  - `PLAYWRIGHT_WAIT_FOR_LOAD_STATE`
  - `PLAYWRIGHT_WAIT_FOR_LOAD_STATE_TIMEOUT_MS`

## Operations

The dedicated Danish runner keeps one session per source attempt: one healthy
VPN lease, a cookie jar shared by HTTP and browser requests, and one request in
flight. The lease closes at source completion, failure, or page cap. Relay changes
clear the jar and retire affected browsers; retry limits remain per request.
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
