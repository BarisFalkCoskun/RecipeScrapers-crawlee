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
// Strip markup before decoding entities, not after. therecipecritic has an
// ingredient whose anchor href contains an entity-encoded HTML comment:
// <a href="http://&lt;!-- wp:paragraph --&gt; ...">Disco Balls</a>. Decoding
// first turns those &lt; and &gt; into real brackets inside the attribute, so
// the tag strip ends at the wrong place and the href leaks into the text as
// "Disco Balls: https://www.amazon.com/...". V2 already reads it as "Disco
// Balls"; it was the comparison that could not normalise legacy to match.
const dropTags=t=>String(t).replace(/<[^>]+>/gu," ").replace(/<[a-zA-Z][^>]*$/u," ");
// Tags have to come off on both sides of the entity decode. Decoding first turns
// the &lt; and &gt; inside therecipecritic's anchor href - which encodes an HTML
// comment - into real brackets, so the tag strip ends in the wrong place and the
// href leaks into the text as "Disco Balls: https://...". Decoding last leaves
// entity-encoded markup standing, which is how dansktang writes its notes. Strip,
// decode, strip.
const stripMarkup=t=>dropTags(decodeHTML(dropTags(t)));
// WPRM keeps inline shortcodes unrendered in API text, and legacy stores them that
// way: "Thinly slice [wprm-ingredient text="1/4 sweet onion" uid="12"]". V2 renders
// them as the page does since 2026-09-14, so without this every such record would
// read as a V2 difference when it is V2 holding the text the reader sees. The
// rules mirror renderWprmShortcodes in src/wprm/recipe-document.ts, with one gap:
// V2 renders [wprm-ingredient uid=N] as the recipe's current ingredient N, which
// is what the page shows, and a legacy record carries no uids to do the same. On
// the 54 sources where the text attribute has gone stale ("150 gram hvedemel"
// against the page's "150 g hvedemel") those mentions still read as differences.
const wprmAttr=(attrs,name)=>{const m=new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|&quot;(.*?)&quot;|([^\\s\\]"'&]+))`,"u").exec(attrs);return (m?.[1]??m?.[2]??m?.[3]??m?.[4]??"").trim();};
const renderWprm=v=>!/\[\/?(?:wprm-|adjustable\b|timer\b)/u.test(v)?v:v
  .replace(/\[wprm-ingredient\b([^\]]*)\]/gu,(_,a)=>wprmAttr(a,"text"))
  .replace(/\[wprm-temperature\b([^\]]*)\]/gu,(_,a)=>{const x=wprmAttr(a,"value"),u=wprmAttr(a,"unit");return x===""?"":`${x}${u===""?"":` \u00b0${u}`}`;})
  .replace(/\[\/?(?:adjustable|timer)\b[^\]]*\]/gu,"")
  .replace(/\[\/?wprm-[a-z-]+\b[^\]]*\]/gu,"");
// Legacy wraps every ingredient note in parentheses, including notes the author
// already parenthesised, and stores "azuki beans ((dried))"; V2 stops doubling
// them. A doubled pair closing the line is the same text on either side.
// Legacy can also space the pair out, "( (or cooking spray) )", once markup inside
// the note is stripped (fortheloveofcooking /perfect-egg).
const undoubleNotes=s=>s.replace(/\(\s*\((.*)\)\s*\)$/u,"($1)");
const norm=s=>undoubleNotes(stripMarkup(stripMarkup(renderWprm(String(s??"")))))
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
  .replace(/\s*\(\)/gu,"")
  // Stripping an unterminated tag can take a closing bracket with it and leave
  // the opening one behind. carlsbadcravings gives an ingredient the note
  // "&lt;click for recipe", which decodes to text that looks like a tag with no
  // end, so "Avocado Corn Salsa (<click for recipe)" renders down to
  // "Avocado Corn Salsa (". Legacy drops the note outright. A bracket opened at
  // the end of the text and never closed holds nothing either way.
  .replace(/\s*\(\s*$/u,"")
  // A record's key already treats http://www.host and http://host as one host,
  // and a URL inside a field is the same host either way. webopskrifter serves
  // its images from www while its canonical drops it, so every one of its 3699
  // image fields read as a difference that was only the prefix.
  .replace(/:\/\/www\./gu,"://")
  // The same amount rendered at two precisions is one amount. spisbedre's
  // legacy records read "2.08333 g gaer" where V2 reads "2.0833333333333 g
  // gaer" -- a third of a teaspoon divided three ways, rounded by legacy to six
  // significant digits and carried by V2 at full float precision. 373 of its
  // records differed on ingredients and not one quantity was different.
  // Legacy's own rounding is not one convention -- the same record carries
  // "133.333" at three decimals and "0.3333" at four -- so rather than
  // reproduce it, both sides are rounded to three decimals wherever they carry
  // four or more. 1.25, 0.5 and 2.05 are left exactly as they are, so only
  // repeating decimals move and a genuinely different amount still differs.
  .replace(/(\d+)\.(\d{4,})/gu, (m) => String(Math.round(Number(m) * 1e3) / 1e3))
  // An amount written as a whole number with a redundant decimal is the same
  // amount. meny's legacy records read "1.0 liter vand" and "100.0 g hindbaer"
  // where V2 reads "1 liter vand" and "100 g hindbaer", which made all 100
  // records the two sides share differ on ingredients while not one quantity
  // was actually different. pillsbury and tastesbetterfromscratch carry the
  // same shape. Only a trailing .0 collapses: 1.5 stays 1.5, and 2.05 is
  // untouched because the 0 is followed by another digit.
  .replace(/(\d)\.0(?!\d)/gu,"$1")
  .trim();
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
    // http and https address the same page, and a site can hand out both for
    // one recipe: artfuldishes declares an https @id and an http site URL, so
    // legacy keyed 22 records on https that V2 keyed on http. Every record on
    // both sides paired once the scheme was ignored. This is the same kind of
    // host-identity normalization as dropping www just above.
    if(p.protocol==="http:") p.protocol="https:";
    return p.toString().replace(/\/$/,"");
  }
  catch{ return raw; }
};
// A path that differs only in case is the same page where the site redirects
// either spelling, as gastrologik does for /Asiatiske%20laksefrikadeller. A
// path that differs only in a .html suffix is the same page too: heidiogper
// serves /recipes/tiramisu.html and /recipes/tiramisu with one body, declares
// the .html form as its canonical and redirects to the other, so legacy keyed
// all 25 of its records one way and V2 all 34 the other and nothing paired.
// Both relaxations are applied only when they collapse nothing on either side,
// so a site that really does serve /x and /x.html apart still reports them so.
const K=(u,t,opts)=>{
  const o=opts||{};
  const raw=o.stripExt?url(u).replace(/\.html?$/iu,""):url(u);
  const key=raw+" :: "+norm(t);
  return o.lower?key.toLowerCase():key;
};
const keysOf=(rows,fn)=>rows.map(r=>fn(r));
const legacyKeyWith=o=>r=>K(r.url,r.title,o);
const crawleeKeyWith=o=>r=>K(r.canonicalUrl,r.normalized&&r.normalized.title,o);
const legacyKey=legacyKeyWith();
const crawleeKey=crawleeKeyWith();
const noCollapse=(rows,fn,lowFn)=>
  new Set(keysOf(rows,fn)).size===new Set(keysOf(rows,lowFn)).size;
const safeOn=o =>
  noCollapse(legacy,legacyKey,legacyKeyWith(o)) &&
  noCollapse(crawlee,crawleeKey,crawleeKeyWith(o));
// Each relaxation is checked on its own and then again together: two that are
// each harmless can still collapse a pair between them, and the combination is
// what actually keys the comparison.
const candidate={lower:safeOn({lower:true}),stripExt:safeOn({stripExt:true})};
const keyOpts=safeOn(candidate)?candidate:{lower:candidate.lower};
const lk=legacyKeyWith(keyOpts);
const ckCanonical=crawleeKeyWith(keyOpts);
// A record can be addressed two ways: by the URL it was fetched from, and by
// the canonical the page declares. Usually they agree. pillsbury addresses a
// recipe as /recipes/<slug>/<uuid> and for 21 of its recipes the uuid in its
// sitemap is not the uuid in that page's own <link rel=canonical> - the site
// contradicts itself. Legacy stores the URL it fetched, V2 stores the declared
// canonical, so those 21 were reported as 21 legacy-only plus 21 crawlee-only
// records, and the gap read as a discovery difference when the two sides were
// holding the same recipes. Matching on either address is right, and it can
// only pair records a URL identity already implies. As with the other
// relaxations it is applied only when it collapses nothing.
const ckPage=r=>K(r.pageUrl,r.normalized&&r.normalized.title,keyOpts);
const legacyKeySet=new Set(keysOf(legacy,lk));
const ckEither=r=>{
  const canonical=ckCanonical(r);
  if(!r.pageUrl||legacyKeySet.has(canonical)) return canonical;
  const page=ckPage(r);
  return legacyKeySet.has(page)?page:canonical;
};
const ck=noCollapse(crawlee,ckCanonical,ckEither)?ckEither:ckCanonical;
// A source can publish more than one recipe at a single URL under a single
// title. happyfoodstube has two "Homemade Sushi" records on
// /homemade-sushi/ - upstream ids 6839 and 11293, eleven ingredients and
// twelve - and both sides store both. Keying by URL and title alone puts them
// on the same key, and building a Map from that keeps whichever arrived last on
// each side, so the comparison can end up holding 6839 against 11293 and
// reporting a field difference between two recipes that were never the same
// one. Pairing the records under a shared key by content is what stops that.
const groupBy=(rows,fn)=>{
  const out=new Map();
  for(const r of rows){ const k=fn(r); (out.get(k)||out.set(k,[]).get(k)).push(r); }
  return out;
};
const Lg=groupBy(legacy,lk), Cg=groupBy(crawlee,ck);
// Pairing on ingredients alone is not enough: jessicalevinson has three
// "grilled avocados stuffed with corn & black bean salsa" records on one URL and
// all three carry the same eleven ingredients, differing only in their image and
// their tags. So the records are scored across several fields and each legacy
// record takes the best remaining match, which is what a reader comparing them
// by hand would do.
const fieldsL=r=>({
  ing:JSON.stringify((r.ingredients||[]).map(x=>norm(x.original||x.name))),
  ins:JSON.stringify((r.instructions||[]).map(x=>norm(typeof x==="string"?x:(x.text||x.name)))),
  img:JSON.stringify((r.image_urls||[]).map(norm)),
  tag:JSON.stringify((r.tags||[]).map(norm).sort()),
  yld:norm(r.servings),
});
const fieldsC=r=>{ const n=r.normalized||{}; return {
  ing:JSON.stringify((n.ingredients||[]).map(x=>norm(typeof x==="string"?x:(x.original||x.text||x.name)))),
  ins:JSON.stringify((n.instructions||[]).map(x=>norm(typeof x==="string"?x:(x.text||x.name)))),
  img:JSON.stringify((n.imageUrls||[]).map(norm)),
  tag:JSON.stringify([...(n.keywords||[]),...(n.cuisines||[])].map(norm).sort()),
  yld:norm(n.yieldText),
}; };
const score=(a,b)=>Object.keys(a).reduce((n,k)=>n+(a[k]===b[k]?1:0),0);
const pair=(ls,cs)=>{
  if(ls.length<=1&&cs.length<=1) return [[ls[0],cs[0]]];
  const remaining=cs.map(fieldsC).map((f,i)=>({f,r:cs[i]}));
  // Taking the legacy records in the order they arrived lets the first one claim
  // the only match even when a later one fits it better. ketoconnect publishes
  // two "Low Carb Pizza" records on one URL, one with no instructions at all;
  // V2 stores only the usable one, and arrival order handed that match to the
  // empty record and left the real one unpaired. Strongest match goes first.
  const order=ls.map((l,i)=>{
    const lf=fieldsL(l);
    const best=remaining.reduce((n,c)=>Math.max(n,score(lf,c.f)),-1);
    return {l,lf,best,i};
  }).sort((a,b)=>b.best-a.best||a.i-b.i);
  const paired=new Map();
  for(const {l,lf,i} of order){
    let best=0,bestScore=-1;
    remaining.forEach((cand,j)=>{ const sc=score(lf,cand.f); if(sc>bestScore){bestScore=sc;best=j;} });
    paired.set(i,[l,(remaining.splice(best,1)[0]||{}).r]);
  }
  return ls.map((_l,i)=>paired.get(i));
};
const L=new Map(), C=new Map();
for(const [k,ls] of Lg){
  const cs=Cg.get(k)||[];
  if(cs.length===0){ L.set(k,ls[0]); continue; }
  const pairs=pair(ls,cs);
  // Extra records under one key are compared under a suffixed key so each pair
  // is judged on its own rather than one of them being dropped silently.
  pairs.forEach(([l,c],i)=>{ const key=i===0?k:`${k} #${i+1}`; if(l)L.set(key,l); if(c)C.set(key,c); });
}
for(const [k,cs] of Cg){ if(!Lg.has(k)) C.set(k,cs[0]); }
console.log("legacy:",legacy.length,"(unique keys",L.size,")  crawlee:",crawlee.length,"(unique keys",C.size,")");
// caribbeanpot's legacy run emits nine records with an empty url, so their keys
// are " :: <title>" and cannot meet the crawlee record for the same recipe,
// which carries the real link. Both sides then report the recipe as unmatched.
// A blank url is legacy's own defect - the completeness contract rejects those
// records - so pair such a key on its title when exactly one crawlee key shares
// it, and leave it unmatched when the title is ambiguous.
const titleOf=k=>String(k).split(" :: ").slice(1).join(" :: ");
const urlOf=k=>String(k).split(" :: ")[0];
{
  const byTitle=new Map();
  for(const k of C.keys()){
    const t=titleOf(k);
    byTitle.set(t,(byTitle.get(t)??0)+1);
  }
  for(const k of [...L.keys()]){
    if(urlOf(k).trim()!=="" || C.has(k)) continue;
    const t=titleOf(k);
    if(t==="" || byTitle.get(t)!==1) continue;
    const match=[...C.keys()].find(c=>titleOf(c)===t && !L.has(c));
    if(!match) continue;
    L.set(match,L.get(k));
    L.delete(k);
  }
}
const onlyL=[...L.keys()].filter(k=>!C.has(k)), onlyC=[...C.keys()].filter(k=>!L.has(k));
console.log("only legacy:",onlyL.length,onlyL.slice(0,4));
console.log("only crawlee:",onlyC.length,onlyC.slice(0,4));
let namedSteps=0;
let cuisineDropped=0;
let richerYield=0;
let negativeDurations=0;
let looseDurations=0;
let relativeImages=0;
let legacyProseImages=0;
let fusedByLegacy=0;
let spacedByLegacy=0;
let legacyDroppedIngredients=0;
let legacyDroppedInstructions=0;
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
    // Legacy ends up with no ingredients at all where V2 reads a full list, and
    // on frederikkewaerens that is what a multi-recipe page looks like from the
    // legacy side: it keeps one record for a page carrying five recipes and
    // captures a fragment of one list, while V2 splits the page and gives each
    // recipe its own. Legacy holding nothing and V2 holding something is V2
    // keeping what legacy discards, the same way it is for images.
    //
    // The test is on legacy being empty, so V2 losing ingredients a legacy run
    // found is still a difference and still reported.
    else if(li.length===0 && ci.length>0) legacyDroppedIngredients++;
    else add("ingredients",k,li,ci);
  }
  const ls=(l.instructions||[]).map(x=>norm(typeof x==="string"?x:(x.text||x.name))).filter(Boolean);
  const cs=(n.instructions||[]).map(x=>norm(typeof x==="string"?x:(x.text||x.name))).filter(Boolean);
  if(JSON.stringify(ls)!==JSON.stringify(cs)){
    // WPRM lets a step carry a name. V2 keeps it as a "Name: body" prefix where
    // legacy drops it, so a step that matches once the prefix is removed is the
    // same step with more of the source preserved.
    // The two allowances have to compose. flawlessfood needs both on the same
    // record - V2 keeps a "Prep: " step name legacy drops, and puts a space at a
    // block boundary legacy fuses over - and testing each on its own left the
    // record failing both: the prefix strip demanded exact equality afterwards,
    // which the whitespace difference then broke.
    const stripped=cs.map((t,i)=>{
      // No length bound. Equality after stripping is what makes this safe, and
      // every bound tried has been wrong for some source: 160 excluded
      // bergholts, whose step name is a 281-character summary of the method,
      // and 400 excluded frommybowl, whose name is the body itself at 434. A
      // step name is whatever the author typed, so guessing a maximum only
      // defers the next case. The pattern still requires a colon and still only
      // strips when what remains equals legacy's text, which is the real guard.
      // Comparing the stripped body without its spaces keeps a name that only
      // differs there strippable.
      // Every colon is a candidate split, not just the first: a step name can
      // contain one. spiceupthecurry names a step "Tip: you may need more or
      // less water." over a body that begins "TIP: You may need more or less
      // amount of water...", and splitting at the first colon leaves "you may
      // need more or less water.: TIP: ..." - still not the body. Trying each
      // in turn finds the one that does, and equality with legacy's text is
      // what decides whether any of them counts.
      const target=bareText(ls[i]);
      for(let at=t.indexOf(":"); at!==-1; at=t.indexOf(":",at+1)){
        const rest=t.slice(at+1).replace(/^\s+/u,"");
        if(bareText(rest)===target) return rest;
      }
      return t;
    });
    if(JSON.stringify(ls)===JSON.stringify(stripped)) namedSteps++;
    else if(spacesOnly(ls,stripped)){
      // Count both, since both are why this record is allowed through.
      namedSteps++;
      legacyIsSpacier(ls,stripped)?spacedByLegacy++:fusedByLegacy++;
    }
    // gocook's legacy run reads no instructions at all on any of its 1080
    // recipes, while V2 keeps the real steps - "Vask hænder", "Find ingredienser
    // frem", and the rest of a method a child can follow. Legacy holding nothing
    // and V2 holding something is V2 keeping what legacy discards, the same way
    // it is for ingredients and images.
    //
    // The test is on legacy being empty, so V2 losing steps a legacy run found
    // is still a difference and still reported.
    else if(ls.length===0 && cs.length>0) legacyDroppedInstructions++;
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
  // The same image URL can be written with its non-ASCII characters percent
  // encoded or not: thefoodclub's legacy run holds
  // ".../IMG_6424_Smørristede-rosenkål-med-mynte-cashewnødder-2-900x1350.jpg"
  // where V2 holds the same path with %C3%B8 and %C3%A5. That is one image
  // spelled two ways, not two images, so decode before comparing. A malformed
  // escape is left as it stands rather than throwing.
  const decodeUrl=u=>{ try { return decodeURIComponent(u); } catch { return u; } };
  const limg=(l.image_urls||[]).map(u=>decodeUrl(norm(u))), cimg=(n.imageUrls||[]).map(u=>decodeUrl(norm(u)));
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
    // The mirror image of that: spam states its image as a sentence - "It is
    // time for a sizzling dessert. SPAM Monkey Bread is sweet and savory..." -
    // and legacy stores the prose as the recipe's image while V2 keeps none.
    // V2 losing a real image is a difference worth reporting, but declining to
    // treat a paragraph as one is not.
    else if(cimg.length===0 && limg.length>0 && limg.every(u=>!usable(u))) legacyProseImages++;
    else add("images",k,l.image_urls,n.imageUrls);
  }
  // A label whose markup has been stripped can differ only in the space left
  // where a tag stood. landolakes files one recipe under "Garlic and Herb Sauté
  // Express<sup>andreg;</sup> Recipes": V2 removes the <sup> outright, this
  // comparison replaces it with a space so that a <br> cannot weld two words
  // together, and the two forms then differ by one space and nothing else.
  // Labels are names rather than quantities, so collapsing their whitespace
  // entirely is safe here in a way it would not be for an ingredient - "1 cup"
  // and "1cup" must stay different, and do, because this only applies to
  // categories and tags.
  const label=t=>norm(t).replace(/\s+/gu,"");
  const sameLabels=(a,b)=>
    JSON.stringify((a||[]).map(norm).sort())===JSON.stringify((b||[]).map(norm).sort()) ||
    JSON.stringify((a||[]).map(label).sort())===JSON.stringify((b||[]).map(label).sort());
  if(!sameLabels(l.categories,n.categories)) add("categories",k,l.categories,n.categories);
  // An empty tag is not a tag. allshecooks carries one on its Irish potato
  // candy - legacy lists "", American, Irish Potato Candy, ... where V2 lists
  // the same set without the blank - and comparing the lists with it in reads
  // as a difference in what the recipe is tagged with.
  // Deliberately norm rather than label: the whitespace collapse above is
  // justified by a case seen in categories, and there is no such case in tags.
  // Loosening a comparison further than the evidence asks is how a real
  // difference gets normalised away.
  const tags=v=>(v||[]).map(norm).filter(t=>t!=="");
  const lt=tags(l.tags).sort();
  const kw=tags(n.keywords).sort();
  const recomb=[...tags(n.keywords),...tags(n.cuisines)].sort();
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
// The URL half of a key has to be built the same way the key was, or the
// sibling test stops recognizing its own keys under the relaxations above.
const urlKey=u=>{
  const raw=keyOpts.stripExt?url(u).replace(/\.html?$/iu,""):url(u);
  return keyOpts.lower?raw.toLowerCase():raw;
};
const legacyUrls=new Set(legacy.map(r=>urlKey(r.url)));
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
// Built from the paired map, not from the raw records: pairing gives the extra
// records under a shared key a suffixed key ("... #2"), and looking those up by
// the unsuffixed one finds nothing. ketoconnect publishes two "Low Carb Pizza"
// records on one URL, one of them with no instructions at all, and that lookup
// failing left the record V2 was right to reject reported as a loss.
const legacyByKey=L;
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
// A legacy run that Cloudflare stopped mid-pagination is not a baseline. On
// 2026-08-29 sixteen sources were compared against one: theseasonedmom's spider
// took page 1 and 2 of its WPRM API and got 403 on page 3, so its 200 records
// were reported as a 1868-record V2 surplus. Re-probed on 2026-09-03 that same
// URL answers 200 to both a browser and the spider's own user agent, so the
// block was pacing rather than the site refusing us - which makes the verdict
// wrong rather than the source interesting. The log names it; read it and say
// so instead of publishing a comparison built on a truncated side.
// Derived from the legacy dump rather than the source name: shadow-parity.sh
// and legacy-halt-check.sh both pass the two dump paths and no name, so keying
// on a name silently found no log and detected nothing.
const logPath=process.argv[5]||String(process.argv[2]||"").replace(/\.json$/u,".scrapy.log");
let legacyBlocked=null;
try{
  const log=fs.readFileSync(logPath,"utf8");
  const hit=log.split("\n").find(line=>/block_reason=|Just a moment/u.test(line));
  if(hit) legacyBlocked=hit.trim().slice(0,240);
}catch{ /* no log to read is not evidence either way */ }
if(legacyBlocked){
  console.log(`\nINCONCLUSIVE: the legacy run was blocked, so its record set is a floor rather than a baseline\n  ${legacyBlocked}`);
  process.exitCode=2;
} else if(!legacy.length || !crawlee.length){
  console.log(`\nINCONCLUSIVE: legacy=${legacy.length} crawlee=${crawlee.length} - one side produced no records`);
  process.exitCode=2;
} else if(!countsAgree){
  console.log("\nMISMATCH: record sets differ; see only-legacy / only-crawlee above");
  process.exitCode=2;
} else if(Object.keys(diffs).length){
  console.log("\nMISMATCH: field differences above");
  process.exitCode=2;
} else {
  console.log(`\nALL MATERIAL FIELDS MATCH (${cuisineDropped?`${cuisineDropped} records keep a cuisine legacy has no field for`:"tags == keywords + cuisines"}${namedSteps?`; ${namedSteps} records keep WPRM named-step prefixes legacy drops`:""}${richerYield?`; ${richerYield} records keep a fuller yield than legacy leading-integer`:""}${negativeDurations?`; ${negativeDurations} negative upstream durations V2 rejects and legacy keeps`:""}${looseDurations?`; ${looseDurations} loosely spelled durations V2 reads and legacy gives up on`:""}${relativeImages?`; ${relativeImages} records keep images legacy discards`:""}${legacyProseImages?`; ${legacyProseImages} records decline a paragraph legacy stores as an image`:""}${fusedByLegacy?`; ${fusedByLegacy} records keep a space at a block boundary legacy fuses over`:""}${legacyDroppedIngredients?`; ${legacyDroppedIngredients} records keep ingredients legacy stores none of`:""}${legacyDroppedInstructions?`; ${legacyDroppedInstructions} records keep instructions legacy stores none of`:""}${spacedByLegacy?`; ${spacedByLegacy} records drop a space legacy inserts where it strips inline markup`:""}${siblings.length?`; ${siblings.length} sibling recipes recovered`:""}${incompleteOnlyLegacy.length?`; ${incompleteOnlyLegacy.length} records legacy accepts without a name, ingredients or instructions`:""})`);
}
