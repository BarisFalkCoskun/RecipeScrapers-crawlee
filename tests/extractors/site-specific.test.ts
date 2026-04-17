import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { extractSiteSpecificRecipe } from "../../src/extractors/site-specific.js";

function $(html: string) {
  return cheerio.load(html);
}

describe("extractSiteSpecificRecipe", () => {
  it("extracts an Arla-style recipe", () => {
    const html = `<html><body>
      <h1>Upside down butterdejstærter</h1>
      <div>45 min</div>
      <p>Her får du opskriften på små og lækre butterdejstærter.</p>
      <p>De små tærter er perfekte som snacks.</p>
      <h2>Ingredienser</h2>
      <p>300 g Blandede grøntsager</p>
      <p>450 g Butterdej</p>
      <h2>Sådan gør du</h2>
      <ul>
        <li>Skær grøntsager ud i tynde skiver.</li>
        <li>Bag tærterne i 15-18 min.</li>
      </ul>
    </body></html>`;
    const result = extractSiteSpecificRecipe($(html), "www.arla.dk");
    expect(result?.signals).toContain("site-specific-arla");
    expect(result?.recipes[0]?.["name"]).toBe("Upside down butterdejstærter");
    expect(result?.recipes[0]?.["totalTime"]).toBe("45 min");
    expect(result?.recipes[0]?.["recipeIngredient"]).toEqual([
      "300 g Blandede grøntsager",
      "450 g Butterdej",
    ]);
  });

  it("extracts a Madens Verden-style recipe", () => {
    const html = `<html><body>
      <h1>Omelet (nem og klassisk opskrift på omelette)</h1>
      <div>Forb. tid: 5 minutter min</div>
      <div>Tilb. tid: 10 minutter min</div>
      <div>Samlet tid: 15 minutter min</div>
      <p>Prøv denne enkle opskrift på en klassisk omelet.</p>
      <div>Antal: 1</div>
      <div>Ret: Morgenmad</div>
      <div>Køkken: Dansk</div>
      <h2>Ingredienser</h2>
      <ul>
        <li>▢ 2 æg</li>
        <li>▢ 2 spsk vand</li>
      </ul>
      <h2>Fremgangsmåde</h2>
      <ol>
        <li>Slå 2 æg ud i en skål.</li>
        <li>Rør æggemassen rundt med en gaffel.</li>
      </ol>
    </body></html>`;
    const result = extractSiteSpecificRecipe($(html), "madensverden.dk");
    expect(result?.signals).toContain("site-specific-madensverden");
    expect(result?.recipes[0]?.["prepTime"]).toBe("5 minutter min");
    expect(result?.recipes[0]?.["cookTime"]).toBe("10 minutter min");
    expect(result?.recipes[0]?.["recipeYield"]).toBe("1");
    expect(result?.recipes[0]?.["recipeCategory"]).toBe("Morgenmad");
    expect(result?.recipes[0]?.["recipeCuisine"]).toBe("Dansk");
  });

  it("extracts a Spis Bedre recipe from embedded page data", () => {
    const pageData = JSON.stringify({
      component: "app/pages/Recipes/Details",
      props: {
        recipe: {
          title: "Kylling i wok med edamamebønner og peanutbuttersauce",
          description: "Kylling i wok er en hverdagsfavorit.",
          preparation_time: 20,
          total_time: 20,
          serving_size: 4,
          serving_size_type: {
            name_singular: "person",
            name_plural: "personer",
          },
          author: "Emma Martiny",
          tip_message:
            "Gør retten vegetarisk ved at udelade kylling og fordoble bønnerne.",
          grouped_ingredients: [
            {
              ingredients: [
                {
                  amount: 100,
                  ingredient_inflection: "singular",
                  suffix: "eller kyllingebryst",
                  ingredient: {
                    name_singular: "kyllingeinderfilet",
                    name_plural: "kyllingeinderfileter",
                  },
                  unit: {
                    name_singular: "gram",
                    name_plural: "gram",
                    abbreviation: "g",
                  },
                },
                {
                  amount: 0.5,
                  ingredient_inflection: "default",
                  ingredient: {
                    name_singular: "peanutbutter",
                    name_plural: "peanutbutter",
                  },
                  unit: {
                    name_singular: "spiseske",
                    name_plural: "spiseskeer",
                    abbreviation: "spsk.",
                  },
                },
              ],
            },
          ],
          grouped_instructions: [
            {
              instructions: [
                {
                  instruction: "Skær kyllingekødet i mindre stykker.",
                },
                {
                  instruction: "Top wokretten med peanuts og koriander.",
                },
              ],
            },
          ],
        },
      },
    }).replace(/"/g, "&quot;");

    const html = `<html><body>
      <div id="app" data-page="${pageData}"></div>
    </body></html>`;

    const result = extractSiteSpecificRecipe($(html), "spisbedre.dk");
    expect(result?.signals).toContain("site-specific-spisbedre");
    expect(result?.recipes[0]?.["name"]).toBe(
      "Kylling i wok med edamamebønner og peanutbuttersauce"
    );
    expect(result?.recipes[0]?.["prepTime"]).toBe("20 min");
    expect(result?.recipes[0]?.["totalTime"]).toBe("20 min");
    expect(result?.recipes[0]?.["recipeYield"]).toBe("4 personer");
    expect(result?.recipes[0]?.["author"]).toBe("Emma Martiny");
    expect(result?.recipes[0]?.["recipeIngredient"]).toEqual([
      "100 g kyllingeinderfilet eller kyllingebryst",
      "0.5 spsk. peanutbutter",
    ]);
    expect(result?.recipes[0]?.["recipeInstructions"]).toEqual([
      "Skær kyllingekødet i mindre stykker.",
      "Top wokretten med peanuts og koriander.",
    ]);
  });

  it("extracts a dk-kogebogen-style recipe from text sections", () => {
    const html = `<html><body>
      <h1>Engelsk kage</h1>
      <div>Antal: 1</div>
      <div>Ret : Kager i form - Diverse kager i form</div>
      <div>Oprindelsesland : England</div>
      <div>Ingredienser:<br>125 g. margarine<br>125 g. sukker<br>1 æg</div>
      <div>Opskrift:<br>Margarine og sukker røres hvidt med ægget.<br>Dejen hældes i en smurt form og bages ved 175 grader i ca 1 time.</div>
      <div>karakterer:</div>
    </body></html>`;
    const result = extractSiteSpecificRecipe($(html), "www.dk-kogebogen.dk");
    expect(result?.signals).toContain("site-specific-dk-kogebogen");
    expect(result?.recipes[0]?.["recipeYield"]).toBe("1");
    expect(result?.recipes[0]?.["recipeCuisine"]).toBe("England");
    expect(result?.recipes[0]?.["recipeIngredient"]).toEqual([
      "125 g. margarine",
      "125 g. sukker",
      "1 æg",
    ]);
    expect(result?.recipes[0]?.["recipeInstructions"]).toEqual([
      "Margarine og sukker røres hvidt med ægget.",
      "Dejen hældes i en smurt form og bages ved 175 grader i ca 1 time.",
    ]);
  });
});
