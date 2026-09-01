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
to a real number.

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
