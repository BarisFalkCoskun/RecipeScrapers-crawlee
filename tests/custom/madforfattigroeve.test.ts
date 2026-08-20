import { describe, expect, it } from "vitest";
import {
  createMadForFattigroeveDictionaryRequest,
  createMadForFattigroeveCurrentRequest,
  discoverMadForFattigroeveRecipes,
  extractMadForFattigroeveBuildId,
  extractMadForFattigroeveCurrentCatalog,
  extractMadForFattigroeveCurrentRecipes,
  extractMadForFattigroeveDictionary,
  extractMadForFattigroeveGraphqlCatalog,
  extractMadForFattigroeveRecipe,
} from "../../src/custom/madforfattigroeve.js";

describe("Mad for Fattigrøve Next.js adapter", () => {
  it("turns build-aware sitemap entries into data requests", () => {
    expect(extractMadForFattigroeveBuildId('{"buildId":"build-1"}')).toBe("build-1");
    expect(discoverMadForFattigroeveRecipes(
      "<loc>https://madforfattigroeve.dk/opskrifter/42</loc>",
      "build-1"
    )).toEqual([expect.objectContaining({
      kind: "recipe",
      url: "https://madforfattigroeve.dk/_next/data/build-1/opskrifter/42.json",
      requestData: { recipeId: "42" },
    })]);
  });

  it("normalizes the main recipe and subrecipe ingredients", () => {
    const result = extractMadForFattigroeveRecipe(JSON.stringify({ pageProps: { recipe: {
      title: "Billig pasta",
      description: "Nem aftensmad",
      prepTime: "20 minutter",
      ingredients: [{ amount: 250, unit: "g", name: "pasta" }],
      subrecipes: [{ title: "Sauce", ingredients: ["salt", { amount: 2, unit: "stk", name: "tomater" }] }],
      procedure: "Kog pastaen.\nLav saucen.",
      allergens: ["Gluten"],
      imagePath: "https://cdn.example/pasta.jpg",
    } } }), "42");
    expect(result).toMatchObject({ recipe: {
      canonicalUrl: "https://madforfattigroeve.dk/opskrifter/42",
      normalized: {
        title: "Billig pasta",
        ingredients: ["250 g pasta", "salt", "2 stk tomater"],
        prepMinutes: 20,
        instructions: [
          { position: 1, text: "Kog pastaen." },
          { position: 2, text: "Lav saucen." },
        ],
        keywords: ["Gluten"],
      },
    } });
  });

  it("joins the current server recipe catalog to the public GraphQL dictionaries", () => {
    const currentRecipe = {
      slug: "aeggemuffins",
      title: "Æggemuffins",
      description: "<p>Nem og billig.</p>",
      images: ["https://backend.example/muffin.jpg"],
      activeTime: 10,
      totalTime: 35,
      scaleDenominator: 4,
      ingredientList: [{ displaySequence: 0, ingredients: [
        { ingredientId: "egg", measureUnit: "STK", amountUsed: 1.67, displaySequence: 0 },
        { ingredientId: "salt", measureUnit: "NO_UNIT", amountUsed: 0.5, displaySequence: 1 },
      ] }],
      instructions: [{ heading: "", displaySequence: 0, steps: [
        { text: "<p>Pisk det hele sammen.</p>", displaySequence: 0 },
      ] }],
      categories: ["MORGEN"],
      mealTypes: ["FROKOST"],
      seasons: [],
      nutrition: { calories: 80 },
      metadata: { title: "Proteinrige æggemuffins", description: "God morgenmad" },
    };
    const catalog = extractMadForFattigroeveCurrentCatalog(
      `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: {
        serverRecipes: { listPublishedRecipes: { recipes: [currentRecipe], totalItems: 1 } },
      } } })}</script>`
    );
    expect(catalog).toMatchObject({ recipes: [currentRecipe], total: 1, malformed: false });
    const dictionary = extractMadForFattigroeveDictionary(JSON.stringify({ data: {
      ingredients: [
        { ingredientId: "egg", name: "æg", allergens: ["Æg"] },
        { ingredientId: "salt", name: "salt", allergens: [] },
      ],
      codeItems: [
        { tableCode: "UNIT", itemCode: "STK", name: "stk" },
        { tableCode: "RECIPE_CATEGORY", itemCode: "MORGEN", name: "Morgenmad" },
        { tableCode: "MEAL_TYPE", itemCode: "FROKOST", name: "Frokost" },
      ],
    } }));
    expect(dictionary).toBeDefined();
    expect(extractMadForFattigroeveCurrentRecipes(catalog.recipes, dictionary!)).toMatchObject({
      recipes: [{
        canonicalUrl: "https://madforfattigroeve.dk/opskrifter/aeggemuffins",
        normalized: {
          title: "Proteinrige æggemuffins",
          description: "God morgenmad",
          ingredients: ["2 stk æg", "0.5 salt"],
          instructions: [{ position: 1, text: "Pisk det hele sammen." }],
          prepMinutes: 10,
          totalMinutes: 35,
          yieldText: "4",
          categories: ["Morgenmad"],
          keywords: ["Æg", "Frokost"],
          nutrition: { calories: 80 },
        },
      }],
      incompleteCount: 0,
      malformedCount: 0,
    });
    expect(createMadForFattigroeveDictionaryRequest()).toMatchObject({
      method: "POST",
      url: "https://backend.madforfattigroeve.dk/graphql",
      requestData: { madForFattigroevePhase: "dictionary" },
    });
    const currentRequest = createMadForFattigroeveCurrentRequest();
    expect(currentRequest).toMatchObject({
      method: "POST",
      url: "https://backend.madforfattigroeve.dk/graphql",
      requestData: { madForFattigroevePhase: "current-catalog" },
    });
    expect(JSON.parse(currentRequest.payload!)).toMatchObject({
      variables: { listFilteredRecipesInput: { limit: 1_000, page: 1, sortDirection: "DESC" } },
    });
    expect(extractMadForFattigroeveGraphqlCatalog(JSON.stringify({ data: {
      listPublishedRecipes: { recipes: [currentRecipe], totalItems: 588 },
    } }))).toMatchObject({ recipes: [currentRecipe], total: 588, malformed: false });
  });
});
