# LS-REL-CYCLE-001 — integrated native accounting cycle

2026-10-23. Parent: PR #451 at `c2964002f9e4a6a0c6c63c43277a9d5b1d4f7500`. Adds a permanent native pgTAP regression to the ordinary Ledger database suite. One authorized tenant completes actual AR invoice/receipt, AP bill/payment, asset purchase/registration/scheduled depreciation, bank import/matching/fee adjustment/completion, cash allocation, reports and period close/reopen. All synthetic writes roll back. No application function, applied migration or financial policy changes.

## Independent expected values

The retained V2 eight-journal worksheet specifies a manual depreciation adjustment of 2,000 minor units and still passes its 22 native checks unchanged. That is a different input from the approved asset module's daily-prorated schedule. For acquisition and service on 7 January 2036, a 24,000-unit asset over 12 months has 25 days in the first segment and 366 days in its life: `round(24000 × 25 / 366) = 1639`. The new regression tests that real module result explicitly; it does not change the policy or silently relabel the original worksheet.

Both scenarios use prior capital 100,000, customer invoice 30,000, receipt 12,000, supplier bill 18,000, payment 7,000, equipment purchase 24,000 and bank fee 300. The module scenario has:

| Result | Exact minor units |
|---|---:|
| Journals / posted entries | 8 / 16 |
| Total debits and credits | 192939 each |
| January debits and credits | 92939 each |
| Closing trial-balance debit and credit totals | 142639 each |
| Closing bank / customer / supplier balances | 80700 / 18000 / 11000 |
| Depreciation / net asset book value | 1639 / 22361 |
| Profit / total assets | 10061 / 121061 |
| Opening cash / operating cash / investing cash | 100000 / 4700 / -24000 |
| Financing / net cash change / closing cash | 0 / -19300 / 80700 |

AR/AP controls and asset cost/accumulated balances each reconcile to the GL. Explicit effective mappings and two source-entry cash allocations make working-capital adjustments and indirect cash flow complete. Three bank lines match the actual source journals; the fourth creates one authorized fee adjustment. Matching, registration and classification create no extra journals, and AR/AP/depreciation/fee retries retain the original identities.

After reconciliation, the same January period is soft closed, hard closed and reopened with reasons. New AR/AP/asset postings and an attempted settlement reversal are rejected in the closed period. The financial overview remains identical. Complete posted-journal and entry fingerprints match after all denied commands and close/reopen transitions; all four transitions retain the actor.

## Execution and limits

Run only in an owned disposable native local project with the current migration chain:

```sh
pnpm db ledger-suit test db --local apps/ledger-suit/supabase/tests/53_integrated_financial_cycle_test.sql
pnpm db ledger-suit test db --local
```

The focused test passes all 38 assertions. The complete native suite passes 65 files / 1,979 assertions in 28 seconds; the original worksheet still passes 22 checks. The 138-row acceptance validator, workspace and release checks pass.

The test uses real PostgreSQL functions, actual `authenticated` role/JWT claims and the current database schema. It creates no provider/schema shim, remote connection, reset or persistent financial fixture. The local runtime and results are recorded in [the dated evidence](../v2-acceptance/integrated-financial-cycle-2026-10-23.json). This is native database acceptance, not an accountant's browser/UAT verdict or deployment. Actual Storage transfer, timed second-instance restoration, hosted configuration, live Automation reconciliation and the accountant pilot remain independent readiness work.
