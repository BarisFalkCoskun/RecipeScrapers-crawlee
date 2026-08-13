# Final branch fix report

Date: 2026-08-13
Baseline: `3436cdd`

## Pre-fix root-cause assessment

Seven plausible sources were checked before production changes:

1. the generated registry copied attributes but not executable discovery behavior;
2. generic listing parsing did not implement legacy continuation selectors;
3. generic JSON traversal accepted malformed or unexpected listing payloads;
4. HTTP 200 challenge shells were treated as successful discovery pages;
5. loaded and canonical URLs were not rechecked against the source allowlist;
6. identity/parity logic collapsed mutable or multiple recipe records;
7. dedicated evidence and queue resources were not bound to one exact run/attempt.

The two most likely shared causes are (1) an under-specified typed source contract
and (2) missing validation/ownership at final persistence, comparison, and queue
boundaries.

### Legacy discovery audit evidence

A read-only Python AST audit matched all 99 registry IDs to their legacy spider
classes. It found the shared listing continuation selectors `a.next`,
`a.page-numbers.next`, and `link[rel=next]`; REMA's `a.sr-only`; KitchenAid's
numbered listing recursion; Klank's cuisine/category recursion; five listing
skip-path overrides; seven sitemap skip-pattern overrides; and five restricted
sitemap-follow rules. Ferrero Rocher is the only custom JSON listing parser.

The production diagnostic contract will expose stable discovery parse, shape,
block, redirect, canonical, and queue-cleanup reasons without emitting payloads,
credentials, or full proxy URLs.

## Implemented repair

- Added typed listing and sitemap strategies covering every audited legacy
  discovery override, executed generically without source-ID branches.
- Made malformed/unexpected JSON listing payloads and HTTP 200 block shells
  fail closed with stable outcome reasons and bounded diagnostics.
- Rejected off-domain loaded and canonical URLs before extraction/persistence.
- Removed mutable normalized content from `sourceRecipeKey`; multi-recipe pages
  without upstream IDs use a deterministic positional discriminator.
- Validated evidence before database reads and scoped `recipes_v2` to exact
  source IDs plus `crawlRunId`; added the supporting compound index.
- Replaced canonical-URL maps with per-URL recipe multiset/count comparison.
- Redacted full `socks`, `socks4`, and `socks5` URLs in arbitrary strings and
  structured provenance.
- Dropped both unique attempt queues in `finally`; bounded cleanup diagnostics
  do not overwrite the already-computed source outcome.

The permanent robots-off invariant remains untouched and truthfully reported as
observed/unknown because its separate safety block must not be retried.

## TDD and final verification

Targeted tests were first observed failing for the missing typed discovery
strategies (7 failures), SOCKS proxy redaction (3 failures), queue cleanup (zero
drop calls), and missing `sourceRecipeKey` cohort validation (unexpected
resolution). Each focused group passed after its production change.

Fresh whole-branch verification on 2026-08-13:

- `npm run build`: passed (`tsc`)
- `npm test`: passed (33 files, 272 tests)
- `git diff --check`: passed

No live network, browser, crawl, or MongoDB probe was run, as required. The
remaining operational checks are the separately safety-blocked robots invariant
and a future authorized shadow/canary run against real sources and MongoDB.
For multi-recipe pages without upstream IDs, positional identity assumes the
page keeps a deterministic JSON-LD recipe ordering.
