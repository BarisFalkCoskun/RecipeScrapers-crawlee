import * as cheerio from "cheerio";
import type { NormalizedRecipeV2, RecipeDocumentV2 } from "../types.js";
import { hashRecipe } from "../utils/hash.js";

export interface EmbeddedRecipe {
  canonicalUrl: string;
  rawRecipe: Record<string, unknown>;
  normalized: NormalizedRecipeV2;
  /**
   * Some legacy pages contain several independently addressable recipes.
   * Their stable identities use generated fragments even though ordinary page
   * canonicals deliberately discard fragments.
   */
  preserveCanonicalFragment?: boolean;
}

export interface EmbeddedRecipeExtraction {
  recipe?: EmbeddedRecipe;
  recipes?: EmbeddedRecipe[];
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

const formatAmount = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return text(value);
  return Number.isInteger(parsed) ? String(parsed) : String(parsed);
};

function normalizeIngredients(groups: unknown): string[] {
  if (!Array.isArray(groups)) return [];
  const ingredients: string[] = [];
  for (const group of groups) {
    if (!isRecord(group) || !Array.isArray(group.ingredients)) continue;
    for (const entry of group.ingredients) {
      if (!isRecord(entry)) continue;
      const ingredient = isRecord(entry.ingredient) ? entry.ingredient : {};
      const inflection = text(entry.ingredient_inflection);
      const name = text(
        inflection === "plural"
          ? ingredient.name_plural ?? ingredient.name_singular
          : ingredient.name_singular ?? ingredient.name_plural
      );
      if (name === "") continue;
      const unitData = isRecord(entry.unit) ? entry.unit : {};
      const unit = text(
        unitData.abbreviation ?? unitData.name_singular ?? unitData.name_plural
      );
      const line = [
        formatAmount(entry.amount),
        unit,
        text(entry.prefix),
        name,
        text(entry.suffix),
      ].filter(Boolean).join(" ");
      if (line !== "") ingredients.push(line);
    }
  }
  return ingredients;
}

function normalizeInstructions(groups: unknown): NormalizedRecipeV2["instructions"] {
  if (!Array.isArray(groups)) return [];
  const instructions: NormalizedRecipeV2["instructions"] = [];
  for (const group of groups) {
    if (!isRecord(group) || !Array.isArray(group.instructions)) continue;
    const section = text(group.title);
    for (const entry of group.instructions) {
      if (!isRecord(entry)) continue;
      const body = text(entry.instruction);
      if (body === "") continue;
      instructions.push({
        position: instructions.length + 1,
        text: section === "" ? body : `${section}: ${body}`,
      });
    }
  }
  return instructions;
}

function normalizeTags(values: unknown): {
  categories: string[];
  keywords: string[];
} {
  const categories: string[] = [];
  const keywords: string[] = [];
  if (!Array.isArray(values)) return { categories, keywords };
  for (const value of values) {
    if (!isRecord(value)) continue;
    const name = text(value.name);
    if (name === "") continue;
    const groupName = isRecord(value.group) ? text(value.group.name) : "";
    const target = groupName === "Måltid" ? categories : keywords;
    if (!target.includes(name)) target.push(name);
  }
  return { categories, keywords };
}

export function extractSpisbedreRecipe(
  html: string,
  fallbackCanonicalUrl: string
): EmbeddedRecipeExtraction {
  const $ = cheerio.load(html);
  const encodedPage = $("#app[data-page]").attr("data-page");
  if (!encodedPage) return { incompleteCount: 0, malformedCount: 1 };

  let page: unknown;
  try {
    page = JSON.parse(encodedPage);
  } catch {
    return { incompleteCount: 0, malformedCount: 1 };
  }
  const props = isRecord(page) && isRecord(page.props) ? page.props : undefined;
  const rawRecipe = props && isRecord(props.recipe) ? props.recipe : undefined;
  if (!rawRecipe) return { incompleteCount: 0, malformedCount: 1 };

  const ingredients = normalizeIngredients(rawRecipe.grouped_ingredients);
  const instructions = normalizeInstructions(rawRecipe.grouped_instructions);
  const title = text(rawRecipe.title);
  const tags = normalizeTags(rawRecipe.tags);
  const servingType = isRecord(rawRecipe.serving_size_type)
    ? rawRecipe.serving_size_type
    : {};
  const yieldText = [
    text(rawRecipe.serving_size),
    text(servingType.name_plural ?? servingType.name_singular),
  ].filter(Boolean).join(" ");
  const media = isRecord(rawRecipe.media) ? rawRecipe.media : {};
  const imageUrl = text(media.raw_url ?? media.url);
  const nutritionSource = isRecord(rawRecipe.nutrition) ? rawRecipe.nutrition : {};
  const nutrition = Object.fromEntries([
    ["calories", nutritionSource.calories],
    ["protein", nutritionSource.protein],
    ["fat", nutritionSource.fat],
    ["carbohydrates", nutritionSource.carbohydrates],
  ].filter(([, value]) => value !== null && value !== undefined));
  const normalized: NormalizedRecipeV2 = {
    title,
    ...(text(rawRecipe.description) === "" ? {} : { description: text(rawRecipe.description) }),
    ingredients,
    instructions,
    ...(positiveNumber(rawRecipe.preparation_time) === undefined
      ? {} : { prepMinutes: positiveNumber(rawRecipe.preparation_time) }),
    ...(positiveNumber(rawRecipe.cooking_time) === undefined
      ? {} : { cookMinutes: positiveNumber(rawRecipe.cooking_time) }),
    ...(positiveNumber(rawRecipe.total_time) === undefined
      ? {} : { totalMinutes: positiveNumber(rawRecipe.total_time) }),
    ...(yieldText === "" ? {} : { yieldText }),
    imageUrls: imageUrl === "" ? [] : [imageUrl],
    categories: tags.categories,
    cuisines: [],
    keywords: tags.keywords,
    ...(Object.keys(nutrition).length === 0 ? {} : { nutrition }),
  };
  if (title === "" || ingredients.length === 0 || instructions.length === 0) {
    return { incompleteCount: 1, malformedCount: 0 };
  }
  return {
    recipe: {
      canonicalUrl: text(rawRecipe.url) || fallbackCanonicalUrl,
      rawRecipe,
      normalized,
    },
    incompleteCount: 0,
    malformedCount: 0,
  };
}

export function buildEmbeddedRecipeDocumentV2(input: {
  sourceId: string;
  crawlRunId: string;
  crawlAttemptId: string;
  pageUrl: string;
  extractedAt: Date;
  recipe: EmbeddedRecipe;
  language: string;
  languageConfidence: number;
  languageSignals: string[];
  extractorVersion: string;
  extractionSignals: string[];
  extractionMethod?: "embedded-json" | "html-parsing" | "api-json";
}): Omit<RecipeDocumentV2, "_id"> {
  const rawRecipe = structuredClone(input.recipe.rawRecipe);
  const normalized = structuredClone(input.recipe.normalized);
  const upstreamId = text(rawRecipe.id);
  return {
    schemaVersion: 2,
    sourceId: input.sourceId,
    sourceRecipeKey: `${input.sourceId}:${hashRecipe({
      sourceId: input.sourceId,
      canonicalUrl: input.recipe.canonicalUrl,
      upstreamId: upstreamId || null,
    })}`,
    canonicalUrl: input.recipe.canonicalUrl,
    pageUrl: input.pageUrl,
    crawlRunId: input.crawlRunId,
    crawlAttemptId: input.crawlAttemptId,
    createdAt: input.extractedAt,
    updatedAt: input.extractedAt,
    extractedAt: input.extractedAt,
    language: input.language,
    languageConfidence: input.languageConfidence,
    languageSignals: [...input.languageSignals],
    extractionMethod: input.extractionMethod ?? "embedded-json",
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
