# SS-WEB-SLUG-001 — website address foundation

Canonical public URL: `https://{slug}.shops.building-suit.com`. The owner/staff application retains its separate configured HTTPS `APP_URL` (currently `https://shop.building-suit.com` in production). A Shop display-name edit does not change its address.

## Contract and ownership

`shop_websites` stores the current address independently of `shops.name`. `shop_website_slug_claims` is the permanent, shared canonical/alias namespace. Slugs contain 3–50 lowercase ASCII letters/digits with single interior hyphens. Leading/trailing/repeated hyphens, mixed scripts, Unicode, punycode and reserved infrastructure/account names are rejected. SQL is authoritative; `shared/websiteAddress.ts` mirrors validation for the editor. A unique lowercase index and primary key arbitrate concurrent claims. The Shop row lock serializes renames; a composite foreign key requires the current slug to belong to the same Shop. Claims cannot be reassigned or deleted, including after suspension/archive. Returning to one's own previous address is allowed. Every other previous address resolves to that Shop's current canonical address.

Suggestions use readable ASCII words when unambiguous; other names get `shop-` plus 128 bits from `crypto.randomUUID()`. Suggestions are only editable drafts; saving performs the atomic claim and reports a collision without overwriting another Shop. Reservations start on explicit save, not merely opening the editor. Existing Shops receive no automatic address or backfill. Address changes are independent of profile, payment, invoice and receipt snapshots.

The private `/settings` route passes a typed projection to `BsBusinessSettingsPage` / `BsWebsiteAddressSettings` in `packages/ui`. `useRecordAction` in `packages/ux` owns modal, pending and dirty-state behavior. Shop owns content, permission, generation, validation and RPC adapters. Reads require an authenticated active settings manager; writes retain existing active membership/Shop/subscription and `settings.manage` checks. No client has direct table privileges. RLS is enabled, and all privileged functions fix an empty search path. The sanitized public resolver returns only a canonical slug and alias flag for an active, published Shop; it exposes no Shop ID, name, contacts or membership.

## Host boundary and publication

The Nitro request hook inspects only the HTTP `Host` authority before application routes/static serving. It ignores `Forwarded`, `X-Forwarded-Host` and client tenant IDs. Exact configured private origin and loopback health/test authorities are private; one valid label under `shops.building-suit.com` is a website; all other authorities fail closed. Public host parsing normalizes DNS case but never accepts ports, trailing dots, nested labels, credentials, comma lists or encoded hostnames. This prevents forwarded headers from selecting a Shop or opening private routes.

Website/unknown hosts receive the same plain `404 Not Found`, `private, no-store` and `noindex, nofollow`, without sessions, private SSR, APIs or tenant data. Resolver errors also fail closed. Only GET/HEAD requests to a published alias may receive a 308 to a validated canonical slug on the fixed HTTPS domain; paths, queries and arbitrary URLs are never reflected. Canonical public rendering is deliberately unavailable. No publishing RPC, table-write grant or customer publication is introduced. The `published` state exists only for future reviewed work and synthetic tests. Profile/catalog/public rendering, booking, reminders and commerce remain later tasks.

## External prerequisites — documentation only

No DNS, Vercel, secrets, Supabase configuration or hosted database changes were performed. Before later public launch, the owning operator must:

1. Bind `*.shops.building-suit.com` to the reviewed public-host deployment/environment, with the correct wildcard DNS target supplied by Vercel. The bare `shops.building-suit.com` is not a tenant. Keep owner/staff origin and environment bindings separate; never replace private `APP_URL` with a wildcard or a customer URL.
2. Arrange wildcard TLS issuance/renewal. Vercel supports its nameservers or DNS challenge delegation when retaining external DNS. For this nested wildcard, review delegation for `_acme-challenge.shops.building-suit.com`; preserve unrelated records. Follow the current [Vercel wildcard-domain instructions](https://vercel.com/docs/domains/working-with-domains/add-a-domain#using-wildcard-domain).
3. Verify ingress preserves the actual authority and strips/replaces untrusted forwarding headers. Do not add a forwarded-host fallback without a separately verified proxy trust contract. Retain host-only private Auth cookies and separate callback allowlists; do not broaden cookie domains to customer subdomains.
4. Verify the deployed Vercel routing order. A provider CDN can serve static assets before Nitro; this local request hook cannot enforce provider-side static routing. The future public deployment/ingress must send wildcard requests through its public host boundary and must not expose private app routes or tenant-specific cached/static payloads. Do not attach the wildcard as a launch shortcut in this foundation task.
5. Apply the forward Shop migration through normal GitHub CI after reviewed merge to `stg`; production follows `main` under the existing release process. No manual `db push`, SQL application to hosted projects or manual deployment is authorized here. Verify the exact deployment/migration SHA and host isolation before publication becomes available.

## Verification

- `node --test apps/shop-suit/tests/unit/website-address.test.mjs`
- `node tooling/database/test-shop-website-slug-local.mjs` against the fixed disposable local Supabase container. SQL fixtures roll back; the real collision race retains only synthetic records in that disposable backend. The runner accepts no hosted URL or credential.
- `pnpm --filter @building-suit/shop-suit build`, then `node --test apps/shop-suit/tests/integration/website-host-built.test.mjs`. HTTP tests use only synthetic loopback RPCs, actual Host headers and the built server.
- `pnpm exec playwright test -c apps/shop-suit/tests/e2e/website-address.config.ts`: bilingual/light/dark, mobile/desktop, editable fallback, invalid input, save, alias display, denial, read retry and collision recovery. Optional `WEBSITE_TEST_CHROMIUM` selects an available local browser; CI installs the pinned Playwright browser.
- `pnpm check`, Shop typecheck, changed app/shared lint and release fragment validation.

The task's dedicated GitHub workflow starts a disposable Supabase backend, runs the SQL/race tests, builds Shop and runs HTTP/browser regressions. It does not deploy. See the task evidence record for actual results and environment limitations.
