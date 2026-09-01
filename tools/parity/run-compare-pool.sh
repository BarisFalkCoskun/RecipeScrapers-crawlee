#!/usr/bin/env bash
# The original compare lane hardcodes PARITY_SCRAPY_TIMEOUT=7200. That is fine
# for a few hundred records and wrong for anything larger: bobsredmill's 2884
# records were cut off at two hours three times before being run standalone at
# six, and olivemagazine's 7268 are about to be cut off the same way. Legacy
# Scrapy runs at roughly the same rate whatever the source, so the ceiling
# should come from how much there is to fetch.
#
# Budget: 4 seconds per stored record, floor 2h, cap 8h. bobsredmill's 2884
# records took just over 2h at its own pacing, which is ~2.6s each; 4s leaves
# room for a slower site without letting one source hold a lane all day.
cd /home/scraper/scripts/RecipeScrapers-crawlee || exit 1
Q="${COMPARE_QUEUE:-/tmp/compare-queue-sized.txt}"; R="${COMPARE_RESULTS:-/tmp/compare-results.txt}"
while true; do
  line=$( (flock 9; head -1 "$Q"; sed -i '1d' "$Q") 9>>"$Q.lock" )
  [ -z "$line" ] && break
  src=${line%% *}; db=${line##* }
  n=$(mongosh "mongodb://127.0.0.1:27017/$db" --quiet \
        --eval "print(db.recipes_v2.countDocuments({sourceId:'$src'}))" 2>/dev/null)
  case "$n" in ''|*[!0-9]*) n=0 ;; esac
  budget=$(( n * 4 ))
  [ "$budget" -lt 7200 ] && budget=7200
  [ "$budget" -gt 28800 ] && budget=28800
  out=$(PARITY_SCRAPY_TIMEOUT="$budget" bash tools/parity/shadow-parity.sh "$src" "$db" 2>&1)
  printf '%s\n' "$out" > "/tmp/danish-parity/$src-diff.txt"
  verdict=$(printf '%s' "$out" | tail -1)
  counts=$(printf '%s' "$out" | grep -m1 '^legacy:' || true)
  (flock 8; printf '%s | %s | %s [ceiling %ss for %s records]\n' \
     "$src" "$verdict" "$counts" "$budget" "$n" >> "$R") 8>>"$R.lock"
done
