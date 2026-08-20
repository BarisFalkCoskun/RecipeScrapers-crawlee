import type { NormalizedRecipeV2 } from "../types.js";
import * as cheerio from "cheerio";
import { decodeHTML } from "entities";

interface CrawleeProbeRecipe {
  canonicalUrl: string;
  normalized: NormalizedRecipeV2;
}

type LegacyProbeRecipe = Record<string, unknown>;

export interface WprmProbeParityReport {
  passed: boolean;
  legacyCount: number;
  crawleeCount: number;
  matchedUrls: number;
  missingFromCrawlee: string[];
  missingFromLegacy: string[];
  fields: Record<string, { matches: number; compared: number; ratio: number }>;
  mismatchSamples: Array<{ url: string; fields: string[] }>;
}

const compact = (value: unknown): string =>
  typeof value === "string"
    ? value.replace(/\s+/gu, " ").trim()
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : "";

const semanticText = (value: unknown): string => {
  const source = decodeHTML(compact(value));
  if (source === "") return "";
  const withBlockBoundaries = source
    .replace(/<br\s*\/?>/giu, " ")
    .replace(/<\/?(?:article|div|h[1-6]|li|ol|p|section|ul)\b[^>]*>/giu, " ");
  return cheerio.load(withBlockBoundaries).text().replace(/\s+/gu, " ").trim();
};

function canonicalKey(value: unknown): string {
  const raw = compact(value);
  try {
    const url = new URL(raw);
    url.hostname = url.hostname.replace(/^www\./iu, "");
    // WPRM appends a presentation anchor to otherwise page-addressed recipes.
    // Other fragments can be real record identities: 365discount uses one
    // page for several recipes and its legacy spider generates title slugs.
    if (/^#wprm-recipe-\d+$/iu.test(url.hash)) url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/u, "") || "/";
    return url.toString();
  } catch {
    return raw;
  }
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(compact).filter(Boolean);
}

function legacyIngredientLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (typeof entry !== "object" || entry === null) return "";
    // Some legacy JSON-LD records retain presentational anchors/strong tags
    // inside `original`, while RecipeDocument V2 deliberately stores clean
    // text. Compare the rendered ingredient rather than HTML serialization.
    return semanticText((entry as Record<string, unknown>).original);
  }).filter(Boolean);
}

function legacyInstructionLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (typeof entry !== "object" || entry === null) return "";
    return semanticText((entry as Record<string, unknown>).text);
  }).filter(Boolean);
}

function sameSet(left: string[], right: string[]): boolean {
  return JSON.stringify([...new Set(left)].sort()) ===
    JSON.stringify([...new Set(right)].sort());
}

function sameUrlSet(left: string[], right: string[]): boolean {
  return sameSet(left.map(canonicalKey), right.map(canonicalKey));
}

function sameNullableNumber(left: unknown, right: number | undefined): boolean {
  const legacy = typeof left === "number" && left > 0 ? left : undefined;
  return legacy === right;
}

function groupByCanonicalUrl<T>(
  recipes: T[],
  urlFor: (recipe: T) => unknown
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const recipe of recipes) {
    const url = canonicalKey(urlFor(recipe));
    grouped.set(url, [...(grouped.get(url) ?? []), recipe]);
  }
  return grouped;
}

function recordLabel(url: string, title: unknown): string {
  const normalizedTitle = compact(title);
  return normalizedTitle ? `${url} :: ${normalizedTitle}` : url;
}

export function compareWprmProbeRecipes(
  legacy: LegacyProbeRecipe[],
  crawlee: CrawleeProbeRecipe[],
  options: {
    legacyTagsIncludeCuisines?: boolean;
    legacyYieldIsNumericOnly?: boolean;
  } = {}
): WprmProbeParityReport {
  const legacyByUrl = groupByCanonicalUrl(legacy, (recipe) => recipe.url);
  const crawleeByUrl = groupByCanonicalUrl(crawlee, (recipe) => recipe.canonicalUrl);
  const missingFromCrawlee: string[] = [];
  const missingFromLegacy: string[] = [];
  const pairs: Array<{
    url: string;
    legacyRecipe: LegacyProbeRecipe;
    crawleeRecipe: CrawleeProbeRecipe;
  }> = [];

  for (const url of new Set([...legacyByUrl.keys(), ...crawleeByUrl.keys()])) {
    const legacyRecipes = legacyByUrl.get(url) ?? [];
    const crawleeRecipes = crawleeByUrl.get(url) ?? [];
    const unmatchedCrawlee = new Set(crawleeRecipes.map((_recipe, index) => index));
    const unmatchedLegacy: LegacyProbeRecipe[] = [];

    for (const legacyRecipe of legacyRecipes) {
      const exactIndex = [...unmatchedCrawlee].find(
        (index) => compact(crawleeRecipes[index]?.normalized.title) === semanticText(legacyRecipe.title)
      );
      if (exactIndex === undefined) unmatchedLegacy.push(legacyRecipe);
      else {
        unmatchedCrawlee.delete(exactIndex);
        pairs.push({ url, legacyRecipe, crawleeRecipe: crawleeRecipes[exactIndex]! });
      }
    }

    // Pair remaining records deterministically so title differences are
    // reported as field mismatches instead of two opaque missing records.
    const remainingCrawlee = [...unmatchedCrawlee];
    const pairCount = Math.min(unmatchedLegacy.length, remainingCrawlee.length);
    for (let index = 0; index < pairCount; index += 1) {
      const crawleeIndex = remainingCrawlee[index]!;
      unmatchedCrawlee.delete(crawleeIndex);
      pairs.push({
        url,
        legacyRecipe: unmatchedLegacy[index]!,
        crawleeRecipe: crawleeRecipes[crawleeIndex]!,
      });
    }
    for (const recipe of unmatchedLegacy.slice(pairCount)) {
      missingFromCrawlee.push(recordLabel(url, recipe.title));
    }
    for (const index of unmatchedCrawlee) {
      missingFromLegacy.push(recordLabel(url, crawleeRecipes[index]?.normalized.title));
    }
  }
  const fieldNames = [
    "title",
    "ingredientCount",
    "ingredientText",
    "instructionCount",
    "instructionText",
    "prepMinutes",
    "cookMinutes",
    "totalMinutes",
    "yieldText",
    "imageUrls",
    "categories",
    "cuisinesAndKeywords",
  ] as const;
  const counts = Object.fromEntries(fieldNames.map((field) => [field, 0])) as
    Record<(typeof fieldNames)[number], number>;
  const mismatchSamples: Array<{ url: string; fields: string[] }> = [];
  let matchedUrls = 0;

  for (const { url, legacyRecipe, crawleeRecipe } of pairs) {
    matchedUrls += 1;
    const normalized = crawleeRecipe.normalized;
    const ingredientLines = legacyIngredientLines(legacyRecipe.ingredients);
    const instructionLines = legacyInstructionLines(legacyRecipe.instructions);
    const legacyYield = [compact(legacyRecipe.servings), compact(legacyRecipe.servings_unit)]
      .filter(Boolean).join(" ");
    const crawleeYield = normalized.yieldText ?? "";
    const comparisons: Record<(typeof fieldNames)[number], boolean> = {
      title: semanticText(legacyRecipe.title) === compact(normalized.title),
      ingredientCount: ingredientLines.length === normalized.ingredients.length,
      ingredientText: JSON.stringify(ingredientLines) === JSON.stringify(
        normalized.ingredients.map(compact)
      ),
      instructionCount: instructionLines.length === normalized.instructions.length,
      instructionText: JSON.stringify(instructionLines) === JSON.stringify(
        normalized.instructions.map((step) => compact(step.text))
      ),
      prepMinutes: sameNullableNumber(legacyRecipe.prep_time_minutes, normalized.prepMinutes),
      cookMinutes: sameNullableNumber(legacyRecipe.cook_time_minutes, normalized.cookMinutes),
      totalMinutes: sameNullableNumber(legacyRecipe.total_time_minutes, normalized.totalMinutes),
      yieldText: options.legacyYieldIsNumericOnly
        ? legacyYield === (crawleeYield.match(/\d+/u)?.[0] ?? "")
        : legacyYield === crawleeYield,
      imageUrls: sameUrlSet(strings(legacyRecipe.image_urls), normalized.imageUrls),
      categories: sameSet(
        strings(legacyRecipe.categories).map(semanticText),
        normalized.categories.map(semanticText)
      ),
      cuisinesAndKeywords: sameSet(
        strings(legacyRecipe.tags).map(semanticText),
        options.legacyTagsIncludeCuisines === false
          ? normalized.keywords.map(semanticText)
          : [...normalized.cuisines, ...normalized.keywords].map(semanticText)
      ),
    };
    for (const field of fieldNames) {
      if (comparisons[field]) counts[field] += 1;
    }
    const mismatchedFields = fieldNames.filter((field) => !comparisons[field]);
    if (mismatchedFields.length > 0 && mismatchSamples.length < 10) {
      mismatchSamples.push({ url, fields: mismatchedFields });
    }
  }

  const fields = Object.fromEntries(fieldNames.map((field) => [field, {
    matches: counts[field],
    compared: matchedUrls,
    ratio: matchedUrls === 0 ? 0 : counts[field] / matchedUrls,
  }]));
  const requiredFields = fieldNames.filter((field) => field !== "instructionText");
  const passed = legacy.length === crawlee.length &&
    missingFromCrawlee.length === 0 && missingFromLegacy.length === 0 &&
    matchedUrls === legacy.length && matchedUrls === crawlee.length &&
    requiredFields.every((field) => counts[field] === matchedUrls);

  return {
    passed,
    legacyCount: legacy.length,
    crawleeCount: crawlee.length,
    matchedUrls,
    missingFromCrawlee,
    missingFromLegacy,
    fields,
    mismatchSamples,
  };
}
