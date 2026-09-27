# LS-PERF-002 — large-ledger read scalability

Status: implemented and verified in a disposable local PostgreSQL-compatible harness. Hosted staging API/browser acceptance remains required; this task did not deploy, modify a hosted database, or increase any statement timeout.

## Root cause and implementation

LS-PERF-001 correctly moved filtering and pagination ahead of `transaction_summaries`, but recent-page enrichment still traversed the security-invoker view. Each of the eight selected journals therefore re-entered capability-bearing RLS policies through entry, account, tag, attachment, profile and source-record lateral reads. The generic page plan also converted the date to text and sorted the full candidate population to satisfy the default recent-8 request.

The forward migration `20260927200000_large_ledger_read_scalability.sql` keeps the public RPC contract intact and makes these changes:

- `app.search_recent_transaction_page` uses a tenant-scoped partial index for the unfiltered date-descending path. It computes the exact count separately and applies `LIMIT/OFFSET` before enrichment.
- `app.search_transaction_details` accepts only the selected UUID page. It is a tightly scoped `SECURITY DEFINER` boundary that requires `transactions.read`, scopes every relation to the requested organization, and evaluates account/category/counterparty/tag/attachment/source capabilities once. `public.search_transactions` joins this bounded result back to the ordered page.
- Filtered searches continue through the established `app.search_transaction_page`, preserving search/filter/sort/count behavior. All 46 maintained variants are compared before/after for owner, accountant and viewer roles.
- `dashboard_summary` computes exact balance, cash/control and current/previous-month values in one posted-entry pass. Two partial covering entry indexes support Dashboard, monthly and liquid-account reads.

Table RLS remains enabled. Direct table/view reads keep their original policies. The migration does not write journals or entries, introduce a cache/rollup, return approximate values, or change `statement_timeout`.

## Local representative evidence

The maintained embedded harness supports the second-stage migration and a disposable large fixture:

```sh
node apps/ledger-suit/scripts/test-dashboard-performance-embedded.mjs \
  --migration=20260927200000_large_ledger_read_scalability.sql --large
```

The generated fixture contains 5,278 journals, 10,567 posted lines and 21 distinct months. It meets the minimum acceptance volume without changing any local or hosted Supabase database. The harness captures warm `EXPLAIN (ANALYZE, BUFFERS, SETTINGS)`, compares all four core payloads before/after, compares Trial Balance, P&L, Balance Sheet, AR/AP control, VAT, inventory and fixed-asset snapshots, checks every new trusted boundary for owner/accountant/viewer/outsider cross-tenant denial, verifies global RLS, and records five warm runs.

Recorded local PGlite evidence is in [embedded-explain.json](evidence/ls-perf-002/embedded-explain.json). PGlite timings are diagnostic local evidence, not hosted acceptance.

| Read | Before EXPLAIN ms | After EXPLAIN ms | Shared hits before → after | Five warm after-runs (ms) |
|---|---:|---:|---:|---|
| `dashboard_summary` | 15.123 | 13.771 | 1,570 → 995 | 20.808, 21.253, 21.955, 18.474, 16.443 |
| `report_monthly_series` | 5.646 | 3.977 | 82 → 79 | 4.896, 4.806, 4.266, 4.305, 4.342 |
| `search_transactions` recent-8 | 161.198 | 21.066 | 4,087 → 705 | 18.337, 17.486, 18.008, 17.791, 17.799 |
| `dashboard_liquid_accounts` | 6.187 | 6.361 | 504 → 292 | 7.040, 6.213, 6.750, 6.677, 7.104 |

The recent-8 before/after plans both wrote zero temporary blocks; after the migration, page enrichment is fed only the selected UUID array. Dashboard summary performs one exact entry aggregation and reduced shared-buffer hits by 36.6% in this run; native hosted PostgreSQL remains authoritative for latency acceptance.

The small-fixture run additionally passes 46 search variants × owner/accountant/viewer, capability-mask parity, exact history preservation, anonymous and cross-tenant denial, and RPC catalog checks:

```sh
node apps/ledger-suit/scripts/test-dashboard-performance-embedded.mjs \
  --migration=20260927200000_large_ledger_read_scalability.sql
```

## Hosted staging acceptance still required

PERF-05 is not complete from this local implementation. An independently authorized verifier must apply the reviewed migration through the normal serialized staging release and use the existing representative hosted company. No reseed or reduced dataset is acceptable.

Required hosted evidence:

1. Capture `EXPLAIN (ANALYZE, BUFFERS, SETTINGS)` and `pg_stat_activity`/`pg_stat_statements` where available before and after for the four core RPCs. Do not increase `statement_timeout`.
2. Record at least five warm API runs and confirm p95: summary, recent-8 and monthly series ≤1,500 ms; liquid accounts ≤750 ms.
3. Confirm exact pre/post accounting snapshots and owner/accountant/viewer/outsider plus capability-revocation behavior.
4. Run a real authenticated hosted Dashboard session. Network evidence must show all core requests returning 2xx, no PostgreSQL `57014`, no HTTP 500, no request beyond the bounded client/server timeout, recent real data without reload loops, and meaningful usability within 2,500 ms excluding first asset compilation.
5. Re-run the existing Dashboard failure/retry browser coverage so a failed read never renders the legitimate empty-company state.
