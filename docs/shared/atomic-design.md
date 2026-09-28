# Atomic Design implementation contract

Status: approved implementation contract  
Requirements: UI-ATD-01, UI-ATD-02, UI-ATD-06, UI-ATD-07  
Decisions: LS-D-UI-CROSS-PRODUCT, LS-D-UI-LIB-FIRST, LS-D-UI-PACKAGE

## Authority and scope

`building_suit_ui_approved_final.zip` is the visual approval authority for the redesign. The checked-in [approved-component inventory](approved-ui-components.md) must record every approved HTML artifact, its component name, its `same` or `reference` approval mode and its required Atomic Design destination. Agents implement only from a complete inventory and inspect the corresponding artifact before changing code. Historical prototypes, product-local components and component names inferred from screenshots do not override it.

Approval modes are implementation constraints:

- `same` means implement the approved artifact pixel-faithfully within the canonical token system and the engineering constraints below.
- `reference` means preserve the approved concept, hierarchy and composition closely while adapting it as needed for production implementation.

Both modes must use canonical tokens and shared contracts and must support accessibility, English/Arabic, LTR/RTL, light/dark themes, responsive layouts and required product states. Those constraints permit implementation adjustments; they do not permit silent redesign or a change of approval mode. Product behavior, permissions, validation, queries and financial rules remain governed by their owning specifications.

## Package and dependency contract

The implementation owner is `@building-suit/ui` in `packages/ui`. Its public layer entry points are:

Molecules depend on and compose shared Atoms. Organisms depend on and compose shared Molecules and Atoms. Ledger Suit and Shop Suit consume those shared layers rather than copying or pasting HTML fragments into product code.

| Layer | Source | Public entry point | Dependency rule |
|---|---|---|---|
| Atoms | `packages/ui/src/atoms/` | `@building-suit/ui/atoms` | May use platform, token, brand and PrimeVue primitives; never molecules, organisms, templates or applications. |
| Molecules | `packages/ui/src/molecules/` | `@building-suit/ui/molecules` | Compose shared atoms; never organisms, templates or applications. |
| Organisms | `packages/ui/src/organisms/` | `@building-suit/ui/organisms` | Compose shared molecules and atoms; never templates or applications. |
| Templates | `packages/ui/src/templates/` | `@building-suit/ui/templates` | Compose shared organisms, molecules and atoms into reusable page frames; never import an application. |

`packages/ux` owns reusable interaction policy/controllers, and the shared Nuxt layer owns framework registration. The UI package accepts content, values, capabilities, callbacks and slots. It does not query product databases, select tenants, calculate product rules or import any application.

An inventory destination is a required ownership map, not an implementation-status claim. A component is implemented only when its shared source, public export, representative catalogue fixture and relevant verification exist.

## Library-first workflow

For every approved or otherwise reusable UI change:

1. Find the inventory row and inspect the named HTML artifact and approval mode.
2. Search `packages/ui`, Ledger Suit and Shop Suit for existing implementations and overlaps.
3. Implement or extend the lowest valid shared layer first, following the dependency direction above.
4. Export the component from that layer's entry point and represent it in the shared component catalogue.
5. Replace overlapping product-local standalone implementations with shared-library consumption. Preserve product-owned orchestration and business rules outside the shared component.
6. Verify all affected consumers and the required accessibility, locale, direction, theme, viewport and state variants.
7. Update the inventory when an approved artifact, component name, approval mode or target destination changes. Do not edit generated evidence or create a competing inventory.

Copy/pasting an approved HTML fragment into Ledger Suit or Shop Suit is forbidden. Creating a reusable component inside an application's component directory first is also forbidden. A narrowly product-specific wrapper is allowed only when it adds product-owned orchestration or domain presentation around shared components; it must not reproduce their standalone markup or styling. Shared code never imports Ledger Suit, Shop Suit or another application's internals, and applications never import each other's internals.

## Cross-product rollout

Ledger Suit is the initial implementation driver, but `@building-suit/ui` is shared by Ledger Suit and Shop Suit. Changes to approved shared components must be consumable by both products, and overlapping standalone UI in either product is migrated to the shared implementation rather than forked.

The current integration target is `stg`. This statement records rollout intent only: it does not authorize a push, pull request, merge or deployment, and branch/worktree handling still follows `docs/shared/git-workflow.md` and the active task instructions.
