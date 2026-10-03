# Shop Suit

Root rules apply. Routes and product orchestration are under `app/pages`; tenancy and plan adapters under `app/composables`; RPC contracts under `app/types`.

- Before every task, run the root `pnpm agent:preflight`. Use short-lived `codex/shop-suit/*` feature branches, keep fixes on their open PR, and follow `docs/shared/git-workflow.md` for stacks, parallel work and manual GitHub merges. Shop may have one active root PR into `stg`; Shop children target only an open Shop parent.
- Use shared templates, PrimeVue components, `BsDataTable`, `BsDialog`, wizard and confirmation controllers. Product fields and content remain app-owned.
- Follow [UI-D01 component selection](docs/ui-foundation.md): PrimeVue 4.x is the interactive foundation, composed through `@building-suit/ui` wrappers. Keep simple native semantic inputs/radios where sufficient. Use `BsButton`, `BsForm` and virtualized `BsSelect` for the standardized operational patterns; history uses server pagination. Do not add another component system or raw composite overlays/pickers in Shop pages. `pnpm check` enforces the foundation boundary.
- Preserve shop/portal/profile distinctions, membership and subscription checks. Treat display metadata as untrusted input.
- Catalog, inventory and expense mutations use authorized atomic RPCs. Preserve request idempotency, FIFO, closed-period and archival/void rules.
- Keep amount units explicit: Shop decimal amounts and Ledger minor units are different contracts. Shared presentation must not silently convert business arithmetic.
- Verify the implemented feature against its current product requirements and backend. Historical rebuild plans are context, not an automatic task queue.
- Database SQL, local seeds and tests are owned by this app’s `supabase/` directory. Select it from the root with `pnpm db shop-suit <command>`. Business objects and client RPCs use `public`; this product has its own production/staging pair and Auth sessions. Keep the portal key `shop-crm` unchanged.
