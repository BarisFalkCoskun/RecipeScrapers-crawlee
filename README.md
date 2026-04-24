# RecipeScrapers Crawlee

Recipe crawling pipeline built on Crawlee, with Cheerio-first crawling, lazy Playwright fallback, Mongo-backed persistence, recrawl TTL checks, and run-level metrics.

## Commands

- `npm run build`: type-check the project.
- `npm test`: run the unit and storage tests.
- `npm run smoke:crawl`: run a hermetic end-to-end crawl against a local fixture site. This exercises sitemap ingestion, TTL skips, Cheerio discovery, Playwright fallback, metrics, and crawl-run persistence.
- `npm run report:runs`: print recent `crawl_runs` summaries from Mongo.
- `npm start`: run the real crawler against the configured seeds.

## Runtime Notes

- `npm start` expects MongoDB via `MONGODB_URI` and `DB_NAME`. Defaults are `mongodb://localhost:27017` and `danishRecipes`.
- Each `npm start` uses run-scoped Crawlee queues and sitemap/link-filter state. Set `CRAWL_RUN_ID=<id>` to intentionally resume or re-run against the same local Crawlee storage.
- Crawl-run summaries are stored in `crawl_runs` and pruned automatically with a Mongo TTL index. The retention window is configured in [src/config.ts](/Users/boris/Repositories/RecipeScrapers-crawlee/src/config.ts).
- Playwright wait behavior is configurable through:
  - `PLAYWRIGHT_WAIT_FOR_LOAD_STATE`
  - `PLAYWRIGHT_WAIT_FOR_LOAD_STATE_TIMEOUT_MS`

## Operations

- Use `npm run smoke:crawl` in CI or before landing crawler changes that affect queueing, routing, fallback, or recrawl behavior.
- Use `npm run report:runs` to compare crawl yield, skip counts, and fallback rate across recent runs.
