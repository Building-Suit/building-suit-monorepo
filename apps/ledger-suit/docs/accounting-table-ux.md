# LS-UX-002 — accounting table refinement

Status: **IMPLEMENTED_LOCALLY / BROWSER_VERIFICATION_PENDING**, 2026-09-27.

This delta keeps the existing PrimeVue 4.5.5 `BsDataTable`, journal query adapter, lazy pagination, report RPCs, CSV RPCs, record dialogs, and exact minor-unit formatting. It adds opt-in compact/comfortable density, sticky headers/identity cells/report totals, keyboard-labelled scroll regions, and a local presentation preference scoped by environment, authenticated user, organization, and table. No financial value is converted through `Number`, and no virtual scrolling, bulk editor, query framework, migration, or hosted operation was added.

## Requirement traceability

| Requirement | Current evidence | State for this task |
|---|---|---|
| FS-06 | Report dates remain route-backed; Trial Balance and statement drill-down still open the existing account activity dialog with the selected date context and preserve the report route. | Preserved; focused native browser rerun pending. |
| JRN-04 | Existing server search, account/source/status/date filters, sort controls, validation, retry, and 25-row lazy pagination are unchanged. | Preserved; focused native browser rerun pending. |
| JRN-05 | Existing private database saved views remain scoped by organization and creator. The new density preference uses a separate environment/user/organization/table local key and resets on scope change. | Implemented locally; cross-user/tenant browser rerun pending. |
| TB-01 | The same six monetary fields remain visible with unambiguous debit/credit headers and exact `MoneyText` formatting; account identity, headers, and full-population footer totals stay visible while scrolling. | Implemented locally; focused native browser rerun pending. |
| TB-07 | Display still reads `report_trial_balance`; CSV still uses the server export with the same organization/from/to inputs. UI totals still reduce the complete report response with `BigInt`, not a visible page. | Preserved; display/export browser comparison pending. |
| VAL-03 | Focused unit coverage checks preference isolation and preservation of the existing table/full-total contracts. Existing Journal Center, Trial Balance, and AR browser specs now cover density/readability/mobile behavior. | Partial: native browser execution remains pending; broader V2 numbering and accountant acceptance remain blocked independently. |

## Verification

- PASS — `pnpm --filter @building-suit/ledger-suit test:unit`: 16 files, zero failures/skips.
- PASS — `pnpm check`: canonical token outputs, workspace boundaries, and 80 historical migrations unchanged.
- PASS — locale JSON parsing and `git diff --check`.
- BLOCKED BEFORE COLLECTION — focused Playwright scenarios. The workspace dependency is absent; the available `playwright` executable reports `unknown command 'test'`.
- BLOCKED BEFORE EXECUTION — Ledger lint (`eslint` missing) and typecheck (`nuxt` missing).
- UNVERIFIED — live GitHub/fetch state; `pnpm agent:preflight` failed before reporting state.

No database, remote provider, merge, push, deployment, commit, or accountant UAT occurred.
