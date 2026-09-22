import type { DanishJsonLdSource } from "./source-registry.js";
import { recipeSourceLanguage } from "./source-languages.js";

/** Registry locale overrides describe the configured catalogue, not the VPN country. */
export function requestProfileFor(source?: DanishJsonLdSource) {
  const language = source && recipeSourceLanguage(source.aliasFor ?? source.id);
  const defaults = language === "en"
    ? { locale: "en-US", timezoneId: "UTC" }
    : { locale: "da-DK", timezoneId: "Europe/Copenhagen" };
  const locale = Intl.getCanonicalLocales(source?.requestProfile?.locale ?? defaults.locale)[0];
  if (!locale) throw new Error("A source request locale must not be empty");
  const timezoneId = source?.requestProfile?.timezoneId ?? defaults.timezoneId;
  new Intl.DateTimeFormat("en", { timeZone: timezoneId }); // Reject invalid registry settings before fetching.
  const base = new Intl.Locale(locale).language;
  const acceptLanguage = [locale, ...(base !== locale ? [`${base};q=0.9`] : []),
    ...(base !== "en" ? ["en-US;q=0.8", "en;q=0.7"] : [])].join(",");
  return { locale, timezoneId, acceptLanguage };
}
