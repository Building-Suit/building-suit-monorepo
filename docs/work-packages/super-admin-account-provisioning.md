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

Integration-sensitive interfaces:

- Shop private owner-bootstrap helper and wrapper; retain its seven-day policy.
- Shop `platform_plan_read` adds `catalogTermsId` to catalog projections.
- Shop signed bridge operation list, handler and manifest; preserve XPay additions
  when consolidating any later function definitions.
- Shop Auth invite template/config and EN/AR `ownerInvite` namespace.
- SAS registry/capability configuration and EN/AR `provision` namespace.

XPay customer payments are a separate task. This workflow stays an audited admin
operator override and creates no new InstaPay/proof-upload dependency, charge,
paid receipt or provider-payment confirmation.

## Validation

Local: 58 focused unit checks passed, including target identity reconciliation,
pre-existing email conflict, forged metadata denial, uncertain invitation replay,
owner claim and hosted-runner/loopback guards. SAS/Shop typecheck and lint passed
(the Shop baseline has unrelated attribute-order warnings). Boundary check passed.
Browser and final build results are recorded at the PR checkpoint.

Real SQL/Auth validation runs only through the secret-free
`account-provisioning-disposable.yml` GitHub-hosted job. The script refuses local
and self-hosted execution and checks exact isolated Shop/SAS loopback origins.
Generated local keys and one-time tokens are not printed. It exercises real SAS
Vault signing/completion, the actual target handler, real disposable Auth and
Mailpit invitation/claim, exact replay, no payment evidence and SQL regressions.
The test-only in-process target transport preserves exact signed bytes; production
DNS/TLS/redirect guards remain independently covered by unit checks and are not
relaxed for a local destination. No local Docker pulls are retried.

Until that job and final CI pass, real database/Auth readiness is pending. Hosted
release remains separately gated by environment verification, provider policy,
configuration records and migration/template deployment; no production readiness
is inferred from disposable fixtures.
