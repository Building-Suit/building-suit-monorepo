# Contact request notifications

SS-LAUNCH-R05 / R06, decision SS-LAUNCH-D03. The browser continues to call
`submit_support_request`. That transaction validates consent, honeypot, trusted
identity and rate limits, then inserts immutable request content and one unique
`new_request` outbox row. No network delivery occurs inside that transaction.
The success message means the request was stored; notification failure cannot
change that response.

## Sender operation

`supabase/functions/shop-support-sender` is an Edge worker. POST invokes a batch
of up to five committed rows. It authenticates a dedicated server-only bearer
token, not a browser Supabase JWT. The worker has no public CORS interface and
returns only a processed count or a stable error code. Provider bodies, customer
content and credentials are not logged or returned.

Server/Edge secrets (never Nuxt public runtime configuration):

| Setting | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Resend key permitting send and retrieve-email operations for the verified sender domain |
| `SHOP_SUPPORT_FROM` | Verified plain email address at `building-suit.com`, e.g. `shop@building-suit.com` |
| `SHOP_SUPPORT_WORKER_TOKEN` | Random environment-specific secret of at least 32 characters, shared only with the scheduler |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Edge runtime's own Shop project URL and privileged key |

An authorized release operator must apply the forward migration, deploy the
worker to the verified Shop environment, set the secrets using the supported
provider secret manager and configure a server scheduler to POST to that
environment's `/functions/v1/shop-support-sender` once per minute with
`Authorization: Bearer <SHOP_SUPPORT_WORKER_TOKEN>`. Keep the scheduler's token in
its secret manager. Do not use the browser or include secrets in URLs, logs,
repository files or screenshots. Scale the schedule/batches to observed queue
volume and Resend limits. These are release prerequisites; this task did not
deploy, set hosted secrets, configure a scheduler or send a real email.

The notification recipient is fixed to `support@building-suit.com`. Reply-To uses
the persisted requester identity. HTML escapes customer content and includes
`https://shop.building-suit.com/brand/shop-suit-email-mark.png`, the existing
canonical public PNG owned by `packages/brand`. Public fetching of that URL and
sender-domain verification must be confirmed on the release deployment.

## State and recovery

Only service-role RPCs can claim, freeze or finish notifications. Direct table
access remains revoked for browser and service roles. `SKIP LOCKED` claims use a
two-minute lease and unique fencing token; stale workers cannot update state.
Each HTTP request times out after 15 seconds. The exact payload is committed
before POSTing to Resend and reused after configuration/template changes.

Every send uses `shop-support/<outbox UUID>` as its stable idempotency key.
[Resend retains keys for 24 hours](https://resend.com/changelog/idempotency-keys).
Temporary failures use bounded exponential backoff (60 seconds initially,
maximum 30 minutes). Failed or abandoned attempts recover under the same key
and payload. Automatic retries stop after 12 attempts or 23 hours from the first
claim, entering `review_required`. Never reset the timestamp, key or frozen
payload to retry an uncertain send after that deadline: reconcile the original
provider outcome with an authorized operator first. This intentionally favors
duplicate prevention over blind retries outside the provider's guarantee.

`sent` means Resend accepted the email and its ID and `sent_at` are recorded.
`sent` rows are polled, never sent again. The worker uses
[Resend retrieve-email](https://resend.com/docs/api-reference/emails/retrieve-email)
to observe delivery: delivered/opened/clicked become `delivered`; bounced/failed
become terminal `bounced`. `delivered_at` is the time delivery was observed, not
an asserted provider event timestamp. Poll failures preserve `sent` and retry
after five minutes. `failed_at` and sanitized `last_error` record failure without
discarding the accepted request. Permanent send errors enter `review_required`.
No automatic resend follows a bounce.

Monitor counts and oldest age of `not_configured`, `sending`, `failed`, `sent`,
`bounced` and `review_required` using an authorized database/operator connection.
Investigate an old lease, growing queue, unavailable configuration, poll failures
or review-required rows. Preserve request content and provider receipts during
reconciliation. Reminder notifications remain outside this new-request worker.

## Verification and handoff

Task-owned executables:

```sh
node --test apps/shop-suit/tests/unit/ss-launch-support-001-1.test.mjs
node --test apps/shop-suit/tests/unit/ss-launch-support-001-2.test.mjs
# From apps/shop-suit, with its disposable local Supabase running:
pnpm exec supabase test db --local supabase/tests/ss-launch-support-001-1.test.sql
# From the workspace root:
pnpm exec turbo run typecheck lint build --filter=@building-suit/shop-suit
pnpm exec playwright test --config apps/shop-suit/tests/e2e/ss-launch-support-001-3.config.ts --workers=1 --retries=0
pnpm db:test:shop
```

The focused database test rolls fixtures back and exercises intake durability,
privileges, immutable content, consent/honeypot/rate limits, claims, fencing,
payload freezing, backoff, receipt/delivery transitions and retry-window expiry.
The browser suite covers EN/AR, desktop/mobile, light/dark, form spacing,
pending/validation/success/rate/error states and a notification-unavailable
response. It writes representative full-page screenshots to ignored test results.
Use synthetic/mocked Resend configuration for local checks.

Local verification in the implementation sandbox:

- Both exact unit commands passed; 18 behavioral/security tests also passed
  with `node --test --test-isolation=none --test-reporter=spec` over those files.
- The full Shop unit glob passed (33 test files); `deno check` passed for the Edge entry point.
- Shop typecheck/lint/build passed. Existing Vue attribute-order warnings remain.
- Focused SQL command and local type generation could not run: the Supabase CLI
  attempted telemetry writes under a read-only home directory.
- Full `pnpm db:test:shop` failed before tests: Docker socket access was denied.
- Exact Playwright command failed before tests: the local server could not bind
  `127.0.0.1:4327` (`EPERM`). Rendered EN/AR/mobile/theme acceptance is unverified.
- `pnpm agent:preflight` failed to verify GitHub/fetch state. No commit, push,
  merge, deployment, hosted database change or production secret mutation occurred.

Database and rendered browser acceptance remain blocked until the exact checks
run successfully in an environment with local Docker and loopback binding.
Hosted delivery is unverified pending the separately authorized release setup.
