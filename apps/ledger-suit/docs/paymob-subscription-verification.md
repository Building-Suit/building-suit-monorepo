# Paymob subscription verification

This is the pre-charge verification record and operator procedure for
LS-BILL-001. It does not authorize a charge, provider change, deployment, or
hosted database write.

## Current evidence (2026-09-27)

The checked-in contract is locally verifiable:

- Public Pricing and Billing read the database catalog; checkout resolves and
  signs the same plan, price row, interval, and integer minor-unit amount.
- Solo, Starter, and Business use the approved amounts `39900`/`325584`,
  `59900`/`488784`, and `109900`/`896784` EGP minor units.
- Paymob monthly/yearly frequencies are 30/360 days. The initial successful
  transaction fallback now uses those exact day counts, including month-end
  and leap-year boundaries; a later authenticated subscription callback uses
  Paymob's authoritative `next_billing` value.
- Transaction and subscription callbacks verify their respective HMACs before
  privileged access. Checkout metadata binds organization, plan, interval,
  price, and amount. The fulfillment RPC deduplicates provider event IDs, and
  payment confirmation uses the same event ID as its delivery idempotency key.

No Paymob variables or ignored Ledger `.env` were available in this worktree on
2026-09-27. Therefore the merchant plan inspection, initial 3DS enrollment,
recurring MOTO success/failure, authenticated callback delivery, retry, and
access-state transitions have **not** been executed against Paymob Test Mode.
This is a provider-integration blocker; an accounting demo or unpaid evaluation
must not be accepted as a substitute.

## Read-only merchant inspection

Use only Test Mode values and the callback URL for the designated test backend.
Keep values in the ignored `.env`; never paste credentials or callback payloads
containing customer/card data into Git, task JSON, logs, or evidence files.

```bash
pnpm paymob:provision-plans -- \
  --verify-only \
  --webhook-url=https://<test-project-ref>.supabase.co/functions/v1/paymob-webhook
```

The command performs the token-authentication request followed by read-only plan
GET requests; it never sends the plan-creation POST in verification mode. It
must report exactly one matching active plan for each of the six names. It
fails closed on any missing/duplicate plan or mismatch in amount, 30/360-day
frequency, MOTO integration, `use_transaction_amount`, active state, or webhook
URL. Record only the command result, mode, date, operator, and plan IDs; plan IDs
are configuration identifiers, not proof that checkout succeeded.

## Required Test Mode journey

Run this against a designated test backend with a fresh test organization and
Paymob-supported test instruments. Do not use a real customer or live card.

1. Confirm Test online 3DS/VPC and MIGS MOTO are both enabled and are distinct
   integrations. Run the read-only six-plan inspection above.
2. Compare public monthly/yearly presentation and `subscription_plan_catalog()`
   with the six values printed by the inspection. A legacy or remembered price
   is not approval.
3. Start checkout as a billing manager. Confirm the initial transaction uses
   the online integration, completes 3DS, charges the selected EGP amount, and
   creates one Paymob subscription on the matching MOTO plan.
4. Confirm both callback types arrive over HTTPS with valid HMACs. Verify one
   active entitlement, the exact selected plan/price/interval, and a period end
   equal to Paymob `next_billing`. Replay each callback and confirm no duplicate
   billing event, entitlement transition, or payment confirmation.
5. Run a supported recurring MOTO success. Confirm one renewal event, the new
   Paymob `next_billing`, active access, and one confirmation. Replay it and
   confirm no duplicate effects.
6. Run a supported recurring MOTO failure and provider retry. Confirm failure
   produces grace/read-only behavior as contracted, sends no success
   confirmation, and a later authenticated success restores access once.
7. Exercise cancellation and refund in Test Mode using the provider-supported
   operator process. Confirm callbacks and local access/history behavior, and
   record the named operational owner and escalation path.

Evidence must contain timestamps and non-secret provider/event identifiers,
expected versus actual amount/cadence/status, callback HTTP results, and the
resulting subscription/access state. Redact emails, phone numbers, full callback
payloads, tokens, keys, HMACs, and card data.

## Live-charge gate

Keep checkout unavailable for live charging until every item below has dated,
independently reviewable evidence:

- Merchant live status is enabled, with separate Live online 3DS/VPC and MOTO
  integrations and a Live-only six-plan inspection passing.
- Production Edge Function secrets are present as one mode-consistent set; no
  Test identifier is reused and no secret is exposed to the app or repository.
- The Test Mode journey above passes for enrollment, recurring success,
  failure/retry, callback replay, and access transitions.
- A named operator owns cancellations/refunds, the published policy matches the
  provider process, and support escalation plus reconciliation responsibilities
  are recorded and accepted.
- The production callback URL and HMAC are verified with a non-customer smoke
  procedure explicitly authorized for that environment.

Until those checks pass, the correct result is **blocked before live charge**.
