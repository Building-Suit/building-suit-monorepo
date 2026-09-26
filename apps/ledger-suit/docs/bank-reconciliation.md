# Bank reconciliation — V2-IMP-010

Status: implemented locally; native Supabase/browser execution and accountant acceptance remain pending. No deployment or hosted migration has occurred.

The task brief approved V2-D08 on 2026-09-25: match one-to-one, one-to-many and many-to-one only when signed totals are exactly equal in the same currency; never apply automatic tolerance or repost an existing journal; use explicit accounting adjustments for differences; retain internal transfers as transfer-linked journals; allow correction/unmatch before completion; require privileged reasoned reopening after completion; and list outstanding items explicitly.

## Contract

- `import_bank_statement` validates the bank posting account, currency, date range, file SHA-256 and row structure. It creates statement evidence only—never a journal. Exact file fingerprints are unique per organization. Canonical bank/date/signed-amount/reference/description identity detects repeated lines across files; invalid and duplicate rows remain visible as unresolved and block completion.
- `match_bank_items` serializes the bank-account match boundary, binds the retry key to sorted selections, compares signed statement totals with the selected posted transaction effects on that bank account, and writes only match links/state/events. No amount tolerance exists. A before/after fixture fingerprints journal count and balanced entry totals.
- `correct_bank_statement_line` requires a reason, retains before/after event and audit evidence, rechecks duplicate identity and statement totals, and rejects matched or completed lines. `unmatch_bank_items` records a reason and retains the inactive original match.
- `create_bank_adjustment` requires bank and shared transaction privileges, rejects approval-required organizations, uses integer minor units and the shared `app.create_and_post` boundary, then links the one balanced journal through an exact match. Payload-bound retry creates exactly one journal and one immutable adjustment record. Shared accounting-period enforcement blocks Hard Closed dates.
- Outstanding items are actual posted bank-account transactions not yet represented on the statement. Their signed bank effects remain individually listed. Completion requires every statement line matched, no import errors, and **statement closing + outstanding bank effects = posted ledger balance through statement end**.
- Completion snapshots ledger/outstanding totals and locks match, correction and outstanding changes. `bank.reopen` defaults only to owner/admin, requires a reason, and appends reopening/audit evidence before edits resume. Statement, match link, transaction/adjustment, outstanding and session-event history remains navigable.

The `/bank-reconciliation` workspace uses the shared app shell, `BsDataTable`, dialog/record-action policy and tenant capability state. It provides CSV import/template, visible matched/unmatched/unresolved lines, exact multi-selection totals, candidate journals, correction, explicit adjustment, outstanding-item detail, match history, equation, completion/reopening and audit history in EN/LTR and AR/RTL. Tenant/user changes clear selections, dialogs and response state; stale requests cannot populate another tenant.

## Files and verification

- Forward migration: `supabase/migrations/20260925160000_bank_reconciliation.sql`.
- SQL fixture: `supabase/tests/42_bank_reconciliation_test.sql`.
- UI/adapter: `app/pages/bank-reconciliation.vue`, `app/composables/useBankReconciliation.ts`, `app/utils/bankReconciliation.ts`, `types/bank-rpc.types.ts`, navigation and EN/AR copy.
- Focused UI fixture: `tests/e2e/bank-reconciliation.spec.ts`; parser/bigint coverage: `tests/unit/bank-reconciliation.test.mjs`.

Checks run on 2026-09-25:

- `pnpm agent:preflight` — failed because fetch/GitHub state was unavailable; no publication action was taken.
- Full forward migration replay in embedded PostgreSQL with provider shims — passed. The new migration preserved the pre-existing journal, two entries, balanced 12,345/12,345 totals, Control balance and legacy evidence byte-for-byte.
- Focused bank SQL fixture through embedded PostgreSQL assertion adapters — passed. It covers import/no journal, file and line duplicates, 1:1/1:many/many:1 exact matching, before/after journal fingerprint, unmatch/rematch, explicit outstanding equation, completion lock, privileged reasoned reopening, adjustment idempotency/balance, Hard Closed denial, viewer denial and traceable events. This does not replace native pgTAP, PostgREST or concurrency execution.
- `node --test apps/ledger-suit/tests/unit/bank-reconciliation.test.mjs` — passed.
- Focused Ledger ESLint and `nuxt typecheck` — passed.
- Ledger production build — passed.
- Focused Playwright EN/AR command — blocked before tests because the sandbox denied binding `127.0.0.1:3210` (`EPERM`).
- Native Supabase status/pgTAP — blocked because the sandbox denied Docker socket access.

No commit, push, merge, deployment or hosted database operation was performed. Recovery must remain forward-only: reopen with evidence, unmatch/correct, or post an explicit linked correction; never delete completed accounting history.
