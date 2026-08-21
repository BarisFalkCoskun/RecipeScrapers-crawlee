#!/usr/bin/env bash
# Re-crawl sources whose stored records predate an extraction fix, so the
# parity comparison reads corrected data rather than the old output.
set -u
TMP=/home/scraper/.claude/jobs/68df68ae/tmp
for s in $(cat "$TMP/recrawl-lane$1.txt"); do
  # Lane lists can overlap after a re-partition, so skip anything another
  # lane has already written evidence for rather than crawling it twice.
  [ -f "evidence/${RECRAWL_PREFIX:-wprm}-$s.json" ] && continue
  echo "=== $s start $(date -u +%H:%M:%S) ==="
  rm -rf "$TMP/storage-rc$1"; mkdir -p "$TMP/storage-rc$1"
  CRAWLEE_STORAGE_DIR="$TMP/storage-rc$1" CRAWLEE_MEMORY_MBYTES=1024 \
  MONGODB_URI='mongodb://127.0.0.1:27017' DB_NAME="${RECRAWL_DB:-crawlee_wprm_sweep_20260821}" \
    npx tsx src/scripts/crawl-danish-jsonld.ts --sources "$s" --force \
      --json-out "evidence/${RECRAWL_PREFIX:-wprm}-$s.json" > "evidence/${RECRAWL_PREFIX:-wprm}-$s.log" 2>&1
  echo "=== $s exit=$? $(date -u +%H:%M:%S) ==="
done
echo "RECRAWL$1 COMPLETE $(date -u +%H:%M:%S)"
