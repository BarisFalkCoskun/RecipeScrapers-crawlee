#!/usr/bin/env node
// Reports which sources an extraction change actually rewrites.
//
// Parity and idempotency evidence is only as good as the code that produced it.
// When an extraction fix lands mid-sweep, evidence gathered before it is stale
// for the sources the fix touches - and untouched for the rest. Re-running
// everything wastes hours; re-running nothing promotes on evidence that no
// longer describes the extractor. This tells the two apart by re-extracting each
// stored record from its own rawRecipe with the current code and comparing the
// result to what is stored.
//
// Takes a file of "<sourceId> <database>" lines, the same shape the queues use.
const { MongoClient } = require("mongodb");
const fs = require("fs");
const { extractWprmRecipes } = require("../../dist/wprm/recipe-document.js");

const queue = process.argv[2];
if (!queue) {
  console.error("usage: fix-impact.cjs <queue-file>");
  process.exit(2);
}

const mongoUri = () =>
  process.env.MONGODB_URI ||
  fs.readFileSync(".env", "utf8").split("\n").find((l) => l.startsWith("MONGODB_URI"))
    .split("=").slice(1).join("=").trim().replace(/^"|"$/gu, "");

(async () => {
  const client = new MongoClient(mongoUri());
  await client.connect();
  const untouched = [];
  const rewritten = [];
  for (const line of fs.readFileSync(queue, "utf8").trim().split("\n").filter(Boolean)) {
    const [sourceId, database] = line.split(" ");
    const docs = await client.db(database).collection("recipes_v2")
      .find({ sourceId }).toArray();
    let changed = 0;
    let example = "";
    for (const doc of docs) {
      if (!doc.rawRecipe) continue;
      const out = extractWprmRecipes([{ link: doc.canonicalUrl, recipe: doc.rawRecipe }]);
      const now = out.recipes[0] && out.recipes[0].normalized;
      if (!now) continue;
      const before = doc.normalized || {};
      // The whole normalized record, not a chosen few fields. Naming fields here
      // once let a source through whose only rewritten field was description:
      // chokomils was promoted as untouched and then reported CHANGED on its
      // next repeat run, because the block boundary the fix repairs appears in
      // prose as readily as in a step.
      if (JSON.stringify(now) !== JSON.stringify(before)) {
        if (changed === 0) example = doc.canonicalUrl;
        changed += 1;
      }
    }
    (changed === 0 ? untouched : rewritten).push(`${sourceId} ${database}`);
    console.log(
      `${sourceId.padEnd(26)} stored=${String(docs.length).padStart(6)} ` +
      `rewritten=${String(changed).padStart(6)}${changed ? "  e.g. " + example : ""}`
    );
  }
  await client.close();
  if (process.env.FIX_IMPACT_OUT) {
    fs.writeFileSync(`${process.env.FIX_IMPACT_OUT}.untouched`, untouched.join("\n") + "\n");
    fs.writeFileSync(`${process.env.FIX_IMPACT_OUT}.rewritten`, rewritten.join("\n") + "\n");
  }
  console.log(`\nuntouched: ${untouched.length}  rewritten: ${rewritten.length}`);
})().catch((error) => { console.log("ERROR", error.message); process.exit(1); });
