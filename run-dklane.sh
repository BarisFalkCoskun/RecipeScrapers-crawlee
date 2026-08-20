#!/usr/bin/env bash
# One lane of a canary sweep. Sources run one at a time inside a lane, so
# per-source politeness is unchanged; only lanes run in parallel.
set -u
LANE="$1"; TAG="$2"
SP=/tmp/claude-1000/-home-scraper-scripts-RecipeScrapers-crawlee/4666e5ed-f703-4158-8b57-ec1ef9ebdb60/scratchpad
for s in $(cat "$SP/lanes/$TAG$LANE.txt"); do
  [ -f "evidence/$TAG-$s.json" ] && continue
  echo "=== $s start $(date -u +%H:%M:%S) ==="
  rm -rf "$SP/lanes/storage-$TAG$LANE"; mkdir -p "$SP/lanes/storage-$TAG$LANE"
  CRAWLEE_STORAGE_DIR="$SP/lanes/storage-$TAG$LANE" CRAWLEE_MEMORY_MBYTES=1536 \
  MONGODB_URI='mongodb://127.0.0.1:27017' DB_NAME="crawlee_danish_jsonld_${TAG}_20260820" \
    npx tsx src/scripts/crawl-danish-jsonld.ts --sources "$s" --force \
      --json-out "evidence/$TAG-$s.json" > "evidence/$TAG-$s.log" 2>&1
  echo "=== $s exit=$? $(date -u +%H:%M:%S) ==="
done
echo "${TAG}LANE$LANE COMPLETE $(date -u +%H:%M:%S)"
