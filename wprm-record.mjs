// Write back what a finished batch found. The registry only holds sources
// that have run, so this is what makes a batch's registration committable.
import fs from 'node:fs';
const ids = fs.readFileSync(process.env.CLAUDE_JOB_DIR + '/tmp/wprm-batch.txt', 'utf8').split(/\s+/).filter(Boolean);
const p = 'src/danish-jsonld/source-registry.ts';
let s = fs.readFileSync(p, 'utf8');
const entries = [];
let missing = 0;
for (const id of ids) {
  const f = `evidence/wprm-${id}.json`;
  if (!fs.existsSync(f)) { missing++; continue; }
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const o = (j.observations || [])[0] || {};
  const outcome = ((j.summary.sourceOutcomes || [])[0] || {}).outcome;
  const bad = (o.rejectedIncompleteWprm || 0) + (o.rejectedMalformedWprm || 0)
    + (o.rejectedIncompleteJsonLd || 0) + (o.rejectedMalformedJsonLd || 0);
  const r = o.persistedRecipes ?? 0, cand = o.discoveredRecipeCandidates ?? 0;
  const b = o.blockedRequests ?? 0, fr = o.failedRequests ?? 0;
  let state, reason;
  if (outcome === 'succeeded') {
    state = 'canary_passed';
    reason = `Uncapped run persisted ${r} recipes from ${cand} API records with complete discovery and no blocked, failed or rejected record`;
  } else if (outcome === 'blocked') {
    state = 'blocked';
    reason = `Uncapped run persisted no recipes: ${b} requests were blocked, so discovery could not complete`;
  } else if (outcome === 'failed' && r === 0 && cand === 0) {
    state = 'configured';
    reason = `Uncapped run reached no recipe candidates${o.discoveryFailureReasons?.length ? ` (${o.discoveryFailureReasons.join(', ')})` : ''}, so the route needs review before a canary`;
  } else {
    state = 'configured';
    const bits = [];
    if (b) bits.push(`${b} blocked request${b === 1 ? '' : 's'}`);
    if (fr) bits.push(`${fr} failed request${fr === 1 ? '' : 's'}`);
    if (bad) bits.push(`${bad} record${bad === 1 ? '' : 's'} the source publishes incomplete or malformed`);
    if (o.discoveryComplete === false) bits.push('discovery that did not complete');
    const tail = bits.length > 1 ? bits.slice(0, -1).join(', ') + ' and ' + bits[bits.length - 1] : (bits[0] ?? 'an unrecorded shortfall');
    reason = `Uncapped run persisted ${r} recipes from ${cand} API records; ${tail} keeps it short of a canary`;
  }
  entries.push(`  ${/^\d/.test(id) ? `"${id}"` : id}: {\n    migrationState: "${state}",\n    latestCanary: "${j.crawlRunId}",\n    deferOrBlockReason:\n      "${reason}",\n  },`);
}
const anchor = '  gunris: {\n    migrationState: "shadow_passed",';
if (!s.includes(anchor)) { console.error('anchor missing'); process.exit(1); }
s = s.replace(anchor, entries.join('\n') + '\n' + anchor);
fs.writeFileSync(p, s);
console.log(`recorded ${entries.length}${missing ? `, still awaiting ${missing}` : ''}`);
