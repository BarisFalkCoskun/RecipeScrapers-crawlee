import { describe, expect, it } from "vitest";
import { extractShopifyBlogRecipe } from "../../src/custom/shopify-blog.js";

describe("Shopify blog recipe adapters", () => {
  it("extracts Vinpusheren's sequential article contract", () => {
    const html = `<html><head><meta property="og:image" content="/steg.jpg"></head><body>
      <h1>Oksegryde</h1><div class="article-template__content">
        <p>En varm <a href="/vin">gryderet</a> til vinter.</p><p>4 personer – Arbejdstid: 30 min</p>
        <p>500 g oksekød</p><p>2 løg</p><h2>Fremgangsmåde</h2>
        <p>1. Brun kødet.</p><p>2. Lad retten simre.</p><h2>Vin:</h2>
      </div></body></html>`;
    expect(extractShopifyBlogRecipe({
      sourceId: "vinpusheren",
      html,
      canonicalUrl: "https://vinpusheren.dk/blogs/blog/oksegryde",
    })).toMatchObject({
      incompleteCount: 0,
      malformedCount: 0,
      recipe: { normalized: {
        title: "Oksegryde",
        description: "En varm gryderet til vinter.",
        ingredients: ["500 g oksekød", "2 løg"],
        instructions: [
          { position: 1, text: "Brun kødet." },
          { position: 2, text: "Lad retten simre." },
        ],
        yieldText: "4 personer",
        totalMinutes: 30,
        imageUrls: ["https://vinpusheren.dk/steg.jpg"],
      } },
    });
  });

  it("extracts Hvidløg & Vin's ingredient-to-prose transition", () => {
    const html = `<html><head><meta property="og:image" content="https://hvidlog-vin.dk/suppe.jpg"></head><body>
      <h1>Hvidløg & Vin</h1><div class="article-page"><h1 class="article-page__heading">Tomatsuppe</h1>
        <noscript>&lt;img src="fallback.jpg"&gt;</noscript>
        <p>500 g tomater</p><p>1-2 fed hvidløg</p>
        <p>Hak grøntsagerne fint.</p><p>Kog suppen i 20 minutter.</p><span>Del:</span>
      </div></body></html>`;
    expect(extractShopifyBlogRecipe({
      sourceId: "hvidlogvin",
      html,
      canonicalUrl: "https://hvidlog-vin.dk/blogs/artikler/tomatsuppe",
    })).toMatchObject({
      incompleteCount: 0,
      recipe: { normalized: {
        title: "Tomatsuppe",
        ingredients: ["500 g tomater", "1-2 fed hvidløg"],
        instructions: [
          { position: 1, text: "Hak grøntsagerne fint." },
          { position: 2, text: "Kog suppen i 20 minutter." },
        ],
      } },
    });
  });

  it("extracts Hej Holger's table and ordered method contract", () => {
    const html = `<html><head><meta property="og:image" content="/pasta.jpg"></head><body>
      <h1>Grøn pasta</h1><article><h2>Opskrift på grøn pasta</h2><p>En nem ret.</p>
      <h3>Antal</h3><p>4 personer</p><h3>Tid</h3><p>1 time 15 minutter</p>
      <table><tr><th>Ingrediens</th><th>Mængde</th></tr>
        <tr><td>Pasta</td><td>400 g</td></tr><tr><td>Spinat</td><td>200 g</td></tr></table>
      <h2>Sådan gør du</h2><ol><li>Kog pastaen.</li><li>Vend spinaten i.</li></ol>
      <h2>Tips</h2></article></body></html>`;
    expect(extractShopifyBlogRecipe({
      sourceId: "hejholger",
      html,
      canonicalUrl: "https://hejholger.dk/blogs/opskrift/gron-pasta",
    })).toMatchObject({ recipe: { normalized: {
      title: "Grøn pasta",
      description: "En nem ret.",
      ingredients: ["Pasta 400 g", "Spinat 200 g"],
      instructions: [
        { position: 1, text: "Kog pastaen." },
        { position: 2, text: "Vend spinaten i." },
      ],
      yieldText: "4",
      totalMinutes: 75,
      imageUrls: ["https://hejholger.dk/pasta.jpg"],
    } } });
  });

  it("extracts Monday Bliss sections, servings, and prose steps", () => {
    const html = `<html><head>
      <meta name="description" content="En frisk servering.">
      <meta property="og:image" content="/asparges.jpg"></head><body>
      <article><span>Læser nu:</span><h1>Asparges med laks</h1><span>Forrige</span>
      <h2>Asparges med laks</h2><p>Opskriften er til en person.</p>
      <p>•</p><p>1 bundt asparges</p><p>Lidt olie</p><h3>PESTO</h3>
      <p>1 bundt koriander</p><p>2 spsk olie</p><p>(2 portioner)</p>
      <h2>FREMGANGSMÅDE</h2><p>1. Blend pestoen.</p><p>2. Steg aspargesene.</p>
      </article></body></html>`;
    expect(extractShopifyBlogRecipe({
      sourceId: "mondaybliss",
      html,
      canonicalUrl: "https://mondaybliss.dk/blogs/madopskrifter/asparges-med-laks",
    })).toMatchObject({ recipe: { normalized: {
      title: "Asparges med laks",
      description: "En frisk servering.",
      ingredients: ["1 bundt asparges", "Lidt olie", "1 bundt koriander", "2 spsk olie"],
      instructions: [
        { position: 1, text: "Blend pestoen." },
        { position: 2, text: "Steg aspargesene." },
      ],
      yieldText: "1 pers",
      imageUrls: ["https://mondaybliss.dk/asparges.jpg"],
      categories: ["Madopskrifter"],
    } } });
  });

});
