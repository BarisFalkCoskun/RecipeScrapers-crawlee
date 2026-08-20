#!/usr/bin/env bash
# Moved to tools/parity/shadow-parity.sh. Kept as a forwarding shim so runs
# already in flight against the old path keep working.
exec bash "$(dirname "${BASH_SOURCE[0]}")/tools/parity/shadow-parity.sh" "$@"
