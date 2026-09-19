# Shared platform composition

Status: UI/workspace decision implemented. Its original shared-database/global-identity direction is superseded by [ADR 0002](0002-independent-supabase-projects.md); its original application color-role choice is superseded by [ADR 0003](0003-ledger-neutral-palette.md).

Keep Ledger Suit and Shop Suit as separate Nuxt applications in one pnpm workspace. A shared Nuxt layer registers Building tokens, CSS, fonts, icons, atomic components and interaction infrastructure. Both apps retain routes, product copy, domain validation, tenant/subscription adapters and business commands.

Use PrimeVue 4.5.5 from the Ledger baseline. `BsDataTable` wraps the native DataTable API; Column and ColumnGroup carry product cell templates and report structure. `BsDialog`, record-action/wizard controllers and one confirmation host centralize UI behavior. Remove the competing Shop shadcn/Reka/icon runtime. Share Ledger's complete marketing/auth/application compositions through content props and slots.

One shared token source governs the palette; source app overrides do not create competing token authorities. ADR 0003 promotes Ledger's neutral application roles into that source while retaining Building's navy/gold brand foundations. Preserve all original Building documentation as a searchable app and expose maintained shared specs and the component catalogue beside it.

Atomic Design applies to reusable presentation. Existing app/pages, app/composables and app/utils boundaries remain useful for product ownership; do not force product business models into atomic categories. Shared packages never import applications. Each product owns an independent Supabase pair, `public` business objects and separate Auth as defined in ADR 0002, with deployed-state checks required before use.

The consequence is one change point for common UI behavior and styles, independent product entry points, one build/test graph and explicit shared interfaces. A shared UI change requires checking all affected apps; a product-only change stays in its app. Shared infrastructure does not merge product permissions or financial/inventory models.
