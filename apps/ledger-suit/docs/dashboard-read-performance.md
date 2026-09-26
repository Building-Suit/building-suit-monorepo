# LS-PERF-001 — RLS-aware Dashboard reads

Worktree branch: `codex/ledger-suit/ls-perf-001`; initial HEAD: `088caff`. No pre-existing working-file changes were present.

Status: implemented locally; reproduction-environment performance and browser acceptance remain unverified. No commit, push, merge, deployment, hosted database change, or modification of the accountant demo history was performed.

## Implementation

The forward migration `20260927140000_rls_aware_dashboard_reads.sql` changes only reads and function privileges. Applied migrations, financial write APIs, table RLS, and the normal application statement timeout remain unchanged. No balance cache or shared-package changes are introduced.

- `app.search_transaction_page` checks `transactions.read` and membership once, then filters, counts, sorts and pages a narrow set of tenant-scoped transaction IDs. It computes line sums only for amount filters/sorts and reads leading account names only for text searches. Name/tag filtering checks the corresponding effective capability once, preserving custom-role and per-member revocations.
- The existing public `search_transactions` signature, result columns, sort rules, limit/offset normalization and empty-page behavior remain intact. It materializes the candidate page, then performs parameterized enrichment through the unchanged **security-invoker** `transaction_summaries` view. Consequently profile, attachment, tag and Journal Center source-record visibility still follow their existing RLS policies. Inventory/commitment/recurring/import precedence and reversal/correction links remain owned by that view.
- `dashboard_summary` and `report_monthly_series` become tightly scoped `SECURITY DEFINER` reads owned by `postgres`, with empty search paths, explicit organization predicates on both accounts and entries, and authenticated-only execution. Each requires `reports.read` before looking up even the default organization date. Account/entry capability masking is evaluated once and preserves the previous RLS-visible results, including custom revocations.
- `dashboard_liquid_accounts` requires membership and `accounts.read`. It aggregates posted entries for the requested organization's non-archived liquid accounts and preserves `net_debit_minor` as decimal text. Entry visibility still depends on `transactions.read`. The Dashboard uses this RPC instead of computing the broader account classification/control/history view.
- `app` remains an unexposed implementation schema. Its helper nevertheless authorizes direct calls. No anonymous/public execution is granted to any changed trusted boundary.

The existing RLS predicates call `app.has_capability`, which resolves membership/role/subscription capabilities; account reads also check membership explicitly. Invoker aggregates and the old search ran these checks across account/entry rows, with the old search enriching all matching journals before its limit. The new design bounds enrichment to the requested page and avoids repeated capability evaluation across report rows.

## Local verification

Run the focused disposable SQL harness from the repository root:

```sh
# Optional verification dependency, isolated from workspace/product dependencies:
npm install --prefix .local/perf-validation --no-save --package-lock=false @electric-sql/pglite@0.3.16
node apps/ledger-suit/scripts/test-dashboard-performance-embedded.mjs
```

The harness creates a new in-memory PostgreSQL database, supplies minimal provider Auth/Storage/Cron shims, loads the migration history, and creates only its own small synthetic fixture. It never connects to Supabase or reads environment credentials. Its fixture is **not** a replacement for the original 5,276-journal / 10,563-posted-line dataset. The fixture includes two organizations, owner/accountant/viewer/outsider identities, multi-line postings, tied dates, a reversal, a draft, previous-month income, current-month income/expense, category/counterparty/tag filters, a commitment source link and an empty VAT registration for the snapshot probe.

The harness loads `scripts/fixtures/dashboard-performance.sql`. Keep this setup-only SQL outside `supabase/tests`: Supabase recursively discovers SQL files there as pgTAP tests, and this fixture does not emit a TAP plan.

The task-specific native pgTAP suite is `supabase/tests/50_dashboard_read_performance_test.sql`. It creates its own small fixture inside a rolled-back transaction and emits 83 assertions covering owner/accountant/viewer report values, recent-page counts, sorting/filtering/pagination, all five reporting/search boundaries' cross-tenant and anonymous rejection, capability revocations, and continued table RLS. Run only this file against an already prepared disposable local database:

```sh
pnpm db ledger-suit test db supabase/tests/50_dashboard_read_performance_test.sql --local
```

During the verification-failure repair, this native command was blocked by the CLI attempting to write its telemetry file outside the writable sandbox. A focused PGlite smoke run executed the new SQL with temporary assertion adapters and passed all 83 assertions; this validates SQL behavior but is **not** a native pgTAP run. Native pgTAP and final acceptance remain with the control plane. The implementation, embedded fixture and existing evidence were preserved.

The embedded harness compares all returned columns before/after the migration for 46 search variants per owner/accountant/viewer, summary/monthly values, liquid balances, and every journal/entry row. It checks per-member revocations, cross-tenant access through all five boundaries, anonymous denial, and continued table RLS. It captures warm-up and `EXPLAIN (ANALYZE, BUFFERS, SETTINGS)` for all four paths and inspects the public search query plan for exactly eight summary transaction lookups. Artifacts are written to `.local/perf-validation/explain.json`.

`--generate-contract` regenerates the additive `types/dashboard-rpc.types.ts` from the migrated PostgreSQL catalog; ordinary test runs verify it matches. The existing generated whole-database catalog is preserved.

Focused checks actually attempted in this worktree:

| Check | Result |
|---|---|
| Initial embedded SQL regression | Passed: 46 variants × three roles, reports/liquid balances/history, cross-tenant and anonymous rejection |
| `node apps/ledger-suit/scripts/test-dashboard-performance-embedded.mjs` (final run) | Passed: search/report parity, capability masking, isolation, EXPLAIN, catalog contract check and read-only snapshot probe |
| `node --test apps/ledger-suit/tests/unit/account-nature.test.mjs apps/ledger-suit/tests/unit/accountant-reference.test.mjs` | Passed (both test files) |
| `node --check apps/ledger-suit/scripts/test-dashboard-performance-embedded.mjs` | Passed |
| `git diff --check` | Passed |
| `pnpm agent:preflight` | Failed: fetch/GitHub state could not be verified; base/head publication decisions remain unverified |
| `pnpm db ledger-suit migration new rls_aware_dashboard_reads` | Blocked: Supabase CLI absent; additive migration file created locally with the next task timestamp |
| `pnpm install --offline --frozen-lockfile --ignore-scripts` | Blocked by read-only default store registration |
| Same install with `--store-dir .local/pnpm-store` | Blocked by missing offline tarball (`@fontsource-variable/manrope`) |
| `pnpm --filter @building-suit/ledger-suit typecheck` and `build` | Blocked: `nuxt` is unavailable because dependencies could not be installed |
| Local Supabase / real browser Dashboard | Unrun: no listener on `127.0.0.1:60322`; Docker socket access denied; no runnable Nuxt dependencies |

The optional PGlite package was restored from the existing local package cache into this worktree; verification does not depend on another checkout.

Recorded [embedded query plans](evidence/ls-perf-001/embedded-explain.json) include the four pre/post calls and the expanded page-enrichment plan. These are warm results on the **small disposable fixture**, measured in milliseconds, and are not reproduction-environment acceptance:

| Read | Before ms | After ms | Shared-buffer hits before → after |
|---|---:|---:|---:|
| Dashboard summary | 186.465 | 4.341 | 3,381 → 181 |
| Monthly series | 111.676 | 3.731 | 2,196 → 167 |
| Recent 8 | 294.818 | 113.133 | 5,626 → 2,304 |
| Liquid balances | 20.200 | 2.518 | 386 → 50 |

All four recorded after-plans show zero temporary blocks written. The expanded search plan performs eight indexed summary transaction lookups. The read-only probe also executed successfully before/after and returned identical Trial Balance, P&L, Balance Sheet, Controls, VAT, inventory and fixed-asset snapshots. This small fixture has no AR/AP, VAT, inventory or asset module activity; those module results do not establish accountant-scale reconciliation coverage. The original seeded reconciliations and native production planner remain unverified.

## Independent reproduction verification still required

Use the **same existing synthetic dataset**, without resetting/reseeding it or changing posted history. This task does not authorize applying the migration to a hosted database. An independent verifier needs an authorized disposable clone or a separately authorized environment containing that dataset.

Before and after the forward migration, collect the read-only probe with identical user, organization and dates:

```sh
psql -X -v organization_id=UUID -v actor_id=OWNER_UUID \
  -v from_date=YYYY-MM-DD -v to_date=YYYY-MM-DD -v after=false \
  -f apps/ledger-suit/scripts/dashboard-performance-evidence.sql > before.txt
# Apply the reviewed migration only to an authorized disposable environment.
psql -X -v organization_id=UUID -v actor_id=OWNER_UUID \
  -v from_date=YYYY-MM-DD -v to_date=YYYY-MM-DD -v after=true \
  -f apps/ledger-suit/scripts/dashboard-performance-evidence.sql > after.txt
```

Use an explicitly selected connection to the verified environment. The probe starts a read-only transaction, switches to `authenticated`, sets the selected actor claims, records timeout/work_mem, warms the reads, and rolls back. It does not increase a timeout. It also emits comparable Trial Balance, P&L, Balance Sheet, AR/AP Controls, VAT, inventory and fixed-asset snapshots. Compare those values with the independently reviewed seeded expectations and the pre-migration results.

Required remaining evidence:

1. Seeded warm timings: summary <1.5s, monthly series <1.0s, recent-8 <1.5s without temp spill, liquid accounts <1.0s. The task's reported baselines (11.316s / 0.979s / 51.139s / 3.280s) were supplied by the task, not remeasured here.
2. Seeded owner/accountant/viewer/outsider checks against every changed boundary, including direct tables/views. Local role tests are functional evidence only.
3. All listed seeded accounting reconciliations unchanged.
4. A real authenticated Dashboard load with Network inspection showing zero HTTP 500 / PostgreSQL 57014 responses. Record actual request timings, identity role, and environment without credentials.
5. Ledger typecheck/build and the relevant native Supabase SQL/API checks after installing the pinned dependencies.

Deploy the SQL before the UI in any later authorized release because the Dashboard calls the new RPC. Recovery must use a reviewed forward migration; retain financial history and table RLS. This handoff does not claim deployment, UAT, or PERF-01/PERF-02/VAL-03/VAL-06/VAL-08 acceptance on the reproduction environment.
