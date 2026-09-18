# Shared platform composition

Status: implemented locally for UI and workspace structure; hosted data/identity cutover pending the environment prerequisites.

Keep Ledger Suit and Shop Suit as separate Nuxt applications in one pnpm workspace. A shared Nuxt layer registers Building tokens, CSS, fonts, icons, atomic components and interaction infrastructure. Both apps retain routes, product copy, domain validation, tenant/subscription adapters and business commands.

Use PrimeVue 4.5.5 from the Ledger baseline. `BsDataTable` wraps the native DataTable API; Column and ColumnGroup carry product cell templates and report structure. `BsDialog`, record-action/wizard controllers and one confirmation host centralize UI behavior. Remove the competing Shop shadcn/Reka/icon runtime. Share Ledger's complete marketing/auth/application compositions through content props and slots.

Building's published token roles govern the palette; source app overrides do not create competing token authorities. Preserve all original Building documentation as a searchable app and expose maintained shared specs and the component catalogue beside it.

Atomic Design applies to reusable presentation. Existing app/pages, app/composables and app/utils boundaries remain useful for product ownership; do not force product business models into atomic categories. Shared packages never import applications. Private schemas and the global-account/portal-profile/membership split govern the target data architecture, with deployed-state checks required before use.

The consequence is one change point for common UI behavior and styles, independent product entry points, one build/test graph and explicit shared interfaces. A shared UI change requires checking all affected apps; a product-only change stays in its app. A single database project does not imply sharing product permissions or financial/inventory models.
