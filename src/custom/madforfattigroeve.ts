import * as cheerio from "cheerio";
import type { DanishJsonLdRequest } from "../danish-jsonld/crawler.js";
import type { NormalizedRecipeV2 } from "../types.js";
import type { EmbeddedRecipeExtraction } from "./spisbedre.js";

const clean = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

export const MAD_FOR_FATTIGROEVE_DICTIONARY_QUERY = `query RecipeDictionary {
  ingredients { ingredientId name allergens }
  codeItems { itemCode name tableCode }
}`;

export const MAD_FOR_FATTIGROEVE_CURRENT_QUERY = `query CurrentRecipeCatalog(
  $listFilteredRecipesInput: ListFilteredRecipesInput!
) {
  listPublishedRecipes(listFilteredRecipesInput: $listFilteredRecipesInput) {
    recipes {
      slug status oldId title description images tools activeTime waitingTime totalTime
      notes scalingType scaleDenominator amountPerPerson
      ingredientList { heading displaySequence ingredients { ingredientId measureUnit amountUsed displaySequence } }
      instructions { heading displaySequence steps { text displaySequence } }
      nutrition { calories carbohydrates fat protein averageWeight }
      categories mealTypes seasons publishedAt createdAt updatedAt
      metadata { title description image }
    }
    totalItems
  }
  ingredients { ingredientId name allergens }
  codeItems { itemCode name tableCode }
}`;

export const createMadForFattigroeveDictionaryRequest = (): DanishJsonLdRequest => ({
  kind: "listing",
  url: "https://backend.madforfattigroeve.dk/graphql",
  method: "POST",
  requestHeaders: {
    "content-type": "application/json",
    accept: "application/graphql-response+json",
  },
  payload: JSON.stringify({ query: MAD_FOR_FATTIGROEVE_DICTIONARY_QUERY }),
  uniqueKey: "madforfattigroeve-current-dictionary",
  requestData: { madForFattigroevePhase: "dictionary" },
});

export const createMadForFattigroeveCurrentRequest = (): DanishJsonLdRequest => ({
  kind: "listing",
  url: "https://backend.madforfattigroeve.dk/graphql",
  method: "POST",
  requestHeaders: {
    "content-type": "application/json",
    accept: "application/graphql-response+json",
  },
  payload: JSON.stringify({
    query: MAD_FOR_FATTIGROEVE_CURRENT_QUERY,
    variables: {
      listFilteredRecipesInput: { limit: 1_000, page: 1, sortDirection: "DESC" },
    },
  }),
  uniqueKey: "madforfattigroeve-current-catalog",
  requestData: { madForFattigroevePhase: "current-catalog" },
});

export function extractMadForFattigroeveCurrentCatalog(html: string): {
  recipes: Record<string, unknown>[];
  total?: number;
  malformed: boolean;
} {
  const $ = cheerio.load(html);
  const payload = $("#__NEXT_DATA__").first().text();
  let parsed: unknown;
  try { parsed = JSON.parse(payload); } catch {
    return { recipes: [], malformed: true };
  }
  const list = record(record(record(record(parsed)?.props)?.pageProps)?.serverRecipes)
    ?.listPublishedRecipes;
  const result = record(list);
  const recipes = Array.isArray(result?.recipes)
    ? result.recipes.map(record).filter((recipe): recipe is Record<string, unknown> => Boolean(recipe))
    : [];
  return {
    recipes,
    ...(typeof result?.totalItems === "number" ? { total: result.totalItems } : {}),
    malformed: recipes.length === 0,
  };
}

export function extractMadForFattigroeveGraphqlCatalog(body: string): {
  recipes: Record<string, unknown>[];
  total?: number;
  malformed: boolean;
} {
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch {
    return { recipes: [], malformed: true };
  }
  const result = record(record(record(parsed)?.data)?.listPublishedRecipes);
  const recipes = Array.isArray(result?.recipes)
    ? result.recipes.map(record).filter((recipe): recipe is Record<string, unknown> => Boolean(recipe))
    : [];
  return {
    recipes,
    ...(typeof result?.totalItems === "number" ? { total: result.totalItems } : {}),
    malformed: recipes.length === 0,
  };
}

interface MadForFattigroeveDictionary {
  ingredientNames: Map<string, string>;
  ingredientAllergens: Map<string, string[]>;
  codeNames: Map<string, string>;
}

function codeKey(table: string, item: string): string { return `${table}:${item}`; }

export function extractMadForFattigroeveDictionary(body: string):
  | MadForFattigroeveDictionary
  | undefined {
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { return undefined; }
  const data = record(record(parsed)?.data);
  if (!Array.isArray(data?.ingredients) || !Array.isArray(data.codeItems)) return undefined;
  const ingredientNames = new Map<string, string>();
  const ingredientAllergens = new Map<string, string[]>();
  for (const raw of data.ingredients) {
    const ingredient = record(raw);
    const id = clean(ingredient?.ingredientId);
    const name = clean(ingredient?.name);
    if (id && name) ingredientNames.set(id, name);
    if (id && Array.isArray(ingredient?.allergens)) {
      ingredientAllergens.set(id, ingredient.allergens.map(clean).filter(Boolean));
    }
  }
  const codeNames = new Map<string, string>();
  for (const raw of data.codeItems) {
    const item = record(raw);
    const table = clean(item?.tableCode);
    const code = clean(item?.itemCode);
    const name = clean(item?.name);
    if (table && code && name && !codeNames.has(codeKey(table, code))) {
      codeNames.set(codeKey(table, code), name);
    }
  }
  return ingredientNames.size > 0 && codeNames.size > 0
    ? { ingredientNames, ingredientAllergens, codeNames }
    : undefined;
}

function displayAmount(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value === 0) return "";
  if (value >= 1) return value.toFixed(0);
  if (value > 0.95) return "1";
  return value.toFixed(2).split(".")[1]?.[1] === "0" ? value.toFixed(1) : value.toFixed(2);
}

function htmlText(value: unknown): string {
  const source = clean(value);
  return source ? cheerio.load(source).text().replace(/\s+/gu, " ").trim() : "";
}

const sequence = (value: unknown): number =>
  typeof record(value)?.displaySequence === "number"
    ? record(value)!.displaySequence as number
    : Number.MAX_SAFE_INTEGER;

export function extractMadForFattigroeveCurrentRecipes(
  catalog: Record<string, unknown>[],
  dictionary: MadForFattigroeveDictionary
): EmbeddedRecipeExtraction {
  const recipes = [];
  let incompleteCount = 0;
  let malformedCount = 0;
  for (const recipe of catalog) {
    const slug = clean(recipe.slug);
    const metadata = record(recipe.metadata);
    const title = clean(metadata?.title) || clean(recipe.title);
    if (!slug) { malformedCount += 1; continue; }
    const ingredients: string[] = [];
    const allergens = new Set<string>();
    const groups = Array.isArray(recipe.ingredientList)
      ? [...recipe.ingredientList].sort((left, right) => sequence(left) - sequence(right))
      : [];
    for (const rawGroup of groups) {
      const group = record(rawGroup);
      const entries = Array.isArray(group?.ingredients)
        ? [...group.ingredients].sort((left, right) => sequence(left) - sequence(right))
        : [];
      for (const rawEntry of entries) {
        const entry = record(rawEntry);
        const id = clean(entry?.ingredientId);
        const name = dictionary.ingredientNames.get(id) ?? "";
        if (!name) continue;
        for (const allergen of dictionary.ingredientAllergens.get(id) ?? []) allergens.add(allergen);
        const unitCode = clean(entry?.measureUnit);
        const unit = unitCode && unitCode !== "NO_UNIT"
          ? dictionary.codeNames.get(codeKey("UNIT", unitCode)) ?? unitCode.toLocaleLowerCase("da-DK")
          : "";
        ingredients.push([displayAmount(entry?.amountUsed), unit, name].filter(Boolean).join(" "));
      }
    }
    const instructions: Array<{ position: number; text: string }> = [];
    const instructionGroups = Array.isArray(recipe.instructions)
      ? [...recipe.instructions].sort((left, right) => sequence(left) - sequence(right))
      : [];
    for (const rawGroup of instructionGroups) {
      const group = record(rawGroup);
      const steps = Array.isArray(group?.steps)
        ? [...group.steps].sort((left, right) => sequence(left) - sequence(right))
        : [];
      for (const rawStep of steps) {
        const text = htmlText(record(rawStep)?.text);
        if (text) instructions.push({ position: instructions.length + 1, text });
      }
    }
    if (!title || ingredients.length === 0 || instructions.length === 0) {
      incompleteCount += 1;
      continue;
    }
    const categoryCodes = Array.isArray(recipe.categories) ? recipe.categories.map(clean) : [];
    const categories = categoryCodes.map((code) =>
      dictionary.codeNames.get(codeKey("RECIPE_CATEGORY", code)) ?? code
    ).filter(Boolean);
    const keywords = [...allergens];
    for (const [table, values] of [
      ["MEAL_TYPE", recipe.mealTypes],
      ["SEASON", recipe.seasons],
    ] as const) {
      if (!Array.isArray(values)) continue;
      for (const value of values) {
        const code = clean(value);
        const name = dictionary.codeNames.get(codeKey(table, code)) ?? code;
        if (name) keywords.push(name);
      }
    }
    const images = Array.isArray(recipe.images) ? recipe.images.map(clean).filter(Boolean) : [];
    const prepMinutes = typeof recipe.activeTime === "number" && recipe.activeTime > 0
      ? recipe.activeTime : undefined;
    const totalMinutes = typeof recipe.totalTime === "number" && recipe.totalTime > 0
      ? recipe.totalTime : prepMinutes;
    const yieldText = typeof recipe.scaleDenominator === "number" && recipe.scaleDenominator > 0
      ? String(recipe.scaleDenominator) : undefined;
    const description = htmlText(metadata?.description) || htmlText(recipe.description);
    const nutrition = record(recipe.nutrition);
    const normalized: NormalizedRecipeV2 = {
      title,
      ...(description ? { description } : {}),
      ingredients,
      instructions,
      ...(prepMinutes ? { prepMinutes } : {}),
      ...(totalMinutes ? { totalMinutes } : {}),
      ...(yieldText ? { yieldText } : {}),
      imageUrls: images,
      categories,
      cuisines: [],
      keywords: [...new Set(keywords)],
      ...(nutrition ? { nutrition } : {}),
    };
    recipes.push({
      canonicalUrl: `https://madforfattigroeve.dk/opskrifter/${slug}`,
      rawRecipe: recipe,
      normalized,
    });
  }
  return { recipes, incompleteCount, malformedCount };
}

export const extractMadForFattigroeveBuildId = (html: string): string | undefined =>
  html.match(/"buildId"\s*:\s*"([^"]+)"/u)?.[1];

export const createMadForFattigroeveSitemapRequest = (): DanishJsonLdRequest => ({
  kind: "listing",
  url: "https://madforfattigroeve.dk/sitemap.xml",
  uniqueKey: "madforfattigroeve-sitemap",
  requestData: { madForFattigroevePhase: "sitemap" },
});

export function discoverMadForFattigroeveRecipes(
  xml: string,
  buildId: string
): DanishJsonLdRequest[] {
  return [...xml.matchAll(
    /<loc>(https?:\/\/madforfattigroeve\.dk\/opskrifter\/(\d+))<\/loc>/gu
  )].map((match) => ({
    kind: "recipe" as const,
    url: `https://madforfattigroeve.dk/_next/data/${buildId}/opskrifter/${match[2]}.json`,
    uniqueKey: `madforfattigroeve-recipe:${match[2]}`,
    requestData: { recipeId: match[2] },
  }));
}

function ingredientLines(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.flatMap((value) => {
    if (typeof value === "string") return clean(value) ? [clean(value)] : [];
    const ingredient = record(value);
    const name = clean(ingredient?.name);
    if (!name) return [];
    const amount = ingredient?.amount;
    const unit = clean(ingredient?.unit);
    return [[amount ? String(amount) : "", unit, name].filter(Boolean).join(" ")];
  });
}

export function extractMadForFattigroeveRecipe(
  body: string,
  recipeId: string
): EmbeddedRecipeExtraction {
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch {
    return { incompleteCount: 0, malformedCount: 1 };
  }
  const pageProps = record(record(parsed)?.pageProps);
  const recipe = record(pageProps?.recipe) ?? record(pageProps?.data);
  if (!recipe) return { incompleteCount: 0, malformedCount: 1 };
  const title = clean(recipe.title);
  const ingredients = ingredientLines(recipe.ingredients);
  if (Array.isArray(recipe.subrecipes)) {
    for (const rawSubrecipe of recipe.subrecipes) {
      ingredients.push(...ingredientLines(record(rawSubrecipe)?.ingredients));
    }
  }
  const instructions = clean(recipe.procedure).split("\n").map((line) => line.trim()).filter(Boolean);
  if (!title || ingredients.length === 0 || instructions.length === 0) {
    return { incompleteCount: 1, malformedCount: 0 };
  }
  const description = clean(recipe.description);
  const prepMatch = String(recipe.prepTime ?? "").match(/(\d+)/u);
  const image = clean(recipe.imagePath);
  const keywords = Array.isArray(recipe.allergens)
    ? recipe.allergens.map(clean).filter(Boolean)
    : [];
  const normalized: NormalizedRecipeV2 = {
    title,
    ...(description ? { description } : {}),
    ingredients,
    instructions: instructions.map((text, index) => ({ position: index + 1, text })),
    ...(prepMatch ? { prepMinutes: Number(prepMatch[1]) } : {}),
    imageUrls: image ? [image] : [],
    categories: [],
    cuisines: [],
    keywords,
  };
  return {
    recipe: {
      canonicalUrl: `https://madforfattigroeve.dk/opskrifter/${recipeId}`,
      rawRecipe: recipe,
      normalized,
    },
    incompleteCount: 0,
    malformedCount: 0,
  };
}
