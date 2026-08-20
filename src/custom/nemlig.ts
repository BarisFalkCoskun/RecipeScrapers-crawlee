import * as cheerio from "cheerio";
import type { DanishJsonLdRequest } from "../danish-jsonld/crawler.js";
import type { NormalizedRecipeV2 } from "../types.js";
import type { EmbeddedRecipeExtraction } from "./spisbedre.js";

export const NEMLIG_SEED_CATEGORIES = [
  "/opskrifter", "/opskrifter/aftensmad", "/opskrifter/frokost",
  "/opskrifter/desserter-kage", "/opskrifter/drikkevarer",
  "/opskrifter/tilbehoer", "/opskrifter/morgenmad",
];
const clean = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

export function extractNemligStamp(body: string): string | undefined {
  try { return clean(record(JSON.parse(body))?.SitecorePublishedStamp) || undefined; }
  catch { return undefined; }
}

export function normalizeNemligCategoryPath(value: unknown): string | undefined {
  let path = clean(value);
  if (!path) return undefined;
  try {
    if (/^https?:/iu.test(path)) path = new URL(path).pathname;
  } catch { return undefined; }
  if (!path.startsWith("/opskrifter")) return undefined;
  path = path.split("?", 1)[0].replace(/\/$/u, "");
  return path || "/opskrifter";
}

export const createNemligCategoryRequest = (path: string): DanishJsonLdRequest => ({
  kind: "listing",
  url: `https://www.nemlig.com${path}?GetAsJson=1`,
  uniqueKey: `nemlig-category:${path}`,
  requestData: { nemligPhase: "category", path },
});

export const createNemligGroupRequest = (
  stamp: string,
  groupId: string,
  pageIndex: number
): DanishJsonLdRequest => ({
  kind: "listing",
  url: `https://www.nemlig.com/webapi/${stamp}/recipe/GetByRecipeGroupId?recipeGroupId=${groupId}&pageIndex=${pageIndex}&pagesize=100`,
  uniqueKey: `nemlig-group:${groupId}:${pageIndex}`,
  requestData: { nemligPhase: "group", groupId, pageIndex },
});

function walk(nodes: unknown, output: Record<string, unknown>[]): void {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes) {
    const item = record(node);
    if (!item) continue;
    output.push(item);
    walk(item.content, output);
  }
}

export function extractNemligCategory(body: string): {
  groupIds: string[];
  categoryPaths: string[];
  malformed: boolean;
} {
  let root: Record<string, unknown> | undefined;
  try { root = record(JSON.parse(body)); } catch { /* handled below */ }
  if (!root || !Array.isArray(root.content)) return { groupIds: [], categoryPaths: [], malformed: true };
  const items: Record<string, unknown>[] = [];
  walk(root.content, items);
  const groupIds = items.map((item) => clean(item.RecipeGroupId)).filter(Boolean);
  const categoryPaths = items.flatMap((item) => [item.href, item.Href, item.url, item.Url])
    .concat((Array.isArray(root.links) ? root.links : []).map((link) => record(link)?.href))
    .map(normalizeNemligCategoryPath).filter((path): path is string => Boolean(path));
  return { groupIds: [...new Set(groupIds)], categoryPaths: [...new Set(categoryPaths)], malformed: false };
}

export function extractNemligGroup(body: string, stamp: string, groupId: string, pageIndex: number): {
  requests: DanishJsonLdRequest[];
  candidateCount: number;
  malformed: boolean;
} {
  let root: Record<string, unknown> | undefined;
  try { root = record(JSON.parse(body)); } catch { /* handled below */ }
  if (!root || !Array.isArray(root.Recipes)) return { requests: [], candidateCount: 0, malformed: true };
  const requests: DanishJsonLdRequest[] = root.Recipes.flatMap((rawRecipe) => {
    const path = clean(record(rawRecipe)?.Url);
    if (!path) return [];
    return [{
      kind: "recipe" as const,
      url: new URL(`${path}${path.includes("?") ? "&" : "?"}GetAsJson=1`, "https://www.nemlig.com").toString(),
      uniqueKey: `nemlig-recipe:${path}`,
    }];
  });
  const total = typeof root.NumFound === "number" ? root.NumFound : 0;
  if ((pageIndex + 1) * 100 < total) requests.push(createNemligGroupRequest(stamp, groupId, pageIndex + 1));
  return {
    requests,
    candidateCount: requests.filter((request) => request.kind === "recipe").length,
    malformed: false,
  };
}

function minutes(value: unknown): number | undefined {
  const text = clean(value);
  const iso = text.match(/^PT(?:(\d+)H)?(?:(\d+)M)?/iu);
  if (iso) {
    const total = Number(iso[1] ?? 0) * 60 + Number(iso[2] ?? 0);
    return total || undefined;
  }
  const clock = text.match(/^(\d+):(\d+):\d+$/u);
  return clock ? Number(clock[1]) * 60 + Number(clock[2]) || undefined : undefined;
}

export function extractNemligRecipe(body: string, requestUrl: string): EmbeddedRecipeExtraction {
  let root: Record<string, unknown> | undefined;
  try { root = record(JSON.parse(body)); } catch { /* handled below */ }
  const recipe = Array.isArray(root?.content)
    ? root.content.map(record).find((item) => clean(item?.TemplateName) === "recipedetailspot")
    : undefined;
  if (!recipe) return { incompleteCount: 0, malformedCount: 1 };
  const title = clean(recipe.Header);
  const ingredients: string[] = [];
  for (const rawGroup of Array.isArray(recipe.IngredientGroups) ? recipe.IngredientGroups : []) {
    const group = record(rawGroup);
    for (const rawIngredient of Array.isArray(group?.Ingredients) ? group.Ingredients : []) {
      const ingredient = record(rawIngredient);
      const name = clean(ingredient?.Text);
      if (!name) continue;
      ingredients.push([ingredient?.Amount ? String(ingredient.Amount) : "", clean(ingredient?.Unit), name]
        .filter(Boolean).join(" "));
    }
  }
  const html = clean(recipe.Instructions);
  const text = html.replace(/<br\s*\/?>/giu, "\n")
    .replace(/<\/?(?:p|li|ol|ul|div)[^>]*>/giu, "\n").replace(/<[^>]+>/gu, "");
  const instructions = text.split("\n").map((line) =>
    cheerio.load(line).text().replace(/^\d+[.)]\s*/u, "").trim()
  ).filter((line) => line.length > 5);
  if (!title || ingredients.length === 0 || instructions.length === 0) {
    return { incompleteCount: 1, malformedCount: 0 };
  }
  const categories = (Array.isArray(recipe.RecipeTags) ? recipe.RecipeTags : [])
    .map((tag) => clean(record(tag)?.Name)).filter(Boolean);
  const author = clean(record(recipe.Author)?.Name);
  const imageUrls = (Array.isArray(recipe.Media) ? recipe.Media : [])
    .map((media) => clean(record(media)?.Url)).filter(Boolean);
  const canonical = new URL(requestUrl);
  canonical.searchParams.delete("GetAsJson");
  const normalized: NormalizedRecipeV2 = {
    title,
    ...(clean(recipe.MetaDescription) ? { description: clean(recipe.MetaDescription) } : {}),
    ingredients,
    instructions: instructions.map((instruction, index) => ({ position: index + 1, text: instruction })),
    ...(minutes(recipe.WorkTimeUtc) ? { prepMinutes: minutes(recipe.WorkTimeUtc) } : {}),
    ...(minutes(recipe.TotalTimeUtc) ? { totalMinutes: minutes(recipe.TotalTimeUtc) } : {}),
    ...(recipe.NumberOfPersons !== null && recipe.NumberOfPersons !== undefined
      ? { yieldText: String(recipe.NumberOfPersons) } : {}),
    imageUrls,
    categories,
    cuisines: [],
    keywords: author ? [`Af: ${author}`] : [],
  };
  return {
    recipe: { canonicalUrl: canonical.toString(), rawRecipe: recipe, normalized },
    incompleteCount: 0,
    malformedCount: 0,
  };
}
