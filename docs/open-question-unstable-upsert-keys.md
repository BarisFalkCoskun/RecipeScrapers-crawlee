# Open question: what a recipe's identity is across runs

`sourceRecipeKey` is the upsert key. When it changes between runs for the same
recipe, the crawl inserts a second document instead of updating the first, and
the store grows while every run reports a clean, complete count. Two causes have
been found. One is fixed; the other is written down here rather than changed,
because the fix costs more than the defect.

## Fixed: a URL `@id` carrying the visitor's marketing query string

`createSourceRecipeKey` hashes `sourceId`, `canonicalUrl`, the Recipe `@id` and
a discriminator. oetker publishes `@id` as the page URL with a marketing query
string attached, and the `fbclid` in it is different on every request:

```
run 2026-08-30T02-10  @id=https://www.oetker.dk/opskrifter/r/banankage
run 2026-08-30T11-46  @id=...banankage?utm_source=meta&...&fbclid=PAcGRvZgJleHRu...
run 2026-08-30T13-58  @id=...banankage?utm_source=meta&...&fbclid=IwcGRvZgVleHRu...
```

Seven of its recipes held two or three documents, one per run, while each run
reported 806 persisted from 806 candidates with discovery complete and nothing
failed, blocked or rejected. Nothing in the run summary could show it: the run
was clean. Only grouping the store by `canonicalUrl` and counting distinct
`crawlRunId` values surfaced it.

`stripTrackingParams` now removes those parameters from a URL `@id` before it is
hashed. It is deliberately not `canonicalizeUrl`, which would also lowercase the
host, drop `www`, sort the query and trim a trailing slash: that would re-key
every record whose `@id` merely spells its URL differently, making a large
duplicate insert to fix a small one. A URL with nothing to strip comes back
byte-identical, so only the unstable `@id`s move.

Measured across the store, oetker was the only source affected: of 148,285
documents in `relost_20260829`, seven URL groups held documents from more than
one run, all oetker. The WPRM and spisbedre builders key on the upstream numeric
post id and cannot drift this way.

**The nine existing duplicates are still there.** They were written under the
old keys, so the next run will not update them - it will insert a tenth
document with the stable key and then upsert onto it forever after. Pruning
them is a data deletion and has not been done.

## Not fixed: the positional page discriminator

Where a page carries several recipes and none of them declares an `@id`, the
crawler distinguishes them by position:

```ts
pageRecipeDiscriminator: `recipe-${recipeIndex + 1}`   // crawler.ts
```

That is stable only while the page's recipe order is. frederikkewaerens has 11
url+title groups holding two documents each across two runs - the same recipe,
re-keyed because its position on the page moved.

The obvious repair is to key on the recipe's own name, falling back to position
only to separate identically-named recipes on one page. It is not being made
now:

- It re-keys **every** record on a multi-recipe page, not just the ones that
  moved. In `relost_20260829` alone that is bertolli 284, sundpaabudget 62,
  greedygourmet 20, bakingamoment 9, familyfreshmeals 6, bobedre 3. Each becomes
  one stale document plus one new insert on the next crawl.
- Several of those sources are already `shadow_passed` on evidence gathered
  under the current keying, so the re-key would invalidate comparisons that are
  currently sound.
- The observed damage is 11 records in one source. The repair's blast radius is
  roughly 400.

**What would settle it:** whether the positional drift is rare (11 records, a
page that was edited once) or steadily accumulating. Grouping each JSON-LD
database by `canonicalUrl` + `normalized.title` and counting distinct
`crawlRunId` values answers it; run that after the next full sweep and compare
against the 11 recorded here on 2026-09-03. If it is still 11, leave it. If it
is growing, the re-key is worth its cost and should be done once, deliberately,
with the stale documents pruned in the same operation.

## Why this matters beyond two sources

Idempotency is one of the two shadow-parity gates, and the gate reads the store
before and after a run. A store that only ever grows cannot fail that gate by
losing records - it fails by gaining them, and a gain looks like the site
publishing something new. Both defects here produced exactly that appearance.
Any future repeat-run verdict should be read with `crawlRunId` in hand, not just
the before and after counts.
