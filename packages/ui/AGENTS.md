# Shared UI

Read the root rules and `docs/shared/design-system.md`, `interactions.md` and `data-table.md` before changing shared UI.

- Keep atoms, molecules, organisms and templates under their corresponding `src` directories. Compose PrimeVue primitives; do not fork a vendor component or build another datagrid.
- Every dynamically discovered Suit `app/**/*.vue` template may use only the non-rendering Vue `<template>` control tag and rendered components whose names begin with `Bs`. Native/Nuxt/vendor/non-`Bs`/product-local tags, template class or style escape hatches, `v-html`, local style blocks and direct UI-vendor imports are forbidden. Normal workspace checks enforce strict zero debt; Suit `app/components` must contain zero Vue files.
- Search existing shared components before adding product presentation. All presentation, including unique pages, is implemented here; shared interaction policy/controllers belong in `packages/ux`. Product/domain orchestration lives in Suit scripts/composables/helpers, never local Vue composition.
- Keep Atomic Design dependencies at the same level or downward (`templates` → `organisms` → `molecules` → `atoms`), never upward. Add, move and remove explicit package exports with their source files; wildcard exports are prohibited.
- Components accept typed content, values, capabilities and operation state, and emit semantic actions. They do not query product databases, select tenants, calculate financial rules or import apps.
- Tokens come from `packages/design-tokens`. Brand assets come from `packages/brand`. Fonts, icons and framework integration come from the shared Nuxt layer.
- Put behavior shared across components in `packages/ux`; preserve focus, keyboard support, pending state and dirty-form protection.
- Keep the documentation app's `/components` route representative of changed capabilities. Include both product consumers in verification for shared changes.
- Forward native PrimeVue props, events, model updates and slots deliberately. Avoid attribute order that silently overrides controlled wrapper behavior.

Atomic template ownership: each Suit route renders exactly one complete, explicitly exported page-level template from `packages/ui`, using typed neutral view models, controlled form values, content and semantic commands. Shared UI owns all presentation, including unique product-specific compositions. Suit scripts retain business rules, authorized data access and configuration. Shared interaction controllers live in `packages/ux`. Suit routes cannot supply child composition, scoped slots, component/render factories, VNodes or untyped state bags. Layout adapters supply only typed shell configuration and one direct unscoped route outlet. Do not add app-local Vue components or migration debt allowances.

Detached print-document presentation belongs in explicitly exported `src/utils` renderers with typed content inputs. These renderers remain pure presentation and are included in the strict UI infrastructure/import boundary; browser window and download behavior belongs in `packages/ux`.
