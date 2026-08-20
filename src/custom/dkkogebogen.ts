import * as cheerio from "cheerio";
import type { EmbeddedRecipeExtraction } from "./spisbedre.js";

const compact = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";

/** Port of the legacy DK Kogebogen Schema.org microdata parser. */
export function extractDkKogebogenRecipe(
  html: string,
  canonicalUrl: string
): EmbeddedRecipeExtraction {
  const $ = cheerio.load(html);
  const scope = $('[itemtype*="schema.org/Recipe"]').first();
  if (scope.length === 0) return { incompleteCount: 0, malformedCount: 1 };

  const title = compact(scope.find('[itemprop="name"]').first().text()) ||
    compact($("h1").first().text());
  const description = compact($('meta[name="description"]').attr("content"));
  const yieldText = compact(scope.find('[itemprop="recipeYield"]').first().text());
  const servingMatch = yieldText.match(/\d+/u);
  const ingredients = scope.find('[itemprop="recipeIngredient"]').map(
    (_index, element) => compact($(element).text())
  ).get().filter(Boolean);

  const instructionScope = scope.find('[itemprop="recipeInstructions"]').first();
  // Scrapy's `[itemprop="recipeInstructions"]::text.get()` selects the first
  // direct text node. Preserve that behavior: tips and later blocks often sit
  // behind child elements and were intentionally not part of the legacy item.
  const directInstructionText = instructionScope.contents().toArray()
    .find((node) => node.type === "text");
  const instructionText = directInstructionText && "data" in directInstructionText
    ? directInstructionText.data
    : instructionScope.text();
  const instructions = instructionText.split(/\n+/u)
    .map(compact)
    .filter(Boolean)
    .map((text, index) => ({ position: index + 1, text }));
  const category = compact(scope.find('[itemprop="recipeCategory"]').first().text());
  const cuisine = compact(scope.find('[itemprop="recipeCuisine"]').first().text());
  const keywords = compact(scope.find('[itemprop="keywords"]').first().text())
    .split(",").map((value) => value.trim()).filter(Boolean);
  const imageSource = scope.find('[itemprop="image"]').first().attr("src") ?? "";
  const nutritionScope = scope.find('[itemprop="nutrition"]').first();
  const nutrition = Object.fromEntries([
    ["calories", compact(nutritionScope.find('[itemprop="calories"]').first().text())],
    ["protein", compact(nutritionScope.find('[itemprop="proteinContent"]').first().text())],
    ["fat", compact(nutritionScope.find('[itemprop="fatContent"]').first().text())],
    ["carbohydrates", compact(nutritionScope.find('[itemprop="carbohydrateContent"]').first().text())],
  ].filter((entry): entry is [string, string] => entry[1] !== ""));

  if (title === "" || ingredients.length === 0 || instructions.length === 0) {
    return { incompleteCount: 1, malformedCount: 0 };
  }
  const normalized = {
    title,
    ...(description ? { description } : {}),
    ingredients,
    instructions,
    ...(servingMatch ? { yieldText: servingMatch[0] } : {}),
    imageUrls: imageSource ? [new URL(imageSource, canonicalUrl).toString()] : [],
    categories: [category, cuisine].filter(Boolean),
    cuisines: [],
    keywords,
    ...(Object.keys(nutrition).length > 0 ? { nutrition } : {}),
  };
  return {
    recipe: {
      canonicalUrl,
      rawRecipe: { title, description, yieldText, ingredients, instructions, category, cuisine, keywords },
      normalized,
    },
    incompleteCount: 0,
    malformedCount: 0,
  };
}
