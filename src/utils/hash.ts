import { hasher } from "node-object-hash";
import { createHash } from "crypto";

const objectHasher = hasher({
  sort: true,
  coerce: true,
  trim: true,
});

export function hashRecipe(recipe: Record<string, unknown>): string {
  return objectHasher.hash(recipe);
}

export function hashHtml(html: string): string {
  return createHash("sha256").update(html).digest("hex");
}
