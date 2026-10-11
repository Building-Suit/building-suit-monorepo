# Shop zero-native UI migration (BS-UI-ZN-SHOP-001)

Shop's 37 route, layout and application Vue templates now render only shared
`Bs` components and non-rendering `template` fragments. Shop has no local Vue
components, template styling attributes, vendor imports or style blocks. Its
boundary-debt and component-ownership entries are removed; other products' debt
remains in migration mode.

Tables use the shared typed column schema and named cell slots. Profile,
business-mode, receipt-settings, billing-notice, initial-shop and platform billing
configuration edits use shared record-action dialogs. POS uses shared action
tiles, entity selection and line-item editing. Receipts use shared printable
header, lines and totals with their issued snapshots and existing print/share
commands. Public plans use the canonical marketing-pricing presentation.

Product queries, commands, pricing variants, usage thresholds, setup steps and
lazy purchase-choice loading remain in Shop composables. The purchase adapter
ignores stale requests, clears choices on identity/shop changes and retries a
failed pagination request without dropping previous or selected choices. No
Supabase schema, migration, database test or runner changed.

## Shared additive contracts

- `BsInput` exposes `focus()` and `select()`; `BsSelect` and `BsEntityPicker`
  expose `focus()` for product keyboard shortcuts.
- `BsEntityPicker` supports `showClear`, localized `retryLabel` and `retry`.
- `BsLineItemsEditor` supports `showAdd`, defaulting to `true`; POS opts out.
- `BsGrid` supports seven columns for the appointment week, collapsing at the
  shared responsive breakpoints.
- `BsPrintableDocument` supports `a4` alongside receipt and statement formats;
  shared print styles select the appropriate paper page.

The docs component catalogue demonstrates picker recovery, line-add visibility
and paper formats. Shared rendering tests protect the default line-add behavior
and A4 language/direction contract. Shop regressions audit every Vue source and
cover the lazy picker request lifecycle. Foundation browser coverage includes
settings dialog validation/focus return and POS shared tile appearance.

## Local verification

Executed successfully:

- `node tooling/checks/suit-template-boundaries.mjs`
- `pnpm check`
- `pnpm typecheck`
- `pnpm lint` (existing warnings remain)
- `pnpm build` (all five workspace applications)
- `pnpm --filter @building-suit/shop-suit build`
- `node --test apps/shop-suit/tests/unit/*.test.mjs packages/ui/tests/*.test.mjs packages/ux/tests/*.test.mjs` (30 test files pass)
- `node --test apps/shop-suit/tests/unit/shared-ui-migration.test.mjs`

`pnpm test` was also executed: 70 of 71 test files pass. The failure is the
unmodified `tooling/git/tests/dev-worktrees.test.mjs`; its nested Node launcher
gets `spawnSync /usr/bin/node EPERM` in this environment.

The required foundation command was attempted with one worker and no retries:

```sh
pnpm --filter @building-suit/shop-suit exec playwright test tests/e2e/shared-ui-foundation.spec.ts --workers=1 --retries=0 --repeat-each=2
```

Its web server cannot start here (`listen EPERM 127.0.0.1:4421`). Browser tests,
rendered screenshots, responsive/RTL/dark appearance, focus behavior and print
layout remain unverified; visual acceptance must be completed in an environment
that permits a local preview server. Static checks and builds do not establish
visual acceptance.

`pnpm agent:preflight` was attempted but could not refresh origin or verify live
GitHub state under the environment's access restrictions. No commit, push,
merge, deployment or hosted-database operation was performed.
