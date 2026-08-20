import type { DanishJsonLdRequest } from "../danish-jsonld/crawler.js";
import type { NormalizedRecipeV2 } from "../types.js";
import type { EmbeddedRecipe, EmbeddedRecipeExtraction } from "./spisbedre.js";

const API_URL = "https://www.hellofresh.dk/gw/recipes/recipes/search";
export const HELLOFRESH_PAGE_SIZE = 250;

const clean = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

export function extractHelloFreshToken(html: string): string | undefined {
  return html.match(/"access_token"\s*:\s*"([^"]+)"/u)?.[1];
}

export function createHelloFreshSearchRequest(token: string, offset: number): DanishJsonLdRequest {
  const url = new URL(API_URL);
  url.searchParams.set("country", "DK");
  url.searchParams.set("locale", "da-DK");
  url.searchParams.set("limit", String(HELLOFRESH_PAGE_SIZE));
  url.searchParams.set("offset", String(offset));
  return {
    kind: "listing",
    url: url.toString(),
    requestHeaders: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    uniqueKey: `hellofresh-search:${offset}`,
    requestData: { helloFreshPhase: "search", offset },
  };
}

function minutes(value: unknown): number | undefined {
  const text = clean(value);
  const iso = text.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?$/iu);
  if (iso) {
    const total = Number(iso[1] ?? 0) * 60 + Number(iso[2] ?? 0);
    return total > 0 ? total : undefined;
  }
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function formatAmount(value: unknown): string {
  if (typeof value !== "number" && typeof value !== "string") return "";
  return String(value).trim();
}

function normalizeRecipe(value: unknown): EmbeddedRecipe | undefined {
  const recipe = record(value);
  if (!recipe) return undefined;
  const title = clean(recipe.name);
  const slug = clean(recipe.slug);
  const id = clean(recipe.id);
  const yields = Array.isArray(recipe.yields) ? recipe.yields : [];
  const firstYield = record(yields[0]);
  const amountById = new Map<string, { amount: unknown; unit: string }>();
  if (Array.isArray(firstYield?.ingredients)) {
    for (const rawAmount of firstYield.ingredients) {
      const amount = record(rawAmount);
      const ingredientId = clean(amount?.id);
      if (ingredientId) amountById.set(ingredientId, {
        amount: amount?.amount,
        unit: clean(amount?.unit),
      });
    }
  }
  const ingredients = (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).flatMap((raw) => {
    const ingredient = record(raw);
    const name = clean(ingredient?.name);
    if (!name) return [];
    const amount = amountById.get(clean(ingredient?.id));
    const line = [amount?.amount ? formatAmount(amount.amount) : "", amount?.unit ?? "", name]
      .filter(Boolean).join(" ");
    return line ? [line] : [];
  });
  const instructions = (Array.isArray(recipe.steps) ? recipe.steps : []).flatMap((raw, index) => {
    const step = record(raw);
    const text = clean(step?.instructions);
    return text ? [{
      position: typeof step?.index === "number" ? step.index : index + 1,
      text,
    }] : [];
  });
  if (!title || !slug || !id || ingredients.length === 0 || instructions.length === 0) return undefined;
  const tags = (Array.isArray(recipe.tags) ? recipe.tags : []).map(record).filter(Boolean);
  const categories = tags.filter((tag) => clean(tag?.type) === "cuisine")
    .map((tag) => clean(tag?.name)).filter(Boolean);
  const keywords = tags.filter((tag) => clean(tag?.type) !== "cuisine")
    .map((tag) => clean(tag?.name)).filter(Boolean);
  if (recipe.difficulty) keywords.push(`Sværhedsgrad: ${String(recipe.difficulty)}`);
  const nutrition = Object.fromEntries((Array.isArray(recipe.nutrition) ? recipe.nutrition : [])
    .map(record).filter(Boolean).map((entry) => [clean(entry?.type), entry?.amount])
    .filter(([key]) => Boolean(key)));
  const description = typeof recipe.description === "string" ? recipe.description.trim() : "";
  const imagePath = clean(recipe.imagePath);
  const prepMinutes = minutes(recipe.prepTime);
  const totalMinutes = minutes(recipe.totalTime);
  const serving = firstYield?.yields;
  const normalized: NormalizedRecipeV2 = {
    title,
    ...(description ? { description } : {}),
    ingredients,
    instructions,
    ...(prepMinutes ? { prepMinutes } : {}),
    ...(totalMinutes ? { totalMinutes } : {}),
    ...(serving !== null && serving !== undefined ? { yieldText: String(serving) } : {}),
    imageUrls: imagePath ? [`https://img.hellofresh.com/f_auto,q_auto/${imagePath}`] : [],
    categories,
    cuisines: [],
    keywords,
    ...(Object.keys(nutrition).length ? { nutrition } : {}),
  };
  return {
    canonicalUrl: `https://www.hellofresh.dk/recipes/${slug}-${id}`,
    rawRecipe: recipe,
    normalized,
  };
}

export function extractHelloFreshPage(body: string): EmbeddedRecipeExtraction & {
  itemCount: number;
  total?: number;
} {
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch {
    return { recipes: [], itemCount: 0, incompleteCount: 0, malformedCount: 1 };
  }
  const root = record(parsed);
  if (!root || !Array.isArray(root.items) || typeof root.total !== "number" || root.total < 0) {
    return { recipes: [], itemCount: 0, incompleteCount: 0, malformedCount: 1 };
  }
  const recipes = root.items.map(normalizeRecipe)
    .filter((recipe): recipe is EmbeddedRecipe => recipe !== undefined);
  return {
    recipes,
    itemCount: root.items.length,
    total: root.total,
    incompleteCount: root.items.length - recipes.length,
    malformedCount: 0,
  };
}
