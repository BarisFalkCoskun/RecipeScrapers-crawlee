import { describe, expect, it } from "vitest";
import { DANISH_JSONLD_SOURCES } from "../../src/danish-jsonld/source-registry.js";
import { DANISH_WP_POSTS_SOURCE_DEFINITIONS } from "../../src/danish-jsonld/danish-wp-posts-sources.js";
import {
  DANISH_CUSTOM_JSONLD_SOURCE_DEFINITIONS,
  DANISH_CUSTOM_LISTING_JSONLD_SOURCE_DEFINITIONS,
  DANISH_CUSTOM_WPRM_SOURCE_DEFINITIONS,
  DANISH_SHOPIFY_BLOG_SOURCE_DEFINITIONS,
  DANISH_EMBEDDED_JSON_SOURCE_DEFINITIONS,
  DANISH_HTML_RECIPE_SOURCE_DEFINITIONS,
  DANISH_MULTI_RECIPE_HTML_SOURCE_DEFINITIONS,
  DANISH_DR_GRAPHQL_SOURCE_DEFINITIONS,
  DANISH_AUTHENTICATED_API_SOURCE_DEFINITIONS,
  DANISH_DAGROFA_API_SOURCE_DEFINITIONS,
  DANISH_SITECORE_API_SOURCE_DEFINITIONS,
} from "../../src/danish-jsonld/custom-danish-sources.js";

// Literal effective Scrapy values from the legacy project defaults plus per-spider overrides.
const expectedSettings = {
  "abakershouse": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "acouplecooks": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "afamilyfeast": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "aggieskitchen": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "allergylicious": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "anicula": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "annsentitledlife": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "artfuldishes": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "asweetspoonful": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "babybite": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "bakerella": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "basisvarer": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "bellalimento": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "breadtopia": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "brownedbutterblondie": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "butternutbakeryblog": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "carrotstick": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "choosingchia": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "closetcooking": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "cookieandkate": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "cookiesandcups": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "cookingwithruthie": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "coupleinthekitchen": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "fannetasticfood": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "femina": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "gatheranddine": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "gimmesomeoven": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "goodlifeeats": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "greedygourmet": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "grownupdish": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "gunris": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "inspiredtaste": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "joyfulhealthyeats": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "joythebaker": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "kalynskitchen": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "kokkeriermedpassion": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "lavenderandlovage": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "lazycatkitchen": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "lowcarbdelish": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "lundoaagaard": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "moderncrumb": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "nannapretzmann": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "nyssaskitchen": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "opskrifterforalle": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "orwhateveryoudo": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "peaceloveandlowcarb": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "perrysplate": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "pickledplum": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "pinchofyum": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "projectmealplan": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "rachlmansfield": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "rockrecipes": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "shelikesfood": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "smaagroenneskridt": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "smittenkitchen": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "stegeso": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "sweetsimplevegan": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "tasteandsee": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "thatskinnychickcanbake": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "thecakeblog": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "thecastawaykitchen": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "thecookful": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "thefoodclub": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "thehappierhomemaker": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "thehealthymaven": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "therealfoodrds": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "tidymom": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "withspice": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "alt": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
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
  "dkkogebogen": {
    "delaySeconds": 3,
    "maxConcurrency": 1,
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
  "gocook": {
    "delaySeconds": 2,
    "maxConcurrency": 2,
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
  "nipunijulie": {
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
  "samvirke": {
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
  },
  "gastrofun": {
    "delaySeconds": 1,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "groedgrisen": {
    "delaySeconds": 1,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "ketoliv": {
    "delaySeconds": 2,
    "maxConcurrency": 1,
    "maxRetries": 3
  },
  "madensverden": {
    "delaySeconds": 1,
    "maxConcurrency": 2,
    "maxRetries": 3
  },
  "planteaederen": {
    "delaySeconds": 2,
    "maxConcurrency": 1,
    "maxRetries": 3
  }
} as const;

describe("legacy request-settings audit", () => {
  it("matches every non-WPRM legacy spider's effective delay, concurrency, and retries", () => {
    const wprmIds = new Set(DANISH_JSONLD_SOURCES
      .filter((source) => source.legacyFamily === "WprmApiSpider")
      .map((source) => source.id));
    const newlyRegisteredWpPostsIds = new Set(
      DANISH_WP_POSTS_SOURCE_DEFINITIONS.map(([sourceId]) => sourceId)
    );
    const customDanishIds = new Set(
      [
        ...DANISH_CUSTOM_JSONLD_SOURCE_DEFINITIONS,
        ...DANISH_CUSTOM_LISTING_JSONLD_SOURCE_DEFINITIONS,
        ...DANISH_CUSTOM_WPRM_SOURCE_DEFINITIONS,
        ...DANISH_SHOPIFY_BLOG_SOURCE_DEFINITIONS,
        ...DANISH_EMBEDDED_JSON_SOURCE_DEFINITIONS,
        ...DANISH_HTML_RECIPE_SOURCE_DEFINITIONS,
        ...DANISH_MULTI_RECIPE_HTML_SOURCE_DEFINITIONS,
        ...DANISH_DR_GRAPHQL_SOURCE_DEFINITIONS,
        ...DANISH_AUTHENTICATED_API_SOURCE_DEFINITIONS,
        ...DANISH_DAGROFA_API_SOURCE_DEFINITIONS,
        ...DANISH_SITECORE_API_SOURCE_DEFINITIONS,
      ].map(({ id }) => id)
    );
    customDanishIds.add("meyers");
    const expectedNonWprmSettings = Object.fromEntries(
      Object.entries(expectedSettings).filter(([sourceId]) => !wprmIds.has(sourceId))
    );

    // A source may be paced slower than its legacy spider when the site blocks
    // the crawler at legacy's pace - diabetesopskrifter and blenderopskrifter
    // each answered 52 requests with a block during an otherwise clean uncapped
    // run, and blenderopskrifter's own legacy run took 25 responses of 429. What
    // this audit is really protecting is that V2 is never more aggressive than
    // legacy, so slower is allowed and faster is not.
    // maduniverset is here for a different reason on a different axis: 135 of
    // its 9868 requests answered 502 under two parallel workers, while the
    // pages themselves answer 200 in under a second to a single client. It
    // keeps legacy's delay and halves the concurrency, so the assertion below
    // asks for "slower on some axis, faster on none" rather than for a longer
    // delay specifically.
    const deliberatelySlower = new Set([
      "diabetesopskrifter", "blenderopskrifter", "maduniverset", "spisbedre",
      // 31 of joythebaker's 1748 posts answered as blocked at the shared
      // default and its pacing had never been reduced at all, unlike the four
      // above. Slowed to one request every four seconds.
      "joythebaker",
      // thatskinnychickcanbake rate-limits every tool pointed at it: 39 of the
      // legacy run's 102 responses answered 403, its completeness walk needed
      // 1500ms pacing before 50 records stopped answering 429, and a repeat
      // crawl lost 22 of 1633 requests to blocks at the shared default.
      "thatskinnychickcanbake",
    ]);
    const audited = DANISH_JSONLD_SOURCES.filter((source) =>
      source.legacyFamily !== "WprmApiSpider" &&
      !newlyRegisteredWpPostsIds.has(source.id) &&
      !customDanishIds.has(source.id)
    );

    expect(Object.fromEntries(audited
      .filter((source) => !deliberatelySlower.has(source.id))
      .map((source) => [
      source.id,
      {
        delaySeconds: source.requestSettings.delaySeconds,
        maxConcurrency: source.requestSettings.maxConcurrency,
        maxRetries: source.requestSettings.maxRetries,
      },
    ]))).toEqual(Object.fromEntries(
      Object.entries(expectedNonWprmSettings)
        .filter(([sourceId]) => !deliberatelySlower.has(sourceId))
    ));

    for (const source of audited.filter((entry) => deliberatelySlower.has(entry.id))) {
      const legacy = expectedNonWprmSettings[source.id as keyof typeof expectedNonWprmSettings];
      // Never more aggressive than legacy on either axis...
      expect(source.requestSettings.delaySeconds).toBeGreaterThanOrEqual(legacy.delaySeconds);
      expect(source.requestSettings.maxConcurrency).toBeLessThanOrEqual(legacy.maxConcurrency);
      // ...and actually slower on at least one, or it does not belong in this set.
      expect(
        source.requestSettings.delaySeconds > legacy.delaySeconds ||
          source.requestSettings.maxConcurrency < legacy.maxConcurrency
      ).toBe(true);
      expect(source.requestSettings.maxRetries).toBe(legacy.maxRetries);
    }
  });
});
