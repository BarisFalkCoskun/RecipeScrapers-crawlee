// Register a batch of legacy WPRM spiders so a lane can crawl them. The
// registry only ever commits sources that have run, so registration and the
// evidence that follows land together.
import fs from 'node:fs';
const [, , countArg] = process.argv;
const count = Number(countArg ?? 30);
const rows = JSON.parse(fs.readFileSync(process.env.CLAUDE_JOB_DIR + '/tmp/wprm-new.json', 'utf8'));
const p = 'src/danish-jsonld/source-registry.ts';
let s = fs.readFileSync(p, 'utf8');
const batch = rows.filter((r) => !s.includes(`"id": "${r.id}",`)).slice(0, count);
if (batch.length === 0) { console.log('nothing left to register'); process.exit(0); }

const entries = batch.map((x) => {
  const sep = x.apiUrl.includes('?') ? '&' : '?';
  return JSON.stringify({
    id: x.id, domain: x.domain, allowedDomains: x.allowedDomains,
    legacySpider: x.legacySpider, legacyFamily: 'WprmApiSpider',
    discovery: 'listing', sitemapUrls: [],
    startUrls: [`${x.apiUrl}${sep}per_page=100&page=1`],
    recipeUrlPatterns: ['^https?://'], fetchMode: 'cheerio',
    requestSettings: { delaySeconds: 1, rateLimitPerMinute: null, maxConcurrency: 2, maxRetries: 3 },
    requireCompleteJsonLd: true, migrationState: 'not_started', latestScrapyOutcome: 'not_audited',
  }, null, 2).split('\n').map((l) => '  ' + l).join('\n');
}).join(',\n');

s = s.replace('\n] as DanishJsonLdSource[];', ',\n' + entries + '\n] as DanishJsonLdSource[];');
const disc = batch.map((x) => (/^\d/.test(x.id) ? `  "${x.id}": WP_POSTS_LISTING_DISCOVERY,` : `  ${x.id}: WP_POSTS_LISTING_DISCOVERY,`)).join('\n');
const i = s.indexOf('const LEGACY_LISTING_DISCOVERY_OVERRIDES: Record<');
const j = s.indexOf('\n};', i);
s = s.slice(0, j) + '\n' + disc + s.slice(j);
fs.writeFileSync(p, s);
fs.writeFileSync(process.env.CLAUDE_JOB_DIR + '/tmp/wprm-batch.txt', batch.map((b) => b.id).join(' '));
console.log('registered', batch.length, ':', batch.map((b) => b.id).join(' '));
