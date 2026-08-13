# Task 2 implementation report

## Scope delivered

- Added an isolated `RecipeDocumentV2` migration path with source-key identity, raw JSON-LD provenance, normalized recipe fields, and content-match auditing.
- Added strict complete-JSON-LD extraction that preserves exact script bodies separately from parsed recipe nodes.
- Added V2 Mongo persistence in `recipes_v2`: unique `sourceRecipeKey`, deliberately non-unique `contentHash`, and deterministic same-/cross-source match records.
- Added source outcome classification and a V2 run summary that always records `robotsEnforced: false`.
- Kept the legacy crawler API and its `recipes` collection unchanged; no live crawl or external MongoDB mutation was run.

## Files changed

- `src/config.ts`
- `src/types.ts`
- `src/storage/store.ts`
- `src/storage/mongodb.ts`
- `src/danish-jsonld/recipe-document.ts`
- `src/danish-jsonld/source-outcome.ts`
- `tests/storage/mongodb.test.ts`
- `tests/storage/mongodb-v2.test.ts`
- `tests/danish-jsonld/recipe-document.test.ts`
- `tests/danish-jsonld/source-outcome.test.ts`

## Assumption audit and diagnostics

The pre-change diagnostic considered seven possible migration failures:

1. Legacy extraction normalizes/mutates the parsed JSON-LD recipe node.
2. Page records have no place for exact compressed JSON-LD script bodies.
3. The in-memory store keys recipes by `contentHash`.
4. Mongo's legacy recipe collection has a unique `contentHash` index.
5. No V2 schema or deterministic source identity exists.
6. Crawl summaries only expose aggregate metrics, not source outcomes.
7. Existing full-HTML storage rules must not be broadened by this V2 path.

The two most likely contract breaks were (1) losing raw provenance during normalization and (2) collapsing same/cross-source content under the unique legacy content hash. The read-only diagnostic logged those exact pre-change locations:

```text
diagnostic=task2-prechange
src/extractors/json-ld.ts:34:      normalizeRecipe(recipe, signals)
tests/helpers/memory-crawl-store.ts:18:    this.recipes.set(recipe.contentHash, recipe);
src/storage/mongodb.ts:48:    await this.recipes.createIndex({ contentHash: 1 }, { unique: true });
```

V2 therefore uses its own `recipes_v2` migration collection and `upsertRecipeV2`, preserving current crawler behavior until the later crawler-factory task opts in.

## Red/green evidence

1. `npm test -- tests/danish-jsonld/recipe-document.test.ts tests/danish-jsonld/source-outcome.test.ts`
   - Red: both suites failed because `recipe-document.js` and `source-outcome.js` did not exist.
2. `npm test -- tests/danish-jsonld/recipe-document.test.ts tests/danish-jsonld/source-outcome.test.ts tests/storage/mongodb-v2.test.ts`
   - Red: V2 modules remained absent; `store.upsertRecipeV2 is not a function`; no V2 identity index was created.
3. Same targeted command after the minimal implementation, followed by `npm run build`
   - Green: 19 tests passed; TypeScript build passed after one literal-union annotation correction.
4. `npm test`
   - Initial regression: the existing Mongo fake bypassed `connect()` and had no injected V2 collection.
   - Green after updating that test-only double: 23 files / 138 tests passed.

## Final verification

- `npm test` — passed: 23 test files / 138 tests.
- `npm run build` — passed (`tsc`).
- `git diff --check` — passed with no whitespace errors.

## Commit

`dec4d47e47b4724ee37d04cf0bbf2c4954fdc25d` (`feat: add Danish JSON-LD recipe v2 persistence`)

## Self-review

- `rawRecipe` is a clone of the `JSON.parse` recipe node, while normalization is stored separately.
- Exact script bodies are preserved before decoding/parsing and compressed independently for `PageDocument.rawJsonLdScripts`.
- Complete V2 recipes require a Recipe type, title, ingredients, and instructions; malformed and incomplete scripts are rejected with distinct stable reasons.
- Source identity includes source ID, canonical URL, upstream `@id` (when present), and stable normalized identity.
- The V2 upsert key is only `sourceRecipeKey`; content matches are retained as audit records and never cause a drop.
- All five outcomes and all six zero-item non-`no_data` conditions are covered by tests.

## Concerns

- `recipes_v2` is intentionally isolated from the legacy `recipes` collection. The later crawler integration must explicitly call `upsertRecipeV2` and write `rawJsonLdScripts` onto its page document.
- Outcome classification is pure and typed; crawler counters must be wired into `SourceRunObservation` by the later crawler task.
- `robotsEnforced: false` is explicit in V2 summary construction; crawler-factory enforcement is intentionally not implemented here.
