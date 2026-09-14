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
 * Recipe scope and every itemprop="recipeIngredient". Steps come from
 * itemprop="recipeInstructions" when the block carries it, as legacy reads them
 * and as older smittenkitchen posts do. Newer blocks omit that itemprop
 * (/2026/08/peach-cobbler-loaf/), and legacy would store those with no steps;
 * here they are read from the block's directions element, one paragraph per
 * step, which is what the page shows.
 *
 * `found` is false when a page carries no Recipe scope, so the caller can treat
 * it as a post that is not a recipe rather than a malformed one.
 */
export interface JetpackRecipeExtraction extends EmbeddedRecipeExtraction {
  found: boolean;
}

const compact = (value: string): string =>
  value.replace(/[\u200B-\u200D\uFEFF]/gu, "").replace(/\s+/gu, " ").trim();

/**
 * Jetpack's time field is free text ("1 1/2 to 2 1/2 hours", "20 minutes to
 * assemble; 3 hours to chill"). It follows the legacy TimeNormalizer.to_minutes
 * for English sources so the two agree: fractions become decimals, then the
 * first "N hours [M minutes]" wins, else the first "N minutes". Summing every
 * duration, as this first did, disagreed with legacy on 29 of 495 records and
 * misread "3 1/2 hours" as 120. One deliberate difference: an ISO value is read
 * as ISO, and a negative one ("P-1DT-1H0M0S") yields nothing where legacy
 * matched the "1H" inside it.
 */
function minutes(value: string): number | undefined {
  const raw = value.trim();
  if (/^-?P/iu.test(raw)) {
    const iso = raw.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:\d+S)?)?$/iu);
    if (!iso) return undefined;
    const result = Number(iso[1] ?? 0) * 1440 + Number(iso[2] ?? 0) * 60 + Number(iso[3] ?? 0);
    return result > 0 ? result : undefined;
  }
  const text = raw.toLowerCase().replace(/,/gu, ".")
    .replace(/½/gu, " 1/2").replace(/¼/gu, " 1/4").replace(/¾/gu, " 3/4").replace(/⅓/gu, " 1/3").replace(/⅔/gu, " 2/3")
    .replace(/(\d+)\s+(\d+)\/(\d+)/gu, (whole, a: string, n: string, d: string) =>
      Number(d) === 0 ? whole : String(Number(a) + Number(n) / Number(d)))
    .replace(/(?<!\d)(\d+)\/(\d+)/gu, (whole, n: string, d: string) =>
      Number(d) === 0 ? whole : String(Number(n) / Number(d)));
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min|m))?/u);
  if (hours) {
    const result = Math.round(Number(hours[1]) * 60 + (hours[2] ? Number(hours[2]) : 0));
    return result > 0 ? result : undefined;
  }
  const mins = text.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min|m)/u);
  if (mins) {
    const result = Math.round(Number(mins[1]));
    return result > 0 ? result : undefined;
  }
  return undefined;
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
