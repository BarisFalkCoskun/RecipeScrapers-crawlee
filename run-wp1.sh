#!/usr/bin/env bash
# First canary of the WordPress posts family. Three sources chosen to exercise
# the contract's distinct paths rather than for volume:
#   closetcooking  33 pages / ~3230 posts   multi-page continuation + terminator
#   aggieskitchen   9 pages                 short window
#   stegeso         ?rest_route= form       custom post type + query-param API
set -u
TMP=/home/scraper/.claude/jobs/68df68ae/tmp
for s in aggieskitchen stegeso closetcooking; do
  echo "=== $s start $(date -u +%H:%M:%S) ==="
  rm -rf "$TMP/storage-wp1"; mkdir -p "$TMP/storage-wp1"
  CRAWLEE_STORAGE_DIR="$TMP/storage-wp1" CRAWLEE_MEMORY_MBYTES=1536 \
  MONGODB_URI='mongodb://127.0.0.1:27017' DB_NAME="crawlee_danish_jsonld_wp1_20260819" \
    npx tsx src/scripts/crawl-danish-jsonld.ts --sources "$s" --force \
      --json-out "evidence/wp1-$s.json" > "evidence/wp1-$s.log" 2>&1
  echo "=== $s exit=$? $(date -u +%H:%M:%S) ==="
done
echo "WP1 COMPLETE $(date -u +%H:%M:%S)"
