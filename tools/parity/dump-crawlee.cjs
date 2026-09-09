/**
 * Dump one source's stored RecipeDocument V2 records to a file.
 *
 *   node tools/parity/dump-crawlee.cjs <database> <source-id> <out.json> [crawlRunId|latest]
 *
 * The store accumulates: an upsert never deletes, so records the crawler would
 * no longer produce stay behind and a comparison counts them against the
 * current run. odensemarcipan holds 1029 records where its run wrote 1023, and
 * four of the six survivors are records the extractor now refuses outright.
 * Passing "latest" resolves the newest crawlRunId for the source and dumps only
 * that run, which compares what the crawler produces rather than what the store
 * has ever held. Without it the behaviour is unchanged and every record is
 * dumped.
 */
const { MongoClient } = require("mongodb");

(async () => {
  const [db, sourceId, out, runId] = process.argv.slice(2);
  const client = new MongoClient(process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017");
  await client.connect();
  const collection = client.db(db).collection("recipes_v2");
  const query = { sourceId };
  if (runId === "latest") {
    // crawlRunId starts with an ISO timestamp, so the newest sorts last.
    const newest = await collection
      .find({ sourceId }, { projection: { crawlRunId: 1 } })
      .sort({ crawlRunId: -1 })
      .limit(1)
      .toArray();
    if (newest.length === 0) {
      console.log(`no records for ${sourceId} in ${db}`);
      require("node:fs").writeFileSync(out, "[]");
      await client.close();
      return;
    }
    query.crawlRunId = newest[0].crawlRunId;
    const total = await collection.countDocuments({ sourceId });
    const kept = await collection.countDocuments(query);
    console.log(
      `latest run ${query.crawlRunId} holds ${kept} of ${total} stored records` +
      (total === kept ? "" : `; ${total - kept} predate it and are excluded`)
    );
  } else if (runId) {
    query.crawlRunId = runId;
  }
  const documents = await collection.find(query).toArray();
  require("node:fs").writeFileSync(out, JSON.stringify(documents, null, 1));
  console.log(`dumped ${documents.length} -> ${out}`);
  await client.close();
})();
