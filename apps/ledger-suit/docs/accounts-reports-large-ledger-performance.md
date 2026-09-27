# LS-PERF-003 — Accounts and reports large-ledger performance

Status: implemented and verified against the disposable representative local fixture. Hosted-staging API/browser acceptance remains required; this work did not deploy, modify a hosted database, increase a statement timeout, or add a financial cache/read model.

## Root cause and repair

The Accounts page still expanded the generic `public.account_balances` security-invoker view. On a large tenant, its aggregate and correlated history checks repeatedly crossed capability-bearing RLS policies. The Reports page initialized every tab's RPC even when that tab was inactive. Overview separately requested P&L, classified Balance Sheet, Trial Balance, integrity, and reconciliation, while reconciliation itself repeatedly executed several of those reports.

Forward migration `20260928010000_accounts_reports_large_ledger_hotfix.sql` makes the bounded changes:

- `public.read_account_balances` authorizes `accounts.read` once, explicitly scopes both entry populations to the organization, aggregates posted entries once, and returns the exact Accounts tree/table/editor projection, including zero-balance and archived accounts.
- `public.report_financial_overview` authorizes `reports.read` once and derives P&L, classified Balance Sheet, six-column Trial Balance, integrity, and statement reconciliation from one materialized tenant ledger slice. The established reconciliation signature delegates to this result.
- Existing detailed report functions retain their signatures and exact calculations. Their already explicit capability checks and tenant/account predicates now execute as trusted reads, avoiding per-row RLS policy re-evaluation. Global table RLS remains enabled.
- The Reports page issues only the RPCs required by the active tab. Overview uses the combined RPC; P&L, Balance Sheet, Cash Flow, and General Ledger remain lazy. Every active surface retains an explicit error/retry state, so a failed request cannot appear as legitimate empty financial data.
- The new history index supports exact `classification_locked` and control-binding metadata. No balance or report result is stored, cached, approximated, or made stale.

## Representative local evidence

Run from a worktree with the optional isolated PGlite validation dependency:

```sh
node apps/ledger-suit/scripts/test-dashboard-performance-embedded.mjs \
  --migration=20260928010000_accounts_reports_large_ledger_hotfix.sql --large
```

The generated fixture contains 5,278 journals, 10,567 posted lines, and 21 distinct months. The harness records `EXPLAIN (ANALYZE, BUFFERS, SETTINGS)`, exact before/after payload comparisons, five repaired warm runs, owner/accountant/viewer/outsider and anonymous negative checks, and global RLS checks. Evidence is in [embedded-explain.json](evidence/ls-perf-003/embedded-explain.json). PGlite timing is diagnostic local evidence, not hosted acceptance.

| Read | Baseline EXPLAIN ms | Repaired EXPLAIN ms | Five repaired warm runs (ms) |
|---|---:|---:|---|
| Accounts balances | 13,126.695 | 11.040 | 12.446, 12.296, 13.537, 12.714, 13.386 |
| Reports Overview | Separate old calls; reconciliation alone 49,328.078 | 48.312 | 46.405, 62.325, 58.497, 59.239, 56.696 |
| Trial Balance | 12,670.655 | 13.042 | 12.865, 19.093, 16.398, 18.873, 16.655 |
| Profit & Loss | 21.260 | 10.530 | 4.409, 3.456, 2.876, 2.675, 2.588 |
| Balance Sheet | 12,177.449 | 12.409 | 12.676, 12.300, 11.527, 12.084, 11.972 |
| General Ledger | 11,994.517 | 30.278 | 126.108, 128.544, 129.813, 131.940, 126.933 |
| Cash Flow | 50,292.597 | 96.549 | 88.048, 153.281, 174.375, 166.840, 165.217 |

The harness proves exact parity for the Accounts UI projection, six-column Trial Balance, P&L, classified Balance Sheet, balance-sheet integrity, statement reconciliation, indirect Cash Flow and its detailed sources, and General Ledger. The retained accounting snapshot also compares AR/AP control, VAT, inventory, and fixed assets. Journals and entries are byte-for-byte JSON-equivalent before and after the migration.

## Hosted staging acceptance still required

PERF-08 cannot be accepted from this local implementation. An independently authorized verifier must apply the reviewed migration through the serialized Ledger staging release and use the existing representative hosted company without reducing or reseeding it.

Required hosted evidence:

1. Capture the corresponding before/after native PostgreSQL plans and at least five warm API runs without changing `statement_timeout`.
2. Confirm p95: Accounts balance ≤1,000 ms; Overview, Trial Balance, P&L, Balance Sheet, and General Ledger ≤1,500 ms; Cash Flow ≤2,000 ms; Accounts meaningful usability ≤2,000 ms.
3. Run real authenticated Accounts and Reports sessions and retain Network evidence showing core requests return 2xx with no PostgreSQL `57014`, HTTP 500, or indefinite pending request.
4. Reconfirm exact accounting outputs and owner/accountant/viewer/outsider cross-tenant denial in hosted staging.
5. Re-run failure/retry browser coverage so a rejected or timed-out report never renders the legitimate empty state.
