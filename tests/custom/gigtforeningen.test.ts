import { describe, expect, it } from "vitest";
import {
  extractGigtforeningenPosts,
  nextGigtforeningenPostsRequest,
} from "../../src/custom/gigtforeningen.js";

const post = {
  id: 2655,
  link: "https://www.gigtforeningen.dk/hverdagen/kost/madopskrifter/fisk-og-fjerkrae/groen-risotto-med-laks/",
  title: { rendered: "Grøn risotto med laks" },
  content: {
    rendered: `<p><em>Til 4 personer</em></p>
      <h2>Ingredienser</h2><ul><li>2 dl risotto-ris</li><li>4 lakseportioner</li></ul>
      <h2>Sådan gør du</h2><ol><li>Kog risene møre.</li><li>Steg laksen og server.</li></ol>
      <h2>Tip</h2><p>Gem resterne på køl.</p>`,
  },
  yoast_head_json: {
    description: "En grøn og nem risotto.",
    og_image: [{ url: "https://www.gigtforeningen.dk/wp-content/uploads/risotto.jpg" }],
  },
};

describe("Gigtforeningen WordPress post adapter", () => {
  it("extracts complete recipes while ignoring unrelated posts", () => {
    const result = extractGigtforeningenPosts(JSON.stringify([
      post,
      { id: 1, link: "https://www.gigtforeningen.dk/kort-nyt/andet/" },
    ]));

    expect(result).toMatchObject({
      postCount: 2,
      candidateCount: 1,
      incompleteCount: 0,
      malformedCount: 0,
    });
    expect(result.recipes?.[0]?.normalized).toMatchObject({
      title: "Grøn risotto med laks",
      description: "En grøn og nem risotto.",
      yieldText: "4 personer",
      ingredients: ["2 dl risotto-ris", "4 lakseportioner"],
      instructions: [
        { position: 1, text: "Kog risene møre." },
        { position: 2, text: "Steg laksen og server." },
      ],
      imageUrls: ["https://www.gigtforeningen.dk/wp-content/uploads/risotto.jpg"],
      categories: ["Fisk og fjerkræ"],
    });
  });

  it("parses current-site duration labels", () => {
    const timed = structuredClone(post);
    timed.content.rendered = `<p><strong>2 personer</strong></p><p>Arbejdstid: 1 time og 9 min.</p>
      <p>Samlet tid: 1 time og 15 min.</p>${post.content.rendered}`;
    const result = extractGigtforeningenPosts(JSON.stringify([timed]));
    expect(result.recipes?.[0]?.normalized).toMatchObject({
      prepMinutes: 69,
      cookMinutes: 6,
      totalMinutes: 75,
    });
  });

  it("uses the total-pages header to continue without probing an error page", () => {
    const current = "https://www.gigtforeningen.dk/wp-json/wp/v2/posts?per_page=100&page=1";
    expect(nextGigtforeningenPostsRequest(current, "3")?.url).toContain("page=2");
    const final = new URL(current);
    final.searchParams.set("page", "3");
    expect(nextGigtforeningenPostsRequest(final.toString(), "3"))
      .toBeUndefined();
  });
});
