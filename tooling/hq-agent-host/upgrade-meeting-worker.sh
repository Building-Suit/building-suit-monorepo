#!/usr/bin/env bash
# Run on the existing Oracle host, with its existing sudo authority. This changes
# only worker.mjs; credentials, service configuration and journals are untouched.
set -Eeuo pipefail

staged_source=${1:?Usage: sudo bash upgrade-meeting-worker.sh SOURCE SHA256 [SERVICE] [DIRECTORY]}
expected_digest=${2:?Supply the SHA256 computed on the reviewed PC source}
worker_unit=${3:-company-hq-worker.service}
worker_directory=${4:-/opt/building-suit-hq-agent-host}
[[ $EUID == 0 ]] || { echo 'Use the existing sudo authority on the worker host.' >&2; exit 1; }
[[ $expected_digest =~ ^[a-f0-9]{64}$ && $worker_unit =~ ^[A-Za-z0-9_.@-]+\.service$ ]] || exit 1
[[ $worker_directory == /* && $worker_directory != *'..'* && $worker_directory != / ]] || exit 1
[[ -f $staged_source && ! -L $staged_source && -f $worker_directory/worker.mjs && ! -L $worker_directory/worker.mjs ]] || exit 1
actual_digest=$(sha256sum "$staged_source")
[[ ${actual_digest%% *} == "$expected_digest" ]] || { echo 'Source checksum mismatch; nothing changed.' >&2; exit 1; }
node --check "$staged_source"
unit_directory=$(systemctl show "$worker_unit" --property=WorkingDirectory --value)
unit_command=$(systemctl show "$worker_unit" --property=ExecStart --value)
[[ $unit_directory == "$worker_directory" && $unit_command == *"$worker_directory/worker.mjs"* ]] || {
  echo 'The selected service does not run this worker directory; nothing changed.' >&2; exit 1;
}
systemctl is-active --quiet "$worker_unit"
if cmp --silent "$staged_source" "$worker_directory/worker.mjs"; then
  echo 'This source is already installed; no restart needed.'
  exit 0
fi
worker_pid=$(systemctl show "$worker_unit" --property=MainPID --value)
[[ $worker_pid =~ ^[1-9][0-9]*$ ]] || exit 1
active_children=$(ps --ppid "$worker_pid" -o pid= || true)
[[ -z ${active_children//[[:space:]]/} ]] || {
  echo 'The worker has an active child. Let its current job finish, then retry.' >&2; exit 1;
}

backup_file="$worker_directory/worker.mjs.pre-meetings.$(date -u +%Y%m%dT%H%M%SZ).$$.bak"
replacement_file=$(mktemp --suffix=.mjs "$worker_directory/.meeting-worker.XXXXXX")
service_stopped=false
upgrade_verified=false
finish() {
  local result=$?
  trap - EXIT HUP INT TERM
  if [[ $service_stopped == true && $upgrade_verified != true ]]; then
    echo 'Restoring the previous worker module after an incomplete upgrade.' >&2
    systemctl stop "$worker_unit" || true
    cp -p "$backup_file" "$worker_directory/worker.mjs" || true
    systemctl start "$worker_unit" || true
    result=1
  fi
  rm -f "$replacement_file"
  exit "$result"
}
trap finish EXIT
trap 'exit 1' HUP INT TERM
cp -p "$worker_directory/worker.mjs" "$backup_file"
owner_id=$(stat -c %u "$worker_directory/worker.mjs")
group_id=$(stat -c %g "$worker_directory/worker.mjs")
file_mode=$(stat -c %a "$worker_directory/worker.mjs")
# Verify a private root-owned snapshot before any replacement is executed.
install -o 0 -g 0 -m 0600 "$staged_source" "$replacement_file"
replacement_digest=$(sha256sum "$replacement_file")
[[ ${replacement_digest%% *} == "$expected_digest" ]]
node --check "$replacement_file"
service_stopped=true
systemctl stop "$worker_unit"
chown "$owner_id:$group_id" "$replacement_file"
chmod "$file_mode" "$replacement_file"
mv "$replacement_file" "$worker_directory/worker.mjs"
systemctl start "$worker_unit"
systemctl is-active --quiet "$worker_unit"
installed_digest=$(sha256sum "$worker_directory/worker.mjs")
[[ ${installed_digest%% *} == "$expected_digest" ]]
upgrade_verified=true
echo "Worker module installed; previous module retained at $backup_file"
echo 'The existing service is active. This does not establish a completed meeting reply.'
