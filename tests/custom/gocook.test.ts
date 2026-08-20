import { describe, expect, it } from "vitest";
import { extractGocookRecipe } from "../../src/custom/gocook.js";

describe("GoCook composite adapter", () => {
  it("combines JSON-LD metadata with numbered HTML method steps", () => {
    const html = `<html><body><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Tomatsuppe",
      description: "En nem suppe.",
      recipeIngredient: ["500 g tomater", "1 løg"],
      recipeYield: "4 personer",
      prepTime: "PT10M",
      totalTime: "PT40M",
      image: { url: "https://gocook.dk/suppe.jpg" },
      nutrition: { calories: "200 kcal", proteinContent: "8 g" },
    })}</script><nav class="breadcrumb"><a>Hjem</a><a>Supper</a></nav>
      <div>Sværhedsgrad: Nem</div><h2>Sådan gør du</h2>
      <span>1</span><p>Hak løget fint.</p><span>2.</span><p>Kog suppen mør.</p>
      <h2>Næringsindhold</h2></body></html>`;
    expect(extractGocookRecipe(html, "https://gocook.dk/opskrift/tomatsuppe"))
      .toMatchObject({ recipe: { normalized: {
        title: "Tomatsuppe",
        ingredients: ["500 g tomater", "1 løg"],
        instructions: [
          { position: 1, text: "Hak løget fint." },
          { position: 2, text: "Kog suppen mør." },
        ],
        prepMinutes: 10,
        totalMinutes: 40,
        yieldText: "4",
        imageUrls: ["https://gocook.dk/suppe.jpg"],
        categories: ["Supper"],
        keywords: ["Nem"],
      } } });
  });

  it("rejects metadata without visible numbered instructions", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Recipe", name: "Suppe", recipeIngredient: ["1 løg"],
    })}</script>`;
    expect(extractGocookRecipe(html, "https://gocook.dk/opskrift/suppe"))
      .toEqual({ incompleteCount: 1, malformedCount: 0 });
  });

  it("extracts GoCook's current responsive step rows", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Recipe", name: "Pasta", recipeIngredient: ["200 g pasta"],
      recipeYield: "4 personer",
    })}</script><div><p class="mb-0"><span>1.</span></p><div class="special-step">
      <p>Vask hænder.</p><span>Se videoen.</span></div></div>
      <div><p class="mb-0"><span>2.</span></p><div class="inner">
      <div class="person persons-4">Kog pastaen.</div>
      <div class="person persons-6">Kog mere pasta.</div></div></div>`;
    expect(extractGocookRecipe(html, "https://gocook.dk/opskrift/pasta"))
      .toMatchObject({ recipe: { normalized: { instructions: [
        { position: 1, text: "Vask hænder." },
        { position: 2, text: "Kog pastaen." },
      ] } } });
  });
});
