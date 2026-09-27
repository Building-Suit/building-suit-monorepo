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

echo "== Local control-plane preflight =="

psql \
  -X \
  -v ON_ERROR_STOP=1 \
  -h "$LOCAL_CONTROL_HOST" \
  -p "$LOCAL_CONTROL_PORT" \
  -U "$LOCAL_CONTROL_USER" \
  -d "$LOCAL_CONTROL_DB" \
  -c "
    SELECT
      current_database() AS database,
      current_user AS role,
      version() AS postgres_version;
  "

echo
echo "== Active task lifecycle states =="
psql \
  -X \
  -v ON_ERROR_STOP=1 \
  -h "$LOCAL_CONTROL_HOST" \
  -p "$LOCAL_CONTROL_PORT" \
  -U "$LOCAL_CONTROL_USER" \
  -d "$LOCAL_CONTROL_DB" \
  -c "
    SELECT
      task_id,
      suit_slug,
      status,
      updated_at
    FROM control.tasks
    WHERE status IN (
      'in_progress',
      'verification',
      'passed'
    )
    ORDER BY suit_slug, task_id;
  "

echo
echo "== Running continuous runs (if migration 009 is installed) =="
psql \
  -X \
  -v ON_ERROR_STOP=1 \
  -h "$LOCAL_CONTROL_HOST" \
  -p "$LOCAL_CONTROL_PORT" \
  -U "$LOCAL_CONTROL_USER" \
  -d "$LOCAL_CONTROL_DB" \
  -c "
    DO \$do\$
    BEGIN
      IF to_regclass('control.workflow_runs') IS NULL THEN
        RAISE NOTICE 'control.workflow_runs is not installed';
      END IF;
    END
    \$do\$;
  "

if psql \
  -X -qAt \
  -h "$LOCAL_CONTROL_HOST" \
  -p "$LOCAL_CONTROL_PORT" \
  -U "$LOCAL_CONTROL_USER" \
  -d "$LOCAL_CONTROL_DB" \
  -c "SELECT to_regclass('control.workflow_runs') IS NOT NULL;" \
  | grep -qx 't'
then
  psql \
    -X \
    -v ON_ERROR_STOP=1 \
    -h "$LOCAL_CONTROL_HOST" \
    -p "$LOCAL_CONTROL_PORT" \
    -U "$LOCAL_CONTROL_USER" \
    -d "$LOCAL_CONTROL_DB" \
    -c "
      SELECT
        run_id,
        suit_slug,
        status,
        completed_tasks,
        max_tasks,
        started_at
      FROM control.workflow_runs
      WHERE status = 'running'
      ORDER BY started_at;
    "
fi

echo
echo "Do not continue if a real task or continuous run is active."
