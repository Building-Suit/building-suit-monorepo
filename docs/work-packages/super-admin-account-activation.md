# Super Admin account activation checkpoint

Status: existing-account browser/dispatcher code implemented; real database validation
and new-account provisioning/invitation remain **incomplete**.

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
`queued`, never `active`; the follow-on workflow now exposes an authorized browser endpoint and synchronously
dispatches the signed request, reporting only the verified target result.

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

1. Implemented in the account-workflow follow-on branch: database-configured account
   module; existing-account selection; signed account/plan projections; server
   dispatcher with pinned public DNS, TLS, redirect/byte/deadline limits; JSON/Origin
   write protection; shared UI confirmation with original trial dates and admin-grant
   consequences; authoritative effective dates/audit after success. Same logical
   request survives reload/unknown outcomes, including an already-active refreshed
   account. Actor/environment/binding-scoped tab storage clears on account switch
   or logout. Controlled browser responses do not prove real Auth/SQL.
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

## Account workflow checkpoint

Branch: `codex/super-admin-suit/account-workflow`, based on PR #269 at
`24dfc9e2e61b4d965569a2faa631ec8396f7b74d`. PR #269 final CI is green.

The only shared-file edit removes the three now-resolved SAS index-page entries
from `docs/shared/suit-ui-boundary-debt.json`. Preserve concurrent Shop entries
when consolidating; no shared component or token implementation was changed.

SAS entry is provisioned data: register an enabled navigation item under its Suit
with `moduleKind: accounts`, an empty route descriptor, owner visibility, required
capability `shop.plan.command` version `1.0`, and localized labels. Do this through
the existing audited configuration command only after independent release approval.
The binding helper requires all three account/plan query/command policies and a
fresh verified manifest advertising `activate_trial`, plus the existing signer,
exact environment and egress policy. Ambiguous bindings fail closed. No rows are
seeded by this migration and an unconfigured/older target exposes no activation UI.

The dispatcher uses the SAS project's own `NUXT_SUPABASE_SERVICE_KEY` through the
maintained Nuxt server client; source templates contain a blank placeholder only.
It never accepts a target endpoint/key or raw signed dispatch ID from the browser.
Authorization is verified before resolving the privileged worker client. The target
receives the existing signed envelope and validates its own integration principal.
`super_admin_adapter_complete` remains the sole response signature/binding authority.

Release order: validate the unapplied Shop activation migration and SAS navigation
migration in disposable databases; deploy target SQL/bridge, pin the newly verified
manifest, then deploy the SAS app and separately provision its approved module and
server secret. Missing prerequisites stay unavailable. No provider state, secrets
or hosted schema were changed by this task. The inherited unapplied Shop migration
was tightened to reject inactive Shops and non-purchasable plans; an unrelated
unchanged trailing helper was removed from its draft body.

Next checkpoint remains secure new-account provisioning/invitation. The current
UI intentionally exposes only existing-account activation; it does not advertise
a nonfunctional creation action. Full acceptance cannot be claimed until the
prepared SQL/conformance and real disposable Auth tests pass.

Final workflow validation: 27 SAS unit checks, 13 Shop signed-bridge unit/conformance
checks, 11 browser scenarios, SAS lint/typecheck/production build, workspace
boundaries, diff check and live preflight passed. Browser journey responses were
controlled; unauthenticated API/Origin denials exercised the actual built server.
The signed bridge unit checks verify packet/environment/nonce binding and handler
paths but do not replace database conformance. Mobile English/Arabic screenshots
were captured; the English mobile dark screenshot was inspected. SQL suites and
real disposable Auth/Storage remain unrun because the daemon's Postgres layer
unpack failed; this follow-on performed no additional database download/start.
