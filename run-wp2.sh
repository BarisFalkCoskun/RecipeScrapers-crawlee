#!/usr/bin/env bash
# Full canary of the plain WordPress posts family, one source at a time.
set -u
TMP=/home/scraper/.claude/jobs/68df68ae/tmp
for s in $(cat "$TMP/wpids.txt"); do
  [ -f "evidence/wp2-$s.json" ] && continue
  echo "=== $s start $(date -u +%H:%M:%S) ==="
  rm -rf "$TMP/storage-wp2"; mkdir -p "$TMP/storage-wp2"
  CRAWLEE_STORAGE_DIR="$TMP/storage-wp2" CRAWLEE_MEMORY_MBYTES=1536 \
  MONGODB_URI='mongodb://127.0.0.1:27017' DB_NAME="crawlee_danish_jsonld_wp2_20260819" \
    npx tsx src/scripts/crawl-danish-jsonld.ts --sources "$s" --force \
      --json-out "evidence/wp2-$s.json" > "evidence/wp2-$s.log" 2>&1
  echo "=== $s exit=$? $(date -u +%H:%M:%S) ==="
done
echo "WP2 COMPLETE $(date -u +%H:%M:%S)"
