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

: "${STAGING_DB_HOST:?Set STAGING_DB_HOST in .env}"
: "${STAGING_PROJECT_REF:?Set STAGING_PROJECT_REF in .env}"

STAGING_DB_PORT="${STAGING_DB_PORT:-5432}"
STAGING_DB_NAME="${STAGING_DB_NAME:-postgres}"
STAGING_DB_USER="postgres.${STAGING_PROJECT_REF}"

read -r -s -p "Supabase Staging postgres password: " ADMIN_PASSWORD
echo
read -r -s -p "New bs_control_app runtime password: " RUNTIME_PASSWORD
echo
read -r -s -p "Repeat runtime password: " RUNTIME_PASSWORD_2
echo

if [[ "$RUNTIME_PASSWORD" != "$RUNTIME_PASSWORD_2" ]]; then
  echo "Passwords do not match." >&2
  exit 1
fi

if [[ ${#RUNTIME_PASSWORD} -lt 20 ]]; then
  echo "Use a runtime password of at least 20 characters." >&2
  exit 1
fi

export PGPASSWORD="$ADMIN_PASSWORD"
export PGSSLMODE=require
export PGCONNECT_TIMEOUT=10

psql \
  -X \
  -h "$STAGING_DB_HOST" \
  -p "$STAGING_DB_PORT" \
  -U "$STAGING_DB_USER" \
  -d "$STAGING_DB_NAME" \
  -v ON_ERROR_STOP=1 \
  --set=runtime_password="$RUNTIME_PASSWORD" \
  -f "${HERE}/03_create_runtime_role.sql"

unset PGPASSWORD

echo
echo "Add this line to ~/.pgpass (replace PASSWORD with the runtime password):"
echo
echo "${STAGING_DB_HOST}:${STAGING_DB_PORT}:${STAGING_DB_NAME}:bs_control_app.${STAGING_PROJECT_REF}:PASSWORD"
echo
echo "Then run: chmod 600 ~/.pgpass"
