# Ledger source integration — 2026-09-19

Imported the latest unmerged Ledger work into the monorepo for review against `stg`:

| Source | Revision |
|---|---|
| Previously imported `dev` baseline | `6fb152ee72e2b6b22269230917b2f9237fc2612d` |
| [Accounts table, upstream PR 96](https://github.com/Building-Suit/ledger-suit/pull/96) | `ab576890e06404b5a10d7a97a94b85bf82fdb121` |
| [Accountant-system plan, upstream PR 97](https://github.com/Building-Suit/ledger-suit/pull/97) | `cb0138716e2a7825032bbc8b4dca06110aa8cab8` |

GitHub branch tips matched the existing clean local source worktrees. The upstream `dev` branch itself had not advanced beyond the imported baseline. Original branches/repositories were not merged, edited or pushed by this integration.

The Accounts page now supports case-insensitive name/code search, keyboard sorting, pagination, visible-result counts, retry/error states and revealing a saved account hidden by filters. Chart queries fetch all API pages with stable ordering and cancellation, keeping totals independent of the search and rejecting stale tenant results. Existing account-create/edit/archive rules remain in their product adapters.

Integration resolves the standalone table change through `BsDataTable` and preserves `BsDialog`/shared dirty-state behavior. Supabase paths, public-schema ownership, isolated sessions and workspace dependency versions remain the monorepo contracts. This adds no SQL migration.

The accountant-system documents, Arabic Word deliverable and original UI evidence are imported. The newer plan supersedes old launch/accounting-v2 roadmaps. On 2026-09-19 the founder authorized bounded implementation packages under this plan; see the [current implementation record](../../apps/ledger-suit/docs/accountant-system/IMPLEMENTATION_AR.md). This is not proof of accountant approval or authorization to implement every phase in one PR. The upstream commit IDs in historical documents refer to the original Ledger repository; source screenshots describe that source revision.

## Verification

- `pnpm check`: workspace/token boundaries pass; all 80 historical migration hashes unchanged.
- Ledger production build, typecheck and lint pass.
- `pnpm --filter @building-suit/ledger-suit exec playwright test tests/e2e/accounts-table.spec.ts tests/e2e/core-finance.spec.ts`: 18 tests pass against the disposable monorepo Ledger backend.
- Scenarios include 1,003-row API pagination and transaction selectors, failed later-page retry, viewer restrictions, real local create/edit/archive refresh, delayed responses during tenant switching, and both languages/themes on a narrow viewport.
- Original source worktrees remain clean. No hosted database, email provider or application deployment was changed.

Continue product work in `apps/ledger-suit`; shared presentation/behavior changes belong in the existing shared packages. Future agent rules and workflows remain authoritative for navigation and task scope.
