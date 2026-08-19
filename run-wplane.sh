#!/usr/bin/env bash
# One lane of the WordPress posts family. Sources run one at a time inside a
# lane, so per-source politeness is unchanged; only lanes run in parallel.
set -u
LANE="$1"
TMP=/home/scraper/.claude/jobs/68df68ae/tmp
for s in $(cat "$TMP/wplane$LANE.txt"); do
  [ -f "evidence/wp2-$s.json" ] && continue
  echo "=== $s start $(date -u +%H:%M:%S) ==="
  rm -rf "$TMP/storage-wpl$LANE"; mkdir -p "$TMP/storage-wpl$LANE"
  CRAWLEE_STORAGE_DIR="$TMP/storage-wpl$LANE" CRAWLEE_MEMORY_MBYTES=1536 \
  MONGODB_URI='mongodb://127.0.0.1:27017' DB_NAME="crawlee_danish_jsonld_wp2_20260819" \
    npx tsx src/scripts/crawl-danish-jsonld.ts --sources "$s" --force \
      --json-out "evidence/wp2-$s.json" > "evidence/wp2-$s.log" 2>&1
  echo "=== $s exit=$? $(date -u +%H:%M:%S) ==="
done
echo "WPLANE$LANE COMPLETE $(date -u +%H:%M:%S)"
