#!/usr/bin/env bash
set -u
LIST="$1"; OUT="$2"; DB="${3:-crawlee_danish_jsonld_wprm_20260820}"
: > "$OUT"
for s in $(cat "$LIST"); do
  echo "=== $s start $(date -u +%H:%M:%S) ===" >> "$OUT"
  bash shadow-parity.sh "$s" "$DB" >> "$OUT" 2>&1
  echo "=== $s end $(date -u +%H:%M:%S) ===" >> "$OUT"
done
echo "SHADOW BATCH COMPLETE $(date -u +%H:%M:%S)" >> "$OUT"
