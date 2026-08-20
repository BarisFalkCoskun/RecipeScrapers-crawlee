# Scrapy deprecation plan

The Scrapy checkout remains the production reference until every gate below is
backed by recorded evidence. Merely registering a source, passing unit tests, or
completing one bounded canary does not qualify it for cutover.

`npm run migration:readiness` is the fail-closed retirement check. It resolves
legacy command aliases to their canonical Crawlee source, reports every state
and blocker, and exits successfully only when all inventoried Danish spiders
are registered and effectively at `cutover` and every operational gate has
auditable evidence. Supply the completed evidence document with:

```bash
npm run migration:readiness -- \
  --operational-evidence config/deprecation-evidence.production.json
```

Start from `config/deprecation-evidence.example.json`; never mark a gate passed
without a durable deployment, run, dashboard, change, or approval reference.

## Scope and inventory

- [ ] Every legacy spider is inventoried by source ID, family, locale, endpoint,
  transport, throttling, and operational owner.
- [x] All 88 Danish-locale `WprmApiSpider` subclasses are registered in Crawlee.
  `npm run audit:legacy-wprm` checks the registry directly against the sibling
  Scrapy checkout and fails on additions, removals, or configuration drift.
- [x] The live Danish audit accounts for all 235 Danish-locale spiders. The
  standardized JSON-LD, WordPress-posts, WPRM, and custom adapter lanes currently
  register all 235; `npm run audit:legacy-danish` reports zero remaining spiders
  and exits successfully.
- [ ] Each Danish custom spider family is fully validated or explicitly
  retired with a documented reason and consumer approval.
- [ ] International sources are inventoried and migrated after the Danish lane.

## Completed full-catalog evidence

- [x] `aperol`: three uncapped Crawlee runs and a full isolated Scrapy run
  produced the same sole recipe, with complete discovery, no operational
  failures, and exact material-field parity.
- [x] `ferrerorocher`: three uncapped Crawlee runs and the complete Scrapy run
  produced the same three recipes with exact material-field parity. The shadow
  exposed literal HTML entities in JSON-LD ingredients; the shared normalizer
  now decodes them while retaining the untouched raw payload.
- [x] `friluftslageret`: both runtimes traversed all 17 current candidates and
  emitted the same sole complete recipe. Every legacy field matches; Crawlee
  additionally retains `recipeCuisine=Outdoor`, which Scrapy drops. The source
  itself currently publishes pizza Recipe data under its fajitas URL, and both
  runtimes faithfully expose that upstream mismatch.
- [x] `campari`: three Crawlee runs stably produced seven complete recipes. The
  two records emitted by the full Scrapy run match every material field;
  Crawlee recovers five additional complete sibling Recipe nodes from a page
  where Scrapy keeps only the first. Both reject the same incomplete cocktail.
- [x] `cocktaily`: three Crawlee runs and the full Scrapy run produced the same
  36 recipes with exact required-field parity. Crawlee intentionally retains
  upstream `1 serving` yields rather than Scrapy's numeric-only `1`, and retains
  `recipeCuisine`, which the legacy item schema does not represent.
- [x] `evatrio`: three Crawlee runs and the full Scrapy run each completed 92
  requests over 218 listing occurrences and 88 unique pages, producing the same
  28 recipes while the other 60 pages contained no Recipe JSON-LD. Required
  fields match after fixing shared normalization of zero durations, embedded
  HTML, and comma-separated categories; Crawlee retains full yield text and
  cuisines that Scrapy truncates or drops.
- [x] `glutenfrimagi`: three Crawlee runs and the full browser-backed Scrapy run
  traversed the same 15 candidates, emitted the same eight recipes, rejected
  the same seven non-recipe pages, and matched every material field. The latest
  Crawlee run cleared an initial HTTP 454 check on a bounded in-session retry.
- [x] `foodnotes`: three Crawlee runs and the full Scrapy run emitted the same
  13 recipes with exact legacy-field parity and rejected the same five
  incomplete recipe pages. Rejection metrics now count only the terminal
  rendered attempt, while V2 intentionally retains full yields and cuisines.
- [x] `parcelhuslykke`: three uncapped Crawlee runs and the full Scrapy run
  completed the same 12 requests and emitted the same 11 recipes. Every legacy
  material field matches; Crawlee additionally preserves the complete yield
  text and `recipeCuisine` values that Scrapy truncates or drops.
- [x] `knaehoejkarse`: three uncapped browser-backed Crawlee runs and the full
  Scrapy run traversed the same 13 candidates, emitted the same 12 recipes,
  excluded the same non-recipe page, and matched every material field.
- [x] `semper`: three uncapped Crawlee runs and the full Scrapy run completed
  the same 26 requests and emitted the same 25 recipes. Legacy fields match
  after supporting its `text/plain` recipe HTML, top-level string instructions,
  Danish duration text such as `1 time`, and equivalent `www`/bare image hosts;
  Crawlee intentionally retains complete yield ranges and units.
- [x] `violife`: three uncapped Crawlee runs and the full Scrapy run completed
  the same 29 requests, emitted the same 28 recipes, and matched every material
  field exactly without an operational failure.
- [x] `kornkammeret`: three uncapped Crawlee runs and the full Scrapy run emitted
  the same 33-recipe catalog with exact URLs, titles, ingredients, instructions,
  times, images, and taxonomy. Crawlee retains full yield labels on 20 records
  where Scrapy stores only the first integer.
- [x] `nescafe`: three uncapped Crawlee runs and the full Scrapy run traversed
  the same 36 candidate pages, emitted the same 34 recipes, and excluded the
  same two listing pages. All legacy fields match after comparing rendered
  ingredient text and dropping an empty trailing `HowToStep` UI placeholder;
  Crawlee retains upstream `Serving` units that Scrapy discards.
- [x] `recipesairfryer_dk`: three uncapped Crawlee runs and the full Scrapy run
  followed all eight listing pages, emitted the same 47 recipes, rejected the
  same two non-recipe articles, and matched every legacy field. Crawlee retains
  full yield labels on eight records where Scrapy stores only the first integer.
- [x] `nutella`: four uncapped Crawlee runs and the full Scrapy run traversed
  the same 58 candidates, emitted the same 55 recipes, rejected the same three
  campaign pages, and matched every legacy field after preserving inline HTML
  text adjacency around markup such as `Nutella<sup>®</sup>`. Crawlee retains
  complete yield units on 22 records that Scrapy truncates.
- [x] `ketomums`: two current uncapped Crawlee runs emitted byte-identical
  50-record outputs and source keys, confirming three recipes added since the
  retained runs. The full Scrapy run emitted the same 50 URLs and every legacy
  field matched; Crawlee retains the complete yield labels Scrapy truncates.
- [x] `beauvais`: two uncapped Crawlee runs and the full Scrapy run completed
  both source sitemaps and the same 71 requests, emitted the same 69 recipes,
  and matched every material field exactly.
- [x] `hannerobinson`: two uncapped Crawlee runs and the full Scrapy run
  traversed the same 69 candidates, emitted the same two recipes, and agreed
  that 67 pages contain no Recipe JSON-LD. Legacy fields match; Crawlee retains
  complete yield labels and the published Danish/Italian cuisines.
- [x] `frokenkraesen_com`: two uncapped Crawlee runs and the full Scrapy run
  completed the same 57 requests over 56 candidates, emitted the same 51
  recipes, and excluded the same four non-recipe pages plus one redirect
  duplicate. Legacy fields match except for intentionally richer yield labels.
- [x] `kagerogsager`: two uncapped-equivalent Crawlee traversals naturally
  completed all 13 Shopify listing pages, storing the same 115 complete recipes
  with no request, extraction, storage, or domain failures. All nine recipes
  discoverable by the legacy spider match every material field. Crawlee recovers
  106 additional recipes because the legacy spider ignores Shopify's
  `link[rel=next]` pagination. The sole non-recipe article is a paid-recipe
  purchase notice with no Recipe JSON-LD, ingredients, or instructions.
- [x] `madforfattigroeve`: two current-backend GraphQL crawls stored the same
  complete 588-recipe catalog with identical records and no operational
  failures. The retired legacy numeric sitemap now returns 404 and Scrapy emits
  no data; representative current recipe pages agree with the GraphQL records.
- [x] `nipunijulie`: two complete Crawlee traversals covered all 233 sitemap
  candidates and emitted the same stable 140 recipe keys. A full isolated
  Scrapy run emitted the same 140 URLs, and every material field matched after
  correcting legacy handling for parenthetical-only ingredient notes. The 93
  remaining sitemap entries are ordinary posts that satisfy neither parser's
  complete-recipe contract.
- [x] `gunris`: the uncapped WordPress API crawl and full Scrapy run emitted
  the same five recipes, and all material fields match exactly after applying
  the legacy family's numeric-only yield contract.
- [x] `bedstedrinks`: two current uncapped Crawlee runs emitted identical
  80-recipe outputs and stable source keys, confirming 20 recipes added since
  the retained canary. The full Scrapy run emitted the same 80 URLs and every
  material field matched exactly.
- [x] `gigtforeningen`: the 70 former recipe routes now redirect to the site
  homepage and the legacy sitemap run failed. The public WordPress API still
  carries all authoritative post bodies; a dedicated Crawlee adapter paged all
  222 posts and extracted the same 70 complete recipes in two runs, with
  identical source keys and normalized records and no operational failures.
- [x] `madformadelskere`: two Crawlee outputs contained the same 72 recipes
  with identical keys and normalized content. The first run exposed four false
  404s caused by normalizing working trailing-slash/www URLs before fetching;
  request admission now preserves the discovered wire URL while deduplicating
  by canonical identity, and the uncapped rerun completed all 113 requests
  cleanly. The 71 full-run Scrapy records plus its directly parsed 72nd page
  match every legacy field; Crawlee additionally retains `recipeCuisine`.
- [x] `schulstad`: two post-fix uncapped Crawlee runs and the full Scrapy run
  completed the same 95 requests and emitted the same 94 recipes. Embedded
  newlines inside two `recipeIngredient` array elements are now treated as
  presentation whitespace rather than extra ingredients. All legacy fields
  match, while Crawlee retains full yield labels on 61 records where Scrapy
  stores only the first integer.
- [x] `jonsmadklub`: two post-fix uncapped Crawlee runs and the full Scrapy run
  completed the same 112 requests and emitted the same 106 recipes with exact
  material-field parity. The shared JSON-LD normalizer now retains numeric
  `recipeYield` values instead of silently dropping them; both corrected
  Crawlee outputs have identical source keys and normalized records.
- [x] `kystfisken`: two current uncapped Crawlee runs completed all 145
  requests and emitted the same 136 recipes with identical source keys and
  normalized records. The full Scrapy run emitted the same catalog and every
  material field matches; its one escaped HTML category is equivalent to
  Crawlee's clean rendered text. Both parsers reject the same incomplete page.
- [x] `klank`: two uncapped Crawlee browser runs and the full Scrapy browser
  run completed the same 74 requests, emitted the same 52 recipes, and rejected
  the same two incomplete pages. All material fields match exactly, and the
  Crawlee repeats have identical source keys and normalized records.
- [x] `glyngoere`: two clean uncapped Crawlee browser runs emitted identical
  74-record keys and normalized data, and the full Scrapy run matched every
  material field. Both reject the same incomplete page. After two source-level
  blocked attempts, a longer cooldown let the repeat clear HTTP 454 on its
  first in-session retry; Crawlee finished in 188 seconds versus Scrapy's 483.
- [x] `bareencocktail`: two uncapped Crawlee browser runs and the full Scrapy
  browser run emitted the same 81 recipes, rejected the same incomplete Clover
  Club page, identified the same three non-recipe category pages, and matched
  every material field. Crawlee cleared one initial HTTP 454 in-session on the
  first run; the retry-free repeat produced identical keys and normalized data.
- [x] `copenhagendistillery_da`: two uncapped Crawlee runs produced identical
  87-record keys and normalized data, and the full Scrapy run emitted the same
  recipes with exact material-field parity. Both implementations reject the
  same incomplete Scorpio Punch page and completed without terminal failures.
- [x] `gamleopskrifter`: the legacy listing route now returns 404, while two
  current sitemap-backed Crawlee runs completed 117 requests and emitted the
  same 116 recipes with identical keys and normalized data and no operational
  failures. Direct legacy parsing of five representative current pages matched
  every material field after semantic decoding of escaped taxonomy values.
- [x] `bodylab`: two uncapped Crawlee runs traversed all ten current listing
  pages and emitted identical 149-recipe keys and normalized data across 175
  responses without operational failures. Scrapy stopped after the first
  visible-anchor window and emitted 29 recipes; every overlapping recipe and
  material field matches exactly. Crawlee rejects one incomplete page.

- [x] Thirty-nine WPRM sources cleared full shadow parity: `frukreativ`,
  `minopskrift`, `nemlchf`, `madskribent`, `sundmor`, `jensensmadblog`,
  `johanjohansen`, `gastry`, `chilisauce`, `bondemad`, `twinfood`,
  `italienskvinogmad`, `airfryermad`, `camillemaja`, `cookingclub`, `altmad`,
  `fuldkorn`, `rigeligtsmor`, `veganernu`, `vielskermad`, `mariasilje`,
  `albertestengaard`, `juliebruun`, `planteaederen`, `pilenskoekken`, `drkoch`,
  `annamaddk`, `newyorkerbyheart`, `muttionline`, `emmaolsen`, `hverdagsro`,
  `frahaventilmaven`, `onekitchenblog`, `madogkaerlighed`, `gastromad`,
  `opskriftorg`, `louisesmadblog`, `marialottes`, and `opskriftnet`. Two
  uncapped Crawlee runs each emitted identical keys and
  normalized content with idempotent upserts, and the full isolated Scrapy run
  emitted the same recipes with every material field matching, from 9 records on
  `minopskrift` to 1,408 on `opskriftnet` — 13,193 records in total. Five differences are
  formatting rather than content and are intentional: Crawlee keeps the
  published cuisine in `cuisines` instead of folding it into legacy's flat tag
  list, decodes upstream HTML entities, and canonicalizes URLs by dropping the
  `www` prefix and the WPRM recipe-id fragment and sorting query parameters.
  The fourth is the WPRM named-step prefix: a step may carry a name, and Crawlee
  keeps it as a `Name: body` prefix where legacy drops it, on 136 `cookingclub`
  records and one `drkoch` record. `bondemad` and `frukreativ` each carry a
  multi-recipe page, and both implementations emit every sibling recipe from it.
  The legacy `pilenskoekken` spider emitted nothing on its first run after its
  robots preflight answered HTTP 403 and emitted all 71 on the repeat, so that
  comparison rests on the healthy legacy run.
  The fifth difference is zero-width characters, which some sources embed
  mid-string: Crawlee strips them and legacy keeps them, which is the same
  visible text.
- [ ] `airfryerkogebogen` is the one WPRM source still short of shadow parity.
  Its uncapped Crawlee run persisted the whole 4,930-record catalog cleanly, but
  the source then began answering HTTP 500 to every request at both page sizes
  and two legacy runs gave up on page 1. The comparison waits for the source to
  recover rather than being retried against it.

- [x] Five Danish WordPress-posts sources cleared full shadow parity: `hoerup`
  (38), `madopskriften` (146), `opskriftslageret` (159), `nemmadplan` (32), and
  `veganermor` (298) — 673 records. `dittejulie` (386 records) and `madhang`
  (55) crawl cleanly but stay `configured` on their own counts, and `mummum`
  still needs its full catalog run. Each of the five had discovered
  nothing at all before the rendered
  JSON viewer document was unwrapped, so these comparisons are what confirm
  that fix rather than a clean run alone. Legacy has no cuisine field for this
  family, so V2's cuisines are purely additive — 143 of madopskriften's records
  carry one — and `hoerup` additionally recovers four sibling recipes from a
  five-recipe New Year's menu page that legacy reduces to one.

## Family sweeps

Two families were swept uncapped end to end, which closed the last sources that
had never been run. No Danish source is `not_started` any more.

- [x] WPRM family (86 sources): 40 reached a clean uncapped canary and 11 of
  those went on to full shadow parity against Scrapy; 41 are short of a canary
  on records the sites themselves publish incomplete or malformed, 3 are
  unreachable, and 2 have a `wprm_recipe` collection that is now empty while
  the sites still publish posts carrying WPRM markup — for those two the legacy API route no longer
  exposes the recipes, so a re-route is outstanding rather than a deferral for
  lack of content.
- [x] Danish WordPress-posts family (9 sources): 5 clean canaries, 2 short of
  one, and 2 closed at the source — `hverdagsgourmet` restricts its REST API
  (HTTP 401 `itsec_rest_api_access_restricted`) and
  `madopskriftertilairfryer` answers HTTP 500 with the WordPress critical-error
  page site-wide, homepage included. Both legacy spiders read the same
  endpoints, so neither implementation can reach those sources today.

Three defects surfaced during the sweep and were fixed with regression tests:

1. Chromium renders a JSON URL inside its own viewer document, so the nine
   browser-fetched WordPress-posts sources received HTML wrapping the payload
   in a `<pre>` and rejected every listing as a malformed payload. All nine had
   discovered nothing; unwrapping the viewer document recovered them, and
   `madopskriften` and `opskriftslageret` went from 0 to 146 and 159 recipes.
   The legacy spiders avoid the same trap by reading `document.body.innerText`.
2. The simply.com WAF serves one interstitial under HTTP 454 and, intermittently,
   under HTTP 500. Only 454/455 counted as a browser check, so the 500 spelling
   was recorded as a failed request and never retried. The body now decides when
   the status is a bare 5xx, bounded by the same retry budget, and a genuine
   server error stays a failure.
3. `koudahl` answers `per_page=100` with HTTP 500 and an empty body, so the
   source discovered nothing. WPRM page size is now per-source; at 50 the run
   persists 329 of 331 records.

Two blocked runs cleared on a later attempt without any code change —
`planteaederen` (36 recipes) and `dagenstallerken` (517) — and
`airfryerkogebogen` completed its full 4930-record catalog once a transient
HTTP 500 on page 46 cleared. One blocked run is not a source verdict.

## Source acceptance gate

Each source must satisfy all of these conditions before its registry state can
advance to `cutover`:

1. A bounded live Crawlee canary persists complete recipes with no unintended
   off-domain admission, malformed payload, or unexplained failed request.
2. An isolated Scrapy comparison run uses the same source and comparable page
   window. Raw counts and normalized required fields are compared.
3. Two repeat Crawlee runs demonstrate stable source keys and idempotent upserts.
4. Discovery completeness is established without an artificial page cap. A
   capped probe is evidence of extraction health only, never completeness.
5. Material field parity is accepted: title, canonical URL, ingredients,
   instructions, times, yield, images, categories, cuisines, and keywords.
   Differences must be either fixed or explicitly documented as intentional.
6. Blocking, rate limiting, browser fallback, retries, and source-specific
   throttling have observable outcomes and a bounded failure mode.

## Operational cutover gate

These five groups map directly to the machine-readable operational gates in
the retirement evidence document. Missing evidence, a false status, an empty
reference, or an invalid observation timestamp keeps readiness closed even if
every source registry entry says `cutover`.

- [ ] Crawlee writes the production collection/schema expected by downstream
  consumers, or all consumers have been migrated to RecipeDocument V2.
- [ ] Schedulers, alerts, dashboards, run reports, secrets, deployment manifests,
  and runbooks invoke Crawlee rather than Scrapy.
  The replacement scheduler, heartbeat health check, single-instance lease,
  durable attempt ledger, container manifest, and rollback runbook now exist in
  this repository. Deployment, alert wiring, secret injection, and an observed
  production run remain outstanding.
- [ ] A rollback procedure can restore the last Scrapy schedule without data
  loss during the observation window.
- [ ] Crawlee runs through at least one agreed observation window with no
  unresolved correctness or reliability regression.
- [ ] Scrapy is frozen against new source work, its credentials are removed from
  active jobs, and the repository is archived only after consumer sign-off.

## Safe live-test policy

Live probes are deliberately source-scoped and page-capped. Crawlee probes use
the in-memory `npm run probe:danish-wprm` path and a temporary
`CRAWLEE_STORAGE_DIR`; they do not require MongoDB. Scrapy probes must export to
an isolated temporary file and disable production item pipelines. Broad crawls
or production writes are not part of a probe.

## Current retirement status

Scrapy cannot yet be deprecated. Crawlee covers all 235 Danish spiders at the
registry level, every one of the 314 registered sources now carries evidence
from a live run rather than an assumed state, and the registry stands at 91
`shadow_passed`, 86 `canary_passed`, 117 `configured`, 11 `blocked`, and 9
`deferred`. Full-catalog evidence is now recorded for Aperol, Beauvais,
Bornholms, Campari, Cocktaily, Eva Trio, Ferrero Rocher, FoodFanatic, Foodnotes,
Friluftslageret, Frøken Kræsen, Glutenfri Magi, Hanne Robinson, Kager og Sager,
Ketoliv, Mad for Fattigrøve, Ketomums, Knæhøj Karse, Kornkammeret, Nescafé,
Nipuni Julie, Nutella,
Parcelhuslykke, RecipesAirfryer.dk, ScandiKitchen, Semper, Sydhavnsbloggen, and
Violife, but
most sources still need uncapped comparable live evidence. Bornholms matched all 11 unique
current recipes and every material field (the legacy spider emits one
query-string duplicate), but an intervening browser session remained on HTTP
454 through all retries, so it still needs production retry monitoring.
Sydhavnsbloggen's full 42-recipe output exactly matched Scrapy after the hybrid
path cleared its listing challenge. ScandiKitchen matched all 109 API records,
including seven sibling recipes sharing two page URLs, and FoodFanatic matched
all 504 complete records while both implementations rejected the same incomplete
upstream record. Ketoliv matched all 578 complete records on required fields;
Crawlee deliberately retains named-step prefixes that Scrapy discarded on 69
records. TheFoodClub's intermittent 454/455
protection now clears through the hybrid browser-escalation path but still needs
an uncapped run, and production consumers and schedulers have not been cut over.
