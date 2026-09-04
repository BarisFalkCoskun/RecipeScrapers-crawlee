# Open question: candidates discovered, counted, and never fetched

pillsbury's 2026-09-03 re-crawl reports itself clean and is not:

```
discoveredRecipeCandidates 2287
processedRecipePages       2273
persistedRecipes           2271
completedRequests          2280
failedRequests                0
blockedRequests               0
rejected* (all six)           0
discoveryComplete          true
pageCapReached            false
```

Six of the 2280 completed requests are the sitemap index and its five
children, so 2274 recipe pages were fetched against 2287 admitted candidates.
**Thirteen candidates were never requested, and nothing in the run says so.**

The discovery events account for every admitted URL and reject none:

```
sitemap.xml                     accepted 6    rejected 0
sitemap.xml?type=site           accepted 0    rejected 607 (pattern-mismatch)
sitemap.xml?type=recipe&page=1  accepted 500  rejected 0
                        page=2  accepted 500  rejected 0
                        page=3  accepted 500  rejected 0
                        page=4  accepted 500  rejected 0
                        page=5  accepted 287  rejected 0
```

500 × 4 + 287 = 2287. So the loss is between admission and the request queue.

## What it costs

Compared against a legacy run made the next day, V2 holds 2269 records and
legacy 2284, with **15 legacy-only and 0 crawlee-only**. All 15 are live, all
15 are in the sitemap, and their uuids are stable — measured, not assumed:
across the 2269 slugs both sides share, 2269 have byte-identical uuids and none
rotated. So these are not a URL-form artifact. They are recipes the crawl was
told about and did not fetch.

## What it is not

Tested and excluded on 2026-09-04:

- **Not duplicate sitemap entries.** Fetched back to back, the five pages yield
  2287 entries and 2287 distinct URLs.
- **Not request-key normalisation.** The 2287 remain 2287 under
  case-insensitivity, trailing-slash insensitivity, and both together.
- **Not a page cap or a failure.** `pageCapReached` is false and every failure
  and rejection counter is zero.

## What it might still be

- **A shifting sitemap.** The run took about two hours at one request every
  three seconds. If the site inserts recipes at page 1 while pages 2-5 are
  being read, entries slide across page boundaries and some are never listed
  on any page the crawl saw. Against this: the queue is FIFO and the index
  enqueues all five children before page 1's recipes, so all five should have
  been read within the first twenty seconds.
- **A request queue persisted between runs**, so URLs seen by an earlier run
  are treated as already handled. Against this: that would drop far more than
  thirteen.

## Why it matters more than thirteen records

`discoveredRecipeCandidates` is the number the promotion bar reads as "what the
source offered". If admitted candidates can vanish before the queue with every
counter reading clean, then "discovery complete, nothing failed, nothing
rejected" does not mean the crawl fetched what it found — on any source, not
only this one. pillsbury is where it happened to be visible, because it has a
healthy legacy run to disagree with.

**What would settle it:** re-crawl pillsbury and compare
`discoveredRecipeCandidates` against `completedRequests` minus the sitemap
fetches. If the gap reappears at roughly thirteen, it is systematic and the
enqueue path is where to look. If the run comes back with 2287 fetched, the
first run lost them to something transient and the counter still needs to say
so rather than reporting a clean run.

## Related

A second defect found the same day and already fixed: `run-crawl-lane.sh` did
not pin `DB_NAME`, so five re-crawls inherited `crawlee` from `.env` and wrote
9062 documents into the scratch database while every comparison tool went on
reading the `crawlee_danish_jsonld_*` database each source lives in. The runs
were real and their counts were right; the evidence simply was not where
anything would look for it, and pillsbury and landolakes were compared against
two-day-old data with nothing saying so. The lane now requires a database per
queue line and skips a line that omits one. The misplaced data turned out to be
useful — one clean uncapped run per source with no accumulation — and
landolakes compared against it matches legacy exactly, 2776/2776 on every
material field, where the stale store had shown 47 differences.
