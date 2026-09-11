import * as cheerio from "cheerio";
import type { NormalizedRecipeV2 } from "../types.js";
import type { EmbeddedRecipeExtraction } from "./spisbedre.js";

const clean = (value: unknown): string =>
  typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";

/**
 * samvirke.dk publishes no JSON-LD at all - not a Recipe node, not anything -
 * and every recipe page points its canonical at opskrifter.coop.dk, where the
 * Recipe node lives. Following that canonical reaches 1086 of the 1944 recipes
 * the sitemap lists; for the other 858 the coop target answers 404, so those
 * recipes exist only as samvirke.dk markup. Legacy reads them with CSS
 * selectors and holds 1944 where V2 held 1086.
 *
 * This reads the same markup legacy does, so the two sides also address a
 * recipe the same way - by its samvirke.dk URL - instead of disagreeing on
 * every record because one stores the page it fetched and the other the
 * canonical it followed.
 */
export function extractSamvirkeRecipe(
  html: string,
  canonicalUrl: string
): EmbeddedRecipeExtraction {
  const $ = cheerio.load(html);
  const title = clean($("h1").first().text());

  const ingredients: string[] = [];
  const ingredientRoot = $("div.ingredients.recipe-full--ingredients").first();
  ingredientRoot.find("tr").each((_index, row) => {
    // The note element sits inside the name cell, so the name's text already
    // carries it: for 2 spsk. aebleeddike eller hvidvinseddike the name reads
    // the whole phrase and the note reads eller hvidvinseddike on its own.
    // Appending the note as a third part repeated it, on 1737 of 1945 records.
    // Legacy joins the amount and the name and never the note.
    //
    // An ingredient with no quantity states its amount as a single dash, which
    // is punctuation for the reader rather than part of the ingredient - legacy
    // drops it, and keeping it stored - salt instead of salt.
    const amount = clean($(row).find(".ingredients--amount").text());
    const parts = [
      amount === "-" ? "" : amount,
      clean($(row).find(".ingredients--name").text()),
    ].filter(Boolean);
    const line = parts.join(" ");
    if (line) ingredients.push(line);
  });

  const instructions: string[] = [];
  $(".how-to--steps > li").each((_index, step) => {
    // The rendered step text begins with its own number - "1 Rør smør blødt" -
    // which is presentation rather than instruction.
    const text = clean($(step).text()).replace(/^\d+\s+/u, "");
    if (text) instructions.push(text);
  });

  if (!title || ingredients.length === 0 || instructions.length === 0) {
    return { incompleteCount: 1, malformedCount: 0 };
  }

  const description = clean($(".article-header--summary").text());
  const yieldText = clean($(".recipe-details--item--servings").text()).match(/\d+/u)?.[0];
  const categories = $(".recipe-full--topic-link").toArray()
    .map((element) => clean($(element).text()))
    .filter(Boolean);
  const image = clean($(".article-header img").first().attr("src"));

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
    recipe: {
      canonicalUrl,
      rawRecipe: { title, description, ingredients, instructions },
      normalized,
    },
    incompleteCount: 0,
    malformedCount: 0,
  };
}
