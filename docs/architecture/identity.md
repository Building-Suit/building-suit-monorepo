# Identity and session architecture

Building Suit distinguishes one global Auth account from a portal profile, tenant membership and product permissions. The shared infrastructure contract in `packages/auth` represents those concepts separately; it does not grant domain access from the presence of a session.

Ledger currently links `public.profiles.id` directly to `auth.users.id`. Shop's current hosted profile has its own profile ID and `user_id` link, scoped by `portal_id`. Preserve these models behind app adapters; do not silently remap IDs, merge accounts by email, or change columns to make the models look identical.

The required destination has one Supabase Auth project per environment. Hosted identity consolidation and browser SSO are not implemented yet. Production/staging domains and verified destination project access are required to choose and test the session topology. One Supabase URL alone does not share browser storage across origins.

The current signup UI uses shared layout/wizard/countdown infrastructure. Each app retains its existing validation and authorized provisioning RPC. Shop additionally collects its required shop name and trial plan before verification and recovers nonsecret draft details. User metadata carries draft form values only; it must never authorize portal, membership, ownership or subscription access.

Post-auth redirects use same-origin relative paths. Never place access or refresh tokens in URLs. Session changes must clear tenant-sensitive cache/state and revoke application access according to server-authoritative memberships and entitlements.

The remaining cross-project identity checks and cutover steps are tracked in the migration runbook, not in permanent agent workflows.
