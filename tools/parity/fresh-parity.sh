#!/usr/bin/env bash
# Compare a source with both sides gathered in the same window: re-crawl it
# first, then run the legacy spider, then diff.
#
# Reading a stored crawl against a legacy run days later measures what the site
# changed in between, not what the implementations do. culinaryginger moved its
# ingredient amounts from {amount:"2", unit:"teaspoons"} to
# {amount:"2 teaspoons (8 grams)", unit:""} three days after its crawl, and the
# comparison reported seven differing ingredients that were nothing of the kind.
set -u
QUEUE="${FRESH_QUEUE:?set FRESH_QUEUE}"
RESULTS="${FRESH_RESULTS:?set FRESH_RESULTS}"
WORKER="${1:-f}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${PARITY_OUT_DIR:-${TMPDIR:-/tmp}/danish-parity}"
STORAGE="${FRESH_STORAGE_ROOT:-${TMPDIR:-/tmp}/fresh-storage}"
mkdir -p "$OUT" "$STORAGE"

# Every comparison leaves a legacy dump, a crawlee dump and a scrapy log in $OUT,
# and nothing was clearing them. Two days of rounds grew that directory to 13 GB
# and filled the disk, which stopped MongoDB accepting connections mid-round. A
# promoted source's dumps are not needed again, so each worker drops them as it
# starts. Failure here must not stop the run.
node "$REPO/tools/parity/prune-dumps.cjs" >/dev/null 2>&1 || true

pop() {
  flock 9
  local line
  line=$(head -1 "$QUEUE" 2>/dev/null)
  [ -z "$line" ] && return 1
  sed -i '1d' "$QUEUE"
  printf '%s' "$line"
}

while true; do
  entry=$(exec 9>>"$QUEUE.lock"; pop) || { echo "[$WORKER] queue empty"; break; }
  [ -z "$entry" ] && break
  src=${entry%% *}; db=${entry##* }
  cd "$REPO"

  rm -rf "$STORAGE/st-$src"; mkdir -p "$STORAGE/st-$src"
  CRAWLEE_STORAGE_DIR="$STORAGE/st-$src" CRAWLEE_MEMORY_MBYTES="${FRESH_CRAWLEE_MB:-1536}" \
  MONGODB_URI='mongodb://127.0.0.1:27017' DB_NAME="$db" \
    timeout "${FRESH_CRAWL_TIMEOUT:-9000}" npx tsx src/scripts/crawl-danish-jsonld.ts \
      --sources "$src" --force --json-out "$STORAGE/$src-run.json" \
      > "$STORAGE/$src-run.log" 2>&1
  crawl_status=$?
  rm -rf "$STORAGE/st-$src"
  if [ "$crawl_status" -ne 0 ] || [ ! -s "$STORAGE/$src-run.json" ]; then
    { flock 8; printf '%s | INCONCLUSIVE the refresh crawl did not complete (exit %s)\n' "$src" "$crawl_status" >> "$RESULTS"; } 8>>"$RESULTS.lock"
    echo "[$WORKER] $src -> INCONCLUSIVE refresh crawl failed"
    continue
  fi

  out=$(bash "$REPO/tools/parity/shadow-parity.sh" "$src" "$db" 2>&1)
  # Only the verdict line was being kept, so a MISMATCH could be counted but not
  # read: nineteen sources reported "field differences above" with the diff that
  # named them already discarded. Keep the whole comparison next to the dumps.
  printf '%s\n' "$out" > "$OUT/$src-diff.txt"
  verdict=$(printf '%s' "$out" | tail -1)
  counts=$(printf '%s' "$out" | grep -m1 '^legacy:' || true)
  block=$(printf '%s' "$out" | grep -m1 'legacy answered HTTP 403' || true)
  { flock 8; printf '%s | %s | %s | %s |\n' "$src" "$verdict" "$counts" "$block" >> "$RESULTS"; } 8>>"$RESULTS.lock"
  echo "[$WORKER] $src -> $verdict"
done
