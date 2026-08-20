/**
 * Dump one source's stored RecipeDocument V2 records to a file.
 *
 *   node tools/parity/dump-crawlee.cjs <database> <source-id> <out.json> [crawlRunId]
 */
const { MongoClient } = require("mongodb");

(async () => {
  const [db, sourceId, out, runId] = process.argv.slice(2);
  const client = new MongoClient(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017");
  await client.connect();
  const query = { sourceId };
  if (runId) query.crawlRunId = runId;
  const documents = await client.db(db).collection("recipes_v2").find(query).toArray();
  require("node:fs").writeFileSync(out, JSON.stringify(documents, null, 1));
  console.log(`dumped ${documents.length} -> ${out}`);
  await client.close();
})();
