#!/usr/bin/env bash
# Re-runs the legacy side for sources whose baseline was blocked rather than
# finished.
#
# Sixteen comparisons on disk were built against a legacy run Cloudflare stopped
# mid-pagination: theseasonedmom took two pages of its WPRM API and got 403 on
# the third, so its 200 records read as a 1868-record V2 surplus. Re-probing on
# 2026-09-03 found those endpoints answering 200 to both a browser and the
# spider's own user agent, so the blocks were pacing and the runs need redoing
# rather than the sources being interesting.
#
# Two differences from run-compare-pool.sh, which is why this is its own script
# rather than a flag on that one:
#   - one request at a time with a longer delay, since the whole point is to
#     stop tripping the site's rate limit;
#   - a per-record budget matched to that pacing. The other pool allows 4s per
#     record, which assumes the default 2s delay and 2 concurrent requests. At
#     one request every 4s that ceiling cuts a run off before it finishes, and
#     a cut-off legacy run is the same useless baseline as a blocked one.
cd /home/scraper/scripts/RecipeScrapers-crawlee || exit 1
Q="${SLOW_QUEUE:?set SLOW_QUEUE}"; R="${SLOW_RESULTS:?set SLOW_RESULTS}"
PER_RECORD="${SLOW_SECONDS_PER_RECORD:-9}"
FLOOR="${SLOW_FLOOR:-10800}"
CAP="${SLOW_CAP:-43200}"
EXTRA="${SLOW_SCRAPY_EXTRA:--s CONCURRENT_REQUESTS=1 -s CONCURRENT_REQUESTS_PER_DOMAIN=1 -s DOWNLOAD_DELAY=4 -s RETRY_TIMES=6 -s AUTOTHROTTLE_START_DELAY=5}"
while true; do
  line=$( (flock 9; head -1 "$Q"; sed -i '1d' "$Q") 9>>"$Q.lock" )
  [ -z "$line" ] && break
  src=${line%% *}; db=${line##* }
  n=$(mongosh "mongodb://127.0.0.1:27017/$db" --quiet \
        --eval "print(db.recipes_v2.countDocuments({sourceId:'$src'}))" 2>/dev/null)
  case "$n" in ''|*[!0-9]*) n=0 ;; esac
  budget=$(( n * PER_RECORD ))
  [ "$budget" -lt "$FLOOR" ] && budget=$FLOOR
  [ "$budget" -gt "$CAP" ] && budget=$CAP
  out=$(PARITY_SCRAPY_TIMEOUT="$budget" PARITY_SCRAPY_EXTRA="$EXTRA" \
          bash tools/parity/shadow-parity.sh "$src" "$db" 2>&1)
  printf '%s\n' "$out" > "/tmp/danish-parity/$src-diff.txt"
  verdict=$(printf '%s' "$out" | tail -1)
  counts=$(printf '%s' "$out" | grep -m1 '^legacy:' || true)
  (flock 8; printf '%s | %s | %s [ceiling %ss for %s records, one request every 4s]\n' \
     "$src" "$verdict" "$counts" "$budget" "$n" >> "$R") 8>>"$R.lock"
done
