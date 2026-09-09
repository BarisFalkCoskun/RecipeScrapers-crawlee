import { describe, expect, it } from "vitest";
import { extractAltRecipe } from "../../src/custom/alt.js";

describe("ALT HTML adapter", () => {
  it("extracts current factbox ingredients and sibling method paragraphs", () => {
    const html = `<html><head><meta name="description" content="En frisk salat.">
      <meta property="og:image" content="/salat.jpg"></head>
      <body class="site_alt pagestyle_recipe"><h1>Græsk salat</h1><h2>Til 4 personer</h2>
      <div class="content"><h2>Ingredienser</h2><div class="fact"><h3>Salat</h3><ul>
      <li>1 dåse kikærter</li><li>400 g tomater</li></ul></div></div>
      <h2>Fremgangsmåde</h2><h3>Salat</h3><p>Dræn kikærterne og skær tomaterne.</p>
      <p>Vend salaten sammen og servér straks.</p><article></article></body></html>`;
    expect(extractAltRecipe(html, "https://www.alt.dk/mad/graesk-salat/123"))
      .toMatchObject({ recipe: { normalized: {
        title: "Græsk salat",
        description: "En frisk salat.",
        ingredients: ["1 dåse kikærter", "400 g tomater"],
        instructions: [
          { position: 1, text: "Dræn kikærterne og skær tomaterne." },
          { position: 2, text: "Vend salaten sammen og servér straks." },
        ],
        yieldText: "4",
        imageUrls: ["https://www.alt.dk/salat.jpg"],
      } } });
  });

  it("takes prep, cook and total from the page's Recipe JSON-LD", () => {
    // alt states no ingredients in its JSON-LD, which is why this extractor
    // reads the DOM - but it does state the times there, and reading only the
    // DOM left them empty on every record while legacy had them on 123 of 133.
    const html = `<html><head>
      <script type="application/ld+json">{"@type":"Recipe","name":"Lagkage",
        "prepTime":"PT10M","cookTime":"PT5M","totalTime":"PT15M","recipeIngredient":[]}</script>
      </head>
      <body class="site_alt pagestyle_recipe"><h1>Lagkage</h1><h2>Til 8 personer</h2>
      <div class="content"><h2>Ingredienser</h2><div class="fact"><ul>
      <li>3 lagkagebunde</li></ul></div></div>
      <h2>Fremgangsmåde</h2><p>Saml lagkagen.</p><article></article></body></html>`;
    expect(extractAltRecipe(html, "https://www.alt.dk/mad/lagkage/1"))
      .toMatchObject({ recipe: { normalized: {
        prepMinutes: 10, cookMinutes: 5, totalMinutes: 15, yieldText: "8",
      } } });
  });

  it("falls back to the rendered total when the JSON-LD omits it", () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@type":"Recipe","name":"Bolle",
        "recipeIngredient":[]}</script>
      </head>
      <body class="site_alt pagestyle_recipe"><h1>Bolle</h1>
      <div class="content"><h2>Ingredienser</h2><div class="fact"><ul>
      <li>25 g gær</li></ul></div></div>
      <span class="recipe-total-time">1 time 30 minutter</span>
      <h2>Fremgangsmåde</h2><p>Bag bollerne.</p><article></article></body></html>`;
    expect(extractAltRecipe(html, "https://www.alt.dk/mad/bolle/2"))
      .toMatchObject({ recipe: { normalized: { totalMinutes: 90 } } });
  });
});
