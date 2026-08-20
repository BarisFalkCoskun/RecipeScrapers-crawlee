/**
 * Manual read of stored RecipeDocument V2 records for one source.
 *
 *   node tools/parity/read-stored.cjs <database> <source-id> [count]
 *
 * A source whose legacy spider is unhealthy cannot reach shadow_passed on
 * parity, because the legacy run is not a sound comparison. The documented
 * route for those sources asks for a manual read of at least twenty stored
 * records; this performs and reports it so the read is reproducible rather
 * than a claim.
 */
const { MongoClient } = require("mongodb");

const MAX_PLAUSIBLE_MINUTES = 100_000;

(async () => {
  const [db, sourceId, rawCount] = process.argv.slice(2);
  const count = Number(rawCount ?? 25);
  const client = new MongoClient(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017");
  await client.connect();
  const collection = client.db(db).collection("recipes_v2");
  const total = await collection.countDocuments({ sourceId });
  const documents = await collection.find({ sourceId }).limit(count).toArray();

  const problems = [];
  for (const document of documents) {
    const normalized = document.normalized ?? {};
    const issues = [];
    if (!normalized.title?.trim()) issues.push("no title");
    if (!normalized.ingredients?.length) issues.push("no ingredients");
    if (!normalized.instructions?.length) issues.push("no instructions");
    if (!document.canonicalUrl) issues.push("no canonical URL");
    if (!document.sourceRecipeKey) issues.push("no source key");
    for (const field of ["prepMinutes", "cookMinutes", "totalMinutes"]) {
      const value = normalized[field];
      if (value === undefined) continue;
      // A very long duration can be real — one source states a ninety-day
      // steeping time — so this only flags what cannot be a duration at all.
      if (!Number.isFinite(value) || value <= 0) issues.push(`${field}=${value}`);
      else if (value > MAX_PLAUSIBLE_MINUTES) issues.push(`${field}=${value} (check: over 69 days)`);
    }
    if (issues.length) problems.push({ url: document.canonicalUrl, issues });
  }

  console.log(`${sourceId}: stored ${total}, read ${documents.length}, clean ${documents.length - problems.length}`);
  for (const problem of problems.slice(0, 10)) console.log("  !", problem.url, problem.issues.join("; "));
  await client.close();
  if (problems.length) process.exitCode = 1;
})();
