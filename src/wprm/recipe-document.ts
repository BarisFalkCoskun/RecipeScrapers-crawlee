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

const plainText = (value: unknown): string => {
  const source = text(value);
  if (source === "") return "";
  return cheerio.load(source).text().replace(/\s+/gu, " ").trim();
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
      const head = [text(entry.amount), text(entry.unit), text(entry.name)]
        .filter((part) => part !== "")
        .join(" ");
      if (head === "") continue;
      const notes = text(entry.notes);
      lines.push(notes === "" ? head : `${head} (${notes})`);
    }
  }
  return lines;
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
      const heading = text(entry.name).replace(/[:\s]+$/u, "");
      steps.push({
        position: steps.length + 1,
        text: heading === "" ? body : `${heading}: ${body}`,
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
  return {
    title: text(recipe.name),
    ...(plainText(recipe.summary) === "" ? {} : { description: plainText(recipe.summary) }),
    ingredients: flattenIngredients(recipe.ingredients),
    instructions: flattenInstructions(recipe.instructions),
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

function tagNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => isRecord(entry) ? text(entry.name) : "")
    .filter((entry) => entry !== "");
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
