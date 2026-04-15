import type { Cheerio, CheerioAPI, Element } from "cheerio";
import { extractSiteSpecificRecipe } from "./site-specific.js";

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
const PREP_TIME_KEYWORDS = [
  "forberedelsestid",
  "prep time",
  "preparation time",
];
const COOK_TIME_KEYWORDS = ["tilberedningstid", "cook time", "cooking time"];
const TOTAL_TIME_KEYWORDS = ["samlet tid", "total time", "tid i alt"];
const YIELD_KEYWORDS = ["portioner", "serves", "serveringer", "udbytte"];

export function extractHtmlFallback($: CheerioAPI): HtmlExtractionResult {
  const microdataResult = extractMicrodata($);
  if (microdataResult) return microdataResult;

  const canonicalHref = $('link[rel="canonical"]').attr("href");
  const ogUrl = $('meta[property="og:url"]').attr("content");
  const siteDomain = inferDomain(canonicalHref ?? ogUrl);
  const siteSpecificResult = extractSiteSpecificRecipe($, siteDomain);
  if (siteSpecificResult) return siteSpecificResult;

  const signals: string[] = [];
  const recipe: Record<string, unknown> = {};
  let fieldsFound = 0;

  const h1 = cleanText($("h1").first().text());
  const ogTitle = cleanText($('meta[property="og:title"]').attr("content"));
  const metaTitle = cleanText($('meta[name="twitter:title"]').attr("content"));

  const title = h1 || ogTitle || metaTitle;
  if (title) {
    assignRecipeTextField(recipe, "name", title, {
      compatibilityKey: "title",
    });
    signals.push(h1 ? "heuristic-title-from-h1" : "heuristic-title-from-meta");
    fieldsFound++;
  } else {
    signals.push("missing-title");
  }

  const ingredients = findItemsNearKeyword($, INGREDIENT_KEYWORDS);
  if (ingredients.length > 0) {
    assignRecipeListField(recipe, "recipeIngredient", ingredients, {
      compatibilityKey: "ingredients",
    });
    signals.push("heuristic-ingredients-from-nearby-content");
    fieldsFound++;
  } else {
    signals.push("missing-ingredients");
  }

  const instructions = findItemsNearKeyword($, INSTRUCTION_KEYWORDS);
  if (instructions.length > 0) {
    assignRecipeListField(recipe, "recipeInstructions", instructions, {
      compatibilityKey: "instructions",
    });
    signals.push("heuristic-instructions-from-nearby-content");
    fieldsFound++;
  } else {
    signals.push("missing-instructions");
  }

  const heuristicFields = [
    {
      key: "prepTime",
      keywords: PREP_TIME_KEYWORDS,
      signal: "heuristic-prep-time",
    },
    {
      key: "cookTime",
      keywords: COOK_TIME_KEYWORDS,
      signal: "heuristic-cook-time",
    },
    {
      key: "totalTime",
      keywords: TOTAL_TIME_KEYWORDS,
      signal: "heuristic-total-time",
    },
    {
      key: "recipeYield",
      keywords: YIELD_KEYWORDS,
      signal: "heuristic-yield",
    },
  ] as const;

  for (const field of heuristicFields) {
    const value = findValueNearKeyword($, field.keywords);
    if (value) {
      assignRecipeTextField(recipe, field.key, value);
      signals.push(field.signal);
    }
  }

  const recipes = fieldsFound > 0 ? [recipe] : [];
  const confidence = fieldsFound / 3;

  return { recipes, confidence, signals };
}

function inferDomain(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function extractMicrodata($: CheerioAPI): HtmlExtractionResult | null {
  const recipeEl = $('[itemtype*="schema.org/Recipe"]');
  if (recipeEl.length === 0) return null;

  const signals: string[] = ["microdata-found"];
  const recipe: Record<string, unknown> = {};
  let fieldsFound = 0;

  const name =
    collectMicrodataValue(recipeEl, $,'[itemprop="name"]').at(0) ??
    cleanText(recipeEl.find("h1, h2").first().text());
  if (name) {
    assignRecipeTextField(recipe, "name", name, {
      compatibilityKey: "title",
    });
    fieldsFound++;
  }

  const ingredients = collectMicrodataValue(
    recipeEl,
    $,
    '[itemprop="recipeIngredient"], [itemprop="ingredients"]'
  );
  if (ingredients.length > 0) {
    assignRecipeListField(recipe, "recipeIngredient", ingredients, {
      compatibilityKey: "ingredients",
    });
    fieldsFound++;
  }

  const instructions = collectInstructionValues(
    recipeEl.find('[itemprop="recipeInstructions"]'),
    $
  );
  if (instructions.length > 0) {
    assignRecipeListField(recipe, "recipeInstructions", instructions, {
      compatibilityKey: "instructions",
    });
    fieldsFound++;
  }

  const image = collectMicrodataValue(recipeEl, $, '[itemprop="image"]').at(0);
  if (image) {
    recipe["image"] = image;
  }

  const description = collectMicrodataValue(
    recipeEl,
    $,
    '[itemprop="description"]'
  ).at(0);
  if (description) {
    recipe["description"] = description;
  }

  for (const key of ["prepTime", "cookTime", "totalTime", "recipeYield"] as const) {
    const value = collectMicrodataValue(recipeEl, $, `[itemprop="${key}"]`).at(0);
    if (value) {
      recipe[key] = value;
    }
  }

  if (fieldsFound === 0) return null;

  return {
    recipes: [recipe],
    confidence: Math.min(fieldsFound / 3, 1),
    signals,
  };
}

function collectMicrodataValue(
  scope: Cheerio<Element>,
  $: CheerioAPI,
  selector: string
): string[] {
  const values: string[] = [];

  scope.find(selector).each((_i, el) => {
    const $el = $(el);
    const content =
      cleanText($el.attr("content")) ||
      cleanText($el.attr("datetime")) ||
      cleanText($el.attr("href")) ||
      cleanText($el.attr("src")) ||
      cleanText($el.text());

    if (content) {
      values.push(content);
    }
  });

  return unique(values);
}

function collectInstructionValues(
  elements: Cheerio<Element>,
  $: CheerioAPI
): string[] {
  const values: string[] = [];

  elements.each((_i, el) => {
    const $el = $(el);
    const nestedItems = extractListItems($el, $);
    if (nestedItems.length > 0) {
      values.push(...nestedItems);
      return;
    }

    const splitBlocks = splitTextBlocks(cleanText($el.text()));
    if (splitBlocks.length > 0) {
      values.push(...splitBlocks);
    }
  });

  return unique(values);
}

function findItemsNearKeyword($: CheerioAPI, keywords: string[]): string[] {
  const headings = $("h1, h2, h3, h4, h5, h6");

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const headingText = cleanText($(heading).text()).toLowerCase();

    if (!keywords.some((kw) => headingText.includes(kw))) {
      continue;
    }

    const container = collectSectionSiblings($(heading));
    const listItems = extractListItems(container, $);
    if (listItems.length > 0) {
      return listItems;
    }

    const textBlocks = extractTextBlocks(container, $);
    if (textBlocks.length > 0) {
      return textBlocks;
    }
  }

  return [];
}

function collectSectionSiblings(
  heading: Cheerio<Element>
): Cheerio<Element> {
  let siblings = heading.next();
  let section = siblings;

  while (siblings.length > 0) {
    if (siblings.is("h1, h2, h3, h4, h5, h6")) {
      break;
    }

    siblings = siblings.next();
    if (siblings.length > 0 && !siblings.is("h1, h2, h3, h4, h5, h6")) {
      section = section.add(siblings);
    }
  }

  return section;
}

function findValueNearKeyword($: CheerioAPI, keywords: string[]): string | null {
  const labelSelectors = [
    "h1, h2, h3, h4, h5, h6",
    "dt",
    ".label, .meta-label, [class*=label], [class*=meta]",
    "strong, b",
  ].join(", ");

  const labels = $(labelSelectors);

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const labelText = cleanText($(label).text()).toLowerCase();
    if (!keywords.some((kw) => labelText.includes(kw))) {
      continue;
    }

    const nextText =
      cleanText($(label).next().text()) ||
      cleanText($(label).parent().text().replace($(label).text(), ""));
    if (nextText) {
      return nextText;
    }
  }

  return null;
}

function extractListItems(
  elements: Cheerio<Element>,
  $: CheerioAPI
): string[] {
  const values: string[] = [];

  elements.find("li").each((_i, el) => {
    const text = cleanText($(el).text());
    if (text) {
      values.push(text);
    }
  });

  return unique(values);
}

function extractTextBlocks(
  elements: Cheerio<Element>,
  $: CheerioAPI
): string[] {
  const values: string[] = [];

  for (const tag of ["p", "div"]) {
    elements.each((_i, el) => {
      const $el = $(el);

      if ($el.is("ul, ol")) {
        return;
      }

      if ($el.is(tag)) {
        const directText = extractDirectText($el);
        if (directText) {
          values.push(...splitTextBlocks(directText));
        }
      }

      $el.find(tag).each((_j, child) => {
        values.push(...splitTextBlocks(cleanText($(child).text())));
      });
    });
  }

  return unique(values).filter((value) => value.length > 3);
}

function splitTextBlocks(text: string): string[] {
  if (!text) return [];

  return unique(
    text
      .split(/\n+|(?<=\.)\s+(?=[A-ZÆØÅ])/u)
      .map((part) => cleanText(part))
      .filter(Boolean)
  );
}

function extractDirectText(element: Cheerio<Element>): string {
  return cleanText(
    element
      .contents()
      .toArray()
      .filter((node) => node.type === "text")
      .map((node) => node.data ?? "")
      .join(" ")
  );
}

function assignRecipeTextField(
  recipe: Record<string, unknown>,
  key: string,
  value: string,
  options?: { compatibilityKey?: string }
) {
  recipe[key] = value;
  if (options?.compatibilityKey) {
    recipe[options.compatibilityKey] = value;
  }
}

function assignRecipeListField(
  recipe: Record<string, unknown>,
  key: string,
  values: string[],
  options?: { compatibilityKey?: string }
) {
  recipe[key] = values;
  if (options?.compatibilityKey) {
    recipe[options.compatibilityKey] = values;
  }
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => cleanText(value)).filter(Boolean)));
}
