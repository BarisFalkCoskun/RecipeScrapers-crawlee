/**
 * Accounts for every page a JSON-LD source's listing declares but V2 does not
 * store, by putting each one through the crawler's own extractor.
 *
 * explain-rejections.cjs walks wprm_recipe and keys on a WPRM record id. The
 * WordPress-posts sources have neither: they list /wp/v2/posts and their stored
 * records are JSON-LD carrying no such id. Running that tool against them
 * compared recipes to blog posts and reported a shortfall that was mostly posts
 * with no recipe on them - and, before its id handling was fixed, reported
 * missing=0 having compared nothing at all.
 *
 * A post the listing declares is accounted for when it is stored, or when
 * fetching it shows the crawler was right not to store it. Anything else is an
 * unexplained rejection and the source is not complete.
 *
 *   npx tsx tools/parity/explain-jsonld-rejections.ts <sourceId> <dbName>
 */
import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
import { DANISH_JSONLD_SOURCES } from "../../src/danish-jsonld/source-registry.js";
import { extractCompleteJsonLdRecipes } from "../../src/danish-jsonld/recipe-document.js";

// inspiredtaste answers 406 to a request with Node's default user agent and 200
// to a browser one, on every page including the first. The crawler sends
// browser-like headers, so a tool checking its work has to as well or it reports
// the source unreachable when the crawl had no trouble at all.
const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
  + "Chrome/125.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

const [sourceId, dbName] = process.argv.slice(2);
if (!sourceId || !dbName) {
  console.error("usage: explain-jsonld-rejections.ts <sourceId> <dbName>");
  process.exit(2);
}

const mongoUri = (): string => {
  const line = readFileSync(".env", "utf8")
    .split("\n")
    .find((l) => l.startsWith("MONGODB_URI"));
  return line
    ? line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/gu, "")
    : "mongodb://127.0.0.1:27017";
};

/** Compare links the way the crawler stores them: no scheme, www or trailing slash. */
const key = (url: string): string =>
  String(url)
    .replace(/^https?:\/\//u, "")
    .replace(/^www\./u, "")
    .replace(/[#?].*$/u, "")
    .replace(/\/+$/u, "")
    .toLowerCase();

async function main() {
  const source = DANISH_JSONLD_SOURCES.find((s) => s.id === sourceId);
  if (!source?.startUrls?.length) {
    console.log(`${sourceId} | UNKNOWN: no listing URL in the registry`);
    process.exit(1);
  }
  const start = new URL(source.startUrls[0]!);
  const base = `${start.origin}${start.pathname}`;
  let size = Number(start.searchParams.get("per_page")) || 100;

  const declared = new Map<string, string>();
  let announced = Number.NaN;
  for (let page = 1; page <= 1000; page += 1) {
    const res = await fetch(`${base}?per_page=${size}&page=${page}`, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(90_000),
    });
    if ([403, 406, 429, 454, 455].includes(res.status)) {
      console.log(`${sourceId} | INCONCLUSIVE: the listing answered ${res.status}, so the declared set is partial`);
      process.exit(1);
    }
    const total = Number(res.headers.get("x-wp-total"));
    if (page === 1 && Number.isFinite(total)) announced = total;
    const body = (await res.json().catch(() => null)) as Array<{ link?: string }> | null;
    if (!Array.isArray(body) || body.length === 0) break;
    if (page === 1 && body.length < size) size = body.length;
    let added = 0;
    for (const post of body) {
      const link = String(post?.link ?? "");
      if (link === "" || declared.has(key(link))) continue;
      declared.set(key(link), link);
      added += 1;
    }
    if (added === 0) break;
    if (Number.isFinite(announced) && declared.size >= announced) break;
  }
  if (Number.isFinite(announced) && declared.size !== announced) {
    console.log(`${sourceId} | INCONCLUSIVE: walked ${declared.size} posts but the listing announces ${announced}`);
    process.exit(1);
  }

  const client = new MongoClient(mongoUri());
  await client.connect();
  const stored = await client
    .db(dbName)
    .collection("recipes_v2")
    .find({ sourceId }, { projection: { canonicalUrl: 1, pageUrl: 1 } })
    .toArray();
  await client.close();
  const storedKeys = new Set<string>();
  for (const doc of stored) {
    if (doc.canonicalUrl) storedKeys.add(key(String(doc.canonicalUrl)));
    if (doc.pageUrl) storedKeys.add(key(String(doc.pageUrl)));
  }

  const missing = [...declared.entries()].filter(([k]) => !storedKeys.has(k));
  const reasons: Record<string, number> = {};
  const unexplained: string[] = [];
  const defective: string[] = [];
  const unchecked: string[] = [];
  // The tool fetches as fast as the event loop allows, which is how rockrecipes
  // turned 170 of its missing pages into 429s. EXPLAIN_DELAY_MS paces the walk
  // so a source that rate-limits can still be checked; it only ever slows this
  // tool down, and it does not touch how the crawler itself is paced.
  const delayMs = Number(process.env.EXPLAIN_DELAY_MS ?? 0);
  let first = true;
  for (const [, link] of missing) {
    if (!first && delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    first = false;
    let html = "";
    let finalUrl = link;
    try {
      const res = await fetch(link, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) {
        // A 404 or 410 explains the shortfall: the page the listing declares is
        // gone, so V2 was right to hold nothing for it. A 429 or a 5xx explains
        // nothing at all - it says this tool was turned away and never got to
        // look. Counting those as explanations is how rockrecipes reported ALL
        // SHORTFALL EXPLAINED with 170 of its 270 missing pages unexamined.
        const refused = res.status === 429 || res.status >= 500;
        reasons[`page answers ${res.status}`] = (reasons[`page answers ${res.status}`] ?? 0) + 1;
        if (refused) unchecked.push(`${link} (answered ${res.status})`);
        continue;
      }
      finalUrl = res.url || link;
      html = await res.text();
    } catch {
      reasons["page could not be fetched"] = (reasons["page could not be fetched"] ?? 0) + 1;
      unchecked.push(`${link} (could not be fetched)`);
      continue;
    }
    // A listing link can point at a post the site has since renamed: it answers
    // 200 after a redirect, and the page names a different canonical - the one
    // V2 stored. butternutbakeryblog lists peanut-butter-brownie-ice-cream-
    // sandwiches, which lands on brownie-cookie-ice-cream-sandwiches. Comparing
    // only the listing's own link reported those as recipes V2 had missed.
    const canonicalMatch = html.match(
      /<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*\bhref\s*=\s*["']([^"']+)["']/iu,
    );
    const alternatives = [finalUrl, canonicalMatch?.[1]].filter(Boolean) as string[];
    if (alternatives.some((url) => storedKeys.has(key(url)))) {
      reasons["listing link redirects to a page already stored"] =
        (reasons["listing link redirects to a page already stored"] ?? 0) + 1;
      continue;
    }

    const extraction = extractCompleteJsonLdRecipes(html);
    if (extraction.recipes.length > 0) {
      unexplained.push(link);
    } else if (extraction.incompleteJsonLdCount > 0) {
      reasons["recipe json-ld missing a name, ingredients or instructions"] =
        (reasons["recipe json-ld missing a name, ingredients or instructions"] ?? 0) + 1;
      defective.push(`${link} (recipe json-ld missing a name, ingredients or instructions)`);
    } else if (extraction.malformedJsonLdCount > 0) {
      reasons["recipe json-ld does not parse"] = (reasons["recipe json-ld does not parse"] ?? 0) + 1;
      defective.push(`${link} (recipe json-ld does not parse)`);
    } else {
      reasons["post carries no recipe"] = (reasons["post carries no recipe"] ?? 0) + 1;
    }
  }

  const parts = Object.entries(reasons).map(([why, n]) => `${n} ${why}`);
  if (unexplained.length > 0) parts.push(`${unexplained.length} unexplained`);
  const verdict = unchecked.length > 0
    ? "INCONCLUSIVE"
    : unexplained.length === 0
      ? "ALL SHORTFALL EXPLAINED"
      : "UNEXPLAINED SHORTFALL";
  // The examples print first so the verdict is the last line: callers that keep
  // only the tail of this output were silently dropping the verdict for every
  // source that had an example to show, which is every source that failed.
  for (const link of unexplained.slice(0, 5)) console.log(`  unexplained: ${link}`);
  // A page whose markup is broken is explained but not thereby anonymous. The
  // promotion bar accepts a shortfall only where every missing record is an
  // individually named upstream defect, and this tool was counting those
  // without saying which pages they were, so a reason could only ever repeat
  // the count back. "post carries no recipe" stays a bulk category - most of a
  // blog's posts are not recipes and naming them proves nothing.
  for (const link of defective) console.log(`  defect: ${link}`);
  for (const link of unchecked.slice(0, 5)) console.log(`  unchecked: ${link}`);
  if (unchecked.length > 0) {
    console.log(
      `  ${unchecked.length} of ${missing.length} missing pages were never examined; ` +
        "re-run more slowly before reading the verdict as completeness",
    );
  }
  console.log(
    `${sourceId} | ${verdict} | declared=${declared.size} stored=${stored.length} ` +
      `missing=${missing.length}${parts.length ? ` (${parts.join(", ")})` : ""}`,
  );
  process.exit(unexplained.length === 0 && unchecked.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
