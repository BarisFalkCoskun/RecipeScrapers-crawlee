#!/usr/bin/env bash
set -u
OUT="$2"; : > "$OUT"
while read -r s db; do bash repeat-run.sh "$s" "$db" >> "$OUT" 2>&1; done < "$1"
echo "REPEAT BATCH COMPLETE $(date -u +%H:%M:%S)" >> "$OUT"
