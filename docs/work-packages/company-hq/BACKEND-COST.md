# Dedicated HQ backend: cost and scope

Budget remains $0. No new provider project, paid model, hosted migration or deployment was performed for the return to the monorepo.

The Node runtime has a no-additional-service path for development: its own private SQLite database, explicit founder password hash, independent fixed-role bridge token hashes and same-origin HttpOnly sessions. It requires Node 24.15+ or 26+, since Node 22 lacks the required `node:sqlite` runtime. Tests use disposable storage and synthetic credentials.

Hosted configuration supports only the founder-selected refs: staging `lwecnmsosfwovlzxauml`, production `dfeiuxsqhgzontefmrjc`. Their verified environment-map refs are blank; requested refs are recorded separately. Authorized Supabase project reads denied access to both refs. Existing monorepo evidence maps the requested staging ref to Super Admin. The visible Automation Free organization does not prove either HQ project’s plan, capacity, ownership or permission.

Before activation, verify actual project access and dedicated HQ ownership, resolve the staging scope conflict, verify current free plan/quota/persistent storage/hosting/TLS and model allowance, and use separate environment credentials. Only then set `HQ_BACKEND_SCOPE_VERIFIED` and `HQ_HOSTING_COST_VERIFIED` to true. Runtime fails closed until all required configuration matches. Service/secret keys stay server-side; anonymous/authenticated clients cannot read tables or call HQ RPCs. The migration has been exercised against disposable PostgreSQL, not either hosted project.

MCP/HTTP bridge tools record real externally supplied CEO/HR actions. They do not provide a model, worker or subscription allowance. The earlier Codex CLI probe returned expired-auth 401; no automatic paid fallback is enabled. An operational CEO conversation still requires a verified authorized executor and hosted path.

Current Supabase API-key/RLS documentation and changelog were consulted on 3 November 2026 while preserving this design. Modern secret keys use the `apikey` header. The existing migration keeps RLS enabled, explicit service-only grants, invoker functions, atomic revision checks, hashed sessions and durable login attempt limits.
