#!/usr/bin/env node
// Accounts for every record a WPRM source declares but did not store.
//
// The promotion bar is zero *unexplained* rejections: a source may fall short of
// its own listing only where the upstream record cannot be used, and each such
// record has to be named rather than absorbed into a tolerance. This walks the
// source's API, diffs the declared records against what is stored, and puts each
// missing one through the crawler's own extractor - not a reimplementation of
// it, so the verdict here is the verdict the crawler reached.
//
// Exit status is the answer: 0 when every shortfall is explained, 1 when any
// record is missing for a reason this cannot name.
const fs = require("fs");
const { MongoClient } = require("mongodb");
const { extractWprmRecipes } = require("../../dist/wprm/recipe-document.js");
const { DANISH_JSONLD_SOURCES } = require("../../dist/danish-jsonld/source-registry.js");

const sourceId = process.argv[2];
const dbName = process.argv[3];
if (!sourceId || !dbName) {
  console.error("usage: explain-rejections.cjs <sourceId> <database>");
  process.exit(2);
}

const mongoUri = () =>
  process.env.MONGODB_URI ||
  fs.readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("MONGODB_URI"))
    .split("=").slice(1).join("=").trim().replace(/^"|"$/gu, "");

// A source can answer 406 to Node's default user agent and 200 to a browser one
// - inspiredtaste does, on every page. The crawler sends browser-like headers,
// so a tool checking its work has to as well.
const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    + "Chrome/125.0.0.0 Safari/537.36",
  accept: "application/json,text/html;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
};

async function fetchJson(url) {
  const res = await fetch(url, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(90_000) });
  const total = Number(res.headers.get("x-wp-total"));
  if (!res.ok) return { status: res.status, body: null, total };
  return { status: res.status, body: await res.json().catch(() => null), total };
}

(async () => {
  const source = DANISH_JSONLD_SOURCES.find((s) => s.id === sourceId);
  if (!source || !source.startUrls || source.startUrls.length === 0) {
    console.log(`${sourceId} | UNKNOWN: no listing URL in the registry`);
    process.exit(1);
  }
  const base = source.startUrls[0].split("?")[0];
  // The page size is a source setting, not a constant: at least one source
  // answers 500 to per_page=100, so the crawler's own override has to be used
  // or this walks a different catalog than the crawl did.
  const perPage = Number(new URL(source.startUrls[0]).searchParams.get("per_page")) || 100;

  // The walk has to follow the page size the server actually honours, not the
  // one asked for. Some sources cap per_page far below the request and then
  // return the same first rows for every page, so a walk that trusted the
  // requested size would either stop after one short page or spin forever on
  // repeats. Page one establishes the real size; a page that adds nothing new
  // ends the walk however many pages remain in theory.
  const declared = [];
  const seen = new Set();
  let blocked = 0;
  let announced = NaN;
  let size = perPage;
  // One expression for a declared record's identity, used by both the walk and
  // the comparison below; they read different fields once and the mismatch made
  // the whole check vacuous.
  const declaredId = (post) =>
    String((post && post.recipe && post.recipe.id) ?? (post && post.id) ?? "");

  for (let page = 1; page <= 1000; page += 1) {
    const { status, body, total } = await fetchJson(`${base}?per_page=${size}&page=${page}`);
    if (status === 403 || status === 406 || status === 429 || status === 454 || status === 455) { blocked += 1; break; }
    if (page === 1) {
      if (Number.isFinite(total)) announced = total;
      if (Array.isArray(body) && body.length > 0 && body.length < size) size = body.length;
    }
    if (!Array.isArray(body) || body.length === 0) break;
    let added = 0;
    for (const post of body) {
      const id = declaredId(post);
      if (id === "" || seen.has(id)) continue;
      seen.add(id);
      declared.push(post);
      added += 1;
    }
    if (added === 0) break;
    if (Number.isFinite(announced) && declared.length >= announced) break;
  }
  if (blocked) {
    console.log(`${sourceId} | INCONCLUSIVE: the listing answered a challenge, so the declared set is partial`);
    process.exit(1);
  }
  if (Number.isFinite(announced) && declared.length !== announced) {
    console.log(`${sourceId} | INCONCLUSIVE: walked ${declared.length} records but the listing announces ${announced}`);
    process.exit(1);
  }

  const client = new MongoClient(mongoUri());
  await client.connect();
  const stored = await client.db(dbName).collection("recipes_v2")
    .find({ sourceId }, { projection: { "rawRecipe.id": 1 } }).toArray();
  await client.close();
  // The walk keys a declared post on recipe.id falling back to post.id, but this
  // comparison used to read recipe.id alone. On a listing whose posts carry no
  // recipe.id every declared post yielded undefined, every stored doc yielded
  // undefined, and String(undefined) matched itself - so thecastawaykitchen came
  // back "declared=452 stored=1 missing=0", a pass that had examined nothing.
  // Use one id expression for both sides, and refuse to answer when either side
  // has no usable ids rather than reporting a vacuous zero.
  const storedIds = new Set(
    stored.map((d) => String((d.rawRecipe && d.rawRecipe.id) ?? "")).filter((id) => id !== ""),
  );
  if (storedIds.size === 0 && stored.length > 0) {
    console.log(
      `${sourceId} | INCONCLUSIVE: ${stored.length} stored records carry no rawRecipe.id, ` +
        `so declared ids cannot be matched against them`,
    );
    process.exit(1);
  }

  const missing = declared.filter((post) => !storedIds.has(declaredId(post)));

  const reasons = {
    "no title": [], "no ingredients": [], "no instructions": [],
    "no canonical link": [], unexplained: [],
  };
  for (const post of missing) {
    // One post at a time, so the extractor's verdict is about exactly this
    // record rather than the page it arrived on.
    const out = extractWprmRecipes([post]);
    if (out.recipes.length > 0) {
      // The extractor would have kept it, so its absence from the store is not
      // something the completeness contract explains.
      reasons.unexplained.push(post);
      continue;
    }
    const recipe = (post && post.recipe) || {};
    if (out.malformedCount > 0) {
      // The only malformed cases are a missing recipe object and a missing
      // link; the first cannot be described any further than that.
      const hasRecipe = post && typeof post.recipe === "object" && post.recipe !== null;
      if (hasRecipe) reasons["no canonical link"].push(post);
      else reasons.unexplained.push(post);
      continue;
    }
    const name = String(recipe.name || "").trim();
    const ingredients = Array.isArray(recipe.ingredients_flat) ? recipe.ingredients_flat.length : 0;
    const instructions = Array.isArray(recipe.instructions_flat) ? recipe.instructions_flat.length : 0;
    if (name === "") reasons["no title"].push(post);
    else if (ingredients === 0) reasons["no ingredients"].push(post);
    else if (instructions === 0) reasons["no instructions"].push(post);
    else reasons.unexplained.push(post);
  }

  const parts = Object.entries(reasons).filter(([, v]) => v.length > 0)
    .map(([k, v]) => `${v.length} ${k}`);
  const unexplained = reasons.unexplained.length;
  const verdict = unexplained === 0 ? "ALL SHORTFALL EXPLAINED" : "UNEXPLAINED SHORTFALL";
  console.log(
    `${sourceId} | ${verdict} | declared=${declared.length} stored=${storedIds.size} ` +
    `missing=${missing.length}${parts.length ? " (" + parts.join(", ") + ")" : ""}` +
    (unexplained ? ` | first unexplained: ${reasons.unexplained.slice(0, 3).map((p) => (p.recipe && p.recipe.id) || "?").join(",")}` : "")
  );
  process.exit(unexplained === 0 ? 0 : 1);
})().catch((error) => {
  console.log(`${sourceId} | ERROR: ${String(error.message).slice(0, 120)}`);
  process.exit(1);
});
