#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${HERE}/.env"
OUT_DIR="${HERE}/.local"

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

mkdir -p "$OUT_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_FILE="${OUT_DIR}/building-suit-control-${STAMP}.dump"
LATEST_FILE="${OUT_DIR}/latest.dump"

echo "Creating control-schema snapshot:"
echo "  $DUMP_FILE"

pg_dump \
  --host="$LOCAL_CONTROL_HOST" \
  --port="$LOCAL_CONTROL_PORT" \
  --username="$LOCAL_CONTROL_USER" \
  --dbname="$LOCAL_CONTROL_DB" \
  --schema=control \
  --format=custom \
  --no-owner \
  --no-privileges \
  --no-subscriptions \
  --verbose \
  --file="$DUMP_FILE"

ln -sfn "$(basename "$DUMP_FILE")" "$LATEST_FILE"

sha256sum "$DUMP_FILE" | tee "${DUMP_FILE}.sha256"

echo
echo "Snapshot created successfully."
echo "LATEST_DUMP=$LATEST_FILE"
