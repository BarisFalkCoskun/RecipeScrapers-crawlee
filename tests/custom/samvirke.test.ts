import { describe, expect, it } from "vitest";
import { extractSamvirkeRecipe } from "../../src/custom/samvirke.js";

describe("Samvirke article-body adapter", () => {
  const page = (rows: string, steps: string) => `<html><body>
    <div class="article-header"><img src="/media/kage.jpg"></div>
    <h1>Julemuffins</h1>
    <p class="article-header--summary">Små muffins med marcipan.</p>
    <span class="recipe-details--item--servings">6 Personer</span>
    <a class="recipe-full--topic-link">BAGVÆRK</a>
    <div class="ingredients recipe-full--ingredients unit--margin">
      <table>${rows}</table></div>
    <ol class="how-to--steps">${steps}</ol></body></html>`;

  it("reads the markup legacy reads, without repeating the nested note", () => {
    // The note element sits inside the name cell, so the name's text already
    // carries it. Taking the note as a third part repeated it - on 1737 of
    // samvirke's 1945 records - and legacy joins only amount and name. An
    // ingredient with no quantity states its amount as a single dash, which
    // legacy drops rather than storing "- salt".
    const html = page(
      `<tr><td class="ingredients--amount">200 g</td><td class="ingredients--name">smør</td></tr>
       <tr><td class="ingredients--amount">2 spsk.</td>
           <td class="ingredients--name">æbleeddike <span class="ingredients--note">eller hvidvinseddike</span></td></tr>
       <tr><td class="ingredients--amount">-</td><td class="ingredients--name">salt</td></tr>`,
      `<li>1 Rør smør og sukker blødt.</li><li>2 Bag muffins i 20 minutter.</li>`
    );

    expect(extractSamvirkeRecipe(html, "https://samvirke.dk/opskrifter/julemuffins"))
      .toMatchObject({ recipe: { normalized: {
        title: "Julemuffins",
        description: "Små muffins med marcipan.",
        yieldText: "6",
        categories: ["BAGVÆRK"],
        ingredients: ["200 g smør", "2 spsk. æbleeddike eller hvidvinseddike", "salt"],
        instructions: [
          { position: 1, text: "Rør smør og sukker blødt." },
          { position: 2, text: "Bag muffins i 20 minutter." },
        ],
        imageUrls: ["https://samvirke.dk/media/kage.jpg"],
      } } });
  });

  it("refuses a page with no ingredient table rather than storing a title", () => {
    const html = page("", `<li>1 Bag den.</li>`);
    expect(extractSamvirkeRecipe(html, "https://samvirke.dk/opskrifter/tom"))
      .toEqual({ incompleteCount: 1, malformedCount: 0 });
  });
});
