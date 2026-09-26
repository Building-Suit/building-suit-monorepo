# Ledger Suit Accounting V2 implementation baseline

2026-09-26 acceptance checkpoint: [V2-IMP-015 review](../v2-acceptance/README.md) is **BLOCKED**, with [four separate current states for all 138 requirements](../v2-acceptance/requirements.json). V2-D03 is approved by the linked task decision, but fiscal-year sequential numbering is still absent and requires a separate controlled repair. FS-08 rename-label acceptance, native integrated/recovery/browser evidence and named accountant sign-off remain pending. Historical assessments below do not substitute for this acceptance run.

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
| COA-07 | Current/non-current and statement classes | P0 | implemented locally as a mapping contract; organization-specific account mapping and accountant review remain pending | DB-CLASS; V2-IMP-007; T-COA; T-FS | Posting/Control accounts support effective-dated BS, P&L and Cash Flow mappings; unmapped balances remain visible and incomplete |
| COA-08 | Safe create/edit/archive | P0 | implemented — history, cycle, role, archival and posted-history guards exist | DB-COA; UI-COA; T-COA | Invalid hierarchy/role/archive changes fail while historical journals remain readable |
| COA-09 | Reconcile hierarchy/Control/Contra | P0 | partially implemented locally — hierarchy/Contra are retained and real dated AR/AP providers now exist; native AP SQL verification is still blocked by local Docker access | T-COA; V2-IMP-008/009 records | Clean disposable run proves hierarchy/Contra and both Control subledgers=GL by date; V2-IMP-005/008/009/015 / V2-D01 |

### Opening balances — P0

| ID | Meaning | Priority | Status and reason | Evidence; gap / smallest additional evidence | Measurable acceptance; task / decision |
|---|---|---:|---|---|---|
| OPEN-01 | Explicit opening workflow | P0 | implemented locally — `/opening-balances` creates/imports/maps/validates/previews/approves/posts/locks and reverses a batch | migration 20260923203000; opening-balances.vue; T-OPEN; UI-OPEN | Focused SQL and bilingual browser workflow pass; not deployed or accountant-accepted |
| OPEN-02 | Import opening TB with account mapping | P0 | implemented locally for CSV — original code/name/DR/CR/order remain independent of explicit Ledger mapping | opening_balance_rows; openingBalanceCsv.ts; T-OPEN | Source identity and reviewed mapping survive validation/posting; XLSX is not claimed |
| OPEN-03 | Cut-off date and explicit debit/credit | P0 | implemented locally — batch stores mode/cut-off and rows preserve explicit nonnegative Debit/Credit text and minor units | opening_balance_batches/rows; T-OPEN | Year Start/Midyear cutoff and side rules pass |
| OPEN-04 | Validate references, eligibility, values, balance | P0 | implemented locally — server validates tenant, active Posting/base-currency account, row values, mode, period and exact batch balance | app.compute_opening_validation; T-OPEN/T-CONTROL/T-PERIOD | Invalid rows and any variance block; no plug exists |
| OPEN-05 | Validation result and journal preview | P0 | implemented locally — normalized server result supplies row errors, totals, variance and the exact lines consumed by approval | validate/approve_opening_balance_batch; UI-OPEN | Preview and posted fixture totals both equal 15,000.00 DR/CR |
| OPEN-06 | Shared-ledger traceability | P0 | implemented locally — one batch posts one `opening_balance` journal through `app.create_and_post`; batch↔journal/reversal links are navigable | DB-POST; transaction metadata; detail dialog; T-OPEN | GL, Journal Center, six-column TB and statements retain normal ledger behavior |
| OPEN-07 | Controlled cutoff and duplicate protection | P0 | implemented locally — batch lock + organization period lock + idempotency + accepted-boundary unique index serialize approval | opening_balance_accepted_boundary_idx; T-OPEN-CONCURRENCY | Two sessions return one journal/two lines; independent accepted duplicate is blocked |
| OPEN-08 | Approval, lock, correction, year/midyear rules | P0 | implemented locally under approved V2-D02 — privileged approval, immutable posted evidence, linked reasoned reversal, Year Start P&L rejection and Midyear P&L preservation | capability/RLS/trigger/RPC contract; T-OPEN; UI-OPEN | Creator may approve; no four-eyes default; no deployment/accountant UAT claim |

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
| FS-01 | Complete Income, Balance Sheet, Cash Flow workflows | P0 | implemented locally; production mapping/UAT acceptance pending | DB-REPORT; DB-EXPORT; UI-REPORT; V2-IMP-007; T-FS | Mapped fixtures reconcile in local SQL and EN/AR browser flows; accountant signs actual layouts and balances |
| FS-02 | Current/non-current presentation | P0 | implemented — dated classified Balance Sheet supports applicable groups | DB-CLASS; UI-REPORT; T-COA | Effective-date fixtures place each applicable account in the approved current/non-current group |
| FS-03 | Consistent classification and Contra | P0 | implemented locally in reporting engine; actual organization mapping acceptance pending | DB-REPORT; DB-CLASS; V2-IMP-007; T-FS | Dated mappings, actual ledger signs and Contra reduction reconcile without hierarchy double count |
| FS-04 | Reconcile statements to TB/GL | P0 | implemented locally with per-account differences and mapping-completeness diagnostic | DB-REPORT; V2-IMP-007; T-FS; T-CORE | P&L/BS accounts tie to posted entries/six-column TB; CF ties to actual cash change; unresolved mapping remains separately visible |
| FS-05 | Statement drill-down | P0 | implemented locally for statement account rows and cash-flow source entries | UI-REPORT; DB-ACTIVITY; V2-IMP-007; T-FS | Browser exercises statement→account movement→journal→back; subtotals expose contributing account rows |
| FS-06 | Preserve report context on drill-down | P0 | implemented locally for route-backed tab/dates and dialog back navigation | UI-REPORT; DB-ACTIVITY; V2-IMP-007; T-FS | Browser verifies dates/tab survive movement→journal→back and dialog close; broader saved-filter/focus UAT pending |
| FS-07 | Approved mapping/cash-flow policies | P0 | product-owner V2-D04 implementation policy approved and encoded locally; accountant/UAT and organization mappings pending | DB-CLASS; DB-REPORT; V2-D04; V2-IMP-007; T-FS | Indirect cash flow uses explicit account/entry allocation; unresolved amounts remain Unclassified; no dominant-counterpart fallback |
| FS-08 | Historical access after account changes | P0 | partially implemented — effective mapping/archive history is tested; descriptive-name history after a permitted rename remains unproven | DB-COA; DB-CLASS; DB-REPORT; V2-IMP-007; T-FS | Earlier periods retain earlier classes and archived account journals remain accessible; verify historical display labels during accountant UAT |

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
| AP-01 | Supplier subledger tied to AP Control | P0 | implemented locally — supplier event balances route through explicit AP Control bindings | `ap_documents`; Control provider; supplier record | Supplier open items sum exactly to AP Control by date; V2-IMP-005/009 / V2-D01 |
| AP-02 | Supplier obligation attributes | P0 | implemented locally — immutable supplier, issue/due dates, reference, original amount, outstanding events and linked journal | `post_ap_document`; AP SQL fixture | Bill stores all fields and posts one traceable expense/asset recognition journal; V2-IMP-009 / V2-D06 |
| AP-03 | Payment allocation | P0 | implemented locally — many-to-many immutable fully allocated payments | `ap_allocations`; AP UI/SQL/concurrency fixtures | One/many payments allocate to one/many bills with immutable allocation history; V2-IMP-009 / V2-D01, V2-D06 |
| AP-04 | Partial settlement | P0 | implemented locally — dated event arithmetic preserves exact partial/full open balances | `read_ap_open_items`; AP SQL fixture | Partial payment reduces open item and Control exactly without re-recognizing expense/asset; V2-IMP-009 / V2-D01, V2-D06 |
| AP-05 | Credits/unallocated/overpay/adjust/reverse | P0 | implemented locally under V2-D06 — full allocation, linked account corrections, overpayment rejection and append-only reversals | `post_ap_document`; `reverse_ap_document`; AP SQL fixture | Each approved case has traceable state/journal/allocation behavior; V2-IMP-009 / V2-D06 |
| AP-06 | Supplier statements | P0 | implemented locally — dated movement detail and signed roll-forward | `read_ap_statement`; payables page | Statement roll-forward opening+bills+adjustments-payments=closing and ties to open items; V2-IMP-009 / V2-D01, V2-D06 |
| AP-07 | Payables aging | P0 | implemented locally — immutable due-date buckets assign each open amount once | `read_ap_open_items`; exact-money unit; AP UI | Approved buckets assign every outstanding amount once and sum to AP; V2-IMP-009 / V2-D01, V2-D06 |
| AP-08 | Subledger-to-Control reconciliation | P0 | implemented locally — real supplier provider compares dated AP events with credit-normal Control GL and preserves variances | dual `control_subledger_balance`; AP workspace | As-of subledger total equals AP Control with explicit zero/explained variance; V2-IMP-009 / V2-D01, V2-D06 |
| AP-09 | Avoid expense/asset twice | P0 | implemented locally — bill is Dr Expense/Asset / Cr AP; payment is Dr AP / Cr Cash only | shared posting journal plus AP SQL fixture | Bill recognizes expense/asset once; payment only moves AP/cash; V2-IMP-009 / V2-D06 |

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
| FA-01 | Fixed-asset register | P0 | implemented locally — explicit register/API/UI; native DB/UI execution pending | V2-IMP-011 task record | Register lists each asset, status and ledger links; V2-IMP-011 / V2-D09 |
| FA-02 | Link acquisition/accounts/records | P0 | implemented locally — reviewed posted acquisition and designated-account links | V2-IMP-011 migration/fixture | One asset traces to acquisition source/journal and designated asset/depreciation accounts; V2-IMP-011 / V2-D09 |
| FA-03 | Depreciation-policy inputs | P0 | implemented locally — validated dates/cost/residual/life/method/rate and immutable versions | V2-IMP-011 migration/unit | Required policy fields are validated and effective-dated; V2-D09; V2-IMP-011 / V2-D09 |
| FA-04 | Depreciation schedules | P0 | implemented locally — daily-prorated straight-line/declining schedules allocate exact basis; SQL pending | V2-IMP-011 unit/SQL fixture | Approved schedule exactly allocates depreciable basis over periods; V2-IMP-011 / V2-D09 |
| FA-05 | Ledger posting/no duplicate depreciation | P0 | implemented locally — asset-period lock/unique slot/shared posting and concurrency fixture; native run pending | V2-IMP-011 migration/concurrency fixture | One depreciation journal per asset/period; concurrent retry is idempotent; V2-IMP-011 / V2-D09 |
| FA-06 | Cost/accumulated depreciation/NBV | P0 | implemented locally — dated exact values in API/UI/fixtures | V2-IMP-011 task record | Register cost - accumulated depreciation = NBV by date and ties to GL; V2-IMP-011 / V2-D09 |
| FA-07 | Disposal/gain-loss | P0 | implemented locally — final daily proration and balanced clearing journal; SQL pending | V2-IMP-011 SQL fixture | Disposal derecognizes cost/accumulated depreciation and posts approved gain/loss; V2-IMP-011 / V2-D09 |
| FA-08 | Register-to-GL reconciliation | P0 | implemented locally — dated cost/accumulated designated-account variance report; SQL pending | V2-IMP-011 reconciliation fixture | Cost and accumulated depreciation register totals equal control GL accounts; V2-IMP-011 / V2-D09 |
| FA-09 | Acquisition/depreciation/disposal corrections | P0 | implemented locally — linked reversal/replacement chain and generic-bypass guard; SQL pending | V2-IMP-011 correction fixture | Approved corrections preserve originals and linked reversal/replacement journals; V2-IMP-011 / V2-D09 |

### Dimensions, tax/VAT, inventory

| ID | Meaning | Priority | Status and reason | Evidence; gap / smallest additional evidence | Measurable acceptance; task / decision |
|---|---|---:|---|---|---|
| DIM-01 | Complete cost-center/project dimensions | — | implemented locally — controlled model/posting/report UI; SQL/browser pending | V2-IMP-012 migration/UI/fixtures | Controlled dimensions, posting, reporting and reconciliation work end-to-end; V2-IMP-012 / V2-D10 |
| DIM-02 | Maintain controlled dimension values | — | implemented locally — authorized idempotent create/edit/archive; SQL pending | V2-IMP-012 SQL/UI fixtures | Authorized create/edit/archive preserves historical references; V2-IMP-012 / V2-D10 |
| DIM-03 | Associate applicable accounting amounts | — | implemented locally — typed tenant values, exact transaction/base allocations and posting guard; SQL pending | V2-IMP-012 migration/fixtures | Eligible line amounts reference active tenant dimension values and allocation totals equal line; V2-IMP-012 / V2-D10 |
| DIM-04 | Filter/group accounting reports | — | implemented locally — GL/TB/P&L/BS/CF scopes and value filter; SQL/browser pending | V2-IMP-012 report RPC/UI | GL/TB/approved statements filter/group by each dimension; V2-IMP-012 / V2-D10 |
| DIM-05 | Reconcile including unassigned | — | implemented locally — explicit zero-or-populated Unassigned and returned control differences; SQL pending | V2-IMP-012 report fixture | Assigned groups plus explicit Unassigned equal unfiltered ledger total; V2-IMP-012 / V2-D10 |
| DIM-06 | Allocation/history rules | — | implemented locally — multi-allocation, inactive rejection, immutable posted rows, untouched legacy JSON; SQL pending | V2-IMP-012 migration/fixtures | Approved multi-allocation and historical-change policy is auditable; V2-D10; V2-IMP-012 / V2-D10 |
| DIM-07 | No operational project management | — | implemented — financial values/policies/allocations/reports only | V2-IMP-012 diff and scope record | No scheduling/resources/tasks/billing module is introduced |
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
| VAL-04 | Test AR/AP lifecycle/reconciliation | — | partially implemented — focused accrual AR/AP SQL, unit, UI and concurrency fixtures exist; AP native SQL/concurrency/browser execution remains blocked in this worktree | V2-IMP-008/009 task records | Accrual, allocation, aging, correction and Control reconciliation tests pass; V2-IMP-008/009 |
| VAL-05 | Test periods/bank/assets/dimensions/tax/inventory | — | partially implemented — period/bank/asset/dimension fixtures exist; dimension unit passes while native SQL/browser execution and tax/inventory remain pending | V2-IMP-004/010/011/012 evidence; ABSENT-MODULES | Each approved module has accounting fixtures plus concurrency/error/UI coverage; V2-IMP-010-015 |
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
| implemented | 48 |
| partially implemented | 34 |
| missing | 55 |
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
| V2-D02 Opening and cutoff | OPEN-01–08 | **APPROVED by the product owner for V2-IMP-006, 2026-09-23.** Support Year Start and Midyear; exact DR=CR with no plug; Year Start Revenue/Expense must be zero and accumulated result is source-provided Retained Earnings; Midyear retains actual YTD Revenue/Expense; accepted batch is immutable/locked and unique per organization+mode+cut-off; explicit privileged approval with no default creator/approver separation; corrections use linked reversal/adjustment and never edit posted opening entries. | Implemented locally in V2-IMP-006; no longer blocking. Approval is product policy, not accountant acceptance of migrated balances. | Product-owner approval supplied in the V2-IMP-006 task brief |
| V2-D03 Journal numbers | JRN-02–03 | APPROVED in V2-IMP-015 task input: organization + fiscal-year sequence; assign only at final successful posting; `JRN-{FY}-{000001}`; gaps allowed, never reuse; retry/rollback cannot create a second posted journal; preserve legacy references. | Implementation still missing; separate controlled repair required before V2-IMP-015 acceptance | Linked approved decision; not accountant UAT |
| V2-D04 Statements and cash flow | COA-07, FS-01/03/04/07/08 | **APPROVED for implementation by the product owner in the V2-IMP-007 task brief, 2026-09-24.** (1) Mappings are versioned/effective-dated; old periods are not silently rewritten. (2) Applicable Posting/Control accounts map explicitly or remain visible Unclassified and incomplete. (3) BS retains current/non-current groups and Contra reduction without duplicate hierarchy totals. (4) Indirect CF starts at Net Profit, uses operating adjustments and separate Investing/Financing, and ties opening/movement/closing cash. (5) Operating/Investing/Financing are classified at account/entry/allocation level, with no dominant-counterpart heuristic. (6) Split/ambiguous journals require explicit auditable allocation and original line traceability. (7) Mapping/archive history and statement→account→movement→journal→back preserve report context. | Implemented locally in V2-IMP-007; no longer an implementation blocker. Actual organization mappings, layouts and UAT balances require accountant acceptance. | Product-owner policy approval; accountant acceptance still pending |
| V2-D05 Receivables | AR-01–09 | **Approved in the V2-IMP-008 control-plane task, 2026-09-25:** issue recognition; many-to-many fully allocated receipts; reject unallocated receipts/overpayments; immutable linked credits; privileged reasoned write-offs; append-only reversals. | Implemented locally; independent verification and accountant UAT pending. See [customer subledger record](../../customer-subledger.md). | Task decision approval supplied; not accountant acceptance |
| V2-D06 Payables | AP-01–09 | **Approved in the V2-IMP-009 control-plane task, 2026-09-25:** recognize approved expense/asset when the supplier bill is issued; allow many-to-many allocations; require fully allocated payments; reject overpayments; use linked immutable credits/corrections; reverse documents and allocations append-only. | Implemented locally; native SQL/concurrency/browser verification and accountant UAT pending. See [supplier subledger record](../../supplier-subledger.md). | Task decision approval supplied; not accountant acceptance |
| V2-D07 Periods/year end | CORE-05, JRN-08, PER-01–08 | **APPROVED by the product owner in the V2-IMP-004 orchestration stream, 2026-09-23.** (1) Fiscal year is configurable per organization. (2) Soft Closed blocks normal posting and permits only an authorized adjustment journal with a mandatory reason. (3) Hard Closed blocks every new posting until reopening. (4) Reopening is privileged, reasoned, immutable-audited, and Hard Closed must reopen to Soft Closed before Open. (5) Year-end posts a traceable Retained Earnings closing journal while historical P&L continues to show the actual operating result. | Implemented locally in V2-IMP-004; no longer blocking later implementation tasks | Product-owner policy approval recorded; finished implementation is not accountant UAT/acceptance |
| V2-D08 Bank matching | BANK-01–08 | Matching tolerances, one-to-many/many-to-one, transfer treatment, unmatch/correction, completion/reopening and outstanding-item rules. | V2-IMP-010; blocking | Accountant + product owner |
| V2-D09 Depreciation/assets | FA-01–09 | Methods, conventions/proration, capitalization date, residual/useful-life changes, impairment, disposal and correction policy. Useful-life metadata alone is not approval. | V2-IMP-011; blocking | Accountant + product owner |
| V2-D10 Dimensions | DIM-01–06 | Required/optional applicability, multi-allocation cardinality, inactive values, retroactive changes and explicit Unassigned reporting. | V2-IMP-012; blocking | Accountant + product owner |
| V2-D11 Tax/VAT | TAX-01–07 | Jurisdiction/business circumstances, current rates/rules, rounding, tax points, adjustments, document/report scope, and external compliance boundaries. Requires dated authoritative regulatory verification; no compliance claim is authorized. | V2-IMP-013; blocking | Accountant + product owner, with authoritative regulatory verification |
| V2-D12 Inventory accounting | INV-01–07 | Source-of-truth movements, control accounts, valuation/costing, negative stock, returns, backdating and correction/revaluation treatment. | V2-IMP-014; blocking | Accountant + product owner |
| V2-D13 Foreign-currency AR/AP | CORE-07, AR/AP if multi-currency obligations are approved | Whether obligations settle in different currencies and require realized/unrealized FX/revaluation. Current transaction currency support does not decide subledger policy. | V2-IMP-008/009 only if approved; approval-required addition | Accountant + product owner |

Compact blocking questions for approvers: D01, D02, D04 and D07 are approved for their local implementation tasks; D03 numbering remains open. Approve D05/D06 before AR/AP, D08/D09 before their P0 modules, and decide D10–D12 separately without downgrading P0 bank or fixed assets.

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
- Acceptance: AC-1–AC-16 PASS locally. No hosted database was accessed; no deployment or merge occurred. Implementation commit: `fa4216f50ee555dab29d00aff5fc683a49284f49`; cumulative Draft PR [#18](https://github.com/Building-Suit/building-suit-monorepo/pull/18).
- Remaining limit: COA-09 is contract-complete but cannot prove a real subledger-to-Control zero until V2-IMP-008/009 provide authoritative customer/supplier ledgers.
- Next dependency-order task: V2-IMP-006 — Opening-balance migration workflow.

### V2-IMP-006 — Opening-balance migration workflow

- Status: IMPLEMENTED LOCALLY / READY FOR REVIEW on 2026-09-23 under product-owner-approved V2-D02. It is not deployed, hosted-verified, production-verified, or accountant-accepted.
- Architecture: `opening_balance_batches` owns mode, cut-off, revision, lifecycle and journal/reversal links; `opening_balance_rows` preserves source order/code/name/original DR/CR independently from mapping. Draft revisions have no ledger effect. Validation and approval normalize the same rows; approval revalidates while holding the batch and organization period lock and calls the shared idempotent posting engine once.
- Policy: Year Start cut-off is the day before fiscal-year start and rejects non-zero Revenue/Expense. Midyear permits actual YTD P&L accounts. Both require exact minor-unit DR=CR, base-currency Posting accounts, and no Group/Control/archived/foreign mapping. No Opening Balance Equity or Retained Earnings line is derived; source data supplies every line.
- Cut-off/reporting convention: the opening journal date equals `cutoff_date`. Because the six-column TB defines Opening as posted entry dates `< report_from`, a report starting `cutoff_date + 1` shows the import only in Opening Debit/Credit and zero in period movement. Midyear P&L reports beginning at fiscal-year start still include the cut-off journal and preserve YTD result.
- Approval/concurrency/correction: `opening_balances.approve` is explicit and may be held by the creator. Idempotency key `opening-batch:<uuid>`, a partial unique accepted-boundary index and serialized server locks prevent duplicate effects. Posted rows/header are protected by RLS, RPC state checks and immutable triggers. `reverse_opening_balance_batch` requires privilege/reason and posts a linked normal-period-enforced reversal; originals never unlock.
- Legacy handling: the existing five-argument `post_opening_balance` signature remains for compatibility but now raises `OPENING_BATCH_REQUIRED`; historical journals are untouched. Normal V2 users cannot reach the old silent Opening Balance Equity plug.
- Migration/preservation: forward migration `20260923203000_opening_balance_migrations.sql` replayed cleanly on disposable local Supabase. The observed pre/post pre-existing snapshot stayed 11 accounts, 5 transactions/5 posted, 10 entries, Debit 5,000 minor and Credit 5,000 minor. No historical opening, account mapping or period row was converted. That snapshot did not retain separate TB/P&L output; deterministic post-migration fixtures prove TB/P&L behavior without claiming a missing pre-migration report capture.
- Verification: opening SQL 27/27; two-session approval 5/5; retained posting idempotency 37/37, six-column TB 33/33, periods 34/34 and Control 44/44; unit 25/25; focused Chromium 2/2 in English/LTR and Arabic/RTL; typecheck, lint, production build and `git diff --check` passed. Year Start fixture posted 15,000.00 DR/CR and day-after TB Opening 15,000.00 DR/CR with zero period movement. Midyear fixture imported Revenue 10,000.00 and Expense 6,000.00 and reported actual net profit 4,000.00.
- Acceptance: AC-1 through AC-19 PASS locally. No hosted DB mutation, deployment, merge or accountant acceptance occurred. Implementation commit `69f34860b2d19e2be3329ca3ec58e38d3c5ea35d`; cumulative Draft PR [#18](https://github.com/Building-Suit/building-suit-monorepo/pull/18).
- Remaining limitations/decision: no new unresolved opening-policy decision. CSV only; foreign-currency opening/revaluation remains deliberately unsupported rather than inferred; real Control-account opening remains blocked until authoritative AR/AP providers exist.
- Subsequent task V2-IMP-007 began after the product owner approved V2-D04; its evidence is recorded below.

### V2-IMP-007 — Financial statements, mappings and traceability

- Status: IMPLEMENTED LOCALLY / READY FOR REVIEW on 2026-09-24. V2-D04 is product-owner-approved implementation policy, not accountant acceptance of organization mappings, statement layouts or final balances. Commit `689b497` contains the implementation; it is not deployed or hosted-verified.
- Mapping model: forward migration `20260924070000_financial_statement_mappings.sql` adds append-only, effective-dated P&L/Cash Flow account mappings with revision/predecessor and idempotent request controls, while reusing the existing dated BS classification history. Posting and Control accounts are eligible; Group accounts are structural. Privileged, reasoned backdating and archived-history reads preserve intentional historical presentation decisions. An unmapped amount stays visible as Unclassified and mapping completeness fails.
- Statements: P&L groups posted entries by mapping effective on each entry date, excluding only explicit year-end close; it exposes operating revenue, cost of sales, operating expenses, other income/expense, Gross Profit, Operating Result and Net Profit. BS retains current/non-current/Equity classes, actual Contra signs and unclosed profit without balancing plugs. Six-column TB includes Control leaves. Per-account and aggregate reconciliation expose financial differences separately from mapping completeness.
- Indirect Cash Flow: posted cash/cash-equivalent ledger movement defines opening, actual change and closing cash. Net Profit plus explicitly mapped noncash/working-capital operating adjustments leads to CFO; explicit source-entry account defaults or auditable allocations produce Operating, Investing and Financing flows. The authoritative cash report no longer selects a dominant counterpart or defaults to Operating. Internal cash transfers have zero consolidated effect. Unresolved source amounts remain Unclassified; partial allocations cannot hide them.
- UI/history/export: Accounts mapping dialog exposes dimensions, date, reason and revision history for Posting/Control accounts. Reports show mapped/unclassified rows, diagnostics, source cash entries and allocation control. Statement account rows open existing activity/journal views; route-backed report tab/dates survive dialog back and close. Archived accounts remain in historical reports. P&L, BS and CF exports reuse the report RPCs. Historical descriptive names after permitted renaming are not independently versioned and require further acceptance review.
- Migration preservation: on disposable local data before/after schema installation, account count 2, posted journals 1, entries 2, debit 5,000 minor, credit 5,000 minor; six-column TB and classified BS rows/amounts were identical. No historical journal, opening, account balance or period state was rewritten. Clean cumulative migration replay passed after the final function correction.
- Focused verification: new SQL 26/26; retained BS classification 48/48, six-column TB 33/33, year-end 34/34, Midyear opening 27/27, export 12/12; localized CSV unit 6/6; focused Chromium 2/2 in EN/LTR and AR/RTL (mapped statements, indirect CF, Unclassified, mapping history, journal back, narrow viewport). Ledger typecheck, changed-file lint, production build needed by Playwright, and `git diff --check` passed. Earlier BS fixture-count failures were caused by running the pristine-seed suite after browser writes; a fresh reset and correct test order passed all 48 assertions.
- Deterministic financial evidence (minor units): Net Profit 450, depreciation adjustment +50, CFO +500, CFI -300, CFF +200, reported and actual cash change +400. A split -150 journal allocates -100 Investing and -50 Operating; internal transfer contributes zero. Historical year-end P&L and Midyear imported result 4,000 remain correct in retained regressions. Mapping A/B history and archived-revenue retrieval pass. Actual organization mapping/UAT review, hosted migration and deployment remain pending.
- Next blocking decision: V2-D05 receivables policy must be approved before V2-IMP-008.

### V2-IMP-008 — Accrual customer subledger

- Local implementation evidence (2026-09-25): [customer subledger contract and task record](../../customer-subledger.md). 56 embedded PostgreSQL assertions and migration-preservation checks pass. Docker concurrency and EN/AR browser execution are blocked by sandbox access; no deployment or accountant acceptance is claimed. The control-plane task approves V2-D05 and supersedes earlier pending-decision references for this task.

- Scope/result: customer invoices/accounting obligations, open items, receipt allocation, credits/overpayments/corrections, statements, aging and AR Control reconciliation.
- Dependencies/gates: 003–005, V2-D01 and D05; D13 only if multi-currency subledger is approved.
- Retain/extend: counterparties and commitment concepts where compatible; do not reuse settlement behavior that records income at receipt after invoice recognition.
- Paths/objects: discovered DB-ARAP/UI-ARAP/T-ARAP; proposed customer documents/open items/allocations/reconciliation APIs and pages.
- Migration/risk: existing commitments need explicit classify/link/leave-legacy decision, never automatic conversion. Risk is duplicate revenue and altered outstanding history.
- Acceptance/tests: invoice Dr AR/Cr revenue once; partial/full receipt Dr cash/Cr AR only; allocations reversible under policy; aging/statement roll forward; subledger=Control by date; isolation/permission/idempotency/concurrency.
- Rehearsal/recovery/review: dry-run legacy mapping and variance; feature-gated cutover; forward corrections/reversals. Accountant signs invoice/receipt/credit/aging fixtures.

### V2-IMP-009 — Accrual supplier subledger

- Local implementation evidence (2026-09-25): [supplier subledger contract and task record](../../supplier-subledger.md). Exact-money unit, changed-file lint, full Ledger typecheck, locale parsing and diff check pass. Native SQL/concurrency is blocked by Docker access; embedded PostgreSQL installation is blocked by restricted package access; browser startup is blocked by local socket restrictions. No deployment or accountant acceptance is claimed. The control-plane task approves V2-D06 and supersedes the earlier pending-decision entry.
- Scope/result: supplier bills/open items, payment allocation, credits/overpayments/corrections, statements, aging and AP Control reconciliation.
- Dependencies/gates: 003–005, V2-D01 and D06; D13 only if multi-currency is approved.
- Retain/extend: counterparties/commitments where compatible; payment must not record expense/asset again.
- Paths/objects: `ap_documents`, `ap_allocations`, AP RPCs and dual Control provider; `/payables`, product adapter/types, EN/AR copy; focused SQL/unit/browser/concurrency fixtures.
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

- Local implementation evidence (2026-09-25): [fixed-asset contract and task record](../../fixed-assets.md). Explicit register/acquisition mapping, exact schedule math, serialized posting, NBV, impairment, disposal/gain-loss, GL reconciliation, linked corrections, bilingual UI, and focused SQL/unit/browser/concurrency fixtures are implemented. Full unit, lint, typecheck, build, workspace-boundary, locale JSON and diff checks pass. Native SQL/concurrency is blocked by Docker access and browser execution by local socket restrictions; no deployment or accountant acceptance is claimed.
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
- Retain/extend: generic entry dimensions remain untouched and are counted/reported as Unassigned; controlled rows are additive.
- Paths/objects: `20260925190000_accounting_dimensions.sql`, `44_accounting_dimensions_test.sql`, `/accounting-dimensions`, manual-journal allocation controls and focused unit/browser fixtures.
- Migration/risk: no JSON backfill or inference; inactive values reject new use; posted allocations reject mutation. Recovery is forward-only without deleting financial history.
- Acceptance/tests: fixtures cover exact/over allocation, inactive/history, idempotency, required contexts, grouped+Unassigned GL/TB/statements, tenant/permission and EN/AR RTL UI; native SQL/browser execution remains pending sandbox access.
- Rehearsal/recovery/review: legacy count is the mapping dry run; grouped control differences provide parallel totals. No accountant UAT or deployment evidence exists.

### V2-IMP-013 — Approved tax/VAT accounting

- Status: IMPLEMENTED LOCALLY / VERIFICATION PARTIAL on 2026-09-26; unit/lint/type/build/boundary checks pass, while native SQL and browser execution are sandbox-blocked; not deployed, hosted-verified, filed, or accountant-UAT accepted.
- Scope/result: Egypt-only, explicitly registered, EGP standard domestic 14% output/eligible-input VAT through one common-engine posting; all excluded circumstances remain rejected and product wording makes no broad compliance claim.
- Dependencies/gates: 003–005, relevant document modules, V2-D11 and dated authoritative regulatory evidence.
- Retain/extend: tax identifiers/account subtypes and posting engine only where the approved policy confirms them.
- Paths/objects: `20260926100000_approved_egypt_vat.sql`, `45_approved_egypt_vat_test.sql`, `/tax-vat`, focused unit/browser fixtures and [bounded contract/evidence record](../../tax-vat-accounting.md).
- Migration/risk: additive append-only configuration/documents with effective dates and copied posting snapshots; no legacy inference or recalculation. Designated VAT-control accounts reject generic postings.
- Acceptance/tests: fixtures cover 14% exact/large-value rounding, tax/document dates, one-time posting/idempotency, source=control GL, linked credits/reversals, immutable history, periods, permissions, isolation and EN/AR scoped wording.
- Rehearsal/recovery/review: official ETA evidence is dated and linked; pre-existing history is untouched; recovery is a forward-effective profile/rule plus linked adjustment, never mutation. Accountant UAT remains separate.

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

- Completed cumulative stream: baseline assessment at e51435c52f8c3d36b4dccd86c1adb731dd2cb2a5; V2-IMP-001 at 7bfb37ee7326a4b8ae387dd6783b5f72cfd7a941; V2-IMP-002 at d4a5354790e63e2db7516d1c93d36a092af6e14c; V2-IMP-003 at ed9a81f6916e3d0f2f7a85be4e2e62bd0e413aa8; V2-IMP-004 at ccb4c96125dc90e8487682dbcf1370cc9ce1bc8c; V2-IMP-005 at fa4216f50ee555dab29d00aff5fc683a49284f49; V2-IMP-006 at 69f34860b2d19e2be3329ca3ec58e38d3c5ea35d; V2-IMP-007 implementation at 689b497.
- V2-IMP-006 evidence: clean forward migration `20260923203000`; opening/concurrency SQL 32/32 plus retained focused SQL 148/148; unit 25/25; focused local Chromium 2/2 in English/LTR and Arabic/RTL; Ledger typecheck, lint and production build passed; generated database types updated. The pre-existing 11-account/5-posted-journal/10-entry/debit=credit=5,000-minor snapshot was unchanged across migration.
- V2-IMP-007 evidence: one forward migration replayed cleanly; new SQL 26/26, retained focused SQL 154/154, localized CSV unit 6/6, focused Chromium 2/2, Ledger typecheck, changed-file lint, required production build and diff check passed. Pre/post disposable snapshot: 2 accounts, 1 posted journal, 2 entries, debit=credit=5,000 minor, unchanged TB/BS output.
- Preservation: the cumulative stream retains the shared posted-ledger engine, double-entry enforcement, immutable correction history, organization authorization, currency/base-minor-unit rules, audit/quota behavior and existing report/export facilities. Statements do not create a second balance store. Opening migration cannot populate Control accounts without a real provider.
- Unresolved risks/limits: hosted migration/app compatibility remains unverified; accountant/UAT acceptance of actual mappings/layouts/balances is not started; historical descriptive names after permitted renaming remain unproven; foreign-currency opening is unsupported; real production AR/AP subledger providers remain absent; broad suites remain unrun under the task-specific targeted verification policy.
- Git/PR: cumulative draft PR [#18](https://github.com/Building-Suit/building-suit-monorepo/pull/18), base `stg`, head `codex/ledger-suit/v2-baseline`. Its presence is review coordination only, not deployment or acceptance.
- Exact next blocker: V2-D05 receivables policy approval for V2-IMP-008.

This checkpoint is implementation and local-test evidence only. It must not be interpreted as deployment, hosted verification, accountant acceptance, or production readiness.
