# LS-REL-CLOSE-001 — public posting versus period closure

2026-10-26. Parent: PR #494 at `25b667e7b1b46c713c0b636845e7704408d47df1`. Bounded continuation of LS-READY-001 order 3 and PER-08: actual independent-session close/post barriers for every source named in the combined acceptance matrix, plus annual-close retry. No financial function, applied migration, policy or presentation change.

The guarded DB-only project `ledger-period-close-20261026` binds port 60922 and receives the unchanged 107-migration chain, without seed data. Preparation validates ownership, exact config and migration bytes; start/stop select the local Unix Docker daemon while preserving registry authentication/proxy configuration. Reused volumes require the exact project label and a creation time consistent with the task marker. There is no reset or deletion command. All synthetic financial fixtures remain retained.

## Acceptance

The runner creates a separate authorized owner/organization per case, calls actual public RPCs as `authenticated`, holds the first command's transaction open, starts a second PostgreSQL process, and requires a real `pg_stat_activity` Lock wait before committing. Merely overlapping processes or sequential retry does not pass.

Ten sources run in both orders: manual income, opening-balance approval, bank adjustment, scoped Egyptian VAT, customer invoice, supplier bill, scheduled depreciation, inventory ingestion, dimensioned draft posting and fiscal-year close. Post-first commits exactly one additional balanced journal before hard closure. Close-first returns the source's explicit hard-closed error and preserves a digest of every physical tenant-scoped public/app table except legitimate period state/transition and audit records. This includes source documents, allocations, draft state, numbering and ledger entries. Both period transitions retain the actual actor. Annual close starts from a soft-closed period, as its existing contract requires.

The separate annual-close retry requires both results to contain exactly one identical UUID, one fiscal-close row, one additional closing journal, exact net income of 100 and unchanged historical P&L of 100. Depreciation uses the independent expectation `round(1000 × 31 / 365) = 85`; its pre-existing acquisition journal is included in before/after totals. Synthetic future dates and the current scoped 14% VAT rule are fixture inputs, not future tax-law claims.

See [the runbook](../../native-period-close-verification.md) and [dated results](../v2-acceptance/period-close-verification-2026-10-26.json). Results apply to this native source candidate; they do not establish hosted identity, accountant UAT, live Automation state or release readiness. The 138-row register is not promoted automatically.

Actual result: **21/21 paired native cases, 110/110 original SQL assertions across four suites, 130/130 Ledger units, helper lint and workspace checks pass.** The SQL rollback digest covers all 122 tables: `8c34ab095f59b20cfec6cd7ef0be5b4dc9631ffa92f59ea904ed5e5ce503bd8f`. Review publication and parent-aware release validation follow these local results.
