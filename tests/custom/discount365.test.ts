import { describe, expect, it } from "vitest";
import { extractDiscount365Recipes } from "../../src/custom/discount365.js";

const roundupHtml = `<html><head><meta property="og:title" content="Tre nemme retter - 365discount"></head><body><main>
  <div class="componentImage"><img class="rounded-sm" src="/mad.jpg"></div>
  <div class="text-container"><h2>Sprøde falafler</h2><p>Ingredienser (2 personer)</p>
    <p>1 dåse kikærter</p><p>2 fed hvidløg</p><h3>Fremgangsmåde</h3>
    <p>1. Blend kikærterne grundigt med hvidløg og krydderier.</p></div>
  <div class="text-container"><h2>Grøn coleslaw</h2><p>Det skal du bruge til 4 personer</p>
    <p>1 spidskål</p><p>2 æbler</p><h3>Sådan gør du</h3>
    <p>1. Snit kålen fint og vend den med æbler.</p></div>
</main></body></html>`;

describe("365discount HTML adapter", () => {
  it("emits every complete roundup recipe with deterministic fragment identities", () => {
    const result = extractDiscount365Recipes(
      roundupHtml,
      "https://365discount.coop.dk/inspiration/opskrifter/tre-retter/"
    );

    expect(result.recipes).toHaveLength(2);
    expect(result.recipes?.map((recipe) => recipe.canonicalUrl)).toEqual([
      "https://365discount.coop.dk/inspiration/opskrifter/tre-retter#sprde-falafler",
      "https://365discount.coop.dk/inspiration/opskrifter/tre-retter#grn-coleslaw",
    ]);
    expect(result.recipes?.map((recipe) => recipe.normalized.title)).toEqual([
      "Sprøde falafler",
      "Grøn coleslaw",
    ]);
    expect(result.recipes?.[0]?.normalized).toMatchObject({
      yieldText: "2 pers",
      imageUrls: ["https://365discount.coop.dk/mad.jpg"],
      instructions: [{ position: 1, text: "Blend kikærterne grundigt med hvidløg og krydderier." }],
    });
  });

  it("keeps a normal single recipe on the page canonical and extracts its intro", () => {
    const html = `<html><head><meta property="og:title" content="Pasta med tomat - 365discount"></head><body><main>
      <div class="text-container"><p>En dejlig pastaret, som hele familien kan nyde.</p></div>
      <div class="text-container"><h2>Ingredienser (2 personer)</h2><p>250 g pasta</p><p>2 tomater</p></div>
      <div class="text-container"><h2>Fremgangsmåde</h2><p>1. Kog pastaen og vend den sammen med tomater.</p></div>
    </main></body></html>`;
    const result = extractDiscount365Recipes(
      html,
      "https://365discount.coop.dk/inspiration/opskrifter/pasta-med-tomat"
    );

    expect(result.recipe?.canonicalUrl).toBe(
      "https://365discount.coop.dk/inspiration/opskrifter/pasta-med-tomat"
    );
    expect(result.recipe?.normalized).toMatchObject({
      title: "Pasta med tomat",
      description: "En dejlig pastaret, som hele familien kan nyde.",
      ingredients: ["250 g pasta", "2 tomater"],
      yieldText: "2 pers",
    });
  });
});
