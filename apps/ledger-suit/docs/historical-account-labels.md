# Historical account labels — LS-FIX-002

Status: **IMPLEMENTED LOCALLY / NATIVE SQL VERIFICATION PENDING**, 2026-09-27.

Pinned implementation base: `14f136da0e6467fd60258cf882b7aa141f9c5dd2`. The prepared branch integrates the reviewed V2-IMP-015 package through merge commit `07dd278d8f9acb477662155031a2bcea67412026`; the original feature-tip SHA is not a direct ancestor. No hosted database, deployment, commit, push or accountant UAT is claimed.

## Product disposition

R02-D01 is `APPROVED_FOR_IMPLEMENTATION` under the founder's standing product authorization AS-E02 dated 2026-09-19. The selected disposition is the minimal prospective history repair, not acceptance of current-name restatement:

- capture an append-only account-name version when an account is created or renamed;
- show the name that existed when the latest journal line included by a report group was created;
- use that same historical name in P&L, Balance Sheet, Trial Balance, CSV exports and posted-line drill-down;
- leave account IDs, codes, mappings, transactions, entries and every monetary calculation unchanged.

This is a product implementation decision, not accountant acceptance. A named accountant has not reviewed the resulting reports.

## Historical boundary

Migration `20260927130000_historical_account_labels.sql` creates one baseline version from each account's name at migration time. That is the earliest provable label. The system does not claim that labels used before this migration were previously versioned, and it cannot reconstruct an older overwritten name that is absent from retained evidence. Renames after the migration are versioned prospectively.

The repair does not add a stored balance, alter a posted transaction or entry, change effective-dated financial mappings, or rebuild statement arithmetic. Existing report and export contracts remain unchanged.

## Focused fixture and acceptance evidence

`supabase/tests/49_historical_account_labels_test.sql` pins one organization, two accounts, one mapping and one balanced journal for 12,500 minor units. It captures transaction, entry and mapping digests before rename/archive, then checks:

- current account management shows the renamed/archived state;
- historical P&L, Balance Sheet and Trial Balance keep the original labels;
- P&L screen data and CSV use the same original label and exact 12,500 amount;
- posted-line and journal drill-down retain the original label and stable account/journal links;
- transaction, entry and mapping digests remain unchanged;
- debit and credit remain exactly 12,500.

The existing V2-IMP-015 shared-story probe now records the same before/after evidence for its 30,000 revenue fixture and retains its full balance reconciliation.

Native SQL was not executed in this worktree because Docker access is denied and the pinned Supabase CLI dependencies are unavailable. Until suite 49 and the shared-story probe pass on an explicitly owned disposable Ledger database, `tests_passed` remains `unverified`. Deployment and accountant acceptance remain separately `unverified`/`pending`.

Actual local checks on 2026-09-27:

- `pnpm --filter @building-suit/ledger-suit test:unit`: PASS, 16 files/tests, no skips or failures.
- `node apps/ledger-suit/scripts/verify-v2-acceptance-artifacts.mjs`: PASS, 138 distinct requirement states and exact eight-journal worksheet reconciliation; this is not database evidence.
- `pnpm check`: PASS, token outputs, workspace boundaries and preserved historical migrations.
- `git diff --check` and JSON parse: PASS.
- Ledger `typecheck` and `lint`: not run successfully because `nuxt` and `eslint` are absent with this worktree's missing `node_modules`.
- SQL suite 49/shared-story probe: unrun; Docker socket access is denied, local port 60322 has no server, and the Supabase CLI is unavailable.
- Generated database types: not regenerated for the new internal history table because the Supabase CLI/local database is unavailable. Existing report RPC signatures did not change and no client code queries the table directly.
