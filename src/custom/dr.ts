import * as cheerio from "cheerio";
import type { DanishJsonLdRequest } from "../danish-jsonld/crawler.js";
import type { NormalizedRecipeV2 } from "../types.js";
import type { EmbeddedRecipeExtraction } from "./spisbedre.js";

export const DR_GRAPHQL_URL = "https://www.dr.dk/tjenester/steffi/graphql";
const RECIPE_SITE_URN = "urn:dr:drupal:site:da17e16c-3485-4ef2-ac0f-617f9cc953e9";
const PAGE_SIZE = 500;

const LIST_QUERY = `query SitePublications($urn: String!, $limit: Int!, $offset: Int) {
  site(urn: $urn) { publications(includeSubSites: true, limit: $limit, offset: $offset) {
    content { ... on Article { urn title urlPathId } }
  } }
}`;
const ARTICLE_QUERY = `query Article($urn: String!) {
  article(urn: $urn) {
    urn title summary urlPathId startDate changedDate
    body { __typename ... on HeadingComponent { text } ... on ParagraphComponent { body }
      ... on ListComponent { title boxed list }
      ... on EmphasizedListComponent { items { title marker body {
        __typename ... on HeadingComponent { text } ... on ParagraphComponent { body }
        ... on ListComponent { title boxed list }
      } } } }
    contributions { agent { ... on Person { name } } role }
    site { title } teaserImage { default { url managedUrl } }
  }
}`;

const clean = (value: unknown): string =>
  typeof value === "string"
    ? cheerio.load(value).text().replace(/\s+/gu, " ").trim()
    : "";
const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

function postRequest(input: {
  kind: "listing" | "recipe";
  operation: "list" | "article";
  variables: Record<string, unknown>;
  uniqueKey: string;
}): DanishJsonLdRequest {
  return {
    kind: input.kind,
    url: DR_GRAPHQL_URL,
    method: "POST",
    requestHeaders: { "content-type": "application/json" },
    payload: JSON.stringify({
      query: input.operation === "list" ? LIST_QUERY : ARTICLE_QUERY,
      variables: input.variables,
    }),
    uniqueKey: input.uniqueKey,
    requestData: { drOperation: input.operation, ...input.variables },
  };
}

export const createDrListRequest = (offset = 0): DanishJsonLdRequest => postRequest({
  kind: "listing",
  operation: "list",
  variables: { urn: RECIPE_SITE_URN, limit: PAGE_SIZE, offset },
  uniqueKey: `dr-list:${offset}`,
});

const createDrArticleRequest = (urn: string): DanishJsonLdRequest => postRequest({
  kind: "recipe",
  operation: "article",
  variables: { urn },
  uniqueKey: `dr-article:${urn}`,
});

export function extractDrListing(body: string, offset: number): {
  requests: DanishJsonLdRequest[];
  candidateCount: number;
  terminal: boolean;
  malformed: boolean;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { requests: [], candidateCount: 0, terminal: false, malformed: true };
  }
  const data = record(parsed)?.data;
  const site = record(record(data)?.site);
  const publications = site?.publications;
  if (!Array.isArray(publications)) {
    return { requests: [], candidateCount: 0, terminal: false, malformed: true };
  }
  const requests = publications.flatMap((publication) => {
    const urn = clean(record(record(publication)?.content)?.urn);
    return urn ? [createDrArticleRequest(urn)] : [];
  });
  if (publications.length >= PAGE_SIZE) requests.push(createDrListRequest(offset + PAGE_SIZE));
  return {
    requests,
    candidateCount: requests.filter((request) => request.kind === "recipe").length,
    terminal: publications.length < PAGE_SIZE,
    malformed: false,
  };
}

function componentText(value: unknown): string {
  if (typeof value === "string") {
    try { return componentText(JSON.parse(value) as unknown); } catch { return clean(value); }
  }
  if (Array.isArray(value)) return value.map(componentText).filter(Boolean).join(" ").trim();
  const node = record(value);
  if (!node) return "";
  return [clean(node.text), componentText(node.body)].filter(Boolean).join(" ").trim();
}

function listItemText(value: unknown): string {
  const parts: string[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    const item = record(node);
    if (!item) return;
    const text = clean(item.text);
    if (text) parts.push(text);
    visit(item.body);
  };
  visit(value);
  return parts.join(" ").replace(/\s+/gu, " ").trim();
}

function listLines(value: unknown): string[] {
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { return []; }
  }
  const items = record(parsed)?.items;
  return Array.isArray(items) ? items.map(listItemText).filter(Boolean) : [];
}

export function extractDrRecipe(body: string): EmbeddedRecipeExtraction {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { incompleteCount: 0, malformedCount: 1 };
  }
  const article = record(record(record(parsed)?.data)?.article);
  if (!article || !Array.isArray(article.body)) {
    return { incompleteCount: 0, malformedCount: 1 };
  }
  const title = clean(article.title);
  const path = clean(article.urlPathId);
  const ingredients: string[] = [];
  const instructions: string[] = [];
  let inIngredients = false;
  const components = article.body.flatMap((rawComponent) => {
    const component = record(rawComponent);
    if (clean(component?.__typename) !== "EmphasizedListComponent") return [rawComponent];
    const items = component?.items;
    return Array.isArray(items)
      ? items.flatMap((item) => Array.isArray(record(item)?.body) ? record(item)?.body as unknown[] : [])
      : [];
  });
  for (const rawComponent of components) {
    const component = record(rawComponent);
    if (!component) continue;
    const type = clean(component.__typename);
    if (type === "HeadingComponent" || type === "ParagraphComponent") {
      const text = type === "HeadingComponent"
        ? clean(component.text)
        : componentText(component.body);
      const heading = text.toLocaleLowerCase("da").replace(/:$/u, "");
      if (heading.includes("ingrediens") || heading === "til" || heading.startsWith("til ")) {
        inIngredients = true;
        continue;
      } else if (heading.includes("fremgangsmåde") || heading.includes("tilberedning") ||
          heading.includes("sådan gør du")) {
        inIngredients = false;
        continue;
      }
      if (type === "ParagraphComponent" && !inIngredients && text.length > 10) {
        instructions.push(text);
      }
    } else if (type === "ListComponent" && inIngredients) {
      ingredients.push(...listLines(component.list));
    }
  }
  if (!title || !path || ingredients.length === 0 || instructions.length === 0) {
    return { incompleteCount: 1, malformedCount: 0 };
  }
  const description = clean(article.summary);
  const servings = description.match(/(\d+)(?:\s*-\s*\d+)?\s*pers/iu)?.[1];
  const teaser = record(record(article.teaserImage)?.default);
  const image = clean(teaser?.managedUrl) || clean(teaser?.url);
  const category = clean(record(article.site)?.title);
  const canonicalUrl = new URL(path, "https://www.dr.dk").toString();
  const normalized: NormalizedRecipeV2 = {
    title,
    ...(description ? { description } : {}),
    ingredients,
    instructions: instructions.map((text, index) => ({ position: index + 1, text })),
    ...(servings ? { yieldText: servings } : {}),
    imageUrls: image ? [image] : [],
    categories: category ? [category] : [],
    cuisines: [],
    keywords: [],
  };
  return {
    recipe: { canonicalUrl, rawRecipe: article, normalized },
    incompleteCount: 0,
    malformedCount: 0,
  };
}
