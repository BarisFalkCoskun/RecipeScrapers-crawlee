# Open question: the idempotency gate cannot see a blocked run

Found 2026-08-31, while one step from promoting blenderopskrifter.

## The gap

`tools/parity/repeat-queue.sh` decides STABLE or CHANGED by dumping the record
store before and after a second uncapped run and comparing keys and content.
The store **accumulates**: an upsert never deletes, so a record written by the
first run survives whether or not the second run reached its page. A run that
was blocked on a page therefore still reports nothing lost.

blenderopskrifter passed that gate — `CHANGED 217->223`, nothing lost, no
duplicate keys, and the six additions verified as recipes the site published
between the runs. Its own counters said something else: `blockedRequests: 14`
of 238, all 429, at `delaySeconds: 10` with `maxConcurrency: 1`. Fourteen pages
were never read. Its sibling diabetesopskrifter, same publisher, was blocked on
22 of 195 at the same pace. Both are recorded and both had their pace raised to
20s rather than their shortfall written off.

## What is not yet known

Whether any already-promoted source rests on a second uncapped run that was
itself degraded. Their reasons commonly say "two uncapped runs reproduced all N
keys with identical content", and that clause was never checked against the
second run's `blockedRequests`, `failedRequests` or `discoveryComplete`.

**A first pass at this was attempted and its output is not trustworthy**, so no
number from it is recorded here. Several sources have more than one run summary
on disk with different counters, and scanning `/tmp/repeat-storage` and
`/tmp/recrawl-storage` picks up whichever file the glob returns first: two runs
of the same scan disagreed about whether gimmesomeoven's repeat was STABLE or
CHANGED, and about how many sources were implicated at all. A table built that
way would look like evidence and would not be any.

Twelve sources were wrongly withdrawn on 2026-08-28 by acting on a signal like
this before checking it individually. That is the failure mode to avoid here.

## How to do it properly

1. Fix the gate first, so new evidence does not have the hole. Two changes are
   staged in the session scratchpad: treat an addition as the site publishing
   rather than a defect, and fold the run's own observations into the verdict so
   a blocked or incomplete run cannot report STABLE.
2. Identify each promoted source's repeat run **by run id**, from the
   `latestCanary` and `shadowParity` evidence in the registry, rather than by
   whichever file happens to be named after the source. Where the run summary is
   not on disk any more, the honest answer is that the check cannot be made from
   what is kept, and the source needs a fresh repeat run rather than a verdict.
3. Read the log before judging any counter: an upstream 404 on a dead sitemap
   URL is not a crawler failure, while a 403 or 429 is a page never read.
4. Move a source back only where the second run demonstrably read less than the
   source publishes, and name the counter that moved it in the reason.
