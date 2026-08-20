import { describe, expect, it } from "vitest";
import {
  createDrListRequest,
  extractDrListing,
  extractDrRecipe,
} from "../../src/custom/dr.js";

describe("DR GraphQL adapter", () => {
  it("builds POST pagination and distinct article requests", () => {
    expect(createDrListRequest(500)).toMatchObject({
      kind: "listing",
      method: "POST",
      uniqueKey: "dr-list:500",
      requestData: { drOperation: "list", offset: 500 },
    });
    const result = extractDrListing(JSON.stringify({ data: { site: { publications: [
      { content: { urn: "urn:dr:article:1", title: "Ret" } },
      { content: null },
    ] } } }), 0);
    expect(result).toMatchObject({ candidateCount: 1, terminal: true, malformed: false });
    expect(result.requests[0]).toMatchObject({
      kind: "recipe",
      method: "POST",
      uniqueKey: "dr-article:urn:dr:article:1",
      requestData: { drOperation: "article", urn: "urn:dr:article:1" },
    });
  });

  it("normalizes complete article components", () => {
    const body = JSON.stringify({ data: { article: {
      urn: "urn:dr:article:1",
      title: "Pandekager",
      summary: "Opskrift til 4 pers.",
      urlPathId: "/mad/opskrift/pandekager",
      body: [
        { __typename: "HeadingComponent", text: "Ingredienser" },
        { __typename: "ListComponent", list: JSON.stringify({ items: [
          { body: [{ body: [{ text: "2 æg" }] }] },
          { body: [{ body: [{ text: "200 g mel" }] }] },
        ] }) },
        { __typename: "HeadingComponent", text: "Fremgangsmåde" },
        { __typename: "ParagraphComponent", body: JSON.stringify([
          { text: "Pisk æggene grundigt sammen med melet." },
        ]) },
      ],
      site: { title: "Spise med Price" },
      teaserImage: { default: { managedUrl: "https://asset.dr.dk/kage.jpg" } },
    } } });

    expect(extractDrRecipe(body)).toMatchObject({ recipe: {
      canonicalUrl: "https://www.dr.dk/mad/opskrift/pandekager",
      normalized: {
        title: "Pandekager",
        description: "Opskrift til 4 pers.",
        ingredients: ["2 æg", "200 g mel"],
        instructions: [{ position: 1, text: "Pisk æggene grundigt sammen med melet." }],
        yieldText: "4",
        categories: ["Spise med Price"],
        imageUrls: ["https://asset.dr.dk/kage.jpg"],
      },
    } });
  });
});
