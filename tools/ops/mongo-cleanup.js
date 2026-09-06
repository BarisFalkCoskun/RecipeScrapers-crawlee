// Compass shell snippets. Paste ONE at a time. Each is self-contained.
// Nothing here needs a flag set in a separate command.

// -------- 1. what is on the server, biggest first --------
db.getSiblingDB("admin").adminCommand({listDatabases:1}).databases
  .map(d => ({db: d.name, MB: +(Number(d.sizeOnDisk)/1048576).toFixed(1)}))
  .sort((a,b) => b.MB - a.MB).slice(0,30)


// -------- 2. scrapedAt daily collections --------
db.getSiblingDB("scrapedAt").getCollectionNames().sort().map(c => {
  const s = db.getSiblingDB("scrapedAt").getCollection(c).stats();
  return {coll: c, docs: s.count, MB: +((Number(s.storageSize)+Number(s.totalIndexSize||0))/1048576).toFixed(1)};
})


// -------- 3. DROP named databases -- edit the list, then paste --------
// DO NOT put these in the list, they are the recipe migration's evidence:
//   crawlee, 18000, crawlee_wprm_sweep_20260821,
//   crawlee_danish_jsonld_relost_20260829, crawlee_danish_jsonld_wp2_20260819,
//   crawlee_danish_jsonld_dk_20260820, and the other crawlee_danish_jsonld_*
["name1","name2"].forEach(n => { print("dropping " + n); db.getSiblingDB(n).dropDatabase(); })


// -------- 4. DROP scrapedAt collections older than a date --------
db.getSiblingDB("scrapedAt").getCollectionNames()
  .filter(c => /^\d{6}$/.test(c) && c < "260901")
  .forEach(c => { print("dropping scrapedAt." + c); db.getSiblingDB("scrapedAt").getCollection(c).drop(); })


// -------- 5. see what #4 would take, without dropping --------
db.getSiblingDB("scrapedAt").getCollectionNames()
  .filter(c => /^\d{6}$/.test(c) && c < "260901")
  .map(c => { const s = db.getSiblingDB("scrapedAt").getCollection(c).stats();
    return {coll: c, docs: s.count, MB: +((Number(s.storageSize)+Number(s.totalIndexSize||0))/1048576).toFixed(1)}; })
