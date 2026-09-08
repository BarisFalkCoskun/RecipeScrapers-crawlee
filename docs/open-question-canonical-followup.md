# Open question: following a canonical to a page that has no recipe

samvirke publishes 1944 recipe URLs on `samvirke.dk` and stores 1086 in V2.
Legacy stores 1944. The 858-record gap is not discovery and not extraction —
it is V2 doing what the page tells it to.

## What the site does

Every `samvirke.dk/opskrifter/<slug>` page answers 200 with a complete recipe
and declares a canonical on a different host:

```
samvirke.dk/opskrifter/forloren-hare-med-bacon
  -> opskrifter.coop.dk/opskrifter/forloren-hare-8258
samvirke.dk/opskrifter/groenkaalspesto-0
  -> opskrifter.coop.dk/opskrifter/groenkaalspesto-til-10-personer-8159
```

V2 follows the declared canonical and stores the coop.dk page. Every one of its
1086 stored records has a `pageUrl` on `opskrifter.coop.dk`, all from a single
run, and `canonical-followup` fires throughout. Legacy stays on samvirke.dk.

## Why that loses records

**Roughly 40% of the canonical targets are a placeholder.** Sampling 8 canonicals
on 2026-09-08: five served a full page carrying Recipe JSON-LD (38–59 KB) and
three served an identical 22,023-byte page with no `"Recipe"` anywhere in it.
The identical byte count across three unrelated URLs is what identifies it as a
placeholder rather than three coincidental failures.

A 5-in-8 success rate predicts about 1215 of 1944; V2 stored 1086. Close enough
that placeholder canonicals account for the gap, without needing a second cause.

## What was ruled out first

- **Not undersized discovery.** The sitemap's two pages carry 1263 + 681 = 1944
  URLs matching the source's recipe pattern, exactly legacy's record count, and
  the run reports 1946 candidates.
- **Not the candidates-never-fetched defect.** `completedRequests` is 3910,
  about twice the candidate count, which is each samvirke URL plus its canonical
  follow-up. The pages were fetched.
- **Not canonical aliasing.** The first hypothesis was that many samvirke slugs
  collapse onto one coop recipe. Fourteen sampled URLs produced fourteen distinct
  canonicals and no collisions, so a 44% collapse by aliasing is ruled out.

## The decision this needs

Honouring a page's declared canonical is right in general — it is what stops the
same recipe being stored under several URLs, and it is what made pillsbury's
comparison work. Here it throws away a recipe that was in hand, because the site
points at a page that does not have one.

The narrow repair is a fallback: when the canonical target yields no recipe and
the page actually fetched does, keep the fetched page's recipe. That is a change
to the crawler's canonical-followup path, and it needs a test that pins both
directions — the fallback firing here, and *not* firing where the canonical
target is the better record.

Nothing in the run says any of this. Outcome was `succeeded` with zero failed,
zero blocked and zero rejected: the pages that yielded nothing fall into no
bucket, the same blind spot recorded in
docs/open-question-candidates-never-fetched.md.

**Until it is decided, samvirke cannot be compared meaningfully** — the two sides
hold records on different hosts, so the comparator pairs almost nothing.
