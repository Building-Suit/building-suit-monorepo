# Shared UI

Read the root rules and `docs/shared/design-system.md`, `interactions.md` and `data-table.md` before changing shared UI.

- Keep atoms, molecules, organisms and templates under their corresponding `src` directories. Compose PrimeVue primitives; do not fork a vendor component or build another datagrid.
- Components accept content, values, capabilities and callbacks. They do not query product databases, select tenants, calculate financial rules or import apps.
- Tokens come from `packages/design-tokens`. Brand assets come from `packages/brand`. Fonts, icons and framework integration come from the shared Nuxt layer.
- Put behavior shared across components in `packages/ux`; preserve focus, keyboard support, pending state and dirty-form protection.
- Keep the documentation app's `/components` route representative of changed capabilities. Include both product consumers in verification for shared changes.
- Forward native PrimeVue props, events, model updates and slots deliberately. Avoid attribute order that silently overrides controlled wrapper behavior.
