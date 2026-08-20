import { describe, expect, it } from "vitest";
import {
  extractNipuniJulieRecipe,
  extractTheFoodClubRecipe,
} from "../../src/custom/legacy-body-recipes.js";

describe("legacy WordPress body recipe adapters", () => {
  it("extracts Nipuni Julie's servings-led body layout", () => {
    const result = extractNipuniJulieRecipe(`
      <html><head><meta property="og:image" content="/cake.jpg"></head><body>
      <h1>Brownie</h1><div class="entry-content">
        <p>Min bedste brownie.</p><p>Brownie (ca. 8 personer)</p>
        <p>INGREDIENSER</p><p>200 g smør</p><p>3 æg</p>
        <p>Smelt smørret og rør dejen godt sammen.</p><p>Bag kagen til den er færdig.</p>
        <p>2 comments</p>
      </div></body></html>
    `, "https://nipunijulie.dk/brownie/");
    expect(result).toMatchObject({ recipe: { normalized: {
      title: "Brownie",
      description: "Min bedste brownie.",
      yieldText: "8",
      ingredients: ["200 g smør", "3 æg"],
      instructions: [
        { position: 1, text: "Smelt smørret og rør dejen godt sammen." },
        { position: 2, text: "Bag kagen til den er færdig." },
      ],
      imageUrls: ["https://nipunijulie.dk/cake.jpg"],
    } } });
  });

  it("matches Nipuni Julie's legacy handling of parenthetical-only notes", () => {
    const result = extractNipuniJulieRecipe(`
      <html><body><h1>Rabarberkage</h1><div class="entry-content">
        <p>Kage (8 personer)</p><p>KAGE</p><p>100 g smør</p>
        <p>(kan undlades)</p><p>Rør smørret sammen med sukkeret.</p>
        <p>KOMPOT</p><p>300 g rabarber</p><p>(den du har gemt fra kagen)</p>
        <p>Kog rabarberne til en blød kompot.</p>
      </div></body></html>
    `, "https://nipunijulie.dk/rabarberkage/");

    expect(result.recipe?.normalized.ingredients).toEqual(["100 g smør", "300 g rabarber"]);
    expect(result.recipe?.normalized.instructions.map((step) => step.text)).toEqual([
      "Rør smørret sammen med sukkeret.",
      "(den du har gemt fra kagen)",
      "Kog rabarberne til en blød kompot.",
    ]);
  });

  it("extracts The Food Club's paragraph layout", () => {
    const result = extractTheFoodClubRecipe(`
      <html><head><meta property="og:image" content="/muffin.jpg"></head><body>
      <h1 class="post-title">Muffins med chokolade</h1>
      <div class="post-entry"><div class="inner-post-entry">
        <p>De bedste muffins.</p><p>Opskrift til 8 muffins:</p>
        <p>100 g smør<br>2 æg<br>200 g mel<br>100 g chokolade</p>
        <p>Rør alle ingredienserne sammen og fordel dejen i forme.</p>
      </div></div><div class="penci-standard-cat"><span class="penci-cat-name">Kage</span></div>
      </body></html>
    `, "https://thefoodclub.dk/muffins/");
    expect(result).toMatchObject({ recipe: { normalized: {
      title: "Muffins med chokolade",
      description: "De bedste muffins.",
      yieldText: "8",
      ingredients: ["100 g smør", "2 æg", "200 g mel", "100 g chokolade"],
      instructions: [{ position: 1, text: "Rør alle ingredienserne sammen og fordel dejen i forme." }],
      imageUrls: ["https://thefoodclub.dk/muffin.jpg"],
      categories: ["Kage"],
    } } });
  });
});
