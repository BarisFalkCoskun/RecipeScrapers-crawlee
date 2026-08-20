import { describe, expect, it } from "vitest";
import { extractFeminaRecipe } from "../../src/custom/femina.js";

describe("Femina HTML adapter", () => {
  it("extracts WYSIWYG ingredient and method paragraphs", () => {
    const html = `<html><head><meta name="description" content="Nem aftensmad.">
      <meta property="og:image" content="/pasta.jpg"></head><body><h1>Grøn pasta</h1>
      <div class="wysiwyg"><p>Opskriften er til 4 personer</p><p>INGREDIENSER:</p>
      <p>400 g pasta<br>Olie til stegning<br>Salt</p><p>FREMGANGSMÅDE</p>
      <p>1. Kog pastaen helt mør.</p><p>2. Vend pastaen med olie og salt.</p>
      <p>Få indkøbslisten til hele ugen her</p></div></body></html>`;
    expect(extractFeminaRecipe(
      html,
      "https://www.femina.dk/mad/gron-pasta"
    )).toMatchObject({ recipe: { normalized: {
      title: "Grøn pasta",
      description: "Nem aftensmad.",
      ingredients: ["400 g pasta", "Olie til stegning", "Salt"],
      instructions: [
        { position: 1, text: "Kog pastaen helt mør." },
        { position: 2, text: "Vend pastaen med olie og salt." },
      ],
      yieldText: "4",
      imageUrls: ["https://www.femina.dk/pasta.jpg"],
      categories: ["Mad"],
    } } });
  });

  it("rejects editorial pages without a complete recipe", () => {
    expect(extractFeminaRecipe(
      `<h1>Madplan</h1><div class="wysiwyg"><p>Læs ugens plan her.</p></div>`,
      "https://www.femina.dk/mad/madplan"
    )).toEqual({ incompleteCount: 1, malformedCount: 0 });
  });
});
