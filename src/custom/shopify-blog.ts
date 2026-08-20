import * as cheerio from "cheerio";
import type { NormalizedRecipeV2 } from "../types.js";
import type { EmbeddedRecipeExtraction } from "./spisbedre.js";

export type ShopifyBlogSourceId =
  | "vinpusheren"
  | "hvidlogvin"
  | "hejholger"
  | "mondaybliss";

const clean = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";

const linesWithin = (
  $: cheerio.CheerioAPI,
  selector: string
): string[] => {
  const output: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value !== "object" || value === null) return;
    const node = value as { type?: string; data?: string; children?: unknown[] };
    if (node.type === "text") {
      const line = clean(node.data);
      if (line) output.push(line);
      return;
    }
    for (const child of node.children ?? []) visit(child);
  };
  const root = $(selector).first().get(0) as
    { children?: unknown[] } | undefined;
  for (const child of root?.children ?? []) visit(child);
  return output;
};

const uniqueSequential = (lines: string[]): string[] => lines.filter(
  (line, index) => index === 0 || line !== lines[index - 1]
);

const contentLines = (lines: string[]): string[] => uniqueSequential(lines)
  .filter((line) => !/^(?:<|&lt;)(?:img|script|style)\b/iu.test(line));

function result(input: {
  canonicalUrl: string;
  title: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  yieldText?: string;
  totalMinutes?: number;
  imageUrl?: string;
  category: string;
}): EmbeddedRecipeExtraction {
  if (input.title === "" || input.ingredients.length === 0 || input.instructions.length === 0) {
    return { incompleteCount: 1, malformedCount: 0 };
  }
  const normalized: NormalizedRecipeV2 = {
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    ingredients: input.ingredients,
    instructions: input.instructions.map((text, index) => ({ position: index + 1, text })),
    ...(input.yieldText ? { yieldText: input.yieldText } : {}),
    ...(input.totalMinutes ? { totalMinutes: input.totalMinutes } : {}),
    imageUrls: input.imageUrl ? [input.imageUrl] : [],
    categories: [input.category],
    cuisines: [],
    keywords: [],
  };
  return {
    recipe: {
      canonicalUrl: input.canonicalUrl,
      rawRecipe: {
        title: input.title,
        description: input.description ?? "",
        ingredients: [...input.ingredients],
        instructions: [...input.instructions],
        yieldText: input.yieldText ?? null,
        totalMinutes: input.totalMinutes ?? null,
        imageUrl: input.imageUrl ?? null,
      },
      normalized,
    },
    incompleteCount: 0,
    malformedCount: 0,
  };
}

function extractVinpusheren(
  $: cheerio.CheerioAPI,
  canonicalUrl: string
): EmbeddedRecipeExtraction {
  const title = clean($("h1").first().text());
  const lines = contentLines(linesWithin($, ".article-template__content"));
  const servingsIndex = lines.findIndex((line) => /\b\d+(?:\s*-\s*\d+)?\s*person/iu.test(line));
  const instructionsIndex = lines.findIndex((line) => line.toLocaleLowerCase("da").startsWith("fremgangsmåde"));
  if (instructionsIndex < 0) return { incompleteCount: 1, malformedCount: 0 };
  const stop = new Set(["tips og tilbehør", "vin"]);
  const ingredientStart = servingsIndex >= 0 ? servingsIndex + 1 : 0;
  const ingredients = lines.slice(ingredientStart, instructionsIndex)
    .filter((line) => !stop.has(line.toLocaleLowerCase("da").replace(/:$/u, "")));
  const instructions: string[] = [];
  for (const line of lines.slice(instructionsIndex + 1)) {
    if (stop.has(line.toLocaleLowerCase("da").replace(/:$/u, ""))) break;
    const step = line.replace(/^\d+[.)]\s*/u, "").trim();
    if (step) instructions.push(step);
  }
  const servingLine = servingsIndex >= 0 ? lines[servingsIndex] : "";
  const servingMatch = servingLine.match(/(\d+)(?:\s*-\s*\d+)?\s*person/iu);
  const timeMatch = servingLine.match(/arbejdstid[: ]+(\d+)(?:\s*-\s*\d+)?\s*min/iu);
  const image = clean($("meta[property='og:image']").attr("content"));
  return result({
    canonicalUrl,
    title,
    description: clean(lines.slice(0, Math.max(servingsIndex, 0)).join(" ")),
    ingredients,
    instructions,
    ...(servingMatch ? { yieldText: `${servingMatch[1]} personer` } : {}),
    ...(timeMatch ? { totalMinutes: Number(timeMatch[1]) } : {}),
    ...(image ? { imageUrl: new URL(image, canonicalUrl).toString() } : {}),
    category: "Opskrifter",
  });
}

function extractHvidlogvin(
  $: cheerio.CheerioAPI,
  canonicalUrl: string
): EmbeddedRecipeExtraction {
  const title = clean($("h1.article-page__heading").first().text()) ||
    clean($("h1").first().text());
  let lines = contentLines(linesWithin($, ".article-page"))
    .filter((line) => !new Set(["forside", "blog", "/"]).has(line.toLocaleLowerCase("da")));
  const titleIndex = lines.lastIndexOf(title);
  if (titleIndex >= 0) lines = lines.slice(titleIndex + 1);
  const stop = new Set(["del:", "tweet", "del", "pin det"]);
  const ingredients: string[] = [];
  const instructions: string[] = [];
  let inInstructions = false;
  for (const line of lines) {
    if (stop.has(line.toLocaleLowerCase("da"))) break;
    if (!inInstructions && (/[.!?]$/u.test(line) || line.includes(". "))) {
      inInstructions = true;
    }
    if (inInstructions) instructions.push(line);
    else ingredients.push(line.replace(/(\d)\s*[–-]\s*(\d)/gu, "$1-$2"));
  }
  const joined = lines.slice(0, 8).join(" ");
  const servings = joined.match(/(\d+)\s*(?:-\s*\d+\s+)?\w+\s+pr person/iu);
  const image = clean($("meta[property='og:image']").attr("content"));
  if (ingredients.length < 2) return { incompleteCount: 1, malformedCount: 0 };
  return result({
    canonicalUrl,
    title,
    ingredients,
    instructions,
    ...(servings ? { yieldText: `${servings[1]} personer` } : {}),
    ...(image ? { imageUrl: new URL(image, canonicalUrl).toString() } : {}),
    category: "Opskrifter",
  });
}

function minutes(value: string): number | undefined {
  const hours = value.match(/(\d+(?:[.,]\d+)?)\s*(?:time|timer|t\b)/iu);
  const mins = value.match(/(\d+)\s*(?:min|minutter)/iu);
  const total = (hours ? Number(hours[1].replace(",", ".")) * 60 : 0) +
    (mins ? Number(mins[1]) : 0);
  return total > 0 ? total : undefined;
}

function nextElementText(
  $: cheerio.CheerioAPI,
  element: cheerio.Element
): string {
  return clean($(element).nextAll("p").first().text());
}

function extractHejholger(
  $: cheerio.CheerioAPI,
  canonicalUrl: string
): EmbeddedRecipeExtraction {
  const article = $("article").first();
  const title = clean($("h1").first().text());
  const ingredients: string[] = [];
  article.find("table tr").each((_index, row) => {
    const cells = $(row).find("th, td").map((_cellIndex, cell) => clean($(cell).text()))
      .get().filter(Boolean);
    if (cells.length < 2 || ["ingrediens", "ingredienser"].includes(
      cells[0].toLocaleLowerCase("da").replace(/:$/u, "")
    )) return;
    ingredients.push(`${cells[0]} ${cells[1]}`.trim());
  });

  const instructions: string[] = [];
  const instructionHeading = article.find("h2").filter((_index, heading) =>
    clean($(heading).text()) === "Sådan gør du"
  ).first();
  let sibling = instructionHeading.next();
  while (sibling.length > 0 && !["h2", "h3"].includes(sibling.get(0)?.tagName ?? "")) {
    if (sibling.is("ol")) {
      sibling.find("li").each((_index, item) => {
        const step = clean($(item).text());
        if (step) instructions.push(step);
      });
    } else if (sibling.is("p")) {
      const step = clean(sibling.text()).replace(/^\d+[.)]?\s*/u, "");
      if (step) instructions.push(step);
    }
    sibling = sibling.next();
  }

  let description = "";
  article.find("h2").each((_index, heading) => {
    if (!description && clean($(heading).text()).includes("Opskrift")) {
      description = nextElementText($, heading);
    }
  });
  let servings: string | undefined;
  let totalMinutes: number | undefined;
  article.find("h3").each((_index, heading) => {
    const label = clean($(heading).text());
    const value = nextElementText($, heading);
    if (label === "Antal") servings = value.match(/\d+/u)?.[0];
    if (label === "Tid") totalMinutes = minutes(value);
  });
  const image = clean($("meta[property='og:image']").attr("content"));
  return result({
    canonicalUrl,
    title,
    ...(description ? { description } : {}),
    ingredients,
    instructions,
    ...(servings ? { yieldText: servings } : {}),
    ...(totalMinutes ? { totalMinutes } : {}),
    ...(image ? { imageUrl: new URL(image, canonicalUrl).toString() } : {}),
    category: "Opskrifter",
  });
}

const MONDAY_INSTRUCTION_HEADINGS = new Set(["fremgangsmåde", "sådan gør du"]);
const MONDAY_NAVIGATION_LINES = new Set(["læser nu:", "forrige", "næste"]);

const mondayHeading = (line: string, headings: Set<string>): boolean =>
  headings.has(line.toLocaleLowerCase("da").replace(/:$/u, ""));

function mondayLooksLikeSectionHeading(line: string): boolean {
  if (mondayHeading(line, MONDAY_INSTRUCTION_HEADINGS) ||
    line.toLocaleLowerCase("da").replace(/:$/u, "").startsWith("ingredienser")) return false;
  const value = line.replace(/^[✨🍚\s]+/u, "").replace(/:$/u, "");
  return value.split(/\s+/u).length <= 5 &&
    !/[.!?]$/u.test(value) &&
    !/^(?:ca\.?\s*)?\d/iu.test(value);
}

function mondayLooksLikeIngredient(line: string): boolean {
  const lower = line.toLocaleLowerCase("da");
  if (mondayHeading(line, MONDAY_INSTRUCTION_HEADINGS) ||
    lower.replace(/:$/u, "").startsWith("ingredienser")) return false;
  if (/^(?:ca\.?\s*)?\d/iu.test(lower) || /^(?:en|et|lidt)\b/iu.test(lower)) return true;
  if (line.includes("&") && line.split(/\s+/u).length <= 4 && !/[.!?:]$/u.test(line)) return true;
  return mondayParsedName(line) !== "" &&
    line.split(/\s+/u).length <= 10 && !/[.!?:]$/u.test(line);
}

function mondayParsedName(line: string): string {
  let value = line.trim()
    .replace(/^[*+"'\-–—•·]+\s*/u, "")
    .replace(/\s*\([^)]*\)/gu, "")
    .trim()
    .replace(/½/gu, "0.5").replace(/¼/gu, "0.25").replace(/¾/gu, "0.75")
    .replace(/⅓/gu, "0.333").replace(/⅔/gu, "0.667");
  value = value.replace(
    /^(?:ca\.?\s*)?\d*[,.]?\d+(?:\/\d+)?(?:\s*-\s*\d*[,.]?\d+(?:\/\d+)?)?\s*/iu,
    ""
  );
  value = value.replace(
    /^(?:spiseskefulde?|teskefulde?|milliliters?|deciliter|centiliter|knivspids|håndfuld|dråber?|skiver?|kviste?|dåser?|pakke|bundt|gram(?:s)?|kilos?|liters?|spsk|tsk|stk|fed|pose|bdt|blade?|nip|ml|dl|cl|kg|pk|g|l)\.?\s+/iu,
    ""
  );
  return value.replace(/^[ ,.:"'*+•·-]+|[ ,.:"'*+•·-]+$/gu, "").trim();
}

const mondayLooksLikeInstruction = (line: string): boolean =>
  /^\d+[.)]\s*/u.test(line) || line.split(/\s+/u).length >= 4 || /[.!?]$/u.test(line);

function mondaySectionAt(lines: string[], index: number, instruction: boolean): boolean {
  const line = lines[index];
  if (!line || !mondayLooksLikeSectionHeading(line)) return false;
  const next = lines.slice(index + 1, index + 3).filter(Boolean);
  if (instruction) return next.length > 0 && mondayLooksLikeInstruction(next[0]);
  const value = line.replace(/^[✨🍚\s]+/u, "").replace(/:$/u, "");
  return !/^(?:ca\.?\s*)?(?:\d|en\b|et\b|lidt\b)/iu.test(value) &&
    !value.includes("&") && next.length === 2 && next.every(mondayLooksLikeIngredient);
}

function mondayServings(line: string): string | undefined {
  const lower = line.toLocaleLowerCase("da").replace(/–/gu, "-");
  for (const pattern of [
    /opskriften er til\s+(en|et|\d+)(?:\s*-\s*\d+)?\s*(pers|person|personer)?/iu,
    /her er til\s+(en|et|\d+)(?:\s*-\s*\d+)?\s*(pers|person|personer)?/iu,
    /ingredienser\s*\((?:ca\.?\s*)?(en|et|\d+)(?:\s*-\s*\d+)?\s*(pers|person|personer)\.?\)/iu,
  ]) {
    const match = lower.match(pattern);
    if (!match) continue;
    const count = ["en", "et"].includes(match[1]) ? "1" : match[1];
    return match[2] ? `${count} ${match[2]}` : count;
  }
  return undefined;
}

function extractMondayBliss(
  $: cheerio.CheerioAPI,
  canonicalUrl: string
): EmbeddedRecipeExtraction {
  const rawTitle = clean($("h1").first().text()) ||
    clean($("meta[property='og:title']").attr("content")) || clean($("title").text());
  const title = rawTitle.replace(/\s+[–-]\s+MonDay Bliss$/iu, "");
  let lines = contentLines(linesWithin($, "article"));
  const titleIndexes = lines.flatMap((line, index) =>
    line.toLocaleLowerCase("da") === title.toLocaleLowerCase("da") ? [index] : []);
  if (titleIndexes.length > 0) lines = lines.slice(titleIndexes.at(-1)! + 1);
  lines = lines.filter((line) => !MONDAY_NAVIGATION_LINES.has(line.toLocaleLowerCase("da")));

  const instructionIndex = lines.findIndex((line) => mondayHeading(line, MONDAY_INSTRUCTION_HEADINGS));
  const before = instructionIndex >= 0 ? lines.slice(0, instructionIndex) : lines;
  const after = instructionIndex >= 0 ? lines.slice(instructionIndex + 1) : [];
  const description: string[] = [];
  const ingredients: string[] = [];
  const instructions: string[] = [];
  let foundIngredients = false;
  let yieldText: string | undefined;

  for (let index = 0; index < before.length; index += 1) {
    const line = before[index];
    if (!yieldText) {
      yieldText = mondayServings(line);
      if (yieldText) {
        foundIngredients = true;
        continue;
      }
    }
    if (line.toLocaleLowerCase("da").replace(/:$/u, "").startsWith("ingredienser")) {
      foundIngredients = true;
      continue;
    }
    if (foundIngredients && mondaySectionAt(before, index, false)) continue;
    if (foundIngredients && mondayLooksLikeIngredient(line)) {
      ingredients.push(line);
      continue;
    }
    if (foundIngredients && mondayLooksLikeInstruction(line)) {
      instructions.push(line);
      continue;
    }
    if (!foundIngredients) description.push(line);
  }
  for (let index = 0; index < after.length; index += 1) {
    const line = after[index];
    if (mondaySectionAt(after, index, true)) continue;
    if (!mondayLooksLikeInstruction(line)) continue;
    const step = line.replace(/^\d+[.)]\s*/u, "").trim();
    if (step) instructions.push(step);
  }

  const metaDescription = clean($("meta[name='description']").attr("content"));
  const image = clean($("meta[property='og:image']").attr("content"));
  return result({
    canonicalUrl,
    title,
    description: metaDescription || description.join(" "),
    ingredients,
    instructions,
    ...(yieldText ? { yieldText } : {}),
    ...(image ? { imageUrl: new URL(image, canonicalUrl).toString() } : {}),
    category: "Madopskrifter",
  });
}

export function extractShopifyBlogRecipe(input: {
  sourceId: ShopifyBlogSourceId;
  html: string;
  canonicalUrl: string;
}): EmbeddedRecipeExtraction {
  const $ = cheerio.load(input.html);
  if (input.sourceId === "vinpusheren") return extractVinpusheren($, input.canonicalUrl);
  if (input.sourceId === "hvidlogvin") return extractHvidlogvin($, input.canonicalUrl);
  if (input.sourceId === "hejholger") return extractHejholger($, input.canonicalUrl);
  return extractMondayBliss($, input.canonicalUrl);
}
