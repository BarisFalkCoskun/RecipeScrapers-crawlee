#!/usr/bin/env bash
# A worker that keeps pulling sources off a shared queue and comparing each
# against its legacy spider, so the lanes stay busy instead of finishing a
# fixed batch and going idle. Pops are serialised with flock, so any number of
# workers can share one queue file.
set -u
QUEUE="${PARITY_QUEUE:?set PARITY_QUEUE}"
RESULTS="${PARITY_RESULTS:?set PARITY_RESULTS}"
WORKER="${1:-w}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

pop() {
  flock 9
  local line
  line=$(head -1 "$QUEUE" 2>/dev/null)
  [ -z "$line" ] && return 1
  sed -i '1d' "$QUEUE"
  printf '%s' "$line"
}

while true; do
  entry=$(exec 9>>"$QUEUE.lock"; pop) || { echo "[$WORKER] queue empty $(date -u +%H:%M:%S)"; break; }
  [ -z "$entry" ] && break
  src=${entry%% *}; db=${entry##* }
  start=$(date -u +%H:%M:%S)
  out=$(cd "$REPO" && bash tools/parity/shadow-parity.sh "$src" "$db" 2>&1)
  verdict=$(printf '%s' "$out" | tail -1)
  counts=$(printf '%s' "$out" | grep -m1 '^legacy:' || true)
  blocked=$(printf '%s' "$out" | grep -m1 'legacy recorded' || true)
  {
    flock 8
    printf '%s | %s | %s | %s | %s\n' "$src" "$verdict" "$counts" "$blocked" "$start" >> "$RESULTS"
  } 8>>"$RESULTS.lock"
  echo "[$WORKER] $src -> $verdict"
done
