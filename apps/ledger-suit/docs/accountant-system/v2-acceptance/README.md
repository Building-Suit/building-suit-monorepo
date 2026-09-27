# V2-IMP-015 — cross-module acceptance review

Status: **BLOCKED / acceptance incomplete**, updated 2026-09-27 by LS-REL-001. This is an acceptance package, not a release or an accountant sign-off. The original V2-IMP-015 review changed no runtime code or applied environment; later LS-FIX repair entries below describe local source changes only. LS-REL-001 made no hosted database write, deployment, commit or publication.

LS-OPS-001 added a read-only exact restore snapshot, a source/target comparator, and a tenant-authorized portability export that reuses the existing report CSV RPCs and includes attachment bytes. The [retention/restore record](../../restore-retention-portability.md) documents the current Free-plan limitation and separate Storage/configuration boundary. The required native second-instance restore remains **blocked before backup** because Docker is denied and no local PostgreSQL server exists; no timings, recoverable period, RPO, or RTO are claimed.

LS-SEC-001's release-only security review is recorded in [its candidate evidence](../../evidence/ls-sec-001/README.md). It found no critical source-level authorization or secret-exposure defect and added focused foreign-tenant attachment and bank-workspace assertions, but native SQL, a generated browser bundle, the live dependency advisory service, and hosted release configuration remain unverified in this worktree. Those results do not change this package's blocked accounting/deployment/accountant states.

Reviewed checkpoint: `78cbf947e1a308d44c3b8e955ee7b38727d2605b`, branch `codex/ledger-suit/v2-imp-015`. Worktree: `.local/worktrees/ledger-suit-v2-imp-015`. Initial working tree was clean. Local `origin/stg` was `2b3b5d6c6e1493a6b0295d484c2769936805d5cf`; it is stale/unverified. Preflight failed because fetch cannot write the read-only Git metadata outside this worktree. Live PR/parent/merge state was not established. The control plane owns publication.

The supplied task JSON is authoritative for this task and approves V2-D03. Dependency task labels saying “complete” do not establish SQL, browser, deployment or accountant acceptance. Runtime defects must be separate controlled repair tasks; the findings below are proposed repair scopes, not externally created tasks.

## LS-REL-001 release-candidate verification — blocked before native execution

Candidate commit `26c8abd7fd3cb4eca1da0c2877027f8b809f0ea1` contains merge commit `07dd278d8f9acb477662155031a2bcea67412026` for PR #52 and its integrated V2 feature tip `17c2c1306cc48d6a4a1ecbd21452e2bcb20243eb`. The reviewed feature tip named by the task, `2e3c26bfe051d243f404caf952f67f1af2b167a5`, is not a literal ancestor because the integration used a different commit, but both feature commits have the same stable patch ID, `b294426478cfabed8b6c68aad50a01193b8daffc`. The candidate continues through R01, R02, Ledger UX repairs, the RLS-aware read/performance repair and the Dashboard read-failure repair.

The candidate contains 91 ordered migrations through `20260927140000_rls_aware_dashboard_reads.sql`. The SHA-256 of the sorted per-file migration-content checksum manifest is `5173e9b8d79387a5a07009947ceaa5d4d068978433fef65c8ec1074dce489d58`. This identifies the local candidate only; it is not evidence that hosted staging has the same schema.

| Command/check actually executed for LS-REL-001 | Result |
|---|---|
| `pnpm agent:preflight` | Failed, exit 1; fetch/GitHub state was not verified. Local status was clean at the start. |
| Local ancestry plus stable patch-ID comparison | Passed: PR #52 merge and integrated feature tip are ancestors; reviewed/integrated V2 feature patches are equivalent. |
| `pnpm install --frozen-lockfile --store-dir .local/pnpm-store` | Stopped after repeated npm DNS `EAI_AGAIN`; no lockfile change and dependency setup remains incomplete. |
| `docker info --format '{{.ServerVersion}}'` | Failed before any container/database action: Docker socket permission denied. |
| `pnpm db:test:ledger` | Failed before SQL execution: pinned `supabase` executable unavailable. No migration, reset or SQL suite ran. |
| Selected 14-spec Playwright command from the integrated matrix, `--workers=1` | Failed before collection: workspace Playwright is unavailable and the system executable reports `unknown command 'test'`. |
| `pnpm --filter @building-suit/ledger-suit test:unit` | Passed 16 files, zero failed/skipped. This is focused exact-money/presentation evidence, not native SQL/browser evidence. |
| `node apps/ledger-suit/scripts/verify-v2-acceptance-artifacts.mjs` | Passed: 138 distinct requirement rows and exact independent eight-journal worksheet reconciliation. VAL-01's measurable-register check and VAL-08's separate-state check pass; application reports remain unverified. |
| `pnpm check` | Passed token comparison, workspace boundaries and preservation of 80 protected historical migrations. |
| `pnpm db:preflight ledger-suit staging` | Failed locally: the ignored `supabase/environments/ledger-suit/.env.staging` credential/configuration file is absent. Ref/key/runtime consistency therefore remains unverified. |
| Read-only HTTP probes to `https://stg.ledger.building-suit.com` and configured staging ref `yqculoltqsyfastmihmu` | Failed before HTTP response: both hostnames were unresolvable in this environment. Login, tenant context, billing/read-only gates, workflows, deployed app commit and hosted migration version are unverified. No hosted write was attempted. |

R01 remains implemented in source but native numbering/race and pre/post history-digest evidence is pending. R02 is explicitly disposed by R02-D01 as the limited prospective-history repair, but its native SQL/report comparison and accountant review remain pending. The prepared worksheet, reconciliation probe and report criteria remain the candidate artifacts for final named-accountant review; they are not signed evidence. Security, LS-OPS-001 restore, accountant acceptance and production states remain pending.

## Review artifacts and actual results

- [Requirement register](requirements.json): all 138 baseline requirements retain their measurable criteria and prior evidence, with distinct current `code_implemented`, `tests_passed`, `deployed`, and `accountant_accepted` fields. Historical assessments are explicitly separate. `unverified` does not mean missing; no whole requirement is promoted by a passing unit file.
- [Independent worksheet](expected-balances.json): synthetic inputs and hand-specified expected results, recomputed using integer arithmetic by [the offline validator](../../../scripts/verify-v2-acceptance-artifacts.mjs). It imports no application calculation. This verifies worksheet consistency, not the application's results or an accountant's judgment.
- [Shared-story SQL probe](../../../scripts/verify-v2-reconciliation.sql): fresh synthetic organization, real AR/AP public commands, partial settlement, duplicate retries, per-journal equality, GL/TB/Balance Sheet/P&L/Control comparisons, and pinned pre/post rename/archive label, identity, mapping, journal and amount comparisons. All writes roll back. **Updated by LS-FIX-002 but not executed.** Manual equipment/depreciation/fee entries in this probe do not establish fixed-asset or bank-module acceptance.
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
| LS-FIX-002: `pnpm --filter @building-suit/ledger-suit test:unit` | Passed all 16 current unit files, zero failed/skipped; not SQL evidence |
| LS-FIX-002: `node apps/ledger-suit/scripts/verify-v2-acceptance-artifacts.mjs` | Passed 138-state/worksheet validation; not database or accountant evidence |
| LS-FIX-002: `pnpm check` | Passed token outputs, workspace boundaries and historical-migration preservation check |
| LS-FIX-002: Ledger `typecheck` / `lint` | Did not start: `nuxt` / `eslint` executables absent because `node_modules` is missing |
| LS-FIX-002: SQL 49 and shared-story probe | Unrun: Docker denied, local port 60322 unavailable and Supabase CLI absent |
| LS-FIX-002: generated database types | Unrun: Supabase CLI/local database unavailable; public report RPC signatures are unchanged and the new table has no client query |

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
| **R01 — repair implemented locally; native verification pending: JRN-02/JRN-03** | LS-FIX-001 adds forward migration `20260927120000_posted_journal_sequences.sql` at the shared transition into `posted`. New references are scoped by organization/configured fiscal year; `{FY}` is its ending year; `999999` is the fail-closed limit. Draft/failed/unposted-void records remain unnumbered, equal retry reuses one journal, independent posts serialize, reversals receive their own identity, and stored legacy posted/reversed references remain unchanged. Focused suites 34/36/47/48 and this probe cover the delta, but native database execution and the required pre/post history digest are not claimed by this source change alone. [Policy and verification contract](../../posted-journal-sequences.md). |
| **R02 — minimal repair implemented locally; native/accountant verification pending: FS-08** | LS-FIX-002 adds forward migration `20260927130000_historical_account_labels.sql` and product disposition R02-D01 under AS-E02. Account creation/rename appends a prospective label version; P&L, Balance Sheet, Trial Balance, their existing CSV paths and posted-line drill-down resolve the label that existed for the latest included journal line without changing report arithmetic. Existing accounts receive only the name provable at migration time; older overwritten names are not claimed as recoverable. Focused suite 49 and the updated shared-story probe pin before/after labels, IDs, exact amounts, mapping and journal/entry digests. Neither probe ran here because Docker/CLI dependencies are unavailable, and no named accountant has accepted the output. [Repair boundary and verification contract](../../historical-account-labels.md). |
| **E01 — execution environment** | Docker socket denied and no local PostgreSQL server is listening. LS-OPS-001's exact snapshot/comparator/export tooling is locally tested, but fresh migration replay, integrated SQL/races, preservation pairs and recovery timings cannot be supplied from this run. |
| **E02 — independent acceptance** | No named accountant, dated verdict, reviewed actual exports or signed V2 artifact. The worksheet is prepared, not accepted. |

Full completion requires R01 repaired and verified, R02 verified/disposed explicitly, successful native integrated/recovery/browser evidence, and named accountant sign-off. Keep this package blocked until those facts exist. Publication and deployment require their own authorization; no approval is requested to bypass the current local constraints.
