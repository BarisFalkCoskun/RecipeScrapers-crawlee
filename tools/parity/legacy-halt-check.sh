#!/usr/bin/env bash
# Confirms, for one source, that a short legacy run is a legacy fault rather
# than a Crawlee discovery gap. Three things have to hold together:
#   1. the legacy run stopped on a challenged API page yet still called itself
#      finished, so its count is truncated rather than authoritative;
#   2. Crawlee's stored count equals the live listing contract (x-wp-total), so
#      discovery is complete against the source's own inventory;
#   3. every record legacy did manage to produce is present in Crawlee and
#      matches field for field, so the truncation is the only difference.
# Any one of these failing means the source is NOT eligible for the
# legacy-unhealthy route and must be looked at by hand.
set -uo pipefail
SRC="$1"; DB="$2"
SP="${SCRATCH:-/tmp}"
LEG="$SP/legacy-$SRC.json"
CR="$SP/cr-$SRC.json"
STATS="$SP/legacystats-$SRC.txt"

cd /home/scraper/scripts/RecipeScrapers
timeout "${LEGACY_TIMEOUT:-1800}" .venv/bin/scrapy crawl "$SRC" -O "$LEG" \
  -s ITEM_PIPELINES='{}' -s RECIPE_FEED_EXPORT_ENABLED=0 >"$STATS" 2>&1
RC=$?
cd /home/scraper/scripts/RecipeScrapers-crawlee
if [ $RC -eq 124 ]; then echo "$SRC | INCONCLUSIVE: legacy run hit the harness timeout"; exit 0; fi

ITEMS=$(grep -oE "'item_scraped_count': [0-9]+" "$STATS" | grep -oE '[0-9]+' | tail -1)
BLOCKED=$(grep -oE "'recipe/wprm_api_blocked_count': [0-9]+" "$STATS" | grep -oE '[0-9]+' | tail -1)
REASON=$(grep -oE "'finish_reason': '[a-z_]+'" "$STATS" | tail -1 | grep -oE "'[a-z_]+'$" | tr -d "'")
CODES=$(grep -oE "'downloader/response_status_count/[0-9]+': [0-9]+" "$STATS" | sed "s/'downloader.response_status_count.//;s/'//" | tr '\n' ' ')
: "${ITEMS:=0}" "${BLOCKED:=0}" "${REASON:=unknown}"

API=$(node -e 'const {DANISH_JSONLD_SOURCES}=require("./dist/danish-jsonld/source-registry.js");
const s=DANISH_JSONLD_SOURCES.find(x=>x.id===process.argv[1]);console.log((s&&s.startUrls&&s.startUrls[0])||"");' "$SRC")
TOTAL=""
if [ -n "$API" ]; then
  TOTAL=$(curl -sIL --max-time 60 "$API" | grep -i '^x-wp-total:' | tail -1 | tr -dc '0-9')
fi

node tools/parity/dump-crawlee.cjs "$DB" "$SRC" "$CR" >/dev/null 2>&1
STORED=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).length)' "$CR" 2>/dev/null || echo 0)

CMP=$(SUBSET=1 node tools/parity/compare-parity.cjs "$LEG" "$CR" 2>&1)
ONLYLEG=$(echo "$CMP" | grep -oE 'only legacy: [0-9]+' | grep -oE '[0-9]+' | head -1)
: "${ONLYLEG:=?}"
# Field differences print above the counts line; their absence is what lets the
# overlap count as a genuine match rather than merely a shared key set.
FIELDDIFF=$(echo "$CMP" | grep -cE '^### ')

VERDICT="NOT-ELIGIBLE"
if [ "$BLOCKED" -gt 0 ] && [ "$REASON" = "finished" ] && [ "$ONLYLEG" = "0" ] && [ "$FIELDDIFF" = "0" ] \
   && [ -n "$TOTAL" ] && [ "$TOTAL" = "$STORED" ]; then
  VERDICT="LEGACY-UNHEALTHY-CONFIRMED"
fi
echo "$SRC | $VERDICT | legacy=$ITEMS blocked=$BLOCKED reason=$REASON codes=[$CODES] | live_x_wp_total=${TOTAL:-none} stored=$STORED | only_legacy=$ONLYLEG field_diffs=$FIELDDIFF"
