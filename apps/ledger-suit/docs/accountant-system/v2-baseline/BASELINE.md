# Ledger Suit Accounting V2 implementation baseline

Task: LS-V2-BASELINE-001  
State: AWAITING ORCHESTRATOR REVIEW — not accepted, deployed, or accountant-approved  
Assessment date: 2026-09-23  
Authoritative input: [Ledger_Suit_V2_Requirements.md](./Ledger_Suit_V2_Requirements.md)

This is the canonical V2 requirement tracker under the existing accountant-system documentation. Older plans, screenshots, work packages, checkboxes, and the general AS-E02 founder authorization are historical evidence only. They do not change the V2 priorities, resolve the policy decisions below, prove deployment, or constitute accountant acceptance.

## 1. Scope and workspace checkpoint

| Item | Recorded value |
|---|---|
| Repository / app | Building-Suit/building-suit-monorepo / apps/ledger-suit |
| Assessment worktree | /home/tareq/Dev/building-suit-monorepo/.local/worktrees/ledger-v2-baseline |
| Assessment branch | codex/ledger-suit/v2-baseline |
| Baseline commit | 1f2725c287daab6fef21c83c611cab9f58e69f3c |
| Parent checkpoint | codex/ledger-suit/usability at the same commit; origin branch existed and was clean when the worktree was created |
| Base relationship | At assessment start, baseline was one commit above fetched origin/stg 6e96c0ca95a954c472b8f12822839f3bf13a5bb7. During assessment, the tracking ref advanced to origin/stg 599a5ab5afc5a99d5096a3e23e7a54ffe75ced5a (merge commit message for PR #16) and contains 1f2725c as an ancestor. The assessment was not rebased because 1f2725c is the exact inspected baseline and no publication was authorized. Reconcile again before any future PR. |
| Included pre-existing uncommitted state | None. Parent and new worktrees were clean before documentation edits. |
| Current assessment-worktree state | Modified: apps/ledger-suit/docs/accountant-system/README.md and CURRENT_STATUS_AR.md. Untracked/new: v2-baseline/BASELINE.md and v2-baseline/Ledger_Suit_V2_Requirements.md. These are the only task changes. |
| Excluded pending work | The primary checkout had an unrelated user modification at apps/shop-suit/docs/readiness/tasks.md; it was preserved and is not included. Other worktrees were preserved. |
| GitHub state | Unverified: gh authentication was invalid, so live PR/merge state could not be inspected. |
| Database ownership | apps/ledger-suit/supabase; generated types at apps/ledger-suit/types/database.types.ts |
| Test ownership | apps/ledger-suit/supabase/tests and apps/ledger-suit/tests |
| Runtime changes in this task | None; documentation only |

### Application and package boundaries

| Boundary | Effective ownership / dependency evidence |
|---|---|
| Ledger product | apps/ledger-suit/app/pages owns routes; app/components owns product UI; app/composables owns orchestration/data calls; app/utils owns pure product helpers. No other app internals are imported. |
| Direct workspace packages | apps/ledger-suit/package.json:37-39 depends on @building-suit/nuxt-layer, @building-suit/contracts and @building-suit/data-access. Ledger-specific accounting queries and rules remain app-owned. |
| Shared layer transitives | packages/nuxt-layer/package.json:25-32 supplies @building-suit/ui, @building-suit/ux, @building-suit/auth, @building-suit/brand, @building-suit/design-tokens and @building-suit/i18n, plus contracts/data-access. V2 work may extend shared contracts/components only when genuinely cross-product; shared packages must not import Ledger code or schema. |
| Database/schema | apps/ledger-suit/supabase/migrations is the forward migration chain; functions use the private app schema and public business tables under the app’s Supabase project. apps/ledger-suit/supabase/tests contains SQL acceptance coverage. |
| Generated/runtime contract | apps/ledger-suit/types/database.types.ts is generated output and must be regenerated from an authorized source migration, never hand-patched. |
| Cross-application risk | New shared contracts/UI can affect Shop Suit and docs; any such implementation requires affected-consumer checks. No current V2 task may create shared authoritative balances or a schema dependency in a shared package. |

The copied source contains the attachment text unchanged, with only a normalized terminal newline for the repository file. It contains exactly 138 unique requirement IDs and the expected ranges: SCOPE 7, CORE 8, COA 9, OPEN 8, JRN 8, TB 7, FS 8, AR 9, AP 9, PER 8, BANK 8, FA 9, DIM 7, TAX 7, INV 8, VAL 8, PLAN 10. No ID is missing or duplicated.

## 2. How to read the assessment

The status column uses only implemented, partially implemented, missing, or unverified. Implemented means repository coverage was found; it does not mean the relevant test was run, the feature was deployed, or an accountant accepted it. For process-only SCOPE, VAL, TAX, INV, and PLAN requirements, implemented means this baseline performs the requested assessment/governance action; it does not claim a runtime module exists.

Every row has four independent evidence dimensions:

1. Coverage: the row status and repository evidence below.
2. Tests present: evidence key T-* or an explicit absence.
3. Tests executed: section 5 records the command and result; a written scenario is not execution.
4. External acceptance: deployment is unverified and accountant acceptance is not started for every product capability unless explicitly stated.

For missing behavior, the ordered migration chain, app source, generated types, SQL tests, unit tests, and browser tests were inspected. For unverified behavior, the row states the smallest additional evidence required.

### Evidence index

| Key | Repository evidence |
|---|---|
| DB-AUTH | apps/ledger-suit/supabase/migrations/20260830122000_authorization_helpers.sql:284-359 — capability checks and one organization books_locked_until date |
| DB-COA | apps/ledger-suit/supabase/migrations/20260830123000_accounts.sql:56-248; 20260919013605_account_nature_and_contra_reporting.sql:1-220; 20260919095839_explicit_account_groups.sql:1-261 — hierarchy, archive/history guards, normal nature, Contra, Group/Posting roles |
| DB-LEDGER | apps/ledger-suit/supabase/migrations/20260830124500_transactions.sql:7-232; 20260830125000_transaction_entries.sql:8-280 — journal state, links, integer amounts, generic dimensions, immutability, deferred balance checks |
| DB-POST | apps/ledger-suit/supabase/migrations/20260830130000_posting_engine.sql:44-820 — common account validation, draft/post/create-and-post, adjustment, reversal, void, duplicate fingerprint, optional idempotency |
| DB-FLOWS | apps/ledger-suit/supabase/migrations/20260830130500_transaction_flows.sql:14-698 — income, expense, transfer, asset/liability/owner flows and simple opening posting all delegate to the common engine |
| DB-RLS | apps/ledger-suit/supabase/migrations/20260830133500_rls_policies.sql:1-47 — organization/capability reads and RPC-only ledger writes |
| DB-REPORT | apps/ledger-suit/supabase/migrations/20260830134000_reporting.sql:91-447; latest sign replacements in 20260919013605_account_nature_and_contra_reporting.sql:305-580 — two-column cumulative Trial Balance, statements, integrity, cash flow, General Ledger |
| DB-TB | apps/ledger-suit/supabase/migrations/20260923144500_six_column_trial_balance.sql — inclusive-period six-column Trial Balance over posted entries, posting-account-only totals, hierarchy/Contra metadata, and same-RPC CSV rows/totals |
| DB-CLASS | apps/ledger-suit/supabase/migrations/20260919105319_dated_statement_classification.sql:1-218 — append-only future Balance Sheet classifications and classified export |
| DB-ACTIVITY | apps/ledger-suit/supabase/migrations/20260919114443_account_activity_reader.sql:2-90 — account opening/movement/closing reader and journal-line reader |
| DB-EXPORT | apps/ledger-suit/supabase/migrations/20260912180913_financial_report_csv_exports.sql:62-162 — report exports reuse report RPCs, including the two-column Trial Balance |
| DB-IMPORT | apps/ledger-suit/supabase/migrations/20260912110717_csv_import_backend.sql:1-640 and latest confirm function in 20260913171823_launch_plan_concurrency_hardening.sql:128-240 — generic income/expense CSV staging, validation, duplicate handling, shared posting |
| DB-ARAP | apps/ledger-suit/supabase/migrations/20260831090000_commitments.sql:1-236; 20260831090500_commitment_functions.sql:15-186 — generic receivable/payable intentions, outstanding balance, partial settlement; settlement currently records income/expense |
| DB-RECUR | apps/ledger-suit/supabase/migrations/20260831091500_recurring_functions.sql:91-323 — occurrence identity, shared financial flows, scheduler |
| DB-QUOTA | apps/ledger-suit/supabase/migrations/20260912094117_monthly_posted_transaction_quota.sql:149-166 — quota effect when a transaction first becomes posted |
| DB-IDEMP | apps/ledger-suit/supabase/migrations/20260923134857_posting_idempotency_integrity.sql — tenant-scoped private claim ledger, canonical request fingerprints, atomic replay/conflict handling, and common posting-writer integration |
| UI-COA | apps/ledger-suit/app/pages/accounts.vue:317-537; app/utils/accountTree.ts:1-110; app/components/AccountTree.vue:25-83 — hierarchy, totals, role/nature/Contra/classification editing and account activity |
| UI-JRN | apps/ledger-suit/app/pages/transactions.vue:46-176; app/composables/useTransactionWorkspace.ts:1-123; app/components/TransactionDetailDialog.vue:96-279 — unified table, route-backed filters, lines, attachments, reversal |
| UI-REPORT | apps/ledger-suit/app/pages/reports.vue:22-430; app/components/AccountActivityDialog.vue:46-169 — reports/export plus account-to-journal drill-down available from accounts, not report rows |
| UI-IMPORT | apps/ledger-suit/app/components/CsvImportDialog.vue:55-381; app/pages/imports.vue:1-6 — generic transaction import, not an opening Trial Balance workflow |
| UI-ARAP | apps/ledger-suit/app/pages/records/[kind].vue:78-365 — commitment listing, partial settlement, postpone/cancel |
| T-CORE | apps/ledger-suit/supabase/tests/01_accounting_integrity_test.sql:95-418; 02_tenant_isolation_test.sql:1-310; 19_monthly_transaction_quota_test.sql:1-355 |
| T-COA | apps/ledger-suit/supabase/tests/28_account_nature_test.sql:1-148; 29_account_groups_test.sql:1-90; 30_statement_classification_test.sql:1-91; 31_account_activity_test.sql:1-78; apps/ledger-suit/tests/unit/account-tree.test.mjs:9-42; apps/ledger-suit/tests/e2e/account-nature.spec.ts:1-113, account-groups.spec.ts:1-100, account-activity.spec.ts:1-149 |
| T-IMPORT | apps/ledger-suit/supabase/tests/21_csv_import_backend_test.sql:1-329 and apps/ledger-suit/tests/e2e/csv-import.spec.ts:1-244 |
| T-ARAP | apps/ledger-suit/supabase/tests/03_commitments_and_recurring_test.sql:1-298 |
| T-REPORT | apps/ledger-suit/supabase/tests/22_financial_report_csv_exports_test.sql:1-188 and apps/ledger-suit/tests/e2e/report-exports.spec.ts:1-85 |
| T-TB | apps/ledger-suit/supabase/tests/33_six_column_trial_balance_test.sql — 33 assertions for boundaries, roll-forward, all three reconciliations, side crossing, Group/Contra rules, posted-only behavior, isolation, activity parity, and CSV parity; apps/ledger-suit/tests/unit/localized-csv.test.mjs — six-column EN/AR export contract; apps/ledger-suit/tests/e2e/trial-balance-verification.spec.ts — real local EN/LTR and AR/RTL rendering, period refresh, opening/period/closing activity and journal drill-down, return-context preservation, and narrow-viewport scrolling |
| T-IDEMP | apps/ledger-suit/supabase/tests/32_posting_idempotency_integrity_test.sql — 37 assertions covering sequential/concurrent replay, payload conflict, failed-request recovery, canonicalization, tenant scope, legacy keys, no-key behavior, access, audit, quota, and entry cardinality |
| ABSENT-MODULES | No accounting-period/state, journal-number, bank-statement/reconciliation, asset-register/depreciation-schedule, controlled cost-center/project, tax/VAT configuration/calculation/report, or inventory-item/movement/valuation object was found across the ordered migrations, app, generated types, SQL tests, unit tests, and browser tests. The exact search command is in section 5. |

Relevant database symbols traced to their latest applicable definitions include public.accounts, public.transactions, public.transaction_entries, public.commitments, public.commitment_settlements, public.saved_views, app.require_capability, app.require_account, app.create_transaction_draft, app.post_transaction, app.create_and_post, app.create_adjustment, app.reverse_transaction, app.post_opening_balance, app.search_transactions, app.trial_balance, app.profit_and_loss, app.balance_sheet, app.cash_flow_statement, app.general_ledger, app.classified_balance_sheet, app.export_financial_report_csv, app.read_account_activity, and app.read_journal_lines. Relevant interface symbols include useTransactionWorkspace, useAddTransaction, AccountTree, AccountActivityDialog, TransactionDetailDialog, and CsvImportDialog.

## 3. Requirement-level traceability

Columns: evidence includes code/schema/interface and tests present; acceptance/task includes the measurable criterion, proposed task, and blocking decision where applicable.

### Scope and foundation

| ID | Meaning | Priority | Status and reason | Evidence; gap / smallest additional evidence | Measurable acceptance; task / decision |
|---|---|---:|---|---|---|
| SCOPE-01 | Target monorepo Ledger app | — | implemented — assessment is scoped to apps/ledger-suit | Workspace checkpoint | Tracker names only this app; LS-V2-BASELINE-001 |
| SCOPE-02 | Inspect effective source/schema/functions/UI/tests | — | implemented — all evidence layers and latest redefinitions were inspected | Evidence index; section 5 | Review can trace findings to ordered definitions and tests |
| SCOPE-03 | Four-status evidence classification | — | implemented — every original ID has one allowed status | This table | 138 unique rows use only the four statuses |
| SCOPE-04 | Accounting-only functional scope | — | implemented — tracker excludes non-accounting modules | Task inventory and approval section | No proposed task expands beyond named accounting modules |
| SCOPE-05 | Invoices/bills only for AR/AP | — | implemented — AR/AP plans stop at accounting obligations | V2-IMP-008/009 | No sales-order/procurement/CRM/HR/payroll/POS/WMS/manufacturing capability is included |
| SCOPE-06 | Preserve functions and history | — | implemented — preservation gates are explicit | Sections 7-9 | Every data task requires forward migration and pre/post reconciliation |
| SCOPE-07 | Escalate unspecified policy | — | implemented — material questions are registered | V2-D01–D13 | Blocking policy is approved by named approver before dependent implementation |
| CORE-01 | Shared double-entry engine | — | implemented — all inspected financial flows call the common posting RPCs | DB-POST; DB-FLOWS; DB-IMPORT; DB-RECUR; T-CORE | Every new source creates effects only through the common engine; all posting-source contract tests pass |
| CORE-02 | Ledger-derived balances/statements | — | implemented — reports read posted entries and include reversal/adjustment journals | DB-LEDGER; DB-REPORT; DB-ACTIVITY; T-CORE | For a fixture including reversal/adjustment, GL, TB, statements, and account activity reconcile exactly |
| CORE-03 | Backend accounting validation | — | implemented — deferred balance, account, state, and RPC checks are database-enforced | DB-LEDGER; DB-POST; T-CORE | Direct/API attempts at unbalanced or ineligible posting fail atomically |
| CORE-04 | Draft/posted distinction; traceable corrections | — | implemented — posted rows/lines are immutable and reversal/adjustment links exist | DB-LEDGER; DB-POST; UI-JRN; T-CORE | Posted edits fail; correction produces linked journal with preserved original |
| CORE-05 | Eligibility/org/permission/period on all sources | — | implemented locally — the common posting boundary now combines eligibility/org/capability checks with the authoritative period guard and organization-scoped close/post lock | DB-AUTH; DB-POST; DB-RLS; DB-FLOWS; migrations 20260923165710/11; tests 32/35/36 | Focused ordinary/generated/adjustment/reversal and two-session race evidence passes; hosted verification remains pending |
| CORE-06 | Duplicate-post prevention | — | implemented — tenant-scoped atomic claims bind each key to a canonical logical payload; equal retries replay one result and conflicting reuse fails explicitly | DB-IDEMP; DB-POST; DB-IMPORT; DB-RECUR; DB-QUOTA; T-IDEMP; T-CORE | Same key+same payload returns one journal; same key+different payload conflicts; concurrent retries create one financial effect; V2-IMP-001 |
| CORE-07 | Preserve currency/audit/attachments/recurrence/import/export/reporting | — | implemented — current facilities are present and preservation is a task gate | DB-LEDGER; DB-IMPORT; DB-RECUR; DB-EXPORT; UI-JRN | Regression suite shows no loss of supported behavior after each V2 task |
| CORE-08 | Pre/post migration reconciliation | — | unverified — no V2 data migration occurred, so no paired evidence exists | Section 9; smallest evidence: disposable rehearsal plus signed reconciliation artifacts | Each future migration records pre/post journal counts, debit=credit, TB/statement integrity and subledger controls; every data task; V2-IMP-015 |

### Chart of Accounts V2 — P0

| ID | Meaning | Priority | Status and reason | Evidence; gap / smallest additional evidence | Measurable acceptance; task / decision |
|---|---|---:|---|---|---|
| COA-01 | Complete hierarchical tree | P0 | implemented — parent links, cycle/depth guards, tree UI and totals exist | DB-COA; UI-COA; T-COA | Create/reparent/archive fixtures retain valid hierarchy and render each account once |
| COA-02 | Group, Control, Posting node types | P0 | implemented locally — all three explicit roles have server-enforced posting and hierarchy rules | DB-COA; UI-COA; T-COA | All three types exist with server-enforced rules; V2-IMP-005 / V2-D01 |
| COA-03 | No Group posting; no double-counted rollups | P0 | implemented — database rejects Group accounts and tree totals avoid duplicate descendants | DB-COA; UI-COA; T-COA | Direct Group post fails; parent total equals distinct posting descendants |
| COA-04 | Control-to-subledger association and exceptions | P0 | implemented locally at contract level — immutable customer/supplier binding and dedicated exceptional-adjustment path exist; production AR/AP providers remain pending | DB-COA; DB-ARAP; T-COA | Each Control account has one approved subledger; exceptional adjustment obeys policy and reconciliation; V2-IMP-005 / V2-D01 |
| COA-05 | Contra nature and statement treatment | P0 | implemented — independent normal balance/Contra relation and report sign handling exist | DB-COA; DB-REPORT; UI-COA; T-COA | Contra fixtures reduce the intended parent/classification and remain traceable |
| COA-06 | Expose account properties | P0 | implemented locally — API and bilingual UI expose type, classification, nature, parent, Group/Control/Posting role, Control binding/lock and Contra state | UI-COA; DB-COA; T-COA | UI/API show type, classification, nature, parent, all node roles, Contra state; V2-IMP-005 / V2-D01 |
| COA-07 | Current/non-current and statement classes | P0 | partially implemented — dated Balance Sheet classes exist; complete statement mapping policy does not | DB-CLASS; UI-COA; T-COA | Approved mappings cover every applicable statement account and effective date; V2-IMP-007 / V2-D04 |
| COA-08 | Safe create/edit/archive | P0 | implemented — history, cycle, role, archival and posted-history guards exist | DB-COA; UI-COA; T-COA | Invalid hierarchy/role/archive changes fail while historical journals remain readable |
| COA-09 | Reconcile hierarchy/Control/Contra | P0 | partially implemented locally — hierarchy, Control contract and Contra regressions are clean; dated reconciliation reports provider-unavailable rather than a false zero until real AR/AP providers exist | T-COA; execution section | Clean disposable run proves hierarchy and Contra, then Control subledger=GL by date; V2-IMP-005/015 / V2-D01 |

### Opening balances — P0

| ID | Meaning | Priority | Status and reason | Evidence; gap / smallest additional evidence | Measurable acceptance; task / decision |
|---|---|---:|---|---|---|
| OPEN-01 | Explicit opening workflow | P0 | missing — only a low-level posting RPC exists | DB-FLOWS:584-698; UI-IMPORT | Accountant can create, validate, preview, approve, post, lock and correct one opening batch; V2-IMP-006 / V2-D02 |
| OPEN-02 | Import opening TB with account mapping | P0 | missing — generic CSV supports income/expense rows only | DB-IMPORT; UI-IMPORT; T-IMPORT | Source TB maps every row to an eligible Ledger account and preserves source row identity; V2-IMP-006 / V2-D02 |
| OPEN-03 | Cut-off date and explicit debit/credit | P0 | partially implemented — RPC has a date and signed normal-side amounts, not explicit source debit/credit columns | DB-FLOWS:584-698; T-CORE | Batch captures one approved cutoff plus separate nonnegative debit/credit per row; V2-IMP-006 / V2-D02 |
| OPEN-04 | Validate references, eligibility, values, balance | P0 | partially implemented — account/lock/balance engine checks exist, but the RPC silently plugs imbalance to Opening Balance Equity | DB-FLOWS; DB-POST; T-CORE | Invalid/ineligible/unbalanced source batch cannot post and errors identify rows; V2-IMP-006 / V2-D02 |
| OPEN-05 | Validation result and journal preview | P0 | missing — no opening-batch UI/model exists | UI-IMPORT; ABSENT-MODULES | Preview shows mapped lines, totals and blocking row errors before approval; V2-IMP-006 |
| OPEN-06 | Shared-ledger traceability | P0 | implemented — accepted low-level opening posts use the engine and flow into GL/reports | DB-FLOWS; DB-POST; DB-REPORT; T-CORE | Posted opening batch is traceable by batch/source in GL, six-column TB and statements; V2-IMP-006 retains engine |
| OPEN-07 | Controlled cutoff and duplicate protection | P0 | partially implemented — shared posting idempotency is concurrency-safe, but no opening batch/cutoff workflow exists | DB-FLOWS; DB-IDEMP; T-IDEMP; T-CORE | Repeated/concurrent import produces one batch/journal and cutoff rule is enforced; V2-IMP-006 / V2-D02 |
| OPEN-08 | Approval, lock, correction, year/midyear rules | P0 | partially implemented — generic lock/reversal exists, not opening-specific approval/policy | DB-AUTH; DB-POST | Approved policy controls approval, lock, correction and year/midyear treatment with audit; V2-IMP-006 / V2-D02 |

### Professional Journal Center — P0

| ID | Meaning | Priority | Status and reason | Evidence; gap / smallest additional evidence | Measurable acceptance; task / decision |
|---|---|---:|---|---|---|
| JRN-01 | One all-source journal workspace | P0 | implemented locally — Journal Center reads the authoritative all-source transaction stream | UI-JRN; DB-LEDGER; T-JRN | Focused SQL/browser evidence covers manual, commitment and reversal source presentation; recurring/import/opening/API retain their existing shared-engine source values |
| JRN-02 | Required header fields and debit/credit totals | P0 | implemented locally except final V2-D03 number semantics — immutable reference, accounting date, description/reference, source/type/status and actual debit/credit totals are shown | UI-JRN; DB-LEDGER; T-JRN | List/detail expose the fields and reconcile totals to lines; opaque reference is not claimed as the approved sequential number |
| JRN-03 | Consistent journal numbering rules | P0 | safety foundation implemented locally; final policy blocked by V2-D03 — every row has a unique immutable UUID-derived reference, retries reuse it, reversals receive their own | DB-JRN; T-JRN; T-IDEMP | Accountant/product owner must still approve scope/year/format/assignment/gap policy before sequential numbering is implemented |
| JRN-04 | Accounting search/sort/filter | P0 | implemented locally — route-backed date/account/source/status/type/search and journal-reference sorting/filtering | UI-JRN; DB-JRN; T-JRN | Focused SQL and browser evidence execute filters against actual journals and restore route state |
| JRN-05 | Saved views | P0 | implemented locally — private user/organization-scoped create/apply/delete flow with validated structured state | DB-JRN; UI-JRN; T-JRN | SQL proves validation and cross-user denial; browser proves save/reload/apply in EN/AR |
| JRN-06 | Lines and source records | P0 | implemented locally — immediate actual ledger lines/totals plus commitment/recurring/import source links where relationships exist | DB-JRN; UI-JRN; T-JRN | Commitment fixture proves actual authorized source identity; browser proves line inspection |
| JRN-07 | Visible reversal/adjustment relationships | P0 | implemented locally — original/reversal/correction identifiers and bidirectional navigation remain visible | DB-JRN; DB-POST; UI-JRN; T-JRN | Focused SQL and browser evidence preserve and navigate both sides without changing history |
| JRN-08 | Permission/status/period-aware actions | P0 | implemented locally — Journal Center resolves authoritative period context, explains Soft/Hard restrictions, and withholds reversal outside Open while the backend remains authoritative | DB-AUTH; DB-POST; UI-JRN; tests 35 and accounting-periods.spec.ts | EN/LTR and AR/RTL browser evidence includes Hard Closed journal action behavior; no posted-edit path was added |

### Six-column Trial Balance — P0

| ID | Meaning | Priority | Status and reason | Evidence; gap / smallest additional evidence | Measurable acceptance; task / decision |
|---|---|---:|---|---|---|
| TB-01 | Six monetary columns | P0 | implemented — RPC, UI and CSV expose opening DR/CR, period DR/CR and closing DR/CR | DB-TB; UI-REPORT; T-TB | Every eligible posting account has the six required non-negative monetary columns; V2-IMP-002 |
| TB-02 | Selected-period components | P0 | implemented — one inclusive from/to contract separates pre-period opening from in-period gross movement | DB-TB; UI-REPORT; T-TB | Boundary fixtures place day-before in opening, start/end in movement and day-after outside; V2-IMP-002 |
| TB-03 | Per-account roll-forward equation | P0 | implemented — closing is derived once as opening net plus period debit less period credit | DB-TB; T-TB | Every tested row satisfies signed close = signed open + debit movement - credit movement; V2-IMP-002 |
| TB-04 | Column-total reconciliation | P0 | implemented — UI/footer and CSV total the authoritative posting rows | DB-TB; UI-REPORT; T-TB | Opening DR=CR, period DR=CR and closing DR=CR in the deterministic fixture; V2-IMP-002 |
| TB-05 | Hierarchy and Contra without double count | P0 | implemented — report returns posting accounts only with parent/role/nature/Contra metadata; actual ledger position determines side | DB-COA; DB-TB; T-TB | Group parents are excluded from authoritative totals; child metadata and Contra credit positions are retained; V2-IMP-002 |
| TB-06 | Drill-down to movements/journals | P0 | implemented — each monetary cell opens the existing posted account activity and journal path with opening, period or through-closing dates | UI-REPORT; DB-ACTIVITY; T-TB | Amount→movement→journal stays organization-authorized and uses the report context; V2-IMP-002 |
| TB-07 | Display/export same contract | P0 | implemented — display and CSV both consume public.report_trial_balance for the same organization/from/to inputs | DB-TB; UI-REPORT; T-TB | Exact fixture rows and totals agree; localized CSV retains the same numeric cells; V2-IMP-002 |

### Financial statements — P0

| ID | Meaning | Priority | Status and reason | Evidence; gap / smallest additional evidence | Measurable acceptance; task / decision |
|---|---|---:|---|---|---|
| FS-01 | Complete Income, Balance Sheet, Cash Flow workflows | P0 | partially implemented — all three render/export, but mapping, reconciliation and drill-down are incomplete | DB-REPORT; DB-EXPORT; UI-REPORT; T-REPORT | Approved fixtures reconcile all three reports to TB/GL with drill-down; V2-IMP-007 / V2-D04 |
| FS-02 | Current/non-current presentation | P0 | implemented — dated classified Balance Sheet supports applicable groups | DB-CLASS; UI-REPORT; T-COA | Effective-date fixtures place each applicable account in the approved current/non-current group |
| FS-03 | Consistent classification and Contra | P0 | partially implemented — nature signs and dated BS classes exist; complete approved mappings do not | DB-REPORT; DB-CLASS; T-COA | Every statement account has approved mapping/effective history and Contra results match GL; V2-IMP-007 / V2-D04 |
| FS-04 | Reconcile statements to TB/GL | P0 | partially implemented — integrity RPC exists but not a complete six-column/mapping reconciliation | DB-REPORT; T-CORE; T-REPORT | Income/BS/CF totals tie to six-column TB and GL for the same context with zero unexplained variance; V2-IMP-007 / V2-D04 |
| FS-05 | Statement drill-down | P0 | missing — statement rows are not interactive | UI-REPORT; DB-ACTIVITY | Total→account→movement→journal path is authorized and reproducible; V2-IMP-007 |
| FS-06 | Preserve report context on drill-down | P0 | missing — date/filter state is local and no statement drill-down exists | UI-REPORT | Back navigation restores report, dates, filters, focus and scroll; V2-IMP-007 |
| FS-07 | Approved mapping/cash-flow policies | P0 | partially implemented — code classifies BS and cash flow, but no accountant-approved policy; cash flow uses a dominant-counterpart heuristic | DB-CLASS; DB-REPORT | Policy approves every mapping and line-level cash-flow treatment; V2-IMP-007 / V2-D04 |
| FS-08 | Historical access after account changes | P0 | partially implemented — archive preserves entries; names and classification history are not complete for every permitted change | DB-COA; DB-CLASS; DB-REPORT; T-COA | Historical report as-of reproduces approved labels/classes and opens archived-account journals; V2-IMP-007 |

### Receivables and payables — P0

| ID | Meaning | Priority | Status and reason | Evidence; gap / smallest additional evidence | Measurable acceptance; task / decision |
|---|---|---:|---|---|---|
| AR-01 | Customer subledger tied to AR Control | P0 | missing — generic commitments are not a Control-account subledger | DB-ARAP; UI-ARAP; ABSENT-MODULES | Customer open items sum exactly to AR Control by date; V2-IMP-005/008 / V2-D01 |
| AR-02 | Customer obligation attributes | P0 | partially implemented — counterparty, due date, amount/outstanding exist; issue date, invoice identity and accrual journal do not | DB-ARAP; UI-ARAP; T-ARAP | Invoice stores all fields and posts one traceable recognition journal; V2-IMP-008 / V2-D05 |
| AR-03 | Receipt allocation | P0 | partially implemented — settlement links one cash transaction but is not an allocation subledger | DB-ARAP; UI-ARAP; T-ARAP | One/many receipts allocate to one/many open items with immutable allocation history; V2-IMP-008 / V2-D01, V2-D05 |
| AR-04 | Partial settlement | P0 | partially implemented — outstanding arithmetic exists, but within cash-basis commitment behavior | DB-ARAP; UI-ARAP; T-ARAP | Partial receipt reduces open item and Control exactly without re-recognizing revenue; V2-IMP-008 / V2-D01, V2-D05 |
| AR-05 | Credits/unallocated/overpay/adjust/reverse | P0 | missing — no approved models or rules | DB-ARAP; ABSENT-MODULES | Each approved case has traceable state/journal/allocation behavior; V2-IMP-008 / V2-D05 |
| AR-06 | Customer statements | P0 | missing — no statement query/UI/test | ABSENT-MODULES | Statement roll-forward opening+charges+adjustments-receipts=closing and ties to open items; V2-IMP-008 / V2-D01, V2-D05 |
| AR-07 | Receivables aging | P0 | missing — no buckets/due-date policy/report | ABSENT-MODULES | Approved buckets assign every outstanding amount once and sum to AR; V2-IMP-008 / V2-D01, V2-D05 |
| AR-08 | Subledger-to-Control reconciliation | P0 | missing — neither Control nor reconciliation exists | ABSENT-MODULES | As-of subledger total equals AR Control with explicit zero/explained variance; V2-IMP-008 / V2-D01, V2-D05 |
| AR-09 | Avoid revenue twice | P0 | missing — current settlement calls record_income, so it cannot safely follow accrual invoice recognition | DB-ARAP:161-186 | Invoice recognizes revenue once; receipt only moves cash/AR; V2-IMP-008 / V2-D05 |
| AP-01 | Supplier subledger tied to AP Control | P0 | missing — generic commitments are not a Control-account subledger | DB-ARAP; UI-ARAP; ABSENT-MODULES | Supplier open items sum exactly to AP Control by date; V2-IMP-005/009 / V2-D01 |
| AP-02 | Supplier obligation attributes | P0 | partially implemented — counterparty, due date, amount/outstanding exist; issue date, bill identity and accrual journal do not | DB-ARAP; UI-ARAP; T-ARAP | Bill stores all fields and posts one traceable expense/asset recognition journal; V2-IMP-009 / V2-D06 |
| AP-03 | Payment allocation | P0 | partially implemented — settlement links one cash transaction but is not an allocation subledger | DB-ARAP; UI-ARAP; T-ARAP | One/many payments allocate to one/many bills with immutable allocation history; V2-IMP-009 / V2-D01, V2-D06 |
| AP-04 | Partial settlement | P0 | partially implemented — outstanding arithmetic exists, but within cash-basis commitment behavior | DB-ARAP; UI-ARAP; T-ARAP | Partial payment reduces open item and Control exactly without re-recognizing expense/asset; V2-IMP-009 / V2-D01, V2-D06 |
| AP-05 | Credits/unallocated/overpay/adjust/reverse | P0 | missing — no approved models or rules | DB-ARAP; ABSENT-MODULES | Each approved case has traceable state/journal/allocation behavior; V2-IMP-009 / V2-D06 |
| AP-06 | Supplier statements | P0 | missing — no statement query/UI/test | ABSENT-MODULES | Statement roll-forward opening+bills+adjustments-payments=closing and ties to open items; V2-IMP-009 / V2-D01, V2-D06 |
| AP-07 | Payables aging | P0 | missing — no buckets/due-date policy/report | ABSENT-MODULES | Approved buckets assign every outstanding amount once and sum to AP; V2-IMP-009 / V2-D01, V2-D06 |
| AP-08 | Subledger-to-Control reconciliation | P0 | missing — neither Control nor reconciliation exists | ABSENT-MODULES | As-of subledger total equals AP Control with explicit zero/explained variance; V2-IMP-009 / V2-D01, V2-D06 |
| AP-09 | Avoid expense/asset twice | P0 | missing — current settlement calls record_expense, so it cannot safely follow accrual bill recognition | DB-ARAP:161-186 | Bill recognizes expense/asset once; payment only moves AP/cash; V2-IMP-009 / V2-D06 |

### Periods, bank reconciliation, fixed assets — P0

| ID | Meaning | Priority | Status and reason | Evidence; gap / smallest additional evidence | Measurable acceptance; task / decision |
|---|---|---:|---|---|---|
| PER-01 | Explicit period workflow | P0 | implemented locally — accountant page and controlled RPCs create/view dated non-overlapping periods and history | migration 20260923165711; periods.vue; test 35; accounting-periods.spec.ts | Authorized UI/API workflow passes locally |
| PER-02 | Open/Soft/Hard Closed states | P0 | implemented locally | accounting_period_status; accounting_periods; test 35 | All three states persist and only approved adjacent transitions pass |
| PER-03 | State operations/restrictions/authorization | P0 | implemented locally | periods.read/manage/adjust_soft_closed/year_end_close; shared guard; UI | Owner/admin manage; accountant receives view + reasoned Soft-Close adjustment, not administration by default |
| PER-04 | Restrictions on every source | P0 | implemented locally at the common posting boundary | app.assert_accounting_period_allows; create_and_post/post_transaction; opening/reversal tests | Open posts; Soft blocks generated/ordinary and permits only authorized reasoned manual adjustment; Hard blocks all |
| PER-05 | Controlled reopening | P0 | implemented locally | transition_accounting_period; test 35 | Hard→Open rejected; Hard→Soft→Open requires privilege and reason |
| PER-06 | Close/reopen audit | P0 | implemented locally | accounting_period_transitions; immutable trigger/RLS; test 35 | Actor/time/reason/from/to and year-close relationship are append-only |
| PER-07 | Fiscal/year-end treatment | P0 | implemented locally under approved V2-D07 | fiscal_year_bounds; fiscal_year_closes; close_fiscal_year; P&L source exclusion; test 35 | Profit and loss fixtures transfer to protected Retained Earnings while historical P&L remains unchanged |
| PER-08 | Concurrent close/post test | P0 | implemented and verified locally | organization_settings row lock in posting and transition operations; test 36 | 8/8 two-session barrier evidence proves post-first and close-first outcomes |
| BANK-01 | Import statements | P0 | missing — no bank statement model/workspace/import | ABSENT-MODULES | Valid CSV fixture creates a reviewable statement without a journal; V2-IMP-010 / V2-D08 |
| BANK-02 | Validate/deduplicate lines | P0 | missing | ABSENT-MODULES | Bad rows block completion; repeated file/line identity cannot duplicate; V2-IMP-010 / V2-D08 |
| BANK-03 | Match existing journals without reposting | P0 | missing | ABSENT-MODULES | Matching changes links/status only; journal count and ledger totals are unchanged; V2-IMP-010 / V2-D08 |
| BANK-04 | Matched/unmatched/unresolved states | P0 | missing | ABSENT-MODULES | Every line has one visible state and filters/totals reconcile; V2-IMP-010 / V2-D08 |
| BANK-05 | Adjustments through engine | P0 | missing | ABSENT-MODULES; DB-POST is reusable foundation | Authorized adjustment produces one linked balanced journal via common engine; V2-IMP-010 / V2-D08 |
| BANK-06 | Match/unmatch/correct/complete policy | P0 | missing | ABSENT-MODULES | Approved transitions and completion prerequisites are enforced; V2-D08; V2-IMP-010 / V2-D08 |
| BANK-07 | Statement-to-ledger reconciliation | P0 | missing | ABSENT-MODULES | Statement balance = ledger balance plus/minus listed outstanding items; V2-IMP-010 / V2-D08 |
| BANK-08 | Preserve reconciliation links/history | P0 | missing | ABSENT-MODULES | Line→match→journal/adjustment→session history remains navigable and immutable; V2-IMP-010 / V2-D08 |
| FA-01 | Fixed-asset register | P0 | missing — only asset-purchase flow exists | DB-FLOWS:261-314; ABSENT-MODULES | Register lists each asset, status and ledger links; V2-IMP-011 / V2-D09 |
| FA-02 | Link acquisition/accounts/records | P0 | partially implemented — purchase journal and metadata can be recorded, but no asset identity/register link | DB-FLOWS:261-314 | One asset traces to acquisition source/journal and designated asset/depreciation accounts; V2-IMP-011 / V2-D09 |
| FA-03 | Depreciation-policy inputs | P0 | partially implemented — useful-life metadata is accepted; method/residual/register dates are not controlled | DB-FLOWS:261-314 | Required policy fields are validated and effective-dated; V2-D09; V2-IMP-011 / V2-D09 |
| FA-04 | Depreciation schedules | P0 | missing — migration explicitly leaves depreciation outside the flow | DB-FLOWS:261-314; ABSENT-MODULES | Approved schedule exactly allocates depreciable basis over periods; V2-IMP-011 / V2-D09 |
| FA-05 | Ledger posting/no duplicate depreciation | P0 | missing | ABSENT-MODULES; DB-POST foundation | One depreciation journal per asset/period; concurrent retry is idempotent; V2-IMP-011 / V2-D09 |
| FA-06 | Cost/accumulated depreciation/NBV | P0 | missing | ABSENT-MODULES | Register cost - accumulated depreciation = NBV by date and ties to GL; V2-IMP-011 / V2-D09 |
| FA-07 | Disposal/gain-loss | P0 | missing | ABSENT-MODULES | Disposal derecognizes cost/accumulated depreciation and posts approved gain/loss; V2-IMP-011 / V2-D09 |
| FA-08 | Register-to-GL reconciliation | P0 | missing | ABSENT-MODULES | Cost and accumulated depreciation register totals equal control GL accounts; V2-IMP-011 / V2-D09 |
| FA-09 | Acquisition/depreciation/disposal corrections | P0 | missing | ABSENT-MODULES | Approved corrections preserve originals and linked reversal/replacement journals; V2-IMP-011 / V2-D09 |

### Dimensions, tax/VAT, inventory

| ID | Meaning | Priority | Status and reason | Evidence; gap / smallest additional evidence | Measurable acceptance; task / decision |
|---|---|---:|---|---|---|
| DIM-01 | Complete cost-center/project dimensions | — | partially implemented — ledger lines have generic dimensions JSON only | DB-LEDGER:8-55; ABSENT-MODULES | Controlled dimensions, posting, reporting and reconciliation work end-to-end; V2-IMP-012 / V2-D10 |
| DIM-02 | Maintain controlled dimension values | — | missing — no model/API/UI | ABSENT-MODULES | Authorized create/edit/archive preserves historical references; V2-IMP-012 / V2-D10 |
| DIM-03 | Associate applicable accounting amounts | — | partially implemented — unvalidated JSON can be stored, with no controlled selection/allocation | DB-LEDGER | Eligible line amounts reference active tenant dimension values and allocation totals equal line; V2-IMP-012 / V2-D10 |
| DIM-04 | Filter/group accounting reports | — | missing | ABSENT-MODULES | GL/TB/approved statements filter/group by each dimension; V2-IMP-012 / V2-D10 |
| DIM-05 | Reconcile including unassigned | — | missing | ABSENT-MODULES | Assigned groups plus explicit Unassigned equal unfiltered ledger total; V2-IMP-012 / V2-D10 |
| DIM-06 | Allocation/history rules | — | missing | ABSENT-MODULES | Approved multi-allocation and historical-change policy is auditable; V2-D10; V2-IMP-012 / V2-D10 |
| DIM-07 | No operational project management | — | implemented — tracker limits dimensions to classification/reporting | Scope/task definition | No scheduling/resources/tasks/billing module is introduced |
| TAX-01 | Approve jurisdictions/circumstances/scope | — | missing — tax identifiers/subtypes are not an approved scope | DB-COA; ABSENT-MODULES | Accountant+product owner approve scope backed by current authoritative regulation; V2-IMP-013 / V2-D11 |
| TAX-02 | Configure mappings/calculations/reports | — | missing | ABSENT-MODULES | Approved examples calculate, post and report exact tax amounts; V2-IMP-013 / V2-D11 |
| TAX-03 | Integrate documents and posting engine | — | missing | ABSENT-MODULES; DB-POST foundation | Each in-scope document creates one balanced traceable tax effect; V2-IMP-013 / V2-D11 |
| TAX-04 | Reconcile tax report/source/GL | — | missing | ABSENT-MODULES | Tax report total equals tax-control GL and traceable source documents; V2-IMP-013 / V2-D11 |
| TAX-05 | Policy review and regulatory verification | — | implemented — decision/dependency is explicitly registered; no legal claim is made | V2-D11; section 10 | Dated authoritative verification and accountant approval precede implementation |
| TAX-06 | External compliance is explicit scope | — | implemented — external submission/e-invoicing is separated as approval-required | Section 10 | No external compliance integration enters a task without explicit approval |
| TAX-07 | No unsupported compliance/completeness claim | — | implemented — this baseline labels tax runtime missing and deployment unverified | This row; section 5 | Release evidence uses scoped, jurisdiction-specific wording only after verification |
| INV-01 | Inventory accounting beyond subtype | — | missing — only an account subtype exists | DB-COA; ABSENT-MODULES | Approved inventory accounting flow, valuation and reconciliation operate end-to-end; V2-IMP-014 / V2-D12 |
| INV-02 | Scope/control/valuation/COGS policy | — | missing | ABSENT-MODULES | Approved policy names controls, costing, COGS and boundaries; V2-IMP-014 / V2-D12 |
| INV-03 | Movement/valuation source to journals | — | missing | ABSENT-MODULES | Each approved source movement deterministically produces one linked journal; V2-IMP-014 / V2-D12 |
| INV-04 | Increase/decrease/return/adjustment treatment | — | missing | ABSENT-MODULES | Approved fixtures post exact entries for every in-scope movement; V2-IMP-014 / V2-D12 |
| INV-05 | Valuation/COGS-to-GL reconciliation | — | missing | ABSENT-MODULES | Inventory valuation and COGS totals equal designated GL accounts; V2-IMP-014 / V2-D12 |
| INV-06 | Source-to-entry traceability | — | missing | ABSENT-MODULES | User navigates source movement↔valuation↔journal; V2-IMP-014 / V2-D12 |
| INV-07 | Explicit costing/correction approval | — | implemented — method is not invented and decision is blocking | V2-D12 | Accountant+product owner approve costing/backdating/correction before build |
| INV-08 | Separate from operational systems | — | implemented — task is accounting-only | Scope/task definition | No WMS/procurement/sales-order/manufacturing capability is introduced |

### Validation and implementation-plan requirements

| ID | Meaning | Priority | Status and reason | Evidence; gap / smallest additional evidence | Measurable acceptance; task / decision |
|---|---|---:|---|---|---|
| VAL-01 | Measurable criteria for every requirement | — | implemented — every row has a measurable criterion | This table | Automated check finds 138 IDs and nonempty acceptance cells |
| VAL-02 | Test COA roles/reconciliation/Contra/classes | — | partially implemented — Group/Contra/classification tests exist; Control does not and one local suite failed | T-COA; section 5 | Clean suite covers Group/Control/Contra/classification and zero Control variance; V2-IMP-005/015 |
| VAL-03 | Test opening/numbering/views/drill-down/six-column TB | — | partially implemented — six-column TB reconciliation/drill-down coverage is implemented; opening import, numbering and saved-view acceptance remain future work | T-IMPORT; T-REPORT; T-TB; UI evidence | Automated DB+UI suite covers all five behaviors; V2-IMP-002/003/006/007 |
| VAL-04 | Test AR/AP lifecycle/reconciliation | — | partially implemented — current commitment partial-settlement tests are cash-basis only | T-ARAP | Accrual, allocation, aging, correction and Control reconciliation tests pass; V2-IMP-008/009 |
| VAL-05 | Test periods/bank/assets/dimensions/tax/inventory | — | partially implemented — periods now have accounting fixtures plus concurrency, error and bilingual UI coverage; later modules remain absent | V2-IMP-004 SQL/concurrency/browser evidence; ABSENT-MODULES | Each approved module has accounting fixtures plus concurrency/error/UI coverage; V2-IMP-010-015 |
| VAL-06 | Permission/isolation/idempotency/concurrency/history tests | — | partially implemented — posting replay/conflict, tenant isolation, failure recovery, concurrent duplicates and period close/post serialization now pass; future-module concurrency remains | T-IDEMP; T-CORE; T-COA; V2-IMP-004 SQL concurrency evidence | Cross-module matrix passes, including concurrent duplicate and close/post barriers; V2-IMP-015 |
| VAL-07 | Accountant-reviewed independent expected balances | — | missing — no V2 accountant acceptance evidence exists | Existing historical approval is not V2 UAT | Named accountant signs dated fixtures and expected reports; V2-IMP-015 |
| VAL-08 | Separate code/test/deploy/accountant states | — | implemented — V2-IMP-004 explicitly distinguishes local implementation/test evidence from hosted deployment and accountant acceptance | Sections 2, 5 and V2-IMP-004 | Tracker never derives deployment/UAT from code or test state |
| PLAN-01 | Requirement-by-requirement evidence gap analysis | — | implemented — 138 rows reference actual objects/UI/tests | Sections 2-3 | ID audit and reviewer spot-check pass |
| PLAN-02 | Retain/extend/introduce/investigate inventory | — | implemented | Section 4 | Each capability is assigned exactly one primary disposition |
| PLAN-03 | Preserve P0; dependency sequence later modules separately | — | implemented — bank/assets remain P0; dimensions/tax/inventory are separate | Section 7 | Sequence labels P0 and does not invent later-module priority |
| PLAN-04 | Separate decisions and blockers | — | implemented | Section 6 | Every blocking decision has stable ID, requirements, tasks and approver |
| PLAN-05 | Executable work-package detail | — | implemented | Sections 7-8 | Each task records scope/deps/paths/migration/risk/acceptance/tests/recovery/review |
| PLAN-06 | Module integration boundaries | — | implemented | Section 7 | Boundaries prohibit duplicate/disconnected balances and bypasses |
| PLAN-07 | Rehearsal/reconciliation/recovery/regression | — | implemented | Section 9 | Every data task must attach the defined evidence before acceptance |
| PLAN-08 | Requirement→task/test/acceptance traceability | — | implemented | This table and task registry | Every product row names task or retained evidence and criterion |
| PLAN-09 | Separate approval-required additions | — | implemented | Section 10 | Additions are excluded from implementation until approved |
| PLAN-10 | Planning only; no implementation/merge/deploy | — | implemented | Workspace and activity records | Diff contains documentation only; no migration/runtime/test/remote mutation |

## 4. Coverage totals and implementation inventory

Totals below are generated from the 138 requirement rows in this document and must be rechecked after any status edit.

| Status | Count |
|---|---:|
| implemented | 39 |
| partially implemented | 37 |
| missing | 61 |
| unverified | 1 |
| Total | 138 |

Product/process distinction: SCOPE and PLAN are assessment requirements; VAL mixes assessment and runtime acceptance; TAX-05–07, INV-07–08, and DIM-07 are governance/boundary requirements. Their completion does not make the associated runtime capability complete.

| Disposition | Evidence-backed inventory |
|---|---|
| Retain | Shared double-entry engine; tenant-scoped posting idempotency and canonical request binding; posted-entry authority; draft/posted immutability; reversal/adjustment links; organization/capability RLS; account hierarchy, Group restrictions, normal nature and Contra; current transaction center; account activity; generic commitments/recurrence/import/export/attachments/currency/audit foundations |
| Extend | Account roles with Control; opening RPC into controlled batch workflow; transaction center into professional journal center; current two-column TB into six columns; statement classification/reconciliation/drill-down; commitments into accrual AR/AP subledgers; one lock date into period state machine; asset-purchase metadata into a fixed-asset register; generic dimensions into controlled dimensions |
| Introduce | Journal numbering; bank statement/reconciliation domain; explicit accounting periods; Control-account bindings; opening import/mapping/approval; AR/AP allocations/statements/aging; asset schedules/disposals; tax/VAT only after approved scope; inventory accounting only after approved scope |
| Investigate | Clean disposable reproduction of five local SQL-suite failures; live GitHub PR state; hosted/deployed schema; historical label/classification reproducibility; cash-flow mapping; all decisions V2-D01–D13; accountant fixture approval |

## 5. Verification and external-state record

### Commands actually executed

| Working directory | Command | Exit / actual result |
|---|---|---|
| Repository root, then baseline worktree | pnpm agent:preflight | 1. Node v20.11.1 is below repository requirement >=22; pnpm was 10.33.0; live GitHub inspection failed because the active gh token was invalid. Local worktree/ancestry information was still inspected. |
| Repository root | git fetch origin --prune | 0 after permission approval. origin/stg resolved to 6e96c0ca95a954c472b8f12822839f3bf13a5bb7. |
| Baseline worktree | git rev-parse --show-toplevel; git status --short; git branch --show-current; git rev-parse HEAD; git worktree list --porcelain | 0. Confirmed the worktree, clean starting state, branch and baseline recorded in section 1. |
| Baseline worktree | node --test apps/ledger-suit/tests/unit/*.test.mjs | 0. 6 tests, 6 passed, 0 failed. Limitation: executed on Node 20, not the repository-required Node 22+. |
| Repository root | pnpm db ledger-suit status | 0 with permission approval for CLI telemetry state. The Ledger project was unlinked and endpoints were localhost; several local services were stopped. No hosted project was contacted. Sensitive local credentials are intentionally omitted. |
| Baseline worktree | /home/tareq/Dev/building-suit-monorepo/node_modules/.bin/supabase --workdir /home/tareq/Dev/building-suit-monorepo/.local/worktrees/ledger-v2-baseline/apps/ledger-suit test db --local | 1. 31 files / 813 assertions reported. 26 suites passed; five suites failed or aborted: 12_subscription_readable_history (subquery returned multiple rows), 14_account_quota (fixture counts already 39/108/307 rather than 29/99/299), 19_monthly_transaction_quota (existing usage caused quota/plan mismatch), 22_financial_report_csv_exports (1 numeric-negative assertion), 30_statement_classification (1 total assertion: 163000 vs 8000). Core suites 01, 02, 03, 21, 28, 29 and 31 passed in this run. The local database was not reset, so contamination is likely for several count failures; the report does not classify all five as product regressions. |
| Baseline worktree | rg -n --no-heading "(bank_statement\|bank_reconciliation\|reconciliation_session\|fixed_asset\|asset_register\|depreciation_schedule\|accounting_period\|period_state\|soft_closed\|hard_closed\|cost_center\|project_id\|tax_rate\|vat_rate\|inventory_item\|inventory_movement\|valuation_method\|journal_number)" apps/ledger-suit/app apps/ledger-suit/supabase/migrations apps/ledger-suit/supabase/tests apps/ledger-suit/types/database.types.ts --glob '!**/*.png' \|\| true | 0, no matches. This supports ABSENT-MODULES only together with the ordered implementation inspection; it is not used as filename-only proof. |

Not run:

- No browser session or interface action was executed. Static UI source and repository browser tests were inspected; local API services were stopped and dependencies were not installed in the new worktree. Reproducible future interface checks are specified per task.
- No fresh-database test run was performed because that would require reset/migration activity expressly outside this task. The existing local database was preserved.
- No hosted database, deployment, provider, or production verification was attempted.
- No dependency installation/upgrade, generated runtime output, full build, lint, or typecheck was run. The worktree has no installed dependency tree and the active Node version is below the repository requirement.

### Independent state dimensions

| Dimension | Baseline result |
|---|---|
| Repository coverage | Per requirement in section 3 |
| Tests present | Per evidence key in section 3 |
| Tests executed | Unit suite passed; existing local SQL run was mixed as detailed above |
| Deployed/hosted state | UNVERIFIED for every requirement |
| Accountant acceptance | NOT STARTED for V2; no requirement is accountant-accepted by this report |
| Migration activity | None authored, applied, rehearsed, reset, or rolled back |
| Remote/provider activity | Git fetch only; no hosted DB access, configuration change, push, PR, merge, or deployment |
| Reconciliation available | Existing balance/integrity/account-activity functions and tests; no V2 pre/post migration pair |
| Reconciliation still required | Clean disposable baseline, approved expected fixtures, every future data migration pre/post comparison, subledger/register/control reconciliations, and accountant sign-off |

## 6. Decision register

No material policy below is decided by implementation inference. AS-E02 records broad founder authorization for historical improvement work; it is not approval evidence for these choices.

| Decision | Requirements | Unresolved question / existing policy evidence | Affected tasks; blocking? | Required approver |
|---|---|---|---|---|
| V2-D01 Control accounts | COA-02, COA-04, COA-06, COA-09, AR-01/08, AP-01/08 | **APPROVED by the product owner for V2-IMP-005, 2026-09-23.** (1) Every Control account has exactly one explicit customer or supplier binding; multiple Control accounts of either type are allowed. (2) Generic/manual journals cannot post to Control; normal movement must come from its trusted linked subledger. (3) Exceptional Control adjustment uses a dedicated privilege and path with mandatory reason, reference and append-only audit evidence. (4) Dated reconciliation must be zero or explicitly explained; an unavailable provider is never represented as zero. (5) Role and binding are immutable after creation/history; replacement is archive-and-create, with no name-based legacy inference. | Implemented locally in V2-IMP-005 at contract level; no longer blocking V2-IMP-006. Real AR/AP providers remain dependencies of 008/009. | Product-owner policy approval recorded; finished implementation is not accountant UAT/acceptance |
| V2-D02 Opening and cutoff | OPEN-01–08 | Year-start vs midyear treatment; whether a source TB must balance without a plug; retained P&L/equity handling; approval, lock and correction rules. Existing RPC silently balances to Opening Balance Equity and is not approval evidence. | V2-IMP-006; blocking | Accountant + product owner |
| V2-D03 Journal numbers | JRN-02–03 | Organization/fiscal-year scope, assignment moment, format, gaps after rollback, reuse prohibition and legacy records. No current number exists. | V2-IMP-003; blocking for numbering, not other center work | Accountant + product owner |
| V2-D04 Statements and cash flow | COA-07, FS-01/03/04/07/08 | Approved statement map, effective-date/history treatment, and line-level cash-flow classification including split journals. Current dominant-counterpart heuristic is implementation, not approved policy. | V2-IMP-007; blocking | Accountant |
| V2-D05 Receivables | AR-01–09 | Recognition timing, allocation cardinality, credits, unallocated receipts, overpayments, write-offs/adjustments and reversed allocation behavior. | V2-IMP-008; blocking | Accountant + product owner |
| V2-D06 Payables | AP-01–09 | Recognition timing, allocation cardinality, supplier credits, unallocated payments, overpayments, expense-vs-asset bills and reversed allocations. | V2-IMP-009; blocking | Accountant + product owner |
| V2-D07 Periods/year end | CORE-05, JRN-08, PER-01–08 | **APPROVED by the product owner in the V2-IMP-004 orchestration stream, 2026-09-23.** (1) Fiscal year is configurable per organization. (2) Soft Closed blocks normal posting and permits only an authorized adjustment journal with a mandatory reason. (3) Hard Closed blocks every new posting until reopening. (4) Reopening is privileged, reasoned, immutable-audited, and Hard Closed must reopen to Soft Closed before Open. (5) Year-end posts a traceable Retained Earnings closing journal while historical P&L continues to show the actual operating result. | Implemented locally in V2-IMP-004; no longer blocking later implementation tasks | Product-owner policy approval recorded; finished implementation is not accountant UAT/acceptance |
| V2-D08 Bank matching | BANK-01–08 | Matching tolerances, one-to-many/many-to-one, transfer treatment, unmatch/correction, completion/reopening and outstanding-item rules. | V2-IMP-010; blocking | Accountant + product owner |
| V2-D09 Depreciation/assets | FA-01–09 | Methods, conventions/proration, capitalization date, residual/useful-life changes, impairment, disposal and correction policy. Useful-life metadata alone is not approval. | V2-IMP-011; blocking | Accountant + product owner |
| V2-D10 Dimensions | DIM-01–06 | Required/optional applicability, multi-allocation cardinality, inactive values, retroactive changes and explicit Unassigned reporting. | V2-IMP-012; blocking | Accountant + product owner |
| V2-D11 Tax/VAT | TAX-01–07 | Jurisdiction/business circumstances, current rates/rules, rounding, tax points, adjustments, document/report scope, and external compliance boundaries. Requires dated authoritative regulatory verification; no compliance claim is authorized. | V2-IMP-013; blocking | Accountant + product owner, with authoritative regulatory verification |
| V2-D12 Inventory accounting | INV-01–07 | Source-of-truth movements, control accounts, valuation/costing, negative stock, returns, backdating and correction/revaluation treatment. | V2-IMP-014; blocking | Accountant + product owner |
| V2-D13 Foreign-currency AR/AP | CORE-07, AR/AP if multi-currency obligations are approved | Whether obligations settle in different currencies and require realized/unrealized FX/revaluation. Current transaction currency support does not decide subledger policy. | V2-IMP-008/009 only if approved; approval-required addition | Accountant + product owner |

Compact blocking questions for approvers: approve D01–D04 and D07 first because they define the ledger/control/reporting spine; approve D05/D06 before AR/AP; D08/D09 before their P0 modules; and separately decide D10–D12 without downgrading P0 bank or fixed assets.

## 7. Integration boundaries and dependency-ordered task sequence

These are non-negotiable preservation boundaries for every implementation task:

1. Financial effects enter app.transactions/app.transaction_entries only through the common backend posting contract; a subledger/register/import/UI never maintains an independent authoritative balance.
2. AR invoice and AP bill recognition post once. Receipt/payment allocation clears Control against cash and never records revenue/expense a second time.
3. Bank matching links a statement line to existing journals without posting them again. Only an explicitly authorized unmatched adjustment creates a new journal through the engine.
4. AR/AP, bank, fixed-asset, dimension, tax and inventory reports must reconcile by organization/date to designated ledger accounts; Unassigned dimension amounts are included.
5. Every manual, import, recurring, opening, subledger, asset, tax, inventory and adjustment path enforces organization, permission, eligible account, period and idempotency inside the same database transaction.
6. Posted history is immutable. Corrections use traceable reversal/adjustment/replacement relationships, never silent mutation.
7. Shared packages remain app-agnostic; Ledger-owned schema/functions stay under apps/ledger-suit/supabase, with generated types regenerated from source in implementation tasks.

### Sequence

| Order | Task | Requirements | Dependencies / approval gate | Observable result |
|---:|---|---|---|---|
| 1 | V2-IMP-001 Posting idempotency integrity | CORE-06, OPEN-07, VAL-06 | None; first unblocked task | Same request is exactly-once and a conflicting reuse is rejected |
| 2 | V2-IMP-002 Six-column Trial Balance | TB-01–07, FS-04, VAL-03 | 001 | Period TB calculates, exports, totals and drills down from one contract |
| 3 | V2-IMP-003 Journal identity and center | JRN-01–08, VAL-03 | 001; D03 for numbering | Full headers/filters/views/relationships/actions in one workspace |
| 4 | V2-IMP-004 Period state machine and year close | CORE-05, PER-01–08, VAL-05/06 | 001; D07 | Open/Soft/Hard rules and concurrent close/post are atomic/audited |
| 5 | V2-IMP-005 Control-account and subledger contract | COA-02/04/06/09, AR/AP-01/08, VAL-02 | 001, 004; D01 | Control role/bindings/reconciliation and exceptional-adjustment rule |
| 6 | V2-IMP-006 Opening migration workflow | OPEN-01–08, VAL-03 | 001, 002, 004, 005; D02 | Import/map/validate/preview/approve/post/lock/correct opening batch |
| 7 | V2-IMP-007 Financial statements and traceability | COA-07, FS-01–08, VAL-03 | 002–005; D04 | Approved mapped statements reconcile and drill down with context |
| 8 | V2-IMP-008 Accrual customer subledger | AR-01–09, VAL-04 | 003–005; D01, D05; D13 only if added | Invoice/open item/receipt allocation/statement/aging/Control reconciliation |
| 9 | V2-IMP-009 Accrual supplier subledger | AP-01–09, VAL-04 | 003–005; D01, D06; D13 only if added | Bill/open item/payment allocation/statement/aging/Control reconciliation |
| 10 | V2-IMP-010 Bank reconciliation | BANK-01–08, VAL-05 | 003–005; D08 | Statement import/match/adjust/complete with no reposting |
| 11 | V2-IMP-011 Fixed assets | FA-01–09, VAL-05 | 003–005, 007; D09 | Register/schedule/post/dispose/reconcile to GL |
| 12 | V2-IMP-012 Accounting dimensions | DIM-01–07, VAL-05 | 002–005; D10 | Controlled dimensions and reconciled grouped/filter reports |
| 13 | V2-IMP-013 Approved tax/VAT scope | TAX-01–07, VAL-05 | 003–005, relevant documents; D11 + current regulatory evidence | Only approved tax scope calculates, posts, reports and reconciles |
| 14 | V2-IMP-014 Approved inventory accounting | INV-01–08, VAL-05 | 003–005 and any approved dimension/tax dependency; D12 | Approved movement/valuation source posts and reconciles inventory/COGS |
| 15 | V2-IMP-015 Cross-module accounting acceptance | CORE-08, COA-09, VAL-01–08 | Implemented modules and approvals | Clean rehearsal, regression, reconciliation, recovery drill and accountant UAT evidence |

Dimensions, tax/VAT and inventory are sequenced separately and have no priority invented here. Bank reconciliation and fixed assets remain P0.

## 8. Executable task cards

Unless a card says otherwise, discovered paths are apps/ledger-suit/app, apps/ledger-suit/supabase/migrations, apps/ledger-suit/supabase/tests, apps/ledger-suit/tests, and apps/ledger-suit/types/database.types.ts. Proposed paths/objects are examples to be chosen in that task; they are not evidence that a file/object exists.

### V2-IMP-001 — Posting idempotency integrity (first unblocked)

- Status: IMPLEMENTED LOCALLY / READY FOR REVIEW on 2026-09-23. It is not deployed, hosted-verified, accountant-accepted, or production-verified.
- Scope/result: bind every idempotency key to a canonical posting request identity. Same organization+key+same payload returns the same journal; same key+different payload returns an explicit conflict; concurrent equal requests create exactly one journal, audit event, and quota effect.
- Why unblocked: DB-POST, the unique key, duplicate fingerprint, audit/quota hooks and core SQL test harness already exist. This changes transaction-integrity semantics, not an unresolved accounting policy. It is the one and only first implementation task selected by this baseline.
- Retain/extend: retain the common engine, current transaction IDs and existing valid idempotent responses; extend app.create_transaction_draft/create_and_post and all wrappers. Do not create a second posting route.
- Paths/objects: implemented by DB-IDEMP and T-IDEMP. New private objects are app.posting_idempotency, app.posting_request_fingerprint, app.claim_posting_idempotency, and app.complete_posting_idempotency; public.create_draft_transaction, app.create_and_post, and public.create_adjustment are redefined without changing public signatures. No generated type change is required.
- Migration/history/cross-app risk: additive forward migration; existing keys need a nullable/versioned compatibility rule and no reinterpretation of posted history. Main risk is breaking import/recurrence/commitment retries or incrementing quota/audit twice. Shared packages must not acquire Ledger schema dependencies.
- Acceptance/accounting: (1) same payload/key sequentially and concurrently returns one transaction ID; (2) different payload/key conflict posts nothing; (3) debit=credit and transaction/entry/audit/quota counts change once; (4) no-key legacy behavior remains documented; (5) income, expense, transfer, opening, import, recurring and commitment wrappers pass.
- Tests/interface: database barrier/concurrency tests plus wrapper regressions; browser/API check shows a localized non-retryable conflict and no duplicate row. Run existing 01, 03, 19, 21 and affected e2e suites on a pristine disposable database.
- Rehearsal/recovery/review: before/after counts and trial-balance/integrity snapshot; rehearse forward migration on disposable local; recovery is a forward fix/temporary affected-write block, never deletion of a posted duplicate. Review requires SQL diff, concurrency transcript, query plan/lock analysis and reconciliation artifact.

### V2-IMP-002 — Six-column Trial Balance

- Status: IMPLEMENTED LOCALLY / READY FOR REVIEW on 2026-09-23. It is not deployed, hosted-verified, accountant-accepted, or production-verified.
- Scope/result: one period-aware calculation contract supplies opening debit/credit, period debit/credit and closing debit/credit to UI, CSV and drill-down. TB-01 through TB-07 are implemented in repository/local evidence.
- Dependencies/gates: V2-IMP-001; no accounting-policy gate.
- Retain/extend: public.report_trial_balance remains the sole UI/export calculation path, now requiring from/to dates; public.export_financial_report_csv calls it directly. AccountActivityDialog is reused for account→movement→journal drill-down. Group posting rules and actual Contra ledger signs are unchanged.
- Paths/objects: apps/ledger-suit/supabase/migrations/20260923144500_six_column_trial_balance.sql; supabase/tests/33_six_column_trial_balance_test.sql; app/pages/reports.vue; app/components/AccountActivityDialog.vue; app/utils/localizedCsv.ts; EN/AR locale files; generated database.types.ts; focused unit/e2e contracts.
- Migration/risk: forward function-contract replacement only; no tables, rows, balances or posted history are mutated. The old as-of two-column signature is removed because all known consumers migrate atomically. Hosted rollout must deploy the migration and compatible app together. Recovery is a forward compatible function correction, never ledger mutation.
- Acceptance/tests: local disposable migration applied successfully. The focused export/nature/TB SQL set passed 85/85 (including T-TB 33/33); localized CSV unit tests passed 6/6; Ledger app targeted typecheck and changed-file lint passed. V2-VER-002A then executed the focused Chromium Trial Balance group against seeded local Supabase: 2/2 passed (English/LTR and Arabic/RTL), covering all six columns, exact boundary amounts/totals, reactive period changes, opening/period/closing account activity, journal navigation/back, period preservation and desktop/mobile usability. AC-9 and AC-11 are PASS. `git diff --check` passed; broad SQL/browser/build/full-lint suites remained intentionally unrun under the focused task policy.
- Remaining limitations: no hosted/deployment evidence and no accountant/UAT acceptance. Group accounts are metadata-only in this report and are intentionally excluded from authoritative rows/totals rather than shown as duplicate rollups.
- Git/PR: implementation commit d4a5354790e63e2db7516d1c93d36a092af6e14c; cumulative draft PR [#18](https://github.com/Building-Suit/building-suit-monorepo/pull/18), base `stg`, head `codex/ledger-suit/v2-baseline`.

### V2-IMP-003 — Journal identity and professional center

- Status: IMPLEMENTED LOCALLY / READY FOR REVIEW on 2026-09-23, with final sequential numbering explicitly gated by V2-D03. It is not deployed, hosted-verified, accountant-accepted or production-verified.
- Scope/result: the existing `/transactions` workspace is now the professional Journal Center over the one authoritative ledger. It shows immutable journal references, accounting metadata, separate actual debit/credit totals, route-backed source/date/account/status filters, private saved views, immediate lines, source-record links, and bidirectional reversal/correction relationships.
- Numbering policy actually implemented: `journal_reference` is a stored generated `JRN-` plus the complete UUID payload. It is deterministic for all historical/current rows, globally unique through the existing UUID plus a unique index, immutable by generation, allocated once with the row, and reused by idempotent retries because they resolve to the same row. It is an identity safety bridge, not the disputed fiscal-year sequential number; V2-D03 still controls scope, final assignment, format and gap rules.
- Saved-view persistence: existing `public.saved_views`, resource `journal_center`, private visibility, owner/organization RLS, with a database constraint accepting only whitelisted string filters and whitelisted sort column/direction. UI supports save, apply and remove; rename remains available through the existing owner update policy but is not exposed in this focused UI.
- Paths/objects: migration `20260923161002_journal_center.sql`; generated database types; `useTransactionWorkspace`, `useJournalSavedViews`, transactions page, detail dialog, EN/AR locales; focused SQL/browser specs. Database objects: `transactions.journal_reference`, `app.is_valid_journal_view`, `app.mark_commitment_journal_source`, commitment-source trigger/backfill, extended `transaction_summaries`, and extended `search_transactions`.
- Data preservation/risk: clean disposable-local reset replayed the migration. The generated reference deterministically covers historical rows without rewriting IDs/amounts; commitment backfill changes only source presentation from manual to its already authoritative settlement relationship. No hosted database was touched. Recovery is a forward correction; posted entries and balances must never be rewritten.
- Verification: focused Journal Center SQL 19/19; retained V2 idempotency and Trial Balance SQL 70/70; focused Chromium Journal Center 2/2 in EN/LTR and AR/RTL including narrow viewport; Ledger typecheck, changed-file lint, targeted Ledger build and `git diff --check` passed. An accidental broad browser invocation was stopped after three unrelated passes; its generated screenshots were restored and it is not acceptance evidence.
- Acceptance: AC-1 PASS; AC-2 PASS for stable reference foundation but final approved sequential number remains gated; AC-3 PASS for UUID uniqueness/index and idempotent reuse, while sequential allocation is not implemented; AC-4 through AC-10 PASS; AC-11 PASS for the current capability/status/basic-lock model, with final period states deferred to 004; AC-12 PASS; AC-13 PASS.
- Unresolved decision: V2-D03 remains the smallest blocker for final professional sequential numbering (organization/fiscal-year scope, assignment moment, format, gaps and legacy presentation). V2-D07 remains the blocker for the future Open/Soft/Hard period action matrix; the current inclusive lock is preserved.
- Git/PR: implementation commit `b5eb65b7cd66f880ea91b871bde324ba6423cf02`; cumulative Draft PR [#18](https://github.com/Building-Suit/building-suit-monorepo/pull/18), base `stg`, head `codex/ledger-suit/v2-baseline`.

### V2-IMP-004 — Accounting periods and closing

- Status: IMPLEMENTED LOCALLY / READY FOR REVIEW on 2026-09-23 under product-owner-approved V2-D07. Not deployed, hosted-verified, production-verified, or accountant-accepted.
- Scope/result: first-class organization periods, Open/Soft Closed/Hard Closed transitions, fine-grained capabilities, mandatory reasoned reopening, append-only history, configurable non-calendar fiscal-year resolution, idempotent year close, and atomic close/post serialization.
- Migrations/objects: `20260923165710_add_year_end_close_source.sql` and `20260923165711_accounting_periods_and_closing.sql`; `accounting_periods`, `accounting_period_transitions`, `fiscal_year_closes`; controlled create/transition/context/year-close RPCs; one shared source-aware posting guard. Generated database types were refreshed.
- Posting architecture: every current flow still converges on `app.create_and_post`/`public.post_transaction`; the period guard locks the organization settings row before reading state. Open preserves behavior. Soft permits only `manual`+`adjustment` with both adjustment and Soft-Close capability and a reason; the system year-close source is separately authorized. Hard has no bypass. Soft-Closed reversals are deliberately blocked because the existing reversal pathway does not implement the approved adjustment exception safely.
- Legacy lock compatibility: `books_locked_until` is retained unchanged as an inclusive compatibility guard. A user without the existing `books.override_lock` remains blocked on/before the same date; the pre-existing override behavior is preserved only for that legacy boundary and never bypasses Soft/Hard period states. No historical period is fabricated and no existing journal/date is rewritten.
- Fiscal/year-end architecture: existing `organizations.fiscal_year_start_month` and the protected organization `retained_earnings` system account are authoritative. The database derives temporary-account balances, posts one balanced `year_end_close` journal, and records one immutable relationship per organization/fiscal year. P&L excludes this explicit source only; GL and Trial Balance retain the journal. Reopened-year changes never mutate or regenerate the original close; a revised-close correction policy remains intentionally uninvented.
- Reconciliation: before and after migration the deterministic local database remained 76 journals / 70 posted / debit 655,200 / credit 655,200, with no non-null legacy locks in that snapshot. The profitable fixture produced revenue 1,000,000 minor units, expenses 700,000, net income 300,000 and an equal Retained Earnings credit; its Soft-Close adjustment used balance-sheet accounts and did not alter that operating result. The separate loss fixture produced a 200,000-minor Retained Earnings debit. Historical P&L preserved both results.
- Focused verification: period/year-end SQL 34/34; independent-session close/post race 8/8; retained idempotency 37/37; retained six-column Trial Balance 33/33; focused Chromium periods + Journal Center 2/2 (EN/LTR and AR/RTL); Ledger typecheck and two targeted builds passed; `git diff --check` passed. DB lint reported the pre-existing `export_financial_report_csv` STABLE/volatile warning only.
- Acceptance: AC-1–AC-16 PASS locally. No hosted database was accessed. No deploy or merge occurred.
- Git/PR: implementation commit `ccb4c96125dc90e8487682dbcf1370cc9ce1bc8c`; cumulative Draft PR [#18](https://github.com/Building-Suit/building-suit-monorepo/pull/18), base `stg`, head `codex/ledger-suit/v2-baseline`, is the synchronization target for this completed task.
- Remaining decision/limitation: no new material decision was invented. Reversal into Soft Closed remains blocked; revision of a previously created closing journal after later reopened-year activity requires a future explicit correction-lifecycle policy.
- Next dependency-order task: V2-IMP-005 — Control-account and subledger contract; implementation remains gated on V2-D01 approval.

### V2-IMP-005 — Control-account and subledger contract

- Scope/result: implemented locally — explicit Control role; exactly one immutable customer/supplier binding per Control account; server-enforced compatible nature/classification; generic-posting exclusion; dated reconciliation; and a dedicated exceptional-adjustment contract.
- Dependencies/gates: 001 and 004 retained; V2-D01 is approved and encoded as the five policy decisions in section 6.
- Architecture: all writes still converge on the shared posting engine. A private server-set context permits only trusted subledger adapters or `create_control_adjustment`; the public adjustment RPC requires `controls.adjust`, period authorization, reason, reconciliation reference and idempotency. Audit/reconciliation evidence is append-only. Group remains structural; Posting remains the only generic selector role; Control participates in GL, account activity and Trial Balance.
- Capabilities: owner/admin receive configure, adjust, reconcile and explain-variance capabilities. Accountant receives reconciliation only by default; adjustment is deliberately separate. RLS and explicit grants cover all new public objects; private helpers are revoked.
- Reconciliation boundary: the dated RPC returns GL balance plus provider status. The current customer/supplier provider deliberately returns unavailable/null, never a synthetic zero. Real production AR/AP subledger providers do not yet exist and remain work for V2-IMP-008/009.
- Migration/preservation: no account was reclassified or inferred from name/subtype. The observed pre/post disposable snapshot stayed at 44 Posting accounts, 3 posted journals, 6 entries and debit=credit=300 minor units. Binding/role replacement is archive-and-create.
- Local verification: clean migration replay; Control SQL 44/44; retained account-nature 40/40, Group 29/29, posting idempotency/concurrency 37/37, six-column Trial Balance 33/33 and accounting periods 34/34 (217/217 total); unit 22/22; Chromium 2/2 in English/LTR and Arabic/RTL; Ledger typecheck, changed-file lint and production build passed. DB lint reported only the pre-existing `export_financial_report_csv` STABLE/volatile warning.
- Acceptance: AC-1–AC-16 PASS locally. No hosted database was accessed; no deployment or merge occurred. Implementation commit: `IMPLEMENTATION_COMMIT`; cumulative Draft PR [#18](https://github.com/Building-Suit/building-suit-monorepo/pull/18).
- Remaining limit: COA-09 is contract-complete but cannot prove a real subledger-to-Control zero until V2-IMP-008/009 provide authoritative customer/supplier ledgers.
- Next dependency-order task: V2-IMP-006 — Opening-balance migration workflow.

### V2-IMP-006 — Opening-balance migration workflow

- Scope/result: versioned batch upload, source-account mapping, explicit DR/CR, cutoff, validation/preview, approval, shared-ledger posting, lock and traceable correction.
- Dependencies/gates: 001, 002, 004, 005 and V2-D02.
- Retain/extend: CSV staging patterns and DB-FLOWS opening engine call, but remove silent policy assumptions from the user workflow.
- Paths/objects: discovered DB-IMPORT/UI-IMPORT/DB-FLOWS; proposed opening batch/row/mapping/approval objects and focused interface.
- Migration/risk: no existing posted opening is rewritten; link/identify legacy opening entries only with review. Risk is duplicated balances or inappropriate equity plug.
- Acceptance/tests: invalid/unbalanced/ineligible rows block with row errors; preview totals equal eventual one journal; repeated/concurrent confirmation posts once; six-column TB/GL/statements trace batch; correction preserves original.
- Rehearsal/recovery/review: representative year-start/midyear dry runs, pre/post TB and statements, restore copy or forward reversal plan; accountant signs mapping and expected balances.

### V2-IMP-007 — Financial statements, mappings and traceability

- Scope/result: approved effective-dated mapping for all statements, accurate cash-flow treatment, TB/GL reconciliation, drill-down and preserved context/history.
- Dependencies/gates: 002–005 and V2-D04.
- Retain/extend: current reports, dated BS classification, nature/Contra logic, account activity and exports.
- Paths/objects: discovered DB-REPORT/DB-CLASS/DB-EXPORT/UI-REPORT; proposed versioned mapping/classification contract for uncovered statements.
- Migration/risk: never silently remap historical periods; risk is cash-flow misclassification for split journals and changed historical labels.
- Acceptance/tests: statements tie to TB/GL; mapped/unclassified totals explicit; split-cash fixtures; Contra cases; report→account→movement→journal→back preserves context; UI/export agree.
- Rehearsal/recovery/review: parallel old/new outputs and variance explanation; versioned mapping rollback by forward effective record; accountant signs mappings and fixtures.

### V2-IMP-008 — Accrual customer subledger

- Scope/result: customer invoices/accounting obligations, open items, receipt allocation, credits/overpayments/corrections, statements, aging and AR Control reconciliation.
- Dependencies/gates: 003–005, V2-D01 and D05; D13 only if multi-currency subledger is approved.
- Retain/extend: counterparties and commitment concepts where compatible; do not reuse settlement behavior that records income at receipt after invoice recognition.
- Paths/objects: discovered DB-ARAP/UI-ARAP/T-ARAP; proposed customer documents/open items/allocations/reconciliation APIs and pages.
- Migration/risk: existing commitments need explicit classify/link/leave-legacy decision, never automatic conversion. Risk is duplicate revenue and altered outstanding history.
- Acceptance/tests: invoice Dr AR/Cr revenue once; partial/full receipt Dr cash/Cr AR only; allocations reversible under policy; aging/statement roll forward; subledger=Control by date; isolation/permission/idempotency/concurrency.
- Rehearsal/recovery/review: dry-run legacy mapping and variance; feature-gated cutover; forward corrections/reversals. Accountant signs invoice/receipt/credit/aging fixtures.

### V2-IMP-009 — Accrual supplier subledger

- Scope/result: supplier bills/open items, payment allocation, credits/overpayments/corrections, statements, aging and AP Control reconciliation.
- Dependencies/gates: 003–005, V2-D01 and D06; D13 only if multi-currency is approved.
- Retain/extend: counterparties/commitments where compatible; payment must not record expense/asset again.
- Paths/objects: DB-ARAP/UI-ARAP/T-ARAP plus proposed supplier document/open-item/allocation/reconciliation interfaces.
- Migration/risk: explicit handling of legacy payables; risk is duplicate expense/asset and wrong tax/inventory coupling.
- Acceptance/tests: bill Dr approved expense/asset/Cr AP once; payment Dr AP/Cr cash only; allocation lifecycle, aging/statement and AP Control tie; all security/concurrency cases.
- Rehearsal/recovery/review: legacy dry run/variance, feature-gated cutover, forward correction; accountant approves fixtures.

### V2-IMP-010 — Bank reconciliation

- Scope/result: statement batches/lines, validation/deduplication, match/unmatch, adjustments, completion and historical reconciliation.
- Dependencies/gates: 003–005 and V2-D08.
- Retain/extend: existing bank accounts, transaction search and posting engine.
- Paths/objects: no current module (ABSENT-MODULES); proposed bank statement/reconciliation tables/RPCs/workspace/tests.
- Migration/risk: usually additive; never infer matches that alter journals. Risk is duplicate import/reposting or lost outstanding items.
- Acceptance/tests: duplicate file/line blocked; match leaves journal count/balances unchanged; authorized adjustment posts once; equation ties statement to ledger/outstanding; completed history remains navigable.
- Rehearsal/recovery/review: import/match dry run on disposable data, before/after journal fingerprint; unmatch/forward correction policy; accountant approves tolerances and reconciliation fixture.

### V2-IMP-011 — Fixed assets and depreciation

- Scope/result: register, acquisition link, approved schedules, depreciation posting, cost/accumulated depreciation/NBV, disposal and GL reconciliation.
- Dependencies/gates: 003–005, 007 and V2-D09.
- Retain/extend: asset-purchase flow metadata and common engine.
- Paths/objects: DB-FLOWS asset flow; proposed register/schedule/run/disposal/reconciliation APIs and UI.
- Migration/risk: do not create assets automatically from historical purchases without reviewed mapping; risk is duplicated acquisition/depreciation and historical schedule drift.
- Acceptance/tests: approved schedule math; exactly one depreciation per asset/period; NBV equation; disposal gain/loss entries; register control totals=GL; correction links preserve history.
- Rehearsal/recovery/review: dry-run mapping/schedule through disposal, pre/post control totals, forward reversal/rebuild of unposted schedule only; accountant signs fixtures.

### V2-IMP-012 — Accounting dimensions

- Scope/result: controlled cost centers/projects, line allocations, historical validity, filters/groups and explicit Unassigned reconciliation.
- Dependencies/gates: 002–005 and V2-D10.
- Retain/extend: generic entry dimensions only through a compatible controlled transition.
- Paths/objects: DB-LEDGER generic JSON; proposed dimension/value/allocation tables or typed schema and report filters/UI.
- Migration/risk: old JSON cannot be assumed valid; keep it readable and map only reviewed values. Risk is totals excluding unassigned or allocations exceeding lines.
- Acceptance/tests: allocations sum to line; inactive/historical values behave per policy; grouped+Unassigned equals unfiltered TB/GL; tenant/permission and RTL UI checks.
- Rehearsal/recovery/review: mapping dry run/unmapped report, parallel totals, forward mapping corrections; accountant/product review.

### V2-IMP-013 — Approved tax/VAT accounting

- Scope/result: implement only the jurisdiction/circumstances/configuration/documents/calculation/adjustment/report scope approved in D11, through the common engine.
- Dependencies/gates: 003–005, relevant document modules, V2-D11 and dated authoritative regulatory evidence.
- Retain/extend: tax identifiers/account subtypes and posting engine only where the approved policy confirms them.
- Paths/objects: no module (ABSENT-MODULES); proposed scoped tax configuration/lines/mappings/report objects.
- Migration/risk: additive configuration with effective dates; never infer legal rates or claim compliance. Risk is incorrect liability, rounding or historical recalculation.
- Acceptance/tests: regulator/accountant-approved examples calculate exactly; tax report=control GL=sources; adjustment/reversal/history/security; wording remains scoped.
- Rehearsal/recovery/review: authoritative source citation/date, parallel calculation, pre/post tax-control reconciliation, forward effective-date correction; accountant and product approval.

### V2-IMP-014 — Approved inventory accounting

- Scope/result: connect an approved movement/valuation source to controls/COGS using the approved costing and correction policy, with traceability and reconciliation.
- Dependencies/gates: 003–005, approved relevant tax/dimension dependencies and V2-D12.
- Retain/extend: inventory account subtype and posting engine; no operational WMS/procurement/order/manufacturing expansion.
- Paths/objects: no movement/valuation module (ABSENT-MODULES); proposed accounting adapter/valuation/reconciliation objects after source ownership is decided.
- Migration/risk: no inferred opening quantity/cost; risk is backdated cost changes, duplicate COGS and divergence from source movement data.
- Acceptance/tests: approved purchase/increase/decrease/return/adjustment fixtures; deterministic one-time journals; valuation and COGS tie to GL; source↔journal trace; historical corrections follow policy.
- Rehearsal/recovery/review: source snapshot and valuation dry run, variance report, feature-gated posting, forward adjustment/reversal; accountant/product approval.

### V2-IMP-015 — Cross-module reconciliation and accountant acceptance

- Scope/result: run the complete accounting story on a clean disposable environment, rehearse migrations/recovery, verify regression/interface/accessibility/localization, and collect independent accountant acceptance.
- Dependencies/gates: only modules actually implemented and all applicable decisions.
- Retain/extend: existing SQL/unit/e2e suites and accountant-system evidence conventions.
- Paths/objects: tests/evidence/docs only plus defect fixes in separately authorized tasks; no test changes that mask failures.
- Migration/risk: representative sanitized historical dataset and fresh schema; risk is accepting isolated green tests while cross-module totals diverge.
- Acceptance/tests: every requirement has separate code/test/deploy/UAT state; journal debits=credits; TB/GL/statements and every control/register reconcile; duplicate/close concurrency and recovery drills pass; EN/AR, RTL, responsive, permission and organization checks pass.
- Rehearsal/recovery/review: attach exact commands/logs, pre/post artifacts, defect list, recovery timings and named accountant sign-off. Deployment remains separate authorization.

## 9. Migration, reconciliation and recovery protocol

Future data-affecting tasks must use new forward migrations under apps/ledger-suit/supabase/migrations. Applied migration history is immutable.

Before each rehearsal, record environment identity as disposable/local, migration version, row counts and checksums appropriate to the objects, journal/entry counts, debit and credit sums by organization/currency/date, Trial Balance, Balance Sheet integrity, and relevant subledger/register/control totals. Afterward, repeat the same queries and explain every intended delta. Include archived accounts, reversals, adjustments, duplicate keys and boundary dates.

Rehearsal order is fresh disposable database, representative sanitized snapshot where authorized, then separately authorized staging. No production reset or destructive fixture is permitted. Recovery must be a tested forward repair, feature/write gate, or traceable reversal as appropriate; never delete posted history or rewrite an applied migration. A rollback of application code must remain compatible with the forward schema.

The documentation-baseline phase produced no pre/post migration reconciliation because it authored/applied no migration. V2-IMP-001 subsequently applied its additive migration to a fresh disposable local database and verified journal, entry, audit, quota, conflict, tenant, failure-recovery, and concurrency outcomes. No hosted environment was contacted.

## 10. Proposed scope additions requiring explicit approval

These are not silently added requirements and have no implementation priority:

- Foreign-currency AR/AP settlement, realized/unrealized exchange differences and revaluation (V2-D13).
- Electronic invoicing, electronic receipts, government submission or other tax compliance integrations beyond approved accounting/reporting scope (part of V2-D11).
- Automated bank feeds, OCR/document capture and machine-suggested matching beyond statement import/manual review.
- Asset impairment/revaluation, component accounting or lease accounting beyond the approved fixed-asset/depreciation policy.
- Operational inventory, warehouse, purchasing, sales-order or manufacturing features; these remain out of scope even if an accounting adapter is approved.

## 11. Implementation checkpoint and next action

- Completed cumulative stream: baseline assessment at e51435c52f8c3d36b4dccd86c1adb731dd2cb2a5; V2-IMP-001 at 7bfb37ee7326a4b8ae387dd6783b5f72cfd7a941; V2-IMP-002 at d4a5354790e63e2db7516d1c93d36a092af6e14c; V2-IMP-003 at ed9a81f6916e3d0f2f7a85be4e2e62bd0e413aa8; V2-IMP-004 at ccb4c96125dc90e8487682dbcf1370cc9ce1bc8c; V2-IMP-005 at `IMPLEMENTATION_COMMIT`.
- V2-IMP-005 evidence: additive migrations `20260923183123`/`20260923183124`; 217/217 focused SQL assertions; unit 22/22; focused local Chromium 2/2 in English/LTR and Arabic/RTL; Ledger typecheck, changed-file lint and production build passed; generated database types updated. Existing rows and balanced ledger totals were unchanged across the pre/post snapshot.
- Preservation: the cumulative stream retains the shared posted-ledger engine, double-entry enforcement, immutable correction history, organization authorization, currency/base-minor-unit rules, audit/quota behavior and existing report/export facilities. Control does not create a second ledger or a false subledger balance.
- Unresolved risks/limits: hosted migration/app compatibility remains unverified; accountant/UAT acceptance is not started; real production AR/AP subledger providers remain absent; broad suites remain unrun under the task-specific targeted verification policy.
- Git/PR: cumulative draft PR [#18](https://github.com/Building-Suit/building-suit-monorepo/pull/18), base `stg`, head `codex/ledger-suit/v2-baseline`. Its presence is review coordination only, not deployment or acceptance.
- Exact next ordered task: V2-IMP-006 — Opening-balance migration workflow, whose dependencies 001/002/004/005 are now locally implemented; V2-D02 remains its policy gate.

This checkpoint is implementation and local-test evidence only. It must not be interpreted as deployment, hosted verification, accountant acceptance, or production readiness.
