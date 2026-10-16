# Appointment email reminders

Delivery is **disabled by default**. This task installs no scheduler, provider configuration, keys, DNS changes, hosted migration or customer enrollment. It does not send emails. The worker supports only `SHOP_REMINDER_DELIVERY_MODE=test` with an explicit recipient allowlist. A `live` value fails closed. General customer delivery needs a separately approved change and configuration review.

## Consent and eligibility

An active Shop owner with `settings.manage` and write access explicitly enables email reminders in the existing booking policy. That does not enroll customers. A customer uses their existing short-lived, phone-verified customer access session to request one reminder for one upcoming booked appointment. Their active saved customer record must contain a syntactically valid email. Email addresses are not returned to the browser or public website. A phone verification proves the customer scope; it does **not** independently verify the email inbox. Operators must maintain accurate contact data; this feature never guesses or collects an arbitrary destination. Guests and appointments without an eligible saved customer email remain ineligible.

Consent records bind the appointment, tenant, customer, exact normalized email, locale and authorizing credential. A contact change/deactivation or customer reassignment withdraws prior consent. Rescheduling retains consent for the same customer/contact and queues the new future appointment time; the previous intent is cancelled. A changed appointment instant never reuses its old provider key. Repeated consent cannot create duplicate queue rows. A reminder that may already have been attempted can never be resurrected. A cancelled intent with zero provider attempts and no frozen payload can be requested again before its due time. A customer may opt out from appointment management; owners may disable the policy. Staff can cancel the appointment or correct the customer contact through their existing authorized commands.

The queue checks current Shop, published website, booking policy, location, appointment status/time, customer identity, contact, consent and allowlist when claiming and again under locks during prepare. Unpublishing/disabling/suspending prevents subsequent authorization. No automatic enrollment or backfill occurs; consent after the requested reminder time does not produce a catch-up email. The preferred lead time is elapsed minutes before the UTC appointment instant. The email formats that instant in the staff schedule's IANA timezone, with the timezone displayed; no server/browser-local timezone is used. Missing schedule timezone falls back explicitly to UTC.

## Delivery, races and budgets

Private outbox/consent/audit/budget tables have RLS and no direct grants to browser or service roles. Browser RPCs require the existing current tenant/customer capability. Owner policy writes retain owner, permission, subscription checks and private audit events. Worker RPCs are service-role only. Old wrapped functions are revoked from browser roles.

Workers claim one committed row using tenant-first locks, `SKIP LOCKED`, a two-minute lease and random fence. `prepare_appointment_email` rechecks authorization after lock waits, freezes the exact provider payload and consumes the allowance before HTTP. A claim is not permission to send. Tests race cancellation, reschedule and contact changes between claim and prepare. The prepare commit is the authorization point: a cancellation after it cannot recall an already in-flight HTTP request. It cancels all retries; a matching late provider acceptance receipt is retained without reviving the queue.

Provider POSTs use `shop-appointment/<outbox UUID>` as a stable Resend idempotency key. Unknown HTTP outcomes and retryable 409/429/5xx responses reuse the frozen payload and key. Other rejection statuses stop for review. There are at most five provider attempts, exponential backoff (2, 4, 8, 16, 32 minutes), no retry at/after 23 hours from first attempt, and no attempt after appointment start. These bounds stay inside Resend's documented 24-hour idempotency window. A successful response means **accepted**, not delivered. No bounce automatically resends. Provider response bodies, credentials and message content are never logged or returned.

SQL serializes shared reminder budgets across workers/tenants: 80 provider attempts per UTC day, 2,400 per UTC month, 10 per tenant per UTC day and at most one authorization per second. Retries count too. There is no paid fallback, purchase or automatic quota increase. These are reminder allocations below the documented Resend Free limits (100/day, 3,000/month), **not a claim that other Auth/support mail has been counted**. Before activation the operator must review total shared-account usage and reserve adequate headroom for Auth/support. Provider throttles defer bounded retries; exhausted allowances keep the item deferred until eligible/expired. The queue requires operational monitoring of age, review-required states and provider receipts before broader activation.

## Activation configuration (names and destinations only)

No values are supplied or changed by this task.

| Key | Destination / purpose |
| --- | --- |
| `SHOP_REMINDER_DELIVERY_MODE` | Shop Supabase Edge secret; absent/`disabled` refuses sending, only `test` accepted |
| `SHOP_REMINDER_TEST_ALLOWLIST` | Same Edge environment; comma-separated exact approved test email addresses, maximum 20, no wildcard |
| `SHOP_REMINDER_WORKER_TOKEN` | Same Edge environment and approved scheduler's secret store; dedicated random token, minimum 32 characters |
| `SHOP_REMINDER_FROM` | Same Edge environment; approved verified `@building-suit.com` sender mailbox; no guessed mailbox |
| `RESEND_API_KEY` | Same Edge environment; existing Resend integration, authorized sender scope; never public Nuxt configuration |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Shop project Edge-provided server environment; separate staging/production projects |

`POST <verified Shop project URL>/functions/v1/shop-appointment-reminder-sender` requires the platform-default JWT verification plus `Authorization: Bearer <Shop service-role JWT>` and `X-Shop-Reminder-Worker-Token: <dedicated token>`. No `verify_jwt=false` configuration is added. This endpoint is server-only and has no browser CORS flow. One invocation handles at most one reminder, with 10-second provider and 15-second RPC timeouts.

Follow the existing Supabase scheduling architecture: an approved `pg_cron` job calls the Edge endpoint through `pg_net`, with endpoint/JWT/worker token read from Vault rather than SQL literals. The task deliberately does not create extensions, secrets or an enabled cron job. After configuration approval, CI must install the separately reviewed environment-bound schedule/migration; start with a once-per-minute schedule for the test allowlist (at most 44,640 invocations in a 31-day month, below the documented Free Edge allowance). Verify extension availability and aggregate project usage first. Do not schedule this through a personal machine, n8n or a second service. Pause the schedule and remove/disable delivery mode to stop new dispatch; terminal receipts and configuration remain retained.

Official references: [scheduled Edge functions](https://supabase.com/docs/guides/functions/schedule-functions), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [usage limits](https://resend.com/docs/api-reference/rate-limit), [Resend pricing](https://resend.com/pricing), [Supabase pricing](https://supabase.com/pricing).

## Verification

- `node --test apps/shop-suit/tests/unit/appointment-email-reminders.test.mjs`: mocked provider only; authorization/configuration, allowlists, EN/AR privacy, Cairo DST, retry payload/key, uncertain outcomes, stale completion.
- `node tooling/database/test-shop-appointment-email-local.mjs`: accepts only the two maintained disposable container names. Synthetic fixtures and real parallel SQL connections test isolation, consent/contact changes, cancellation, reschedule, worker leases, retry bounds and cross-tenant global budget contention. The runner resets only task-owned synthetic budget records; never use a hosted database.
- `.github/workflows/shop-appointment-email-disposable.yml`: full app migration replay, SQL races, mocks and owner/customer browser workflows on GitHub-hosted infrastructure.
