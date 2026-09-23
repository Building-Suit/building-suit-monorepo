# AS-UX-03 verification evidence

Verified 2026-09-23 on branch `codex/ledger-suit/usability`, based on `stg` commit `6e96c0c`.

## Results

- `pnpm test`: PASS, 49 tests.
- Ledger `lint`: PASS.
- Ledger `typecheck`: PASS.
- Ledger production `build`: PASS.
- `tags-help-tree.spec.ts`: PASS, 3/3. Real local tag create, assignment, persisted filter and removal; persistent help identity/focus/mobile position; English and Arabic RTL hierarchy.
- `workspace-ux.spec.ts`: PASS, 5/5. Real English/Arabic account and transaction workflows, filter/error/tenant isolation behavior and viewer permissions.
- `core-finance.spec.ts --grep "financial system map"`: PASS, 1/1.
- `git diff --check`: PASS before final documentation update and repeated in the final check.

The local API on 60321 initially exposed a stale schema and returned `column account_balances.account_role does not exist`. `supabase migration list --local` identified three pending migrations already present in `stg`; `supabase migration up --local` applied them to this disposable local backend. No hosted database or repository migration was changed.

## Captures

- [English tag filter after the real assign/remove workflow](en-tags-filter.png)
- [English account tree and persistent help on mobile](en-account-tree-mobile.png)
- [Arabic RTL account tree](ar-account-tree.png)

The test-created tag uses a timestamped name. The assignment is removed at the end of the workflow. The screenshots and browser results are engineering evidence, not accountant UAT or deployment evidence.
