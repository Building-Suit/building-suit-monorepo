# Supabase Auth URL configuration

The direct password-recovery flow redirects to:

```text
/auth/reset-password
```

In Supabase Dashboard:

1. Authentication
2. URL Configuration
3. Set Site URL to the production Shop Suit origin.
4. Add the redirect URLs you actually use, for example:

```text
http://localhost:3000/**
https://YOUR-SHOP-SUIT-DOMAIN/**
https://*.vercel.app/**
```

The recovery email must be allowed to return to:

```text
https://YOUR-SHOP-SUIT-DOMAIN/auth/reset-password
```
