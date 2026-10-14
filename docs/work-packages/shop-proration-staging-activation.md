# Shop proration staging activation

This bounded follow-up enables the reviewed proration implementation for staging
testing through the existing Supabase GitHub migration integration. It introduces
no migration deployer, credentials, public configuration endpoint, payments or
authorization changes. Production is unaffected.

## Environment guard and review

Forward migration `20261014063640_staging_proration_activation` updates only the
private configuration singleton. It requires the existing protected SAS integration
metadata to identify Shop staging (`shop-staging:jvvelvftpfnlogalgxgv`, environment
`2d18defd-a91d-4fec-856f-253ad98dfc5e`), an active/unexpired principal, no enabled
conflicting target identity, and enabled XPay **test** mode. Missing, ambiguous,
production, inactive, expired or live-provider contexts do nothing. The migration
is idempotent. No secret is read and no principal is created or modified.

Read-only preflight verified that identity in Shop staging and no integrations in
Shop production. PostgreSQL cluster identifiers were unsuitable: both projects
share one identifier. Unconfigured GUCs were absent. Neither is used as identity.
Production does not yet have the proration table; if the shared migration chain is
later promoted there, its default remains OFF and this activation skips it.

The gate selects the implemented checkout feature. Owner/non-anonymous checks,
tenant/source/funding/version/quota/offer validation, immutable ledgers, provider
amount/merchant/test-mode/intent proof, replay handling, RLS and grants remain.
Activation makes plan changes available; it does not initiate a quote or payment.
The gated path has no active same-plan early-renewal intent; its button is hidden.
Expired same-plan renewal is supported. Custom/composite same-interval periods,
FX and asynchronous prorated methods remain unsupported with explicit errors.

## Verification and delivery

The disposable GitHub payment job executes the **actual migration** repeatedly
inside a rolled-back SQL fixture: staging and replay enable; missing, production
(even test-mode), wrong environment, live provider, disabled/expired principal and
mixed target metadata stay OFF. Every case checks table RLS/direct privileges and
RPC grants. Existing full financial, owner-isolation, offer/SAS and race suites run
in the same job. The local Shop runner registers the same fixture; neither runner
accepts hosted fixtures. No hosted SQL mutation is executed from this executor.

Parent: Shop root #303 at `ebc0120ab7b840b7b2ebdc2778ef55eac3d15f2a`.
Publish as its child, integrate into the one Shop root after owner coordination,
and wait for required combined CI before the authorized `stg` merge. Serialize
against SAS root #294 and verify the previous deployment plus five-minute spacing.
After GitHub integration deployment, inspect Shop staging migration history and
the singleton read-only. A skipped activation is a failure to become ready for
testing, not success; reverify the trusted identity and provider mode before any
new reviewed forward change. Rollback is a reviewed, identically environment-bound
forward migration setting the singleton OFF through that same integration.

## Exact user acceptance steps

1. Sign in as the owner of an existing staging Shop at
   `https://stg.shop.building-suit.com/billing`. No credentials/session were supplied
   to this executor; do not copy production accounts or impersonate an owner.
2. Choose a **different** supported monthly/yearly plan and open its review. Verify
   the saved unused prepaid value, service value, existing credit and final due
   against the actual paid receipt/current period. Quote creation writes a quote
   but does not create a provider session or charge. Do not select Pay.
3. Reload and confirm the same quote restores; cancel/abandon the unstarted quote
   and verify no subscription/order/payment change. Repeat English/light desktop
   and Arabic/dark mobile. An unrelated owner must not read the quote.
4. Zero-due Apply credit changes the subscription and credit ledger: only perform
   after explicitly authorizing that staged business change. Verify one balanced
   settlement and replay safety. Positive-due Pay starts XPay and requires explicit
   user-controlled sandbox-payment authorization; this task never initiates it.
5. Paid hosted acceptance then checks return/focus/online recovery, verified
   receipt/subscription/credit, replay and delayed confirmation. Native CI covers
   these contracts using synthetic provider observations; it is not evidence of
   an actual hosted prorated payment. No all33 visual-matrix claim is made.
