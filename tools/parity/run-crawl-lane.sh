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
# CRAWL_QUEUE lines are "<sourceId> [timeoutSeconds]"; the timeout defaults to
# CRAWL_TIMEOUT. Sized per source rather than shared, because three sources have
# each cost a round by being cut off at a pool default.
set -u
cd /home/scraper/scripts/RecipeScrapers-crawlee || exit 1
Q="${CRAWL_QUEUE:?set CRAWL_QUEUE}"
R="${CRAWL_RESULTS:?set CRAWL_RESULTS}"
STORAGE="${CRAWL_STORAGE:-/tmp/recrawl-storage}"
MAX="${CRAWL_MAX_CRAWLS:-2}"
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
  src=${line%% *}
  secs=${line##* }
  case "$secs" in ''|*[!0-9]*) secs=$DEFAULT_TIMEOUT ;; esac

  # Wait for a slot and for enough memory to use it.
  while :; do
    n=$(running_crawls)
    avail=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
    if [ "$n" -lt "$MAX" ] && [ "$avail" -ge "$MIN_FREE_MB" ]; then break; fi
    sleep "$POLL"
  done

  started=$(date '+%Y-%m-%dT%H:%M:%S')
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
  (flock 8; printf '%s | exit=%s%s | %s | started %s\n' \
     "$src" "$status" "$note" "$summary" "$started" >> "$R") 8>>"$R.lock"
done
