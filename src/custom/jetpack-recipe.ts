import * as cheerio from "cheerio";
import type { EmbeddedRecipeExtraction } from "./spisbedre.js";

/**
 * Jetpack's recipe block ([recipe] shortcode) publishes Schema.org Recipe
 * microdata instead of JSON-LD. smittenkitchen and asweetspoonful are built on
 * it, which is why a strict JSON-LD crawl walked all 1465 smittenkitchen posts on
 * 2026-09-14 and stored nothing.
 *
 * Title, yield, time and ingredients follow the legacy microdata fallback
 * (BaseRecipeSpider.extract_recipe_microdata): the first itemprop="name" in the
 * Recipe scope and every itemprop="recipeIngredient". Instructions are where the
 * two part ways. Legacy reads only itemprop="recipeInstructions", which Jetpack
 * never emits, so it would store these recipes with no steps at all. The steps
 * are in the block's directions element, one paragraph per step, and that is
 * what the page shows.
 *
 * `found` is false when a page carries no Recipe scope, so the caller can treat
 * it as a post that is not a recipe rather than a malformed one.
 */
export interface JetpackRecipeExtraction extends EmbeddedRecipeExtraction {
  found: boolean;
}

const compact = (value: string): string =>
  value.replace(/[​-‍﻿]/gu, "").replace(/\s+/gu, " ").trim();

function minutes(value: string): number | undefined {
  const iso = value.match(/^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?/iu);
  if (iso) {
    const result = Number(iso[1] ?? 0) * 60 + Number(iso[2] ?? 0);
    return result > 0 ? result : undefined;
  }
  const hours = value.match(/(\d+(?:[.,]\d+)?)\s*(?:hours?|hrs?)\b/iu);
  const mins = value.match(/(\d+)\s*(?:minutes?|mins?)\b/iu);
  const result = Math.round(Number((hours?.[1] ?? "0").replace(",", ".")) * 60) + Number(mins?.[1] ?? 0);
  return result > 0 ? result : undefined;
}

/** Block-level boundaries become line breaks before the text is read. */
function blockLines(html: string): string[] {
  const separated = html
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<\/?(?:p|div|li|ol|ul|h[1-6])\b[^>]*>/giu, "\n");
  return cheerio.load(separated).text().split("\n").map(compact).filter((line) => line !== "");
}

export function extractJetpackRecipe(html: string, canonicalUrl: string): JetpackRecipeExtraction {
  const $ = cheerio.load(html);
  const scope = $('[itemscope][itemtype*="schema.org/Recipe" i]').first();
  if (scope.length === 0) return { found: false, incompleteCount: 0, malformedCount: 0 };

  const title = compact(scope.find('[itemprop="name"]').first().text());
  const ingredients: string[] = [];
  scope.find('[itemprop="recipeIngredient"]').each((_index, element) => {
    const line = compact($(element).text());
    if (line !== "") ingredients.push(line);
  });

  const steps: string[] = [];
  const instructionScopes = scope.find('[itemprop="recipeInstructions"]');
  if (instructionScopes.length > 0) {
    instructionScopes.each((_index, element) => {
      const nodes = $(element).find("li, p");
      if (nodes.length > 0) {
        nodes.each((_i, node) => {
          const line = compact($(node).text());
          if (line !== "") steps.push(line);
        });
      } else {
        const line = compact($(element).text());
        if (line !== "") steps.push(line);
      }
    });
  } else {
    const directions = scope.find(".jetpack-recipe-directions").first();
    if (directions.length > 0) steps.push(...blockLines($.html(directions)));
  }

  // The yield and time elements carry a bold label ("Servings:", "Time:") that
  // is page chrome rather than the value.
  const yieldNode = scope.find('[itemprop="recipeYield"]').first().clone();
  yieldNode.find("strong").remove();
  const yieldText = compact(yieldNode.text());
  const timeNode = scope.find('[itemprop="totalTime"]').first();
  const totalTime = compact(timeNode.attr("datetime") ?? timeNode.attr("content") ?? "");
  const imageNode = scope.find('[itemprop="image"]').first();
  const imageSource = imageNode.attr("src") ?? imageNode.attr("content") ?? "";
  let imageUrl = "";
  try {
    imageUrl = imageSource === "" ? "" : new URL(imageSource, canonicalUrl).toString();
  } catch {
    imageUrl = "";
  }
  const description = compact(scope.find('[itemprop="description"]').first().text());

  if (title === "" || ingredients.length === 0 || steps.length === 0) {
    return { found: true, incompleteCount: 1, malformedCount: 0 };
  }
  const total = minutes(totalTime);
  return {
    found: true,
    recipe: {
      canonicalUrl,
      rawRecipe: { title, description, yieldText, totalTime, ingredients, instructions: steps, imageUrl },
      normalized: {
        title,
        ...(description === "" ? {} : { description }),
        ingredients,
        instructions: steps.map((text, index) => ({ position: index + 1, text })),
        ...(total === undefined ? {} : { totalMinutes: total }),
        ...(yieldText === "" ? {} : { yieldText }),
        imageUrls: imageUrl === "" ? [] : [imageUrl],
        categories: [],
        cuisines: [],
        keywords: [],
      },
    },
    incompleteCount: 0,
    malformedCount: 0,
  };
}
