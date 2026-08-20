import * as cheerio from "cheerio";
import type { EmbeddedRecipeExtraction } from "./spisbedre.js";

const compact = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";

function minutes(value: string): number | undefined {
  const iso = value.match(/^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?/iu);
  if (iso) {
    const result = Number(iso[1] ?? 0) * 60 + Number(iso[2] ?? 0);
    return result > 0 ? result : undefined;
  }
  const hours = value.match(/(\d+(?:[.,]\d+)?)\s*(?:timer?|hours?|h)\b/iu);
  const mins = value.match(/(\d+)\s*(?:minutter?|minutes?|min)\b/iu);
  const result = Number((hours?.[1] ?? "0").replace(",", ".")) * 60 + Number(mins?.[1] ?? 0);
  return result > 0 ? result : undefined;
}

export function extractWebopskrifterRecipe(
  html: string,
  fallbackCanonicalUrl: string
): EmbeddedRecipeExtraction {
  const $ = cheerio.load(html);
  const scope = $('[itemtype*="schema.org/Recipe"]').first();
  if (scope.length === 0) return { incompleteCount: 0, malformedCount: 1 };
  const title = compact(scope.find('[itemprop="name"]').first().text()) ||
    compact($("h1").first().text());
  const description = compact(scope.find('[itemprop="description"]').first().text());
  const prepTime = scope.find('[itemprop="prepTime"]').first().attr("content") ?? "";
  const cookTime = scope.find('[itemprop="cookTime"]').first().attr("content") ?? "";
  const totalTime = scope.find('[itemprop="totalTime"]').first().attr("content") ?? "";
  const yieldText = compact(scope.find('[itemprop="recipeYield"]').first().text());
  const ingredients: string[] = [];
  scope.find('[itemprop="recipeIngredient"]').each((_index, element) => {
    const ingredient = $(element);
    const parts = [
      compact(ingredient.find(".num").first().text()),
      compact(ingredient.find(".unit").first().text()),
      compact(ingredient.find(".ingredientName").first().text()),
    ].filter(Boolean);
    const line = parts.length > 0 ? parts.join(" ") : compact(ingredient.text());
    if (line !== "") ingredients.push(line);
  });
  const instructions: Array<{ position: number; text: string }> = [];
  const instructionScope = scope.find('[itemprop="recipeInstructions"]').first();
  const listItems = instructionScope.find("ol li");
  if (listItems.length > 0) {
    listItems.each((_index, element) => {
      const body = compact($(element).text());
      if (body !== "") instructions.push({ position: instructions.length + 1, text: body });
    });
  } else {
    for (const line of instructionScope.text().split("\n")) {
      const body = compact(line);
      if (body.length > 5) instructions.push({ position: instructions.length + 1, text: body });
    }
  }
  const category = compact(scope.find('[itemprop="recipeCategory"]').first().text());
  const cuisine = compact(scope.find('[itemprop="recipeCuisine"]').first().text());
  const keywords = compact(scope.find('[itemprop="keywords"]').first().text())
    .split(",").map((value) => value.trim()).filter(Boolean);
  const imageSource = scope.find('[itemprop="image"]').first().attr("src") ?? "";
  const imageUrl = imageSource === ""
    ? ""
    : new URL(imageSource, fallbackCanonicalUrl).toString();
  const nutritionScope = scope.find('[itemprop="nutrition"]').first();
  const nutrition = Object.fromEntries([
    ["calories", compact(nutritionScope.find('[itemprop="calories"]').first().text())],
    ["protein", compact(nutritionScope.find('[itemprop="proteinContent"]').first().text())],
    ["fat", compact(nutritionScope.find('[itemprop="fatContent"]').first().text())],
    ["carbohydrates", compact(nutritionScope.find('[itemprop="carbohydrateContent"]').first().text())],
  ].filter(([, value]) => value !== ""));
  const normalized = {
    title,
    ...(description === "" ? {} : { description }),
    ingredients,
    instructions,
    ...(minutes(prepTime) === undefined ? {} : { prepMinutes: minutes(prepTime) }),
    ...(minutes(cookTime) === undefined ? {} : { cookMinutes: minutes(cookTime) }),
    ...(minutes(totalTime) === undefined ? {} : { totalMinutes: minutes(totalTime) }),
    ...(yieldText === "" ? {} : { yieldText }),
    imageUrls: imageUrl === "" ? [] : [imageUrl],
    categories: category === "" ? [] : [category],
    cuisines: cuisine === "" ? [] : [cuisine],
    keywords,
    ...(Object.keys(nutrition).length === 0 ? {} : { nutrition }),
  };
  if (title === "" || ingredients.length === 0 || instructions.length === 0) {
    return { incompleteCount: 1, malformedCount: 0 };
  }
  return {
    recipe: {
      canonicalUrl: fallbackCanonicalUrl,
      rawRecipe: {
        title,
        description,
        prepTime,
        cookTime,
        totalTime,
        yieldText,
        ingredients,
        instructions,
        category,
        cuisine,
        keywords,
        imageUrl,
        nutrition,
      },
      normalized,
    },
    incompleteCount: 0,
    malformedCount: 0,
  };
}
