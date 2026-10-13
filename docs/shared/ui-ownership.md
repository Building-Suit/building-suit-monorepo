# Shared UI ownership

`packages/ui` owns **all presentation**, including pages unique to one Suit. `packages/ux` owns shared interaction behavior and controllers. Suits own business rules, data, trusted authorization context, product copy and configuration. Product routes, layouts and roots are thin adapters to complete registered templates.

Before adding presentation, search the Atomic Design library and [canonical template registry](atomic-template-route-inventory.json). Create or extend an atom, molecule, organism or complete template in UI; shared interaction policy belongs in UX. Same-purpose pages use the exact same registered template with typed product projections and capabilities. Unique pages also live in UI. Product orchestration belongs in scripts/composables/helpers, never an app-local visual wrapper.

## Mechanical contract

Normal `pnpm check` executes the strict atomic architecture validator and discovers every `apps/*-suit`. There is no migration allowance or local-component exception. It requires:

- Zero Suit-local Vue components or hidden render functions/JSX, including imported callable wrappers.
- Every route mapped to one complete `packages/ui/src/templates` owner; every layout/root mapped to its shared shell/root. Same-purpose mappings must agree.
- Resolved governed UI exports, rather than accepting a `Bs` name as evidence of ownership.
- No native/vendor/local rendered tags, UI vendor imports, styles, styling passthrough, render callbacks, arbitrary slots, dynamic components or raw HTML in Suit adapters. Vue's non-rendering `<template>` control tag remains allowed.
- Typed, neutral presentation/content/capability/state contracts and semantic commands; no raw backend schemas/clients, executable factories, opaque bags, component/VNode contracts or layout recipes.
- UI without product/app/data-query dependencies; UX without presentation files, JSX/Vue render calls or UI/app imports.
- Explicit package exports and same-or-lower Atomic Design dependencies.

The [ownership manifest](ui-ownership-manifest.json) records shared workflow families. Its component and bypass lists are empty. Historical `product-orchestration`, `shared-presentation-debt` and `obsolete-duplicate` classifications describe earlier migration evidence; they cannot authorize a new local component or bypass. The historical occurrence-level [boundary inventory](suit-ui-boundary-debt.json) is empty and retains no exception to the strict gate.

Update the canonical route-template inventory, exports, affected consumers and catalogue in the same change. The registry records source, destination, purpose, product adapter, imports and actual verification. Generated/new routes start unverified and require their own product/browser acceptance.

## Future Suit generation

`pnpm new:platform <slug> "Product name" --dry-run` previews the maintained starter without creating an app. The generator emits `BsAppRoot`, `BsWorkspaceShell` and a `BsStarterWorkflowPage` route adapter demonstrating translated props and semantic event handlers. It creates no local Vue component layer or presentation CSS. Generated apps declare Nuxt/Vue runtime dependencies and the shared Nuxt layer; presentation vendors, modules, styles and fonts remain owned by that layer.

Run `node --test tooling/new-platform/tests/generate.test.mjs` for the disposable scaffold regression gate. It compares dry-run output with generated files and runs `suit-template-boundaries.mjs` in strict mode on the generated Suit. The same check is available as `node tooling/checks/suit-template-boundaries.mjs --root <disposable-workspace> --strict`. Strict mode requires discovered Suit Vue files and rejects every violation without reading or allowing migration debt. Regression fixtures verify that native/Nuxt/vendor tags, aliases, local components, styling escape hatches and vendor imports fail. The generator also registers all three owners in the canonical route-template inventory; generated entries remain unverified until product acceptance passes. Its regression executes the strict atomic architecture check against a disposable workspace. Existing products use the same strict zero-debt architecture through `pnpm check`.

The standalone command `node tooling/new-platform/verify-fixture.mjs` creates a disposable workspace, verifies the side-effect-free dry run against emitted files, runs the strict boundary checker CLI against that fixture, and removes the workspace on success or failure. Its assertions and the checker exit status are required for success. It never registers a real app.

[`tooling/new-platform/verification-registry.json`](../../tooling/new-platform/verification-registry.json) supplies the command and exact mappings for the two generator verification obligations. The control-plane owner must append this command and merge these mappings into the shared workstream registry, preserving its other commands and mappings. This file is a registration handoff; adding it does not activate the registry or satisfy independent verification. Both obligations remain required until that registration is applied and the control plane reruns them.

## Atomic direction and exports

Shared composition follows `atoms → molecules → organisms → templates`: a layer may use its own or a lower layer, never a higher layer. UI may consume UX; UX never imports UI. Exact money display, visual ratios and print-document markup are UI presentation. Browser printing, downloads, file handling, tabs, overlays, focus, dirty state and pending/error interaction policy are UX. Product financial calculations, permission/tenant rules and authorized command construction remain Suit-owned.

Every public UI source has an explicit package export. Product queries and contracts cannot move into an atomic layer to satisfy ownership. Templates receive typed projections and emit semantic actions; they do not become routes or execute business operations. Standard data tables and overlays use the existing shared owners/controllers.

## Design-system lock and verification

Consume canonical tokens, Manrope/IBM Plex Sans Arabic, Hugeicons and existing branding. This migration does not authorize token-value changes or an unrelated redesign.

Shared changes require strict workspace checks, meaningful UI/UX/product regressions, all affected consumer typechecks/builds, lint and catalogue verification. Browser acceptance covers English/Arabic, LTR/RTL, light/dark, mobile/tablet/desktop, keyboard/focus and relevant loading/empty/error/success/denied states. Identical source/class names do not prove parity: compare actual shared control/shell measurements and inspect captures. Failed, skipped or unrun checks are never reported passing.

See [the completed local acceptance record](atomic-template-unification-acceptance.md) and [source history](atomic-template-unification-checkpoint.md). Publication/provider prerequisites are separate from local architecture acceptance.
