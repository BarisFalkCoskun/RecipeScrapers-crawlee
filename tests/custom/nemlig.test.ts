import { describe, expect, it } from "vitest";
import {
  extractNemligCategory,
  extractNemligGroup,
  extractNemligRecipe,
  extractNemligStamp,
} from "../../src/custom/nemlig.js";

describe("Nemlig Sitecore adapter", () => {
  it("discovers stamps, nested groups, categories, and paginated recipes", () => {
    expect(extractNemligStamp('{"SitecorePublishedStamp":"stamp-1"}')).toBe("stamp-1");
    expect(extractNemligCategory(JSON.stringify({
      content: [{ RecipeGroupId: "group-1", content: [{ href: "/opskrifter/frokost" }] }],
    }))).toMatchObject({ groupIds: ["group-1"], categoryPaths: ["/opskrifter/frokost"] });
    expect(extractNemligGroup(JSON.stringify({
      Recipes: [{ Url: "/opskrifter/pasta" }], NumFound: 101,
    }), "stamp-1", "group-1", 0).requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "recipe", url: "https://www.nemlig.com/opskrifter/pasta?GetAsJson=1" }),
      expect.objectContaining({ kind: "listing", uniqueKey: "nemlig-group:group-1:1" }),
    ]));
  });

  it("normalizes a complete recipe detail spot", () => {
    const result = extractNemligRecipe(JSON.stringify({ content: [{
      TemplateName: "recipedetailspot",
      Header: "Nem pasta",
      MetaDescription: "En hurtig ret.",
      WorkTimeUtc: "PT15M",
      TotalTimeUtc: "PT35M",
      NumberOfPersons: 4,
      IngredientGroups: [{ Ingredients: [{ Amount: 250, Unit: "g", Text: "pasta" }] }],
      Instructions: "<p>1. Kog pastaen grundigt.</p><p>2) Servér straks.</p>",
      RecipeTags: [{ Name: "Aftensmad" }],
      Author: { Name: "Nemlig" },
      Media: [{ Url: "https://cdn.example/pasta.jpg" }],
    }] }), "https://www.nemlig.com/opskrifter/pasta?GetAsJson=1");
    expect(result).toMatchObject({ recipe: {
      canonicalUrl: "https://www.nemlig.com/opskrifter/pasta",
      normalized: {
        title: "Nem pasta",
        ingredients: ["250 g pasta"],
        instructions: [
          { position: 1, text: "Kog pastaen grundigt." },
          { position: 2, text: "Servér straks." },
        ],
        prepMinutes: 15,
        totalMinutes: 35,
        yieldText: "4",
        categories: ["Aftensmad"],
        keywords: ["Af: Nemlig"],
      },
    } });
  });
});
