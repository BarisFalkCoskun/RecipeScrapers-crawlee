import * as cheerio from "cheerio";
import type { NormalizedRecipeV2 } from "../types.js";
import { extractJsonLdRecipes } from "../extractors/json-ld.js";
import type { EmbeddedRecipeExtraction } from "./spisbedre.js";

const clean = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";

function minutes(value: unknown): number | undefined {
  const text = clean(value).toLocaleLowerCase("da").replace(/,/gu, ".");
  const iso = text.match(/^p(?:\d+y)?(?:\d+m)?(?:\d+d)?t(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?/iu);
  if (iso) {
    const total = Number(iso[1] ?? 0) * 60 + Number(iso[2] ?? 0);
    return total > 0 ? Math.round(total) : undefined;
  }
  const hours = text.match(/(\d+(?:\.\d+)?)\s*timer?/iu);
  const mins = text.match(/(\d+(?:\.\d+)?)\s*min(?:ut(?:ter)?)?/iu);
  const total = Number(hours?.[1] ?? 0) * 60 + Number(mins?.[1] ?? 0);
  return total > 0 ? Math.round(total) : undefined;
}

const firstString = (value: unknown): string => {
  if (typeof value === "string") return clean(value);
  if (Array.isArray(value)) return value.map(firstString).find(Boolean) ?? "";
  return "";
};

function imageUrls(value: unknown): string[] {
  if (typeof value === "string") return clean(value) ? [clean(value)] : [];
  if (Array.isArray(value)) return value.flatMap(imageUrls);
  if (value && typeof value === "object") {
    return imageUrls((value as Record<string, unknown>).url);
  }
  return [];
}

function instructionLines($: cheerio.CheerioAPI): string[] {
  const candidates = $("h1, h2, h3, h4, p, div, span, strong").toArray();
  const headingIndex = candidates.findIndex((element) => clean($(element).text()).toLocaleLowerCase("da") === "sådan gør du");
  if (headingIndex < 0) return [];
  const all = $("*").toArray();
  const documentIndex = all.indexOf(candidates[headingIndex]);
  const lines: string[] = [];
  const stopMarkers = ["næringsindhold", "køkkenredskaber", "du skal bruge"];
  const ignored = new Set([
    "print opskriften",
    "åbn trin-for-trin-visning",
    "er du ny i køkkenet, så følg opskriften her.",
    "lad os komme igang",
    "se videoen.",
  ]);
  for (const element of all.slice(documentIndex + 1)) {
    const text = clean($(element).text());
    const lower = text.toLocaleLowerCase("da");
    if (stopMarkers.some((marker) => lower.includes(marker))) break;
    if (!text || lower === "sådan gør du" || ignored.has(lower)) continue;
    if (lower.endsWith(":") && !/^\d+[.)]?:?$/u.test(lower)) continue;
    if (lines.at(-1) !== text) lines.push(text);
  }
  return lines;
}

function instructions($: cheerio.CheerioAPI): string[] {
  const output: string[] = [];
  let current: string[] = [];
  let seenMarker = false;
  for (const line of instructionLines($)) {
    if (/^\d+[.)]?$/u.test(line)) {
      if (current.length > 0) output.push(current.join(" ").trim());
      current = [];
      seenMarker = true;
      continue;
    }
    if (seenMarker) current.push(line);
  }
  if (current.length > 0) output.push(current.join(" ").trim());
  return output.filter(Boolean);
}

function currentInstructions(
  $: cheerio.CheerioAPI,
  servings: string | undefined
): string[] {
  const output: string[] = [];
  $("p.mb-0").filter((_index, marker) =>
    /^\d+[.)]?$/u.test(clean($(marker).text()))
  ).each((_index, marker) => {
    const row = $(marker).parent();
    const servingSelector = servings ? `.person.persons-${servings}` : "";
    const text = clean(
      (servingSelector ? row.find(servingSelector).first().text() : "") ||
      row.find(".person").first().text() ||
      row.find(".special-step p").first().text()
    ).replace(/\s*Se videoen\.\s*$/iu, "");
    if (text) output.push(text);
  });
  return output;
}

function textCandidates($: cheerio.CheerioAPI): string[] {
  return $("p, li, div, span, strong").toArray().slice(0, 120)
    .map((element) => clean($(element).text())).filter(Boolean);
}

export function extractGocookRecipe(
  html: string,
  canonicalUrl: string
): EmbeddedRecipeExtraction {
  const $ = cheerio.load(html);
  const raw = extractJsonLdRecipes(html).recipes[0];
  if (!raw) return { incompleteCount: 1, malformedCount: 0 };
  const title = firstString(raw.name);
  const ingredients = Array.isArray(raw.recipeIngredient)
    ? raw.recipeIngredient.map(firstString).filter(Boolean)
    : [firstString(raw.recipeIngredient)].filter(Boolean);
  const yieldText = firstString(raw.recipeYield).match(/\d+/u)?.[0];
  const legacyMethod = instructions($);
  const method = legacyMethod.length > 0 ? legacyMethod : currentInstructions($, yieldText);
  if (!title || ingredients.length === 0 || method.length === 0) {
    return { incompleteCount: 1, malformedCount: 0 };
  }

  const candidates = textCandidates($);
  let prepMinutes = minutes(raw.prepTime);
  let totalMinutes = minutes(raw.totalTime);
  for (const candidate of candidates) {
    const lower = candidate.toLocaleLowerCase("da");
    if (totalMinutes === undefined && lower.includes("samlet tid")) totalMinutes = minutes(candidate);
    if (prepMinutes === undefined && lower.includes("arbejdstid")) prepMinutes = minutes(candidate);
  }
  const cookMinutes = minutes(raw.cookTime);
  const categories = $(".breadcrumb a, .recipe-category").toArray()
    .map((element) => clean($(element).text()))
    .filter((value) => value && !["opskrifter", "hjem", "gocook"].includes(value.toLocaleLowerCase("da")));
  let difficulty = clean($(".difficulty, .recipe-difficulty").first().text());
  if (!difficulty) {
    difficulty = clean($("p").filter((_index, paragraph) =>
      clean($(paragraph).clone().children().remove().end().text())
        .toLocaleLowerCase("da").startsWith("sværhedsgrad")
    ).first().find("span").first().text());
  }
  if (!difficulty) {
    for (const candidate of candidates) {
      const match = candidate.match(/sværhedsgrad\s*:\s*(.+)$/iu);
      if (match) { difficulty = clean(match[1]); break; }
    }
  }
  const nutrition = raw.nutrition && typeof raw.nutrition === "object"
    ? raw.nutrition as Record<string, unknown> : undefined;
  const normalized: NormalizedRecipeV2 = {
    title,
    ...(firstString(raw.description) ? { description: firstString(raw.description) } : {}),
    ingredients,
    instructions: method.map((text, index) => ({ position: index + 1, text })),
    ...(prepMinutes !== undefined ? { prepMinutes } : {}),
    ...(cookMinutes !== undefined ? { cookMinutes } : {}),
    ...(totalMinutes !== undefined ? { totalMinutes } : {}),
    ...(yieldText ? { yieldText } : {}),
    imageUrls: imageUrls(raw.image),
    categories,
    cuisines: [],
    keywords: difficulty ? [difficulty] : [],
    ...(nutrition ? { nutrition: {
      calories: nutrition.calories ?? "",
      protein: nutrition.proteinContent ?? "",
      fat: nutrition.fatContent ?? "",
      carbohydrates: nutrition.carbohydrateContent ?? "",
    } } : {}),
  };
  return {
    recipe: { canonicalUrl, rawRecipe: { ...raw, recipeInstructions: method }, normalized },
    incompleteCount: 0,
    malformedCount: 0,
  };
}
