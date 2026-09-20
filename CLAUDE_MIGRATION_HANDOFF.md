# Claude migration handoff

Continue the Danish recipe scraper migration from Scrapy to Crawlee.

## Repositories

- Crawlee project: `/home/scraper/scripts/RecipeScrapers-crawlee`
- Legacy Scrapy reference: `/home/scraper/scripts/RecipeScrapers`

You are explicitly allowed to launch spiders and crawlers against live sites in both projects for parity testing.

## Objective

Fully replace the Scrapy recipe project with Crawlee, starting with every Danish source. Work autonomously: implement adapters, run live comparisons, fix discrepancies, add regression tests, update migration evidence and status, and commit verified checkpoints. Do not declare Scrapy deprecated until the fail-closed readiness check genuinely passes.

## Handoff state

- Current Crawlee commit: `80419a3`
- Commit message: `feat: migrate Danish recipe scraping to Crawlee`
- The worktree was clean at handoff.
- Do not reset, rewrite, or discard existing history.
- The build passes.
- All 451 tests across 57 test files pass.
- Legacy inventory audits pass:
  - 235/235 Danish spiders are accounted for.
  - 88/88 Danish WPRM spiders are registered.
- Current source states:
  - 49 `canary_passed`
  - 47 `shadow_passed`
  - 32 `configured`
  - 105 `not_started`
  - 1 `deferred`
  - 1 `blocked`
- The next intended live comparison was `madrejsen`.
- Previous attempts to start that comparison were stopped by an execution/account limit, not a source failure. Check for stale processes and output before restarting.

## Read first

- `README.md`
- `docs/scrapy-deprecation-plan.md`
- `docs/danish-jsonld-migration-operations.md`
- `docs/crawlee-scheduler-operations.md`
- `src/danish-jsonld/source-registry.ts`
- `src/migration/deprecation-readiness.ts`
- `config/deprecation-evidence.example.json`

## Useful commands

```bash
npm run build
npm test
npm run audit:legacy-danish
npm run audit:legacy-wprm
npm run migration:status
npm run migration:readiness
npm run crawl:danish-jsonld -- --sources <source-id>
npm run probe:danish-source -- <inspect CLI options first>
npm run compare:wprm-probes -- <inspect CLI options first>
```

## Per-source acceptance requirements

1. Run an uncapped Crawlee crawl covering the complete current catalog.
2. Run the comparable isolated Scrapy spider, or directly exercise its parser when its legacy discovery endpoint is dead.
3. Compare recipe counts, canonical/source keys, and all material fields:
   - title
   - canonical URL
   - ingredients
   - instructions
   - preparation, cooking, and total times
   - yield
   - images
   - categories
   - cuisines
   - keywords
4. Fix real Crawlee extraction or discovery defects and add regression tests.
5. Run Crawlee at least twice and confirm stable keys, normalized output, and idempotent upserts.
6. Explain intentional improvements over Scrapy, such as complete pagination, richer yields, or retained cuisines.
7. Record HTTP blocking, rate limiting, retries, browser fallback, incomplete recipes, dead legacy endpoints, and other operational differences.
8. Promote the registry status only as far as the evidence supports.
9. Update `docs/scrapy-deprecation-plan.md` with concise full-catalog evidence.
10. Run the build, tests, both inventory audits, and readiness checks before committing.

## Important implementation context

- Custom Danish adapters are under `src/custom/`.
- Source registration and migration states are under `src/danish-jsonld/`.
- Legacy inventories are under `src/migration/` and `src/wprm/`.
- Probe parity logic is in `src/wprm/probe-parity.ts`.
- Operational scheduler and readiness code is under `src/operations/` and `src/migration/`.
- Some sites intermittently return HTTP 454/455. Use bounded retries, source-specific throttling, browser fallback, and cooldowns. Do not interpret one blocked run as extraction parity.
- Dead Scrapy listing URLs are not automatically a Crawlee failure. Find the current authoritative endpoint and compare representative current pages through the legacy parser when necessary.
- Preserve semantic text equivalence when comparing HTML entities and rendered taxonomy values.
- Never use a capped crawl as proof of discovery completeness.

Already validated examples include Kystfisken, Klank, Bare en Cocktail, Copenhagen Distillery DA, Gamle Opskrifter, Glyngøre, Bodylab, and many others documented in the deprecation plan. Do not redo these unless a regression or missing acceptance gate is discovered.

## Operational deprecation gates

These remain intentionally fail-closed:

- Production consumer and data-contract evidence
- Scheduler and monitoring deployment evidence
- Rollback validation
- Completed production observation window
- Final Scrapy retirement approval

The scheduler, health check, lease, run ledger, container assets, and runbooks exist, but actual deployment evidence, alert wiring, secrets, observation, and approval remain outstanding. Do not fabricate or mark these gates passed.

## Begin here

1. Confirm the repository state at commit `80419a3`, accounting for this handoff file if it has not yet been committed.
2. Run the local build, tests, and audits.
3. Inspect `madrejsen` in both registries and projects.
4. Run full Crawlee and Scrapy comparisons.
5. Implement and test any fixes.
6. Update status and evidence, then commit the verified checkpoint.
7. Continue through the remaining Danish sources instead of stopping after the first source.

Keep Scrapy intact as the production reference until all source and operational gates are backed by auditable evidence.
