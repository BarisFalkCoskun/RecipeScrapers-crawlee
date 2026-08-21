#!/usr/bin/env bash
# Same self-sizing pool as the parity run, for the second uncapped crawl.
# A Crawlee crawl is far heavier than a legacy spider process: measured at
# ~720 MB resident against the legacy spider's ~70 MB, so this pool is memory
# bound where the parity pool is CPU bound. On a 4-core/8 GB box that allows
# two concurrent crawls; the budget is per-worker so a larger machine scales
# without editing anything.
set -u
QUEUE="${REPEAT_QUEUE:?set REPEAT_QUEUE}"
RESULTS="${REPEAT_RESULTS:?set REPEAT_RESULTS}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cores=$(nproc)
avail_mb=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
reserve_mb=${REPEAT_RESERVE_MB:-1200}
per_worker_mb=${REPEAT_WORKER_MB:-750}
by_mem=$(( (avail_mb - reserve_mb) / per_worker_mb ))
by_cpu=$(( cores * 2 ))
workers=$(( by_mem < by_cpu ? by_mem : by_cpu ))
[ "$workers" -lt 1 ] && workers=1
[ -n "${REPEAT_WORKERS:-}" ] && workers=$REPEAT_WORKERS
echo "cores=$cores available=${avail_mb}MB -> ${workers} repeat workers (cpu cap ${by_cpu}, mem cap ${by_mem})"
for w in $(seq 1 "$workers"); do
  nohup env REPEAT_QUEUE="$QUEUE" REPEAT_RESULTS="$RESULTS" \
    bash "$REPO/tools/parity/repeat-queue.sh" "r$w" \
    > "$REPO/evidence/repeat-worker$w.log" 2>&1 &
  disown
done
echo "pool of $workers started against $(wc -l < "$QUEUE") queued sources"
