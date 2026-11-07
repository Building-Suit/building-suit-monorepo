#!/usr/bin/env bash
# Retired module-only entrypoint. Preserve earlier implementation in Git history.
# A child-count observation cannot exclude an in-flight claim, and stopping the
# legacy service may abort paid work. Do not provide an automatic bootstrap.
set -Eeuo pipefail
printf '%s\n' \
  'The legacy module-only updater is disabled: it cannot prove safe queue quiescence.' \
  'Use tooling/hq-agent-host/RELEASES.md for the separately approved baseline bootstrap.' \
  'Only after that bootstrap may the verified release updater manage this worker.' \
  'No files or services were changed.' >&2
exit 1
