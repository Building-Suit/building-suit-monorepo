# V2-IMP-015 — cross-module acceptance review

Status: **BLOCKED / acceptance incomplete**, 2026-09-26. This is an acceptance package, not a release or an accountant sign-off. No runtime code, applied migration, hosted database, deployment, commit or publication was changed.

Reviewed checkpoint: `78cbf947e1a308d44c3b8e955ee7b38727d2605b`, branch `codex/ledger-suit/v2-imp-015`. Worktree: `.local/worktrees/ledger-suit-v2-imp-015`. Initial working tree was clean. Local `origin/stg` was `2b3b5d6c6e1493a6b0295d484c2769936805d5cf`; it is stale/unverified. Preflight failed because fetch cannot write the read-only Git metadata outside this worktree. Live PR/parent/merge state was not established. The control plane owns publication.

The supplied task JSON is authoritative for this task and approves V2-D03. Dependency task labels saying “complete” do not establish SQL, browser, deployment or accountant acceptance. Runtime defects must be separate controlled repair tasks; the findings below are proposed repair scopes, not externally created tasks.

## Review artifacts and actual results

- [Requirement register](requirements.json): all 138 baseline requirements retain their measurable criteria and prior evidence, with distinct current `code_implemented`, `tests_passed`, `deployed`, and `accountant_accepted` fields. Historical assessments are explicitly separate. `unverified` does not mean missing; no whole requirement is promoted by a passing unit file.
- [Independent worksheet](expected-balances.json): synthetic inputs and hand-specified expected results, recomputed using integer arithmetic by [the offline validator](../../../scripts/verify-v2-acceptance-artifacts.mjs). It imports no application calculation. This verifies worksheet consistency, not the application's results or an accountant's judgment.
- [Shared-story SQL probe](../../../scripts/verify-v2-reconciliation.sql): fresh synthetic organization, real AR/AP public commands, partial settlement, duplicate retries, per-journal equality, GL/TB/Balance Sheet/P&L/Control comparisons, and rename/archive observation. All writes roll back. **Not executed.** Manual equipment/depreciation/fee entries in this probe do not establish fixed-asset or bank-module acceptance.
- [Migration snapshot](../../../scripts/v2-migration-snapshot.sql): read-only counts, base-currency debit/credit sums, individual imbalance count, posted identity/entry digests, dated TB/BS/P&L and Control results. **Not executed; no paired migration evidence exists.** MD5 here is a change detector, not a security signature. Requires the V2 reporting/control RPCs on both sides of the candidate migration.

| Command/check actually attempted | Result |
|---|---|
| `pnpm agent:preflight` | Failed, exit 1; live Git state unverified |
| `git fetch origin --prune` | Failed: worktree Git `FETCH_HEAD` is read-only |
| `docker info --format '{{.ServerVersion}}'` | Failed: Docker socket permission denied |
| `pnpm --filter @building-suit/ledger-suit test:unit` | Passed all 14 existing test files, zero failed/skipped; not SQL/E2E evidence |
| `pnpm install --offline --frozen-lockfile --ignore-scripts` | Failed writing pnpm's external store project registration |
| Same install with `--store-dir .local/pnpm-store` | Failed: offline store lacks `@fontsource-variable/manrope` tarball; dependency setup incomplete |
| `pnpm db:test:ledger` | Failed before SQL execution: `supabase` executable unavailable |
| `pnpm --filter @building-suit/ledger-suit exec playwright test tests/e2e/financial-statements-v2.spec.ts --workers=1` | Failed before collection: available Playwright CLI reports `unknown command 'test'`; pinned workspace test dependencies absent |
| `node apps/ledger-suit/scripts/verify-v2-acceptance-artifacts.mjs` | Passed: 138 distinct rows/four states and exact eight-journal worksheet reconciliation |
| `pnpm check` | Passed token generation comparison, workspace boundaries and 80 preserved historical migrations |
| `node --check apps/ledger-suit/scripts/verify-v2-acceptance-artifacts.mjs` | Passed JavaScript syntax check |
| JSON parsing and local acceptance README link check | Passed |
| `git diff --check` | Passed |

No fresh cumulative replay, native SQL, concurrent sessions, migration recovery drill, browser flow, responsive screenshots, sanitized customer dataset, deployment inspection or accountant acceptance was performed. No prior task's run is relabelled as this task's run. No shimmed database substitutes for native Supabase evidence. No attempt was made to modify a hosted database.

## Shared accounting story and measurable outcomes

Use EGP minor units, one new organization, calendar fiscal year, report dates **2036-01-01 through 2036-01-31**, opening cut-off 2035-12-31. The worksheet contains eight events: prior-period capital 100000; invoice 30000; receipt 12000; bill 18000; payment 7000; equipment acquisition 24000; depreciation 2000; fee 300. AR and AP must use their authoritative providers; posting manual Control entries is not an acceptable substitute.

Expected journals/entries: **8/16**, including identical AR/AP retries. Total debits and credits: **193300 each**. TB opening: **100000 each**; period: **93300 each**; closing: **143000 each**. Closing bank: **80700**; AR: **18000**; AP: **11000**. Net equipment: **22000**. Profit: **9700**. Assets and liabilities plus equity: **120700 each**. January cash bridge: 100000 opening +4700 operating −24000 investing +0 financing =80700 closing. Cash-flow worksheet expectations still need mapped-report/module execution; the SQL probe does not certify cash-flow classification completeness.

Compare every account, not only grand totals. No unexplained variance is acceptable. Zero-row/unavailable providers must fail acceptance rather than count as reconciled. Capture organization, date, currency, dimension filters and cutoff in every export. Synthetic data is sufficient for this prepared probe; no authorization or sanitized real customer dataset was supplied.

## Selected integrated verification matrix — all database/browser rows pending

Paths below are relative to `apps/ledger-suit`. Selection is deliberate: current invariants and each implemented module, not a claim that running historical files independently proves the integrated story.

| Area | Existing evidence to execute on cumulative migrations | Additional integrated acceptance |
|---|---|---|
| Hierarchy/Contra/Control, COA-09/VAL-02 | SQL `28_account_nature`, `29_account_groups`, `37_control_accounts`; E2E `control-accounts`, `account-groups` | Group totals count each leaf once; both dated AR/AP variances zero; shared story matches GL |
| Opening/TB/journal, VAL-03 | SQL `32_posting_idempotency_integrity`, `33_six_column_trial_balance`, `34_journal_center`, `39_opening_balance_migrations`; E2E `opening-balances`, `journal-center`, `trial-balance-verification` | Import retry once, preserved cut-off, saved-view isolation, report/journal drill-down context; numbering repair below |
| Statements/FS-08 | SQL `41_financial_statement_mappings`; E2E `financial-statements-v2` | Same dates/filters on TB/GL/BS/P&L/CF; snapshot labels and balances before rename/archive and after; explicit limitation disposition |
| AR/AP, VAL-04 | SQL `40_customer_subledger`, `42_supplier_subledger`; E2E `customer-subledger-ui`, `supplier-subledger-ui` | Shared bank/account context, partial allocation, credit/reversal, aging at boundaries, no duplicate income/expense; both Controls match |
| Periods | SQL `35_accounting_periods`, `36_accounting_period_concurrency`, `40_opening_balance_concurrency`; E2E `accounting-periods` | Every posting source races close; reopening requires permission/reason and leaves audit |
| Bank | SQL `42_bank_reconciliation`; E2E `bank-reconciliation` | Statement balance + explained outstanding items = GL; matching creates no journal; fee posts once |
| Assets | SQL `43_fixed_assets`; E2E `fixed-assets` | Register cost/accumulated depreciation/net value = GL, depreciation once per period, disposal clears cost/Contra and reconciles gain/loss |
| Dimensions | SQL `44_accounting_dimensions`; E2E `accounting-dimensions` | Each dimension group plus Unassigned = same unfiltered ledger; exact split allocations; archived values preserve history |
| Approved VAT | SQL `45_approved_egypt_vat`; E2E `egypt-vat` | Source documents = dated VAT report = tax GL; correction/reversal linked; only approved configuration. No new regulatory assessment in this review |
| Approved inventory | SQL `46_inventory_accounting`; E2E `inventory-accounting` | Synthetic source facts through Ledger contract; valuation/COGS/source snapshots = GL; no other app internals or costing substitute |

SQL filenames end in `_test.sql` under `supabase/tests`; browser filenames end in `.spec.ts` under `tests/e2e`. `02_tenant_isolation_test.sql` and module-local denial assertions cover the retained tenant boundary. Include the relevant existing exact-money unit files; these passed locally as recorded above.

For **each** manual, opening, AR, AP, bank-adjustment, asset, dimensioned, VAT, inventory and year-close source, record separate results for: owner success; viewer write denial; foreign-organization read/write denial; inactive/read-only organization denial; identical retry; changed-payload conflict; simultaneous duplicate; simultaneous close/post; and original/reversal history preservation. Merely finding a test or running a sequential retry is not a concurrency pass.

Existing `scripts/test-{customer-subledger,supplier-subledger,fixed-assets,inventory}-concurrency.mjs` have their own explicit disposable opt-ins and ownership guards. Respect those guards; they do not automatically target one combined instance. A combined-source close/post run is still missing evidence. Capture session lock waits, winner/loser outcomes, journal counts, audit and final period state. If close wins, no prohibited journal; if post wins, exactly one journal precedes close. Record actual gaps as separate repairs without changing assertions to hide them.

## Rehearsal and recovery handoff

1. On a machine with pinned dependencies and Docker access, create a new Ledger-only disposable Supabase project **inside this worktree**, using a unique project ID and unoccupied ports. Copy the Ledger config/migrations/seed; verify byte-for-byte migration hashes and the resolved CLI workdir/container ownership label before any write. Do not reset the ordinary local project or reuse a hosted connection. Existing browser fixtures require 60321; reserve that port for the explicitly owned disposable backend or report the conflict.
2. Replay the entire ordered migration chain from empty using the pinned CLI, preserve per-migration start/end times, exit codes, migration hashes and native logs. Stop at the first failure and register a repair; do not skip/patch history or replace provider-managed schemas with stubs.
3. Execute the selected SQL and shared-story probe with failure propagation (`psql -X -v ON_ERROR_STOP=1` for the probe; the maintained SQL runner for pgTAP suites). Preserve native TAP/exception output. The probe rolls back; it is not a persistent fixture for snapshot/recovery. Prepare a separate committed synthetic fixture through authorized public commands for those rehearsals, recording its IDs and independent balances.
4. For a candidate repair migration, snapshot that fixture before/after using identical `actor_id`, `organization_id`, `from_date`, `to_date`. Run [v2-migration-snapshot.sql](../../../scripts/v2-migration-snapshot.sql) read-only and save canonical JSON. Require nonempty expected journals, zero individual imbalances and exact unchanged history digests/counts/balances; review every intended nonfinancial difference explicitly. Supplement with module-specific bank/asset/dimension/VAT/inventory report snapshots. Older migration points lacking V2 RPCs require separately reviewed core-ledger snapshots; do not silently skip those stages.
5. Preserve a disposable recovery point and restore it into a **second fresh owned disposable instance**, not over the original. Reconcile the restored counts/digests/reports. Rehearse an interrupted posting/retry and a reviewed forward repair; use linked reversal/replacement for financial corrections, never deletion or rewriting posted history. Re-run the same financial snapshot and module reconciliations. No repair SQL is invented by this review task. Record actual backup/restore/replay/repair durations, hashes, results and residual variances; no timings are currently available.
6. Run native browser scenarios in EN/LTR and AR/RTL, light/dark, desktop and 390×844. Cover loading/empty/error/permission-denied, keyboard/focus, table/export equality, report→account→journal→source→back, retained dates/filters, tenant-switch cache clearing and mobile overflow. Preserve traces/screenshots and pair them to backend report artifacts. Locale-key unit parity is not UI acceptance.
7. Have the named accountant independently recompute and review the worksheet, actual exported reports, module reconciliations, label limitation and unresolved findings. Record name, role, date, exact commit/fixture/report hashes, each scenario's decision and signed artifact. No accountant identity or signature has been supplied. Deployment remains independently unverified and outside this task's authorization.

## Findings and acceptance blockers

| Finding | Evidence / required disposition |
|---|---|
| **R01 — blocking runtime repair: JRN-02/JRN-03** | V2-D03 is approved in the task input: organization + fiscal-year sequence assigned only at final successful posting, `JRN-{FY}-{000001}`, gaps allowed, never reuse, retry yields one journal, legacy references retained. `20260923161002_journal_center.sql:8` still generates `JRN-` plus the UUID; no later numbering implementation was found. This is an implementation gap, not a pending policy approval. Create a separately controlled forward-migration/runtime repair, verify organization/year isolation, draft/failed-post assignment, retry/rollback, concurrent posting/close, >999999 policy, reversals and unchanged legacy references. The acceptance probe prints mismatches and ends with a failing format assertion until numbering is repaired; its earlier PASS lines cannot make the whole probe pass. |
| **R02 — FS-08 label limitation, not accepted** | `update_account` changes `accounts.name`; current P&L selects `a.name` rather than a dated name snapshot. Existing mapping tests verify archive/effective classification, not old display names after rename. The new probe observes the returned historical label and asserts amount/identity preservation. Native execution and explicit accountant acceptance of current-label presentation are still required, or a separately controlled history repair. No acceptance is inferred. |
| **E01 — execution environment** | Docker socket denied; pinned dependencies/CLI unavailable. Fresh migration replay, integrated SQL/races, preservation pairs and recovery timings cannot be supplied from this run. |
| **E02 — independent acceptance** | No named accountant, dated verdict, reviewed actual exports or signed V2 artifact. The worksheet is prepared, not accepted. |

Full completion requires R01 repaired and verified, R02 verified/disposed explicitly, successful native integrated/recovery/browser evidence, and named accountant sign-off. Keep this package blocked until those facts exist. Publication and deployment require their own authorization; no approval is requested to bypass the current local constraints.
