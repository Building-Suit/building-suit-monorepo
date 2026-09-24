#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${HERE}/.env"
DUMP_FILE="${1:-${HERE}/.local/latest.dump}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${STAGING_DB_HOST:?Set STAGING_DB_HOST in tooling/control-plane/remote/.env}"
: "${STAGING_PROJECT_REF:?Set STAGING_PROJECT_REF in tooling/control-plane/remote/.env}"

STAGING_DB_PORT="${STAGING_DB_PORT:-5432}"
STAGING_DB_NAME="${STAGING_DB_NAME:-postgres}"
STAGING_DB_USER="postgres.${STAGING_PROJECT_REF}"

if [[ ! -e "$DUMP_FILE" ]]; then
  echo "Dump not found: $DUMP_FILE" >&2
  exit 1
fi

read -r -s -p "Supabase Staging postgres password: " STAGING_DB_PASSWORD
echo

cleanup() {
  unset PGPASSWORD
}
trap cleanup EXIT

export PGPASSWORD="$STAGING_DB_PASSWORD"
export PGSSLMODE=require
export PGCONNECT_TIMEOUT=10

echo "== Checking target =="
TARGET_CONTROL_SCHEMA="$(
  psql \
    -X -qAt \
    -h "$STAGING_DB_HOST" \
    -p "$STAGING_DB_PORT" \
    -U "$STAGING_DB_USER" \
    -d "$STAGING_DB_NAME" \
    -v ON_ERROR_STOP=1 \
    -c "SELECT to_regnamespace('control') IS NOT NULL;"
)"

if [[ "$TARGET_CONTROL_SCHEMA" == "t" ]]; then
  echo
  echo "ABORT: target already has a control schema."
  echo "This script intentionally refuses to overwrite it."
  echo "Inspect the Staging project manually before retrying."
  exit 2
fi

echo "Target is empty for control schema."
echo
echo "== Restoring local control snapshot into Supabase Staging =="

pg_restore \
  --host="$STAGING_DB_HOST" \
  --port="$STAGING_DB_PORT" \
  --username="$STAGING_DB_USER" \
  --dbname="$STAGING_DB_NAME" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --single-transaction \
  --exit-on-error \
  --verbose \
  "$DUMP_FILE"

echo
echo "== Analyze restored schema =="
psql \
  -X \
  -h "$STAGING_DB_HOST" \
  -p "$STAGING_DB_PORT" \
  -U "$STAGING_DB_USER" \
  -d "$STAGING_DB_NAME" \
  -v ON_ERROR_STOP=1 \
  -c "ANALYZE control.suits;" \
  -c "ANALYZE control.tasks;" \
  -c "ANALYZE control.decisions;" \
  -c "ANALYZE control.executions;"

echo
echo "Staging restore completed."
