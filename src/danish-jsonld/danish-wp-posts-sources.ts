/** Danish WordPress-posts spiders added after the original generated registry. */
export const DANISH_WP_POSTS_SOURCE_DEFINITIONS = [
  ["dittejulie", "DitteJulieSpider", "dittejulie.dk", "https://dittejulie.dk/wp-json/wp/v2/posts"],
  ["hoerup", "HoerupSpider", "hoerup.dk", "https://hoerup.dk/wp-json/wp/v2/posts"],
  ["hverdagsgourmet", "HverdagsGourmetSpider", "hverdagsgourmet.dk", "https://hverdagsgourmet.dk/wp-json/wp/v2/posts"],
  ["madhang", "MadhangSpider", "madhang.dk", "https://madhang.dk/wp-json/wp/v2/posts"],
  ["madopskriften", "MadOpskriftenSpider", "mad-opskriften.dk", "https://mad-opskriften.dk/wp-json/wp/v2/posts"],
  ["madopskriftertilairfryer", "MadopskrifterTilAirfryerSpider", "madopskrifter-til-airfryer.dk", "https://madopskrifter-til-airfryer.dk/wp-json/wp/v2/posts"],
  ["nemmadplan", "NemMadplanSpider", "nem-madplan.dk", "https://nem-madplan.dk/wp-json/wp/v2/posts"],
  ["opskriftslageret", "OpskriftslageretSpider", "opskriftslageret.dk", "https://opskriftslageret.dk/wp-json/wp/v2/posts"],
  ["veganermor", "VeganermorSpider", "veganermor.dk", "https://veganermor.dk/wp-json/wp/v2/posts"],
  // Mummum's legacy spider reads Recipe JSON-LD from content.rendered. The
  // public post URL exposes the same payload, so shared strict extraction can
  // consume it after API discovery without a source-specific parser.
  ["mummum", "MummumSpider", "mummum.dk", "https://mummum.dk/wp-json/wp/v2/posts", false],
] as const;
