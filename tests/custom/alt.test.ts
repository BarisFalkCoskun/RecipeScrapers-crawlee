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
});
