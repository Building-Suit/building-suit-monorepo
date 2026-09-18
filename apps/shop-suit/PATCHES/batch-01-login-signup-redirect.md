# EDIT — Batch 01 Login/Signup redirects

After Batch 02 is installed, successful authentication should go to `/dashboard`.

## `apps/shop-crm/app/pages/auth/login.vue`

Replace both successful/already-authenticated occurrences of:

```ts
await navigateTo('/')
```

with:

```ts
await navigateTo('/dashboard')
```

## `apps/shop-crm/app/pages/auth/signup.vue`

For the `data.session` case replace:

```ts
await navigateTo('/')
```

with:

```ts
await navigateTo('/dashboard')
```
