# Shop Suit app

Nuxt 4 storefront and shop-management UI. Authentication and data access use the
Supabase client against the hosted project, with business data in `shop_crm`.
There is no application API layer, server API route, or service-role key in this
app. The current product is **not ready for sale**; see the
[readiness record](../../docs/readiness/README.md) for verified capabilities and
remaining tasks.

## Local app development

From the repository root:

```bash
pnpm install
cp apps/shop-crm/.env.example apps/shop-crm/.env
pnpm run dev:shop-crm
```

Fill the ignored `.env` with the hosted Supabase project URL and a browser-safe
publishable key. The portal key is `shop-crm`. The hosted project's Data API must
expose `shop_crm` before client table requests will work. Do not run the old
`supabase/migrations` chain against this shared project.

```bash
pnpm run typecheck:shop-crm
pnpm run build:shop-crm
```

The [unlinked deployment command](../../docs/readiness/deploy-without-link.md)
handles scoped `shop_crm` migrations without touching the old `public` chain.
It is a separate, explicit cloud operation; running the Nuxt app does not push
database changes.
