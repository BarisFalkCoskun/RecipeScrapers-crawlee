#!/usr/bin/env bash
# One lane of the WPRM sweep. Sources run one at a time inside a lane, at the
# legacy spider's own delay and concurrency; only lanes run in parallel.
set -u
LANE="$1"
TMP=/home/scraper/.claude/jobs/68df68ae/tmp
for s in $(cat "$TMP/wprm-lane$LANE.txt"); do
  [ -f "evidence/wprm-$s.json" ] && continue
  echo "=== $s start $(date -u +%H:%M:%S) ==="
  rm -rf "$TMP/storage-wprm$LANE"; mkdir -p "$TMP/storage-wprm$LANE"
  CRAWLEE_STORAGE_DIR="$TMP/storage-wprm$LANE" CRAWLEE_MEMORY_MBYTES=1536 \
  MONGODB_URI='mongodb://127.0.0.1:27017' DB_NAME="crawlee_wprm_sweep_20260821" \
    npx tsx src/scripts/crawl-danish-jsonld.ts --sources "$s" --force \
      --json-out "evidence/wprm-$s.json" > "evidence/wprm-$s.log" 2>&1
  echo "=== $s exit=$? $(date -u +%H:%M:%S) ==="
done
echo "WPRMLANE$LANE COMPLETE $(date -u +%H:%M:%S)"
