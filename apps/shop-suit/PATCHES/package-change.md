# EDIT — dependency setup

From the repository root run:

```bash
pnpm --filter @buildingsuit/shop-crm add @nuxtjs/supabase@^1.4.6
```

Do **not** uninstall `@buildingsuit/api-layer` in Batch 01.

The rebuilt Login and Signup pages use Supabase directly. The legacy package remains temporarily
only because untouched server routes and the landing pricing query still import it. We remove it
after those consumers are replaced, so the branch stays buildable throughout the rebuild.
