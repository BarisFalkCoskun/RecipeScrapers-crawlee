#!/usr/bin/env bash
set -u
LIST="$1"; OUT="$2"
: > "$OUT"
for s in $(cat "$LIST"); do
  echo "=== $s start $(date -u +%H:%M:%S) ===" >> "$OUT"
  bash shadow-parity.sh "$s" >> "$OUT" 2>&1
  echo "=== $s end $(date -u +%H:%M:%S) ===" >> "$OUT"
done
echo "SHADOW BATCH COMPLETE $(date -u +%H:%M:%S)" >> "$OUT"
