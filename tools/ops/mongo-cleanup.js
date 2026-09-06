((DROP_DATABASES, SCRAPED_AT_BEFORE, APPLY) => {
  const PROTECTED = ["crawlee","18000","admin","config","local",
    "crawlee_wprm_sweep_20260821","crawlee_danish_jsonld_relost_20260829",
    "crawlee_danish_jsonld_wp2_20260819","crawlee_danish_jsonld_dk_20260820",
    "crawlee_danish_jsonld_wprm_20260820","crawlee_danish_jsonld_dkwp_20260820",
    "crawlee_danish_jsonld_wpw_20260820","crawlee_danish_jsonld_rt_20260820",
    "crawlee_danish_jsonld_rt2_20260820","crawlee_danish_jsonld_rt3_20260820",
    "crawlee_danish_jsonld_wp1_20260819"];
  const size = {};
  db.getSiblingDB("admin").adminCommand({listDatabases:1}).databases
    .forEach(d => size[d.name] = Number(d.sizeOnDisk) || 0);
  const out = [];
  DROP_DATABASES.forEach(n => {
    if (PROTECTED.includes(n)) return out.push({item:n, MB:0, action:"REFUSED - protected"});
    if (!(n in size)) return out.push({item:n, MB:0, action:"skip - does not exist"});
    if (APPLY) db.getSiblingDB(n).dropDatabase();
    out.push({item:n, MB:+(size[n]/1048576).toFixed(1), action:APPLY?"DROPPED":"would drop"});
  });
  if (SCRAPED_AT_BEFORE) db.getSiblingDB("scrapedAt").getCollectionNames()
    .filter(c => /^\d{6}$/.test(c) && c < String(SCRAPED_AT_BEFORE)).sort()
    .forEach(c => {
      const s = db.getSiblingDB("scrapedAt").getCollection(c).stats();
      const mb = +((Number(s.storageSize) + Number(s.totalIndexSize||0))/1048576).toFixed(1);
      if (APPLY) db.getSiblingDB("scrapedAt").getCollection(c).drop();
      out.push({item:"scrapedAt."+c, MB:mb, docs:s.count, action:APPLY?"DROPPED":"would drop"});
    });
  db.getSiblingDB("admin").adminCommand({listDatabases:1}).databases
    .map(d => ({item:d.name, MB:+(Number(d.sizeOnDisk)/1048576).toFixed(1), action:"on disk"}))
    .sort((a,b) => b.MB - a.MB).slice(0,20).forEach(r => out.push(r));
  return [{item:APPLY?"=== APPLIED ===":"=== REPORT ONLY, set last argument to true ===",
           MB:+out.filter(r=>r.action!=="on disk").reduce((a,b)=>a+b.MB,0).toFixed(1),
           action:APPLY?"freed":"would free"}].concat(out);
})(

  [],     // databases to drop, e.g. ["old-db","another-db"]
  null,   // scrapedAt cutoff, e.g. "260901" drops daily collections older than that
  false   // true = actually drop

)
