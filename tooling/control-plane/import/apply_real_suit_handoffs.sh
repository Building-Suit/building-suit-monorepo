#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$HOME/Dev/building-suit-monorepo/.local/worktrees/engineering-control-plane}"
SQL_FILE="${1:-$REPO_ROOT/tooling/control-plane/sql/010_import_real_suit_handoffs.sql}"

cd "$REPO_ROOT"

echo "Applying: $SQL_FILE"

psql \
  -X \
  -v ON_ERROR_STOP=1 \
  -h 127.0.0.1 \
  -p 54329 \
  -U bs_control_app \
  -d building_suit_control \
  -f "$SQL_FILE"

echo
echo "Verifying next ready task for each Suit..."

for suit in ledger-suit shop-suit inventory-suit; do
  echo
  echo "== $suit =="
  node tooling/control-plane/runner/bs-agent.mjs task-next "$suit"
done
