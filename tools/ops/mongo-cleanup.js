// MongoDB cleanup for the Compass shell (also fine in mongosh).
//
// EDIT THE CONFIG BLOCK, THEN PASTE THE WHOLE FILE. One paste does everything.
//
// It is written this way on purpose. An earlier version kept a DRY_RUN flag on
// a `cleanup` object and expected you to set it in a separate command; that
// works in mongosh and did nothing in Compass, whose shell does not reliably
// carry state from one command to the next. So intent lives in the same paste
// as the action, and there is no state to lose between statements.

// ============================ CONFIG ============================
var APPLY = false;             // false = report only. true = actually drop.

var DROP_DATABASES = [         // database names to drop
  // "some-database",
];

var SCRAPED_AT_BEFORE = null;  // e.g. "260901" drops scrapedAt daily
                               // collections older than that. null = skip.
// ================================================================

// The recipe-migration databases. wprm_sweep, relost, wp2 and dk are the sole
// copy of records for 647, 67, 56 and 27 sources - the audit trail behind 870
// promoted sources - and crawlee and 18000 hold the two runs landolakes was
// promoted on. Named here so a typo cannot take one out; remove one from this
// list deliberately if you ever really mean it.
var PROTECTED = [
  "crawlee", "18000",
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
];

(function () {
  var protectedSet = {};
  for (var i = 0; i < PROTECTED.length; i++) protectedSet[PROTECTED[i]] = true;

  var mb = function (b) { return (Number(b) / 1048576).toFixed(1); };
  var pad = function (s, n) {
    s = String(s);
    while (s.length < n) s += " ";
    return s;
  };

  // listDatabases returns sizeOnDisk as a BSON numeric wrapper, not a JS
  // number: it prints like a number and divides like one, but summing a few
  // hundred of them gives Infinity. Coerce once, here.
  var dbs = db.getSiblingDB("admin").adminCommand({ listDatabases: 1 }).databases
    .map(function (d) { return { name: d.name, size: Number(d.sizeOnDisk) || 0 }; })
    .sort(function (a, b) { return b.size - a.size; });

  var total = 0, size = {};
  for (var j = 0; j < dbs.length; j++) { total += dbs[j].size; size[dbs[j].name] = dbs[j].size; }

  print("=== " + dbs.length + " databases, " + (total / 1073741824).toFixed(2) + " GB ===");
  print("MODE: " + (APPLY ? "APPLY - this will destroy data" : "REPORT ONLY - set APPLY = true to destroy"));
  print("");
  print("largest 20:");
  for (var k = 0; k < Math.min(20, dbs.length); k++) {
    print("  " + pad(mb(dbs[k].size), 9) + " MB  " + pad(dbs[k].name, 40) +
          (protectedSet[dbs[k].name] ? "PROTECTED" : ""));
  }

  var freed = 0, acted = 0;

  if (DROP_DATABASES.length) {
    print("");
    print("=== databases ===");
    for (var m = 0; m < DROP_DATABASES.length; m++) {
      var n = DROP_DATABASES[m];
      if (protectedSet[n]) { print("  REFUSED  " + n + "  (protected)"); continue; }
      if (!(n in size)) { print("  skip     " + n + "  (does not exist)"); continue; }
      freed += size[n];
      acted++;
      if (APPLY) {
        db.getSiblingDB(n).dropDatabase();
        print("  DROPPED  " + pad(n, 42) + pad(mb(size[n]), 9) + " MB");
      } else {
        print("  would drop " + pad(n, 40) + pad(mb(size[n]), 9) + " MB");
      }
    }
  }

  if (SCRAPED_AT_BEFORE) {
    print("");
    print("=== scrapedAt, dropping daily collections before " + SCRAPED_AT_BEFORE + " ===");
    if (!/^\d{6}$/.test(String(SCRAPED_AT_BEFORE))) {
      print("  SCRAPED_AT_BEFORE must be YYMMDD, e.g. \"260901\" - skipping");
    } else {
      var sd = db.getSiblingDB("scrapedAt");
      var names = sd.getCollectionNames().sort(), kept = 0;
      for (var q = 0; q < names.length; q++) {
        var c = names[q];
        if (!/^\d{6}$/.test(c)) { print("  skip     " + c + "  (not a date)"); continue; }
        if (c >= String(SCRAPED_AT_BEFORE)) { kept++; continue; }
        var st = sd.getCollection(c).stats();
        var csz = Number(st.storageSize) + Number(st.totalIndexSize || 0);
        freed += csz;
        acted++;
        if (APPLY) {
          sd.getCollection(c).drop();
          print("  DROPPED  scrapedAt." + pad(c, 8) + pad(mb(csz), 9) + " MB  " + st.count + " docs");
        } else {
          print("  would drop scrapedAt." + pad(c, 8) + pad(mb(csz), 9) + " MB  " + st.count + " docs");
        }
      }
      print("  keeping " + kept + " collection(s) on or after " + SCRAPED_AT_BEFORE);
    }
  }

  print("");
  if (!acted) {
    print("Nothing selected. Put names in DROP_DATABASES and/or set SCRAPED_AT_BEFORE, then paste again.");
  } else if (APPLY) {
    print("DONE - freed " + mb(freed) + " MB across " + acted + " item(s).");
  } else {
    print("Would free " + mb(freed) + " MB across " + acted + " item(s).");
    print("Set APPLY = true at the top and paste the file again to do it.");
  }
})();
