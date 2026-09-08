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

# Discovery is complete when the run reached every record the listing declares,
# not when it stored every one of them: the bar is zero *unexplained* rejection,
# and a source whose listing carries an upstream stub can never store all of
# them. Requiring stored == x-wp-total here rejected twenty confirmed halts for
# being one to fifteen records short, every one of those records an upstream
# defect the explainer already accounts for. So ask the explainer rather than
# compare the counts.
# Route to the completeness check this source's listing can answer.
# explain-rejections.cjs walks wprm_recipe and keys on a WPRM record id; a
# WordPress-posts source publishes neither, and running it against one compares
# recipes to blog posts. That mismatch withdrew twelve promoted sources on
# 2026-08-28 before it was found.
LISTING=$(npx tsx --eval 'import{DANISH_JSONLD_SOURCES as S}from"./src/danish-jsonld/source-registry.ts";
const s=S.find(x=>x.id===process.argv[1]);process.stdout.write(String(s&&s.startUrls&&s.startUrls[0]||""));' "$SRC" 2>/dev/null)
run_explainer() {
  case "$LISTING" in
    *wprm_recipe*) EXPLAIN_DELAY_MS="$1" node tools/parity/explain-rejections.cjs "$SRC" "$DB" 2>&1 ;;
    *)             EXPLAIN_DELAY_MS="$1" npx tsx tools/parity/explain-jsonld-rejections.ts "$SRC" "$DB" 2>&1 ;;
  esac
}
EXPLAIN=$(run_explainer "${EXPLAIN_DELAY_MS:-0}")
EXPLAIN_OK=$?
# A walk that was itself rate-limited has not checked the source, it has been
# refused by it, and the two look identical in the verdict. thatskinnychickcanbake
# reported 50 of its missing records as "page answers 429" and was held
# NOT-ELIGIBLE for a shortfall nobody had actually measured. The explainer takes
# EXPLAIN_DELAY_MS and this never set it, so the walk ran as fast as the event
# loop allowed. Retry once, paced, and only when the first attempt was refused
# rather than for any failure - a genuine unexplained record does not become
# explained by asking again more slowly.
if [ "$EXPLAIN_OK" -ne 0 ] && printf '%s' "$EXPLAIN" | grep -qE '429|answered [0-9]+|INCONCLUSIVE'; then
  echo "$SRC | explainer was refused on the first pass, retrying at 1500ms per request" >&2
  EXPLAIN=$(run_explainer 1500)
  EXPLAIN_OK=$?
fi
TOTAL=$(printf '%s' "$EXPLAIN" | grep -oE 'declared=[0-9]+' | grep -oE '[0-9]+')
SHORTFALL=$(printf '%s' "$EXPLAIN" | grep -oE 'missing=[0-9]+[^|]*' | head -1)

node tools/parity/dump-crawlee.cjs "$DB" "$SRC" "$CR" >/dev/null 2>&1
STORED=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).length)' "$CR" 2>/dev/null || echo 0)

CMP=$(SUBSET=1 node tools/parity/compare-parity.cjs "$LEG" "$CR" 2>&1)
# "only legacy" is the raw count, before the comparator sorts out which of those
# records V2 was right not to store. bowlofdelicious has exactly one - a recipe
# the API publishes with no instructions at all, which legacy keeps and the
# completeness contract rejects - and reading the raw number held the source back
# over a record the comparator had already accounted for. What matters is the
# remainder after that accounting.
ONLYLEG_RAW=$(echo "$CMP" | grep -oE 'only legacy: [0-9]+' | grep -oE '[0-9]+' | head -1)
EXPLAINED_L=$(echo "$CMP" | grep -oE 'which the completeness contract rejects: [0-9]+' | grep -oE '[0-9]+$' | head -1)
: "${ONLYLEG_RAW:=0}" "${EXPLAINED_L:=0}"
ONLYLEG=$(( ONLYLEG_RAW - EXPLAINED_L ))
[ "$ONLYLEG" -lt 0 ] && ONLYLEG=0
# Field differences print above the counts line; their absence is what lets the
# overlap count as a genuine match rather than merely a shared key set.
FIELDDIFF=$(echo "$CMP" | grep -cE '^### ')

# The spider's own wprm_api_blocked_count is not the only evidence of a block.
# gimmesomeoven's run made one request, got 403, produced nothing and called
# itself finished, yet that counter stayed at zero - so a plainly blocked run was
# refused. A run that produced no items at all and saw a 403 is blocked whatever
# the spider recorded. Both routes still require everything else: a finished run,
# nothing legacy has that V2 lacks, no field differences, and complete discovery.
FORBIDDEN=$(printf '%s' "$CODES" | grep -oE '403: [0-9]+' | grep -oE '[0-9]+$' | head -1)
: "${FORBIDDEN:=0}"
# Third route: a large share of the run's responses were refused. The two
# routes above miss a whole family. wprm_api_blocked_count is WPRM-specific, so
# a WordPress-posts source never sets it; and requiring zero items misses a run
# that got some pages through before being cut off. thatskinnychickcanbake is
# both at once - 38 of its 102 responses answered 403, it kept 62 records, its
# spider recorded blocked=0, and the gate called it healthy three times running.
#
# A fifth of all responses refused is a block whatever the spider recorded. The
# floor of ten keeps a handful of incidental 403s on a large clean run from
# qualifying. This only supplies block evidence: finish_reason, only_legacy,
# field_diffs and the completeness walk all still have to hold, so widening it
# cannot on its own promote anything.
TOTAL_RESPONSES=$(printf '%s' "$CODES" | grep -oE ': [0-9]+' | grep -oE '[0-9]+' \
  | awk '{n+=$1} END {print n+0}')
: "${TOTAL_RESPONSES:=0}"
BLOCK_EVIDENCE=0
[ "$BLOCKED" -gt 0 ] && BLOCK_EVIDENCE=1
[ "$ITEMS" -eq 0 ] && [ "$FORBIDDEN" -gt 0 ] && BLOCK_EVIDENCE=1
[ "$FORBIDDEN" -ge 10 ] && [ "$TOTAL_RESPONSES" -gt 0 ] \
  && [ $(( FORBIDDEN * 5 )) -ge "$TOTAL_RESPONSES" ] && BLOCK_EVIDENCE=1

VERDICT="NOT-ELIGIBLE"
if [ "$BLOCK_EVIDENCE" -eq 1 ] && [ "$REASON" = "finished" ] && [ "$ONLYLEG" = "0" ] && [ "$FIELDDIFF" = "0" ] \
   && [ "$EXPLAIN_OK" -eq 0 ]; then
  VERDICT="LEGACY-UNHEALTHY-CONFIRMED"
fi
# How old the stored side is, because that alone can manufacture legacy-only
# records. The legacy run happens now; the store may be weeks old, and anything
# the site published in between looks exactly like a record V2 failed to find.
# theroastedroot was held NOT-ELIGIBLE on two such records, published
# 2026-09-04 and 2026-09-06 against a store written on 2026-08-21. landolakes
# and gastrofun had the same shape. When AGE is more than a day or two and
# only_legacy is small, re-crawl and compare in the same window before reading
# anything into it.
STORE_AGE=$(node -e '
  const {MongoClient}=require("mongodb");
  (async()=>{
    const c=new MongoClient("mongodb://127.0.0.1:27017");
    try{
      await c.connect();
      const d=await c.db(process.argv[2]).collection("recipes_v2")
        .find({sourceId:process.argv[1]},{projection:{extractedAt:1}})
        .sort({extractedAt:-1}).limit(1).next();
      if(!d||!d.extractedAt){process.stdout.write("unknown");return;}
      const days=(Date.now()-new Date(d.extractedAt).getTime())/86400000;
      process.stdout.write(new Date(d.extractedAt).toISOString().slice(0,10)+
        " ("+days.toFixed(1)+"d old)");
    }catch(e){process.stdout.write("unknown");}finally{await c.close();}
  })();
' "$SRC" "$DB" 2>/dev/null)

echo "$SRC | $VERDICT | legacy=$ITEMS blocked=$BLOCKED reason=$REASON codes=[$CODES] | declared=${TOTAL:-none} stored=$STORED ${SHORTFALL:-} | only_legacy=$ONLYLEG (raw $ONLYLEG_RAW, $EXPLAINED_L rejected by the contract) field_diffs=$FIELDDIFF | forbidden=$FORBIDDEN/$TOTAL_RESPONSES responses | store written ${STORE_AGE:-unknown}"
