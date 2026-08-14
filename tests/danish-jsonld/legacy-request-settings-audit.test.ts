import { describe, expect, it } from "vitest";
import { DANISH_JSONLD_SOURCES } from "../../src/danish-jsonld/source-registry.js";

// Literal effective Scrapy values from the legacy project defaults plus per-spider overrides.
const expectedSettings = {
  "amo": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "aperol": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "arla": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "aurion": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "bareencocktail": {
    "delaySeconds": 2,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "beauvais": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "becel": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "bedstedrinks": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "blenderopskrifter": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "bobedre": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "bodylab": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "bornemenuen": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "bornholms": {
    "delaySeconds": 2,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "campari": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "castello": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "christinaskoekken": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "cocktaily": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "coop": {
    "delaySeconds": 3,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "copenhagendistillery_da": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "danishcrown": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "diabetesopskrifter": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "evatrio": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "familiejournal": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "ferrerorocher": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "fevertree": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "foodnotes": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "frederikkewaerens": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "friluftslageret": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "frokenkraesen_com": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "gamleopskrifter": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "gastrologik": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "gastrotools": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "gigtforeningen": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "glutenfrimagi": {
    "delaySeconds": 2,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "glyngoere": {
    "delaySeconds": 2,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "hannerobinson": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "heidiogper": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "heinz": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "hverdagskoekken": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "iform": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "imerco": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "ingridhornshoj": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "jonsmadklub": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "kenwoodworld": {
    "delaySeconds": 2,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "ketomums": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "kikkoman": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "kitchenaid": {
    "delaySeconds": 2,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "klank": {
    "delaySeconds": 2,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "klinksgaard": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "knaehoejkarse": {
    "delaySeconds": 2,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "kokke": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "kornkammeret": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "kystfisken": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "lurpak": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "madenimitliv": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "madfolket": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "madformadelskere": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "madogdrikke": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "madoghave": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "madrejsen": {
    "delaySeconds": 2,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "madsvin": {
    "delaySeconds": 3,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "maduniverset": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "mambeno": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "mariavestergaard": {
    "delaySeconds": 3,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "micadeli": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "mutti": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "nescafe": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "netto": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "nogetiovnen": {
    "delaySeconds": 3,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "nordmad": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "nutella": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "oatly": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "odensemarcipan": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "oetker": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "opskrifterdk": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "parcelhuslykke": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "planetariskkogebog": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "plantepusherne": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "puredansk": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "recipesairfryer_dk": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "rema1000": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "revivafit": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "rosekylling": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "santamariaworld": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "schulstad": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "semper": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "skalvibage": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "skolemaelk": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "slagterlampe": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "spicytwist": {
    "delaySeconds": 2,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "spisekunst": {
    "delaySeconds": 2,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "starbucksathome": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "stinna": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "sundpaabudget": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "surdejsentusiasten": {
    "delaySeconds": 2,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "sydhavnsbloggen": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "tv2mad": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "udeoghjemme": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "violife": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "allrecipes": {
    "delaySeconds": 3,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "avocadosfrommexico": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "bbcgoodfood": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "bertolli": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "bettycrocker": {
    "delaySeconds": 3,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "bobsredmill": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "canadianliving": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "chelsea_nz": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "delmonte": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "edmonds_nz": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "foodnetwork_uk": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "greatbritishchefs": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "jamieoliver": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "landolakes": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "nordicfoodliving": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "olivemagazine": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "pillsbury": {
    "delaySeconds": 3,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "progresso": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "ricardocuisine": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "spam": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "sunset": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "tasteofhome": {
    "delaySeconds": 3,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "tesco_recipes": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "tillamook": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  }
} as const;

describe("legacy request-settings audit", () => {
  it("matches every legacy JSON-LD spider's effective delay, concurrency, and retries", () => {
    expect(Object.fromEntries(DANISH_JSONLD_SOURCES.map((source) => [
      source.id,
      {
        delaySeconds: source.requestSettings.delaySeconds,
        maxConcurrency: source.requestSettings.maxConcurrency,
        maxRetries: source.requestSettings.maxRetries,
      },
    ]))).toEqual(expectedSettings);
  });
});
