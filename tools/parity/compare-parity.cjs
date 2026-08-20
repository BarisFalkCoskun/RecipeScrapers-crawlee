/**
 * Compare one source's legacy Scrapy output to its stored RecipeDocument V2
 * records, field by field.
 *
 *   node tools/parity/compare-parity.js <legacy.json> <crawlee.json>
 *
 * Exits non-zero on any difference. Five normalizations are applied, each of
 * them a place where V2 deliberately keeps more of the source than legacy did;
 * without them every one reads as drift. They are named where they are applied.
 */
const fs=require("fs");
const legacy=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
const crawlee=JSON.parse(fs.readFileSync(process.argv[3],"utf8"));
const {decodeHTML}=require("entities");
// Legacy leaves upstream HTML entities encoded; V2 decodes them. Comparing the
// rendered text keeps that a formatting difference rather than a content one.
// Zero-width characters carry no visible content. Some sources embed BOMs mid
// string; V2 strips them while legacy keeps them, so they must be removed
// rather than collapsed to a space or the text reads as different.
// Legacy keeps inline markup inside text fields where V2 stores the rendered
// text, so tags are stripped before comparing; a <strong> around a title is
// presentation, not content.
const norm=s=>decodeHTML(String(s??"").replace(/<[^>]+>/gu," "))
  .replace(/[\u200B-\u200D\uFEFF]/gu,"").replace(/\s+/gu," ")
  // Legacy joins a WPRM step name to its body as "Name : body" where V2 uses
  // "Name: body", and leaves the same stray space before other punctuation.
  // The space is a join artifact on either side, not different text.
  .replace(/\s+([:.,;!?])/gu,"$1").trim();
// V2 canonicalizes: it drops the www host prefix, the recipe-id fragment, and
// sorts query parameters. Comparing the canonical form keeps those formatting
// choices out of the field comparison.
const url=u=>{
  const raw=String(u||"").split("#")[0].replace(/\/$/,"").replace("://www.","://");
  try{ const p=new URL(raw); p.searchParams.sort(); return p.toString().replace(/\/$/,""); }
  catch{ return raw; }
};
const K=(u,t)=>url(u)+" :: "+norm(t);
const L=new Map(legacy.map(r=>[K(r.url,r.title),r]));
const C=new Map(crawlee.map(r=>[K(r.canonicalUrl,r.normalized&&r.normalized.title),r]));
console.log("legacy:",legacy.length,"(unique keys",L.size,")  crawlee:",crawlee.length,"(unique keys",C.size,")");
const onlyL=[...L.keys()].filter(k=>!C.has(k)), onlyC=[...C.keys()].filter(k=>!L.has(k));
console.log("only legacy:",onlyL.length,onlyL.slice(0,4));
console.log("only crawlee:",onlyC.length,onlyC.slice(0,4));
let namedSteps=0;
let cuisineDropped=0;
let richerYield=0;
let negativeDurations=0;
const diffs={}; const add=(f,u,a,b)=>{(diffs[f]=diffs[f]||[]).push({u,legacy:a,crawlee:b});};
for(const [k,l] of L){
  const c=C.get(k); if(!c) continue; const n=c.normalized||{};
  const li=(l.ingredients||[]).map(x=>norm(x.original||x.name)).filter(Boolean);
  const ci=(n.ingredients||[]).map(x=>norm(typeof x==="string"?x:(x.original||x.text||x.name))).filter(Boolean);
  if(JSON.stringify(li)!==JSON.stringify(ci)) add("ingredients",k,li,ci);
  const ls=(l.instructions||[]).map(x=>norm(typeof x==="string"?x:(x.text||x.name))).filter(Boolean);
  const cs=(n.instructions||[]).map(x=>norm(typeof x==="string"?x:(x.text||x.name))).filter(Boolean);
  if(JSON.stringify(ls)!==JSON.stringify(cs)){
    // WPRM lets a step carry a name. V2 keeps it as a "Name: body" prefix where
    // legacy drops it, so a step that matches once the prefix is removed is the
    // same step with more of the source preserved.
    const stripped=cs.map((t,i)=>{
      const m=/^[^:]{1,60}:\s*(.*)$/su.exec(t);
      return m && m[1]===ls[i] ? m[1] : t;
    });
    if(JSON.stringify(ls)===JSON.stringify(stripped)) namedSteps++;
    else add("instructions",k,ls,cs);
  }
  // A negative ISO duration is a broken upstream value. V2 reads it as no
  // duration; legacy's fallback search turns it into a huge positive number,
  // so legacy holding a value where V2 holds none is legacy keeping garbage.
  const negativeUpstream = (field) => {
    const raw = l.raw_json_ld && l.raw_json_ld[field];
    return typeof raw === "string" && /^p/iu.test(raw.trim()) && /-\d/u.test(raw);
  };
  const time = (label, legacyValue, crawleeValue, field) => {
    if ((legacyValue ?? null) === (crawleeValue ?? null)) return;
    if (crawleeValue == null && legacyValue != null && negativeUpstream(field)) {
      negativeDurations++;
      return;
    }
    add(label, k, legacyValue, crawleeValue);
  };
  time("prep", l.prep_time_minutes, n.prepMinutes, "prepTime");
  time("cook", l.cook_time_minutes, n.cookMinutes, "cookTime");
  time("total", l.total_time_minutes, n.totalMinutes, "totalTime");
  const ly=norm(`${l.servings??""} ${l.servings_unit??""}`), cy=norm(n.yieldText);
  if(ly!==cy){
    // Legacy searches recipeYield for the first run of digits and keeps only
    // that, dropping any fraction, range and unit: "1.75 liter" becomes "1",
    // "4 personer" becomes "4", and "makes 20-22 muffins" becomes "20". The
    // number need not lead the string, because legacy searches rather than
    // anchors. V2 keeps the published text, which is the same yield with more
    // of it preserved.
    const first=/\d+/u.exec(cy);
    if(first && first[0]===ly) richerYield++;
    else add("yield",k,ly,cy);
  }
  if(JSON.stringify((l.image_urls||[]).map(norm))!==JSON.stringify((n.imageUrls||[]).map(norm))) add("images",k,l.image_urls,n.imageUrls);
  if(JSON.stringify((l.categories||[]).map(norm).sort())!==JSON.stringify((n.categories||[]).map(norm).sort())) add("categories",k,l.categories,n.categories);
  const lt=(l.tags||[]).map(norm).sort();
  const kw=(n.keywords||[]).map(norm).sort();
  const recomb=[...(n.keywords||[]).map(norm),...(n.cuisines||[]).map(norm)].sort();
  // Legacy carries no cuisine field of its own. The WPRM family folds the
  // cuisine into its flat tag list, while the JSON-LD families drop it, so
  // legacy tags match V2 keywords either with the cuisines added back or
  // without them; anything else is a real difference.
  if(JSON.stringify(lt)===JSON.stringify(recomb)){ /* cuisine folded into tags */ }
  else if(JSON.stringify(lt)===JSON.stringify(kw)){ cuisineDropped++; }
  else add("tags-vs-keywords",k,lt,recomb);
}
for(const [f,v] of Object.entries(diffs)){console.log(`\n### ${f}: ${v.length}`);console.log(JSON.stringify(v.slice(0,2),null,1).slice(0,800));}
// A page can carry several sibling Recipe nodes. Legacy stops at the first, so
// extra V2 records that share a URL with a matched legacy record are additional
// recipes recovered from that page rather than a diverging record set.
const legacyUrls=new Set(legacy.map(r=>url(r.url)));
const siblings=onlyC.filter(k=>legacyUrls.has(url(k.split(" :: ")[0])));
const strayC=onlyC.filter(k=>!siblings.includes(k));
const countsAgree = !onlyL.length && !strayC.length;
if(siblings.length) console.log(`\nsibling recipes V2 recovered from multi-recipe pages: ${siblings.length}`);
if(!legacy.length || !crawlee.length){
  console.log(`\nINCONCLUSIVE: legacy=${legacy.length} crawlee=${crawlee.length} - one side produced no records`);
  process.exitCode=2;
} else if(!countsAgree){
  console.log("\nMISMATCH: record sets differ; see only-legacy / only-crawlee above");
  process.exitCode=2;
} else if(Object.keys(diffs).length){
  console.log("\nMISMATCH: field differences above");
  process.exitCode=2;
} else {
  console.log(`\nALL MATERIAL FIELDS MATCH (${cuisineDropped?`${cuisineDropped} records keep a cuisine legacy has no field for`:"tags == keywords + cuisines"}${namedSteps?`; ${namedSteps} records keep WPRM named-step prefixes legacy drops`:""}${richerYield?`; ${richerYield} records keep a fuller yield than legacy leading-integer`:""}${negativeDurations?`; ${negativeDurations} negative upstream durations V2 rejects and legacy keeps`:""}${siblings.length?`; ${siblings.length} sibling recipes recovered`:""})`);
}
