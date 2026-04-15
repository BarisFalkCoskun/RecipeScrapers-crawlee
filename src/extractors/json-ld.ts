import * as cheerio from "cheerio";

interface JsonLdResult {
  recipes: Record<string, unknown>[];
  signals: string[];
}

export function extractJsonLdRecipes(html: string): JsonLdResult {
  const $ = cheerio.load(html);
  const recipes: Record<string, unknown>[] = [];
  const signals: string[] = [];

  $('script[type="application/ld+json"]').each((_i, el) => {
    let raw = $(el).html();
    if (!raw) return;

    raw = decodeJsonEntities(raw);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      try {
        const cleaned = raw.replace(/,\s*([\]}])/g, "$1");
        parsed = JSON.parse(cleaned);
        signals.push("malformed-json-recovered");
      } catch {
        signals.push("malformed-json-failed");
        return;
      }
    }

    const found = findRecipes(parsed, signals).map((recipe) =>
      normalizeRecipe(recipe, signals)
    );
    recipes.push(...found);
  });

  if (recipes.length > 0) {
    signals.push("json-ld-found");
  }
  if (recipes.length > 1) {
    signals.push("multiple-recipes");
  }

  return { recipes, signals: unique(signals) };
}

function decodeJsonEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function isRecipeType(type: unknown): boolean {
  if (typeof type === "string") {
    return (
      type === "Recipe" ||
      type === "https://schema.org/Recipe" ||
      type === "http://schema.org/Recipe"
    );
  }
  if (Array.isArray(type)) {
    return type.some((entry) => isRecipeType(entry));
  }
  return false;
}

function findRecipes(
  data: unknown,
  signals: string[]
): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];

  if (Array.isArray(data)) {
    return data.flatMap((item) => findRecipes(item, signals));
  }

  const obj = data as Record<string, unknown>;

  if (Array.isArray(obj["@graph"])) {
    signals.push("graph-wrapper");
    return (obj["@graph"] as unknown[]).flatMap((item) =>
      findRecipes(item, signals)
    );
  }

  for (const [key, signal] of [
    ["mainEntity", "main-entity-wrapper"],
    ["mainEntityOfPage", "main-entity-of-page-wrapper"],
    ["hasPart", "has-part-wrapper"],
    ["subjectOf", "subject-of-wrapper"],
    ["about", "about-wrapper"],
  ] as const) {
    if (obj[key] && typeof obj[key] === "object") {
      signals.push(signal);
      const nested = findRecipes(obj[key], signals);
      if (nested.length > 0) {
        return nested;
      }
    }
  }

  if (Array.isArray(obj["itemListElement"])) {
    signals.push("item-list-wrapper");
    const nested = (obj["itemListElement"] as unknown[]).flatMap((item) => {
      if (item && typeof item === "object") {
        const listItem = item as Record<string, unknown>;
        return findRecipes(listItem["item"] ?? listItem, signals);
      }
      return [];
    });
    if (nested.length > 0) {
      return nested;
    }
  }

  if (isRecipeType(obj["@type"])) {
    return [obj];
  }

  return [];
}

function normalizeRecipe(
  recipe: Record<string, unknown>,
  signals: string[]
): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...recipe };

  const name = firstString(recipe["name"], recipe["headline"], recipe["title"]);
  if (name) {
    normalized["name"] = name;
  }

  const ingredients = normalizeIngredients(
    recipe["recipeIngredient"] ?? recipe["ingredients"]
  );
  if (ingredients.length > 0) {
    normalized["recipeIngredient"] = ingredients;
    if (!("ingredients" in normalized)) {
      normalized["ingredients"] = ingredients;
    }
  }

  const instructions = normalizeInstructions(recipe["recipeInstructions"]);
  if (instructions.length > 0) {
    normalized["recipeInstructions"] = instructions;
    if (!("instructions" in normalized)) {
      normalized["instructions"] = instructions;
    }
  }

  const image = normalizeImage(recipe["image"]);
  if (image) {
    normalized["image"] = image;
  }

  const description = firstString(recipe["description"]);
  if (description) {
    normalized["description"] = description;
  }

  const recipeYield = firstString(recipe["recipeYield"], recipe["yield"]);
  if (recipeYield) {
    normalized["recipeYield"] = recipeYield;
  }

  for (const key of ["prepTime", "cookTime", "totalTime"] as const) {
    const value = firstString(recipe[key]);
    if (value) {
      normalized[key] = value;
    }
  }

  if (
    ingredients.length > 0 ||
    instructions.length > 0 ||
    image ||
    recipeYield
  ) {
    signals.push("json-ld-normalized-fields");
  }

  return normalized;
}

function normalizeIngredients(value: unknown): string[] {
  if (Array.isArray(value)) {
    return unique(
      value.flatMap((entry) =>
        typeof entry === "string" ? splitDelimitedText(entry) : []
      )
    );
  }

  if (typeof value === "string") {
    return unique(splitDelimitedText(value));
  }

  return [];
}

function normalizeInstructions(value: unknown): string[] {
  if (typeof value === "string") {
    return unique(splitDelimitedText(value));
  }

  if (Array.isArray(value)) {
    return unique(value.flatMap((entry) => instructionStringsFromUnknown(entry)));
  }

  if (value && typeof value === "object") {
    return unique(instructionStringsFromUnknown(value));
  }

  return [];
}

function instructionStringsFromUnknown(value: unknown): string[] {
  if (typeof value === "string") {
    return splitDelimitedText(value);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  const obj = value as Record<string, unknown>;

  if (Array.isArray(obj["itemListElement"])) {
    return obj["itemListElement"].flatMap((entry) =>
      instructionStringsFromUnknown(
        entry && typeof entry === "object"
          ? ((entry as Record<string, unknown>)["item"] ?? entry)
          : entry
      )
    );
  }

  return [
    ...splitDelimitedText(firstString(obj["text"]) ?? ""),
    ...splitDelimitedText(firstString(obj["name"]) ?? ""),
  ];
}

function normalizeImage(value: unknown): string | string[] | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    const images = unique(
      value.flatMap((entry) => {
        if (typeof entry === "string") return [entry];
        if (entry && typeof entry === "object") {
          const obj = entry as Record<string, unknown>;
          return firstString(obj["url"], obj["contentUrl"]) ? [firstString(obj["url"], obj["contentUrl"]) as string] : [];
        }
        return [];
      })
    );

    if (images.length === 1) return images[0];
    if (images.length > 1) return images;
    return undefined;
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return firstString(obj["url"], obj["contentUrl"]) ?? undefined;
  }

  return undefined;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string") {
      const cleaned = cleanText(value);
      if (cleaned) return cleaned;
    }
  }

  return null;
}

function splitDelimitedText(value: string): string[] {
  return value
    .split(/\n+|•|(?<=\.)\s+(?=[A-ZÆØÅ])/u)
    .map((entry) => cleanText(entry))
    .filter(Boolean);
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => cleanText(value)).filter(Boolean)));
}
