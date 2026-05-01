import type { CheerioAPI } from "cheerio";

export interface LanguageDetectionResult {
  language: string;
  languageConfidence: number;
  languageSignals: string[];
}

interface DetectLanguageInput {
  recipe?: Record<string, unknown>;
  $?: CheerioAPI;
  html?: string;
  domain?: string;
  bodyText?: string;
}

const UNKNOWN_LANGUAGE = "und";

const DOMAIN_LANGUAGE_HINTS: Array<{ pattern: RegExp; language: string }> = [
  { pattern: /\.dk$/i, language: "da" },
  { pattern: /\.se$/i, language: "sv" },
  { pattern: /\.no$/i, language: "no" },
  { pattern: /\.de$/i, language: "de" },
  { pattern: /\.at$/i, language: "de" },
  { pattern: /\.ch$/i, language: "de" },
  { pattern: /\.uk$/i, language: "en" },
  { pattern: /\.co\.uk$/i, language: "en" },
];

const TEXT_KEYWORDS: Record<string, string[]> = {
  da: [
    "opskrift",
    "opskrifter",
    "ingredienser",
    "fremgangsmåde",
    "tilberedning",
    "portioner",
    "minutter",
    "sådan gør du",
    "aftensmad",
    "morgenmad",
  ],
  en: [
    "recipe",
    "recipes",
    "ingredients",
    "instructions",
    "method",
    "serves",
    "minutes",
    "tablespoon",
    "teaspoon",
    "bake",
  ],
  sv: [
    "recept",
    "ingredienser",
    "gör så här",
    "tillagning",
    "portioner",
    "minuter",
    "middag",
    "frukost",
  ],
  no: [
    "oppskrift",
    "oppskrifter",
    "ingredienser",
    "fremgangsmåte",
    "tilberedning",
    "porsjoner",
    "minutter",
    "middag",
  ],
  de: [
    "rezept",
    "rezepte",
    "zutaten",
    "zubereitung",
    "anleitung",
    "portionen",
    "minuten",
    "backen",
    "kochen",
  ],
};

export function detectLanguage(
  input: DetectLanguageInput
): LanguageDetectionResult {
  const recipeLanguage = normalizeLanguageCode(
    firstLanguageString(input.recipe?.["inLanguage"])
  );
  if (recipeLanguage) {
    return {
      language: recipeLanguage,
      languageConfidence: 1,
      languageSignals: ["recipe-inLanguage"],
    };
  }

  const htmlLanguage = normalizeLanguageCode(readHtmlLanguage(input.$));
  if (htmlLanguage) {
    return {
      language: htmlLanguage,
      languageConfidence: 0.95,
      languageSignals: ["html-lang"],
    };
  }

  const ogLocaleLanguage = normalizeLanguageCode(readOgLocale(input.$));
  if (ogLocaleLanguage) {
    return {
      language: ogLocaleLanguage,
      languageConfidence: 0.9,
      languageSignals: ["og-locale"],
    };
  }

  const metaLanguage = normalizeLanguageCode(readMetaLanguage(input.$));
  if (metaLanguage) {
    return {
      language: metaLanguage,
      languageConfidence: 0.85,
      languageSignals: ["meta-language"],
    };
  }

  const domainHint = detectDomainLanguage(input.domain);
  const text = [
    textFromRecipe(input.recipe),
    input.bodyText,
    input.$ ? input.$("body").text() : undefined,
    input.html,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const textDetection = detectTextLanguage(text, domainHint?.language);

  if (textDetection) {
    return {
      ...textDetection,
      languageSignals: [
        ...textDetection.languageSignals,
        ...(domainHint && domainHint.language === textDetection.language
          ? [domainHint.signal]
          : []),
      ],
    };
  }

  if (domainHint) {
    return {
      language: domainHint.language,
      languageConfidence: 0.45,
      languageSignals: [domainHint.signal],
    };
  }

  return {
    language: UNKNOWN_LANGUAGE,
    languageConfidence: 0,
    languageSignals: ["language-undetected"],
  };
}

function readHtmlLanguage($: CheerioAPI | undefined): string | undefined {
  if (!$) {
    return undefined;
  }

  return $("html").attr("lang");
}

function readOgLocale($: CheerioAPI | undefined): string | undefined {
  if (!$) {
    return undefined;
  }

  return $('meta[property="og:locale"]').attr("content");
}

function readMetaLanguage($: CheerioAPI | undefined): string | undefined {
  if (!$) {
    return undefined;
  }

  return (
    $('meta[name="language"]').attr("content") ??
    $('meta[http-equiv="content-language"]').attr("content")
  );
}

function firstLanguageString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstLanguageString(entry);
      if (found) {
        return found;
      }
    }
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      firstLanguageString(record["alternateName"]) ??
      firstLanguageString(record["identifier"]) ??
      firstLanguageString(record["name"])
    );
  }

  return undefined;
}

function normalizeLanguageCode(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/_/g, "-");
  if (!normalized) {
    return null;
  }

  if (normalized === "dk" || normalized.startsWith("da")) {
    return "da";
  }

  if (normalized.startsWith("en")) {
    return "en";
  }

  if (normalized.startsWith("sv") || normalized.startsWith("se")) {
    return "sv";
  }

  if (
    normalized.startsWith("no") ||
    normalized.startsWith("nb") ||
    normalized.startsWith("nn")
  ) {
    return "no";
  }

  if (normalized.startsWith("de")) {
    return "de";
  }

  return null;
}

function detectDomainLanguage(
  domain: string | undefined
): { language: string; signal: string } | null {
  if (!domain) {
    return null;
  }

  const normalized = domain.toLowerCase();
  const hint = DOMAIN_LANGUAGE_HINTS.find(({ pattern }) =>
    pattern.test(normalized)
  );

  return hint
    ? {
        language: hint.language,
        signal: `domain-hint:${hint.language}`,
      }
    : null;
}

function detectTextLanguage(
  value: string,
  preferredLanguage?: string
): LanguageDetectionResult | null {
  const normalized = normalizeText(value);
  if (normalized.length < 20) {
    return null;
  }

  const scores = Object.entries(TEXT_KEYWORDS)
    .map(([language, keywords]) => ({
      language,
      score: keywords.reduce(
        (total, keyword) => total + countKeyword(normalized, keyword),
        0
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (preferredLanguage && a.language === preferredLanguage) {
        return -1;
      }

      if (preferredLanguage && b.language === preferredLanguage) {
        return 1;
      }

      return a.language.localeCompare(b.language);
    });

  const best = scores[0];
  if (!best || best.score < 2) {
    return null;
  }

  return {
    language: best.language,
    languageConfidence: Math.min(0.55 + best.score * 0.05, 0.85),
    languageSignals: [`text-keywords:${best.language}:${best.score}`],
  };
}

function textFromRecipe(recipe: Record<string, unknown> | undefined): string {
  if (!recipe) {
    return "";
  }

  return [
    recipe["name"],
    recipe["headline"],
    recipe["title"],
    recipe["description"],
    recipe["recipeIngredient"],
    recipe["ingredients"],
    recipe["recipeInstructions"],
    recipe["instructions"],
  ]
    .flatMap(textFragments)
    .join(" ");
}

function textFragments(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(textFragments);
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(textFragments);
  }

  return [];
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function countKeyword(text: string, keyword: string): number {
  const normalizedKeyword = keyword.toLowerCase();
  let count = 0;
  let index = text.indexOf(normalizedKeyword);

  while (index !== -1) {
    count += 1;
    index = text.indexOf(normalizedKeyword, index + normalizedKeyword.length);
  }

  return count;
}
