import { describe, expect, it } from "vitest";
import { extractDkKogebogenRecipe } from "../../src/custom/dkkogebogen.js";

describe("DK Kogebogen microdata adapter", () => {
  it("matches the legacy field semantics", () => {
    const result = extractDkKogebogenRecipe(`
      <html><head><meta name="description" content="Langtidsstegt lam"></head><body>
      <main itemscope itemtype="https://schema.org/Recipe">
        <h1 itemprop="name">Lammekølle</h1>
        <span itemprop="recipeYield">6 Pers.</span>
        <p itemprop="recipeIngredient">1500 gram Lammekølle</p>
        <p itemprop="recipeIngredient">1 Citron</p>
        <div itemprop="recipeInstructions">Gør køllen klar.\nSteg den langsomt.</div>
        <span itemprop="recipeCategory">Hovedret</span>
        <span itemprop="recipeCuisine">Dansk</span>
        <span itemprop="keywords">Lam, Påske</span>
        <img itemprop="image" src="/image.jpg">
        <div itemprop="nutrition"><span itemprop="calories">300 kcal</span></div>
      </main></body></html>
    `, "https://www.dk-kogebogen.dk/opskrifter/1/lam");

    expect(result).toMatchObject({
      incompleteCount: 0,
      malformedCount: 0,
      recipe: { normalized: {
        title: "Lammekølle",
        description: "Langtidsstegt lam",
        yieldText: "6",
        ingredients: ["1500 gram Lammekølle", "1 Citron"],
        instructions: [
          { position: 1, text: "Gør køllen klar." },
          { position: 2, text: "Steg den langsomt." },
        ],
        imageUrls: ["https://www.dk-kogebogen.dk/image.jpg"],
        categories: ["Hovedret", "Dansk"],
        cuisines: [],
        keywords: ["Lam", "Påske"],
        nutrition: { calories: "300 kcal" },
      } },
    });
  });
});
