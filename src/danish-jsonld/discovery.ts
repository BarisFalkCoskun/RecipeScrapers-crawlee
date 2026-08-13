import type { DanishJsonLdSource } from "./source-registry.js";
import * as cheerio from "cheerio";
import { normalizeDomain } from "../utils/canonicalize.js";

export interface DiscoveryResult {
  recipeUrls: string[];
  sitemapUrls: string[];
  nextUrls: string[];
  acceptedCount: number;
  rejectedByReason: Record<string, number>;
  terminal: boolean;
}

export function discoverSitemapDocument(input: {
  source: DanishJsonLdSource;
  sitemapUrl: string;
  xml: string;
}): DiscoveryResult {
  const $ = cheerio.load(input.xml, { xml: true });
  const result = emptyResult();
  const seen = new Set<string>();

  $("loc").each((_index, element) => {
    const raw = $(element).text().trim();
    const candidate = normalizeAbsoluteHttpUrl(raw);
    if (!candidate) {
      increment(result.rejectedByReason, "invalid-url");
      return;
    }
    if (seen.has(candidate)) {
      increment(result.rejectedByReason, "duplicate");
      return;
    }
    seen.add(candidate);

    const parentName = $(element).parent().prop("tagName")?.toLowerCase();
    if (parentName === "sitemap" || looksLikeSitemapUrl(candidate)) {
      if (!isAllowedDomain(input.source, candidate)) {
        increment(result.rejectedByReason, "domain-not-allowed");
        return;
      }
      result.sitemapUrls.push(candidate);
      return;
    }
    const reason = recipeRejectionReason(input.source, candidate);
    if (reason) {
      increment(result.rejectedByReason, reason);
      return;
    }
    result.recipeUrls.push(candidate);
  });

  result.acceptedCount = result.recipeUrls.length + result.sitemapUrls.length;
  result.terminal = result.sitemapUrls.length === 0;
  return result;
}

export function discoverListingPage(input: {
  source: DanishJsonLdSource;
  pageUrl: string;
  body: string;
  contentType?: string;
}): DiscoveryResult {
  const result = emptyResult();
  const candidates: Array<{ raw: string; next: boolean }> = [];

  if (input.contentType?.toLowerCase().includes("json")) {
    try {
      collectJsonUrls(JSON.parse(input.body), candidates, 0);
    } catch {
      increment(result.rejectedByReason, "malformed-listing");
    }
  } else {
    const $ = cheerio.load(input.body);
    $("a[href]").each((_index, element) => {
      const raw = $(element).attr("href");
      if (!raw) return;
      const rel = ($(element).attr("rel") ?? "").toLowerCase();
      const text = $(element).text().trim().toLowerCase();
      candidates.push({
        raw,
        next:
          rel.split(/\s+/u).includes("next") ||
          /^(?:næste|naeste|next|mere|more)(?:\s|$)/iu.test(text),
      });
    });
  }

  const seen = new Set<string>();
  for (const { raw, next } of candidates) {
    const candidate = normalizeHttpUrl(raw, input.pageUrl);
    if (!candidate) {
      increment(result.rejectedByReason, "invalid-url");
      continue;
    }
    if (seen.has(candidate)) {
      increment(result.rejectedByReason, "duplicate");
      continue;
    }
    seen.add(candidate);
    if (!isAllowedDomain(input.source, candidate)) {
      increment(result.rejectedByReason, "domain-not-allowed");
      continue;
    }
    if (next) {
      result.nextUrls.push(candidate);
      continue;
    }
    const reason = recipeRejectionReason(input.source, candidate);
    if (reason) {
      increment(result.rejectedByReason, reason);
      continue;
    }
    result.recipeUrls.push(candidate);
  }

  result.acceptedCount = result.recipeUrls.length + result.nextUrls.length;
  result.terminal = result.nextUrls.length === 0;
  return result;
}

export function matchesSourceRecipeUrl(
  source: DanishJsonLdSource,
  candidateUrl: string
): boolean {
  let url: URL;
  try {
    url = new URL(candidateUrl);
  } catch {
    return false;
  }
  return source.recipeUrlPatterns.some((pattern) => {
    try {
      const regex = new RegExp(pattern, "iu");
      return regex.test(url.toString()) || regex.test(`${url.pathname}${url.search}`);
    } catch {
      return false;
    }
  });
}

function recipeRejectionReason(
  source: DanishJsonLdSource,
  candidateUrl: string
): "domain-not-allowed" | "pattern-mismatch" | null {
  if (!isAllowedDomain(source, candidateUrl)) return "domain-not-allowed";
  if (!matchesSourceRecipeUrl(source, candidateUrl)) return "pattern-mismatch";
  return null;
}

function isAllowedDomain(source: DanishJsonLdSource, candidateUrl: string): boolean {
  const domain = normalizeDomain(new URL(candidateUrl).hostname);
  return source.allowedDomains.some(
    (allowed) => normalizeDomain(allowed) === domain
  );
}

function normalizeAbsoluteHttpUrl(raw: string): string | null {
  if (!/^https?:\/\//iu.test(raw)) return null;
  return normalizeHttpUrl(raw);
}

function normalizeHttpUrl(raw: string, base?: string): string | null {
  try {
    const url = base ? new URL(raw, base) : new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function looksLikeSitemapUrl(url: string): boolean {
  const parsed = new URL(url);
  return /(?:sitemap|\.xml(?:\.gz)?$)/iu.test(parsed.pathname);
}

function collectJsonUrls(
  value: unknown,
  output: Array<{ raw: string; next: boolean }>,
  depth: number
): void {
  if (depth > 8 || output.length >= 1_000) return;
  if (Array.isArray(value)) {
    for (const entry of value.slice(0, 1_000)) collectJsonUrls(entry, output, depth + 1);
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
    const isNextKey = /^(?:next|nextUrl|next_url|nextPage)$/iu.test(key);
    if (
      typeof nested === "string" &&
      (/^(?:url|href|link)$/iu.test(key) || isNextKey)
    ) {
      output.push({ raw: nested, next: isNextKey });
      continue;
    }
    if (isNextKey && nested !== null && typeof nested === "object") {
      collectNextUrls(nested, output, depth + 1);
      continue;
    }
    collectJsonUrls(nested, output, depth + 1);
  }
}

function collectNextUrls(
  value: unknown,
  output: Array<{ raw: string; next: boolean }>,
  depth: number
): void {
  if (depth > 8 || value === null || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
    if (typeof nested === "string" && /^(?:url|href|link)$/iu.test(key)) {
      output.push({ raw: nested, next: true });
      continue;
    }
    collectNextUrls(nested, output, depth + 1);
  }
}

function increment(counts: Record<string, number>, reason: string): void {
  counts[reason] = (counts[reason] ?? 0) + 1;
}

function emptyResult(): DiscoveryResult {
  return {
    recipeUrls: [],
    sitemapUrls: [],
    nextUrls: [],
    acceptedCount: 0,
    rejectedByReason: {},
    terminal: true,
  };
}
