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
/**
 * Legacy items arrive as JSON Lines so a killed run stays readable up to its
 * last complete line; a trailing partial line is dropped rather than failing
 * the whole comparison. A plain JSON array is still accepted.
 */
function readRecords(path){
  const text=fs.readFileSync(path,"utf8").trim();
  if(!text) return [];
  if(text.startsWith("[")){
    try{ return JSON.parse(text); }
    catch{ /* a truncated array: salvage its complete lines below */ }
  }
  const out=[]; let dropped=0;
  for(const raw of text.replace(/^\[/u,"").split("\n")){
    const line=raw.trim().replace(/,$/u,"");
    if(!line || line==="]") continue;
    try{ out.push(JSON.parse(line)); }catch{ dropped++; }
  }
  if(dropped) console.log(`note: dropped ${dropped} incomplete line(s) from ${path} - the run was cut short`);
  return out;
}
const legacy=readRecords(process.argv[2]);
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
// Markup may be literal or entity-escaped, and a source can double-escape it:
// puredansk states a section heading as "&lt;strong&gt;Dej&lt;/strong&gt;",
// which legacy keeps as written and V2 renders down to "Dej". Decoding and
// stripping twice reaches the same rendered text from either spelling.
// A tag needs its closing bracket to be recognised as one. elanaspantry ends an
// instruction with an affiliate tracking pixel whose markup is cut off mid-tag -
// `...glass jars<img src="..." style="border:none!important; margin:0px!important;`
// with no `>` at all - so the tag pattern below cannot see it and the raw markup
// survives into the comparison. V2 parses the document and drops the element, so
// an unterminated tag running to the end of the field is stripped here too.
const stripMarkup=t=>decodeHTML(t).replace(/<[^>]+>/gu," ").replace(/<[a-zA-Z][^>]*$/u," ");
const norm=s=>stripMarkup(stripMarkup(String(s??"")))
  .replace(/[\u200B-\u200D\uFEFF]/gu,"").replace(/\s+/gu," ")
  // Legacy joins a WPRM step name to its body as "Name : body" where V2 uses
  // "Name: body", and leaves the same stray space before other punctuation.
  // The space is a join artifact on either side, not different text.
  .replace(/\s+([:.,;!?)\]])/gu,"$1")
  // Stripping an inline tag can leave a space before a closing bracket the
  // same way it does before other punctuation.
  .replace(/([(\[])\s+/gu,"$1")
  // Legacy appends a WPRM ingredient's notes in brackets unconditionally, so an
  // ingredient carrying no note ends up as "1 cup heavy whipping cream ()".
  // V2 omits the brackets when there is nothing to put in them. The empty pair
  // holds no content either way, so it is dropped rather than read as a
  // difference in the ingredient itself.
  .replace(/\s*\(\)/gu,"").trim();
// V2 canonicalizes: it drops the www host prefix, the recipe-id fragment, and
// sorts query parameters. Comparing the canonical form keeps those formatting
// choices out of the field comparison.
const url=u=>{
  const raw=String(u||"").split("#")[0].replace(/\/$/,"").replace("://www.","://");
  try{
    const p=new URL(raw);
    p.searchParams.sort();
    // A trailing slash on the path is the same page with or without it, and it
    // is invisible to the earlier strip when a query string follows:
    // cookcookgo serves /dk/?p=932 and /dk?p=932 as one recipe.
    if(p.pathname.length>1) p.pathname=p.pathname.replace(/\/+$/u,"");
    return p.toString().replace(/\/$/,"");
  }
  catch{ return raw; }
};
const K=(u,t)=>url(u)+" :: "+norm(t);
// A path that differs only in case is the same page where the site redirects
// either spelling, as gastrologik does for /Asiatiske%20laksefrikadeller. The
// keys are lowered only when doing so collapses nothing on either side, so a
// site that really does serve case-distinct URLs still reports them apart.
const lowerK=(u,t)=>K(u,t).toLowerCase();
const keysOf=(rows,fn)=>rows.map(r=>fn(r));
const legacyKey=r=>K(r.url,r.title);
const crawleeKey=r=>K(r.canonicalUrl,r.normalized&&r.normalized.title);
const lowerLegacyKey=r=>lowerK(r.url,r.title);
const lowerCrawleeKey=r=>lowerK(r.canonicalUrl,r.normalized&&r.normalized.title);
const noCollapse=(rows,fn,lowFn)=>
  new Set(keysOf(rows,fn)).size===new Set(keysOf(rows,lowFn)).size;
const caseInsensitive =
  noCollapse(legacy,legacyKey,lowerLegacyKey) && noCollapse(crawlee,crawleeKey,lowerCrawleeKey);
const lk=caseInsensitive?lowerLegacyKey:legacyKey;
const ck=caseInsensitive?lowerCrawleeKey:crawleeKey;
const L=new Map(legacy.map(r=>[lk(r),r]));
const C=new Map(crawlee.map(r=>[ck(r),r]));
console.log("legacy:",legacy.length,"(unique keys",L.size,")  crawlee:",crawlee.length,"(unique keys",C.size,")");
const onlyL=[...L.keys()].filter(k=>!C.has(k)), onlyC=[...C.keys()].filter(k=>!L.has(k));
console.log("only legacy:",onlyL.length,onlyL.slice(0,4));
console.log("only crawlee:",onlyC.length,onlyC.slice(0,4));
let namedSteps=0;
let cuisineDropped=0;
let richerYield=0;
let negativeDurations=0;
let looseDurations=0;
let relativeImages=0;
let fusedByLegacy=0;
let spacedByLegacy=0;
// Legacy and V2 disagree about whitespace at a markup boundary, in both
// directions, and neither disagreement is about content.
//
// Legacy renders a text field by taking its markup's text content, which
// concatenates block elements: avocadoen writes a step as
// "<p>...250 grader varmluft</p><p>Airfryer: ...</p>" and legacy emits
// "varmluftAirfryer" where V2 puts a space.
//
// The other way round, legacy replaces any stripped tag with a space, including
// an inline one the page shows no gap at: andiemitchell writes
// "Thai Kitchen<sup>®</sup>" and legacy emits "Thai Kitchen ®", and
// anoregoncottage links an ingredient straight after a colon and legacy emits
// "seasoning of choice: Homemade Spice Rub" where the page reads
// "choice:Homemade". V2 renders what the page renders.
//
// So a whitespace-only difference is allowed in either direction. The direction
// is still counted and reported, because one of them - V2 short of a space - is
// also what a source crawled before the block-boundary fix looks like. What
// keeps a stale crawl from passing here is not this function but fix-impact.cjs,
// which re-extracts every stored record with the current code before any
// promotion; the count below is the human-visible signal that it should be run.
//
// The cost is that a whitespace-only difference cannot be seen through at all,
// and one such defect has happened - a zero-width character collapsing "A﻿dd"
// into "A dd". Defects of that shape belong to the extraction tests now.
const bareText=t=>String(t).replace(/\s+/gu,"");
const gapCount=t=>(String(t).match(/\s/gu)||[]).length;
const spacesOnly=(a,b)=>
  a.length===b.length && a.every((t,i)=>t===b[i] || bareText(t)===bareText(b[i]));
const legacyIsSpacier=(a,b)=>
  a.reduce((n,t,i)=>n+gapCount(t)-gapCount(b[i]),0)>0;
const diffs={}; const add=(f,u,a,b)=>{(diffs[f]=diffs[f]||[]).push({u,legacy:a,crawlee:b});};
for(const [k,l] of L){
  const c=C.get(k); if(!c) continue; const n=c.normalized||{};
  const li=(l.ingredients||[]).map(x=>norm(x.original||x.name)).filter(Boolean);
  const ci=(n.ingredients||[]).map(x=>norm(typeof x==="string"?x:(x.original||x.text||x.name))).filter(Boolean);
  if(JSON.stringify(li)!==JSON.stringify(ci)){
    if(spacesOnly(li,ci)){ legacyIsSpacier(li,ci)?spacedByLegacy++:fusedByLegacy++; }
    else add("ingredients",k,li,ci);
  }
  const ls=(l.instructions||[]).map(x=>norm(typeof x==="string"?x:(x.text||x.name))).filter(Boolean);
  const cs=(n.instructions||[]).map(x=>norm(typeof x==="string"?x:(x.text||x.name))).filter(Boolean);
  if(JSON.stringify(ls)!==JSON.stringify(cs)){
    // WPRM lets a step carry a name. V2 keeps it as a "Name: body" prefix where
    // legacy drops it, so a step that matches once the prefix is removed is the
    // same step with more of the source preserved.
    const stripped=cs.map((t,i)=>{
      // The bound is generous because equality after stripping is what makes
      // this safe, not the length: culinaryginger names one step "If using
      // wooden skewers, soak them in water for 30 minutes to prevent burning",
      // which is 68 characters.
      const m=/^[^:]{1,160}:\s*(.*)$/su.exec(t);
      return m && m[1]===ls[i] ? m[1] : t;
    });
    if(JSON.stringify(ls)===JSON.stringify(stripped)) namedSteps++;
    else if(spacesOnly(ls,cs)){ legacyIsSpacier(ls,cs)?spacedByLegacy++:fusedByLegacy++; }
    else add("instructions",k,ls,cs);
  }
  // A negative ISO duration is a broken upstream value. V2 reads it as no
  // duration; legacy's fallback search turns it into a huge positive number,
  // so legacy holding a value where V2 holds none is legacy keeping garbage.
  const negativeUpstream = (field) => {
    const raw = l.raw_json_ld && l.raw_json_ld[field];
    return typeof raw === "string" && /^p/iu.test(raw.trim()) && /-\d/u.test(raw);
  };
  // A duration the source spells loosely — "PT 60M" with a space, or the Danish
  // "PT15t30M" — is one legacy's parser gives up on and reports as nothing. V2
  // reading it is more of the source preserved, not a disagreement.
  const looseUpstream = (field) => {
    const raw = l.raw_json_ld && l.raw_json_ld[field];
    return typeof raw === "string" && /^p/iu.test(raw.trim()) && !/-\d/u.test(raw);
  };
  const time = (label, legacyValue, crawleeValue, field) => {
    if ((legacyValue ?? null) === (crawleeValue ?? null)) return;
    if (crawleeValue == null && legacyValue != null && negativeUpstream(field)) {
      negativeDurations++;
      return;
    }
    if (legacyValue == null && crawleeValue != null && looseUpstream(field)) {
      looseDurations++;
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
    // Legacy keeps only the digits it finds, so a yield stated in words alone
    // — afamilyfeast says "Individual servings" — leaves it with nothing at
    // all while V2 keeps what the source wrote.
    else if(ly==="" && cy!=="" && !first) richerYield++;
    else add("yield",k,ly,cy);
  }
  const limg=(l.image_urls||[]).map(norm), cimg=(n.imageUrls||[]).map(norm);
  if(JSON.stringify(limg)!==JSON.stringify(cimg)){
    // Legacy ends up with no images on whole sources where V2 has them, for
    // more than one reason: it keeps only absolute URLs, so a source stating
    // rooted paths (bornemenuen serves /sites/default/files/...) leaves it with
    // none, and familiejournal states its images in a shape legacy reads as
    // empty on all 995 of its recipes while V2 keeps three imgix crops of each.
    // Either way legacy has nothing and V2 has something usable, which is V2
    // keeping what legacy discards rather than the two disagreeing.
    //
    // The test is on legacy being empty, so the reverse - V2 losing images a
    // legacy run found - is still a difference and still reported.
    const usable=u=>/^(?:https?:)?\/\//u.test(u) || (u.startsWith("/") && !u.startsWith("//")) || u.startsWith("data:image/");
    if(limg.length===0 && cimg.length>0 && cimg.every(usable)) relativeImages++;
    else add("images",k,l.image_urls,n.imageUrls);
  }
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
const legacyUrls=new Set(legacy.map(r=>caseInsensitive?url(r.url).toLowerCase():url(r.url)));
const siblings=onlyC.filter(k=>legacyUrls.has(k.split(" :: ")[0]));
const strayC=onlyC.filter(k=>!siblings.includes(k));
// V2 holds a completeness contract that most legacy spiders do not: a recipe
// needs a name, ingredients and instructions to be stored at all. Legacy
// emits a Recipe node that is missing any of them — mariavestergaard has five
// with no instructions and eight with no title — so those records are named
// rather than counted as a loss.
//
// A record with no URL is rejected for the same reason and belongs in the same
// count. healthyseasonalrecipes publishes "maple spiced rum punch" with no link
// at all, and without one there is no canonical URL to key the record on;
// guessing one would attach the recipe to a page that may not exist. The
// rejection explainer already names this cause as "no canonical link", so the
// comparator has to recognise it too or the source reads as a record short.
const legacyByKey=new Map(legacy.map(r=>[lk(r),r]));
const incompleteOnlyLegacy=onlyL.filter(k=>{
  const r=legacyByKey.get(k);
  if(!r) return false;
  const steps=(r.instructions||[]).filter(x=>String((x&&x.text)||x||"").trim());
  const items=(r.ingredients||[]).filter(x=>String((x&&(x.original||x.name))||x||"").trim());
  return steps.length===0 || items.length===0 || norm(r.title)==="" ||
    String(r.url||"").trim()==="";
});
const strayL=onlyL.filter(k=>!incompleteOnlyLegacy.includes(k));
if(incompleteOnlyLegacy.length)
  console.log(`\nrecords legacy accepts without a name, ingredients, instructions or a link, which the completeness contract rejects: ${incompleteOnlyLegacy.length}`);
const countsAgree = !strayL.length && !strayC.length;
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
  console.log(`\nALL MATERIAL FIELDS MATCH (${cuisineDropped?`${cuisineDropped} records keep a cuisine legacy has no field for`:"tags == keywords + cuisines"}${namedSteps?`; ${namedSteps} records keep WPRM named-step prefixes legacy drops`:""}${richerYield?`; ${richerYield} records keep a fuller yield than legacy leading-integer`:""}${negativeDurations?`; ${negativeDurations} negative upstream durations V2 rejects and legacy keeps`:""}${looseDurations?`; ${looseDurations} loosely spelled durations V2 reads and legacy gives up on`:""}${relativeImages?`; ${relativeImages} records keep images legacy discards`:""}${fusedByLegacy?`; ${fusedByLegacy} records keep a space at a block boundary legacy fuses over`:""}${spacedByLegacy?`; ${spacedByLegacy} records drop a space legacy inserts where it strips inline markup`:""}${siblings.length?`; ${siblings.length} sibling recipes recovered`:""}${incompleteOnlyLegacy.length?`; ${incompleteOnlyLegacy.length} records legacy accepts without a name, ingredients or instructions`:""})`);
}
