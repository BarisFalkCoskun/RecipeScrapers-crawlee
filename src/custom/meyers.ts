import * as cheerio from "cheerio";
import type { NormalizedRecipeV2 } from "../types.js";
import type { EmbeddedRecipeExtraction } from "./spisbedre.js";

export const MEYERS_SANITY_API =
  "https://dbvg5cs2.api.sanity.io/v2021-10-21/data/query/production";

export const MEYERS_GROQ_QUERY = `
*[_type == "recipe"] | order(title asc) {
  _id, title, slug, description, name, prepTime, cookTime, setting, publishedAt,
  tags[]->{name, slug, category},
  settingUnit->{name, singular, plural},
  ingredientGroups[]{
    title,
    ingredients[]{
      amount, beforeText, afterText,
      ingredient->{name, slug},
      unit->{name, singular, plural, abbreviation}
    }
  },
  instructions[]{title, steps},
  tips,
  image{alt, asset->{url}}
}
`;

export const MEYERS_SANITY_URL =
  `${MEYERS_SANITY_API}?query=${encodeURIComponent(MEYERS_GROQ_QUERY)}`;

export interface MeyersExtraction {
  recipes: NonNullable<EmbeddedRecipeExtraction["recipe"]>[];
  incompleteCount: number;
  malformedCount: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const source = String(value).trim();
  return source === "" ? "" : cheerio.load(source).text().replace(/\s+/gu, " ").trim();
};

const positiveNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

function ingredientsFrom(groups: unknown): string[] {
  if (!Array.isArray(groups)) return [];
  const ingredients: string[] = [];
  for (const group of groups) {
    if (!isRecord(group) || !Array.isArray(group.ingredients)) continue;
    for (const entry of group.ingredients) {
      if (!isRecord(entry)) continue;
      const ingredient = isRecord(entry.ingredient) ? entry.ingredient : {};
      const unit = isRecord(entry.unit) ? entry.unit : {};
      const name = text(ingredient.name);
      if (name === "") continue;
      const line = [
        text(entry.beforeText),
        text(entry.amount),
        text(unit.abbreviation ?? unit.name),
        name,
        text(entry.afterText),
      ].filter(Boolean).join(" ");
      if (line !== "") ingredients.push(line);
    }
  }
  return ingredients;
}

function instructionsFrom(groups: unknown): NormalizedRecipeV2["instructions"] {
  if (!Array.isArray(groups)) return [];
  const instructions: NormalizedRecipeV2["instructions"] = [];
  for (const group of groups) {
    if (!isRecord(group) || !Array.isArray(group.steps)) continue;
    const section = text(group.title);
    for (const rawStep of group.steps) {
      const step = text(rawStep);
      if (step === "") continue;
      instructions.push({
        position: instructions.length + 1,
        text: section === "" ? step : `${section}: ${step}`,
      });
    }
  }
  return instructions;
}

function tagsFrom(values: unknown): { categories: string[]; keywords: string[] } {
  const categories: string[] = [];
  const keywords: string[] = [];
  if (!Array.isArray(values)) return { categories, keywords };
  for (const value of values) {
    if (!isRecord(value)) continue;
    const name = text(value.name);
    if (name === "") continue;
    const target = text(value.category) === "meal" ? categories : keywords;
    if (!target.includes(name)) target.push(name);
  }
  return { categories, keywords };
}

function normalizeRecipe(rawRecipe: Record<string, unknown>):
  NonNullable<EmbeddedRecipeExtraction["recipe"]> | undefined {
  const slugValue = isRecord(rawRecipe.slug) ? rawRecipe.slug.current : undefined;
  const slug = text(slugValue);
  const title = text(rawRecipe.title);
  if (slug === "" || title === "") return undefined;

  const ingredients = ingredientsFrom(rawRecipe.ingredientGroups);
  const instructions = instructionsFrom(rawRecipe.instructions);
  if (ingredients.length === 0 || instructions.length === 0) return undefined;

  const tags = tagsFrom(rawRecipe.tags);
  const prepMinutes = positiveNumber(rawRecipe.prepTime);
  const cookMinutes = positiveNumber(rawRecipe.cookTime);
  const totalMinutes = prepMinutes !== undefined && cookMinutes !== undefined
    ? prepMinutes + cookMinutes
    : undefined;
  const settingUnit = isRecord(rawRecipe.settingUnit) ? rawRecipe.settingUnit : {};
  const yieldText = [
    text(rawRecipe.setting),
    text(settingUnit.plural ?? settingUnit.singular ?? settingUnit.name),
  ].filter(Boolean).join(" ");
  const image = isRecord(rawRecipe.image) ? rawRecipe.image : {};
  const asset = isRecord(image.asset) ? image.asset : {};
  const imageUrl = text(asset.url);
  const description = text(rawRecipe.description);
  return {
    canonicalUrl: `https://www.meyers.dk/opskrifter/${slug}`,
    rawRecipe,
    normalized: {
      title,
      ...(description === "" ? {} : { description }),
      ingredients,
      instructions,
      ...(prepMinutes === undefined ? {} : { prepMinutes }),
      ...(cookMinutes === undefined ? {} : { cookMinutes }),
      ...(totalMinutes === undefined ? {} : { totalMinutes }),
      ...(yieldText === "" ? {} : { yieldText }),
      imageUrls: imageUrl === "" ? [] : [imageUrl],
      categories: tags.categories,
      cuisines: [],
      keywords: tags.keywords,
    },
  };
}

export function extractMeyersRecipes(body: string): MeyersExtraction {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return { recipes: [], incompleteCount: 0, malformedCount: 1 };
  }
  if (!isRecord(payload) || !Array.isArray(payload.result)) {
    return { recipes: [], incompleteCount: 0, malformedCount: 1 };
  }
  const recipes: MeyersExtraction["recipes"] = [];
  let incompleteCount = 0;
  let malformedCount = 0;
  for (const value of payload.result) {
    if (!isRecord(value)) {
      malformedCount += 1;
      continue;
    }
    const recipe = normalizeRecipe(value);
    if (recipe) recipes.push(recipe);
    else incompleteCount += 1;
  }
  return { recipes, incompleteCount, malformedCount };
}
