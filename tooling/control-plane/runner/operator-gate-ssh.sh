#!/usr/bin/env bash
set -euo pipefail
# Installed only as the forced command of the dedicated n8n operator SSH key.
# Its routing and password file are inaccessible to ordinary model children.
set -a
source "$HOME/.config/building-suit-control-plane/operator.env"
set +a
RELEASE_ROOT="$(readlink -f "$HOME/.local/lib/building-suit-control-plane/current")"
REQUEST="${SSH_ORIGINAL_COMMAND:-}"
REQUEST="${REQUEST#cd / ; }"
[[ "$REQUEST" =~ ^bs-agent\ operator-gate-resolve\ ([a-f0-9A-F-]{36})\ ([a-f0-9]{32})\ (approve|reject|revoke)\ ([a-f0-9A-F-]{36})$ ]] || exit 64
export BS_CONTROL_PINNED_RUNTIME_ROOT="$RELEASE_ROOT"
exec node "$RELEASE_ROOT/tooling/control-plane/runner/runtime-bootstrap.mjs" operator "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}" "${BASH_REMATCH[4]}"
