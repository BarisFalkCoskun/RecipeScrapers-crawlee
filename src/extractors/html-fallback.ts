import type { CheerioAPI } from "cheerio";

interface HtmlExtractionResult {
  recipes: Record<string, unknown>[];
  confidence: number;
  signals: string[];
}

const INGREDIENT_KEYWORDS = ["ingredienser", "ingrediens", "ingredients"];
const INSTRUCTION_KEYWORDS = [
  "fremgangsmaade",
  "fremgangsmåde",
  "tilberedning",
  "instructions",
  "method",
  "steps",
];

export function extractHtmlFallback($: CheerioAPI): HtmlExtractionResult {
  // Try microdata first (higher confidence than heuristics)
  const microdataResult = extractMicrodata($);
  if (microdataResult) return microdataResult;

  // Fall back to heuristic extraction
  const signals: string[] = [];
  const recipe: Record<string, unknown> = {};
  let fieldsFound = 0;

  // Extract title
  const h1 = $("h1").first().text().trim();
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();

  if (h1) {
    recipe["title"] = h1;
    signals.push("heuristic-title-from-h1");
    fieldsFound++;
  } else if (ogTitle) {
    recipe["title"] = ogTitle;
    signals.push("heuristic-title-from-og");
    fieldsFound++;
  } else {
    signals.push("missing-title");
  }

  // Extract ingredients — find ul near ingredient keywords
  const ingredients = findListNearKeyword($, INGREDIENT_KEYWORDS, "ul");
  if (ingredients.length > 0) {
    recipe["ingredients"] = ingredients;
    signals.push("heuristic-ingredients-from-ul");
    fieldsFound++;
  } else {
    signals.push("missing-ingredients");
  }

  // Extract instructions — find ol near instruction keywords
  const instructions = findListNearKeyword($, INSTRUCTION_KEYWORDS, "ol");
  if (instructions.length > 0) {
    recipe["instructions"] = instructions;
    signals.push("heuristic-instructions-from-ol");
    fieldsFound++;
  } else {
    signals.push("missing-instructions");
  }

  const confidence = fieldsFound / 3;
  const recipes = fieldsFound > 0 ? [recipe] : [];

  return { recipes, confidence, signals };
}

function extractMicrodata($: CheerioAPI): HtmlExtractionResult | null {
  const recipeEl = $('[itemtype*="schema.org/Recipe"]');
  if (recipeEl.length === 0) return null;

  const signals: string[] = ["microdata-found"];
  const recipe: Record<string, unknown> = {};
  let fieldsFound = 0;

  // Extract itemprop fields from the microdata-annotated element
  const name = recipeEl.find('[itemprop="name"]').first().text().trim()
    || recipeEl.attr("itemscope") !== undefined && recipeEl.find("h1, h2").first().text().trim()
    || "";
  if (name) {
    recipe["name"] = name;
    fieldsFound++;
  }

  const ingredients: string[] = [];
  recipeEl.find('[itemprop="recipeIngredient"], [itemprop="ingredients"]').each((_i, el) => {
    const text = $(el).text().trim();
    if (text) ingredients.push(text);
  });
  if (ingredients.length > 0) {
    recipe["recipeIngredient"] = ingredients;
    fieldsFound++;
  }

  const instructions: string[] = [];
  recipeEl.find('[itemprop="recipeInstructions"]').each((_i, el) => {
    const text = $(el).text().trim();
    if (text) instructions.push(text);
  });
  if (instructions.length > 0) {
    recipe["recipeInstructions"] = instructions;
    fieldsFound++;
  }

  const image = recipeEl.find('[itemprop="image"]').first();
  const imageUrl = image.attr("src") || image.attr("content");
  if (imageUrl) recipe["image"] = imageUrl;

  if (fieldsFound === 0) return null;

  return {
    recipes: [recipe],
    confidence: Math.min(fieldsFound / 3, 1.0),
    signals,
  };
}

function findListNearKeyword(
  $: CheerioAPI,
  keywords: string[],
  listTag: string
): string[] {
  const headings = $("h1, h2, h3, h4, h5, h6");
  for (let i = 0; i < headings.length; i++) {
    const headingText = $(headings[i]).text().toLowerCase().trim();
    if (keywords.some((kw) => headingText.includes(kw))) {
      const list = $(headings[i]).nextAll(listTag).first();
      if (list.length > 0) {
        const items: string[] = [];
        list.find("li").each((_j, li) => {
          const text = $(li).text().trim();
          if (text) items.push(text);
        });
        if (items.length > 0) return items;
      }
    }
  }
  return [];
}
