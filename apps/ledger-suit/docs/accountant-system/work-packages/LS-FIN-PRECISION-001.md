# LS-FIN-PRECISION-001 — exact financial report transport

2026-10-23. Parent: PR #449, `fe8ed4c45bb760d4f0e1cbdb5107fc940c3e831a`. While preparing the integrated accounting-cycle rehearsal, the real Supabase JavaScript client demonstrated an amount of `9007199254740993` becoming `9007199254740992` when parsing the existing numeric JSON report. PostgreSQL and the CSV export retained the original digits; the UI transport boundary did not.

The P&L, General Ledger and cash-detail table reads now request PostgREST text casts for monetary fields. These remain table-returning requests with the existing row limits. A forward migration adds a narrow invoker RPC for the existing overview, indirect cash flow and allocation context. Its private pure serializer turns monetary fields and allocation values into strings while preserving row counts, booleans, ordering, nulls and empty structures. The original SQL report contracts remain available.

Cash allocation now submits integer minor-unit strings. A separate invoker adapter canonicalizes those values to numeric JSON in PostgreSQL before the original payload-bound retry check. This avoids both JavaScript rounding and a string-versus-number retry conflict. Authorization, row locking, stale-decision rejection, total validation and audit writes still run through the original command. Report reconciliation and allocation presentation use exact integer/string values.

## Verification and preservation

The evidence record is [exact-report-transport-2026-10-23.json](../v2-acceptance/exact-report-transport-2026-10-23.json). The native runner reproduces the old rounding and checks the replacement through the actual Supabase client and PostgREST 16.1/PostgreSQL 17.6. It covers all affected report reads, exact allocation save/replay, changed-retry conflict, stale decision, incomplete totals and outsider/viewer rejection. The retained portability checks still validate 103 tables, four CSVs and their on-disk hashes.

Before and after applying the one new migration to the explicitly disposable local database, all 122 existing `public`/`app` table fingerprints matched: SHA-256 `6d36874ca1618faf5caee55633fb41eeeff6d4d71732816b50c415d7c7254b86`. Existing 22 journals, 44 entries, 163 audit rows and three operator-audit rows were preserved. The original 105 migration files remain unchanged. Test fixtures run afterward are separately identified synthetic records; no hosted migration or customer-data operation occurred.

All 64 native SQL files / 1,941 assertions, 128 Ledger units and 18 report browser cases pass. Ledger typecheck, lint, production build and workspace checks pass. Database lint retains 21 existing product warnings across 13 functions, zero errors and no new adapter findings. An old observer fixture was corrected to identify its own two payment summaries alongside retained prior records.

Native database tests also cover serializer structure/types, anonymous grants, invoker authority and tenant rejection. Browser fixtures cover the report surfaces in EN/AR, light/dark and three viewport sizes, exact large-number display, and allocation submissions above JavaScript's exact integer range. Browser fixtures are UI evidence; the independent native runner supplies actual database/API evidence.

This task does not establish accountant UAT, actual Storage-byte transfer, a timed second-instance restore, ETA preproduction, hosted deployment or live Automation queue completion. Continue the integrated AR/AP/assets/bank/CF cycle and recovery rehearsal under LS-READY-001; those remain separate evidence gates.
