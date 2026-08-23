#!/usr/bin/env bash
# Run one source's legacy Scrapy spider in isolation and compare its output to
# the stored RecipeDocument V2 records for the same source.
#
#   bash tools/parity/shadow-parity.sh <source-id> [crawlee-db]
#
# The legacy run writes to a temporary file through a capture-only pipeline that
# replaces the production pipelines, so it makes no production write. Items are
# captured by a pipeline rather than a feed because Scrapy's feed exporter
# builds its URI params from every spider attribute, which raises
# `AttributeError: __provides__` on the browser-backed spiders and leaves the
# run with no output at all. RECIPE_FEED_EXPORT_ENABLED is read from the
# environment rather than from Scrapy settings, so it is exported to keep the
# default feed off.
set -u
SRC="$1"
DB="${2:-${PARITY_CRAWLEE_DB:-crawlee_danish_jsonld}}"
LEGACY_DIR="${LEGACY_SCRAPY_DIR:-/home/scraper/scripts/RecipeScrapers}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${PARITY_OUT_DIR:-${TMPDIR:-/tmp}/danish-parity}"
mkdir -p "$OUT"

cd "$LEGACY_DIR"
RECIPE_FEED_EXPORT_ENABLED=0 \
PARITY_CAPTURE_PATH="$OUT/$SRC.json" \
PYTHONPATH="$REPO/tools/parity${PYTHONPATH:+:$PYTHONPATH}" \
timeout "${PARITY_SCRAPY_TIMEOUT:-2400}" .venv/bin/scrapy crawl "$SRC" \
  -s ITEM_PIPELINES='{"capture_pipeline.CaptureJsonPipeline": 100}' \
  -s LOG_LEVEL="${PARITY_LOG_LEVEL:-WARNING}" \
  > "$OUT/$SRC.scrapy.log" 2>&1
scrapy_status=$?
echo "scrapy exit=$scrapy_status for $SRC"
# 124 is the timeout killing the spider mid-crawl. Its partial output looks
# exactly like a site with fewer recipes, so the comparison below would report
# a mismatch that is entirely ours. Say so instead of comparing.
if [ "$scrapy_status" -eq 124 ]; then
  echo "--- $SRC ---"
  echo "INCONCLUSIVE: the legacy run was cut off by PARITY_SCRAPY_TIMEOUT (${PARITY_SCRAPY_TIMEOUT:-2400}s) and its output is partial"
  exit 0
fi

# A legacy spider that is being blocked records each block as a page without a
# recipe, which is invisible in its output. Counting the statuses it saw is the
# only way to tell that apart from a site that genuinely has fewer recipes.
blocked=$(grep -oE "No Recipe JSON-LD at [^ ]+ \(status=[0-9]+" "$OUT/$SRC.scrapy.log" 2>/dev/null \
  | grep -oE "status=[0-9]+" | grep -vc "status=200" || true)
[ "${blocked:-0}" -gt 0 ] && echo "legacy recorded $blocked non-200 pages as having no recipe"

cd "$REPO"
node tools/parity/dump-crawlee.cjs "$DB" "$SRC" "$OUT/$SRC-crawlee.json" >/dev/null
echo "--- $SRC ---"
node tools/parity/compare-parity.cjs "$OUT/$SRC.json" "$OUT/$SRC-crawlee.json"
