# EDIT — `apps/shop-crm/.env`

The Nuxt Supabase module accepts the legacy `SUPABASE_URL` / `SUPABASE_KEY` variables used by
Ledger Suit and also newer `NUXT_PUBLIC_*` names.

For the least disruptive change, keep your current variables and add:

```env
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_KEY="YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY"
```

`SUPABASE_KEY` is the browser-safe publishable/anon key.

Never expose the service-role / secret key in a public runtime config.
