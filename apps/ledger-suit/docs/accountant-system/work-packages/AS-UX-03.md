# AS-UX-03 — usable tags, persistent help and readable account hierarchy

2026-09-23 — READY_FOR_REVIEW. Founder request: explain what Tags are for and make them usable, keep “How it works” as a floating part of the application layout, and make the chart of accounts comfortable to read.

Base: `stg` at `6e96c0c`; branch `codex/ledger-suit/usability`. Preserve merged transaction workspace, account activity, localized CSV and refund-time work. This is a bounded application package with no database migration, hosted write, merge or deployment.

Delivered:

- Tags now explain their accounting boundary and give a create → assign → find workflow with a branch/project example in Arabic and English.
- A transaction can receive or lose a tag in its details. Transactions show assigned tags and support a URL-backed Tag filter that survives reloads and combines with existing filters.
- Tag and assignment reads use environment, user, tenant and record scoped keys, handle errors, ignore stale scopes, respect capabilities and billing write restrictions, and protect pending/dirty dialogs.
- The financial-system help control is mounted once in the authenticated layout, floats above desktop and mobile navigation, remains the same DOM element during route changes, and preserves dialog focus behavior.
- The account hierarchy distinguishes account types, fixed sections and posting accounts with stronger headings, branch guides, readable codes and balances, explicit account counts, compact secondary actions and mobile overflow protection.

Verification: 49 root unit tests; Ledger lint, typecheck and production build; 3 focused browser cases for real tag create/assign/filter/reload/remove, persistent help, mobile layout, English/Arabic/RTL; 5 AS-UX-01 browser regressions; and the existing financial-system-map browser case. The local Ledger database on 60321 was behind the repository and returned a missing `account_role` column; the three already committed pending migrations were applied locally, after which all 9 browser cases passed. No hosted database was touched and this package contains no SQL change.

[Evidence and screenshots](../../evidence/as-ux-03/README.md). Accountant UAT and release acceptance remain separate. Stop for review after publishing the branch and PR.
