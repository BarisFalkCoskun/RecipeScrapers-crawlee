# Shadow parity tooling

Compares one source's legacy Scrapy output to the RecipeDocument V2 records a
Crawlee run stored, which is the evidence a source needs to move from
`canary_passed` to `shadow_passed`.

```bash
bash tools/parity/shadow-parity.sh <source-id> [crawlee-db]
```

The legacy run replaces the production item pipelines with a capture-only
pipeline that writes a temporary file, so it performs no production write.

## Why a pipeline instead of `-O file.json`

Scrapy's feed exporter builds its URI params from every spider attribute. On the
browser-backed spiders that raises `AttributeError: __provides__`, the feed
never opens, and the run finishes with exit code 0 and no output — which reads
as "the legacy spider found nothing" rather than as a harness failure. Capturing
from a pipeline avoids the exporter entirely.

`RECIPE_FEED_EXPORT_ENABLED` is read from the environment, not from Scrapy
settings, so `-s RECIPE_FEED_EXPORT_ENABLED=0` silently does nothing; it has to
be exported or the default feed writes into `data/exports/` in the legacy
checkout.

## What the comparison normalizes

Seven differences are formatting rather than content, and every one is a place
where V2 keeps more of the source than legacy did. Comparing without
normalizing them reports false mismatches:

1. **Cuisines.** Legacy has no cuisine field. The WPRM family folds the cuisine
   into its flat tag list; the JSON-LD families drop it. V2 keeps it in
   `cuisines`, so legacy `tags` match V2 `keywords` either with the cuisines
   added back or without them.
2. **HTML entities.** Legacy leaves upstream entities encoded; V2 decodes them.
3. **Canonical URLs.** V2 drops the `www` prefix and the WPRM recipe-id
   fragment and sorts query parameters.
4. **WPRM named steps.** A step may carry a name. V2 keeps it as a
   `Name: body` prefix where legacy drops it.
5. **Zero-width characters.** Some sources embed them mid-string. V2 strips
   them; legacy keeps them. They must be removed rather than collapsed to a
   space, or the text reads as different.
6. **Inline markup.** Legacy keeps tags inside text fields where V2 stores the
   rendered text; a `<strong>` around a title is presentation, not content.
   Markup may be literal or entity-escaped, and a source can double-escape it —
   puredansk states a section heading as `&lt;strong&gt;Dej&lt;/strong&gt;` —
   so decoding and stripping run twice.
7. **Spacing left by punctuation and stripped tags.** Legacy joins a WPRM step
   name as `Name : body` where V2 uses `Name: body`, and removing an inline tag
   leaves a space before the punctuation or bracket that followed it.
7. **Yield.** Legacy reduces `recipeYield` to its leading integer and drops the
   unit, so `1.75 liter` becomes `1`. V2 keeps the published text. Where
   legacy's value is exactly the leading integer of V2's, it is the same yield
   with more of it preserved; anything else is a real difference.

Records are keyed by canonical URL **and** title, because a page can carry
several sibling Recipe nodes. Legacy stops at the first; extra V2 records
sharing a URL with a matched legacy record are reported as recovered siblings
rather than as a diverging record set.

The comparison exits non-zero when either side produced no records, so a failed
legacy run cannot be mistaken for a clean match.

## The two sides must be gathered close together in time

The comparison reads a Crawlee crawl out of MongoDB and runs the legacy spider
now. When those are days apart, anything the site edited in between reads as a
disagreement between the implementations.

inspiredtaste showed it plainly: legacy returned "Easy Fluffy Pancakes
(Perfected!)" and the stored Crawlee record said "Easy Fluffy Pancakes". Both
were faithful — the stored crawl was five days old, and the site had renamed
the recipe since. The page carries the newer title today.

Two records differing that way also split into four phantoms, because records
are keyed by URL *and* title, so a renamed recipe appears as one missing on
each side rather than one changed.

`tools/parity/fresh-parity.sh` does this properly: it re-crawls the source,
then runs the legacy spider, then compares, so both sides see the same site. Use
it rather than comparing against whatever is already stored.

The cost of not doing so is not subtle. culinaryginger moved its ingredient
amounts from `{amount:"2", unit:"teaspoons"}` to
`{amount:"2 teaspoons (8 grams)", unit:""}` three days after its crawl, and the
comparison reported seven differing ingredients that were nothing of the kind.
A whole batch of 31 near-equal sources came back mismatched for this reason.

## Concurrency changes the answer

Worker width is not free. Every worker shares one egress IP, and sites fronted
by a shared WAF rate-limit that IP across their whole customer base, so lanes
running against *different* domains still throttle each other. A throttled
legacy spider does not report a block: it records each blocked page as having
no recipe, or gives up after one redirect, and comes back looking simply
smaller.

The effect is large enough to invert a conclusion. `cakebycourtney` produced
**zero** records inside a ten-worker pool and **452** run on its own, minutes
apart. A sweep at that width scored 2 matches against 96 failures, which
described the pool rather than the sources.

So a legacy run that comes back empty or short is not evidence until it has
been repeated on its own. Treat a pooled result as a screen, and confirm every
failure serially at `LOG_LEVEL=INFO` before recording it — the block accounting
the harness prints is only meaningful when nothing else is competing for the
same IP.

The repeat-run pool is not affected the same way: those are Crawlee crawls at
each source's own configured delay and concurrency, and they bind on memory
rather than on what a site will serve one address.

## Records V2 refuses and legacy keeps

V2 holds a completeness contract most legacy spiders do not: a recipe needs a
name, ingredients and instructions to be stored at all. Legacy emits a Recipe
node missing any of them. mariavestergaard publishes five recipes with no
instructions and eight with no title, and legacy stores all thirteen — so its
598 against V2's 585 is the contract working, not a discovery gap.

These are reported as records legacy accepts without a name, ingredients or
instructions, rather than counted as loss. Anything V2 is missing that does not
fall in that category is a real gap and still fails the comparison.

## A cut-off legacy run is not a short one

`PARITY_SCRAPY_TIMEOUT` kills the spider mid-crawl, and its partial output is
indistinguishable from a site that simply has fewer recipes. nogetiovnen looked
like it had been blocked down to 374 records against Crawlee's 3,102; run on
its own it made 829 requests, every one of them HTTP 200, and was still going
when the timeout stopped it at 734. There was no block at all — only a large
catalogue and a deadline.

The harness now reports a timed-out run as inconclusive rather than comparing
its partial output, and the timeout should be raised for a source whose
catalogue is large rather than left to truncate it.

## When the legacy spider is unhealthy

A legacy run that is being blocked, or that is pointed at a domain the site has
since left, is not a sound comparison — its lower count says nothing about what
the site publishes. Those sources take the documented legacy-unhealthy route
instead of parity: discovery proven complete against the live listing contract,
two complete uncapped runs whose second upserts rather than duplicates, and a
manual read of stored records.

```bash
node tools/parity/read-stored.cjs <database> <source-id> [count]
```

It reports how many records were read and how many are clean, and names what is
wrong with any that are not. It flags a duration over 69 days for checking
rather than rejecting it, because a long one can be real: one source states a
ninety-day steeping time.

## Runs that get cut short

Legacy items are written as JSON Lines and flushed per item, so a run killed by
`PARITY_SCRAPY_TIMEOUT` still leaves everything it had collected. The reader
drops a trailing partial line and says so. A short legacy run is still a failed
comparison — the record sets will not agree — but it reports which records it
did get instead of failing to parse at all. Raise `PARITY_SCRAPY_TIMEOUT` for a
source whose legacy spider needs longer than the 2400s default.
