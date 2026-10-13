# Super Admin account activation checkpoint

Status: backend draft; the requested browser/provisioning journey is **not complete**.

Base: fresh `origin/stg` at `18dcf90f33335c06c74a2c9b98ce794b90991837`.
Branch: `codex/super-admin-suit/account-activation`. This is independent of the
Shop presentation stack. Changes touch only the SAS command helper/unit tests,
one new Shop forward migration, its SQL suite/runner and this task record.

## Prepared behavior

`activate_trial` is a distinct target-owned plan command. It uses the existing
operator/integration authorization, request lock, exact replay, Shop/owner
subscription lock, plan-term resolution, quota validation and append-only audit.
Its payload pins the selected subscription ID. It refuses a different subscription,
an inactive owner membership or a subscription that is already active/suspended.
Exact retries resolve the existing audit before checking the now-active state.

Activation takes effect immediately and ends after the selected plan's current
catalog interval. It preserves trial start/end and creates no payment submission,
payment approval or receipt. The action is explicitly operator initiated. Current
Shop trial policy is seven days; this change neither resets that policy nor rewrites
older deadlines. Prepared SQL fixtures test seven-day day-1/day-6 accounts.

The signed Shop manifest and invocation allowlist advertise the narrow action.
The SAS helper verifies SAS Auth/database authority and submits an immutable
`shop.plan.command` request through the existing enqueue RPC. Its result says
`queued`, never `active`; it is not exposed as a browser endpoint yet.

## Validation and release gates

- Passed: 15 SAS unit tests (including 5 new command/authority tests), 10 focused
  Shop billing/subscription unit tests, SAS typecheck/lint and workspace boundaries.
- Prepared, **unrun**: target SQL suite for day-1/day-6 activation, outsider denial,
  subscription mismatch, exact/changed replay, active overwrite rejection, selected
  plan/dates, unchanged trial history, exactly-one audit and no payment records.
- Local Supabase startup failed unpacking Postgres with
  `failed to register layer: no space left on device`. Automatic retry was stopped;
  zero database containers started and no migrations/SQL were executed. No hosted
  fallback is permitted. Docker daemon storage differs from workspace free space.
- New migration was created by the pinned CLI inside a disposable Debian container,
  because the host CLI could not create its config under read-only `/home/agent`.
- GitHub CLI here lacks `--slurp`. A task-owned temporary compatibility wrapper
  let the maintained preflight run without changing repository tooling.

Do not treat this draft as a finished feature in consolidation. Run the required
Shop SQL suite and signed bridge regression/conformance tests against a disposable
database, regenerate affected types from that database, and verify final CI first.
Publish the target migration before enabling this action in a provisioned manifest.
SAS configuration, signing keys and target bindings remain separately provisioned
data; this task changes none of them. No customers were activated or invited.

## Remaining requested work

1. Add the database-configured SAS account/plan selection module using shared UI,
   signed target projections and a server dispatcher. Show account identity, plan,
   effective dates, preserved trial history and explicit manual grant/payment state.
   Keep one request ID on ambiguous retry and show activation only after a verified
   target result. Existing SAS browser code currently contains only Auth/bootstrap.
2. Add target-owned account provisioning by email, tenant/shop ownership creation
   and secure owner invitation/claim. The current signed Shop adapter has no such
   capability. Define a separately audited, idempotent provisioning state machine;
   it must reconcile Auth creation with domain writes/invitation failures, fail
   closed on pre-existing identities, and never infer ownership from matching email.
   Invitations and email verification remain separate from plan access; development
   must send no real invitations. No source-owned passwords/auto-confirmation.
3. Run browser and real disposable Auth/adapter acceptance checks. Record blocked
   provider/deployment prerequisites honestly; no hosted migrations or secrets were
   authorized in this task.

The pending browser/provisioning scope can continue on this same open feature PR.
