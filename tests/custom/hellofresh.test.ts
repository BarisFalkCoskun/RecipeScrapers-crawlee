import { describe, expect, it } from "vitest";
import {
  createHelloFreshSearchRequest,
  extractHelloFreshPage,
  extractHelloFreshToken,
} from "../../src/custom/hellofresh.js";

describe("HelloFresh API adapter", () => {
  it("extracts the access token without exposing it in request metadata", () => {
    expect(extractHelloFreshToken('<script>{"access_token":"secret-token"}</script>'))
      .toBe("secret-token");
    const request = createHelloFreshSearchRequest("secret-token", 250);
    expect(request).toMatchObject({
      kind: "listing",
      uniqueKey: "hellofresh-search:250",
      requestData: { helloFreshPhase: "search", offset: 250 },
      requestHeaders: { authorization: "Bearer secret-token" },
    });
    expect(JSON.stringify(request.requestData)).not.toContain("secret-token");
  });

  it("normalizes complete recipes using the first yield amounts", () => {
    const result = extractHelloFreshPage(JSON.stringify({ total: 1, items: [{
      id: "abc123",
      slug: "nem-pasta",
      name: "Nem pasta",
      description: "En hurtig ret.",
      prepTime: "PT10M",
      totalTime: "PT35M",
      difficulty: 1,
      ingredients: [{ id: "pasta", name: "Pasta" }, { id: "tomat", name: "Tomat" }],
      yields: [{ yields: 2, ingredients: [
        { id: "pasta", amount: 250, unit: "g" },
        { id: "tomat", amount: 2, unit: "stk" },
      ] }],
      steps: [{ index: 1, instructions: "Kog pastaen grundigt." }],
      tags: [{ type: "quick", name: "Hurtig" }],
      nutrition: [{ type: "energy", amount: 500 }],
      imagePath: "/image/pasta.jpg",
    }] }));

    expect(result).toMatchObject({ itemCount: 1, total: 1, incompleteCount: 0 });
    expect(result.recipes?.[0]).toMatchObject({
      canonicalUrl: "https://www.hellofresh.dk/recipes/nem-pasta-abc123",
      normalized: {
        title: "Nem pasta",
        ingredients: ["250 g Pasta", "2 stk Tomat"],
        instructions: [{ position: 1, text: "Kog pastaen grundigt." }],
        prepMinutes: 10,
        totalMinutes: 35,
        yieldText: "2",
        keywords: ["Hurtig", "Sværhedsgrad: 1"],
        imageUrls: ["https://img.hellofresh.com/f_auto,q_auto//image/pasta.jpg"],
        nutrition: { energy: 500 },
      },
    });
  });
});
