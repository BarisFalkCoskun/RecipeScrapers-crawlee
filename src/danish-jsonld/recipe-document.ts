import { Binary } from "mongodb";
import { decodeHTML } from "entities";
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
  incompleteJsonLdCount: number;
  malformedJsonLdCount: number;
  repairedJsonLdCount: number;
  signals: Array<
    | "incomplete-json-ld"
    | "malformed-json-ld"
    | "json-ld-control-character-repaired"
  >;
}

export interface ParsedJsonLdScript {
  parsed: unknown;
  repairedControlCharacterCount: number;
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
  /** Preserve raw provenance but normalize recipeYield to its first integer. */
  numericYieldOnly?: true;
  /** Stable positional identity used only when one page contains multiple Recipes without @id. */
  pageRecipeDiscriminator?: string;
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
  let incompleteJsonLdCount = 0;
  let malformedJsonLdCount = 0;
  let repairedJsonLdCount = 0;

  for (const rawScript of rawScripts) {
    // A blank script tag carries no recipe claim, so it is absent rather than
    // malformed. Counting it as a rejection inflates the quality counters and
    // holds an otherwise clean source out of a canary.
    if (rawScript.trim() === "") continue;
    const parsedScript = parseJsonLdScript(rawScript);
    if (!parsedScript) {
      rejectedReasons.push("malformed-json-ld");
      malformedJsonLdCount += 1;
      continue;
    }
    if (parsedScript.repairedControlCharacterCount > 0) {
      repairedJsonLdCount += 1;
    }

    for (const recipe of findRecipeNodes(parsedScript.parsed)) {
      // A bare @type/@id pair is a JSON-LD reference to a node defined
      // elsewhere, not a recipe claim, so it is neither kept nor rejected.
      if (isNodeReference(recipe)) continue;
      if (isCompleteRecipe(recipe)) {
        recipes.push(recipe);
      } else {
        rejectedReasons.push("incomplete-json-ld");
        incompleteJsonLdCount += 1;
      }
    }
  }

  return {
    rawScripts,
    recipes,
    rejectedReasons: Array.from(new Set(rejectedReasons)),
    incompleteJsonLdCount,
    malformedJsonLdCount,
    repairedJsonLdCount,
    signals: Array.from(new Set([
      ...rejectedReasons,
      ...(repairedJsonLdCount > 0
        ? ["json-ld-control-character-repaired" as const]
        : []),
    ])),
  };
}

/**
 * Parses valid JSON unchanged. If parsing fails solely because a quoted value
 * contains literal JSON control characters, retries with those characters
 * escaped. Exact script bytes remain preserved separately on the page record.
 */
export function parseJsonLdScript(rawScript: string): ParsedJsonLdScript | null {
  // Some templates emit the JSON as a statement and leave the semicolon in.
  // Trimming it is outside the JSON value, so no quoted content is touched.
  const script = rawScript.trim().replace(/;+$/u, "");
  try {
    return { parsed: JSON.parse(script), repairedControlCharacterCount: 0 };
  } catch {
    const repaired = escapeLiteralJsonControlCharacters(script);
    if (repaired.count > 0) {
      try {
        return {
          parsed: JSON.parse(repaired.value),
          repairedControlCharacterCount: repaired.count,
        };
      } catch {
        // Fall through to the trailing-comma repair below.
      }
    }
    const trimmed = removeTrailingCommas(
      repaired.count > 0 ? repaired.value : script
    );
    if (trimmed.count === 0) return null;
    try {
      return {
        parsed: JSON.parse(trimmed.value),
        repairedControlCharacterCount: repaired.count,
      };
    } catch {
      return null;
    }
  }
}

/**
 * Drops a comma that sits immediately before a closing bracket or brace, which
 * is legal in JavaScript object literals and a common hand-authoring slip in
 * JSON-LD. Commas inside quoted values are left untouched.
 */
function removeTrailingCommas(rawScript: string): { value: string; count: number } {
  let value = "";
  let insideString = false;
  let escaped = false;
  let count = 0;

  for (let index = 0; index < rawScript.length; index += 1) {
    const character = rawScript[index]!;
    if (insideString) {
      value += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') insideString = false;
      continue;
    }
    if (character === '"') {
      value += character;
      insideString = true;
      continue;
    }
    if (character === ",") {
      let lookahead = index + 1;
      while (lookahead < rawScript.length && /\s/u.test(rawScript[lookahead]!)) {
        lookahead += 1;
      }
      const next = rawScript[lookahead];
      if (next === "]" || next === "}") {
        count += 1;
        continue;
      }
    }
    value += character;
  }
  return { value, count };
}

/** True for `{"@type":"Recipe","@id":"..."}` and nothing else of substance. */
function isNodeReference(node: Record<string, unknown>): boolean {
  const keys = Object.keys(node).filter(
    (key) => key !== "@type" && key !== "@context"
  );
  return keys.length === 1 && keys[0] === "@id";
}

function escapeLiteralJsonControlCharacters(rawScript: string): {
  value: string;
  count: number;
} {
  let value = "";
  let insideString = false;
  let escaped = false;
  let count = 0;

  for (const character of rawScript) {
    if (!insideString) {
      value += character;
      if (character === '"') insideString = true;
      continue;
    }
    if (escaped) {
      value += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      value += character;
      escaped = true;
      continue;
    }
    if (character === '"') {
      value += character;
      insideString = false;
      continue;
    }

    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint > 0x1f) {
      value += character;
      continue;
    }
    value += escapeJsonControlCharacter(codePoint);
    count += 1;
  }

  return { value, count };
}

function escapeJsonControlCharacter(codePoint: number): string {
  switch (codePoint) {
    case 0x08: return "\\b";
    case 0x09: return "\\t";
    case 0x0a: return "\\n";
    case 0x0c: return "\\f";
    case 0x0d: return "\\r";
    default: return `\\u${codePoint.toString(16).padStart(4, "0")}`;
  }
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
  if (input.numericYieldOnly) {
    const numericYield = normalized.yieldText?.match(/\d+/u)?.[0];
    if (numericYield) normalized.yieldText = numericYield;
    else delete normalized.yieldText;
  }
  const sourceHash = hashRecipe(rawRecipe);
  const contentHash = hashRecipe(normalized as unknown as Record<string, unknown>);
  const sourceRecipeKey = createSourceRecipeKey({
    sourceId: input.sourceId,
    canonicalUrl: input.canonicalUrl,
    upstreamId: firstString(rawRecipe["@id"]),
    pageRecipeDiscriminator: input.pageRecipeDiscriminator,
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
  const ingredients = normalizeIngredientStrings(
    rawRecipe["recipeIngredient"] ?? rawRecipe["ingredients"]
  );
  const instructions = normalizeInstructions(rawRecipe["recipeInstructions"]);
  const normalized: NormalizedRecipeV2 = {
    title: title as string,
    ingredients,
    instructions,
    imageUrls: normalizeImageUrls(rawRecipe["image"]),
    categories: normalizeCommaSeparatedStrings(rawRecipe["recipeCategory"]),
    cuisines: normalizeCommaSeparatedStrings(rawRecipe["recipeCuisine"]),
    keywords: normalizeKeywords(rawRecipe["keywords"]),
  };

  const description = firstString(rawRecipe["description"]);
  const recipeYield = normalizeYieldText(
    rawRecipe["recipeYield"] ?? rawRecipe["yield"]
  );
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
  pageRecipeDiscriminator,
}: {
  sourceId: string;
  canonicalUrl: string;
  upstreamId: string | undefined;
  pageRecipeDiscriminator: string | undefined;
}): string {
  const keyHash = hashRecipe({
    sourceId,
    canonicalUrl,
    upstreamId: upstreamId ?? null,
    pageRecipeDiscriminator: upstreamId ? null : pageRecipeDiscriminator ?? null,
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

/**
 * Schema.org spells the type Recipe, but sites emit "recipe" often enough that
 * a case-sensitive match silently discards whole sources. No other schema.org
 * type differs from Recipe only by case, so folding case cannot widen this to
 * anything else, and the completeness contract still applies to whatever
 * matches.
 */
function isRecipeType(type: unknown): boolean {
  if (typeof type === "string") {
    const value = type.trim().toLowerCase();
    return value === "recipe" || /^https?:\/\/schema\.org\/recipe$/u.test(value);
  }
  return Array.isArray(type) && type.some(isRecipeType);
}

function isCompleteRecipe(recipe: Record<string, unknown>): boolean {
  return Boolean(
    isRecipeType(recipe["@type"]) &&
      firstString(recipe["name"], recipe["headline"], recipe["title"]) &&
      normalizeIngredientStrings(recipe["recipeIngredient"] ?? recipe["ingredients"]).length > 0 &&
      normalizeInstructions(recipe["recipeInstructions"]).length > 0
  );
}

function normalizeInstructions(value: unknown): NormalizedRecipeInstruction[] {
  const texts = typeof value === "string"
    ? splitInstructionString(value)
    : instructionTexts(value);
  return texts.map((text, index) => ({ position: index + 1, text }));
}

function instructionTexts(value: unknown): string[] {
  // A string inside an instruction array is already one explicit step. Do not
  // split its embedded newlines; the legacy parser and Schema.org both retain
  // that array boundary as the step boundary.
  if (typeof value === "string") return [cleanText(value)].filter(Boolean);
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
  // Several publishers append an empty HowToStep whose only value is the UI
  // label "Step". It is not an instruction and the legacy parser correctly
  // ignored it because it had no text. Keep meaningful name-only steps, while
  // dropping generic ordinal placeholders.
  if (text && !/^(?:step|trin)(?:\s+\d+)?[:.]?$/iu.test(text)) return [text];
  return numericKeyValues(node).flatMap(instructionTexts);
}

function splitInstructionString(value: string): string[] {
  // Match the established legacy behavior for sites that put every step in one
  // Recipe.recipeInstructions string (notably Semper).
  return value
    .split(/\n+|(?<=\.)\s+(?=[A-ZÆØÅ])/u)
    .map(cleanText)
    .filter(Boolean);
}

function normalizeImageUrls(value: unknown): string[] {
  if (typeof value === "string") {
    const cleaned = cleanText(value);
    return looksLikeImageReference(cleaned) ? [cleaned] : [];
  }
  if (Array.isArray(value)) return value.flatMap(normalizeImageUrls);
  if (value && typeof value === "object") {
    const node = value as Record<string, unknown>;
    return normalizeImageUrls(node["url"] ?? node["contentUrl"]);
  }
  return [];
}

/**
 * A source whose template leaks an unescaped quote publishes prose in the image
 * array: bornemenuen states url as ["/sites/.../Karrysalat copy2.jpg", "hvide
 * bønner og æble\" />"], and the second entry is a fragment of its own markup.
 * Storing it puts a sentence where a consumer expects an image. Requiring a
 * reference that could address something keeps the real image, which legacy
 * drops along with the rest.
 */
function looksLikeImageReference(value: string): boolean {
  if (!value || /\s/u.test(value)) return false;
  if (/[<>"]/u.test(value)) return false;
  return /^(?:https?:)?\/\//u.test(value) || value.startsWith("/") || /^data:image\//u.test(value);
}

function normalizeKeywords(value: unknown): string[] {
  if (typeof value !== "string") return normalizeStrings(value);
  return value.split(",").map(cleanText).filter(Boolean);
}

function normalizeCommaSeparatedStrings(value: unknown): string[] {
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
  if (value && typeof value === "object") {
    return numericKeyValues(value as Record<string, unknown>).flatMap(normalizeStrings);
  }
  return [];
}

function normalizeYieldText(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const normalized = normalizeYieldText(entry);
      if (normalized) return normalized;
    }
    return undefined;
  }
  if (value && typeof value === "object") {
    return normalizeYieldText(numericKeyValues(value as Record<string, unknown>));
  }
  return normalizeStrings(value)[0];
}

function normalizeIngredientStrings(value: unknown): string[] {
  // Each Schema.org array entry is one ingredient. Embedded newlines are
  // presentation whitespace (Schulstad uses them inside product names), not
  // additional ingredients. This mirrors the legacy adapter's leaf flattening.
  if (typeof value === "string") return [cleanText(value)].filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(normalizeIngredientStrings);
  if (value && typeof value === "object") {
    return numericKeyValues(value as Record<string, unknown>)
      .flatMap(normalizeIngredientStrings);
  }
  return [];
}

function numericKeyValues(node: Record<string, unknown>): unknown[] {
  return Object.entries(node)
    .filter(([key]) => /^\d+$/u.test(key))
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, value]) => value);
}

function parseIsoDurationMinutes(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase().replace(",", ".");
  // A negative component in an ISO duration is a broken upstream value, most
  // often a clock subtraction made the wrong way round, and it drifts with real
  // time. The loose fallbacks below would scrape a huge positive number out of
  // it — one source publishes PT-29787046.716667M, which reads as a 56-year
  // prep time — so it is treated as no duration at all.
  //
  // Only the negative sign disqualifies a duration. A very long one can be
  // real: a WPRM source states 129,620 minutes total for a plum liqueur, which
  // is its ninety-day Trækketid, and that must survive.
  if (/^p/u.test(normalized) && /-\d/u.test(normalized)) return undefined;
  // Some sources write the hour designator in Danish — gastrotools states
  // "PT15t30M" for fifteen timer thirty, and its own totals confirm it: 15t30M
  // prep plus 1t45M cooking is the 17t15M it gives as the total. Whitespace
  // inside a duration is likewise a formatting slip rather than a new meaning.
  // Whitespace comes out before the fractions are expanded, or a value written
  // "3 ¼H" loses the gap between them and reads as 3 followed by 0.25 — thirty
  // and a quarter hours rather than three and a quarter.
  const isoLike = expandFractions(normalized.replace(/\s+/gu, ""))
    .replace(/(\d)t(?=\d|$)/gu, "$1h");
  const iso = /^p(?:\d+y)?(?:\d+m)?(?:\d+d)?t(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:\d+(?:\.\d+)?s)?$/u.exec(isoLike);
  if (iso) return positiveRoundedMinutes(
    Number(iso[1] ?? 0) * 60 + Number(iso[2] ?? 0)
  );
  // Anything else falls through to the loose patterns below. They recover more
  // than they lose on the malformed durations these sources actually publish —
  // "PT20 minM", "P10M" and "PTH1H30M" all read correctly there — so rejecting
  // every unparseable ISO string outright would discard good values.
  const hours = /(\d+(?:\.\d+)?)\s*(?:timer?|hours?|hrs?|h)\s*(?:(\d+(?:\.\d+)?)\s*(?:min(?:ut(?:ter)?)?|minutes?|mins?|m))?/u.exec(normalized);
  if (hours) return positiveRoundedMinutes(
    Number(hours[1]) * 60 + Number(hours[2] ?? 0)
  );
  const minutes = /(\d+(?:\.\d+)?)\s*(?:min(?:ut(?:ter)?)?|minutes?|mins?|m)/u.exec(normalized);
  if (minutes) return positiveRoundedMinutes(Number(minutes[1]));
  if (/^\d+$/u.test(normalized)) return positiveRoundedMinutes(Number(normalized));
  return undefined;
}

/**
 * Sources write durations with the vulgar fraction characters a keyboard
 * offers: iform states a total of "P0Y0M0DT2½H0M0S", meaning two and a half
 * hours. The numeric patterns below only accept digits, so the whole duration
 * was dropped and 150 minutes became nothing.
 */
const FRACTION_VALUES: Record<string, string> = {
  "¼": ".25", "½": ".5", "¾": ".75",
  "⅐": ".142857", "⅑": ".111111", "⅒": ".1",
  "⅓": ".333333", "⅔": ".666667",
  "⅕": ".2", "⅖": ".4", "⅗": ".6", "⅘": ".8",
  "⅙": ".166667", "⅚": ".833333",
  "⅛": ".125", "⅜": ".375", "⅝": ".625", "⅞": ".875",
};

function expandFractions(value: string): string {
  return value.replace(
    /(\d*)([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/gu,
    (_match, whole: string, fraction: string) =>
      `${whole === "" ? "0" : whole}${FRACTION_VALUES[fraction] ?? ""}`
  );
}

function positiveRoundedMinutes(value: number): number | undefined {
  const rounded = Math.round(value);
  return Number.isFinite(rounded) && rounded > 0 ? rounded : undefined;
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
  return decodeHTML(value)
    // Block separators need a boundary, while inline markup must not turn
    // `Nutella<sup>®</sup>` into the semantically different `Nutella ®`.
    .replace(/<br\s*\/?>/giu, " ")
    .replace(/<\/?(?:article|div|h[1-6]|li|ol|p|section|ul)\b[^>]*>/giu, " ")
    .replace(/<[^>]+>/gu, "")
    // Zero-width characters are invisible, and sources embed them mid-word:
    // krumpli writes "A\uFEFFdd a lid". They match \s, so collapsing whitespace
    // would turn that into "A dd" — they have to go before, not become spaces.
    .replace(/[\u200B-\u200D\uFEFF]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}
