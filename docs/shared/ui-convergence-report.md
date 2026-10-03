# Shared UI convergence report

Task `BS-UI-CONVERGENCE-001` closes the cross-product foundation audit for Automation Suit, Inventory Suit, Ledger Suit, and Shop Suit. The audit is bounded to reusable presentation and interaction ownership; it does not change product business rules or the owner-locked Design System values.

## Final shared inventory

`packages/ui` is the single reusable presentation source. Its explicitly exported component inventory is:

- atoms: `AppIcon`, `BsBuildingLogo`, `BsButton`, `BsProductLogo`, `StatusBadge`;
- molecules: `BsCard`, `BsKpiCard`, `BsSelect`, `BsTableDensity`, `EmptyState`, `FloatingField`, `OtpInput`, `SectionSkeleton`;
- organisms: `BsConfirmHost`, `BsDataTable`, `BsDialog`, `BsForm`, `BsPageHeader`, `BsRecordActionDialog`, `BsSignupWizard`, `SettingsMenu`, `ToastHost`;
- templates: `BsAppShell`, `BsAuthLayout`, `BsLandingPage`, `BsMarketingLayout`, `BsPublicLegalPage`.

Reusable record-action, confirmation, wizard, toast, table-export, verification-timer, and landing-motion policy remains in `packages/ux`. Shared UI may consume UX; UX does not import UI or applications. The live catalogue at `/components` exercises buttons, cards, KPI/status, form/select, table states and capabilities, confirmation, wizard, toasts, and canonical create/edit record actions in English/Arabic and LTR/RTL through the shared locale/theme controls.

## Current Suit audit

| Suit | Convergence result | Valid app-local components |
|---|---|---:|
| Automation | Shared shell, card, KPI, status, button, select, table, form, and modal record-action contracts. Its policy and project writes use `useRecordAction` with `BsRecordActionDialog`. | 3 |
| Inventory | Shared shell and shared card presentation; no app-local components or parallel UI foundation. | 0 |
| Ledger | Shared table, modal CRUD, confirmation, form/control, card, status, and KPI contracts retained. | 33 |
| Shop | Shared table, modal CRUD, confirmation, form/control, card, status, and KPI contracts retained. | 8 |

The 44 app-local components are all classified as `product-orchestration` in [`ui-ownership-manifest.json`](ui-ownership-manifest.json). Each adapts product data, rules, queries, commands, or vocabulary and composes canonical shared UI. There are zero `shared-presentation-debt` entries, zero `obsolete-duplicate` entries, and zero shared-primitive bypasses. Read-oriented, multi-phase, account-menu, and other materially different overlays still compose `BsDialog`; they are not exceptions to shared overlay ownership or standard record-action behavior.

## Enforcement and evidence

`tooling/checks/workspace.mjs` discovers directories matching `apps/*-suit` at runtime. It enforces exact local-component classification, application dependency direction, shared table/dialog/confirmation/form/button/composite-control ownership, Atomic Design direction, explicit UI exports, UI-to-UX dependency direction, pinned foundations, and preserved historical SQL. The shared foundation test independently discovers the same Suit set and asserts that reusable native or direct vendor primitives do not return.

Verification completed locally for this convergence result:

- the frozen offline install completed with 867 cached packages and zero downloads after routing pnpm's project-registration metadata to a temporary writable store (the first default-store attempt was blocked by the read-only sandbox);
- `pnpm check` passed, including unchanged canonical token output, four dynamically discovered Suits, 44 classified local components, and 80 preserved historical migrations;
- `pnpm typecheck` passed for all configured workspaces after generating the documented local catalogue prerequisite;
- `node --test packages/ui/tests/foundation.test.mjs packages/ux/tests/export.test.mjs` passed;
- the individual Ledger, Shop, Inventory, Automation, and documentation catalogue production builds passed; and
- focused Automation, Inventory, shared-test, and checker lint passed.

No files under `packages/design-tokens`, product database/schema code, deployment configuration, or business-rule modules are changed by this convergence task.
