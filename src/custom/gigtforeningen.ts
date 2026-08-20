import * as cheerio from "cheerio";
import type { NormalizedRecipeV2 } from "../types.js";
import type {
  EmbeddedRecipe,
  EmbeddedRecipeExtraction,
} from "./spisbedre.js";

export const GIGTFORENINGEN_POSTS_API =
  "https://www.gigtforeningen.dk/wp-json/wp/v2/posts?per_page=100&page=1&_fields=id,link,title,content,yoast_head_json";

export interface GigtforeningenExtraction extends EmbeddedRecipeExtraction {
  postCount: number;
  candidateCount: number;
}

const RECIPE_PATH =
  /^\/hverdagen\/kost\/madopskrifter\/(?:fisk-og-fjerkrae|vegetar|snacks-og-soedt)\/[^/?#]+\/?$/iu;
const INGREDIENT_HEADING = /^(?:ingredienser|det skal du bruge)$/iu;
const INSTRUCTION_HEADING = /^s[aå]dan g[oø]r du:?$/iu;
const RECIPE_END_HEADING =
  /^(?:tip|servering|variationer|opskriften er|m[oø]d |f[aå] sundere|pr[oø]v |l[aæ]s ogs[aå]|kend symptomerne|energifordeling|portionen p[aå] billedet)/iu;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return cheerio.load(String(value)).text().replace(/\s+/gu, " ").trim();
}

function uniqueText(values: string[]): string[] {
  return values.filter((value, index) => value !== "" && values.indexOf(value) === index);
}

function minutesFromLabel(text: string, label: RegExp): number | undefined {
  const match = text.match(
    new RegExp(`(?:${label.source})\\s*:?\\s*(?:(\\d+)\\s*(?:timer?|hours?)\\s*(?:og\\s*)?)?(\\d+)?\\s*(?:min(?:utter?)?\\.?)?`, "iu")
  );
  if (!match) return undefined;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const total = hours * 60 + minutes;
  return total > 0 ? total : undefined;
}

function categoryFromUrl(url: URL): string[] {
  const category = url.pathname.split("/").filter(Boolean).at(-2);
  if (category === "fisk-og-fjerkrae") return ["Fisk og fjerkræ"];
  if (category === "vegetar") return ["Vegetar"];
  if (category === "snacks-og-soedt") return ["Snacks og sødt"];
  return [];
}

function extractPost(post: Record<string, unknown>): EmbeddedRecipe | null {
  const link = typeof post.link === "string" ? post.link : "";
  let canonicalUrl: URL;
  try {
    canonicalUrl = new URL(link);
  } catch {
    return null;
  }
  if (!RECIPE_PATH.test(canonicalUrl.pathname)) return null;

  const titleData = isRecord(post.title) ? post.title : {};
  const contentData = isRecord(post.content) ? post.content : {};
  const title = cleanText(titleData.rendered);
  const html = typeof contentData.rendered === "string" ? contentData.rendered : "";
  const $ = cheerio.load(html);
  const headings = $("h1,h2,h3,h4").toArray();
  const ingredientHeading = headings.find((element) =>
    INGREDIENT_HEADING.test(cleanText($(element).text()))
  );
  const instructionHeading = headings.find((element) =>
    INSTRUCTION_HEADING.test(cleanText($(element).text()))
  );
  if (!ingredientHeading || !instructionHeading) return null;

  const ingredients: string[] = [];
  let cursor = $(ingredientHeading).next();
  while (cursor.length > 0 && cursor[0] !== instructionHeading) {
    cursor.find("li").addBack("li").each((_index, element) => {
      ingredients.push(cleanText($(element).text()));
    });
    cursor = cursor.next();
  }

  const instructionTexts: string[] = [];
  cursor = $(instructionHeading).next();
  while (cursor.length > 0) {
    if (
      cursor.is("h1,h2") &&
      RECIPE_END_HEADING.test(cleanText(cursor.text()))
    ) {
      break;
    }
    cursor.find("ol li").addBack("ol li").each((_index, element) => {
      instructionTexts.push(cleanText($(element).text()));
    });
    cursor = cursor.next();
  }

  const normalizedIngredients = uniqueText(ingredients);
  const normalizedInstructions = uniqueText(instructionTexts).map((text, index) => ({
    position: index + 1,
    text,
  }));
  if (title === "" || normalizedIngredients.length === 0 || normalizedInstructions.length === 0) {
    return null;
  }

  const recipeText = $.root().text().replace(/\s+/gu, " ").trim();
  const yieldMatch = recipeText.match(/(?:til\s+)?(\d+)\s+personer\b/iu);
  const prepMinutes = minutesFromLabel(recipeText, /arbejdstid|forberedelsestid/iu);
  const totalMinutes = minutesFromLabel(recipeText, /samlet tid|total tid/iu);
  const yoast = isRecord(post.yoast_head_json) ? post.yoast_head_json : {};
  const ogImages = Array.isArray(yoast.og_image) ? yoast.og_image : [];
  const firstImage = ogImages.find(isRecord);
  const imageUrl = firstImage && typeof firstImage.url === "string"
    ? firstImage.url.trim()
    : "";
  const description = cleanText(yoast.description);
  const normalized: NormalizedRecipeV2 = {
    title,
    ...(description === "" ? {} : { description }),
    ingredients: normalizedIngredients,
    instructions: normalizedInstructions,
    ...(prepMinutes === undefined ? {} : { prepMinutes }),
    ...(totalMinutes === undefined ? {} : { totalMinutes }),
    ...(prepMinutes === undefined || totalMinutes === undefined || totalMinutes <= prepMinutes
      ? {}
      : { cookMinutes: totalMinutes - prepMinutes }),
    ...(yieldMatch ? { yieldText: `${yieldMatch[1]} personer` } : {}),
    imageUrls: imageUrl === "" ? [] : [imageUrl],
    categories: categoryFromUrl(canonicalUrl),
    cuisines: [],
    keywords: [],
  };

  return {
    canonicalUrl: canonicalUrl.toString(),
    rawRecipe: post,
    normalized,
  };
}

/**
 * Gigtforeningen's former recipe pages now redirect to the homepage, while
 * WordPress still exposes the authoritative post bodies. Parse those bodies
 * directly so discovery no longer depends on dead public routes.
 */
export function extractGigtforeningenPosts(body: string): GigtforeningenExtraction {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return { recipes: [], incompleteCount: 0, malformedCount: 1, postCount: 0, candidateCount: 0 };
  }
  if (!Array.isArray(payload)) {
    return { recipes: [], incompleteCount: 0, malformedCount: 1, postCount: 0, candidateCount: 0 };
  }

  const recipes: EmbeddedRecipe[] = [];
  let candidateCount = 0;
  let incompleteCount = 0;
  let malformedCount = 0;
  for (const value of payload) {
    if (!isRecord(value)) {
      malformedCount += 1;
      continue;
    }
    let isCandidate = false;
    try {
      isCandidate = typeof value.link === "string" && RECIPE_PATH.test(new URL(value.link).pathname);
    } catch {
      // An unrelated malformed post link is not a recipe candidate.
    }
    if (!isCandidate) continue;
    candidateCount += 1;
    const recipe = extractPost(value);
    if (recipe) recipes.push(recipe);
    else incompleteCount += 1;
  }
  return {
    recipes,
    incompleteCount,
    malformedCount,
    postCount: payload.length,
    candidateCount,
  };
}

export function nextGigtforeningenPostsRequest(
  currentUrl: string,
  totalPagesHeader: string | undefined
): { kind: "listing"; url: string } | undefined {
  const totalPages = Number(totalPagesHeader);
  if (!Number.isInteger(totalPages) || totalPages < 1) return undefined;
  const url = new URL(currentUrl);
  const currentPage = Number(url.searchParams.get("page") ?? 1);
  if (!Number.isInteger(currentPage) || currentPage < 1 || currentPage >= totalPages) {
    return undefined;
  }
  url.searchParams.set("page", String(currentPage + 1));
  return { kind: "listing", url: url.toString() };
}
