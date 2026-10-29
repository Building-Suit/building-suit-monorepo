# Ledger next staging acceptance

Prepared against source6139b375, observed staging81cdcc60. #514 remains open at remote20a686c1 targeting retired439 branch. No publication performed while Doctor owns the slot.

## Before publication
- Coordinator releases validation slot only after Doctor's accepted staging result is known.
- Fetch accepted base, preserve histories, merge into candidate if advanced; resolve genuine conflicts. Repeat only affected local checks plus exact committed release/provenance check.
- Consolidate source into existing514 root, update title/body/base once coherently, run branch policy and observe all applicable exact-head checks. No approval-review submission without specific confirmation.

## Hosted configuration prerequisites
- Explicitly verified Ledger staging target yqculoltqsyfastmihmu; https://stg.ledger.building-suit.com. Mapping source docs/architecture/environments.json, not a display-name inference.
- Existing private app.manual_payment_configuration accepts a singleton instructions text; user-approved IPA building-suit@instapay is valid alone. Recipient label is optional.
- Configuration operation: instruction-only upsert through the documented trusted administrator path. No browser/service-role API write grants exist. Do not include operator provisioning SQL. Do not obtain/change credentials or retry denied access.
- Repository GitHub integration applies shared migration chain to stg/main; no existing environment-specific instruction job/guard exists. Do not add a second deployer or use migration side effects to circumvent authorization.
- Existing billing operator readiness is unverified for the live environment. If a dedicated authorized operator does not already exist, report that separate permission gate; do not create a role or reuse a tenant identity.

## After authorized staging integration
1. Verify merged SHA/tree and every applicable required CI result, Ledger-specific Supabase provider receipt, and frontend deployment on that exact SHA. Observe latest completed check for exact mapped project; same-name other-project records are insufficient. Keep publication/catalog hold distinct from source CI.
2. Confirm homepage and canonical /login return200 and canonical logo assets match released source. Do not use /auth/login.
3. Through an authorized staging test tenant, inspect plans in EN/AR and primary plan action: manual quote, exact server catalog amount/currency/interval, no online checkout call/redirect, exact approved instruction text. Without installed instructions, expect fail-closed message with no receipt upload or stale prior instructions. No real transfer.
4. If an existing authorized staging fixture and explicit test-data permission exist, exercise receipt/review using clearly synthetic evidence in that fixture only. Never submit fabricated payment evidence to a live customer request or approve entitlement against real funds. Otherwise run native service acceptance locally and record hosted transactional acceptance pending.
5. Confirm tenant viewer cannot initiate; receipts private; cross-tenant access denied; no self-activation. Review envelopes require ok:true, not merely HTTP200. Existing dedicated operator only, exact current evidence, reason/internal context/stable command UUID; no new role provisioning. After approval, verify one period only; historical callbacks/payment records unchanged.
6. Preserve receipt URL privacy/expiry and sanitized evidence; do not log bearer tokens or signed URLs. Report missing authorized fixtures/operator as specific blockers rather than bypassing guards.

## Coverage and limits
Completed: 141 Ledger/security units,30 maintained billing browser cases,10 Deno legacy crypto/receipt cases, Ledger build/typecheck, Deno actual SDK check, workspace/tokens/lint and exact-head release check. Native browser selector syntax passes. Native real Auth/Edge/Storage billing suite remains unrun on this candidate and requires its owned fixed-port fixture. Never point native scripts at hosted projects: they mutate subscriptions and upload synthetic evidence. No sufficient check was repeated for activity alone.

Production/main and marketing remain held for configured/verified cutover, release/catalog gates and supported exact-scope release path; accountant acceptance is separate and unrecorded.
