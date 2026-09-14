import { describe, expect, it } from "vitest";
import { extractJetpackRecipe } from "../../src/custom/jetpack-recipe.js";

// Trimmed from smittenkitchen.com/2026/08/peach-cobbler-loaf/, including the
// block's own unbalanced </p> tags, which is how Jetpack emits it.
const page = (recipe: string) => `<html><body><article><h1>Post</h1>${recipe}</article></body></html>`;
const jetpack = `<div class="h-recipe hrecipe jetpack-recipe" itemscope itemtype="https://schema.org/Recipe">
<h3 class="p-name jetpack-recipe-title fn" itemprop="name">Peach Cobbler Loaf</h3>
<ul class="jetpack-recipe-meta"><li class="jetpack-recipe-servings p-yield yield" itemprop="recipeYield"><strong>Servings: </strong>8 generous slices</li>
<li class="jetpack-recipe-time"><time itemprop="totalTime" datetime="1.5 hours, with prep time"><strong>Time:</strong> <span class="time">1.5 hours, with prep time</span></time></li></ul>
<div class="jetpack-recipe-content"></p>
<p><div class="jetpack-recipe-notes">Note: Very key here is the size of your loaf pan.</div></p>
<p><div class="jetpack-recipe-ingredients"><ul>
<h5>Cake</h5><li class="jetpack-recipe-ingredient" itemprop="recipeIngredient">1¼ pounds (565 grams) peaches</li><li class="jetpack-recipe-ingredient" itemprop="recipeIngredient">2 large eggs</li>
<h5>Streusel</h5><li class="jetpack-recipe-ingredient" itemprop="recipeIngredient">Pinch of salt</li></ul></div></p>
<p><div class="jetpack-recipe-directions e-instructions">Heat oven to 375°F (190°C).</p>
<p><strong>Prepare the cake:</strong> Finely grate the lemon zest &#8212; set aside.</p>
<p>Bake for 60 to 70 minutes.</div></p>
</div></div>`;

describe("Jetpack recipe block extraction", () => {
  it("reads title, ingredients, time and yield from microdata and steps from the directions", () => {
    const result = extractJetpackRecipe(page(jetpack), "https://smittenkitchen.com/2026/08/peach-cobbler-loaf/");

    expect(result).toMatchObject({ found: true, incompleteCount: 0, malformedCount: 0 });
    const normalized = result.recipe?.normalized;
    expect(normalized?.title).toBe("Peach Cobbler Loaf");
    expect(normalized?.ingredients).toEqual(["1¼ pounds (565 grams) peaches", "2 large eggs", "Pinch of salt"]);
    // The note and the ingredient group headings are not steps.
    expect(normalized?.instructions.map((step) => step.text)).toEqual([
      "Heat oven to 375°F (190°C).",
      "Prepare the cake: Finely grate the lemon zest — set aside.",
      "Bake for 60 to 70 minutes.",
    ]);
    expect(normalized?.yieldText).toBe("8 generous slices");
    expect(normalized?.totalMinutes).toBe(90);
  });

  it("prefers itemprop recipeInstructions when a block carries it", () => {
    const withInstructions = jetpack.replace(
      '<div class="jetpack-recipe-directions e-instructions">',
      '<div itemprop="recipeInstructions"><ol><li>Only step.</li></ol></div><div class="jetpack-recipe-directions e-instructions">'
    );
    const result = extractJetpackRecipe(page(withInstructions), "https://example.com/r/");
    expect(result.recipe?.normalized.instructions.map((step) => step.text)).toEqual(["Only step."]);
  });

  it("reports a post without a recipe block as not found rather than malformed", () => {
    expect(extractJetpackRecipe(page("<p>Just a story.</p>"), "https://example.com/p/")).toEqual({
      found: false,
      incompleteCount: 0,
      malformedCount: 0,
    });
  });

  it("counts a block without steps as incomplete", () => {
    const noSteps = jetpack.replace(/<div class="jetpack-recipe-directions[\s\S]*?<\/div><\/p>/u, "");
    expect(extractJetpackRecipe(page(noSteps), "https://example.com/r/")).toMatchObject({
      found: true,
      incompleteCount: 1,
      malformedCount: 0,
    });
  });
});
