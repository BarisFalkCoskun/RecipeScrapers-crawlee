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
    const raw = $(el).html();
    if (!raw) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try lenient parsing: strip trailing commas
      try {
        const cleaned = raw.replace(/,\s*([\]}])/g, "$1");
        parsed = JSON.parse(cleaned);
        signals.push("malformed-json-recovered");
      } catch {
        signals.push("malformed-json-failed");
        return;
      }
    }

    const found = findRecipes(parsed, signals);
    recipes.push(...found);
  });

  if (recipes.length > 0) {
    signals.push("json-ld-found");
  }
  if (recipes.length > 1) {
    signals.push("multiple-recipes");
  }

  return { recipes, signals };
}

function isRecipeType(type: unknown): boolean {
  if (typeof type === "string") {
    return type === "Recipe" || type === "https://schema.org/Recipe";
  }
  if (Array.isArray(type)) {
    return type.some(
      (t) => t === "Recipe" || t === "https://schema.org/Recipe"
    );
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
    if (!signals.includes("graph-wrapper")) signals.push("graph-wrapper");
    return (obj["@graph"] as unknown[]).flatMap((item) =>
      findRecipes(item, signals)
    );
  }

  if (obj["mainEntity"] && typeof obj["mainEntity"] === "object") {
    if (!signals.includes("main-entity-wrapper"))
      signals.push("main-entity-wrapper");
    const mainResult = findRecipes(obj["mainEntity"], signals);
    if (mainResult.length > 0) return mainResult;
  }

  if (isRecipeType(obj["@type"])) {
    return [obj];
  }

  return [];
}
