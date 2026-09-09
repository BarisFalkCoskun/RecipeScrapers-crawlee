# Open question: V2 requires instructions, legacy mostly does not

Found 2026-09-01 while re-examining the deferred list.

## The difference

V2 stores a recipe only if it has a name, at least one ingredient **and** at
least one instruction - `isCompleteRecipe` in `src/danish-jsonld/recipe-document.ts`.

Legacy's base spider defaults to `require_ingredients = False` and
`require_instructions = False`. **141 of its 1014 spiders opt into requiring
instructions. The other 873 do not**, so legacy stores a recipe with ingredients
and no method wherever a site publishes one.

## What it costs

Three sources are deferred entirely on this, having produced no V2 records at
all while legacy's spider for each would keep them:

| source | legacy spider requires instructions? | V2 outcome |
| --- | --- | --- |
| tillamook | no | 592 of 593 pages rejected as incomplete |
| edmonds_nz | no | 559 of 589 pages rejected as incomplete |
| netto | no | Recipe JSON-LD omits ingredients and instructions |

tillamook was checked by hand: `/recipes/hot-honey-cheddar-dates` publishes a
Recipe node with 5 `recipeIngredient` entries and `recipeInstructions: null`,
and no other instruction-shaped key. The site really does omit the method from
its structured data, and legacy really would keep the record.

Beyond those, **37 sources carry a named allowance in their reason for records
legacy accepts and V2 rejects on this rule, 150 records in total** - 25 on
buildyourbite, 14 on bobsredmill, 13 on mariavestergaard, 28 on chelsea_nz, and
so on down to single records. Those were each read and accepted individually as
an intentional difference, which is defensible one record at a time and adds up
to a real number. gastrofun adds a further 17, verified as a class by the WPRM
completeness walk rather than named one by one.

### The total, counted rather than estimated

| bucket | records |
| --- | --- |
| tillamook (deferred, whole source) | 592 |
| edmonds_nz (deferred, whole source) | 559 |
| 37 named allowances across promoted and configured sources | 150 |
| gastrofun (explainer-verified class) | 17 |
| **subtotal** | **1318** |
| netto (deferred, whole source) | not counted - its reason gives no ratio |

Earlier revisions of this document and two commit messages put the figure at
"roughly 1150" and "roughly 1170". Both were low: the first predated gastrofun
and the second was adjusted from the first by memory rather than recounted. The
table above is generated from the reasons themselves and should be regenerated
rather than adjusted whenever it is quoted again.

## Why this is not mine to decide

Relaxing the contract would change what "complete" means for all 851 sources
already promoted, and their evidence was gathered under the current rule. That
is a change to the migration's definition of done, not a bug fix.

The options, as they look from here:

1. **Keep the contract.** Scrapy cannot be retired for tillamook, edmonds_nz and
   netto without losing their whole catalogue, and the migration accepts a
   ~1150-record shortfall against legacy overall. Those three should then be
   `blocked` with this reason rather than `deferred`, because the sources do
   publish recipes - we decline to store them.
2. **Match legacy per source.** Mirror each legacy spider's own
   `require_instructions` flag, which is what the parity comparison is measured
   against anyway. This is the smallest change that makes V2 a faithful
   replacement, and it would need every affected source re-crawled and
   re-compared.
3. **Relax the contract everywhere.** Simplest to implement and the worst of the
   three: it would admit instruction-less records on sources where legacy
   deliberately opted into requiring them.

Option 2 is the one that matches the stated goal - replace Scrapy without losing
coverage - but it is a decision about what the migration is for, so it is
recorded here rather than acted on.

## Comparing a stale store against a fresh legacy run (2026-09-08)

Measured across every remaining canary: the stored side is between 3.7 and 9.6
days old, and the legacy side is minutes old in every comparison. Everything the
site published, renamed or removed in that window reads as a record V2 failed to
find.

That is not hypothetical. Four sources were investigated one at a time before the
pattern was named:

- **landolakes** showed 46 category differences and 3 crawlee-only records. The
  categories were an editorial collection that had rotated off, and one of the
  three now redirects to /404/. Re-crawled and compared the same day: 2776/2776,
  every material field matching.
- **gastrofun** appeared to drop a Danish comma-decimal ingredient, `0,5 liter
  Piskefløde`. The live API carries it and our own extractor keeps it; the site
  had corrected the record after the crawl.
- **theroastedroot** was held on two legacy-only records published 2026-09-04 and
  2026-09-06 against a store written 2026-09-01. After a re-crawl, only_legacy
  went 2 -> 0.
- **theforkedspoon** was held on one record the site had renamed. A URL-and-title
  key reads a rename as one record lost and one gained. After a re-crawl,
  only_legacy went 1 -> 0.

**The order was wrong, not the tooling.** Comparing first and investigating the
difference costs a round per source and usually ends at "the site changed".
Re-crawling first costs one crawl and ends at a verdict. All 25 remaining stale
canaries are queued for a re-crawl ahead of their next comparison.

`legacy-halt-check.sh` now prints the store's age in its verdict line so the
question is asked before the investigation starts, and `fresh-parity.sh` already
exists for the re-crawl-then-compare pairing - it was previously avoided as
wasteful, which is right for a same-window store and wrong for a nine-day-old
one.

**What would make this unnecessary:** nothing, while sites keep changing. The
useful discipline is that a comparison is only as good as the age gap between
its two sides, and that gap should be stated wherever a verdict is recorded.

## Legacy's own pagination caps three sources (2026-09-09)

`WprmApiSpider` in the legacy project hardcodes `per_page=100`
(danish_recipes/spiders/base.py:981). That is the page size these three sites
answer with HTTP 200 and an empty body on one page in the middle of the range:

    thechunkychef     empty at page 4   legacy reaches  300 of  992
    yourhomebasedmom  empty at page 4   legacy reaches  300 of 1280
    tasteandtellblog  empty at page 17  legacy reaches 1600 of 1747

V2 was capped identically until its start URLs were halved to `per_page=50`, at
which point all three walked their whole catalogue. Legacy cannot: the page size
is not configurable per spider, so its counts are a floor set by its own
pagination rather than by the source.

**This is not the legacy-unhealthy route.** There is no block, no 403 and no
challenge — legacy reports `finished` with a truncated set and no error, so
`legacy-halt-check.sh` will correctly find no block evidence and return
NOT-ELIGIBLE. The right evidence for these three is an ordinary comparison read
with the cap stated: every record legacy produced must be present in V2 with no
material field differing, and the surplus is V2 reaching pages legacy's page
size cannot request.

Worth stating plainly because it cuts the other way from most findings here:
1,817 records that legacy structurally cannot reach are exactly the kind of gap
the migration exists to close.
