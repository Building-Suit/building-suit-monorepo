# Deploy `shop_crm` without linking this checkout

The command below is prepared for the confirmed hosted project
`jkdncdexqcymwbihwdhp`. It does **not** run `supabase link`, push to GitHub, start
local Supabase, deploy the frontend, or apply the incompatible historical
`supabase/migrations` chain. It stages only `supabase/shop_crm_migrations` in a
temporary CLI work directory, with placeholders for the shared project's
already-applied Building Suit migrations. Existing Shop Suit migration filenames
are mapped to their actual hosted migration versions, so rerunning does not
reapply them. Future Shop Suit migrations in that scoped directory retain their
filename versions and are the only database changes this command can push.

From the repository root, inspect the planned database changes first:

```bash
SHOP_CRM_PROJECT_REF=jkdncdexqcymwbihwdhp SHOP_CRM_DB_USER=postgres \
  bash scripts/push-shop-crm-supabase.sh --dry-run
```

Then apply any pending scoped migrations and deploy every local Edge Function:

```bash
SHOP_CRM_PROJECT_REF=jkdncdexqcymwbihwdhp SHOP_CRM_DB_USER=postgres \
  bash scripts/push-shop-crm-supabase.sh
```

The script prompts privately for the **database password** and shows a CLI
database dry run before asking for the project ref to proceed. The default
database address is `db.jkdncdexqcymwbihwdhp.supabase.co:5432`, username
`postgres`, TLS required. If your network cannot reach the direct database
connection, set `SHOP_CRM_DB_HOST`, `SHOP_CRM_DB_PORT`, and `SHOP_CRM_DB_USER` to
the **session pooler** connection details shown in the Supabase Dashboard; the
pooler username is typically `postgres.<project-ref>`. Do not put the password
in a committed file or shell command history.

When local Edge Functions exist, the script requests a **Supabase personal
access token** through `SUPABASE_ACCESS_TOKEN` or a private prompt, then runs
`supabase functions deploy --project-ref ... --use-api` without `--prune`. A
`service_role` key is an application API credential and does not authenticate
database migrations or CLI function deployment. Never put it in this command or
the browser. There are currently **no** `supabase/functions` in this repository,
so the function step is presently skipped. Adding a function later is a separate
architecture decision: Shop Suit currently requires Supabase Client access with
no custom API or Edge Function backend.

The three Task 03 migrations, Task 04c Data API role-setting migration and Task
05a owner-bootstrap migration, Task 08a product-catalog and service-catalog
migrations, Task 09a manual-inventory migration, and Task 11a expense-ledger
migration were
already applied to the cloud through the connected Supabase migration tool. With
no newer scoped migration files, the dry run should show no pending database
work. The script checks for those nine hosted versions before doing anything,
helping catch a wrong database target. The Data API migration is mapped from its
local CLI filename to hosted version `20260918183616`; see [Task 04c](04c-data-api-exposure.md)
for its scope and the Dashboard-management tradeoff. The owner-bootstrap
migration maps to hosted version `20260918184731`; the product migration maps
to `20260918190026`; manual inventory maps to `20260918190816`; services map
to `20260918192011`; expenses map to `20260918192741`. The script only pushes
scoped SQL migrations; it does not edit the project's Data API setting through
the Management API.

Supabase documents [`db push --db-url` and dry runs](https://supabase.com/docs/reference/cli/supabase-db-push)
and [function deployment with a project ref and personal access token](https://supabase.com/docs/guides/functions/deploy).
