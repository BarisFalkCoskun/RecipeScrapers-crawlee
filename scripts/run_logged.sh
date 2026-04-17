#!/usr/bin/env bash

set -uo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: bash scripts/run_logged.sh <log-prefix> <command> [<command> ...]" >&2
  exit 1
fi

log_prefix=$1
shift

mkdir -p logs

timestamp=$(date +%Y%m%d-%H%M%S)
log_file="logs/${log_prefix}-${timestamp}.txt"
latest_file="logs/${log_prefix}-latest.txt"
total_steps=$#

(
  status=0
  step=0

  printf "Run started: %s\n" "$(date -Iseconds)"
  printf "Working directory: %s\n" "$PWD"
  printf "Log prefix: %s\n" "$log_prefix"

  for command in "$@"; do
    step=$((step + 1))
    printf "\n[%d/%d] %s\n\n" "$step" "$total_steps" "$command"

    if bash -c "$command"; then
      :
    else
      status=$?
      printf "\nCommand failed with exit code %d: %s\n" "$status" "$command"
      break
    fi
  done

  printf "\nRun finished: %s\n" "$(date -Iseconds)"
  printf "Final status: %d\n" "$status"

  exit "$status"
) 2>&1 | tee "$log_file"

status=${PIPESTATUS[0]}
cp "$log_file" "$latest_file"

printf "Saved log to %s\n" "$log_file"
printf "Updated latest log at %s\n" "$latest_file"

exit "$status"
