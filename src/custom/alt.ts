import * as cheerio from "cheerio";
import type { NormalizedRecipeV2 } from "../types.js";
import type { EmbeddedRecipeExtraction } from "./spisbedre.js";

const clean = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";

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
  const normalized: NormalizedRecipeV2 = {
    title,
    ...(description ? { description } : {}),
    ingredients,
    instructions: instructions.map((text, index) => ({ position: index + 1, text })),
    ...(yieldText ? { yieldText } : {}),
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
