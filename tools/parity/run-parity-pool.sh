#!/usr/bin/env bash
# Launch a worker pool sized from the machine rather than a fixed number, so a
# bigger box is used without re-tuning. Each worker holds one legacy spider,
# which measured at roughly 70 MB per process and two processes per worker;
# below ~20 workers the run is network-bound on per-domain delays and the CPUs
# idle, above that CPU is the binding constraint. Workers-per-core is therefore
# generous on purpose: the work is mostly waiting.
set -u
QUEUE="${PARITY_QUEUE:?set PARITY_QUEUE}"
RESULTS="${PARITY_RESULTS:?set PARITY_RESULTS}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cores=$(nproc)
avail_mb=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
# Leave headroom for MongoDB's cache and the crawler lanes sharing the box.
reserve_mb=${PARITY_RESERVE_MB:-1500}
per_worker_mb=${PARITY_WORKER_MB:-160}
by_mem=$(( (avail_mb - reserve_mb) / per_worker_mb ))
by_cpu=$(( cores * 6 ))
workers=$(( by_mem < by_cpu ? by_mem : by_cpu ))
[ "$workers" -lt 1 ] && workers=1
[ -n "${PARITY_WORKERS:-}" ] && workers=$PARITY_WORKERS

echo "cores=$cores available=${avail_mb}MB -> ${workers} workers (cpu cap ${by_cpu}, mem cap ${by_mem})"
for w in $(seq 1 "$workers"); do
  nohup env PARITY_QUEUE="$QUEUE" PARITY_RESULTS="$RESULTS" \
    PARITY_SCRAPY_TIMEOUT="${PARITY_SCRAPY_TIMEOUT:-1500}" \
    bash "$REPO/tools/parity/parity-queue.sh" "w$w" \
    > "$REPO/evidence/parity-worker$w.log" 2>&1 &
  disown
done
echo "pool of $workers started against $(wc -l < "$QUEUE") queued sources"
