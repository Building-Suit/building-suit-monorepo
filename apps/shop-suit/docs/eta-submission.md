# ETA submission support

This feature is separate from tax calculation and does not establish compliance. `/eta` provides English/Arabic merchant legal name, nine-digit RIN, activity, branch address/code, POS serial and GS1/EGS/unit setup, missing-configuration counts and asynchronous submission history. Only an owner/system manager with `settings.manage` and access to every location can edit the business-wide configuration. Queueing additionally authorizes the sale location. Public tables have RLS and no direct client grants; privileged dispatch/recovery RPCs are service-only.

Saving an append-only configuration version does not activate a merchant. Format validation is not proof of official code registration. The configured legal identity, branch/POS, item codes/descriptions and original tax snapshot are frozen at sale issuance in `eta_sale_sources`. Setup changes apply to future sales. Missing export setup does not stop issuance; such sales are safely unsupported for later export. There is no historical backfill. Operational non-EGP sales continue unchanged; only export rejects them.

## Stable contracts

- `save_eta_configuration(request, shop, configuration, reason)` is actor-bound and idempotent. Configuration contains only `profile: {legalName, rin, activityCode}`, `branches: [{locationId, branchCode, deviceSerialNumber, address: {country, governate, regionCity, street, buildingNumber}}]`, and `items: [{sourceType, sourceId, itemType, itemCode, unitType}]`. Unknown properties (including credential fields) are rejected. POS serials cannot move between locations or be duplicated in a configuration.
- `eta_settings(shop, offset)` returns configuration, available locations/items, explicit inactive activation and 50 history rows per server page. It does not return payload/buyer identity or server credentials.
- `queue_eta_receipt(request, shop, invoice, buyer, paymentMethod)` freezes the buyer/payment projection onto the original issuance source. One document per sale and one request per shop, with conflicting replay rejected. The current UI accepts natural-person B2C buyers; API also accepts foreign B2C identity. No browser can assert ETA validity.
- `buildReceipt(source, previousUUID)` in `eta-adapter.mjs` is `shop-ereceipt-1.2-v1`, deterministic, pure and EGP-only. `source.tax` is tax-foundation snapshot v1 with five-decimal components. It supports the ordinary T1 classifications admitted by tax foundation. Rates requiring more than two decimals, unrepresentable unit prices, legacy/disabled snapshots, inconsistent components and money-rounding differences fail explicitly. No recalculation from current settings, rounding patch, invented tax classification or currency conversion occurs. Fees and adjustment remain zero.
- The wire body is persisted as **text**, preserving numeric lexical forms and property order used in ETA serialization. A POS chain tail advances atomically with the prepared UUID, never from a browser. One immutable receipt per batch keeps tenant/POS and response reconciliation unambiguous. Each POS is processed serially; other POS devices can progress independently.
- `buildEinvoice(source, signer)` is a separate EGP B2B invoice v1.0 envelope/adapter. It requires a business receiver/address and a server CAdES-BES provider; without that provider it fails. It is not routed to the receipt outbox/endpoint. B2B dispatch remains unavailable until a supported invoice provider is integrated and verified; the UI states this limitation.
- Return adapter input uses `kind: 'return'` plus `original: {uuid, snapshotId, issuedAt}` and a frozen return component snapshot supplied by the future authorized returns workflow. It emits `referenceUUID` and original sales issuance time; it never reads a current rate. The returns owner must enforce cumulative returned quantities, original snapshot identity and financial reversals before invoking this pure adapter. This slice does not create a returns command or infer partial refund amounts.
- Invalid-document correction is `kind: 'correction'` with `invalidOriginal: {uuid, status: 'invalid', previousUUID}`. The adapter requires the original predecessor and emits `referenceOldUUID`; this is not a sale return. No correction command is exposed yet, and successful/valid documents cannot be rewritten.

## Outbox behavior

State flow: queued → prepared → submitting → submitted → valid/invalid/cancelled. HTTP 202 means **submitted**, never valid. Original source, wire payload/UUID, profile version and submission reference are immutable. Every transition/error change is audited. Durable short leases prevent competing workers; SQL serializes a POS while a predecessor remains pending. Authentication failures and explicit 401/429 responses use bounded backoff (and Retry-After); tokens are reused per tenant/POS/credential version and concurrent token requests share one authentication call. Submitted documents only poll the receipt-submission endpoint, checking individual UUID, seller and POS evidence.

A network timeout, 5xx, duplicate-submission response or malformed successful response may hide an accepted POST. It becomes `uncertain`, with no automatic resubmission. A crashed `submitting` lease also becomes uncertain. This deliberately favors duplicate prevention. A blocked snapshot requires operator review; a later profile edit never mutates its original source. Failed or uncertain predecessors hold that POS to protect its chain.

## Preproduction setup still required

No live credentials, hosted database writes, scheduled dispatcher or provider deployment are installed by this change. Apply the forward migration through the existing GitHub CI/provider integration after parent-owned staging integration. Deploy `shop-eta-dispatch` through the supported Shop Edge Function deployment path; do not introduce a second database deployer.

The Edge Function follows the existing server authorization pattern, accepting only the exact server credential. It is disabled unless server secret `SHOP_ETA_DISPATCH_ENABLED` equals `true`. Configure server secret `SHOP_ETA_PREPRODUCTION_POS` as a JSON array, one entry per authorized merchant/POS, containing these keys:

`shopId`, `deviceSerialNumber`, `rin`, `environment: "preproduction"`, `clientId`, `clientSecret`, `presharedKey`, `osVersion`, `modelFramework`, `credentialVersion`, `receiptSignatureMode: "eta-current-unsigned"`.

These are **server secrets**, never Nuxt public env variables, browser settings, logs or snapshots. Rotate the credential version when rotating POS access. The explicit receipt mode reflects the current official receipt contract's note that signature validation is not deployed pending ETA decision; it is not an eInvoice signing bypass. Reconfirm that contract with the provider before configuring it. Other signature modes fail closed. Endpoints are fixed to ETA preproduction identity/API hosts; production endpoints are intentionally unavailable.

A trusted scheduler must POST to `/functions/v1/shop-eta-dispatch` with server authorization. Each invocation claims at most one document; invoke at a suitable provider-approved interval with no overlapping unbounded fanout. Configure that scheduler through the supported host/provider path after infrastructure review. This workspace does not pretend automatic dispatch is running.

For an uncertain POST, find the actual submission reference in ETA/provider audit records. An operator can POST `{"reconcile":{"outboxId":"<outbox UUID>","submissionUUID":"<actual ETA submission ID>"}}` to the same server-only function. It fetches that submission, verifies document UUID, taxpayer and POS evidence, and only then atomically links the reference and resumes asynchronous status polling. No evidence means no unlock, no new POST and no claimed success.

Live activation gates are separate: taxpayer-specific mandate/channel review; registered, activated POS and B2C tag; official branch/activity/item/unit approval; applicable signing/provider setup (CAdES-BES for eInvoice); managed secrets and scheduled dispatch; external ETA acceptance and operational reconciliation evidence. None are inferred from saving settings or passing deterministic tests.

## Verification

`node --test apps/shop-suit/tests/unit/eta-submission.test.mjs` covers deterministic arithmetic/wire/UUID, fail-closed contracts, return versus correction, token isolation/reuse, 202/polling, retries and uncertain recovery. `node tooling/database/test-shop-eta-local.mjs` checks authorization, immutable data, replay and transitions against a disposable database. `node tooling/database/test-shop-eta-concurrency.mjs` exercises two actual PostgreSQL sessions. `.github/workflows/shop-eta-disposable.yml` applies the full migration history and exports regenerated public types. Browser cases are in `tests/e2e/eta-submission.spec.ts` (EN desktop/AR mobile). See the work-package record for actual final results.

Official documentation reviewed 2026-10-15:
- https://sdk.invoicing.eta.gov.eg/documents/receipt-v1-2/
- https://sdk.invoicing.eta.gov.eg/documents/return-receipt-v1-2/
- https://sdk.invoicing.eta.gov.eg/ereceiptapi/01-authenticate-pos/
- https://sdk.invoicing.eta.gov.eg/ereceiptapi/02-submit-receipt/
- https://sdk.invoicing.eta.gov.eg/ereceiptapi/06-get-receipt-submission/
- https://sdk.invoicing.eta.gov.eg/receiptissuancefaq/
- https://sdk.invoicing.eta.gov.eg/document-serialization-approach/
- https://sdk.invoicing.eta.gov.eg/integrationpractices/
- https://sdk.invoicing.eta.gov.eg/main-calculations/
- https://sdk.invoicing.eta.gov.eg/codes/tax-types/
- https://sdk.invoicing.eta.gov.eg/documents/invoice-v1-0/
- https://sdk.invoicing.eta.gov.eg/faq/
