import * as cheerio from "cheerio";
import type { NormalizedRecipeV2 } from "../types.js";
import type { EmbeddedRecipeExtraction } from "./spisbedre.js";

const clean = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";

function textLines($: cheerio.CheerioAPI, element: cheerio.Element): string[] {
  const lines: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value !== "object" || value === null) return;
    const node = value as { type?: string; data?: string; children?: unknown[] };
    if (node.type === "text") {
      const line = clean(node.data);
      if (line) lines.push(line);
      return;
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(element);
  return lines;
}

function parsedName(line: string): string {
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

const instructionHeading = (line: string): boolean => {
  const lower = line.toLocaleLowerCase("da");
  return lower.includes("sådan laver du") || lower.includes("fremgangsmåde");
};

const sectionHeading = (line: string): boolean => {
  const value = line.replace(/:$/u, "");
  return value.split(/\s+/u).length <= 4 && !/[.!?]$/u.test(value) &&
    (value === value.toLocaleUpperCase("da") || line.endsWith(":"));
};

const ingredientLine = (line: string): boolean => {
  if (/^(?:ca\.?\s*)?(?:\d|olie\b|salt\b|peber\b|lune\b|groft\b)/iu.test(line)) return true;
  return parsedName(line) !== "" && line.split(/\s+/u).length <= 14 && !/[.!?]$/u.test(line);
};

const instructionLine = (line: string): boolean =>
  line.split(/\s+/u).length >= 8 || /[.!?]$/u.test(line);

export function extractFeminaRecipe(
  html: string,
  canonicalUrl: string
): EmbeddedRecipeExtraction {
  const $ = cheerio.load(html);
  const title = clean($("h1").first().text());
  if (!title || $(".wysiwyg").length === 0) {
    return { incompleteCount: 1, malformedCount: 0 };
  }
  const ingredients: string[] = [];
  const instructions: string[] = [];
  let servings: number | undefined;
  let description = clean($("meta[name='description']").attr("content"));
  let inInstructions = false;
  let foundRecipeContent = false;
  const stopText = new Set([
    "få indkøbslisten til hele ugen her",
    "ugens andre opskrifter",
    "tip:",
  ]);

  $(".wysiwyg").each((_blockIndex, block) => {
    $(block).find("p").each((_paragraphIndex, paragraph) => {
      for (const part of textLines($, paragraph)) {
        const lower = part.toLocaleLowerCase("da");
        if (stopText.has(lower) || lower.startsWith("få indkøbslisten")) break;
        if (servings === undefined) {
          const match = lower.match(/til\s+(\d+)\s+person/u) ??
            lower.match(/opskriften er til\s+(\d+)\s+person/u);
          if (match) {
            servings = Number(match[1]);
            foundRecipeContent = true;
            continue;
          }
        }
        if (instructionHeading(part)) {
          inInstructions = true;
          foundRecipeContent = true;
          continue;
        }
        if (sectionHeading(part)) {
          inInstructions = false;
          foundRecipeContent = true;
          continue;
        }
        if (!foundRecipeContent && !description && instructionLine(part)) {
          description = part;
          continue;
        }
        if (ingredientLine(part) && !inInstructions) {
          ingredients.push(part);
          foundRecipeContent = true;
          continue;
        }
        if (instructionLine(part)) {
          inInstructions = true;
          const step = part.replace(/^\d+[.)]\s*/u, "").trim();
          if (step) instructions.push(step);
          foundRecipeContent = true;
        }
      }
    });
  });

  if (ingredients.length === 0 || instructions.length === 0) {
    return { incompleteCount: 1, malformedCount: 0 };
  }
  const image = clean($("meta[property='og:image']").attr("content"));
  const normalized: NormalizedRecipeV2 = {
    title,
    ...(description ? { description } : {}),
    ingredients,
    instructions: instructions.map((text, index) => ({ position: index + 1, text })),
    ...(servings !== undefined ? { yieldText: String(servings) } : {}),
    imageUrls: image ? [new URL(image, canonicalUrl).toString()] : [],
    categories: ["Mad"],
    cuisines: [],
    keywords: [],
  };
  return {
    recipe: {
      canonicalUrl,
      rawRecipe: { title, description, ingredients, instructions, servings: servings ?? null },
      normalized,
    },
    incompleteCount: 0,
    malformedCount: 0,
  };
}
