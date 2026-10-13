# Secure account provisioning

Branch: `codex/super-admin-suit/account-provisioning`, stacked on PR #271 at
`198aa275df145f74c27e763808e1fbd9bb14d753`. PRs #269 and #271 have green review and
branch-policy checks. This adds the remaining requested new-account workflow.

The target reserves one random Auth ID before external calls. Only that ID with
its server-owned app-metadata provisioning marker can be reconciled. An existing
email is a conflict; no identity is linked by email and no password or automatic
email confirmation is supplied. Auth creation uses the supported target Auth
Admin API. A lost reply is reconciled by the reserved ID before any retry.

The tenant, membership, original seven-day trial and chosen plan activation share
one target transaction. The maintained owner bootstrap now has an unexposed
explicit-identity helper; the ordinary owner entry point still passes only its
own `auth.uid()`. The new facade does not emulate a Shop browser identity. It
pins the selected catalog terms, preserves original trial history, uses current
quota/plan checks and records an operator grant instead of payment evidence.
Catalog changes or an independently onboarded identity require review; the
reserved identity is retained instead of resetting history or guessing ownership.

Invitation is a separate durable stage. Provider `invited_at`/confirmation is
observed independently; an uncertain send is never silently repeated. A new,
acknowledged resend has its own request, reason and audit, and can invalidate
older links. Completed command results are frozen; partial stages reconcile
under the original exact request. Leases prevent overlapping work and expired
workers cannot finalize another worker's attempt. Append-only events retain
actor, request, reason, grant and invitation/claim history.

The owner receives a one-time invite hash, consumes it through Supabase Auth,
and passes a target-owned verified-owner/membership RPC before choosing their
own password. Tokens are stripped from the page URL before follow-up navigation;
the page disables caching and referrers. Email ownership is not confirmed by
admin provisioning. Invitation acceptance is not represented as email delivery.

## Configuration and coupling

No runtime records, signing keys, hosted settings or actual customer operations
are changed here. Missing policy fails closed. Provision the target's protected
`shop_account_provisioning_settings` only after separately verified deployment:
HTTPS owner-claim redirect, explicit Auth timeout/lease, enabled state and verified
invitation readiness. Its server API uses only the target's own environment
credentials. Deploy the supported invite template; verify Auth Site URL and
redirect allowlist resolve to the exact deployed owner-claim route, and SMTP is
ready. Source records must grant both new account query/command capabilities and
pin a freshly verified manifest. Existing-account activation remains separate.

Wire additions: `shop.account.query` (`catalog`, `status`) and
`shop.account.command` (`create_and_activate`, `resend_invitation`). Command
metadata declares staged request idempotency: body/actor reuse is exact, Auth and
domain mutations are once, completed results are immutable, and unfinished stages
can evolve through audited reconciliation. There is no generic pass-through.

The feature child incorporates current staging `266d91dc11cbc07b5e9f3b6d37dd53e541fb70e1`.
Existing payment-review, activity, custom-offer and authentication controls remain
in `BsAdministrationEntryPage`; it receives only projected account links and a
semantic selection event. Each of the three new routes renders one explicitly
exported complete shared page template. The current atomic architecture gate
passes with 79 routes and zero debt. New route inventory entries and the docs
catalogue/design guide are updated. App scripts retain authorization, durable
requests, domain state and controlled fields.

Integration-sensitive interfaces:

- Shop private owner-bootstrap helper and wrapper; retain its seven-day policy.
- Shop `platform_plan_read` adds `catalogTermsId` to catalog projections.
- Shop signed bridge operation list, handler and manifest; preserve XPay additions
  when consolidating any later function definitions.
- Shop Auth invite template/config and EN/AR `ownerInvite` namespace.
- SAS registry/capability configuration and EN/AR `provision` namespace.
- Shared administration entry adds optional account links; three new page
  exports/inventory entries own activation, provisioning and owner-claim composition.

XPay customer payments are a separate task. This workflow stays an audited admin
operator override and creates no new InstaPay/proof-upload dependency, charge,
paid receipt or provider-payment confirmation.

## Validation

Local: 58 focused unit checks passed, including target identity reconciliation,
pre-existing email conflict, forged metadata denial, uncertain invitation replay,
owner claim and hosted-runner/loopback guards. SAS/Shop typecheck and lint passed
(the Shop baseline has unrelated attribute-order warnings). Boundary check passed.
All 16 controlled browser scenarios passed (13 SAS, three Shop owner-claim),
including English/Arabic mobile layouts, lost-response reconciliation and
acknowledged resend. SAS, Shop, Ledger and Inventory production builds and
typechecks passed. The shared auth wordmark receives only maximum-inline-size
bounds to preserve its aspect ratio inside mobile containers.

The Shop seed reuses PR #274's exact correction from fourteen to seven trial
days. SAS keeps global public signup disabled while enabling the email provider
required for provisioned users to log in; disposable acceptance asserts that
public signup remains denied.

Real SQL/Auth validation runs only through the secret-free
`account-provisioning-disposable.yml` GitHub-hosted job. The script refuses local
and self-hosted execution and checks exact isolated Shop/SAS loopback origins.
Generated local keys and one-time tokens are not printed. It exercises real SAS
Vault signing/completion, the actual target handler, real disposable Auth and
Mailpit invitation/claim, exact replay, no payment evidence and SQL regressions.
The test-only in-process target transport preserves exact signed bytes; production
DNS/TLS/redirect guards remain independently covered by unit checks and are not
relaxed for a local destination. No local Docker pulls are retried.

The disposable run at schema head `1f3d0e520cb41a42d57dfb0abc0535884a211863`
generated both schema contracts and passed real creation, grant, invitation,
completed replay, changed-input source denial, lost-response recovery, duplicate
email and active-period protection. Its SQL fixture failed on an ambiguous test
variable; that fixture is corrected in `9ca9655`. Generated schema artifacts are
committed, and the next run also executes the required full `pnpm db:test:shop`.
The focused trial-activation and signed-bridge SQL suites pass. Full Shop SQL
stops at the inherited `shop_crm_owner_bootstrap` fixture with `PLAN_UNAVAILABLE`;
this gate remains a failure, while subsequent source SQL/real owner-claim checks
are collected independently. On reconciled staging, 138 unit checks pass with
one inherited backend-dependent skip, current atomic boundaries pass, and
SAS/Shop/docs lint/typechecks pass (Shop retains baseline warnings). Final browser,
source SQL and owner-claim evidence are pending the final-head run.
Until that run and final CI pass, real database/Auth readiness is pending. Hosted
release remains separately gated by environment verification, provider policy,
configuration records and migration/template deployment; no production readiness
is inferred from disposable fixtures.


Backend checkpoint at `94ca6fd`: both full SQL suites now pass. Source pgTAP
executes before integration fixtures because two baseline suites intentionally
assume otherwise-empty global tables. Shop's disposable-only legacy catalog
fixture runs before the historical forward catalog migrations, matching the
upgrade contract; final permission fixtures are seeded afterward. No production
seed or hosted data is changed by that runner setup.

Real Mailpit confirms the owner invitation exists. Its hash is 56 hexadecimal
characters: Supabase Auth's `GenerateTokenHash` uses SHA-224, documented in the
[provider source](https://github.com/supabase/auth/blob/master/internal/crypto/crypto.go).
The claim guard and browser fixtures were corrected from the mistaken 64-character
assumption. Final real verification/claim/password acceptance is rerunning.


Final reconciliation diagnosis: PostgreSQL rejected the status/resend selector
because its local `payload` variable conflicted with the job table's `payload`
column. The unapplied facade migration now uses `v_payload` for the local input;
immutable stored payload and all guards are unchanged. Rollback-only local
diagnostics exposed the error without any Auth or durable mutation. Full
real-flow verification is rerunning on this correction.
