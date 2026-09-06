// Paste into the MongoDB Compass shell (mongosh). Safe to paste more than once.
//
// It reports by default and destroys nothing until you set DRY_RUN = false.
// Re-pasting re-defines everything, so you can edit and paste again freely.
//
//   cleanup.report()                     what is on the server, largest first
//   cleanup.scrapedAt()                  the dated collections and their sizes
//   cleanup.dropDatabases([...])         drop databases by name
//   cleanup.dropScrapedAtBefore("260901")  drop dated collections older than this
//
//   cleanup.DRY_RUN = false              arm it; nothing destroys before this
//
// PROTECTED holds the recipe-migration databases. Four of them are the sole
// copy of records for 647, 67, 56 and 27 sources - the audit trail behind 870
// promoted sources - and `crawlee` and `18000` hold the two runs that landolakes
// was promoted on. The script refuses to drop any of them even if you name one.
globalThis.cleanup = (function () {
  const PROTECTED = new Set([
    "crawlee",
    "18000",
    "crawlee_wprm_sweep_20260821",
    "crawlee_danish_jsonld_relost_20260829",
    "crawlee_danish_jsonld_wp2_20260819",
    "crawlee_danish_jsonld_dk_20260820",
    "crawlee_danish_jsonld_wprm_20260820",
    "crawlee_danish_jsonld_dkwp_20260820",
    "crawlee_danish_jsonld_wpw_20260820",
    "crawlee_danish_jsonld_rt_20260820",
    "crawlee_danish_jsonld_rt2_20260820",
    "crawlee_danish_jsonld_rt3_20260820",
    "crawlee_danish_jsonld_wp1_20260819",
    "admin", "config", "local",
  ]);

  const mb = (b) => (b / 1048576).toFixed(1).padStart(9);
  const pad = (s, n) => String(s).padEnd(n);

  // listDatabases returns sizeOnDisk as a BSON numeric wrapper, not a JS
  // number: it prints like a number and divides like one, but Number.isFinite
  // is false for it and adding a few hundred together gives Infinity. Coerce
  // once, here, so nothing downstream has to remember.
  function databases() {
    return db.getSiblingDB("admin")
      .adminCommand({ listDatabases: 1 }).databases
      .map((d) => ({ name: d.name, sizeOnDisk: Number(d.sizeOnDisk) || 0 }))
      .sort((a, b) => b.sizeOnDisk - a.sizeOnDisk);
  }

  function report(limit) {
    const all = databases();
    let total = 0;
    for (const d of all) total += d.sizeOnDisk;
    print("=== " + all.length + " databases, " + (total / 1073741824).toFixed(2) + " GB ===");
    print(pad("SIZE", 11) + pad("DATABASE", 42) + "STATUS");
    for (const d of all.slice(0, limit || 25)) {
      print(mb(d.sizeOnDisk) + " MB  " + pad(d.name, 40) +
            (PROTECTED.has(d.name) ? "PROTECTED" : ""));
    }
    if (all.length > (limit || 25)) {
      print("   ... " + (all.length - (limit || 25)) + " smaller databases not shown; " +
            "call cleanup.report(" + all.length + ") for all");
    }
    return all.length;
  }

  function scrapedAt() {
    const sd = db.getSiblingDB("scrapedAt");
    const names = sd.getCollectionNames().sort();
    let total = 0;
    print("=== scrapedAt: " + names.length + " collections ===");
    for (const c of names) {
      const st = sd.getCollection(c).stats();
      const size = Number(st.storageSize) + Number(st.totalIndexSize || 0);
      total += size;
      print("  " + pad(c, 10) + String(st.count).padStart(9) + " docs  " + mb(size) + " MB");
    }
    print("  total " + (total / 1048576).toFixed(1) + " MB");
    return names;
  }

  function dropDatabases(names) {
    if (!Array.isArray(names) || names.length === 0) {
      print("pass an array of database names");
      return;
    }
    const sizes = {};
    for (const d of databases()) sizes[d.name] = d.sizeOnDisk;
    let freed = 0;
    for (const n of names) {
      if (PROTECTED.has(n)) { print("REFUSED  " + n + "  (protected)"); continue; }
      if (!(n in sizes)) { print("skip     " + n + "  (does not exist)"); continue; }
      freed += sizes[n];
      if (api.DRY_RUN) {
        print("would drop " + pad(n, 42) + mb(sizes[n]) + " MB");
      } else {
        db.getSiblingDB(n).dropDatabase();
        print("dropped    " + pad(n, 42) + mb(sizes[n]) + " MB");
      }
    }
    print((api.DRY_RUN ? "would free " : "freed ") + (freed / 1048576).toFixed(1) +
          " MB" + (api.DRY_RUN ? "   -- set cleanup.DRY_RUN = false to apply" : ""));
  }

  // scrapedAt's collections are named YYMMDD. Keeps anything named on or after
  // the cutoff, and anything whose name is not six digits.
  function dropScrapedAtBefore(cutoff) {
    if (!/^\d{6}$/.test(String(cutoff || ""))) {
      print('pass a YYMMDD cutoff, e.g. cleanup.dropScrapedAtBefore("260901")');
      return;
    }
    const sd = db.getSiblingDB("scrapedAt");
    let freed = 0, kept = 0;
    for (const c of sd.getCollectionNames().sort()) {
      if (!/^\d{6}$/.test(c)) { print("skip     " + c + "  (not a date)"); continue; }
      if (c >= String(cutoff)) { kept++; continue; }
      const st = sd.getCollection(c).stats();
      const size = Number(st.storageSize) + Number(st.totalIndexSize || 0);
      freed += size;
      if (api.DRY_RUN) {
        print("would drop scrapedAt." + pad(c, 10) + mb(size) + " MB  " + st.count + " docs");
      } else {
        sd.getCollection(c).drop();
        print("dropped    scrapedAt." + pad(c, 10) + mb(size) + " MB  " + st.count + " docs");
      }
    }
    print("keeping " + kept + " collection(s) on or after " + cutoff + "; " +
          (api.DRY_RUN ? "would free " : "freed ") + (freed / 1048576).toFixed(1) + " MB" +
          (api.DRY_RUN ? "   -- set cleanup.DRY_RUN = false to apply" : ""));
  }

  const api = { DRY_RUN: true, PROTECTED, report, scrapedAt, dropDatabases, dropScrapedAtBefore };
  return api;
})();

print("cleanup ready. DRY_RUN = " + cleanup.DRY_RUN +
      "  (nothing is destroyed until you set cleanup.DRY_RUN = false)");
cleanup.report();
