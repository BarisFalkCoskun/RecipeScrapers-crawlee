#!/usr/bin/env node
// Accounts for records V2 holds that a legacy run does not.
//
// A surplus is not automatically a win or a fault. It splits three ways, and the
// three want different responses:
//   - the source has withdrawn the recipe since it was crawled, so the store is
//     keeping history the listing no longer shows;
//   - the recipe is in the listing now and legacy simply did not reach it, which
//     is the truncation the halt checker looks for;
//   - neither, which needs a person.
// Only the live listing can tell them apart, so this asks it.
//
// Exit status is 0 when every surplus record is accounted for as one of the
// first two, 1 otherwise.
const fs = require("fs");
const { MongoClient } = require("mongodb");
const { DANISH_JSONLD_SOURCES } = require("../../dist/danish-jsonld/source-registry.js");

const sourceId = process.argv[2];
const database = process.argv[3];
if (!sourceId || !database) {
  console.error("usage: explain-surplus.cjs <sourceId> <database>");
  process.exit(2);
}

const mongoUri = () =>
  process.env.MONGODB_URI ||
  fs.readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("MONGODB_URI"))
    .split("=").slice(1).join("=").trim().replace(/^"|"$/gu, "");

(async () => {
  const source = DANISH_JSONLD_SOURCES.find((s) => s.id === sourceId);
  if (!source || !source.startUrls || source.startUrls.length === 0) {
    console.log(`${sourceId} | UNKNOWN: no listing URL in the registry`);
    process.exit(1);
  }
  const base = source.startUrls[0].split("?")[0];
  const byUrl = source.legacyFamily === "WpPostsJsonLdSpider";
  const canonical = (u) => String(u || "")
    .replace(/^https?:\/\/(?:www\.)?/u, "").replace(/[#?].*$/u, "").replace(/\/$/u, "").toLowerCase();
  const perPage = Number(new URL(source.startUrls[0]).searchParams.get("per_page")) || 100;

  const live = new Set();
  let announced = NaN;
  let size = perPage;
  for (let page = 1; page <= 1000; page += 1) {
    const res = await fetch(`${base}?per_page=${size}&page=${page}`, { signal: AbortSignal.timeout(90_000) });
    if (!res.ok) break;
    if (page === 1) announced = Number(res.headers.get("x-wp-total"));
    const body = await res.json().catch(() => null);
    if (!Array.isArray(body) || body.length === 0) break;
    if (page === 1 && body.length < size) size = body.length;
    let added = 0;
    for (const post of body) {
      // The WPRM family keys on the recipe's own id. The WordPress-posts family
      // has no such id on the stored record - its recipes come from the JSON-LD
      // of a post page - so those key on the page URL instead. Reading the id
      // for both reported every record of cookieandkate and cookiesandcups as
      // unidentified, which said nothing about the sources and everything about
      // the check.
      const key = byUrl
        ? canonical(post && post.link)
        : String((post && post.recipe && post.recipe.id) ?? (post && post.id) ?? "");
      if (key === "" || live.has(key)) continue;
      live.add(key);
      added += 1;
    }
    if (added === 0) break;
    if (Number.isFinite(announced) && live.size >= announced) break;
  }
  if (live.size === 0) {
    console.log(`${sourceId} | INCONCLUSIVE: the listing served nothing to check against`);
    process.exit(1);
  }

  const client = new MongoClient(mongoUri());
  await client.connect();
  const stored = await client.db(database).collection("recipes_v2")
    .find({ sourceId }, { projection: { "rawRecipe.id": 1, canonicalUrl: 1, extractedAt: 1, updatedAt: 1 } })
    .toArray();
  await client.close();

  const withdrawn = [];
  const listed = [];
  const unidentified = [];
  for (const doc of stored) {
    const key = byUrl
      ? canonical(doc.canonicalUrl)
      : (doc.rawRecipe && doc.rawRecipe.id !== undefined && doc.rawRecipe.id !== null
          ? String(doc.rawRecipe.id) : "");
    if (key === "") { unidentified.push(doc); continue; }
    (live.has(key) ? listed : withdrawn).push(doc);
  }

  const oldest = withdrawn
    .map((d) => String(d.extractedAt || d.updatedAt || "").slice(0, 10))
    .filter(Boolean).sort();
  const verdict = unidentified.length === 0 ? "SURPLUS ACCOUNTED" : "SURPLUS UNACCOUNTED";
  console.log(
    `${sourceId} | ${verdict} | stored=${stored.length} live_listing=${live.size} ` +
    `still_listed=${listed.length} withdrawn_since_crawl=${withdrawn.length}` +
    (oldest.length ? ` (crawled ${oldest[0]}..${oldest[oldest.length - 1]})` : "") +
    (unidentified.length ? ` | ${unidentified.length} stored without an upstream id` : "")
  );
  process.exit(unidentified.length === 0 ? 0 : 1);
})().catch((error) => { console.log(`${sourceId} | ERROR: ${error.message}`); process.exit(1); });
