#!/usr/bin/env bash
# Shadow parity for a lane of swept WPRM sources. Each run compares the legacy
# Scrapy output against the records the sweep stored, which is the evidence a
# source needs to move from canary_passed to shadow_passed.
set -u
LANE="$1"
TMP=/home/scraper/.claude/jobs/68df68ae/tmp
for s in $(cat "$TMP/parity-lane$LANE.txt"); do
  [ -f "evidence/parity-$s.txt" ] && continue
  echo "=== $s start $(date -u +%H:%M:%S) ==="
  timeout 1800 bash tools/parity/shadow-parity.sh "$s" crawlee_wprm_sweep_20260821 \
    > "evidence/parity-$s.txt" 2>&1
  echo "=== $s exit=$? $(date -u +%H:%M:%S) ==="
done
echo "PARITYLANE$LANE COMPLETE $(date -u +%H:%M:%S)"
