# AS-UX-01 — Transactions workspace and readable account tree

2026-09-19 — READY_FOR_REVIEW. Bounded implementation of the founder’s explicit request under AS-E02: consolidate transaction navigation and expose the accounting hierarchy. This package changes the running application.

## Base and ownership

`codex/ledger-suit/workspace-ux` started from PR #12 at `e99e272d788d0a98752a880e34b6f0cc85155532`. After the founder merged #12, it fast-forwarded to `stg` at `b3c83815ee770bc1163e8d7263f53903a46b0902` with the same source tree. Preflight confirmed #12 merged, #9/#10 closed, and the staging PR slot free. Unrelated Shop worktrees and imported Ledger work are preserved.

## Delivered behavior

- One Transactions menu item replaces nine transaction-type entries. Search, type/status/date/account filters, optional category/amount filters, sorting and database pagination share one workspace. URL state survives reload and detail dismissal. Type-filtered New transaction uses existing authorized posting flows; CSV import stays accessible. Former transaction-type bookmarks redirect with their filters/create action.
- Accounts opens an expanded tree with visible headings including الأصول المتداولة and الأصول الثابتة, even when empty. It preserves actual parent links, ancestor context during search, exact BigInt subtree totals including contra and historical parent postings, account statements, edit/archive/classification and group subaccount creation. The existing sortable Table view remains available.
- English/Arabic, RTL, light/dark, mobile, keyboard, loading/empty/error/retry and permission states are covered. Tenant changes clear filters and cancel/stale-guard reads.
- Actual journal posting exposed an existing cache-clearing defect: mounted account filters lost their options after a successful save. Save now refreshes organization reads while preserving options/selection. The help control moved below page content after browser verification showed it obstructed pagination.

## Boundaries

Ledger-only components, pages, orchestration, helper, locales and tests. No shared contract, SQL, migration or financial policy changes. Navigation headings group existing subtypes; they do not backfill or schedule dated financial-statement classifications. No loan maturity is inferred. Existing server authorization, posting invariants and quotas remain authoritative.

## Verification and handoff

PASS: 44 unit tests; 41 distinct browser scenarios across recorded runs (38 passed in the final combined run, one dialog-close timing assertion corrected and passed three repeat runs, plus two read-only subscription scenarios); workspace check, Ledger lint/typecheck/build and the local preview capture. Complete commands, run outcomes and source hashes are recorded in [the evidence](../../evidence/as-ux-01/README.md). SQL was not rerun because this package changes no database objects; earlier SQL counts belong to their original packages. Local preview uses the existing disposable `ledger-account-activity-20260919` backend (API 65321, database 65322), verified by container labels. It was not reset. No hosted writes, merge or deployment is authorized/performed for this package. There are no approval blockers to this implementation; accountant UAT and release acceptance are not claimed.

Review locally at `http://127.0.0.1:3260/transactions` and `/accounts` using disposable fixture `owner@beta.test` / `ledgersuit`. The seed workspace contains four demo accounts and five posted entries. English account names are stored demo data, not untranslated interface labels.
