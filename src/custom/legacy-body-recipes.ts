import * as cheerio from "cheerio";
import type { EmbeddedRecipeExtraction } from "./spisbedre.js";

const compact = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";

function descendantTextParts(element: cheerio.Cheerio<unknown>): string[] {
  const output: string[] = [];
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    const node = value as { type?: string; data?: string; children?: unknown[] };
    if (node.type === "text") {
      const text = compact(node.data);
      if (text) output.push(text);
      return;
    }
    for (const child of node.children ?? []) visit(child);
  };
  for (const node of element.toArray()) visit(node);
  return output;
}

function uppercaseRatio(value: string): number {
  const letters = [...value].filter((char) => /\p{L}/u.test(char));
  if (letters.length === 0) return 0;
  return letters.filter((char) => char === char.toUpperCase()).length / letters.length;
}

const punctuationEnd = (value: string): boolean => /[.!?]$/u.test(value);

/**
 * A text part carrying no letter or digit - "," or "." on its own - is never an
 * ingredient. It is the residue of splitting a prose paragraph at its inline
 * links, and counting it as ingredient-like is what made thefoodclub store the
 * sentence "Hvis du vil have mere graeskar-inspiration, saa har jeg baade en
 * [graeskarsuppe], [myslibarer med graeskar], [risotto med graeskar] og
 * selvfoelgelig [graeskartaerte]." as the ingredient list of lun-graeskarsalat.
 * The commas between those links became parts of their own, each short and
 * without a sentence-ending mark, so each passed the ingredient test and pushed
 * the paragraph over the threshold.
 */
const barePunctuation = (value: string): boolean => !/[\p{L}\p{N}]/u.test(value);
const parseNipuniServings = (value: string): string | undefined =>
  value.toLocaleLowerCase("da-DK")
    .match(/\((?:ca\.?\s*)?(\d+)(?:\s*-\s*\d+)?\s*person/u)?.[1];

function nipuniLooksIngredient(line: string): boolean {
  const lower = line.toLocaleLowerCase("da-DK");
  if (/^(?:\+?\s*)?(?:\d|evt\b|lidt\b)/u.test(lower)) return true;
  // The legacy IngredientNormalizer treats a parenthetical-only line as a
  // note without an ingredient name. It is therefore skipped here, or (when
  // long enough) classified as an instruction by the next rule.
  if (/^\([^)]*\)$/u.test(line)) return false;
  if (uppercaseRatio(line) >= 0.8 && line.split(/\s+/u).length <= 6) return false;
  return line.split(/\s+/u).length <= 10 && !punctuationEnd(line);
}

const nipuniLooksInstruction = (line: string): boolean =>
  line.split(/\s+/u).length >= 5 || punctuationEnd(line);

function nipuniLooksHeading(lines: string[], index: number): boolean {
  const line = lines[index];
  if (!line || line.split(/\s+/u).length > 6 || punctuationEnd(line)) return false;
  if (uppercaseRatio(line) < 0.6 || parseNipuniServings(line)) return false;
  const next = lines.slice(index + 1, index + 3).find(Boolean);
  return Boolean(next && (nipuniLooksIngredient(next) || nipuniLooksInstruction(next)));
}

export function extractNipuniJulieRecipe(
  html: string,
  canonicalUrl: string
): EmbeddedRecipeExtraction {
  const $ = cheerio.load(html);
  const title = compact($("h1").first().text()) ||
    compact($('meta[property="og:title"]').attr("content")) || compact($("title").text());
  const content = $(".entry-content").first();
  if (!title || content.length === 0) return { incompleteCount: 1, malformedCount: 0 };
  const lines = descendantTextParts(content);
  const recipeStart = lines.findIndex((line) => parseNipuniServings(line) !== undefined);
  if (recipeStart < 0) return { incompleteCount: 1, malformedCount: 0 };

  const description = lines.slice(0, recipeStart)
    .filter((line) => !["kærligst fra", "nip"].includes(line.toLocaleLowerCase("da-DK")))
    .join(" ").trim();
  const recipeLines = lines.slice(recipeStart);
  const ingredients: string[] = [];
  const instructions: Array<{ position: number; text: string }> = [];
  let mode: "ingredients" | "instructions" = "ingredients";
  for (let index = 1; index < recipeLines.length; index += 1) {
    const line = recipeLines[index];
    const next = recipeLines[index + 1];
    const lower = line.toLocaleLowerCase("da-DK");
    if (
      [/^\d+\s+comments?$/u, /^kommentarer lukket/u, /^leave a reply$/u,
        /^cancel reply$/u, /^siger:$/u, /^«$/u, /^»$/u].some((pattern) => pattern.test(lower)) ||
      lower === "," || next === ","
    ) break;
    if (nipuniLooksHeading(recipeLines, index)) {
      mode = "ingredients";
      continue;
    }
    if (mode === "ingredients" && nipuniLooksIngredient(line)) {
      ingredients.push(line);
      continue;
    }
    if (nipuniLooksInstruction(line)) {
      mode = "instructions";
      instructions.push({ position: instructions.length + 1, text: line });
      continue;
    }
    if (mode === "instructions" && nipuniLooksIngredient(line)) {
      mode = "ingredients";
      ingredients.push(line);
    }
  }
  if (ingredients.length === 0 || instructions.length === 0) {
    return { incompleteCount: 1, malformedCount: 0 };
  }
  const image = compact($('meta[property="og:image"]').attr("content"));
  return {
    recipe: {
      canonicalUrl,
      rawRecipe: { lines, recipeStart },
      normalized: {
        title,
        ...(description ? { description } : {}),
        ingredients,
        instructions,
        ...(parseNipuniServings(recipeLines[0]) ? { yieldText: parseNipuniServings(recipeLines[0]) } : {}),
        imageUrls: image ? [new URL(image, canonicalUrl).toString()] : [],
        categories: [],
        cuisines: [],
        keywords: [],
      },
    },
    incompleteCount: 0,
    malformedCount: 0,
  };
}

function foodLooksHeading(text: string): boolean {
  const lower = text.toLocaleLowerCase("da-DK");
  if (text.split(/\s+/u).length > 18) return false;
  const servingToken = ["muffins", "personer", "pers.", "stk."].some((unit) => lower.includes(unit));
  return lower.endsWith(":") || lower.includes("opskrift") || (servingToken && /\d/u.test(lower));
}

const foodHeadingCandidate = (text: string): boolean =>
  text.split(/\s+/u).length <= 8 && !punctuationEnd(text) && !/\d/u.test(text);

function foodLooksIngredient(line: string): boolean {
  if (barePunctuation(line)) return false;
  const lower = line.toLocaleLowerCase("da-DK");
  if (/^(?:ca\.?\s*)?(?:\d|evt\b|lidt\b|friske\b|frisk\b|kakao\b|ladyfingers\b)/u.test(lower)) {
    return true;
  }
  return line.split(/\s+/u).length <= 12 && !punctuationEnd(line);
}

const foodServings = (text: string): string | undefined =>
  text.toLocaleLowerCase("da-DK")
    .match(/(\d+)(?:\s*-\s*\d+)?\s*(?:muffins|personer|pers|stk)/u)?.[1];

export function extractTheFoodClubRecipe(
  html: string,
  canonicalUrl: string
): EmbeddedRecipeExtraction {
  const $ = cheerio.load(html);
  const article = $(".post-entry .inner-post-entry").first();
  const title = compact($("h1.post-title").first().text());
  if (article.length === 0 || !title) return { incompleteCount: 1, malformedCount: 0 };
  const descriptionLines: string[] = [];
  let recipeHeading: string | undefined;
  let pendingHeading: string | undefined;
  let ingredients: string[] = [];
  const instructions: Array<{ position: number; text: string }> = [];
  let started = false;
  const stop = new Set(["was last modified:", "facebook", "twitter", "google +", "pinterest", "tidligere", "næste", "mere af det samme"]);

  for (const element of article.children().toArray()) {
    const child = $(element);
    if ((element as { tagName?: string }).tagName?.toLowerCase() !== "p") {
      if (started && ingredients.length > 0 && instructions.length > 0) break;
      continue;
    }
    const text = compact(child.text());
    if (!text) continue;
    const lower = text.toLocaleLowerCase("da-DK");
    if (stop.has(lower) || lower.startsWith("was last modified")) break;
    const parts = descendantTextParts(child);
    const candidates = foodLooksHeading(parts[0] ?? "") && parts.length >= 4 ? parts.slice(1) : parts;
    const ingredientLike = candidates.filter(foodLooksIngredient).length;
    if (!started && parts.length >= 3 && ingredientLike >= Math.max(3, candidates.length - 1)) {
      if (foodLooksHeading(parts[0] ?? "") && parts.length >= 4) {
        recipeHeading = parts[0].replace(/:$/u, "");
        ingredients = parts.slice(1).filter((part) => !barePunctuation(part));
      } else {
        recipeHeading = pendingHeading;
        ingredients = parts.filter((part) => !barePunctuation(part));
      }
      started = true;
      continue;
    }
    if (!started) {
      if (foodLooksHeading(text)) pendingHeading = text.replace(/:$/u, "");
      else if (foodHeadingCandidate(text)) pendingHeading = text;
      else descriptionLines.push(text);
      continue;
    }
    if (ingredients.length > 0 && (text.split(/\s+/u).length >= 8 || punctuationEnd(text))) {
      instructions.push({ position: instructions.length + 1, text });
      continue;
    }
    if (ingredients.length > 0 && instructions.length > 0) break;
  }
  if (ingredients.length === 0 || instructions.length === 0) {
    return { incompleteCount: 1, malformedCount: 0 };
  }
  const categories = $(".penci-standard-cat .penci-cat-name").map(
    (_index, element) => compact($(element).text())
  ).get().filter(Boolean);
  const image = compact($('meta[property="og:image"]').attr("content"));
  const servings = foodServings(recipeHeading ?? "");
  return {
    recipe: {
      canonicalUrl,
      rawRecipe: { recipeHeading, ingredients, instructions },
      normalized: {
        title,
        ...(descriptionLines.length > 0 ? { description: descriptionLines.join(" ").trim() } : {}),
        ingredients,
        instructions,
        ...(servings ? { yieldText: servings } : {}),
        imageUrls: image ? [new URL(image, canonicalUrl).toString()] : [],
        categories,
        cuisines: [],
        keywords: [],
      },
    },
    incompleteCount: 0,
    malformedCount: 0,
  };
}
