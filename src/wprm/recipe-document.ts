import * as cheerio from "cheerio";
import type {
  NormalizedRecipeV2,
  NormalizedRecipeInstruction,
  RecipeDocumentV2,
} from "../types.js";
import { hashRecipe } from "../utils/hash.js";

/**
 * WP Recipe Maker serves whole recipes from its REST API, so unlike the
 * JSON-LD sources there is no page to fetch and no markup to parse: the
 * listing response already carries every field. The completeness contract is
 * the same one the JSON-LD path enforces — a recipe needs a name, ingredients
 * and instructions — so a source cannot pass by publishing emptier records
 * through a different transport.
 */
export interface WprmExtractedRecipe {
  canonicalUrl: string;
  /** The exact API object, never the normalized copy. */
  rawRecipe: Record<string, unknown>;
  normalized: NormalizedRecipeV2;
}

export interface WprmExtractionResult {
  recipes: WprmExtractedRecipe[];
  incompleteCount: number;
  malformedCount: number;
}

export interface BuildWprmRecipeDocumentV2Input {
  sourceId: string;
  crawlRunId: string;
  crawlAttemptId: string;
  apiPageUrl: string;
  extractedAt: Date;
  recipe: WprmExtractedRecipe;
  language: string;
  languageConfidence: number;
  languageSignals: string[];
  extractorVersion: string;
  extractionSignals: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/**
 * Zero-width characters are invisible and sources embed them mid-word: krumpli
 * writes "A\uFEFFdd a lid" inside an instruction. They match \s, so collapsing
 * whitespace turns that into "A dd" — a visibly broken word. They are removed
 * before the collapse rather than becoming spaces.
 */
const plainText = (value: unknown): string => {
  const source = text(value);
  if (source === "") return "";
  // A block boundary is a word boundary. Taking the text content directly
  // concatenates the blocks, so a note written across two paragraphs comes back
  // with its sentences fused: dansktang ends one ingredient note "...ved at
  // lægge det.</p><p>Stykkerne skal..." and that reads as "det.Stykkerne".
  // Turning the boundary into a space first keeps the two sentences apart,
  // and the whitespace collapse below removes any doubled space it creates.
  const separated = source
    .replace(/<br\s*\/?>/giu, " ")
    .replace(/<\/(?:p|div|li|ol|ul|h[1-6]|section|article|table|tr|td|th)\s*>/giu, " ");
  return cheerio.load(separated).text()
    .replace(/[\u200B-\u200D\uFEFF]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
};

const minutes = (value: unknown): number | undefined => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

/**
 * Ingredients arrive grouped, and each entry keeps amount, unit, name and
 * notes apart. Rejoining them is what makes the line readable. Parentheses
 * retain the legacy WPRM adapter's exact `original` field contract so a
 * Crawlee cutover does not silently rewrite ingredient text.
 */
function flattenIngredients(groups: unknown): string[] {
  if (!Array.isArray(groups)) return [];
  const lines: string[] = [];
  for (const group of groups) {
    if (!isRecord(group) || !Array.isArray(group.ingredients)) continue;
    for (const entry of group.ingredients) {
      if (!isRecord(entry)) continue;
      // Ingredient parts carry markup on some sources, and instructions were
      // already rendered down while these were not. connoisseurusveg links an
      // ingredient through an affiliate plugin that mints a fresh
      // data-lasso-id on every request, so the raw anchor made the record
      // differ between two crawls of identical data - idempotency it could
      // never satisfy, and markup no consumer of an ingredient wants.
      const head = [plainText(entry.amount), plainText(entry.unit), plainText(entry.name)]
        .filter((part) => part !== "")
        .join(" ");
      if (head === "") continue;
      const notes = plainText(entry.notes);
      lines.push(notes === "" ? head : `${head} (${notes})`);
    }
  }
  return lines;
}

// A source can predate the WPRM fields the rest of this file reads and keep its
// recipe in custom fields instead. theinspiredhome publishes an empty
// `ingredients` and `instructions` on 661 of its 1117 records while the text
// sits in `custom_fields.old_ingredients` and `old_instructions` as an HTML
// list; without this those records look like upstream stubs and are rejected,
// which is what the legacy spider's use_legacy_custom_fields flag exists to
// avoid. List items carry one entry each, and a source that wrote paragraphs
// instead is read the same way.
function legacyHtmlTexts(value: unknown): string[] {
  const source = text(value);
  if (source === "") return [];
  const $ = cheerio.load(source);
  const items = $("li").length > 0 ? $("li") : $("p");
  const out: string[] = [];
  items.each((_index, node) => {
    const entry = plainText($.html(node));
    if (entry !== "") out.push(entry);
  });
  return out;
}

function flattenInstructions(groups: unknown): NormalizedRecipeInstruction[] {
  if (!Array.isArray(groups)) return [];
  const steps: NormalizedRecipeInstruction[] = [];
  for (const group of groups) {
    if (!isRecord(group) || !Array.isArray(group.instructions)) continue;
    for (const entry of group.instructions) {
      if (!isRecord(entry)) continue;
      const body = plainText(entry.text);
      if (body === "") continue;
      // A named step is a section heading in the rendered recipe; keeping it
      // in the step text is the only way to carry it in this shape. Headings
      // are authored both with and without a trailing separator, and the
      // rendered recipe shows one either way.
      //
      // Not every name is a heading, though. frommybowl fills `name` with the
      // step's own body and puts the labelled version in `text`, so prefixing
      // it produced "Preheat the oven...: Prep: Preheat the oven..." with the
      // whole instruction written twice.
      //
      // What separates that from a real heading is proportion, not containment:
      // a heading is a short label over a longer body ("For the sauce" against a
      // paragraph), while this name *is* the body. Testing containment alone
      // would drop any heading whose words happen to recur in its own step,
      // which measured across the promoted WPRM sources would have rewritten
      // 358 of 494 rather than the handful this is meant to catch.
      const heading = plainText(entry.name).replace(/[:\s]+$/u, "");
      const repeated = heading !== "" && body.includes(heading) &&
        heading.length >= body.length / 2;
      steps.push({
        position: steps.length + 1,
        text: heading === "" || repeated ? body : `${heading}: ${body}`,
      });
    }
  }
  return steps;
}

function normalize(recipe: Record<string, unknown>): NormalizedRecipeV2 {
  const servings = text(recipe.servings) || (typeof recipe.servings === "number" ? String(recipe.servings) : "");
  const servingsUnit = text(recipe.servings_unit);
  const yieldText = [servings, servingsUnit].filter((part) => part !== "").join(" ");
  const image = text(recipe.image_url);
  const tags = isRecord(recipe.tags) ? recipe.tags : {};
  const customFields = isRecord(recipe.custom_fields) ? recipe.custom_fields : {};
  // Only where the standard fields came back empty: a source that fills both
  // says what it means in the current shape, and the old fields on such a
  // record are stale copies rather than the recipe.
  let ingredients = flattenIngredients(recipe.ingredients);
  if (ingredients.length === 0) ingredients = legacyHtmlTexts(customFields.old_ingredients);
  let instructions = flattenInstructions(recipe.instructions);
  if (instructions.length === 0) {
    instructions = legacyHtmlTexts(customFields.old_instructions)
      .map((step, index) => ({ position: index + 1, text: step }));
  }
  return {
    title: text(recipe.name),
    ...(plainText(recipe.summary) === "" ? {} : { description: plainText(recipe.summary) }),
    ingredients,
    instructions,
    ...(minutes(recipe.prep_time) === undefined ? {} : { prepMinutes: minutes(recipe.prep_time) }),
    ...(minutes(recipe.cook_time) === undefined ? {} : { cookMinutes: minutes(recipe.cook_time) }),
    ...(minutes(recipe.total_time) === undefined ? {} : { totalMinutes: minutes(recipe.total_time) }),
    ...(yieldText === "" ? {} : { yieldText }),
    imageUrls: image === "" ? [] : [image],
    categories: tagNames(tags.course),
    cuisines: tagNames(tags.cuisine),
    keywords: tagNames(tags.keyword),
  };
}

/**
 * WPRM taxonomies are unordered term sets, and the WordPress API does not
 * guarantee an order for them: giangiskitchen returned the same keywords in a
 * different sequence on consecutive requests, so 473 of its 549 records looked
 * changed between two runs that had extracted exactly the same data. Sorting
 * makes the stored record depend on what the source says rather than on the
 * order it happened to say it in.
 */
function tagNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => isRecord(entry) ? text(entry.name) : "")
    .filter((entry) => entry !== "")
    .sort((left, right) => left.localeCompare(right, "da"));
}

/** Chromium renders JSON documents inside a `<pre>` element. */
export function parseWprmApiResponseBody(body: string): unknown | undefined {
  const candidates = [body];
  if (/^\s*</u.test(body)) {
    const $ = cheerio.load(body);
    candidates.push($("pre").first().text(), $("body").text());
  }
  for (const candidate of candidates) {
    const value = candidate.trim();
    if (value === "") continue;
    try {
      return JSON.parse(value);
    } catch {
      // Try the next representation of the same response.
    }
  }
  return undefined;
}

export function extractWprmRecipes(payload: unknown): WprmExtractionResult {
  const result: WprmExtractionResult = { recipes: [], incompleteCount: 0, malformedCount: 0 };
  if (!Array.isArray(payload)) {
    result.malformedCount += 1;
    return result;
  }

  for (const post of payload) {
    if (!isRecord(post) || !isRecord(post.recipe)) {
      result.malformedCount += 1;
      continue;
    }
    const canonicalUrl = text(post.link) || text(post.recipe.link);
    if (canonicalUrl === "") {
      // Without the post's own link there is no canonical URL to key on, and
      // guessing one would attach the recipe to a page that may not exist.
      result.malformedCount += 1;
      continue;
    }

    const recipe = post.recipe;
    const normalized = normalize(recipe);
    if (
      normalized.title === "" ||
      normalized.ingredients.length === 0 ||
      normalized.instructions.length === 0
    ) {
      result.incompleteCount += 1;
      continue;
    }

    result.recipes.push({
      canonicalUrl,
      rawRecipe: recipe,
      normalized,
    });
  }

  return result;
}

export function buildWprmRecipeDocumentV2(
  input: BuildWprmRecipeDocumentV2Input
): Omit<RecipeDocumentV2, "_id"> {
  const rawRecipe = structuredClone(input.recipe.rawRecipe);
  const normalized = structuredClone(input.recipe.normalized);
  const upstreamId = text(rawRecipe.id) || (
    typeof rawRecipe.id === "number" ? String(rawRecipe.id) : ""
  );
  const sourceRecipeKey = `${input.sourceId}:${hashRecipe({
    sourceId: input.sourceId,
    canonicalUrl: input.recipe.canonicalUrl,
    upstreamId: upstreamId || null,
  })}`;

  return {
    schemaVersion: 2,
    sourceId: input.sourceId,
    sourceRecipeKey,
    canonicalUrl: input.recipe.canonicalUrl,
    pageUrl: input.apiPageUrl,
    crawlRunId: input.crawlRunId,
    crawlAttemptId: input.crawlAttemptId,
    createdAt: input.extractedAt,
    updatedAt: input.extractedAt,
    extractedAt: input.extractedAt,
    language: input.language,
    languageConfidence: input.languageConfidence,
    languageSignals: [...input.languageSignals],
    extractionMethod: "wprm-api",
    extractorVersion: input.extractorVersion,
    extractionConfidence: 1,
    extractionSignals: [...input.extractionSignals],
    rawRecipe,
    normalized,
    sourceHash: hashRecipe(rawRecipe),
    contentHash: hashRecipe(normalized as unknown as Record<string, unknown>),
    contentMatches: [],
  };
}
