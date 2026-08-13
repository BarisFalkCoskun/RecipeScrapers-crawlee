import { Binary } from "mongodb";
import { gzipSync } from "node:zlib";
import type {
  NormalizedRecipeInstruction,
  NormalizedRecipeV2,
  RecipeDocumentV2,
} from "../types.js";
import { hashRecipe } from "../utils/hash.js";

export interface CompleteJsonLdExtraction {
  rawScripts: string[];
  recipes: Record<string, unknown>[];
  rejectedReasons: Array<"incomplete-json-ld" | "malformed-json-ld">;
}

export interface BuildRecipeDocumentV2Input {
  sourceId: string;
  canonicalUrl: string;
  pageUrl: string;
  crawlRunId: string;
  crawlAttemptId: string;
  extractedAt: Date;
  rawRecipe: Record<string, unknown>;
  language: string;
  languageConfidence: number;
  languageSignals: string[];
  extractorVersion: string;
  extractionSignals: string[];
}

/**
 * Extracts only complete Recipe JSON-LD and preserves the exact script bodies
 * separately for page persistence. Legacy extraction remains intentionally lax.
 */
export function extractCompleteJsonLdRecipes(
  html: string
): CompleteJsonLdExtraction {
  const rawScripts = extractJsonLdScriptBodies(html);
  const recipes: Record<string, unknown>[] = [];
  const rejectedReasons: CompleteJsonLdExtraction["rejectedReasons"] = [];

  for (const rawScript of rawScripts) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(decodeJsonEntities(rawScript));
    } catch {
      rejectedReasons.push("malformed-json-ld");
      continue;
    }

    for (const recipe of findRecipeNodes(parsed)) {
      if (isCompleteRecipe(recipe)) {
        recipes.push(recipe);
      } else {
        rejectedReasons.push("incomplete-json-ld");
      }
    }
  }

  return {
    rawScripts,
    recipes,
    rejectedReasons: Array.from(new Set(rejectedReasons)),
  };
}

/** Compresses each exact source script independently so raw provenance survives. */
export function gzipJsonLdScripts(rawScripts: string[]): Binary[] {
  return rawScripts.map((rawScript) => new Binary(gzipSync(Buffer.from(rawScript))));
}

export function buildRecipeDocumentV2(
  input: BuildRecipeDocumentV2Input
): Omit<RecipeDocumentV2, "_id"> {
  const rawRecipe = structuredClone(input.rawRecipe);
  const normalized = normalizeRecipeV2(rawRecipe);
  const sourceHash = hashRecipe(rawRecipe);
  const contentHash = hashRecipe(normalized as unknown as Record<string, unknown>);
  const sourceRecipeKey = createSourceRecipeKey({
    sourceId: input.sourceId,
    canonicalUrl: input.canonicalUrl,
    upstreamId: firstString(rawRecipe["@id"]),
    normalized,
  });

  return {
    schemaVersion: 2,
    sourceId: input.sourceId,
    sourceRecipeKey,
    canonicalUrl: input.canonicalUrl,
    pageUrl: input.pageUrl,
    crawlRunId: input.crawlRunId,
    crawlAttemptId: input.crawlAttemptId,
    createdAt: input.extractedAt,
    updatedAt: input.extractedAt,
    extractedAt: input.extractedAt,
    language: input.language,
    languageConfidence: input.languageConfidence,
    languageSignals: [...input.languageSignals],
    extractionMethod: "json-ld",
    extractorVersion: input.extractorVersion,
    extractionConfidence: 1,
    extractionSignals: [...input.extractionSignals],
    rawRecipe,
    normalized,
    sourceHash,
    contentHash,
    contentMatches: [],
  };
}

export function normalizeRecipeV2(
  rawRecipe: Record<string, unknown>
): NormalizedRecipeV2 {
  if (!isCompleteRecipe(rawRecipe)) {
    throw new Error("Complete Recipe JSON-LD requires title, ingredients, and instructions");
  }

  const title = firstString(
    rawRecipe["name"],
    rawRecipe["headline"],
    rawRecipe["title"]
  );
  const ingredients = normalizeStrings(
    rawRecipe["recipeIngredient"] ?? rawRecipe["ingredients"]
  );
  const instructions = normalizeInstructions(rawRecipe["recipeInstructions"]);
  const normalized: NormalizedRecipeV2 = {
    title: title as string,
    ingredients,
    instructions,
    imageUrls: normalizeImageUrls(rawRecipe["image"]),
    categories: normalizeStrings(rawRecipe["recipeCategory"]),
    cuisines: normalizeStrings(rawRecipe["recipeCuisine"]),
    keywords: normalizeKeywords(rawRecipe["keywords"]),
  };

  const description = firstString(rawRecipe["description"]);
  const recipeYield = firstString(rawRecipe["recipeYield"], rawRecipe["yield"]);
  const nutrition = rawRecipe["nutrition"];
  if (description) normalized.description = description;
  if (recipeYield) normalized.yieldText = recipeYield;
  if (typeof nutrition === "object" && nutrition !== null && !Array.isArray(nutrition)) {
    normalized.nutrition = structuredClone(nutrition as Record<string, unknown>);
  }

  for (const [sourceField, targetField] of [
    ["prepTime", "prepMinutes"],
    ["cookTime", "cookMinutes"],
    ["totalTime", "totalMinutes"],
  ] as const) {
    const minutes = parseIsoDurationMinutes(rawRecipe[sourceField]);
    if (minutes !== undefined) normalized[targetField] = minutes;
  }

  return normalized;
}

function createSourceRecipeKey({
  sourceId,
  canonicalUrl,
  upstreamId,
  normalized,
}: {
  sourceId: string;
  canonicalUrl: string;
  upstreamId: string | undefined;
  normalized: NormalizedRecipeV2;
}): string {
  const stableIdentity = {
    title: normalized.title,
    ingredients: normalized.ingredients,
    instructions: normalized.instructions.map((instruction) => instruction.text),
    totalMinutes: normalized.totalMinutes,
    yieldText: normalized.yieldText,
  };
  const keyHash = hashRecipe({
    sourceId,
    canonicalUrl,
    upstreamId: upstreamId ?? null,
    stableIdentity,
  });
  return `${sourceId}:${keyHash}`;
}

function extractJsonLdScriptBodies(html: string): string[] {
  const scripts: string[] = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu;

  for (const match of html.matchAll(scriptPattern)) {
    const attributes = match[1] ?? "";
    if (/\btype\s*=\s*(?:["']application\/ld\+json["']|application\/ld\+json)(?:\s|$)/iu.test(attributes)) {
      scripts.push(match[2] ?? "");
    }
  }

  return scripts;
}

function findRecipeNodes(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data)) return data.flatMap(findRecipeNodes);

  const node = data as Record<string, unknown>;
  if (isRecipeType(node["@type"])) return [node];

  const nestedKeys = [
    "@graph",
    "mainEntity",
    "mainEntityOfPage",
    "hasPart",
    "subjectOf",
    "about",
    "itemListElement",
  ];
  return nestedKeys.flatMap((key) => {
    const value = node[key];
    if (key === "itemListElement" && Array.isArray(value)) {
      return value.flatMap((item) =>
        item && typeof item === "object"
          ? findRecipeNodes((item as Record<string, unknown>)["item"] ?? item)
          : []
      );
    }
    return findRecipeNodes(value);
  });
}

function isRecipeType(type: unknown): boolean {
  if (typeof type === "string") {
    return type === "Recipe" || /^https?:\/\/schema\.org\/Recipe$/u.test(type);
  }
  return Array.isArray(type) && type.some(isRecipeType);
}

function isCompleteRecipe(recipe: Record<string, unknown>): boolean {
  return Boolean(
    isRecipeType(recipe["@type"]) &&
      firstString(recipe["name"], recipe["headline"], recipe["title"]) &&
      normalizeStrings(recipe["recipeIngredient"] ?? recipe["ingredients"]).length > 0 &&
      normalizeInstructions(recipe["recipeInstructions"]).length > 0
  );
}

function normalizeInstructions(value: unknown): NormalizedRecipeInstruction[] {
  const texts = instructionTexts(value);
  return texts.map((text, index) => ({ position: index + 1, text }));
}

function instructionTexts(value: unknown): string[] {
  if (typeof value === "string") return normalizeStrings(value);
  if (Array.isArray(value)) return value.flatMap(instructionTexts);
  if (!value || typeof value !== "object") return [];

  const node = value as Record<string, unknown>;
  if (Array.isArray(node["itemListElement"])) {
    return node["itemListElement"].flatMap((item) =>
      instructionTexts(
        item && typeof item === "object"
          ? ((item as Record<string, unknown>)["item"] ?? item)
          : item
      )
    );
  }
  const text = firstString(node["text"], node["name"]);
  return text ? [text] : [];
}

function normalizeImageUrls(value: unknown): string[] {
  if (typeof value === "string") return [cleanText(value)].filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(normalizeImageUrls);
  if (value && typeof value === "object") {
    const node = value as Record<string, unknown>;
    return normalizeImageUrls(node["url"] ?? node["contentUrl"]);
  }
  return [];
}

function normalizeKeywords(value: unknown): string[] {
  if (typeof value !== "string") return normalizeStrings(value);
  return value.split(",").map(cleanText).filter(Boolean);
}

function normalizeStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/\n+/u)
      .map(cleanText)
      .filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value.flatMap(normalizeStrings);
  }
  return [];
}

function parseIsoDurationMinutes(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?$/u.exec(value.trim());
  if (!match) return undefined;
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      const cleaned = cleanText(value);
      if (cleaned) return cleaned;
    }
  }
  return undefined;
}

function cleanText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function decodeJsonEntities(raw: string): string {
  return raw
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'");
}
