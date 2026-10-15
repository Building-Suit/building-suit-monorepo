# Shop B2B eInvoice

This follow-up completes the code path beyond the pure envelope/signing callback in B2C PR #316. It supports domestic business receivers, EGP and tax-foundation v1 ordinary T1 components. Unsupported currencies, classifications, component precision and legacy sources still fail explicitly. It does not alter operational sales, original amounts or return/refund business commands. Saving configuration never activates a merchant or establishes compliance.

## Implemented contracts

- `save_eta_configuration` retains the common append-only merchant, branch address and item/unit-code contract. POS serial can be empty for an invoice-only branch. Receipt queueing still explicitly requires a real configured POS. Invoice preparation never invents a POS or advances a receipt UUID chain.
- `queue_eta_invoice(request, shop, invoice, receiver, reason)` requires existing manager identity, `settings.manage`, subscription/write access and invoice-location authorization. It freezes an explicitly confirmed business receiver `{type:'B', id, name, address:{country,governate,regionCity,street,buildingNumber}}` and reason onto the original immutable issuance source. Receiver RIN is nine digits and differs from the issuer. One original sale can be queued in one channel only. Request conflicts and incompatible replay fail. The creating actor is recorded.
- The shared outbox's `channel` distinguishes `ereceipt` and `einvoice`. Invoice jobs have no POS serial. Receipt claims/preparation/recovery remain receipt-specific. Invoice claim/preparation/acknowledgment/recovery use service-only RPCs; browser callers cannot assign external status or provider IDs. RLS and absence of direct table grants remain intact.
- `shop_eta_invoice_prepare` freezes the signed wire body, SHA-256 payload hash and public signing-certificate fingerprint before any potentially successful POST. Invoice document IDs are assigned by ETA, not generated as receipt UUIDs. `shop_eta_invoice_acknowledge` atomically records the 202 submission/document mapping. Signed payload and assigned identifiers cannot be rewritten.
- `createInvoiceClient` authenticates ERP client credentials with Basic authorization and `scope=InvoicingAPI`, caches tokens per shop/RIN/credential version, and uses only official preproduction document-submission/status endpoints. It does not send POS authentication headers.
- `createInvoiceDispatcher` signs only unprepared jobs, persists the result, then records `submitting` before POST. Successful submission is only `submitted`. Subsequent claims poll the submission and require matching submission ID, document ID, internal ID, issuer, receiver, type/version and total before applying individual status. Unknown/network/5xx/duplicate outcomes become uncertain and never automatically POST again. Explicit 401/429 failures use existing bounded retry/backoff.
- `createInvoiceReconciler` accepts an operator-discovered actual submission ID, verifies the same external document evidence, and links the provider-assigned document ID once. An aggregate valid status, unrelated document, different receiver or missing evidence cannot unlock an uncertain job.

## Signing adapter and reference provider

`createInvoiceSigner` calls an explicitly configured HTTPS server provider using a managed bearer credential. Protocol `shop-eta-cades-bes-v1` sends the unsigned document, its deterministic ETA canonical string, SHA-256 digest and expected certificate fingerprint. The response contains `algorithm:'CAdES-BES'`, Base64 `signature`, the same `documentHash` and `certificateFingerprint`. Document mutation or mismatched bindings fail closed.

The client verifies a narrowly supported detached RSA/SHA-256 CAdES-BES response: signed-data structure, SHA-256 digest algorithm, SDK digested-data content type, exact canonical-document digest, pinned certificate DER fingerprint, signingCertificateV2 hash and the RSA PKCS#1 v1.5 signature over signed attributes. Plain Base64 text is not accepted as a signature. Unsupported CMS encodings/algorithms are rejected. This is cryptographic integrity and certificate pinning, not automatic taxpayer registration, CA-chain/onboarding approval or ETA acceptance.

The optional reference provider is executable Shop-owned code at `signing-provider/server.mjs`. It performs actual OpenSSL CAdES signing and verifies the generated response before returning it. It is disabled without configuration and listens only on loopback behind an externally managed HTTPS reverse proxy. It never creates a live key/certificate, stores a private key in PostgreSQL, logs request bodies/secrets, or signs receipts. Requests require server authorization and exact issuer/certificate/document bindings. Temporary canonical/signature files are private and removed; external key/certificate files are not modified. One signing operation runs at a time, with a timeout and bounded body.

Reference server settings, provided only through managed server configuration:

- `SHOP_ETA_SIGNER_ENVIRONMENT=preproduction`
- `SHOP_ETA_SIGNER_RIN`, `SHOP_ETA_SIGNER_TOKEN`
- `SHOP_ETA_SIGNER_CERTIFICATE_PATH`, `SHOP_ETA_SIGNER_CERTIFICATE_FINGERPRINT`
- `SHOP_ETA_SIGNER_KEY_REFERENCE`: protected private-key file or an OpenSSL-supported `pkcs11:` URI. Inline `pin-value` is rejected; token/PIN access must use supported managed provider configuration.
- Optional `SHOP_ETA_SIGNER_OPENSSL_PROVIDER` for an installed PKCS#11 provider and `SHOP_ETA_SIGNER_PORT` (default 8321).

Run with Node >=22 and OpenSSL 3 with CAdES support: `node apps/shop-suit/signing-provider/server.mjs`. Actual registered eSeal, certificate, PKCS#11 module/device permissions, trust and HTTPS deployment remain operator-owned external setup. The checked tests generate disposable synthetic certificates solely for cryptographic test fixtures; no live signing material was created or requested.

## Dispatcher setup still external

Deploy `shop-eta-einvoice-dispatch` through the supported Shop Edge Function path. It uses existing exact server authorization and is disabled unless managed secret `SHOP_ETA_EINVOICE_DISPATCH_ENABLED=true`. Set server secret `SHOP_ETA_PREPRODUCTION_ERPS` to a JSON array of issuer bindings containing:

`shopId`, `rin`, `environment:'preproduction'`, `clientId`, `clientSecret`, `credentialVersion`, `signerUrl`, `signerToken`, `certificateFingerprint`.

All credentials/private-key access remain server-only. The public fingerprint and resulting public signature are audit metadata, not private keys. No public Nuxt variables or browser settings store these values. A trusted scheduler calls the invoice function's server-only POST endpoint. Each invocation claims at most one job. Recovery uses `{"reconcile":{"outboxId":"<job UUID>","submissionUUID":"<actual submission ID>"}}` on that same endpoint. No scheduler or service was provisioned here.

The code/configuration paths above are implemented; remaining external work is their supported deployment and managed configuration, actual registered certificate/device/provider access, real ERP credentials/authorization, verified official codes and preproduction ETA acceptance evidence. Production endpoints remain unavailable. Live activation additionally requires taxpayer-specific mandate/channel review and external acceptance. Credentials alone do not establish compliance.

## Stable seam for returns #317

`eta_original_document_reference(shop, invoice)` is an authorized read-only projection, version 1:

`{version, outboxId, invoiceId, snapshotId, channel, adapterVersion, documentUUID, submissionUUID, status, currency, issuedAt, payloadHash}`.

It enforces sale permission and location access, exposes no receiver/private credentials, and never changes a return/refund. `snapshotId` identifies the immutable original issuance source. `channel` must be checked: a receipt return references an original eReceipt UUID; an eInvoice requires a future credit-note adapter and cannot be sent as an eReceipt return. Missing/unvalidated original provider references remain unsupported for external linked exports. Return/refund commands, cumulative financial/FIFO allocation and credit-note business decisions remain owned by #317 and are not duplicated here.

## Verification boundary

Tests exercise real synthetic OpenSSL CAdES signatures, WebCrypto integrity verification, tampered content/hash/certificate rejection, ERP token isolation/reuse, durable prepare-before-submit, provider-assigned IDs, 202 versus validity, no repeated successful POST, retry/uncertain recovery, scoped permissions, immutable source/wire bodies, cross-channel replay denial and two PostgreSQL sessions behind a race barrier. Browser tests cover B2C and B2B in EN desktop/AR mobile, including invoice setup without a POS and explicitly confirmed business receiver. Actual final commands/results belong to `docs/work-packages/shop-eta-b2b-submission.md` and the PR checks. No external ETA submission or registered-certificate acceptance is represented by synthetic tests.

Official sources rechecked 2026-10-15:
- https://sdk.invoicing.eta.gov.eg/documents/invoice-v1-0/
- https://sdk.invoicing.eta.gov.eg/signature-creation/
- https://sdk.invoicing.eta.gov.eg/document-serialization-approach/
- https://sdk.invoicing.eta.gov.eg/api/01-login-as-taxpayer-system/
- https://sdk.invoicing.eta.gov.eg/einvoicingapi/01-submit-documents/
- https://sdk.invoicing.eta.gov.eg/einvoicingapi/09-get-submission/
- https://sdk.invoicing.eta.gov.eg/integrationpractices/
