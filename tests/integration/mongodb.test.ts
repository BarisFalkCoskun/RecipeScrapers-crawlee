import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { RecipeStore } from "../../src/storage/mongodb.js";
import { buildRecipeDocumentV2 } from "../../src/danish-jsonld/recipe-document.js";

const uri = process.env["MONGODB_TEST_URI"];
if (process.env["npm_lifecycle_event"] === "test:integration" && !uri) {
  throw new Error("test:integration requires MONGODB_TEST_URI for an isolated test server");
}

describe.skipIf(!uri)("real MongoDB persistence", () => {
  const database = `recipe_crawlee_test_${randomUUID().replaceAll("-", "")}`;
  const store = new RecipeStore(uri ?? "mongodb://127.0.0.1:27017", database);
  // The supplied local test server should be ready before the suite starts; fail promptly if it is absent.
  const inspector = new MongoClient(uri ?? "mongodb://127.0.0.1:27017", { serverSelectionTimeoutMS: 3000 });
  const recipe = (key = "one", name = "Kage") => buildRecipeDocumentV2({
    sourceId: "fixture", canonicalUrl: `https://fixture.invalid/${key}`, pageUrl: `https://fixture.invalid/${key}`,
    crawlRunId: "run", crawlAttemptId: "attempt", extractedAt: new Date("2026-09-22T10:00:00Z"),
    rawRecipe: { "@type": "Recipe", "@id": key, name, recipeIngredient: ["100 g mel"], recipeInstructions: ["Bland melet."] },
    language: "da", languageConfidence: 1, languageSignals: [], extractionSignals: [], extractorVersion: "test",
  });
  beforeAll(async () => { await inspector.connect(); await store.connect(); });
  afterAll(async () => {
    // This generated database is the only database the suite is allowed to remove.
    try { await inspector.db(database).dropDatabase(); }
    finally { await Promise.all([store.close(), inspector.close()]); }
  });

  it("enforces source identity and distinguishes new, unchanged, and changed recipes", async () => {
    const original = recipe();
    expect(await store.upsertRecipeV2(original)).toMatchObject({ operation: "inserted", contentChanged: true });
    expect(await store.upsertRecipeV2({ ...original, createdAt: new Date(), crawlRunId: "retry" }))
      .toMatchObject({ operation: "updated", contentChanged: false });
    expect(await store.upsertRecipeV2(recipe("one", "Ny kage"))).toMatchObject({ operation: "updated", contentChanged: true });
    const documents = await inspector.db(database).collection("recipes_v2").find({ sourceRecipeKey: original.sourceRecipeKey }).toArray();
    expect(documents).toHaveLength(1);
    expect(documents[0].createdAt).toEqual(original.createdAt);
    expect(documents[0].normalized.title).toBe("Ny kage");
  });

  it("survives concurrent duplicate delivery without creating extra recipes", async () => {
    const document = recipe("concurrent");
    const results = await Promise.all(Array.from({ length: 6 }, () => store.upsertRecipeV2(document)));
    expect(results.filter((r) => r.operation === "inserted")).toHaveLength(1);
    expect(results.filter((r) => r.operation === "updated" && !r.contentChanged)).toHaveLength(5);
    expect(await inspector.db(database).collection("recipes_v2").countDocuments({ sourceRecipeKey: document.sourceRecipeKey })).toBe(1);
  });

  it("keeps rejection evidence separate, idempotent, indexed, and subject to retention", async () => {
    const candidate = { candidateKey: "candidate", sourceId: "fixture", pageUrl: "https://fixture.invalid/incomplete",
      crawlRunId: "run", extractedAt: new Date(), extractorVersion: "test", format: "json-ld" as const,
      reasons: ["missing-instructions"], candidateCount: 1, rawRecipe: { name: "Incomplete" }, diagnosis: "incomplete-structured-data" as const };
    await store.upsertRejectedCandidate(candidate);
    await store.upsertRejectedCandidate(candidate);
    const collection = inspector.db(database).collection("recipe_candidates");
    expect(await collection.countDocuments({ candidateKey: "candidate" })).toBe(1);
    expect(await inspector.db(database).collection("recipes_v2").countDocuments({ pageUrl: candidate.pageUrl })).toBe(0);
    const indexes = await collection.indexes();
    expect(indexes).toContainEqual(expect.objectContaining({ key: { candidateKey: 1 }, unique: true }));
    expect(indexes).toContainEqual(expect.objectContaining({ key: { extractedAt: 1 }, expireAfterSeconds: 90 * 86400 }));
  });
});
