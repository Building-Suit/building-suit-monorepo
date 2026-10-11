# Shared atomic template unification checkpoint

Status: in progress. The requested architecture migration is **not complete**.
Task: `atomic-template-unification` (interactive Codex owner).

## Baseline and ownership

- Branch: `codex/shared/atomic-template-unification`.
- Worktree: `.local/worktrees/shared-atomic-template-unification`.
- Verified open parent: [Shared #238](https://github.com/Building-Suit/building-suit-monorepo/pull/238), `codex/shared/bs-sa-future-suit-001`, exact committed HEAD `089381052fccdd9768d20ad403037f12bd3fa0d9`.
- Reconciled source checkpoint: `47a328de3dead28fd3576b6814e5caceec4cac68`; worktree clean after the merge commit. Parent, verified ancestor and accepted staging SHA are all ancestors of this checkpoint.
- No child PR has been published. Its required target remains the parent branch above, never `stg`.
- Parent discovery used live head/base relationships across the complete Shared chain. The primary checkout was 195 commits behind `origin/stg` and had unrelated control-plane edits; it was preserved.
- The new child began at the exact parent SHA. It incorporated verified ancestor `cf5eb9cd6349f4517ca18beb6025d88167c3e279` through owned merge `d621de0`. The only first-merge conflict was the shared documentation index; both entries were retained.
- The subsequent forward merge incorporates accepted staging `18dcf90f33335c06c74a2c9b98ce794b90991837`. Conflicting presentation retained Shared Bs contracts, while accepted Shop command/session behavior and controls were reconciled explicitly.
- Every verified ancestor head is listed in [the source inventory](atomic-template-route-inventory.json). This record distinguishes source ancestry from architectural acceptance.
- Dirty parent/worker work was excluded. In particular `shared-bs-changelog-version-001` has unpublished catalogue, export, manifest and changelog edits. The active chat **Recover Shared and SAS n8n runs** owns its recovery/publication; this task did not copy, commit, publish or modify those files. Local Control returned no Shared task records and is not evidence of hosted worker inactivity.

## Implemented reconciliation

Reused existing Bs components and shared record-action/confirmation behavior; no new template or controller has yet been added.

Preserved accepted Shop private-offer redemption, payment image reservation/upload/readback, invitation local sign-out, team member identity fields and role editing, cashier policy, fast-pay exact-command retries, bounded POS customer search, appointment customer locks and sale error/copy behavior. Restored these controls through existing Bs fields, tables, dialogs and semantic presentation rather than staging's native/vendor composition. Existing strict-mode, access-management, future-Suit contracts and explicit exports remain present.

A plan presentation union mismatch exposed by accepted Solo variants was corrected by assigning only `multi_2`/`multi_3` to the Multi selection. The POS source test still requires its shared picker ID and filter contract while allowing legitimate attribute ordering. Its SSR fixture renders the actual shared repeating-row/field owners so scoped slots receive real data; the original appointment lock, disabled action and initial total assertions remain required. Realtime adoption now records the newly present Super Admin bootstrap with a source-backed blocked transport decision; no subscription or provider setting was enabled.

## Inventory and remaining implementation

Original verified leaf: **86 Suit Vue files, 74 routes, zero local component files**.
Reconciled candidate: **90 Suit Vue files, 76 routes, nine layouts, five roots, zero local component files** across Automation, Inventory, Ledger, Shop and Super Admin. The docs application is a catalogue consumer and does not match `apps/*-suit`.

The [exact source inventory](atomic-template-route-inventory.json) includes every nested/dynamic route, root and layout, current registered template references, component composition and imported adapter dependencies. All complete-composition mappings are explicitly pending review. It is **not** the final enforceable route-template registry. The existing nine template owners do not cover all complete page compositions.

Completed: isolated child/ancestry discovery, accepted-source reconciliation, verification of the existing zero-local-component gate.

Remaining, in the requested order:

1. Complete hidden-presentation/import-resolution audit, including TS/JS/JSX/render callbacks. Preliminary search found no JSX files or ordinary `defineComponent`/`h`/`createVNode` calls in Suit app sources; this is not AST proof.
2. Implement one complete Team/Roles/Permissions/Invitations template for Ledger and Shop, including dialogs and states. Their routes currently retain Bs composition; that is outstanding debt under the user's requested architecture.
3. Complete all other page families and thin root/layout adapters from the exact inventory; supply typed view models and semantic actions without moving product rules or queries.
4. Extend mechanical ownership and route-template checks, negative bypass tests, scaffold and guidance/catalogue. Do not relax the existing strict gate or regenerate approval debt to pass.
5. Verify all affected products and rendered bilingual/theme/responsive/accessibility/state/interaction parity, then publish one verified Draft child through this interactive owner after the provider event gate is verified.

## Verification receipts

Commands ran in the owned worktree. Initial failures were repaired; their passing reruns are recorded separately from checks not run.

| Command | Result |
|---|---|
| `pnpm agent:preflight` in primary checkout | Failed only for stale current upstream; live GitHub/worktree state obtained. Primary source unchanged. |
| Second `pnpm agent:preflight` in owned child | Failed with `Preflight failed (1)` before producing the state report; direct GitHub fallback also failed with `error connecting to api.github.com`; the fetch retry remained pending at checkpoint time. No publication attempted. |
| `pnpm install --frozen-lockfile` | Passed; workspace prepare completed. |
| `pnpm check` | Passed: canonical tokens, five discovered Suits, zero classified local components, 80 historical migrations unchanged. |
| `pnpm --filter @building-suit/shop-suit typecheck` | Passed after union and restored member-table binding fixes. Missing local Supabase configuration warnings remain; no hosted configuration was read or changed. |
| Shop scoped `eslint` on reconciled billing/team/settings/POS/invitation/sales routes and plan composable | Passed. Root `eslint` ignored these app files and was not counted as verification; the product's actual config was used. |
| `node --test --test-reporter=tap` on payment-evidence, signup-session-transition, POS customer SSR and SS-LAUNCH-POS-CUSTOMER-001-1 | **13 passed, zero failed/skipped**. |
| `node --test --test-reporter=tap packages/ui/tests/*.test.mjs packages/contracts/tests/bs-realtime*.test.mjs packages/contracts/tests/bs-sa-future*.test.mjs` | **58 passed, zero failed/skipped**. |
| `pnpm --filter @building-suit/shop-suit build` | Passed, including the final POS value/clear-control restoration. |
| `git diff --check` | Passed. |

Full all-product lint/type/build/security/database/browser regression and side-by-side visual fixtures are **unrun**. No visual parity, product acceptance or full migration completion is claimed.

## Publication and environment boundaries

Repository root/app Vercel files suppress feature Git deployments. Dashboard Root Directory/provider integration state and Supabase Automatic branching are **not verified**; file configuration alone cannot establish that publication has no external side effects. The exposed Supabase tools do not expose the Automatic branching setting. Read-only browser navigation to the dashboard timed out; the resulting tab remained `about:blank`, so no setting was inspected or changed. Publication remains pending that read-only provider verification and reconciliation of the active Shared publication owner. No provider/secret changes, runtime installation/restart, hosted migration/data write, staging/main merge or deployment was performed.

Resume here; do not repeat the completed baseline or restore old staging presentation. Refresh live heads before continuing and incorporate later committed parent checkpoints without copying dirty worker files.

## Access family implementation (in progress)

Ledger and Shop `/team` now render one `BsAccessManagementPage` template. Product adapters map members, roles, invitations, permissions and audit records into neutral display contracts and retain authorized product commands, tenant context and dirty-state controllers. Invitation, member, role, matrix and ownership-transfer composition is shared. Locked permissions remain locked; form updates emit replacement values rather than mutating product objects. Access keyboard target selection lives in `packages/ux`.

Focused tests: 46 passed, zero skipped (shared UI suite, tab navigation, Shop team contract). Product typecheck/lint and browser evidence are recorded after their actual completion. Route registry status remains visual acceptance pending; the full 76-route migration and strict architecture acceptance are incomplete. This is an implementation commit within the continuing task, not a final handback.

## Auth, bootstrap, activity and accounting dimensions implementation

Page templates now own Ledger/Shop sign-in, password recovery, Ledger verification and redirect, Inventory welcome, Super Admin entry, Automation activity/worklist, and Ledger accounting dimensions presentation. App adapters retain the existing product queries, authorization, validation and commands. Shared locale metadata, password visibility, clipboard and tab focus behavior live in UX. Typed presentation contracts are explicitly exported; Nuxt scans Vue components only.

Verification completed locally: all six workspace typechecks passed; shared lint passed; `pnpm check` passed; 76 focused UI/UX/architecture/product unit tests passed without skips. Auth parity passed eight locale/theme/viewport combinations against both built products. Access parity passed eight combinations against two shared-template configurations (authenticated product team adapters are not yet browser-verified). Ledger dimensions browser regressions passed English and Arabic against mocked local APIs. Ledger, Shop and docs builds passed for their respective tested batches. Evidence is retained under ignored `.local/atomic-template-evidence`; subsequent UI changes require refreshed browser/build evidence.

The new strict template checker has negative AST tests and deliberately reports the remaining unmigrated routes. It is not yet the completed acceptance gate. No full migration PASS is claimed, and no provider settings, hosted database, deployment, merge or remote publication was changed. Work continues on remaining page and shell families.

## Operations, catalogue, invitation, audit and portfolio implementation

All eight Automation routes now consume complete typed templates. Projects, routing policies and task detail map domain records to neutral presentation contracts; operational dashboard filtering and incident classification remain product-owned. Inventory, Automation and Super Admin use the same workspace shell; marketing layouts and Shop operator shell have typed configuration and direct route outlets. Ledger audit/portfolio and Ledger/Shop invitation acceptance now use complete shared templates. Shop Products and Services use the exact same catalogue template. Scheduling options now await their permission read before the guarded initial load; the server authorization and write payloads are unchanged.

Shared form pending/error focus, dialog dirty/Escape/focus behavior, polling, shell navigation and marketing observer controllers now live in UX. Verification timers moved from Auth into UX. UX explicitly declares its Vue runtime dependency; offline frozen installation passed. Code snippets use LTR inside RTL pages.

Evidence: all six workspace typechecks passed after these changes; 83 focused shared/product tests passed without skips; 14 strict architecture negative tests passed. Normal token/workspace checks passed. Automation's eight actual-adapter browser cases passed (English/Arabic, light/dark, 390/1440). Shop's focused catalogue and team browser cases passed against synthetic SSR/client transports, including preserved service scheduling payloads and role/invitation commands; the full Shop matrix passed all 20 cases, including catalogue/team locale-theme-viewport combinations and bilingual denied, empty and invitation acceptance cases. Shop builds passed; other affected exact-source builds and full visual acceptance remain pending. The legacy team fixture's nonexistent baseline search assertion was corrected to exercise its existing status filter; tab selectors retain the baseline visible counts.

Registry progress: 37/76 routes, 7/9 layouts and 5/5 roots have assigned templates. These assignments are implementation progress, not accepted parity. The strict checker still fails on the 39 remaining routes, two product shells and legacy scope factories; there are no debt allowances. All work is local. No publication, provider setting, hosted database, deployment or merge was changed. Implementation continues.
