import type { CheerioAPI } from "cheerio";

export interface SiteExtractionResult {
  recipes: Record<string, unknown>[];
  confidence: number;
  signals: string[];
}

interface SiteExtractor {
  domains: string[];
  extract: ($: CheerioAPI, domain: string) => SiteExtractionResult | null;
}

const SITE_EXTRACTORS: SiteExtractor[] = [
  {
    domains: ["arla.dk"],
    extract: extractArlaRecipe,
  },
  {
    domains: ["madensverden.dk"],
    extract: extractMadensVerdenRecipe,
  },
  {
    domains: ["dk-kogebogen.dk", "www.dk-kogebogen.dk"],
    extract: extractDkKogebogenRecipe,
  },
];

export function extractSiteSpecificRecipe(
  $: CheerioAPI,
  domain?: string
): SiteExtractionResult | null {
  if (!domain) {
    return null;
  }

  const extractor = SITE_EXTRACTORS.find((candidate) =>
    candidate.domains.some(
      (candidateDomain) =>
        domain === candidateDomain || domain.endsWith(`.${candidateDomain}`)
    )
  );

  return extractor ? extractor.extract($, domain) : null;
}

function extractArlaRecipe($: CheerioAPI): SiteExtractionResult | null {
  const recipe: Record<string, unknown> = {};
  let fieldsFound = 0;

  const name = cleanText($("h1").first().text());
  if (name) {
    assignTextField(recipe, "name", name, "title");
    fieldsFound++;
  }

  const description = collectDescriptionBeforeHeading($, "Ingredienser");
  if (description) {
    recipe["description"] = description;
  }

  const totalTime = firstMatch(
    $("body")
      .text()
      .split(/\n+/)
      .map((line) => cleanText(line)),
    /^\d+\s*(?:min(?:utter)?|time(?:r)?(?:\s+\d+\s*min(?:utter)?)?)$/i
  );
  if (totalTime) {
    recipe["totalTime"] = totalTime;
  }

  const ingredients = extractSectionItems($, ["Ingredienser"]);
  if (ingredients.length > 0) {
    assignListField(recipe, "recipeIngredient", ingredients, "ingredients");
    fieldsFound++;
  }

  const instructions = extractSectionItems($, ["Sådan gør du"]);
  if (instructions.length > 0) {
    assignListField(
      recipe,
      "recipeInstructions",
      instructions,
      "instructions"
    );
    fieldsFound++;
  }

  if (fieldsFound === 0) {
    return null;
  }

  return {
    recipes: [recipe],
    confidence: Math.min(fieldsFound / 3 + 0.15, 1),
    signals: ["site-specific-arla"],
  };
}

function extractMadensVerdenRecipe($: CheerioAPI): SiteExtractionResult | null {
  const recipe: Record<string, unknown> = {};
  let fieldsFound = 0;

  const name = cleanText($("h1").first().text());
  if (name) {
    assignTextField(recipe, "name", name, "title");
    fieldsFound++;
  }

  const description = textBetweenLabelPairs($, "Samlet tid:", ["Antal:", "Ret:"]);
  if (description) {
    recipe["description"] = description;
  }

  for (const [field, labels] of [
    ["prepTime", ["Forb. tid:", "Forberedelsestid:"]],
    ["cookTime", ["Tilb. tid:", "Tilberedningstid:"]],
    ["totalTime", ["Samlet tid:"]],
    ["recipeYield", ["Antal:"]],
    ["recipeCategory", ["Ret:"]],
    ["recipeCuisine", ["Køkken:"]],
  ] as const) {
    const value = valueFromLabels($, labels);
    if (value) {
      recipe[field] = value;
    }
  }

  const ingredients = extractSectionItems($, ["Ingredienser"]);
  if (ingredients.length > 0) {
    assignListField(recipe, "recipeIngredient", ingredients, "ingredients");
    fieldsFound++;
  }

  const instructions = extractSectionItems($, ["Fremgangsmåde"]);
  if (instructions.length > 0) {
    assignListField(
      recipe,
      "recipeInstructions",
      instructions,
      "instructions"
    );
    fieldsFound++;
  }

  if (fieldsFound === 0) {
    return null;
  }

  return {
    recipes: [recipe],
    confidence: Math.min(fieldsFound / 3 + 0.2, 1),
    signals: ["site-specific-madensverden"],
  };
}

function extractDkKogebogenRecipe($: CheerioAPI): SiteExtractionResult | null {
  const recipe: Record<string, unknown> = {};
  let fieldsFound = 0;
  const bodyText = bodyTextWithBreaks($);

  const name = cleanText($("h1").first().text()) || extractLeadingHeading(bodyText);
  if (name) {
    assignTextField(recipe, "name", name, "title");
    fieldsFound++;
  }

  for (const [field, label] of [
    ["recipeYield", "Antal"],
    ["recipeCategory", "Ret"],
    ["recipeCuisine", "Oprindelsesland"],
  ] as const) {
    const value = valueFromTextLabel(bodyText, label);
    if (value) {
      recipe[field] = value;
    }
  }

  const ingredients = sectionLines(bodyText, "Ingredienser", ["Opskrift", "Tips", "karakterer"]);
  if (ingredients.length > 0) {
    assignListField(recipe, "recipeIngredient", ingredients, "ingredients");
    fieldsFound++;
  }

  const instructions = sectionParagraphs(bodyText, "Opskrift", ["Tips", "karakterer"]);
  if (instructions.length > 0) {
    assignListField(
      recipe,
      "recipeInstructions",
      instructions,
      "instructions"
    );
    fieldsFound++;
  }

  const description = sectionParagraphs(bodyText, "Tips", ["karakterer"]).join(" ");
  if (description) {
    recipe["description"] = description;
  }

  if (fieldsFound === 0) {
    return null;
  }

  return {
    recipes: [recipe],
    confidence: Math.min(fieldsFound / 3 + 0.2, 1),
    signals: ["site-specific-dk-kogebogen"],
  };
}

function collectDescriptionBeforeHeading(
  $: CheerioAPI,
  headingText: string
): string | null {
  const heading = findHeading($, [headingText]);
  if (heading.length === 0) {
    return null;
  }

  const paragraphs = heading
    .prevAll("p")
    .toArray()
    .map((el) => cleanText($(el).text()))
    .filter(Boolean)
    .reverse();

  return paragraphs.length > 0 ? paragraphs.join(" ") : null;
}

function extractSectionItems($: CheerioAPI, headings: string[]): string[] {
  const heading = findHeading($, headings);
  if (heading.length === 0) {
    return [];
  }

  const section = collectSectionSiblings($, heading);
  const listItems = unique(
    section
      .find("li")
      .toArray()
      .map((el) => cleanText($(el).text().replace(/^▢\s*/u, "")))
      .filter(Boolean)
  );

  if (listItems.length > 0) {
    return listItems;
  }

  return unique(
    section
      .toArray()
      .flatMap((el) =>
        splitLines(cleanText($(el).text().replace(/^▢\s*/u, "")))
      )
      .filter(Boolean)
  );
}

function findHeading($: CheerioAPI, headings: string[]) {
  return $("h1, h2, h3, h4, h5, h6").filter((_i, el) => {
    const text = cleanText($(el).text()).toLowerCase();
    return headings.some((heading) => text === heading.toLowerCase());
  }).first();
}

function collectSectionSiblings($: CheerioAPI, heading: ReturnType<CheerioAPI>): ReturnType<CheerioAPI> {
  let current = heading.next();
  let section = current;

  while (current.length > 0) {
    if (current.is("h1, h2, h3, h4, h5, h6")) {
      break;
    }

    current = current.next();
    if (current.length > 0 && !current.is("h1, h2, h3, h4, h5, h6")) {
      section = section.add(current);
    }
  }

  return section;
}

function valueFromLabels($: CheerioAPI, labels: readonly string[]): string | null {
  const labelSelectors = $("body *");

  for (let i = 0; i < labelSelectors.length; i++) {
    const el = labelSelectors[i];
    const text = cleanText($(el).text());
    if (!labels.some((label) => text.startsWith(label))) {
      continue;
    }

    const inline = cleanText(
      labels.reduce((value, label) => value.replace(label, ""), text)
    );
    if (inline) {
      return inline;
    }

    const nextText = cleanText($(el).next().text());
    if (nextText) {
      return nextText;
    }
  }

  return null;
}

function textBetweenLabelPairs(
  $: CheerioAPI,
  startLabel: string,
  endLabels: string[]
): string | null {
  const lines = bodyTextWithBreaks($)
    .split("\n")
    .map((line) => cleanText(line))
    .filter(Boolean);

  const startIndex = lines.findIndex((line) => line.startsWith(startLabel));
  if (startIndex === -1) {
    return null;
  }

  const endIndex = lines.findIndex(
    (line, index) =>
      index > startIndex &&
      endLabels.some((label) => line.startsWith(label))
  );

  const slice = lines.slice(startIndex + 1, endIndex === -1 ? undefined : endIndex);
  return slice.length > 0 ? slice.join(" ") : null;
}

function bodyTextWithBreaks($: CheerioAPI): string {
  return ($("body").html() ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h1|h2|h3|h4|h5|h6|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ");
}

function valueFromTextLabel(text: string, label: string): string | null {
  const match = text.match(
    new RegExp(`${escapeRegExp(label)}\\s*:\\s*([^\\n]+)`, "i")
  );
  return match ? cleanText(match[1]) : null;
}

function sectionLines(
  text: string,
  startLabel: string,
  endLabels: string[]
): string[] {
  const section = extractTextSection(text, startLabel, endLabels);
  if (!section) {
    return [];
  }

  return trimAtEndLabels(
    section
      .split("\n")
      .map((line) => cleanText(line))
      .filter((line) => line.length > 1),
    endLabels
  );
}

function sectionParagraphs(
  text: string,
  startLabel: string,
  endLabels: string[]
): string[] {
  const section = extractTextSection(text, startLabel, endLabels);
  if (!section) {
    return [];
  }

  return trimAtEndLabels(
    section
      .split(/\n{2,}|\n(?=[A-ZÆØÅ])/u)
      .map((line) => cleanText(line))
      .filter((line) => line.length > 1),
    endLabels
  );
}

function extractTextSection(
  text: string,
  startLabel: string,
  endLabels: string[]
): string | null {
  const startPattern = new RegExp(`${escapeRegExp(startLabel)}\\s*:`, "i");
  const startMatch = startPattern.exec(text);
  if (!startMatch) {
    return null;
  }

  const afterStart = text.slice(startMatch.index + startMatch[0].length);
  const endPattern = new RegExp(
    `\\n(?:${endLabels.map(escapeRegExp).join("|")})\\s*:`,
    "i"
  );
  const endMatch = endPattern.exec(afterStart);
  return normalizeSectionWhitespace(
    endMatch ? afterStart.slice(0, endMatch.index) : afterStart
  );
}

function extractLeadingHeading(text: string): string | null {
  const firstLine = cleanText(text.split("\n").find((line) => cleanText(line)) ?? "");
  return firstLine || null;
}

function splitLines(value: string): string[] {
  return value
    .split(/\n+|(?<=\.)\s+(?=[A-ZÆØÅ])/u)
    .map((line) => cleanText(line))
    .filter(Boolean);
}

function assignTextField(
  recipe: Record<string, unknown>,
  key: string,
  value: string,
  compatibilityKey?: string
) {
  recipe[key] = value;
  if (compatibilityKey) {
    recipe[compatibilityKey] = value;
  }
}

function assignListField(
  recipe: Record<string, unknown>,
  key: string,
  value: string[],
  compatibilityKey?: string
) {
  recipe[key] = value;
  if (compatibilityKey) {
    recipe[compatibilityKey] = value;
  }
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeSectionWhitespace(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => cleanText(value)).filter(Boolean)));
}

function trimAtEndLabels(values: string[], endLabels: string[]): string[] {
  const trimmed: string[] = [];

  for (const value of values) {
    if (
      endLabels.some((label) =>
        value.toLowerCase().startsWith(`${label.toLowerCase()}:`)
      )
    ) {
      break;
    }

    trimmed.push(value);
  }

  return unique(trimmed);
}

function firstMatch(values: string[], pattern: RegExp): string | null {
  return values.find((value) => pattern.test(value)) ?? null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
