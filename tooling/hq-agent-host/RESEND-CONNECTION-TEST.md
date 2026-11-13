# Resend connection test (Part 3)

Scope: one immutable founder-approved plain-text test email, attributed to Dina
(`AG-EMAIL-002`) under Youssef (`AG-EMAIL-001`). This is provider connection
qualification, **not** an autonomous email skill, campaign, customer workflow,
CRM, contact import or permission for later messages. Existing drafting skills,
queue, qualifications and all other workers remain unchanged.

## Boundaries and UI

Dina's existing HQ details contain the connection status, recipient/subject/body
form, exact preview, and separate approve/revoke actions. Recipient starts empty.
The server binds `Shop Suit Team <hello@shop.building-suit.com>`. Preview and
approval use existing live founder Auth/same-origin checks. The private RPC
validates the current Dina/Youssef registry relationship. Neither ordinary draft
approval, model text nor a Brain note is send consent.

Approval expires 30 minutes after preview creation. Host reservation atomically
consumes it. Revocation works until reservation; it cannot recall an in-flight
request. State is never inferred from UI animation. `accepted` means Resend
accepted the API request; it does not prove inbox delivery. Reload can recover a
known test ID. No background polling or general model sending grant exists. Approval wakes the existing Oracle drain for only that exact test.

## Deployment and host activation

Deploy both forward migrations and the reviewed signed worker release using the
existing `stg` pipeline. Do not apply SQL ad hoc or change host security settings.
The compatibility migration preserves old admitted worker/module pairs and adds
only the exact reviewed new worker bytes; release-preflight still checks them.

After separate credential authorization, the operator supplies these to the
existing **Oracle host**, never source, models, browser, test payload or logs:

- `HQ_RESEND_TEST_ENABLED=1` (default off)
- `HQ_RESEND_SENDING_KEY`: domain-restricted `sending_access` key
- `HQ_RESEND_DOMAIN_ID=71ee7c87-8936-4699-bfbe-ea13309ed389`
- `HQ_RESEND_KEY_PERMISSION=sending_access`

The configuration declaration is not remote proof of the credential's scope.
Verify scope when creating/installing the key; do not substitute `full_access`
or reuse unrelated SMTP/Auth keys. No key was created by this implementation.

Using the existing protected host environment and node executable, the existing event-driven drain records a 15-minute configuration observation.
`worker.mjs --email-readiness` can also refresh this explicitly.
After the founder approves an exact preview, the existing worker wake/drain
executes it automatically after current jobs settle, subject to the existing
admission/maintenance gate. No Arch computer, second process, timer or model is
needed. There is no operator CLI send bypass. Database reservation and the host drain
both obey the existing worker admission pause. It uses
existing worker Auth; a founder token cannot reserve or finish, and another
worker identity cannot take the reservation. Host execution consumes only the approved test ledger, **not arbitrary Dina
task/model content**. Missing key or test-send uncertainty does not pause ordinary
employees; it blocks only the test-send path. Do not describe the
runtime as connected/tested until the approved real test returns a durable receipt.

The API route is official `POST https://api.resend.com/emails`, with redirects
forbidden, 10-second timeout, bounded response and fixed sender. A broad Resend
MCP account-admin connection would grant unnecessary permissions, so this
prerequisite uses a narrow official HTTPS adapter instead. No MCP is exposed to
the model merely to execute a predetermined approved test.

## One-send and uncertainty

Database reservation commits **before** the network call. Request ID and framed
UTF-8 message digest are immutable; payload changes fail. Idempotency key is
`hq-email-test/<uuid>`. At most five reserved test attempts per 24 hours are
allowed by this path. This is a conservative local test allowance, not evidence
about other clients' account quota; only an actual free Resend plan may be used.

A duplicate reservation is never reclaimable, even after Resend's deduplication
retention ends. A crash, timeout, ambiguous HTTP response, invalid response or
unpersisted receipt leaves `reserved`/`uncertain`; it blocks further test sends.
No automatic resend, lease expiry reclaim or silent new message identity exists.
Reconciliation requires a separately authorized operator check with the provider;
there is deliberately no UI reset or retry-send function. Receipt persistence is
idempotent for the same worker/token/outcome. Do not infer provider delivery from
an API acceptance. Provider diagnostics and credentials never enter task output.

## Evidence and activation blockers

Source/local tests only. PGlite checks execute the real migration with existing
founder/worker Auth fixture; transport is fake, no internet send. Tests cover
permission separation, expired/revoked approvals, exact-message tampering,
duplicate/conflicting requests, disabled employee, durable uncertain outcome,
readiness expiry, bounded responses and admitted source hashes. PGlite is not a
native multi-session race test. Native PostgreSQL/full migration/type generation,
real-browser acceptance, independent review and deployment are still required.

No real recipient is approved and no domain key installed by this task. The
successful connection test does not qualify general Dina sending or start Parts
4–6. Existing research/drafting continues independently of this test adapter.

### Local checkpoint, 13 November 2026

- 60 focused tests passed: 10 Resend adapter/real-migration PGlite tests, 6
  composable/projection tests, 3 migration-parity tests, existing worker and
  employee-concurrency checks.
- HQ `vue-tsc` passed after Nuxt type preparation using already installed
  dependencies; no package versions changed or network installs performed.
- Strict UI ownership boundary passed (175 Suit Vue files, zero violations).
- Release provenance check and `git diff --check` passed.
- Independent security review found a diagnostic-CLI admission bypass during
  development. The CLI send path was removed; reservation now takes the existing
  queue lock and enforces the database admission pause. Regression test passes.
- No credentials created/installed, provider requests sent, hosted state changed,
  native multi-session proof or generated database-type refresh claimed.
- The isolated actual-component browser fixture is prepared at
  `apps/company-hq/tests/browser/email-connection-component.mjs`. Chromium startup
  failed with `socket() failed: Operation not permitted` before any page or
  assertion ran. This is **not** browser acceptance; no sandbox change or install
  was attempted.
