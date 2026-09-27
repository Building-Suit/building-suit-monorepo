#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${HERE}/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

LOCAL_CONTROL_HOST="${LOCAL_CONTROL_HOST:-127.0.0.1}"
LOCAL_CONTROL_PORT="${LOCAL_CONTROL_PORT:-54329}"
LOCAL_CONTROL_DB="${LOCAL_CONTROL_DB:-building_suit_control}"
LOCAL_CONTROL_USER="${LOCAL_CONTROL_USER:-bs_control_app}"

: "${STAGING_DB_HOST:?Set STAGING_DB_HOST in .env}"
: "${STAGING_PROJECT_REF:?Set STAGING_PROJECT_REF in .env}"

STAGING_DB_PORT="${STAGING_DB_PORT:-5432}"
STAGING_DB_NAME="${STAGING_DB_NAME:-postgres}"
STAGING_RUNTIME_USER="bs_control_app.${STAGING_PROJECT_REF}"

QUERY="
WITH counts AS (
  SELECT 'suits' AS name, count(*)::bigint AS rows FROM control.suits
  UNION ALL SELECT 'requirements', count(*) FROM control.requirements
  UNION ALL SELECT 'decisions', count(*) FROM control.decisions
  UNION ALL SELECT 'tasks', count(*) FROM control.tasks
  UNION ALL SELECT 'task_requirements', count(*) FROM control.task_requirements
  UNION ALL SELECT 'task_dependencies', count(*) FROM control.task_dependencies
  UNION ALL SELECT 'task_decisions', count(*) FROM control.task_decisions
  UNION ALL SELECT 'executions', count(*) FROM control.executions
  UNION ALL SELECT 'verification_results', count(*) FROM control.verification_results
  UNION ALL SELECT 'pull_requests', count(*) FROM control.pull_requests
  UNION ALL SELECT 'task_events', count(*) FROM control.task_events
)
SELECT name, rows
FROM counts
ORDER BY name;
"

LOCAL_OUT="$(mktemp)"
REMOTE_OUT="$(mktemp)"
trap 'rm -f "$LOCAL_OUT" "$REMOTE_OUT"' EXIT

psql \
  -X -qAt -F '|' \
  -h "$LOCAL_CONTROL_HOST" \
  -p "$LOCAL_CONTROL_PORT" \
  -U "$LOCAL_CONTROL_USER" \
  -d "$LOCAL_CONTROL_DB" \
  -v ON_ERROR_STOP=1 \
  -c "$QUERY" \
  > "$LOCAL_OUT"

PGSSLMODE=require \
psql \
  -X -qAt -F '|' \
  -h "$STAGING_DB_HOST" \
  -p "$STAGING_DB_PORT" \
  -U "$STAGING_RUNTIME_USER" \
  -d "$STAGING_DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -c "$QUERY" \
  > "$REMOTE_OUT"

echo "== Local =="
cat "$LOCAL_OUT"

echo
echo "== Supabase Staging =="
cat "$REMOTE_OUT"

echo
echo "== Diff =="

if diff -u "$LOCAL_OUT" "$REMOTE_OUT"; then
  echo
  echo "Core table row counts match."
else
  echo
  echo "ABORT: row-count mismatch." >&2
  exit 2
fi

echo
echo "== Next-ready task parity =="

NEXT_QUERY="
SELECT
  s.slug,
  COALESCE(
    (
      SELECT r.task_id
      FROM control.next_ready_task(s.slug) AS r
    ),
    '<none>'
  ) AS next_task
FROM control.suits AS s
WHERE s.slug IN (
  'ledger-suit',
  'shop-suit',
  'inventory-suit'
)
ORDER BY s.slug;
"

LOCAL_NEXT="$(mktemp)"
REMOTE_NEXT="$(mktemp)"
trap 'rm -f "$LOCAL_OUT" "$REMOTE_OUT" "$LOCAL_NEXT" "$REMOTE_NEXT"' EXIT

psql \
  -X -qAt -F '|' \
  -h "$LOCAL_CONTROL_HOST" \
  -p "$LOCAL_CONTROL_PORT" \
  -U "$LOCAL_CONTROL_USER" \
  -d "$LOCAL_CONTROL_DB" \
  -v ON_ERROR_STOP=1 \
  -c "$NEXT_QUERY" \
  > "$LOCAL_NEXT"

PGSSLMODE=require \
psql \
  -X -qAt -F '|' \
  -h "$STAGING_DB_HOST" \
  -p "$STAGING_DB_PORT" \
  -U "$STAGING_RUNTIME_USER" \
  -d "$STAGING_DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -c "$NEXT_QUERY" \
  > "$REMOTE_NEXT"

echo "Local:"
cat "$LOCAL_NEXT"

echo
echo "Staging:"
cat "$REMOTE_NEXT"

diff -u "$LOCAL_NEXT" "$REMOTE_NEXT"

echo
echo "Staging parity checks passed."
