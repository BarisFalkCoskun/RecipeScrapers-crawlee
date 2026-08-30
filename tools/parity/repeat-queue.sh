#!/usr/bin/env bash
# Worker for the second uncapped run each source needs before promotion: it
# re-crawls, then checks the stored records against what was there before, so
# stable keys and idempotent upserts are demonstrated rather than assumed.
set -u
QUEUE="${REPEAT_QUEUE:?set REPEAT_QUEUE}"
RESULTS="${REPEAT_RESULTS:?set REPEAT_RESULTS}"
WORKER="${1:-w}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STORAGE_ROOT="${REPEAT_STORAGE_ROOT:-${TMPDIR:-/tmp}/repeat-storage}"
mkdir -p "$STORAGE_ROOT"

pop() {
  flock 9
  local line
  line=$(head -1 "$QUEUE" 2>/dev/null)
  [ -z "$line" ] && return 1
  sed -i '1d' "$QUEUE"
  printf '%s' "$line"
}

while true; do
  entry=$(exec 9>>"$QUEUE.lock"; pop) || { echo "[$WORKER] queue empty"; break; }
  [ -z "$entry" ] && break
  src=${entry%% *}; db=${entry##* }
  before="$STORAGE_ROOT/$src-before.json"; after="$STORAGE_ROOT/$src-after.json"
  cd "$REPO"
  node tools/parity/dump-crawlee.cjs "$db" "$src" "$before" >/dev/null 2>&1
  rm -rf "$STORAGE_ROOT/st-$src"; mkdir -p "$STORAGE_ROOT/st-$src"
  rm -f "$STORAGE_ROOT/$src-run.json"
  CRAWLEE_STORAGE_DIR="$STORAGE_ROOT/st-$src" CRAWLEE_MEMORY_MBYTES="${REPEAT_CRAWLEE_MB:-1536}" \
  MONGODB_URI='mongodb://127.0.0.1:27017' DB_NAME="$db" \
    timeout "${REPEAT_TIMEOUT:-9000}" npx tsx src/scripts/crawl-danish-jsonld.ts \
      --sources "$src" --force --json-out "$STORAGE_ROOT/$src-run.json" \
      > "$STORAGE_ROOT/$src-run.log" 2>&1
  run_status=$?
  # A crawl that was killed, or that never started because an index could not
  # be built, writes no summary. Its records are unchanged from before, so the
  # comparison below would call that stable - the second run has to be shown to
  # have happened, not merely to have left everything alone.
  if [ "$run_status" -ne 0 ] || [ ! -s "$STORAGE_ROOT/$src-run.json" ]; then
    { flock 8; printf '%s | INCONCLUSIVE the second run did not complete (exit %s)\n' "$src" "$run_status" >> "$RESULTS"; } 8>>"$RESULTS.lock"
    echo "[$WORKER] $src -> INCONCLUSIVE second run did not complete"
    continue
  fi
  node tools/parity/dump-crawlee.cjs "$db" "$src" "$after" >/dev/null 2>&1
  verdict=$(node -e '
    const fs=require("fs");
    const [b,a]=process.argv.slice(1).map(p=>{try{return JSON.parse(fs.readFileSync(p,"utf8"))}catch{return null}});
    if(!b||!a||!a.length){console.log("INCONCLUSIVE no records");process.exit(0)}
    const kb=b.map(r=>r.sourceRecipeKey).sort(), ka=a.map(r=>r.sourceRecipeKey).sort();
    const dup=new Set(ka).size!==ka.length;
    // The gate is on the crawler producing the same output for the same input,
    // not on the site holding still. madensverden rewrote the descriptions of
    // /lasagne and /kagecreme between two runs - different marketing copy, and
    // sourceHash changed with it - so the pair could never come back clean while
    // the site kept editing. A record whose sourceHash moved was read from a
    // different page and is reported as an upstream edit; every record whose
    // page did not change must still be byte-identical.
    const prev=new Map(b.map(r=>[r.sourceRecipeKey,r]));
    let same=0, edited=0;
    for(const r of a){
      const p=prev.get(r.sourceRecipeKey);
      if(!p) continue;
      if(JSON.stringify(p.normalized)===JSON.stringify(r.normalized)){ same++; continue; }
      if(p.sourceHash && r.sourceHash && p.sourceHash!==r.sourceHash) edited++;
    }
    // Excusing an edited page must not excuse a site that rewrites everything on
    // every fetch - rotating copy inside the recipe would then pass forever. A
    // handful of edits across a catalog is a site being maintained; a twentieth
    // of it changing between two runs minutes apart is not, and still reports
    // CHANGED so someone looks.
    const churn = a.length > 0 && edited / a.length > 0.05;
    const ok=JSON.stringify(kb)===JSON.stringify(ka)&&!dup&&same+edited===a.length&&!churn;
    console.log(`${ok?"STABLE":"CHANGED"} ${b.length}->${a.length} identical=${same}/${a.length}${edited?` upstream-edited=${edited}`:""}${churn?" EXCESSIVE-CHURN":""}${dup?" DUPLICATE-KEYS":""}`);
  ' "$before" "$after")
  rm -rf "$STORAGE_ROOT/st-$src"
  { flock 8; printf '%s | %s\n' "$src" "$verdict" >> "$RESULTS"; } 8>>"$RESULTS.lock"
  echo "[$WORKER] $src -> $verdict"
done
