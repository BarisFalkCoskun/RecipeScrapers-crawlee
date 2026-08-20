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

## Runs that get cut short

Legacy items are written as JSON Lines and flushed per item, so a run killed by
`PARITY_SCRAPY_TIMEOUT` still leaves everything it had collected. The reader
drops a trailing partial line and says so. A short legacy run is still a failed
comparison — the record sets will not agree — but it reports which records it
did get instead of failing to parse at all. Raise `PARITY_SCRAPY_TIMEOUT` for a
source whose legacy spider needs longer than the 2400s default.
