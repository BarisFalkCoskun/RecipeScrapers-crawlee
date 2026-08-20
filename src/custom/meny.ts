import type { DanishJsonLdRequest } from "../danish-jsonld/crawler.js";
import type { NormalizedRecipeV2 } from "../types.js";
import type { EmbeddedRecipe, EmbeddedRecipeExtraction } from "./spisbedre.js";

export const MENY_PAGE_SIZE = 50;
const API_URL = "https://meny.dk/dagrofa/Search/SearchRecipes";
const clean = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

export function createMenySearchRequest(offset: number): DanishJsonLdRequest {
  const url = new URL(API_URL);
  url.searchParams.set("pageSize", String(MENY_PAGE_SIZE));
  url.searchParams.set("pageOffset", String(offset));
  return {
    kind: "listing",
    url: url.toString(),
    uniqueKey: `meny-search:${offset}`,
    requestData: { menyOffset: offset },
  };
}

function timeMinutes(value: unknown): number | undefined {
  const parts = clean(value).split(":").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return undefined;
  const total = parts[0] * 60 + parts[1];
  return total > 0 ? total : undefined;
}

function normalizeRecipe(value: unknown): EmbeddedRecipe | undefined {
  const source = record(record(value)?.source);
  if (!source) return undefined;
  const title = clean(source.longName) || clean(source.shortName);
  const slug = clean(source.urlSegment);
  const domain = clean(source.source) || "meny.dk";
  const ingredients: string[] = [];
  for (const rawGroup of Array.isArray(source.ingredientGroups) ? source.ingredientGroups : []) {
    const group = record(rawGroup);
    for (const rawIngredient of Array.isArray(group?.ingredientGroupIngredients)
      ? group.ingredientGroupIngredients : []) {
      const ingredient = record(rawIngredient);
      const name = clean(record(ingredient?.ingredient)?.nameSingular);
      if (!name) continue;
      const amount = ingredient?.amount;
      const unit = clean(record(ingredient?.unit)?.nameSingular);
      ingredients.push([amount !== null && amount !== undefined ? String(amount) : "", unit, name]
        .filter(Boolean).join(" "));
    }
  }
  const instructions: NormalizedRecipeV2["instructions"] = [];
  for (const rawSection of Array.isArray(source.instructionSections) ? source.instructionSections : []) {
    const section = record(rawSection);
    for (const rawStep of Array.isArray(section?.steps) ? section.steps : []) {
      const text = clean(rawStep);
      if (text) instructions.push({ position: instructions.length + 1, text });
    }
  }
  if (instructions.length === 0) {
    const text = clean(source.instruction);
    if (text) instructions.push({ position: 1, text });
  }
  if (!title || !slug || ingredients.length === 0 || instructions.length === 0) return undefined;
  const preparation = record(source.preparationTime);
  const totalMinutes = timeMinutes(preparation?.total);
  const amount = record(source.amount);
  const serving = amount?.number;
  const servingUnit = clean(record(amount?.unit)?.nameSingular);
  const yieldText = serving !== null && serving !== undefined
    ? [String(serving), servingUnit].filter(Boolean).join(" ")
    : "";
  const nutritionSource = record(source.nutritionalValues);
  const nutrition = nutritionSource ? {
    calories: nutritionSource.energy ?? "",
    protein: nutritionSource.protein ?? "",
    fat: nutritionSource.fat ?? "",
    carbohydrates: nutritionSource.carbohydrates ?? "",
    fiber: nutritionSource.fibers ?? "",
  } : undefined;
  const categories: string[] = [];
  const metadata = record(source.metaData);
  for (const rawCategory of Array.isArray(metadata?.propertyCategories) ? metadata.propertyCategories : []) {
    const category = record(rawCategory);
    for (const rawItem of Array.isArray(category?.values) ? category.values : []) {
      const name = clean(record(rawItem)?.name);
      if (name) categories.push(name);
    }
  }
  const imageUrls = (Array.isArray(source.pictures) ? source.pictures : []).flatMap((rawPicture) => {
    const url = clean(record(rawPicture)?.url);
    return url ? [url.replace("{preset}", "Main")] : [];
  });
  const description = clean(source.teaserText);
  const normalized: NormalizedRecipeV2 = {
    title,
    ...(description ? { description } : {}),
    ingredients,
    instructions,
    ...(totalMinutes ? { totalMinutes } : {}),
    ...(yieldText ? { yieldText } : {}),
    imageUrls,
    categories,
    cuisines: [],
    keywords: [],
    ...(nutrition ? { nutrition } : {}),
  };
  return {
    canonicalUrl: `https://${domain}/opskrift/${slug}`,
    rawRecipe: source,
    normalized,
  };
}

export function extractMenyPage(body: string): EmbeddedRecipeExtraction & {
  itemCount: number;
  total?: number;
} {
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch {
    return { recipes: [], itemCount: 0, incompleteCount: 0, malformedCount: 1 };
  }
  const root = record(parsed);
  const data = record(root?.responseData) ?? root;
  if (!data || !Array.isArray(data.products)) {
    return { recipes: [], itemCount: 0, incompleteCount: 0, malformedCount: 1 };
  }
  const recipes = data.products.map(normalizeRecipe)
    .filter((recipe): recipe is EmbeddedRecipe => recipe !== undefined);
  return {
    recipes,
    itemCount: data.products.length,
    ...(typeof data.totalHits === "number" ? { total: data.totalHits } : {}),
    incompleteCount: data.products.length - recipes.length,
    malformedCount: 0,
  };
}
