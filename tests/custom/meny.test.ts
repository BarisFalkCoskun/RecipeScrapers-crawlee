import { describe, expect, it } from "vitest";
import { createMenySearchRequest, extractMenyPage } from "../../src/custom/meny.js";

describe("Meny Dagrofa API adapter", () => {
  it("creates stable offset requests", () => {
    expect(createMenySearchRequest(50)).toMatchObject({
      kind: "listing",
      uniqueKey: "meny-search:50",
      requestData: { menyOffset: 50 },
    });
  });

  it("normalizes complete API records", () => {
    const result = extractMenyPage(JSON.stringify({ responseData: { totalHits: 1, products: [{ source: {
      longName: "Grøn iste",
      urlSegment: "gron-iste",
      source: "meny.dk",
      teaserText: "En kold drik.",
      preparationTime: { total: "01:10:00" },
      amount: { number: 4, unit: { nameSingular: "person" } },
      ingredientGroups: [{ ingredientGroupIngredients: [{
        amount: 1,
        unit: { nameSingular: "liter" },
        ingredient: { nameSingular: "vand" },
      }] }],
      instructionSections: [{ steps: ["Bryg teen.", "Køl den ned."] }],
      nutritionalValues: { energy: 10, protein: 1, fat: 0, carbohydrates: 2, fibers: 1 },
      metaData: { propertyCategories: [{ values: [{ name: "Drikke" }] }] },
      pictures: [{ url: "https://cdn.example/iste.jpg?preset={preset}" }],
    } }] } }));
    expect(result).toMatchObject({ itemCount: 1, total: 1, recipes: [{
      canonicalUrl: "https://meny.dk/opskrift/gron-iste",
      normalized: {
        title: "Grøn iste",
        ingredients: ["1 liter vand"],
        instructions: [
          { position: 1, text: "Bryg teen." },
          { position: 2, text: "Køl den ned." },
        ],
        totalMinutes: 70,
        yieldText: "4 person",
        categories: ["Drikke"],
        imageUrls: ["https://cdn.example/iste.jpg?preset=Main"],
      },
    }] });
  });
});
