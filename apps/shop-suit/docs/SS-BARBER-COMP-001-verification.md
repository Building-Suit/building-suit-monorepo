# SS-BARBER-COMP-001 verification and handoff

Base: current fetched `origin/stg` at `70bbe9d79f66f74d7e931b3083f65846c76d2d85`.
Isolated worktree: `/workspace/ss-barber-comp-001`.
Branch: `codex/shop-suit/ss-barber-comp-001`.

## Implemented

Opt-in shop/employee policy versions, category percentage/fixed unit rates and
employee override precedence; optional explicit draft attribution; immutable
sale-time net/currency/employee/rate snapshots; full-payment and explicit service
fulfillment gating; estimated versus earned history; serialized exactly-once
recognition; append-only cumulative returns and signed corrections; separate
post-export adjustments. No payout/clawback, backfill or partial-return operation.

Manager policy/history/attribution route is `/commissions` (optional `?sale=UUID`).
Presentation and controlled forms belong to `packages/ui`; dialog dirty protection,
pending exclusion and focus use existing `packages/ux` controllers. Shop supplies
contracts, translated copy, authorized RPC adapters and formatted money.

## Migration and contracts

Forward migration: `20261014181109_optional_staff_commissions.sql`.
Four new RLS tables and five authenticated RPCs are listed in
[commission-policy.md](commission-policy.md). It also adds tenant/invoice line
uniqueness constraints to support composite FKs. Existing financial/inventory
rows, migrations and public payment/refund signatures remain unchanged.
Generated public database types are refreshed from the full migration chain;
this also captures pre-existing staging offline RPCs absent from the prior artifact.

## Actual automated evidence

- `pnpm check`: passed (canonical tokens, strict boundaries, 80 routes, no debt).
- Workspace `pnpm typecheck`: passed, all six apps, after documentation generation.
- Shop `nuxt typecheck`: passed again with the final policy dialog, pagination and generated contracts.
- Shop lint: passed with two existing attribute-order warnings in owner invitation.
- ESLint on new shared UI/types and commission runners: passed.
- Fresh replay of the entire Shop migration chain in disposable PostgreSQL 17:
  passed. Auth/Storage/Cron/network provider infrastructure was stubbed for this
  local replay; the financial, stock, appointment and commission SQL was unchanged.
- `SHOP_COMMISSION_TEST_CONTAINER=shop_commission_disposable
  SHOP_COMMISSION_TEST_DATABASE=shop_commission_test_final
  node tooling/database/test-shop-commissions-local.mjs`: passed, synthetic suite
  rolled back. Missing config, staff opt-out, discounted net basis, employee
  precedence, full payment without completion, partial then full payment, rate
  changes, duplicate replay, percentage/fixed return rounding, immutable history,
  delegated non-manager denial and cross-tenant employee IDs are covered.
- Matching two-session concurrency runner: passed, concurrent duplicate receipt
  returned the same receipt and created exactly one 1.00 earning. Synthetic
  append-only fixtures remain in the disposable local database for inspection.
- Broad `pnpm test`: 1,452 passed, 23 skipped; three failures were missing Chromium (two) and a type-file read racing generation (one). All three passed in the focused 13-test rerun after Chromium installation and generation completion.
- Focused previously failing tests: 13/13 passed.
- `node tooling/git/check-pr.mjs 313`: passed; PR root into `stg` verified.
- Full Supabase stack locally: not run successfully; its PostgreSQL image
  extraction exceeded disk capacity. The dedicated GitHub-hosted disposable job
  runs these tests against actual Supabase infrastructure, without stubs.

## Genuine contract limitations

No tax or order-discount fields exist in current Shop sale issuance. The finalized
`invoice_items.total_amount` is after line discounts and excludes tax. A native
discounted-and-taxed checkout regression cannot honestly be claimed; tax work
must preserve the documented net-line contract.
Unscheduled services have no completion event. They are deliberately not earned
from payment. Scheduled service commission requires one linked appointment per
single-unit service line; this feature does not create a fictional completion or
allocate one appointment's employee across unrelated lines.
Existing fast pay without explicit attribution remains unaffected and earns zero.

No hosted DB writes, runtime/secrets configuration changes, promotion, materials,
ETA, website work, manual testing, payroll or external payment execution occurred.
Parent coordinates staging integration and merges; this task does not merge.

PR: https://github.com/Building-Suit/building-suit-monorepo/pull/313
Initial implementation head: `b269b4f140da169df855332431ab37c0c8380ba1`.
Required GitHub CI is tracked on the PR; local checks do not substitute for it.
