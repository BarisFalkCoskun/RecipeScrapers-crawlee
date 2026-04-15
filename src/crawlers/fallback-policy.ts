import type { CheerioAPI } from "cheerio";
import { JS_FRAMEWORK_MARKERS, MIN_BODY_TEXT_LENGTH } from "../config.js";
import type { ExtractionResult } from "../types.js";

export function getPlaywrightFallbackReason(
  $: CheerioAPI,
  html: string,
  extraction: ExtractionResult,
  fromSitemap: boolean,
  admissionScore: number
): string | null {
  if (extraction.recipes.length > 0) {
    return null;
  }

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  if (bodyText.length < MIN_BODY_TEXT_LENGTH) {
    return "thin-content";
  }

  if (JS_FRAMEWORK_MARKERS.some((marker) => html.includes(marker))) {
    return "js-markers";
  }

  if (fromSitemap) {
    return "sitemap-page";
  }

  if (admissionScore >= 2) {
    return "high-value-discovery";
  }

  return null;
}
