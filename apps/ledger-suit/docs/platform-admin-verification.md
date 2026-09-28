# LS-ADMIN-001 — Secure operator foundation

Implements ADM-01–04 under approved LS-D-ADMIN. Local changes only, based on `8329b33867c6ab06b4727120bec852d49e6dd7cf` on `codex/ledger-suit/ls-admin-001`. No commit, push, merge, deployment or hosted database changes. Live upstream/PR state could not be verified by preflight; no publication/base decisions were made.

## Authority and scope

`app.platform_operators` binds an explicit Ledger Auth user to `observer` or `billing_operator`, with immediate enable/disable checks on each request. The private table cannot be changed through client or service-role APIs. Operator accounts must have **no tenant memberships**, including suspended memberships. Tenant owner/admin/accountant roles, capabilities, user-editable metadata and service keys do not grant operator access. Existing LS-BILL-002 allowlisted identities migrate to billing operators; the old allowlist is retired. Mixed tenant/operator identities fail closed and require separately authorized provisioning of a dedicated identity.

| Identity | Global summaries/audit/receipt inspection | Payment review |
| --- | --- | --- |
| Anonymous | Denied by execute grants / JWT verification | Denied |
| Tenant owner, admin, accountant or other member | Denied | Denied |
| Disabled operator or mixed tenant/operator identity | Denied | Denied, including replay |
| Dedicated observer | Allowed and audited | Denied and audited |
| Dedicated billing operator | Allowed and audited | Bounded, reasoned and audited |
| Service-role API | No operator RPC grant | No operator RPC grant |

The foundation exposes payment review only. No raw-table editor, SQL execution, user impersonation, arbitrary subscription rewriting or new suspension workflow is introduced. Subscription dates, quoted price/plan, provider conflicts and accounting semantics remain owned by the existing LS-BILL-002 implementation, moved intact to a private function.

## Read and command contracts

`platform_admin_read(resource, offset, limit, target_id)` uses explicit projections for profiles, organizations, subscriptions, manual payments, current receipt metadata, audit and database operational counts. Each call records actor, operator role, resource, target, pagination and outcome. Pages are limited to 100 rows (UI: 50). UUID targets have resource-specific meaning: subscription targets are organization IDs, payment/evidence targets are payment IDs; audit targets match recorded target IDs. Receipt inspection requires a payment ID. Support returns an empty list and operational status explicitly reports `support_available=false`: Ledger currently has no support-request store.

Profiles expose contact/name/reference/creation date; organizations expose reference/name/status/creation date. Reads never include Auth credentials, user metadata, ledger transactions, tax identifiers, webhook bodies or raw financial history. Operational status is a database snapshot of pending payments and billing-event counts, not a claim of external provider health. Audit pagination orders newest first; inserts between offset pages can shift page boundaries.

`platform_admin_review_payment(command_id, request_id, evidence_id, action, reason, context)` accepts only `under_review`, `approved` and `rejected`. The reason is customer-visible; context is internal. Both must be nonblank, at most 1,000 characters. Authorization precedes target lookup and replay. Request and subscription snapshots are taken under the original organization/request/subscription lock order. Successful calls, domain rejections, validation/authorization denials and replays append to `app.platform_operator_audit`; before/after state is populated only after authorized target lookup. The audit table denies API access and rejects UPDATE/DELETE/TRUNCATE, including privileged accidental DML. Database superusers remain infrastructure administrators.

RPC outcomes use `{ok, data?, error?, audit_id}`. **Do not treat HTTP 200 as success without checking `ok`.** Rejections return envelopes rather than raising an exception that would roll back their audit evidence. Malformed RPC signatures/types, anonymous execute denials and transport failures are rejected before these functions run and remain provider/access-log concerns. These are not accepted commands. Runtime SQL failures return sanitized codes; command changes roll back before the rejection audit is appended.

The actor-scoped command UUID and exact payload identify a successful command. An advisory transaction lock and unique success index serialize retries; identical successful retries return the recorded result and append replay evidence. Changed payloads with the same UUID are rejected. Domain failures may be retried; they never grant periods. The underlying payment state machine independently prevents another period even after a page refresh creates a new command UUID.

Receipt table/Storage operator policies are removed. `platform-admin-receipt` verifies the caller, invokes the audited read with the caller's JWT, and only then signs the database-selected receipt for 60 seconds using server-only credentials. The request accepts only an exact payment UUID, bounded to 2 KiB; caller-provided object paths/actors are rejected. Responses disable caching. A signed URL remains usable until expiry; clients clear it on session change, dialog close and expiry. Never retain these URLs in shared logs.

## UI and setup

Open `/platform-admin`; unauthenticated visitors return through `/login?operator=1`. This fixed destination bypasses tenant onboarding/billing redirects but grants no backend authority. The shared app shell, table, dialog, confirmation, settings and canonical themes support English/Arabic and RTL. Observers can inspect receipts but see no decision form. Session changes and disposal clear rows, role, draft, receipt link and pending responses. Reads are component-local, with no persistent cross-user cache.

For a separately authorized environment setup, verify the Ledger project against `docs/architecture/environments.json`, apply the forward migration, and deploy the JWT-protected receipt function using the maintained runbook. Provision dedicated verified Auth users through supported provider interfaces. A trusted database administrator may insert/update `app.platform_operators` with an approved role and enable flag; record that infrastructure provisioning and its reason in the environment change record. Never provision through user metadata or a tenant account. There is no browser provisioning endpoint. Existing payment CLI callers must migrate with the database because `public.review_manual_payment` is retired; the checked-in CLI uses the new envelope and stable command UUID.

Recovery is a reviewed forward migration or disabling affected operator identities. Do not restore old unaudited policies, drop audit evidence, or remove purchased subscription periods to work around failures.

## Verification and acceptance evidence

- ADM-01: explicit role/identity matrix; SQL suite denies 240 combinations across global resources, both tenants, unknown targets, tenant roles, forged metadata and disabled operators. Tests also cover mixed identities, replay after revocation, RPC grants and private implementation access.
- ADM-02: actor/context and before/after assertions; persisted denial/replay evidence; audit UPDATE/DELETE/TRUNCATE denial; browser treats rejected envelopes as failures.
- ADM-03: fixed global projections, bounded pagination, missing-support state, operational counts and audited current-receipt reads. Financial tables retain tenant RLS.
- ADM-04: validated reason/context, stale evidence and invalid-state rejection, cross-target command-key reuse denial; original billing semantic coverage retained: 41 manual-payment assertions (including the new direct-read denial) and 26 Paymob assertions. Real concurrency runner updated to assert one successful command and two replay events.

Safe local commands:

```sh
node apps/ledger-suit/scripts/test-manual-payment-embedded.mjs --generate-admin-contract
node --test apps/ledger-suit/tests/unit/*.test.mjs
deno test --no-config --no-lock apps/ledger-suit/supabase/functions/_shared/platform-admin_test.ts
deno check --no-config --no-lock apps/ledger-suit/supabase/functions/platform-admin-receipt/index.ts apps/ledger-suit/scripts/review-manual-payment.ts
pnpm --filter @building-suit/ledger-suit typecheck
pnpm --filter @building-suit/ledger-suit build
pnpm --filter @building-suit/ledger-suit exec playwright test -c playwright.admin.config.ts
pnpm check
git diff --check
```

The embedded runner uses the isolated optional PGlite dependency described in [manual payment verification](manual-payment-verification.md). It applies the entire migration chain and regenerates the RPC contract from the PostgreSQL catalog. Provider schemas are shims, not real Supabase services. The browser suite mocks Auth/RPC transport and cannot prove backend security.

Actual results:

- Preflight failed internally with exit 255; current branch has no configured upstream. Local worktree was initially clean. Live GitHub/base state is unverified.
- Dependencies installed from the existing offline cache with a writable temporary pnpm registry; no workspace manifest/lock changes.
- Full migrated embedded PostgreSQL: 41 manual-payment, 26 Paymob and 56 operator assertions passed. The operator matrix additionally performs and audits 240 denials inside one assertion. RPC types regenerated from that catalog.
- Four Deno tests passed for exact receipt selectors, bounded requests, deny-before-sign and no-store responses. Deno type checks passed for the endpoint and migrated operator CLI.
- All 30 Ledger unit test files passed; the new composable file's four behavioral cases also passed directly (account switch, revocation, rejected command, disposal).
- Ledger typecheck and production build passed; expected warnings identify the absent local Supabase URL/key. Changed-file ESLint passed. The first typecheck caught a recursive Vue ref type, fixed with shallow refs; the existing JWT endpoint allowlist test was updated for the new endpoint and now passes.
- `pnpm check`, generated-contract verification, locale parsing, secret-identifier inspection of browser source and built JavaScript, and `git diff --check` passed.
- The three browser cases are discovered by Playwright but execution is **blocked**: the preview server cannot bind `127.0.0.1:4330` (`listen EPERM`) in this sandbox. Browser rendering, keyboard/focus, Arabic/mobile/theme and end-to-end acceptance are not claimed as passing.
- Supabase CLI migration creation was blocked by a read-only home telemetry file. The new forward migration was authored locally and applied successfully with the complete chain in embedded PostgreSQL. Historical migrations are unchanged.
- Docker API access is denied. Real Supabase Auth/Storage, deployed RLS/provider behavior and the two-session concurrency runner remain unverified. No local reset or hosted operation was attempted.

Independent verification should run the provided browser suite in a bind-capable environment, then the SQL suites and updated concurrency runner against an explicitly disposable local Ledger Supabase instance, including real receipt signing/download and revocation/expiry. These remaining checks are acceptance limitations, not passing results.
