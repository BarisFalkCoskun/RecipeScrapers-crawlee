#!/usr/bin/env bash
# Last two sources with no run evidence at all.
#   familiejournal  route-audited, never crawled
#   ricardocuisine  sitemap timed out during the route audit; retry under the crawler
set -u
TMP=/home/scraper/.claude/jobs/68df68ae/tmp
for s in familiejournal ricardocuisine; do
  echo "=== $s start $(date -u +%H:%M:%S) ==="
  rm -rf "$TMP/storage-lane10"; mkdir -p "$TMP/storage-lane10"
  CRAWLEE_STORAGE_DIR="$TMP/storage-lane10" CRAWLEE_MEMORY_MBYTES=1536 \
  MONGODB_URI='mongodb://127.0.0.1:27017' DB_NAME="crawlee_danish_jsonld_lane10_20260818" \
    npx tsx src/scripts/crawl-danish-jsonld.ts --sources "$s" --force \
      --json-out "evidence/lane10-$s.json" > "evidence/lane10-$s.log" 2>&1
  echo "=== $s exit=$? $(date -u +%H:%M:%S) ==="
done
echo "LANE10 COMPLETE $(date -u +%H:%M:%S)"
