# SAS-M1-CUSTOM-OFFER-001 — incomplete / blocked

Admin implementation: immutable private offer versions, optimistic amendments,
recipient/company/binding isolation, exact decimal prices, resource and entitlement
snapshots, template provenance, expiry, owner attribution, append-only revocations,
request fingerprint/idempotency and consequential-action audit. The authorized
read projection and Nuxt owner worklist use shared record dialogs and tables with
English/Arabic copy. Navigation is configured through the existing database
registry; this task seeds no navigation, commercial values or target identities.

Issuance deliberately fails with `SHOP_SECURE_REDEMPTION_CONTRACT_REQUIRED`.
Saved versions have never been registered at the target and their revocations
therefore affect only Admin records. No customer link is emitted and no public
catalog plan is created. This is not completion of the requested secure-link flow.

## Missing target contract

The checked-in Shop adapter supports `register_private_offer`, with offer UUID,
recipient, company, environment, price and resource fields. Its customer RPC
accepts offer UUID/version and binding IDs. It has no opaque-token exchange or
target revocation command, and its closed registration payload has no entitlement
snapshot. An Admin token alone cannot enforce revocation against the direct Shop
redemption RPC. Wiring that registration as issuance would create an irrevocable
target offer and cannot satisfy this task. No target app was changed or imported.

Required dependency repair: a reviewed Shop-owned opaque, expiring,
recipient/environment/Suit-bound redemption protocol, revocation with atomic
redemption serialization, and frozen entitlement snapshot support. Return the
link through the authenticated adapter, preserve exact retries, and freeze all
commercial terms into the Shop billing request. Activation must remain the
existing manual evidence/review path, with Shop quota checks.

## Verification on 2026-10-09

Executed successfully:

- `pnpm exec turbo run typecheck lint build --filter=@building-suit/super-admin-suit`
  (3 tasks successful; earlier lint/type failures were corrected).
- `node --test apps/super-admin-suit/tests/unit/sas-m1-custom-offer-001-4.test.mjs`.
- `pnpm --filter @building-suit/super-admin-suit test:unit`.
- `pnpm check` (tokens and workspace ownership/boundaries).
- `git diff --check`.

Executed unsuccessfully:

- `pnpm agent:preflight`: fetch/GitHub state not verified (exit 1).
- From `apps/super-admin-suit`, `pnpm exec supabase db reset --local`;
  `pnpm exec supabase test db --local`; and each registered database executable
  targeting `supabase/tests/sas-m1-custom-offer-001-1.test.sql` and
  `supabase/tests/sas-m1-custom-offer-001-2.test.sql`: CLI fails before SQL execution
  with `EROFS` writing `/home/tareq/.supabase/telemetry.json.tmp.*` (exit 1).
- `pnpm exec playwright test --config apps/super-admin-suit/tests/e2e/sas-m1-custom-offer-001-3.config.ts --workers=1 --retries=0`:
  production server exits early (exit 1). Direct launch confirms
  `listen EPERM: operation not permitted 127.0.0.1:4324`. An earlier attempt
  preceded build completion and failed because the server artifact was absent;
  the post-build attempt still failed due to the sandbox restriction.

All declared task-owned output paths exist. SQL/browser/unit outputs explicitly
skip the unavailable link-redemption and full snapshot-parity scenarios. Skips
are unmet acceptance gates, not PASS evidence. The browser authoring scenarios
mock the Admin APIs; they do not establish server authorization or redemption.
Database tests have not executed, schema types have not been regenerated from
the local schema, and screenshots/visual review have not been produced. Fresh
local migration reset, complete Admin SQL regression, generated types and rendered
desktop/mobile English/Arabic light/dark review remain required in a capable
environment. Shop schema and runner were unchanged; `pnpm db:test:shop` was not
run. No commit, push, merge, deployment or hosted database operation occurred.

## Operator recovery — 2026-10-09

Verification 362 check 14728 was independently classified VERIFIER_INFRA against
its original trusted artifact and source hashes. Its include-only fixture had
been discovered as a standalone SQL test, leaving adapter fixture rows outside
a transaction. The fixture was renamed to `fixtures/custom-offer.inc`; only the
two include references changed. Fixture bytes and all business assertions remain
unchanged. No product retry was charged.

After a disposable local SAS migration reset, the full SQL command completed:
7 files / 70 TAP results. The two focused Custom Offer files completed again
without a reset: 2 files / 21 TAP results. No adapter-source/adapter-target rows
remained. Four target-redemption assertions still explicitly skip; these command
results do not establish complete task acceptance or trusted verification PASS.

A real owner issuance RPC against the locally migrated candidate failed with
`SHOP_SECURE_REDEMPTION_CONTRACT_REQUIRED`, confirming the source blocker. The
existing approved SAS scope is `apps/super-admin-suit/**`; the missing Shop-owned
opaque redemption, atomic revocation and entitlement freezing protocol cannot be
implemented or published under that scope. The task remains incomplete, with
execution 321, verification 362, original attempt policy and evidence preserved.
The task may be parked through the approved queue mechanism while independent
Audit proceeds. No hosted product migration, deployment or publication occurred.

Evidence is retained under `.local/custom-fixture-{reset,regression,focused}.log`,
`.local/custom-fixture-isolation-repair.json`, and
`.local/custom-issuance-proof.{sql,stderr}` in this preserved worktree.

## M1 prerequisite recovery: fresh local acceptance

PR #200 was independently confirmed merged. Its existing Shop redemption RPC
accepts UUID/version/binding identifiers; its closed signed registration payload
contains no entitlement snapshot, and there is no opaque-token enforcement or
remote revocation command. SAS-only signing or an Admin-only token cannot close
that target authorization gap. No Shop-owned source was modified.

The preserved execution 321 candidate was migrated from a clean disposable SAS
local database. Full SQL regression passed (7 files, 70 TAP results). Both
registered Custom Offer obligations were also executed separately: 13 and 8 TAP
results. Their 4 explicit skipped redemption assertions remain unmet requirements.
The complete app unit suite passed 37 tests with 1 unmet snapshot-parity skip.
Browser authoring passed all 4 locale/viewport cases with 1 unmet issuance/
redemption skip. Workspace boundaries and token checks passed.

Evidence is preserved under `.local/sas-prerequisite-recovery-20261010`, with
source and artifact hashes. Local command success does not constitute trusted
task PASS while these requirements remain skipped. No product attempt, owner
receipt, completion credit, hosted operation or publication was created. The
existing contract hold remains until a separately authorized Shop source repair
and the corresponding SAS signed integration are independently verified.

## Secure dispatch repair — actual local results

Forward migration `20261009223658_signed_private_offer_dispatch.sql` integrates
owner commands with the existing signed adapter. Only verified capability
observations permit issuance. Immutable server-side version fields supply the
signed target payload. The server sends through the existing protected signer
and reconciles a token only after exact binding/environment/version, entitlement,
expiry and HMAC-result checks. Receipt state/token/audit identity cannot change
on replay; unconfirmed or tampered replies remain blocked.

A clean local reset applied the exact forward source chain. All eight SQL files
ran successfully (87 TAP assertions including the existing four explicit unmet
target-browser skips). The new 17-assertion dispatch suite proves gated capability,
owner authority, one frozen dispatch, recipient and entitlement signing, token
privacy, tamper rejection, valid cryptographic completion and durable receipt
immutability. Its signed positive response is an explicitly synthetic protocol
unit fixture, not independent hosted evidence. App typecheck passed; app unit
tests remain 37 passing and one unmet target integration skip.

Shop dependency source was independently tested against an isolated migrated
Shop backend using the real bridge and redemption RPCs. Customer link entry and
full browser target parity remain unfulfilled; no trusted task PASS or credit
is claimed. Hosted staging adapter installation/configuration and deployment
require the owner's consolidated authorization. Execution 321 remains preserved.

## Authorized customer-entry source continuation — 2026-10-10

Preserved execution 321 now has authenticated issuer link delivery, confirmed
signed-receipt gating, exact-request retries and revocation UI. Links use an
explicit protected `customer-offer-origin` configuration and URL fragments;
missing origin blocks issuance. Reload/account changes clear stale delivery
state. Private SQL helpers remain inaccessible to browser roles.

Fresh local checks: typecheck, lint and build passed; eight rendered authoring/
issuance/revocation cases passed in English/Arabic and desktop/light/mobile/dark.
Clean local SQL passed 91 TAP results, including 21 signed-dispatch assertions.
The separately composed Billing/Custom/Audit source candidate passed typecheck,
lint/build, 116 SQL results and 16 rendered browser cases. These are local results.
Four target SQL scenarios and one unit/browser cross-project scenario remain
unverified; their historical skip labels are not task PASS. Genuine signed
staging journeys still require the authorized rollout and external prerequisites.

Shop dependency Draft #229 now includes owner preview/redemption UI and the
protected frozen review projection. Separate Publisher commit:
`6b472eedbdf7b90d4f4e352048e413bcef7c67bb`. The 29 registered Shop database suites,
both focused security suites, 15 unit tests and four browser cases passed.
No hosted writes, execution retries, BS22 receipts or completion credits were
created. The exact source manifest and local evidence remain in the control
worktree's `.local/restore-evidence/sas-m1-source-continuation-20261010`.

## Authorized staging operation — 2026-10-10 observed result

Both authorized PostgreSQL 17 staging backups were age-encrypted outside the
repository and fully restored into a disposable network-isolated local server.
171 original comparisons and 185 migration-rehearsal comparisons passed. Only
reviewed forward migrations were installed on Shop staging jvvelvftpfnlogalgxgv
and SAS staging lwecnmsosfwovlzxauml. The registry-composition collision received
a separate forward repair, backup/restore and red/green rollback validation.

The exact dedicated staging Vercel projects now serve the sealed Shop/SAS
candidates. SAS's required private Nuxt runtime credential alias was corrected.
The genuine authenticated owner configured one narrowly scoped signed binding.
Native signed capabilities, billing-query and plan-query dispatches passed;
nonce replay was denied. The current authenticated registry exposes Activity,
Private offers, Transfer configuration and Payment review.

Real staging browser issuance/revocation and customer private-link entry and
redemption were observed. Database reads independently confirmed one submission,
unchanged trial access, zero payment evidence and matching frozen amount,
currency, interval, resource limits and entitlements. Exact customer request
replay returned that same submission; another request with the consumed token
was rejected. Wrong recipient, binding, environment and tampered token reads
returned 403. All notices are explicitly synthetic; no payment was approved.

The captured synthetic source/target snapshots now support the registered
commercial-parity unit regression: 3 passing tests, no unit skips. This fixture
is reproducible regression data, not fresh hosted acceptance by itself.
Typecheck/lint/build and eight local rendered authoring/issuance/revocation
cases passed. The local Shop private-offer SQL suite and all 21 SAS signed-
dispatch assertions passed. The restored SAS test environment required an
isolated local Vault server key; no hosted Vault configuration was changed
for that test repair.

Four historical target SQL skips and one cross-product browser skip remain
in the registered mandatory executable plan. They are not PASS. Execution 321
has not received trusted completion, a new Draft PR or completion credit.
Billing's independent reviewer and existing verified transfer-evidence source
are still missing. Final Gate remains dependent on Billing and Custom Offer.
Run, task, retry and queue-authority histories remain preserved.

Restricted staging evidence, encrypted backups and rollback artifacts remain
outside the repository under the SAS M1 staging evidence directory. No secrets,
opaque tokens or genuine payment evidence are included in this source document
or the synthetic regression fixture.

## 2026-10-10 task-owned acceptance repair

The two issuer SQL suites retain every prior executed business assertion (13 and
8 total assertions); obsolete target-contract skips are replaced with actual
issuer token-store, dispatch and private-helper permission checks. Target opaque
recipient/environment/Suit-binding denials and one-time/exact-request replay are
now exercised by the mandatory `sas-m1-custom-offer-001-4.test.mjs` against the
installed staging customer RPCs, using separately authenticated existing synthetic
customers. They are no longer omitted: 403 denials, 200 exact replay preserving the
original submission, and 409 consumption on a different request are required.

The mandatory browser suite now also opens the actual deployed Shop customer UI
with a genuine authenticated customer session, reloads the previously completed
browser redemption, checks frozen terms and token removal, and independently
rechecks the target's replay/one-time behavior. The original genuine submitted
browser screenshot is hash checked. The eight rendered issuer transport tests
remain explicitly local fixtures, not live acceptance. No new successful payment
notice, bank evidence, reviewer confirmation or payment approval is created.

Test-only provisioning lives in the restricted user test-evidence config
`$XDG_CONFIG_HOME/building-suit-test-evidence/custom-offer-staging.json` (default
`~/.config/...`), or explicit `BS_CUSTOM_OFFER_STAGING_CONFIG`:
`projectRef`, `origin`, `customerOrigin`, `evidenceRoot`. The target must match the
maintained Shop staging environment exactly. Encrypted existing synthetic identity
artifacts and the age identity remain outside Git with restricted permissions.
Missing configuration, authentication, artifacts, or any failed target assertion
fails the test; none is a skip or implicit PASS. No service-role credential is used.

Executed after this repair: issuer SQL 21/21 PASS; unit 4/4 PASS; browser 9/9 PASS
(including genuine hosted customer reload); SAS typecheck/lint/build and diff
whitespace checks PASS. Trusted native reverification/publication remains a
separate required phase, and these results do not create a completion credit.

The existing registry-composition DO-block assertions now emit a one-test TAP
plan and successful completion marker; all original invariants still execute and
raise on failure. This repairs pg_prove acceptance without changing runtime SQL.
