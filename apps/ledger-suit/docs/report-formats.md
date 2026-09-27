# LS-REPORT-001 — Excel and print/PDF report formats

Status: **IMPLEMENTED_LOCALLY / BROWSER_AND_TYPE_VERIFICATION_PENDING**, 2026-09-27.

This delta adds optional `.xlsx` and browser print/PDF output to the existing Trial Balance, Profit & Loss, classified Balance Sheet, indirect Cash Flow, and General Ledger exports. It does not add a report query, calculation, mapping rule, migration, or server write. Every format requests the existing tenant-authorized CSV RPC with the same organization, dates, report kind, locale, and selected ledger account, then passes the already-localized CSV contract to a client-only formatter. A scope snapshot discards a response if the organization, dates, account, report, or locale changes while the request is running.

The generated workbook and printable document include the legal/display organization name, base currency, selected period or as-of date, selected ledger account where applicable, the posted-entry filter, generation time, and the existing incomplete-mapping warning for Profit & Loss, Balance Sheet, or Cash Flow. Arabic workbooks use right-to-left sheet presentation and printable output uses an RTL document; English remains LTR. Monetary CSV strings are written directly to numeric workbook cells without JavaScript `Number` conversion and remain exact text in print output.

## Requirement traceability

| Requirement | Current evidence | State for this task |
|---|---|---|
| CORE-07 | Existing report RPCs, CSV localization, export permission, audit/report behavior, currencies, and filenames remain the source contract. CSV remains available unchanged. | Preserved by the delta; full cumulative regression and native browser execution remain pending. |
| FS-04 | Excel and print/PDF consume the reconciled statement CSV datasets. Existing unclassified/mapping diagnostics are copied into the new format metadata instead of recalculating values. | Preserved; no statement arithmetic was added. |
| FS-06 | The request scope contains the same route-backed dates/as-of date and General Ledger account filter; stale responses are discarded after organization/filter/locale changes. | Implemented locally; native navigation/browser rerun pending. |
| TB-07 | Screen and all three exports retain the existing `report_trial_balance`/`export_financial_report_csv` organization/from/to contract. The localized six-column CSV is the direct workbook/print input. | Focused unit evidence passed; native display/export browser comparison pending. |

## Verification

- PASS — `node --test apps/ledger-suit/tests/unit/report-formats.test.mjs apps/ledger-suit/tests/unit/localized-csv.test.mjs`: both test files passed; no failures or skips.
- PASS — `pnpm --filter @building-suit/ledger-suit test:unit`: all 20 Ledger unit test files passed; no failures or skips.
- PASS — the focused format test creates a 20,000-row Trial Balance workbook, verifies a multi-megabyte workbook result, and completed with the whole test file in about 0.6 seconds on this runner.
- PASS — workbook inspection covers a valid OOXML/ZIP file set, Arabic RTL, organization/currency/dates/filters/warning metadata, formula-safe text, and exact `9007199254740993.25` numeric XML without `Number` coercion. Print inspection covers RTL, escaped bilingual text, metadata, warning, exact value text, and landscape print CSS.
- PASS — `pnpm check`: canonical token outputs, workspace boundaries, and 80 historical migrations are unchanged.
- PASS — locale JSON parsing and `git diff --check`.
- BLOCKED BEFORE INSTALLATION — `pnpm install --offline --frozen-lockfile`; pnpm could not update its global project registry outside the writable worktree (`EROFS`). `pnpm --filter @building-suit/ledger-suit lint` then failed before linting because `eslint` is absent, and `pnpm --filter @building-suit/ledger-suit typecheck` failed before checking because `nuxt` is absent. Build and Playwright were not runnable for the same missing dependency tree.
- UNVERIFIED — live GitHub/fetch state; `pnpm agent:preflight` failed before reporting worktree/PR state.

No database, migration, remote provider, merge, push, deployment, commit, or accountant UAT occurred.
