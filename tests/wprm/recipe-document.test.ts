import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildWprmRecipeDocumentV2,
  extractWprmRecipes,
  parseWprmApiResponseBody,
} from "../../src/wprm/recipe-document.js";

const fixture = JSON.parse(
  readFileSync(new URL("../fixtures/wprm-recipe.json", import.meta.url), "utf8")
) as unknown[];

describe("WPRM API recipe extraction", () => {
  it("maps a real WPRM payload into the normalized recipe shape", () => {
    const result = extractWprmRecipes(fixture);

    expect(result.malformedCount).toBe(0);
    expect(result.incompleteCount).toBe(0);
    expect(result.recipes).toHaveLength(1);

    const [recipe] = result.recipes;
    expect(recipe.canonicalUrl).toBe("https://www.dadwithapan.com/zesty-cowboy-butter-recipe/");
    expect(recipe.normalized.title).toBe("Cowboy Butter");
    expect(recipe.normalized.description).not.toContain("<p>");
    // Ingredients arrive grouped, and each carries amount, unit, name and notes
    // as separate fields that have to be rejoined into one readable line.
    expect(recipe.normalized.ingredients[0]).toBe(
      "1 cup unsalted butter (softened (2 sticks))"
    );
    expect(recipe.normalized.ingredients.length).toBeGreaterThan(1);
    expect(recipe.normalized.instructions[0]).toMatchObject({
      position: 1,
      text: expect.stringMatching(/^Let the butter sit at room temperature/u),
    });
    expect(recipe.normalized.prepMinutes).toBe(5);
    expect(recipe.normalized.yieldText).toBe("8 servings");
  });

  it("reads JSON rendered by Chromium inside a pre element", () => {
    const escapedJson = JSON.stringify(fixture)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    const body = `<html><body><pre>${escapedJson}</pre></body></html>`;

    expect(parseWprmApiResponseBody(body)).toEqual(fixture);
    expect(parseWprmApiResponseBody("not-json")).toBeUndefined();
  });

  it("builds a stable source-scoped V2 document", () => {
    const recipe = extractWprmRecipes(fixture).recipes[0];
    const input = {
      sourceId: "fixture",
      crawlRunId: "run-1",
      crawlAttemptId: "attempt-1",
      apiPageUrl: "https://example.dk/wp-json/wp/v2/wprm_recipe?page=1",
      extractedAt: new Date("2026-08-19T12:00:00.000Z"),
      recipe,
      language: "da",
      languageConfidence: 0.9,
      languageSignals: ["fixture"],
      extractorVersion: "2.0.0",
      extractionSignals: ["wprm-rest-api"],
    };
    const document = buildWprmRecipeDocumentV2(input);
    const updated = buildWprmRecipeDocumentV2({
      ...input,
      recipe: {
        ...recipe,
        rawRecipe: { ...recipe.rawRecipe, ingredients: [] },
      },
    });

    expect(document).toMatchObject({
      sourceId: "fixture",
      extractionMethod: "wprm-api",
      canonicalUrl: recipe.canonicalUrl,
      pageUrl: input.apiPageUrl,
    });
    expect(document.sourceRecipeKey).toMatch(/^fixture:/u);
    expect(updated.sourceRecipeKey).toBe(document.sourceRecipeKey);
    expect(document.rawRecipe).not.toBe(recipe.rawRecipe);
  });

  it("preserves the API object as rawRecipe rather than the normalized copy", () => {
    const [recipe] = extractWprmRecipes(fixture).recipes;

    // The strict contract keeps exactly what the source served.
    expect(recipe.rawRecipe).toEqual((fixture[0] as { recipe: unknown }).recipe);
  });

  it("does not double the separator on a heading that already ends in one", () => {
    const post = JSON.parse(JSON.stringify(fixture[0])) as Record<string, any>;
    post.recipe.instructions = [
      { name: "", instructions: [
        { name: "Soak Fruit:", text: "Finely chop the prunes." },
        { name: "Melt Fats", text: "Stir together the milk and butter." },
      ] },
    ];

    const [recipe] = extractWprmRecipes([post]).recipes;

    // WPRM headings are authored with and without a trailing colon, and the
    // rendered recipe shows one separator either way.
    expect(recipe.normalized.instructions[0].text).toBe("Soak Fruit: Finely chop the prunes.");
    expect(recipe.normalized.instructions[1].text).toBe("Melt Fats: Stir together the milk and butter.");
  });

  it("rejects a recipe missing any of name, ingredients or instructions", () => {
    const base = JSON.parse(JSON.stringify(fixture[0])) as Record<string, any>;
    const withoutName = JSON.parse(JSON.stringify(base));
    withoutName.recipe.name = "";
    const withoutIngredients = JSON.parse(JSON.stringify(base));
    withoutIngredients.recipe.ingredients = [];
    const withoutInstructions = JSON.parse(JSON.stringify(base));
    withoutInstructions.recipe.instructions = [];

    const result = extractWprmRecipes([withoutName, withoutIngredients, withoutInstructions]);

    expect(result.recipes).toEqual([]);
    expect(result.incompleteCount).toBe(3);
  });

  it("reports a payload that is not an array of posts as malformed", () => {
    expect(extractWprmRecipes({ code: "rest_no_route" }).malformedCount).toBe(1);
    expect(extractWprmRecipes([{ id: 1 }]).malformedCount).toBe(1);
  });

  it("skips a post whose link is missing rather than inventing one", () => {
    const post = JSON.parse(JSON.stringify(fixture[0])) as Record<string, any>;
    delete post.link;

    const result = extractWprmRecipes([post]);

    expect(result.recipes).toEqual([]);
    expect(result.malformedCount).toBe(1);
  });

  it("orders taxonomy terms by name so two runs store the same record", () => {
    // The WordPress API does not guarantee an order for a taxonomy's terms.
    // giangiskitchen returned the same keywords in a different sequence on
    // consecutive requests, which made 473 of its 549 records look changed
    // between two runs that had extracted exactly the same data.
    const term = (name: string) => ({ name, slug: name.toLowerCase() });
    const withTags = (keyword: string[], course: string[], cuisine: string[]) => {
      const entry = structuredClone(fixture[0]) as Record<string, any>;
      entry.recipe.tags = {
        keyword: keyword.map(term),
        course: course.map(term),
        cuisine: cuisine.map(term),
      };
      return [entry];
    };

    const [first] = extractWprmRecipes(
      withTags(["lemon", "chives", "appetizer", "butter"], ["Frokost", "Forret"], ["Italiensk", "Dansk"])
    ).recipes;
    const [second] = extractWprmRecipes(
      withTags(["butter", "lemon", "appetizer", "chives"], ["Forret", "Frokost"], ["Dansk", "Italiensk"])
    ).recipes;

    expect(first.normalized.keywords).toEqual(["appetizer", "butter", "chives", "lemon"]);
    expect(first.normalized.categories).toEqual(["Forret", "Frokost"]);
    expect(first.normalized.cuisines).toEqual(["Dansk", "Italiensk"]);
    // Whatever order the API used, the stored record is the same.
    expect(second.normalized.keywords).toEqual(first.normalized.keywords);
    expect(second.normalized.categories).toEqual(first.normalized.categories);
    expect(second.normalized.cuisines).toEqual(first.normalized.cuisines);
  });


  it("removes a zero-width character rather than letting it become a space", () => {
    // krumpli writes "A\uFEFFdd a lid" inside an instruction. The character is
    // invisible but matches \s, so collapsing whitespace turned it into the
    // visibly broken "A dd".
    const entry = structuredClone(fixture[0]) as Record<string, any>;
    entry.recipe.instructions = [
      { name: "", instructions: [{ text: "<p>Pour over the stock.</p><p>A\uFEFFdd a lid and cook.</p>" }] },
    ];

    const [recipe] = extractWprmRecipes([entry]).recipes;

    // The paragraph boundary becomes a space, so the two sentences stay apart;
    // the point of this case is that "Add" survives intact rather than being
    // split into "A dd" by the zero-width character inside it.
    expect(recipe.normalized.instructions[0].text).toBe("Pour over the stock. Add a lid and cook.");
    expect(recipe.normalized.instructions[0].text).not.toContain("A dd");
  });


  it("renders ingredient markup down so a per-request id cannot destabilise it", () => {
    // connoisseurusveg links an ingredient through an affiliate plugin that
    // mints a fresh data-lasso-id on every request. Storing the raw anchor made
    // the record differ between two crawls of identical data.
    const entry = structuredClone(fixture[0]) as Record<string, any>;
    const withId = (id: string) => {
      const e = structuredClone(entry) as Record<string, any>;
      e.recipe.ingredients = [{ name: "", ingredients: [{
        amount: "1",
        unit: "",
        name: `vegan double pie crust, (one batch of my <a href="https://x.test/crust/" data-lasso-id="${id}">vegan pie crust</a>)`,
        notes: "",
      }] }];
      return [e];
    };

    const [first] = extractWprmRecipes(withId("38248")).recipes;
    const [second] = extractWprmRecipes(withId("38649")).recipes;

    expect(first.normalized.ingredients[0]).not.toContain("data-lasso-id");
    expect(first.normalized.ingredients[0]).not.toContain("<a ");
    expect(first.normalized.ingredients[0])
      .toBe("1 vegan double pie crust, (one batch of my vegan pie crust)");
    // The same data crawled twice stores the same record.
    expect(second.normalized.ingredients).toEqual(first.normalized.ingredients);
  });


  it("keeps a block boundary from fusing two sentences", () => {
    // dansktang writes an ingredient note across two paragraphs. Taking the
    // text content directly concatenated them into "lægge det.Stykkerne",
    // which is not what the note says and not what a reader sees on the page.
    const entry = structuredClone(fixture[0]) as Record<string, any>;
    entry.recipe.ingredients = [{ name: "", ingredients: [{
      amount: "4",
      unit: "stk.",
      name: "Sukkertang",
      notes: "så tør det ved at hænge det.</p><p>Stykkerne skal være 10-12 cm lange",
    }] }];

    const [recipe] = extractWprmRecipes([entry]).recipes;

    expect(recipe.normalized.ingredients[0]).toBe(
      "4 stk. Sukkertang (så tør det ved at hænge det. Stykkerne skal være 10-12 cm lange)"
    );
    expect(recipe.normalized.ingredients[0]).not.toContain("det.Stykkerne");
  });

  it("drops an attribute tail that WPRM split off the tag it belonged to", () => {
    // beamingbaker links an ingredient, and the link's title attribute contains a
    // comma - which is what WPRM splits name from notes on. The tag ends up torn
    // in half: name holds '<a class="thirstylink" title="Natural' and notes opens
    // with the rest of the attribute list. Nothing in the notes field is a tag any
    // parser would recognise, so the href, target and rel all read out as if they
    // were part of the ingredient.
    const entry = structuredClone(fixture[0]) as Record<string, any>;
    entry.recipe.ingredients = [{ name: "", ingredients: [{
      amount: "1",
      unit: "cup",
      name: '<a class="thirstylink" title="Natural',
      notes: 'Unsalted Creamy Peanut Butter (Pack of 6)" href="https://beamingbaker.com/'
        + 'recommends/natural-unsalted-creamy-peanut-butter-pack-of-6/" target="_blank" '
        + 'rel="nofollow noopener">unsalted, creamy natural peanut butter</a>',
    }] }];

    const [recipe] = extractWprmRecipes([entry]).recipes;

    expect(recipe.normalized.ingredients[0]).toBe(
      "1 cup (unsalted, creamy natural peanut butter)"
    );
    expect(recipe.normalized.ingredients[0]).not.toContain("href");
    expect(recipe.normalized.ingredients[0]).not.toContain("nofollow");
  });

  it("leaves a note that merely contains a quote and a greater-than alone", () => {
    // The tail is only dropped when it closes an attribute list, so ordinary
    // measurements survive.
    const entry = structuredClone(fixture[0]) as Record<string, any>;
    entry.recipe.ingredients = [{ name: "", ingredients: [{
      amount: "1",
      unit: "cup",
      name: "chopped nuts",
      notes: 'use 2" > 3" pieces',
    }] }];

    const [recipe] = extractWprmRecipes([entry]).recipes;

    expect(recipe.normalized.ingredients[0]).toBe('1 cup chopped nuts (use 2" > 3" pieces)');
  });

  it("does not repeat a step body that the source also put in its name", () => {
    // frommybowl fills a step's name with the body itself and puts the labelled
    // version in text, so prefixing the name wrote the whole instruction twice:
    // "Preheat the oven...: Prep: Preheat the oven...".
    const entry = structuredClone(fixture[0]) as Record<string, any>;
    entry.recipe.instructions = [{ name: "", instructions: [{
      name: "Preheat the oven to 425F.",
      text: "<p><strong>Prep: </strong>Preheat the oven to 425F.</p>",
    }] }];

    const [recipe] = extractWprmRecipes([entry]).recipes;

    expect(recipe.normalized.instructions[0].text).toBe("Prep: Preheat the oven to 425F.");
  });

  it("still keeps a name that heads the step rather than repeating it", () => {
    const entry = structuredClone(fixture[0]) as Record<string, any>;
    entry.recipe.instructions = [{ name: "", instructions: [{
      name: "For the sauce",
      text: "<p>Melt the butter.</p>",
    }] }];

    const [recipe] = extractWprmRecipes([entry]).recipes;

    expect(recipe.normalized.instructions[0].text).toBe("For the sauce: Melt the butter.");
  });

  it("reads a recipe kept in the old custom fields", () => {
    // theinspiredhome predates the WPRM fields the rest of the extractor reads:
    // 661 of its 1117 records publish an empty ingredients and instructions
    // while the text sits in custom_fields as an HTML list. Without this they
    // look like upstream stubs and are rejected, losing recipes legacy keeps.
    const entry = structuredClone(fixture[0]) as Record<string, any>;
    entry.recipe.ingredients = [];
    entry.recipe.instructions = [];
    entry.recipe.custom_fields = {
      old_ingredients: "<p><strong>For the Crust:</strong></p><ul><li>1 cup of all-purpose flour</li><li>Pinch of salt</li></ul>",
      old_instructions: "<ol><li>Preheat the oven to 350&deg;</li><li>Process until combined.</li></ol>",
    };

    const [recipe] = extractWprmRecipes([entry]).recipes;

    expect(recipe.normalized.ingredients).toEqual([
      "1 cup of all-purpose flour",
      "Pinch of salt",
    ]);
    expect(recipe.normalized.instructions.map((step) => step.text)).toEqual([
      "Preheat the oven to 350°",
      "Process until combined.",
    ]);
  });

  it("prefers the current fields when a record fills both", () => {
    const entry = structuredClone(fixture[0]) as Record<string, any>;
    entry.recipe.ingredients = [{ name: "", ingredients: [
      { amount: "2", unit: "cups", name: "flour" },
    ] }];
    entry.recipe.custom_fields = { old_ingredients: "<ul><li>stale copy</li></ul>" };

    const [recipe] = extractWprmRecipes([entry]).recipes;

    expect(recipe.normalized.ingredients).toEqual(["2 cups flour"]);
  });

  it("renders WPRM inline shortcodes the way the page does", () => {
    // WPRM keeps its shortcodes unrendered in API text. 22302 stored records
    // across 102 sources read "Thinly slice [wprm-ingredient text=...] ..."
    // where the page shows the ingredient; legacy stored the same raw text.
    const entry = structuredClone(fixture[0]) as Record<string, any>;
    entry.recipe.instructions = [{ name: "", instructions: [
      { text: 'Thinly slice [wprm-ingredient text="\u00bc sweet onion" uid="12"] lengthwise.' },
      { text: "Heat to [wprm-temperature value=\"70\" unit=\"C\"] for [wprm-ingredient text=&quot;3 minutes&quot; uid=&quot;4&quot;]." },
      { text: '[wprm-tip accent="#a92329"]Let it rest overnight.[/wprm-tip] [wprm-recipe-video]' },
      { text: "Keep ordinary [square brackets] as they are." },
    ] }];

    const [recipe] = extractWprmRecipes([entry]).recipes;

    expect(recipe.normalized.instructions.map((step) => step.text)).toEqual([
      "Thinly slice \u00bc sweet onion lengthwise.",
      "Heat to 70 \u00b0C for 3 minutes.",
      "Let it rest overnight.",
      "Keep ordinary [square brackets] as they are.",
    ]);
  });
});
