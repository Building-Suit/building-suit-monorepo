# Shared UI

Read the root rules and `docs/shared/design-system.md`, `interactions.md` and `data-table.md` before changing shared UI.

- Keep atoms, molecules, organisms and templates under their corresponding `src` directories. Compose PrimeVue primitives; do not fork a vendor component or build another datagrid.
- Search existing shared components before adding product presentation. Reusable presentation is implemented here first; reusable interaction policy/controllers belong in `packages/ux`. App-local components require an entry in `docs/shared/ui-ownership-manifest.json` and are limited to product/domain orchestration that composes shared UI.
- Keep Atomic Design dependencies at the same level or downward (`templates` → `organisms` → `molecules` → `atoms`), never upward. Add, move and remove explicit package exports with their source files; wildcard exports are prohibited.
- Components accept content, values, capabilities and callbacks. They do not query product databases, select tenants, calculate financial rules or import apps.
- Tokens come from `packages/design-tokens`. Brand assets come from `packages/brand`. Fonts, icons and framework integration come from the shared Nuxt layer.
- Put behavior shared across components in `packages/ux`; preserve focus, keyboard support, pending state and dirty-form protection.
- Keep the documentation app's `/components` route representative of changed capabilities. Include both product consumers in verification for shared changes.
- Forward native PrimeVue props, events, model updates and slots deliberately. Avoid attribute order that silently overrides controlled wrapper behavior.
