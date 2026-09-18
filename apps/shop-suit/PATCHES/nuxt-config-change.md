# EDIT — `apps/shop-crm/nuxt.config.ts`

Do **not** replace the whole Nuxt config yet. The untouched landing/auth server code still has
legacy dependencies that will be removed in the next migration batch.

Make these two changes.

## 1. Add `@nuxtjs/supabase` to `modules`

Current section:

```ts
modules: [
  '@buildingsuit/api-layer',
  '@nuxtjs/tailwindcss',
  // ...
],
```

Change to:

```ts
modules: [
  '@nuxtjs/supabase',
  '@buildingsuit/api-layer', // TEMPORARY: removed when remaining legacy consumers are migrated
  '@nuxtjs/tailwindcss',
  'shadcn-nuxt',
  '@vueuse/nuxt',
  '@nuxt/icon',
  '@nuxtjs/i18n',
],
```

## 2. Add Supabase module config

Add at top-level, next to `apiLayer` / `i18n`:

```ts
supabase: {
  redirect: false,
},
```

`redirect: false` is intentional. Shop Suit will own routing/onboarding/subscription decisions
instead of using the module's generic auth redirect.
