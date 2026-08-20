# Crawlee scheduler operations

The Crawlee scheduler is the replacement for the legacy APScheduler entry
point. It is deliberately fail-closed: by default it accepts only sources whose
registry state is `cutover`. At present that means it refuses to start because
no source has completed the consumer and operational approval gates.

## Preflight and observation runs

List the effective schedule without contacting sites or MongoDB:

```bash
CRAWLEE_SCHEDULER_ALLOWED_STATES=shadow_passed \
CRAWLEE_SCHEDULED_SOURCES=foodfanatic,ketoliv \
npm run operations:scheduler -- --list
```

Run one eligible source immediately. A blocked, failed, no-data, or otherwise
unhealthy source outcome exits nonzero and is recorded as failed in the durable
ledger. A partial outcome is accepted only when recipes were persisted and all
other reasons are expected incomplete-record rejections.

```bash
MONGODB_URI='mongodb://USER:PASSWORD@HOST:27017/?authSource=admin' \
DB_NAME='crawlee_danish_observation_YYYYMMDD' \
CRAWLEE_SCHEDULER_ALLOWED_STATES=shadow_passed \
CRAWLEE_SCHEDULED_SOURCES=foodfanatic \
npm run operations:scheduler -- --run-now foodfanatic
```

This override is for isolated observation jobs, not production promotion.
Production remains `cutover`-only. Promote a source in the registry only after
all source acceptance and consumer gates in the deprecation plan are approved.

## Schedule configuration

The scheduler supports the same daily `minute hour * * *` shape used by the
legacy job. It staggers sources by twenty minutes from `CRAWLEE_SCRAPE_HOUR`
(default `1`) unless a source-specific expression is set.

- `CRAWLEE_SCHEDULER_ALLOWED_STATES`: comma-separated registry states; defaults
  to `cutover`.
- `CRAWLEE_SCHEDULED_SOURCES`: optional comma-separated source IDs. Every ID
  must be in an allowed state.
- `CRAWLEE_SCHEDULE_<SOURCE_ID>`: source override such as `20 2 * * *`.
- `CRAWLEE_SCHEDULER_TIMEZONE`: defaults to `Europe/Copenhagen` and observes
  daylight-saving transitions.
- `CRAWLEE_SCHEDULE_CATCHUP_MINUTES`: how far after a daily slot it may run;
  defaults to 1800 minutes.
- `CRAWLEE_SCHEDULER_POLL_MS` and `CRAWLEE_SCHEDULER_HEARTBEAT_MS`: loop and
  heartbeat intervals.
- `CRAWLEE_SCHEDULER_LEDGER_PATH`, `CRAWLEE_SCHEDULER_HEARTBEAT_PATH`, and
  `CRAWLEE_SCHEDULER_EVIDENCE_DIR`: durable operational state paths.

Each daily slot is attempted at most once automatically, including a failed or
interrupted attempt. This prevents retry storms. Correct the fault and use
`--run-now` for an operator-controlled retry.

## Durability and health

The ledger is atomically replaced after every state change. A `running` entry
left by a stopped process is marked `interrupted` on the next start. A renewable
lock beside the ledger permits only one scheduler process; stale locks are
renamed and retained for diagnosis.

The heartbeat contains the process ID, hostname, selected sources, update time,
and active source. Check it with:

```bash
npm run operations:healthcheck
```

The check exits nonzero when the heartbeat is missing or older than
`CRAWLEE_SCHEDULER_HEARTBEAT_MAX_AGE_SECONDS` (default 180), belongs to another
host, or its process is dead.

## Container deployment

`compose.yaml` defines MongoDB and one scheduler replica with persistent Mongo,
ledger, heartbeat, Crawlee storage, and evidence volumes. It intentionally does
not opt any pre-cutover source into production.

```bash
docker compose build
docker compose up -d
docker compose ps
```

Until at least one registry entry is `cutover`, the scheduler service exits with
`No Danish sources are eligible for scheduling`. That is the intended safety
state, not a reason to widen `CRAWLEE_SCHEDULER_ALLOWED_STATES` in production.

For a real deployment, inject `MONGODB_URI` through the platform's secret store,
keep exactly one scheduler replica, alert on an unhealthy container and failed
ledger entries, and retain the evidence volume for the rollback window.

## Rollback

During an individual source's observation window:

1. Disable that source in the Crawlee deployment and retain its ledger and run
   evidence.
2. Re-enable only the matching legacy Scrapy schedule using its previous
   database and feed configuration.
3. Confirm one successful legacy run and downstream ingestion before declaring
   rollback complete.
4. Diagnose Crawlee against the isolated evidence. Do not run both production
   writers for the same source concurrently.

The exact legacy schedule and secret references must remain available until the
source-specific observation window and consumer sign-off are complete.
