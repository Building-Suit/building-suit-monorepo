#!/usr/bin/env bash
# Deploy only Shop Suit's shop_crm migrations, then any local Edge Functions.
# This never links the checkout or replays the legacy public migration chain.
set -euo pipefail

project_ref=${SHOP_CRM_PROJECT_REF:-jkdncdexqcymwbihwdhp}
if [[ "$project_ref" != jkdncdexqcymwbihwdhp ]]; then
  printf 'This command is restricted to the confirmed Shop Suit project.\n' >&2
  exit 1
fi
repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
db_host=${SHOP_CRM_DB_HOST:-db.${project_ref}.supabase.co}
db_user=${SHOP_CRM_DB_USER:-postgres}
db_port=${SHOP_CRM_DB_PORT:-5432}
mode=${1:-apply}

if [[ "$mode" != apply && "$mode" != --dry-run ]]; then
  printf 'Usage: %s [--dry-run]\n' "$0" >&2
  exit 2
fi
for command_name in psql python3 supabase; do
  command -v "$command_name" >/dev/null || {
    printf 'Missing required command: %s\n' "$command_name" >&2
    exit 1
  }
done

if [[ -z "${SHOP_CRM_DB_PASSWORD:-}" ]]; then
  read -rsp "Database password for ${db_user}@${db_host}: " SHOP_CRM_DB_PASSWORD
  printf '\n'
fi
export SHOP_CRM_DB_PASSWORD

stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT
mkdir -p "$stage/supabase/migrations"
cat > "$stage/supabase/config.toml" <<'TOML'
project_id = "shop-crm-deploy-staging"
[db.migrations]
enabled = true
TOML

# The hosted database also has Building Suit migrations. Represent their
# already-applied versions with empty local placeholders; never replay them.
PGHOST="$db_host" PGPORT="$db_port" PGUSER="$db_user" \
  PGDATABASE=postgres PGSSLMODE=require PGPASSWORD="$SHOP_CRM_DB_PASSWORD" \
  psql -X -qAt -v ON_ERROR_STOP=1 \
    -c 'select version from supabase_migrations.schema_migrations order by version' \
    > "$stage/remote_versions"

for baseline_version in 20260918172351 20260918172444 20260918172654 20260918183616 20260918184731 20260918190026 20260918190816 20260918192011 20260918192741; do
  if ! grep -Fxq "$baseline_version" "$stage/remote_versions"; then
    printf 'Expected Shop Suit migration %s is absent; target may be wrong.\n' \
      "$baseline_version" >&2
    exit 1
  fi
done
while IFS= read -r version; do
  [[ "$version" =~ ^[0-9]{8,14}$ ]] || {
    printf 'Unexpected remote migration version: %s\n' "$version" >&2
    exit 1
  }
  printf '%s\n' '-- Already applied on the shared hosted project.' \
    > "$stage/supabase/migrations/${version}_remote_applied.sql"
done < "$stage/remote_versions"

shopt -s nullglob
shop_migrations=("$repo_root"/supabase/shop_crm_migrations/*.sql)
((${#shop_migrations[@]} > 0)) || {
  printf 'No scoped shop_crm migration files found.\n' >&2
  exit 1
}
declare -A seen_shop_versions=()
for migration in "${shop_migrations[@]}"; do
  filename=${migration##*/}
  [[ "$filename" =~ ^[0-9]{14}_[a-z0-9_]+\.sql$ ]] || {
    printf 'Unexpected migration filename: %s\n' "$filename" >&2
    exit 1
  }
  case "$filename" in
    20260918171948_shop_crm_read_isolation.sql)
      filename=20260918172351_shop_crm_read_isolation.sql ;;
    20260918172432_shop_crm_private_trigger_grants.sql)
      filename=20260918172444_shop_crm_private_trigger_grants.sql ;;
    20260918172641_shop_crm_legacy_function_paths.sql)
      filename=20260918172654_shop_crm_legacy_function_paths.sql ;;
    20260918183601_expose_shop_crm_data_api.sql)
      filename=20260918183616_expose_shop_crm_data_api.sql ;;
    20260918184551_bootstrap_owner_shop.sql)
      filename=20260918184731_bootstrap_owner_shop.sql ;;
    20260918185827_shop_product_catalog.sql)
      filename=20260918190026_shop_product_catalog.sql ;;
    20260918190537_shop_inventory_adjustments.sql)
      filename=20260918190816_shop_inventory_adjustments.sql ;;
    20260918191550_shop_service_catalog.sql)
      filename=20260918192011_shop_service_catalog.sql ;;
    20260918192529_shop_expense_ledger.sql)
      filename=20260918192741_shop_expense_ledger.sql ;;
  esac
  version=${filename%%_*}
  if [[ -n "${seen_shop_versions[$version]:-}" ]]; then
    printf 'Duplicate Shop Suit migration version: %s\n' "$version" >&2
    exit 1
  fi
  seen_shop_versions[$version]=1
  rm -f -- "$stage/supabase/migrations/${version}_remote_applied.sql"
  cp -- "$migration" "$stage/supabase/migrations/$filename"
done

db_url=$(python3 - <<'PY'
import os
from urllib.parse import quote

ref = os.environ.get('SHOP_CRM_PROJECT_REF', 'jkdncdexqcymwbihwdhp')
host = os.environ.get('SHOP_CRM_DB_HOST', f'db.{ref}.supabase.co')
port = os.environ.get('SHOP_CRM_DB_PORT', '5432')
user = quote(os.environ.get('SHOP_CRM_DB_USER', 'postgres'), safe='')
password = quote(os.environ['SHOP_CRM_DB_PASSWORD'], safe='')
print(f'postgresql://{user}:{password}@{host}:{port}/postgres?sslmode=require')
PY
)

printf 'Target: %s; database user: %s; scoped migrations: %s\n' \
  "$project_ref" "$db_user" "${#shop_migrations[@]}"
supabase db push --db-url "$db_url" --workdir "$stage" \
  --include-all --dry-run
if [[ "$mode" == --dry-run ]]; then
  printf 'Dry run complete; no database or function changes made.\n'
  exit 0
fi

read -rp "Type ${project_ref} to apply pending migrations: " confirmation
[[ "$confirmation" == "$project_ref" ]] || {
  printf 'Cancelled.\n' >&2
  exit 1
}
supabase db push --db-url "$db_url" --workdir "$stage" \
  --include-all --yes

function_dirs=()
if [[ -d "$repo_root/supabase/functions" ]]; then
  mapfile -t function_dirs < <(find "$repo_root/supabase/functions" \
    -mindepth 1 -maxdepth 1 -type d ! -name '_*' -printf '%f\n' | sort)
fi
if ((${#function_dirs[@]} == 0)); then
  printf 'No local Edge Functions; deployment skipped.\n'
  exit 0
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  read -rsp 'Supabase personal access token for function deployment: ' \
    SUPABASE_ACCESS_TOKEN
  printf '\n'
  export SUPABASE_ACCESS_TOKEN
fi
supabase functions deploy --project-ref "$project_ref" --workdir "$repo_root" \
  --use-api
