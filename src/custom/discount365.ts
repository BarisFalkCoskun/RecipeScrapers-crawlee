import * as cheerio from "cheerio";
import type { NormalizedRecipeV2 } from "../types.js";
import type {
  EmbeddedRecipe,
  EmbeddedRecipeExtraction,
} from "./spisbedre.js";

const MAX_INGREDIENTS = 35;
const MAX_INSTRUCTIONS = 15;
const SECTION_HEADINGS = new Set(["vafler", "topping", "falafler", "coleslaw", "plus"]);
const INSTRUCTION_HEADINGS = new Set(["fremgangsmåde", "sådan gør du"]);
const IGNORE_LINES = new Set(["og", "velbekomme", "simpelt og lækkert - velbekomme"]);

const clean = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";

function textLines(element: cheerio.Element): string[] {
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

function parseServings(line: string): { count: number; unit?: string } | undefined {
  const lower = line.toLocaleLowerCase("da");
  const patterns = [
    /opskrift til\s+(\d+)\s*(pers|personer)?/u,
    /det skal du bruge til\s+(\d+)\s*([a-zæøå]+)?/u,
    /(\d+)\s*(pers|personer|burgere)/u,
  ];
  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) return { count: Number(match[1]), ...(match[2] ? { unit: match[2] } : {}) };
  }
  return undefined;
}

const isServingsLine = (line: string): boolean => parseServings(line) !== undefined;
const isIngredientHeading = (line: string): boolean => {
  const lower = line.toLocaleLowerCase("da").replace(/:$/u, "");
  return lower.startsWith("ingredienser") || lower.startsWith("det skal du bruge");
};
const isInstructionHeading = (line: string): boolean =>
  INSTRUCTION_HEADINGS.has(line.toLocaleLowerCase("da").replace(/:$/u, ""));
const isSectionHeading = (line: string): boolean => {
  const normalized = line.toLocaleLowerCase("da").replace(/:$/u, "");
  return SECTION_HEADINGS.has(normalized) || (line.endsWith(":") && line.split(/\s+/u).length <= 6);
};

function shouldIgnoreLine(line: string): boolean {
  const lower = line.toLocaleLowerCase("da");
  return IGNORE_LINES.has(lower) || lower.startsWith("i samarbejde med") ||
    lower.startsWith("følg nedenstående opskrift") || lower.startsWith("videoen kan du også") ||
    lower.startsWith("du kan købe alle ingredienser") || lower.startsWith("lokale 365discount") ||
    lower.startsWith("@");
}

const shouldIgnoreInstruction = (line: string): boolean =>
  shouldIgnoreLine(line) || line.toLocaleLowerCase("da").startsWith("i hele portionen");

function isIngredient(line: string): boolean {
  if (isIngredientHeading(line) || isInstructionHeading(line) || isSectionHeading(line) ||
      isServingsLine(line)) return false;
  if (line.toLocaleLowerCase("da").startsWith("serveres med ")) return true;
  if (/^(?:ca\.?\s*)?\d/iu.test(line)) return true;
  const nameWithoutNote = line.replace(/\([^)]*\)/gu, "").trim();
  return line.split(/\s+/u).length <= 6 && !/[.!?]$/u.test(line) &&
    /\p{L}/u.test(nameWithoutNote);
}

const isInstruction = (line: string): boolean =>
  !isServingsLine(line) && (/^\d+\./u.test(line) || line.split(/\s+/u).length >= 6);

const isRecipeContainer = (lines: string[]): boolean => lines.some((line) =>
  isIngredientHeading(line) || isInstructionHeading(line) || isServingsLine(line) ||
  isSectionHeading(line) || /^(?:ca\.?\s*)?\d/iu.test(line.toLocaleLowerCase("da"))
);

function nextLine(lines: string[], start: number): string | undefined {
  return lines.slice(start).find(Boolean);
}

function normalizeSection(line: string): string | undefined {
  const normalized = clean(line).replace(/:$/u, "");
  if (isIngredientHeading(normalized) || isInstructionHeading(normalized) ||
      normalized.toLocaleLowerCase("da") === "opskrift til") return undefined;
  return normalized || undefined;
}

function extractContent(containers: string[][]): {
  ingredients: string[];
  instructions: string[];
  servings?: { count: number; unit?: string };
} {
  const ingredients: string[] = [];
  const instructions: string[] = [];
  let servings: { count: number; unit?: string } | undefined;

  for (const lines of containers) {
    if (!isRecipeContainer(lines)) continue;
    let mode: "ingredients" | "instructions" | undefined;
    let section: string | undefined;

    for (const [index, line] of lines.entries()) {
      servings ??= parseServings(line);
      if (shouldIgnoreLine(line)) continue;
      if (isInstructionHeading(line)) {
        mode = "instructions";
        section = undefined;
        continue;
      }
      if (isIngredientHeading(line)) {
        mode = "ingredients";
        section = undefined;
        continue;
      }
      if (!mode && isSectionHeading(line)) {
        const following = nextLine(lines, index + 1);
        if (following && (isServingsLine(following) || isIngredient(following) || isInstruction(following))) {
          mode = "ingredients";
          section = normalizeSection(line);
          continue;
        }
      }
      if (!mode) {
        if (isIngredient(line)) mode = "ingredients";
        else if (isInstruction(line)) mode = "instructions";
        else continue;
      }
      if (mode === "ingredients") {
        if (isSectionHeading(line)) {
          section = normalizeSection(line);
          continue;
        }
        if (isIngredient(line)) {
          // The V2 material contract intentionally preserves the legacy
          // ingredient `original`; section metadata remains in the raw payload.
          ingredients.push(line);
          continue;
        }
        if (isInstruction(line)) mode = "instructions";
        else continue;
      }
      if (mode === "instructions") {
        if (shouldIgnoreInstruction(line)) continue;
        if (isSectionHeading(line)) {
          const following = nextLine(lines, index + 1);
          if (following && isIngredient(following)) {
            mode = "ingredients";
            section = normalizeSection(line);
            continue;
          }
        }
        const instruction = line.replace(/^\d+\.\s*/u, "").trim();
        if (instruction) instructions.push(instruction);
      }
    }
    void section;
  }
  return { ingredients, instructions, ...(servings ? { servings } : {}) };
}

function fragmentUrl(baseUrl: string, title: string): string {
  const slug = title.normalize("NFKD").replace(/\p{M}/gu, "")
    .replace(/[^\x00-\x7F]/gu, "").toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  return slug ? `${baseUrl.replace(/\/$/u, "")}#${slug}` : baseUrl;
}

function buildRecipe(input: {
  canonicalUrl: string;
  title: string;
  containers: string[][];
  imageUrls: string[];
  description?: string;
  useFragment: boolean;
}): EmbeddedRecipe | undefined {
  const content = extractContent(input.containers);
  if (content.ingredients.length === 0 || content.instructions.length === 0 ||
      content.ingredients.length > MAX_INGREDIENTS || content.instructions.length > MAX_INSTRUCTIONS) {
    return undefined;
  }
  const canonicalUrl = input.useFragment ? fragmentUrl(input.canonicalUrl, input.title) : input.canonicalUrl;
  const yieldText = content.servings
    ? [String(content.servings.count), content.servings.unit].filter(Boolean).join(" ")
    : undefined;
  const normalized: NormalizedRecipeV2 = {
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    ingredients: content.ingredients,
    instructions: content.instructions.map((text, index) => ({ position: index + 1, text })),
    ...(yieldText ? { yieldText } : {}),
    imageUrls: input.imageUrls,
    categories: [],
    cuisines: [],
    keywords: [],
  };
  return {
    canonicalUrl,
    preserveCanonicalFragment: input.useFragment,
    rawRecipe: {
      title: input.title,
      description: input.description ?? null,
      ingredients: [...content.ingredients],
      instructions: [...content.instructions],
      servings: content.servings?.count ?? null,
      servingsUnit: content.servings?.unit ?? null,
      imageUrls: [...input.imageUrls],
    },
    normalized,
  };
}

function titledBlocks(containers: string[][]): Array<{ title: string; containers: string[][] }> {
  const blocks: Array<{ title: string; containers: string[][] }> = [];
  let current: { title: string; containers: string[][] } | undefined;
  for (const lines of containers) {
    const title = clean(lines[0]);
    const titled = lines.length >= 2 && title !== "" && !shouldIgnoreLine(title) &&
      !isIngredientHeading(title) && !isInstructionHeading(title) && !isServingsLine(title) &&
      !isSectionHeading(title) && title.split(/\s+/u).length >= 2 && isRecipeContainer(lines.slice(1));
    if (titled) {
      if (current) blocks.push(current);
      current = { title, containers: [lines] };
    } else if (current && isRecipeContainer(lines)) {
      current.containers.push(lines);
    } else if (current) {
      blocks.push(current);
      current = undefined;
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function description(containers: string[][], title: string): string | undefined {
  for (const lines of containers.slice(0, 3)) {
    if (isRecipeContainer(lines)) continue;
    for (const line of lines) {
      const lower = line.toLocaleLowerCase("da");
      if (line === title || isIngredientHeading(line) || isInstructionHeading(line) ||
          isSectionHeading(line) || isServingsLine(line) || lower.includes("@365discount") ||
          lower.startsWith("følg nedenstående opskrift") || lower.startsWith("videoen kan du også") ||
          lower.startsWith("du kan købe alle ingredienser") || line.length < 30 || !/[.!?]/u.test(line)) continue;
      return line;
    }
  }
  return undefined;
}

export function extractDiscount365Recipes(
  html: string,
  canonicalUrl: string
): EmbeddedRecipeExtraction {
  const $ = cheerio.load(html);
  const containers = $("main .text-container").toArray().map(textLines).filter((lines) => lines.length > 0);
  const preferredImages = $("main .componentImage img.rounded-sm[src]").toArray();
  const imageElements = preferredImages.length > 0 ? preferredImages : $("main img[src]").toArray();
  const imageUrls = [...new Set(imageElements.map((element) => clean($(element).attr("src")))
    .filter(Boolean).map((url) => new URL(url, canonicalUrl).toString()))];
  const blocks = titledBlocks(containers);
  if (blocks.length > 0) {
    const recipes = blocks.map((block) => buildRecipe({
      canonicalUrl,
      title: block.title,
      containers: block.containers,
      imageUrls,
      useFragment: blocks.length > 1,
    })).filter((recipe): recipe is EmbeddedRecipe => recipe !== undefined);
    if (recipes.length > 0) {
      return { recipes, incompleteCount: blocks.length - recipes.length, malformedCount: 0 };
    }
  }
  const title = clean($("meta[property='og:title']").attr("content")) ||
    clean($("title").first().text()) || clean($("h1").first().text());
  const cleanedTitle = title.replace(/\s*-\s*365discount$/iu, "");
  if (!cleanedTitle) return { incompleteCount: 1, malformedCount: 0 };
  const recipe = buildRecipe({
    canonicalUrl,
    title: cleanedTitle,
    containers,
    imageUrls,
    description: description(containers, cleanedTitle),
    useFragment: false,
  });
  return recipe
    ? { recipe, incompleteCount: 0, malformedCount: 0 }
    : { incompleteCount: 1, malformedCount: 0 };
}
