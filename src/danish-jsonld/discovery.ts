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
  complete: boolean;
  incompleteReasons: DiscoveryIncompleteReason[];
}

export type DiscoveryIncompleteReason =
  | "malformed-listing-payload"
  | "unexpected-listing-shape"
  | "http-200-block-shell"
  | "script-gated-continuation"
  | "listing-window-exhausted";

/**
 * Load-more wording used by the Danish listings. A control carrying this text
 * without an href continues the listing through script, so the page is not a
 * terminal listing even though it exposes no continuation URL.
 */
const LOAD_MORE_CONTROL_PATTERN =
  /^(?:vis|se|hent|indl(?:æ|ae)s)\s+(?:flere|mere)\b|^(?:load|show)\s+more\b|^flere\s+opskrifter\b/iu;

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
      const followPatterns = input.source.sitemapDiscovery?.followPatterns ?? [];
      if (followPatterns.length > 0 && !matchesAny(candidate, followPatterns)) {
        increment(result.rejectedByReason, "sitemap-follow-mismatch");
        return;
      }
      result.sitemapUrls.push(candidate);
      return;
    }
    if ((input.source.sitemapDiscovery?.skipUrlFragments ?? []).some(
      (fragment) => candidate.toLowerCase().includes(fragment.toLowerCase())
    )) {
      increment(result.rejectedByReason, "sitemap-skip");
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
  let scriptGatedContinuation = false;

  if (looksLikeHttp200BlockShell(input.body)) {
    result.complete = false;
    result.incompleteReasons.push("http-200-block-shell");
    return result;
  }

  const payload = input.source.listingDiscovery?.payload;
  if (payload || input.contentType?.toLowerCase().includes("json")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(unwrapBrowserJsonDocument(input.body));
    } catch {
      increment(result.rejectedByReason, "malformed-listing-payload");
      result.complete = false;
      result.incompleteReasons.push("malformed-listing-payload");
      return result;
    }
    if (payload) {
      // A service that pages past its last page answers with an error
      // document, not an empty collection. That is the window ending, so it
      // has to be read before the shape check rejects it.
      const terminal = payload.terminalPayload;
      if (terminal) {
        const [value] = valuesAtJsonPath(parsed, terminal.path);
        if (value === terminal.equals) {
          result.terminal = true;
          return result;
        }
      }
      const rootMatches = payload.expectedRoot === "array"
        ? Array.isArray(parsed)
        : parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
      const recipeUrls = rootMatches
        ? payload.recipePaths.flatMap((path) => valuesAtJsonPath(parsed, path))
        : [];
      const continuationUrls = rootMatches
        ? (payload.continuationPaths ?? []).flatMap((path) => valuesAtJsonPath(parsed, path))
        : [];
      // An offset listing ends by serving an empty page; that is the contract
      // working, not an unexpected shape.
      const emptyRootArray =
        payload.expectedRoot === "array" && Array.isArray(parsed) && parsed.length === 0;
      const expectedEmpty = rootMatches && (
        emptyRootArray ||
        payload.recipePaths.some(
          (path) => jsonPathHasExpectedEmptyCollection(parsed, path)
        )
      );
      if (!rootMatches || (recipeUrls.length === 0 && !expectedEmpty)) {
        increment(result.rejectedByReason, "unexpected-listing-shape");
        result.complete = false;
        result.incompleteReasons.push("unexpected-listing-shape");
        return result;
      }
      candidates.push(
        ...recipeUrls.map((raw) => ({ raw, next: false })),
        ...continuationUrls.map((raw) => ({ raw, next: true }))
      );
      const offset = payload.continuationOffset;
      if (offset && recipeUrls.length >= offset.step) {
        const nextOffset = currentOffset(input.pageUrl, offset.parameter) + offset.step;
        if (nextOffset > offset.maxOffset) {
          result.complete = false;
          result.incompleteReasons.push("listing-window-exhausted");
        } else {
          const nextUrl = new URL(input.pageUrl);
          nextUrl.searchParams.set(offset.parameter, String(nextOffset));
          candidates.push({ raw: nextUrl.toString(), next: true });
        }
      }
    } else {
      collectJsonUrls(parsed, candidates, 0);
    }
  } else {
    const $ = cheerio.load(input.body);
    const strategy = input.source.listingDiscovery ?? {
      recipeLinkSelectors: ["a[href]"],
      skipPathFragments: [],
      continuationSelectors: ["a.next[href]", "a.page-numbers.next[href]", 'link[rel~="next"][href]'],
      continuationUrlPatterns: [],
    };
    const candidateSelector = [
      ...strategy.recipeLinkSelectors,
      ...strategy.continuationSelectors,
    ].join(", ");
    $(candidateSelector).each((_index, element) => {
      const raw = $(element).attr("href");
      if (!raw) return;
      const rel = ($(element).attr("rel") ?? "").toLowerCase();
      const text = $(element).text().trim().toLowerCase();
      candidates.push({
        raw,
        next:
          strategy.continuationSelectors.some((selector) => $(element).is(selector)) ||
          rel.split(/\s+/u).includes("next") ||
          /^(?:næste|naeste|next|mere|more)(?:\s|$)/iu.test(text),
      });
    });
    scriptGatedContinuation = hasLoadMoreControl($);
  }

  const uniqueCandidates: Array<{ candidate: string; next: boolean }> = [];
  const candidateIndexes = new Map<string, number>();
  for (const { raw, next } of candidates) {
    const candidate = normalizeHttpUrl(raw, input.pageUrl);
    if (!candidate) {
      increment(result.rejectedByReason, "invalid-url");
      continue;
    }
    const existingIndex = candidateIndexes.get(candidate);
    if (existingIndex !== undefined) {
      increment(result.rejectedByReason, "duplicate");
      if (next) uniqueCandidates[existingIndex].next = true;
      continue;
    }
    candidateIndexes.set(candidate, uniqueCandidates.length);
    uniqueCandidates.push({ candidate, next });
  }

  for (const { candidate, next } of uniqueCandidates) {
    const listingStrategy = input.source.listingDiscovery;
    const candidatePath = new URL(candidate).pathname;
    const recursiveListing = matchesAny(
      candidatePath,
      listingStrategy?.continuationUrlPatterns ?? []
    );
    const continuation = next || recursiveListing;
    if (
      !isAllowedDomain(input.source, candidate) &&
      !(continuation && isListingHost(input.source, candidate))
    ) {
      increment(result.rejectedByReason, "domain-not-allowed");
      continue;
    }
    if (continuation) {
      result.nextUrls.push(candidate);
      continue;
    }
    if ((listingStrategy?.skipPathFragments ?? []).some(
      (fragment) => new URL(candidate).pathname.toLowerCase().includes(fragment.toLowerCase())
    )) {
      increment(result.rejectedByReason, "skip-path");
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
  if (
    scriptGatedContinuation &&
    result.terminal &&
    result.recipeUrls.length > 0
  ) {
    result.complete = false;
    result.incompleteReasons.push("script-gated-continuation");
  }
  return result;
}

/**
 * A load-more control that is not a link keeps the remaining recipes behind a
 * script call, so the listing must not be reported as fully discovered.
 */
function hasLoadMoreControl($: cheerio.CheerioAPI): boolean {
  let found = false;
  $("button, a:not([href]), [role='button']").each((_index, element) => {
    if (found) return;
    const text = $(element).text().replace(/\s+/gu, " ").trim();
    if (LOAD_MORE_CONTROL_PATTERN.test(text)) found = true;
  });
  return found;
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
  // The patterns are written against readable Danish characters, while a
  // sitemap may publish the same URL percent-encoded — ingridhornshoj lists
  // /opskrift/pok%C3%A9-bowl-med-torpedorejer, which no [a-zæøåé-] class can
  // match. Both spellings are the same URL, so both are offered to the pattern.
  const candidates = [
    url.toString(),
    `${url.pathname}${url.search}`,
    url.pathname,
  ];
  const spellings = new Set(candidates);
  for (const candidate of candidates) {
    const decoded = safeDecodeUri(candidate);
    if (decoded !== undefined) spellings.add(decoded);
  }
  return source.recipeUrlPatterns.some((pattern) => {
    try {
      const regex = new RegExp(pattern, "iu");
      return [...spellings].some((spelling) => regex.test(spelling));
    } catch {
      return false;
    }
  });
}

/** Percent-decoding fails on a malformed sequence; that is not a match. */
function safeDecodeUri(value: string): string | undefined {
  try {
    const decoded = decodeURI(value);
    return decoded === value ? undefined : decoded;
  } catch {
    return undefined;
  }
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

/** Listing-only hosts never qualify a URL for recipe extraction. */
export function isListingHost(
  source: DanishJsonLdSource,
  candidateUrl: string
): boolean {
  let domain: string;
  try {
    domain = normalizeDomain(new URL(candidateUrl).hostname);
  } catch {
    return false;
  }
  return (source.listingDiscovery?.listingHosts ?? []).some(
    (allowed) => normalizeDomain(allowed) === domain
  );
}

/** Current value of an offset query parameter, defaulting to the first page. */
function currentOffset(pageUrl: string, parameter: string): number {
  try {
    const raw = new URL(pageUrl).searchParams.get(parameter);
    const parsed = Number(raw);
    return raw !== null && Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
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
    complete: true,
    incompleteReasons: [],
  };
}

function matchesAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    try {
      return new RegExp(pattern, "iu").test(value);
    } catch {
      return false;
    }
  });
}

function valuesAtJsonPath(root: unknown, path: string): string[] {
  // A leading "[]" expands a root array, so "[].url" reads each element's url.
  const rootExpanded = path.startsWith("[].");
  let values: unknown[] = rootExpanded && Array.isArray(root) ? [...root] : [root];
  for (const segment of (rootExpanded ? path.slice(3) : path).split(".")) {
    const expand = segment.endsWith("[]");
    const key = expand ? segment.slice(0, -2) : segment;
    const next: unknown[] = [];
    for (const value of values) {
      if (value === null || typeof value !== "object" || Array.isArray(value)) continue;
      const nested = (value as Record<string, unknown>)[key];
      if (expand && Array.isArray(nested)) next.push(...nested);
      else if (nested !== undefined) next.push(nested);
    }
    values = next;
  }
  return values.filter((value): value is string => typeof value === "string");
}

function jsonPathHasExpectedEmptyCollection(root: unknown, path: string): boolean {
  let value = root;
  for (const segment of path.split(".")) {
    const expand = segment.endsWith("[]");
    const key = expand ? segment.slice(0, -2) : segment;
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    value = (value as Record<string, unknown>)[key];
    if (expand) return Array.isArray(value) && value.length === 0;
  }
  return false;
}

export function looksLikeHttp200BlockShell(body: string): boolean {
  // A challenge shell is a small HTML page, so anything large or JSON-shaped is
  // not one and does not need parsing to find out. easysavory's WPRM listing is
  // 1.9 MB of JSON carrying HTML fragments; parsing it here built a tree deep
  // enough that domutils' recursive textContent overflowed the stack, failing
  // the page through every retry. Paging stopped there and the source held 200
  // of the 642 recipes it declares, with no discovery failure recorded because
  // the throw looked like a network fault.
  if (body.length > 512_000) return false;
  const opening = body.trimStart().slice(0, 1);
  if (opening === "{" || opening === "[") return false;
  // Depth is not bounded by either check, so a page that still cannot be parsed
  // is reported as what it is - not a shell we can recognise.
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(body);
  } catch {
    return false;
  }
  $("script, style, noscript, template").remove();
  const title = $("title").first().text().trim();
  const visibleBody = $("body").text().replace(/\s+/gu, " ").trim();
  const shellText = `${title} ${visibleBody}`.trim();
  if (shellText.length > 4_000 || $("a[href]").length > 20) return false;
  return /\bcaptcha\b|access denied|checking your browser|cloudflare challenge|temporarily blocked|unusual traffic/iu
    .test(shellText);
}

/**
 * Recover the JSON a browser was pointed at directly. Chromium renders a JSON
 * response inside its own viewer document, so the body arrives as HTML wrapping
 * the payload in a single `<pre>` rather than as the payload itself. The legacy
 * spiders read `document.body.innerText` for exactly this reason; taking the
 * text back out here keeps a browser-fetched API listing parseable on the same
 * path as a plain one. A body that already is JSON is returned untouched.
 */
export function unwrapBrowserJsonDocument(body: string): string {
  const trimmed = body.trim();
  if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("[")) return body;
  if (!/^<(?:!doctype\s+html|html\b)/iu.test(trimmed)) return body;

  const $ = cheerio.load(body);
  const text = ($("pre").first().text() || $("body").text()).trim();
  return text.startsWith("{") || text.startsWith("[") ? text : body;
}

/**
 * A WAF interstitial that a real browser clears by running its challenge
 * script. The status code alone cannot identify one: simply.com serves this
 * document under HTTP 454 and, intermittently, under HTTP 500, and a bare 500
 * is otherwise a genuine server error that must not be retried as a challenge.
 * The wording identifies it, and the check stays cheap because an interstitial
 * is always a small document carrying no real navigation.
 */
export function looksLikeBrowserCheckDocument(body: string): boolean {
  if (!body || body.length > 40_000) return false;
  const $ = cheerio.load(body);
  $("script, style, noscript, template").remove();
  const title = $("title").first().text().trim();
  const visibleBody = $("body").text().replace(/\s+/gu, " ").trim();
  const text = `${title} ${visibleBody}`.trim();
  if (text.length > 4_000 || $("a[href]").length > 20) return false;
  return /checking your browser|browser check failed|automatic security check|website application firewall/iu
    .test(text);
}
