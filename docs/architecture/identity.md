# Independent product authentication

Each Ledger, Shop or Inventory production/staging project has its own Supabase Auth users, identities, credentials, sessions, recovery configuration and callback allowlist. Inventory's hosted projects remain unprovisioned. A login in one product does not authenticate the user to another product. Matching email addresses or UUIDs do not imply a shared identity.

Single Auth as a global source of truth is explicitly deferred. Do not add a central identity app, cross-product account merging, session handoff or shared parent-domain cookie while implementing ordinary features. Shared `packages/auth` helpers and shared login/signup presentation provide reusable mechanics only.

Ledger links `public.profiles.id` to that project's `auth.users.id`. Shop retains a separate `public.profiles.id` with `user_id` and `portal_id`. Preserve these product contracts and membership/entitlement checks. User-editable metadata may carry onboarding drafts; it must not authorize ownership, membership, subscription access or trusted portal identity.

Session cookies use `bs-ledger-<environment>-auth-token`, `bs-shop-<environment>-auth-token` and `bs-inventory-<environment>-auth-token`. Set `APP_ENV` and the matching runtime cookie prefix per deployment. Keep cookies host-only. Account/tenant changes clear that application's sensitive state and listeners. Redirects remain same-origin relative paths; tokens do not belong in URLs.

For Shop's move to its own project, migrate only the Auth identities referenced by Shop and their dependent records using a reviewed provider-supported procedure. Preserve user/profile IDs and password/identity associations; do not merge Ledger identities. Existing sessions need fresh authentication against the destination. Staging uses synthetic or appropriately sanitized data, never production session tokens.
