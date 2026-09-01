# Open question: custom sources cannot carry their own migration state

Found 2026-09-01, with three sources ready to promote and no place to say so.

## The gap

`DANISH_JSONLD_SOURCES` is composed as:

```ts
export const DANISH_JSONLD_SOURCES = [
  ...RAW_DANISH_JSONLD_SOURCES.map((source) => ({
    ...source,
    ...LEGACY_DISCOVERY_OVERRIDES[source.id],
    ...CURRENT_SOURCE_OVERRIDES[source.id],   // <- per-source state lives here
    ...
  })),
  ...NEW_DANISH_WP_POSTS_SOURCES,
  ...CUSTOM_DANISH_JSONLD_SOURCES,           // <- spread after the map
  ...CUSTOM_DANISH_LISTING_JSONLD_SOURCES,
  ...EMBEDDED_DANISH_RECIPE_SOURCES,
];
```

The custom families are spread *after* the mapped block, so
`CURRENT_SOURCE_OVERRIDES` never reaches them. Their `migrationState`,
`latestCanary` and `deferOrBlockReason` come from one shared literal applied to
every source in the family, which is why they all still read "Bounded live
probe ..." however many uncapped runs they have had since.

## What it is holding up

Three custom sources finished clean uncapped runs on 2026-09-01 and cannot be
moved off `configured`:

| source | run |
| --- | --- |
| webopskrifter | 3819 recipes from 3819 candidates over 3824 requests, outcome "succeeded", nothing failed, blocked or rejected |
| beetrootbakery | 318 from 341 over 343, outcome "succeeded", nothing rejected |
| vegetariskhverdag | 32 from 42 over 44, nothing failed or blocked, 2 incomplete rejections |

Each would be `canary_passed` today if its state could be written.

## The fix, and why it is not in this commit

Give the custom families the same treatment the mapped block gets - either
spread them through a `.map` that applies `CURRENT_SOURCE_OVERRIDES`, or add a
`CUSTOM_SOURCE_EVIDENCE_OVERRIDES` map keyed by id and merged in each family's
own literal.

The first is tidier and changes how four families are built; the second is
narrower and adds a fifth override map to a registry that already has five. It
is a structural choice with 1012 sources downstream of it and both legacy
inventory audits asserting against the result, so it wants doing deliberately
rather than at the end of a long session with three crawls running.
