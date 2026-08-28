#!/usr/bin/env node
// Filters a list of source ids down to the ones not already in a given state.
//
// Two rounds were spent "promoting" sources that were already shadow_passed:
// the working set came from stale mismatch files, and the one attempt to filter
// by current state read source.id when the status record calls the field
// source, so every lookup returned undefined and nothing was filtered. The
// registry is the authority on state, so read it directly rather than reshaping
// status output by hand.
//
//   node tools/parity/pending.cjs shadow_passed id1 id2 ...   (ids on argv)
//   node tools/parity/pending.cjs shadow_passed               (ids on stdin)
//
// Prints the ids still worth working, and a summary of what it dropped to
// stderr so a caller notices rather than silently queueing nothing.
const path = require("path");
const [, , state, ...argIds] = process.argv;
if (!state) {
  console.error("usage: pending.cjs <state> [ids...]");
  process.exit(2);
}

async function main() {
  const ids = argIds.length
    ? argIds
    : require("fs").readFileSync(0, "utf8").split(/\s+/u).filter(Boolean);
  // Read the states out of a tsx child rather than importing TypeScript here:
  // this file is CommonJS and the registry is a .ts module.
  const { execFileSync } = require("child_process");
  const script =
    'import{DANISH_JSONLD_SOURCES as S}from"./src/danish-jsonld/source-registry.ts";' +
    'console.log(JSON.stringify(S.map((s)=>[s.id,s.migrationState])));';
  const raw = execFileSync("npx", ["tsx", "--eval", script], {
    cwd: path.join(__dirname, "../.."),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const byId = new Map(JSON.parse(raw.trim().split("\n").pop()));
  const unknown = ids.filter((id) => !byId.has(id));
  const already = ids.filter((id) => byId.get(id) === state);
  const pending = ids.filter((id) => byId.has(id) && byId.get(id) !== state);
  if (unknown.length) console.error(`not in the registry: ${unknown.join(" ")}`);
  if (already.length) console.error(`already ${state}, dropped: ${already.join(" ")}`);
  console.error(`${pending.length} of ${ids.length} still to work`);
  for (const id of pending) console.log(id);
}
main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
