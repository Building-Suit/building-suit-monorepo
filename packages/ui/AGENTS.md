# Shared UI

Read the root rules and `docs/shared/atomic-design.md`, its approved-component inventory, `docs/shared/design-system.md`, `interactions.md` and `data-table.md` before changing shared UI.

- Implement reusable and cross-product UI here first. Keep atoms, molecules, organisms and templates under their corresponding `src` directories: molecules compose atoms, organisms compose molecules and atoms, and templates compose lower shared layers. Never import a higher layer from a lower one. Compose PrimeVue primitives; do not fork a vendor component or build another datagrid.
- Preserve the inventory's approved name, `same` or `reference` mode and destination. Export implementations from the matching public layer entry point. Do not copy approved HTML into Ledger Suit or Shop Suit, and remove product-local standalone overlaps when the shared implementation is adopted.
- Components accept content, values, capabilities and callbacks. They do not query product databases, select tenants, calculate financial rules or import apps.
- Tokens come from `packages/design-tokens`. Brand assets come from `packages/brand`. Fonts, icons and framework integration come from the shared Nuxt layer.
- Put behavior shared across components in `packages/ux`; preserve focus, keyboard support, pending state and dirty-form protection.
- Keep the documentation app's `/components` route representative of changed capabilities. Include both product consumers in verification for shared changes.
- Forward native PrimeVue props, events, model updates and slots deliberately. Avoid attribute order that silently overrides controlled wrapper behavior.
