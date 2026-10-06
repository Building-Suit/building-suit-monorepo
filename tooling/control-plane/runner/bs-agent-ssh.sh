#!/usr/bin/env bash

set -euo pipefail

# The forced SSH runner loads only non-secret database routing
# configuration from this machine. Passwords remain in ~/.pgpass.
CONTROL_DB_ENV_FILE="$HOME/.config/building-suit-control-plane/db.env"

if [[ -f "$CONTROL_DB_ENV_FILE" ]]; then
  set -a
  source "$CONTROL_DB_ENV_FILE"
  set +a
fi

CONTROL_ROOT="$HOME/Dev/building-suit-monorepo"

if [[ ! -f "$CONTROL_ROOT/tooling/control-plane/runner/bs-agent.mjs" ]]; then
  printf '%s\n' \
    '{"ok":false,"error":"control_plane_runner_not_found"}'

  exit 127
fi

AGENT="$CONTROL_ROOT/tooling/control-plane/runner/bs-agent.mjs"

NODE_BIN="$(command -v node || true)"

if [[ -z "$NODE_BIN" ]]; then
  printf '%s\n' \
    '{"ok":false,"error":"node_not_found"}'

  exit 127
fi

REQUESTED_COMMAND="${SSH_ORIGINAL_COMMAND:-}"

# n8n's SSH node requires a working directory. node-ssh prepends
# `cd <cwd> ; ` to the requested command. We deliberately require
# n8n to use `/` and strip only that exact known-safe prefix.
N8N_CWD_PREFIX="cd / ; "

if [[ "$REQUESTED_COMMAND" == "$N8N_CWD_PREFIX"* ]]; then
  REQUESTED_COMMAND="${REQUESTED_COMMAND#"$N8N_CWD_PREFIX"}"
fi

case "$REQUESTED_COMMAND" in
 "bs-agent operator-gates "*)
  RUN_ID="${REQUESTED_COMMAND#bs-agent operator-gates }"
  [[ "$RUN_ID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] || exit 64
  exec "$NODE_BIN" "$AGENT" operator-gates "$RUN_ID" ;;
 "bs-agent operator-gate-resolve "*)
  INPUT="${REQUESTED_COMMAND#bs-agent operator-gate-resolve }"
  [[ "$INPUT" =~ ^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\ ([a-f0-9]{32})\ (approve|reject)$ ]] || exit 64
  exec "$NODE_BIN" "$AGENT" operator-gate-resolve "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}" ;;


  "bs-agent ping")
    exec "$NODE_BIN" "$AGENT" ping
    ;;

  "bs-agent repo-state")
    exec "$NODE_BIN" "$AGENT" repo-state
    ;;

  "bs-agent preflight")
    exec "$NODE_BIN" "$AGENT" preflight
    ;;

  "bs-agent codex-status")
    exec "$NODE_BIN" "$AGENT" codex-status
    ;;

  "bs-agent route no_ai")
    exec "$NODE_BIN" "$AGENT" route no_ai
    ;;

  "bs-agent route fast")
    exec "$NODE_BIN" "$AGENT" route fast
    ;;

  "bs-agent route standard")
    exec "$NODE_BIN" "$AGENT" route standard
    ;;

  "bs-agent route deep")
    exec "$NODE_BIN" "$AGENT" route deep
    ;;

  "bs-agent route review")
    exec "$NODE_BIN" "$AGENT" route review
    ;;

  "bs-agent codex-smoke fast")
    exec "$NODE_BIN" "$AGENT" codex-smoke fast
    ;;

  "bs-agent pr-check "*)
    PR_NUMBER="${REQUESTED_COMMAND#bs-agent pr-check }"

    if [[ ! "$PR_NUMBER" =~ ^[1-9][0-9]*$ ]]; then
      printf '%s\n' \
        '{"ok":false,"error":"invalid_pr_number"}'

      exit 64
    fi

    exec "$NODE_BIN" "$AGENT" pr-check "$PR_NUMBER"
    ;;

  "bs-agent task-next "*)
    SUIT_SLUG="${REQUESTED_COMMAND#bs-agent task-next }"

    if [[ ! "$SUIT_SLUG" =~ ^[a-z][a-z0-9-]{1,63}$ ]]; then
      printf '%s\n' \
        '{"ok":false,"error":"invalid_suit_slug"}'

      exit 64
    fi

    exec "$NODE_BIN" \
      "$AGENT" \
      task-next \
      "$SUIT_SLUG"
    ;;


  "bs-agent task-packet "*)
    TASK_ID="${REQUESTED_COMMAND#bs-agent task-packet }"

    if [[ ! "$TASK_ID" =~ ^[A-Z][A-Z0-9-]{2,63}$ ]]; then
      printf '%s\n' \
        '{"ok":false,"error":"invalid_task_id"}'

      exit 64
    fi

    exec "$NODE_BIN" \
      "$AGENT" \
      task-packet \
      "$TASK_ID"
    ;;


  "bs-agent task-claim "*)
    SUIT_SLUG="${REQUESTED_COMMAND#bs-agent task-claim }"

    if [[ ! "$SUIT_SLUG" =~ ^[a-z][a-z0-9-]{1,63}$ ]]; then
      printf '%s\n' \
        '{"ok":false,"error":"invalid_suit_slug"}'

      exit 64
    fi

    exec "$NODE_BIN" \
      "$AGENT" \
      task-claim \
      "$SUIT_SLUG"
    ;;


  "bs-agent task-release "*)
    TASK_ID="${REQUESTED_COMMAND#bs-agent task-release }"

    if [[ ! "$TASK_ID" =~ ^[A-Z][A-Z0-9-]{2,63}$ ]]; then
      printf '%s\n' \
        '{"ok":false,"error":"invalid_task_id"}'

      exit 64
    fi

    exec "$NODE_BIN" \
      "$AGENT" \
      task-release \
      "$TASK_ID"
    ;;

  "bs-agent task-run "*)
    TASK_ID="${REQUESTED_COMMAND#bs-agent task-run }"

    if [[ ! "$TASK_ID" =~ ^[A-Z][A-Z0-9-]{2,63}$ ]]; then
      printf '%s\n' \
        '{"ok":false,"error":"invalid_task_id"}'

      exit 64
    fi

    exec "$NODE_BIN" \
      "$AGENT" \
      task-run \
      "$TASK_ID"
    ;;

  "bs-agent task-verify "*)
    TASK_ID="${REQUESTED_COMMAND#bs-agent task-verify }"

    if [[ ! "$TASK_ID" =~ ^[A-Z][A-Z0-9-]{2,63}$ ]]; then
      printf '%s\n' \
        '{"ok":false,"error":"invalid_task_id"}'

      exit 64
    fi

    exec "$NODE_BIN" \
      "$AGENT" \
      task-verify \
      "$TASK_ID"
    ;;

 "bs-agent task-retry "*)
    TASK_ID="${REQUESTED_COMMAND#bs-agent task-retry }"

    if [[ ! "$TASK_ID" =~ ^[A-Z][A-Z0-9-]{2,63}$ ]]; then
      printf '%s\n' \
        '{"ok":false,"error":"invalid_task_id"}'

      exit 64
    fi

    exec "$NODE_BIN" \
      "$AGENT" \
      task-retry \
      "$TASK_ID"
    ;;

  "bs-agent task-engine "*)
    TASK_ID="${REQUESTED_COMMAND#bs-agent task-engine }"

    if [[ ! "$TASK_ID" =~ ^[A-Z][A-Z0-9-]{2,63}$ ]]; then
      printf '%s\n' \
        '{"ok":false,"error":"invalid_task_id"}'

      exit 64
    fi

    exec "$NODE_BIN" \
      "$AGENT" \
      task-engine \
      "$TASK_ID"
    ;;

  "bs-agent task-supervise "*)
    TASK_ID="${REQUESTED_COMMAND#bs-agent task-supervise }"

    if [[ ! "$TASK_ID" =~ ^[A-Z][A-Z0-9-]{2,63}$ ]]; then
      printf '%s\n' \
        '{"ok":false,"error":"invalid_task_id"}'

      exit 64
    fi

    exec "$NODE_BIN" \
      "$AGENT" \
      task-supervise \
      "$TASK_ID"
    ;;

  "bs-agent external-watch" )
    exec "$NODE_BIN" "$AGENT" external-watch
    ;;

  "bs-agent external-watch "*)
    LIMIT="${REQUESTED_COMMAND#bs-agent external-watch }"

    if [[ ! "$LIMIT" =~ ^([1-9]|1[0-9]|2[0-5])$ ]]; then
      printf '%s\n' \
        '{"ok":false,"error":"invalid_watch_limit"}'

      exit 64
    fi

    exec "$NODE_BIN" "$AGENT" external-watch "$LIMIT"
    ;;

  "bs-agent workstream-resolve "*)
    WORKSTREAM_REF="${REQUESTED_COMMAND#bs-agent workstream-resolve }"

    if [[ ! "$WORKSTREAM_REF" =~ ^([a-z][a-z0-9-]{1,63}/)?[a-z][a-z0-9-]{1,63}$ ]]; then
      printf '%s\n' \
        '{"ok":false,"error":"invalid_workstream_reference"}'

      exit 64
    fi

    exec "$NODE_BIN" \
      "$AGENT" \
      workstream-resolve \
      "$WORKSTREAM_REF"
    ;;

  "bs-agent task-publish "*)
    TASK_ID="${REQUESTED_COMMAND#bs-agent task-publish }"

    if [[ ! "$TASK_ID" =~ ^[A-Z][A-Z0-9-]{2,63}$ ]]; then
      printf '%s\n' \
        '{"ok":false,"error":"invalid_task_id"}'

      exit 64
    fi

    exec "$NODE_BIN" \
      "$AGENT" \
      task-publish \
      "$TASK_ID"
    ;;

  "bs-agent run-start "*)
    REST="${REQUESTED_COMMAND#bs-agent run-start }"

    read -r SUIT_SLUG MAX_TASKS EXTRA <<< "$REST"

    if [[ -n "${EXTRA:-}" ]] \
      || [[ ! "$SUIT_SLUG" =~ ^[a-z][a-z0-9-]{1,63}$ ]] \
      || [[ ! "$MAX_TASKS" =~ ^[1-9][0-9]{0,2}$ ]]; then

      printf '%s\n' \
        '{"ok":false,"error":"invalid_run_start"}'

      exit 64
    fi

    exec "$NODE_BIN" \
      "$AGENT" \
      run-start \
      "$SUIT_SLUG" \
      "$MAX_TASKS"
    ;;


  "bs-agent run-check "*)
    RUN_ID="${REQUESTED_COMMAND#bs-agent run-check }"

    exec "$NODE_BIN" \
      "$AGENT" \
      run-check \
      "$RUN_ID"
    ;;


  "bs-agent run-acquire-task "*)
    REST="${REQUESTED_COMMAND#bs-agent run-acquire-task }"
    read -r RUN_ID CONTROLLER_PROTOCOL CONTROLLER_FINGERPRINT LEASE_TOKEN EXTRA <<< "$REST"

    if [[ "$REST" == *$'\n'* || "$REST" == *$'\r'* ]] \
      || [[ -n "${EXTRA:-}" ]] \
      || [[ ! "$RUN_ID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]] \
      || [[ "$CONTROLLER_PROTOCOL" != "cp-batch-v2" ]] \
      || [[ ! "$CONTROLLER_FINGERPRINT" =~ ^[0-9a-f]{64}$ ]] \
      || [[ ! "$LEASE_TOKEN" =~ ^[1-9][0-9]{0,19}$ ]]; then
      printf '%s\n' '{"ok":false,"error":"invalid_run_acquire_task"}'
      exit 64
    fi

    exec "$NODE_BIN" "$AGENT" run-acquire-task \
      "$RUN_ID" "$CONTROLLER_PROTOCOL" "$CONTROLLER_FINGERPRINT" "$LEASE_TOKEN"
    ;;


  "bs-agent run-complete-task "*)
    REST="${REQUESTED_COMMAND#bs-agent run-complete-task }"
    read -r RUN_ID TASK_ID IDEMPOTENCY_KEY EXTRA <<< "$REST"

    if [[ "$REST" == *$'\n'* || "$REST" == *$'\r'* ]] \
      || [[ -n "${EXTRA:-}" ]] \
      || [[ ! "$RUN_ID" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]; then
      printf '%s\n' '{"ok":false,"error":"invalid_run_complete_task"}'
      exit 64
    fi

    # Retain the one-argument ordinary-run interface. The database continues
    # to reject it for attributed/batch claims; the SSH adapter grants no credit.
    if [[ -z "$TASK_ID" && -z "$IDEMPOTENCY_KEY" ]]; then
      exec "$NODE_BIN" "$AGENT" run-complete-task "$RUN_ID"
    fi

    # BS-20 emits an exact run:task key. Never evaluate a command string.
    if [[ ! "$TASK_ID" =~ ^[A-Z][A-Z0-9-]{2,63}$ ]] \
      || [[ "$IDEMPOTENCY_KEY" != "$RUN_ID:$TASK_ID" ]]; then
      printf '%s\n' '{"ok":false,"error":"invalid_run_complete_task"}'
      exit 64
    fi

    exec "$NODE_BIN" "$AGENT" run-complete-task "$RUN_ID" "$TASK_ID" "$IDEMPOTENCY_KEY"
    ;;

  "bs-agent run-stop "*)
    SUIT_SLUG="${REQUESTED_COMMAND#bs-agent run-stop }"

    if [[ ! "$SUIT_SLUG" =~ ^[a-z][a-z0-9-]{1,63}$ ]]; then
      printf '%s\n' \
        '{"ok":false,"error":"invalid_suit_slug"}'

      exit 64
    fi

    exec "$NODE_BIN" \
      "$AGENT" \
      run-stop \
      "$SUIT_SLUG"
    ;;


  "bs-agent run-finish "*)
    REST="${REQUESTED_COMMAND#bs-agent run-finish }"

    read -r RUN_ID STATUS EXTRA <<< "$REST"

    if [[ -n "${EXTRA:-}" ]] \
      || [[ ! "$STATUS" =~ ^(finished|failed|cancelled)$ ]]; then

      printf '%s\n' \
        '{"ok":false,"error":"invalid_run_finish"}'

      exit 64
    fi

    exec "$NODE_BIN" \
      "$AGENT" \
      run-finish \
      "$RUN_ID" \
      "$STATUS"
    ;;

  *)
    printf '%s\n' \
      '{"ok":false,"error":"command_not_allowed"}'

    exit 126
    ;;

esac
