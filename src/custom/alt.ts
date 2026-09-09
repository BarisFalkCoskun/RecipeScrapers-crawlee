import * as cheerio from "cheerio";
import type { NormalizedRecipeV2 } from "../types.js";
import type { EmbeddedRecipeExtraction } from "./spisbedre.js";
import { extractJsonLdRecipes } from "../extractors/json-ld.js";

const clean = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";

/**
 * alt states its times in Recipe JSON-LD even though it states no ingredients
 * there, which is why this extractor reads the page itself for everything else.
 * Reading the times from the DOM alone left prep, cook and total empty on every
 * record; legacy takes them from the same JSON-LD and had them on 123 of the
 * 133 recipes it emitted.
 */
function minutes(value: unknown): number | undefined {
  const text = clean(value).toLocaleLowerCase("da").replace(/,/gu, ".");
  const iso = text.match(/^p(?:\d+y)?(?:\d+m)?(?:\d+d)?t(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?/iu);
  if (iso) {
    const total = Number(iso[1] ?? 0) * 60 + Number(iso[2] ?? 0);
    return total > 0 ? Math.round(total) : undefined;
  }
  const hours = text.match(/(\d+(?:\.\d+)?)\s*timer?/iu);
  const mins = text.match(/(\d+(?:\.\d+)?)\s*min(?:ut(?:ter)?)?/iu);
  const total = Number(hours?.[1] ?? 0) * 60 + Number(mins?.[1] ?? 0);
  return total > 0 ? Math.round(total) : undefined;
}

export function extractAltRecipe(
  html: string,
  canonicalUrl: string
): EmbeddedRecipeExtraction {
  const $ = cheerio.load(html);
  if (!clean($("body").attr("class")).split(/\s+/u).includes("pagestyle_recipe")) {
    return { incompleteCount: 1, malformedCount: 0 };
  }
  const title = clean($("h1").first().text());
  const description = clean($("meta[name='description']").attr("content"));
  const ingredients: string[] = [];
  const oldRoot = $(".recipe-list-ingredients").first();
  if (oldRoot.length > 0) {
    oldRoot.find("li, .lab-bodytext-line").each((_index, item) => {
      const text = clean($(item).text());
      if (text.length > 1 && !ingredients.includes(text)) ingredients.push(text);
    });
  } else {
    const heading = $("h2").filter((_index, element) =>
      clean($(element).text()).toLocaleLowerCase("da") === "ingredienser"
    ).first();
    heading.next(".fact").find("li").each((_index, item) => {
      const text = clean($(item).text());
      if (text.length > 1) ingredients.push(text);
    });
  }

  const instructions: string[] = [];
  const oldMethod = $(".recipe-list-methods").first();
  if (oldMethod.length > 0) {
    const text = clean(oldMethod.text());
    const paragraphs = text.split(/\n\n+/u).map(clean).filter((value) => value.length > 10);
    instructions.push(...(paragraphs.length > 0 ? paragraphs :
      text.split(/(?<=\.)\s+(?=[A-ZÆØÅ])/u).map(clean).filter((value) => value.length > 10)));
  } else {
    const heading = $("h2").filter((_index, element) =>
      clean($(element).text()).toLocaleLowerCase("da") === "fremgangsmåde"
    ).first();
    let sibling = heading.next();
    while (sibling.length > 0 && sibling.get(0)?.tagName !== "article") {
      if (sibling.is("p")) {
        const text = clean(sibling.text());
        if (text.length > 10) instructions.push(text);
      }
      sibling = sibling.next();
    }
  }
  if (!title || ingredients.length === 0 || instructions.length === 0) {
    return { incompleteCount: 1, malformedCount: 0 };
  }
  const servingsText = clean($(".recipe-number-of-people").first().text()) ||
    clean($("h2").filter((_index, element) => /^til\s+\d+\s+person/iu.test(clean($(element).text()))).first().text());
  const yieldText = servingsText.match(/\d+/u)?.[0];
  const categories = $(".article-tags a, .breadcrumb a").toArray()
    .map((element) => clean($(element).text()))
    .filter((value) => value && !["mad", "hjem", "forside", "alt.dk"].includes(value.toLocaleLowerCase("da")));
  const image = clean($("meta[property='og:image']").attr("content"));
  const jsonLd = extractJsonLdRecipes(html).recipes[0];
  const prepMinutes = minutes(jsonLd?.["prepTime"]);
  const cookMinutes = minutes(jsonLd?.["cookTime"]);
  // Legacy falls back to the rendered total when the JSON-LD omits one.
  const totalMinutes = minutes(jsonLd?.["totalTime"]) ??
    minutes($(".recipe-total-time").first().text());
  const normalized: NormalizedRecipeV2 = {
    title,
    ...(description ? { description } : {}),
    ingredients,
    instructions: instructions.map((text, index) => ({ position: index + 1, text })),
    ...(yieldText ? { yieldText } : {}),
    ...(prepMinutes === undefined ? {} : { prepMinutes }),
    ...(cookMinutes === undefined ? {} : { cookMinutes }),
    ...(totalMinutes === undefined ? {} : { totalMinutes }),
    imageUrls: image ? [new URL(image, canonicalUrl).toString()] : [],
    categories,
    cuisines: [],
    keywords: [],
  };
  return {
    recipe: { canonicalUrl, rawRecipe: { title, description, ingredients, instructions }, normalized },
    incompleteCount: 0,
    malformedCount: 0,
  };
}
