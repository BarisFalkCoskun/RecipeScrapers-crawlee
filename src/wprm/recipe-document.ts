import type { NormalizedRecipeV2, NormalizedRecipeInstruction } from "../types.js";

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
  sourceRecipeKey: string;
  /** The exact API object, never the normalized copy. */
  rawRecipe: Record<string, unknown>;
  normalized: NormalizedRecipeV2;
}

export interface WprmExtractionResult {
  recipes: WprmExtractedRecipe[];
  incompleteCount: number;
  malformedCount: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const minutes = (value: unknown): number | undefined => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

/**
 * Ingredients arrive grouped, and each entry keeps amount, unit, name and
 * notes apart. Rejoining them is what makes the line readable, and the notes
 * follow a comma the way the rendered recipe shows them.
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
      lines.push(notes === "" ? head : `${head}, ${notes}`);
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
      const body = text(entry.text);
      if (body === "") continue;
      // A named step is a section heading in the rendered recipe; keeping it
      // in the step text is the only way to carry it in this shape.
      const heading = text(entry.name);
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
  return {
    title: text(recipe.name),
    ...(text(recipe.summary) === "" ? {} : { description: text(recipe.summary) }),
    ingredients: flattenIngredients(recipe.ingredients),
    instructions: flattenInstructions(recipe.instructions),
    ...(minutes(recipe.prep_time) === undefined ? {} : { prepMinutes: minutes(recipe.prep_time) }),
    ...(minutes(recipe.cook_time) === undefined ? {} : { cookMinutes: minutes(recipe.cook_time) }),
    ...(minutes(recipe.total_time) === undefined ? {} : { totalMinutes: minutes(recipe.total_time) }),
    ...(yieldText === "" ? {} : { yieldText }),
    imageUrls: image === "" ? [] : [image],
    categories: [],
    cuisines: [],
    keywords: [],
  };
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
    const canonicalUrl = text(post.link);
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
      sourceRecipeKey: canonicalUrl,
      rawRecipe: recipe,
      normalized,
    });
  }

  return result;
}
