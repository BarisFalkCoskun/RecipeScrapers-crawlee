#!/usr/bin/env bash
# A crawl lane that waits for a slot instead of being started by hand.
#
# Two Crawlee crawls is the ceiling on this host: each is ~750-960 MB resident
# against mongod's own 600 MB-1.7 GB, and three at once has driven free memory
# under 200 MB more than once - which does not merely slow things down, it
# manufactures false evidence. Eight sources were once recorded as "0 recipes"
# that way.
#
# So the lane counts the crawls actually running before it starts one, and
# waits when there is no room. It counts the `timeout ... npx tsx` wrappers,
# not every process whose command line mentions the script: a naive
# `pgrep -fc 'crawl-danish-jsonld.ts --sources'` reads 6 against a single crawl
# (wrapper, npm exec, sh -c, tsx shim, node) and the lane sat idle for ninety
# minutes on that miscount.
#
# CRAWL_QUEUE lines are "<sourceId> <database> [timeoutSeconds]". The database is
# required and not defaulted. The first version of this lane omitted it, so five
# re-crawls inherited DB_NAME=crawlee from .env and wrote 9062 documents into the
# scratch database while every comparison tool went on reading the
# crawlee_danish_jsonld_* database the source actually lives in. The runs were
# real and their counts were right; the evidence simply was not where anything
# would look for it, and pillsbury and landolakes were compared against
# two-day-old data without anything saying so.
#
# The timeout defaults to CRAWL_TIMEOUT. Sized per source rather than shared,
# because three sources have each cost a round by being cut off at a pool
# default.
set -u
cd /home/scraper/scripts/RecipeScrapers-crawlee || exit 1
Q="${CRAWL_QUEUE:?set CRAWL_QUEUE}"
R="${CRAWL_RESULTS:?set CRAWL_RESULTS}"
STORAGE="${CRAWL_STORAGE:-/tmp/recrawl-storage}"
# Was 2, raised to 3 on 2026-09-07 after re-measuring rather than inheriting the
# old rule. That rule came from a host carrying 647 databases where mongod held
# 600 MB-1.7 GB resident and a third crawl drove free memory under 200 MB.
# After dropping 631 of them mongod is 1.1 GB with 4.4 GB available, and disk -
# which turned out to be the real ceiling at 86% full - is back to 74% after
# clearing 8.6 GB of spent before/after dumps. Three crawls at ~900 MB leave
# ~1.7 GB spare. Not four: mongod still has 2.3 GB swapped out from the earlier
# incidents and will want it back under write pressure.
MAX="${CRAWL_MAX_CRAWLS:-3}"
DEFAULT_TIMEOUT="${CRAWL_TIMEOUT:-14400}"
POLL="${CRAWL_POLL_SECONDS:-120}"
MIN_FREE_MB="${CRAWL_MIN_FREE_MB:-1100}"
mkdir -p "$STORAGE"

running_crawls() {
  ps -eo args | grep -cE '^timeout [0-9]+ npx tsx src/scripts/crawl-danish-jsonld\.ts --sources' || true
}

while true; do
  line=$( (flock 9; head -1 "$Q"; sed -i '1d' "$Q") 9>>"$Q.lock" )
  [ -z "$line" ] && break
  set -- $line
  src=$1; db=${2:-}; secs=${3:-$DEFAULT_TIMEOUT}
  case "$secs" in ''|*[!0-9]*) secs=$DEFAULT_TIMEOUT ;; esac
  if [ -z "$db" ]; then
    (flock 8; printf '%s | SKIPPED: no database in the queue line, and inheriting one silently is what put 9062 documents in the wrong place\n' "$src" >> "$R") 8>>"$R.lock"
    continue
  fi

  # Wait for a slot and for enough memory to use it.
  while :; do
    n=$(running_crawls)
    avail=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
    if [ "$n" -lt "$MAX" ] && [ "$avail" -ge "$MIN_FREE_MB" ]; then break; fi
    sleep "$POLL"
  done

  started=$(date '+%Y-%m-%dT%H:%M:%S')
  MONGODB_URI='mongodb://127.0.0.1:27017' DB_NAME="$db" \
  timeout "$secs" npx tsx src/scripts/crawl-danish-jsonld.ts \
    --sources "$src" --force --json-out "$STORAGE/$src.json" \
    > "$STORAGE/$src.log" 2>&1
  status=$?

  summary=$(node -e '
    const fs=require("fs");
    try{
      const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
      const o=(j.observations||[])[0]||{};
      const bad=[];
      if(o.failedRequests>0) bad.push(`failed=${o.failedRequests}`);
      if(o.blockedRequests>0) bad.push(`blocked=${o.blockedRequests}`);
      if(o.discoveryComplete===false) bad.push("discovery-incomplete");
      if(o.pageCapReached) bad.push("page-cap-reached");
      const rej=Object.entries(o).filter(([k,v])=>/^rejected/.test(k)&&v>0)
        .map(([k,v])=>`${k}=${v}`);
      process.stdout.write(
        `persisted=${o.persistedRecipes} candidates=${o.discoveredRecipeCandidates} `+
        `processed=${o.processedRecipePages} run=${String(j.crawlRunId).slice(0,19)}`+
        (bad.length?` ${bad.join(" ")}`:" clean")+
        (rej.length?` ${rej.join(" ")}`:""));
    }catch(e){ process.stdout.write("no run summary written: "+e.message); }
  ' "$STORAGE/$src.json" 2>/dev/null)

  note=""
  [ "$status" -eq 124 ] && note=" CUT-OFF-BY-TIMEOUT(${secs}s)"
  (flock 8; printf '%s | exit=%s%s | %s | db=%s started %s\n' \
     "$src" "$status" "$note" "$summary" "$db" "$started" >> "$R") 8>>"$R.lock"
done
