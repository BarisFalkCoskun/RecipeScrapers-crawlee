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
# Some hosts answer honestly but slowly enough that Scrapy's 30s download
# timeout gives up before the body arrives, which reads as a dead source rather
# than a slow one. PARITY_SCRAPY_EXTRA passes extra "-s KEY=VALUE" settings so a
# run can be made more patient without being made faster than the legacy spider.
read -r -a scrapy_extra <<< "${PARITY_SCRAPY_EXTRA:-}"

RECIPE_FEED_EXPORT_ENABLED=0 \
PARITY_CAPTURE_PATH="$OUT/$SRC.json" \
PYTHONPATH="$REPO/tools/parity${PYTHONPATH:+:$PYTHONPATH}" \
timeout "${PARITY_SCRAPY_TIMEOUT:-2400}" .venv/bin/scrapy crawl "$SRC" \
  -s ITEM_PIPELINES='{"capture_pipeline.CaptureJsonPipeline": 100}' \
  -s LOG_LEVEL="${PARITY_LOG_LEVEL:-WARNING}" \
  ${scrapy_extra[@]+"${scrapy_extra[@]}"} \
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
# recipe, which is invisible in its output. The spider only logs a sample of
# those warnings, so the counters it dumps at close are the honest source: a
# json_ld_missing_no_script_count tracking the 403 count is a blocked run, not
# a site with fewer recipes.
stat_of() { grep -oE "'$1': [0-9]+" "$OUT/$SRC.scrapy.log" 2>/dev/null | tail -1 | grep -oE "[0-9]+$"; }
forbidden=$(stat_of "downloader/response_status_count/403")
no_script=$(stat_of "recipe/json_ld_missing_no_script_count")
links=$(stat_of "recipe/post_link_count")
api_blocked=$(stat_of "recipe/wprm_api_blocked_count")
scraped=$(stat_of "item_scraped_count")
# A WPRM spider stops paging the moment one API page is challenged, and still
# reports finish_reason finished. budgetbytes served three of nineteen pages
# before Cloudflare answered page four, and legacy called 300 of 1867 recipes a
# complete run. The advertised page count is the only way to see it.
if [ -n "${api_blocked:-}" ] && [ "${api_blocked:-0}" -gt 0 ]; then
  pages=$(grep -oE "total_pages_header='[0-9]+'" "$OUT/$SRC.scrapy.log" 2>/dev/null | grep -oE "[0-9]+" | tail -1)
  got=$(grep -oE "WPRM page [0-9]+/" "$OUT/$SRC.scrapy.log" 2>/dev/null | grep -oE "[0-9]+" | tail -1)
  echo "legacy stopped paging on a blocked WPRM API page: ${got:-?} of ${pages:-?} pages fetched, ${scraped:-?} recipes, then finished"
elif [ -n "${forbidden:-}" ] && [ "${forbidden:-0}" -gt 0 ]; then
  echo "legacy answered HTTP 403 on $forbidden of ${links:-?} requests, recording ${no_script:-?} pages as having no recipe"
fi
cd "$REPO"
# PARITY_RUN_ID=latest compares only the records the newest run produced. The
# store accumulates, so without it a comparison can count records the crawler
# would no longer write - see dump-crawlee.cjs.
node tools/parity/dump-crawlee.cjs "$DB" "$SRC" "$OUT/$SRC-crawlee.json" ${PARITY_RUN_ID:+"$PARITY_RUN_ID"}
echo "--- $SRC ---"
node tools/parity/compare-parity.cjs "$OUT/$SRC.json" "$OUT/$SRC-crawlee.json"
