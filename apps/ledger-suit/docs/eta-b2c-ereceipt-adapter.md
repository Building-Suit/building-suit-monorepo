# ETA B2C eReceipt adapter (LS-EG-003)

Status: **implemented locally for separately authorized preproduction verification; native SQL, security review, and actual ETA preproduction execution pending**, 2026-09-27. Not deployed, production-enabled, accountant/UAT accepted, or evidence of regulatory compliance.

## Approved scope and source boundary

LS-D-ERECEIPT-SCOPE approves a bounded adapter for eligible source documents already represented by Ledger Suit. The implemented contract supports only ETA sale receipt `s` v1.2 and a referenced return receipt `r` v1.2 for the existing Egypt/EGP/standard-domestic-14%-VAT boundary.

The adapter is not a POS, checkout, order, inventory, warehouse, procurement, manufacturing, or device-management system:

- the posted output `vat_document` and its journal remain the recognized accounting event; preparing, hashing, signing, submitting, polling, rejecting, or correcting a receipt creates no transaction;
- configuration requires an explicitly approved authoritative source system, B2C onboarding evidence, registered/active POS evidence, exact taxpayer/branch/device identity, and batch-signing certificate reference;
- preparation requires the source system ID and immutable source-document reference, capture time, buyer, payment method, and complete coded lines. Missing retail facts fail with `ETA_ERECEIPT_SOURCE_REQUIRED`; Ledger never derives lines, buyer, payment, or POS events from an inventory movement or aggregate journal;
- exact source line net/VAT totals must equal the immutable posted VAT document. Only `T1`/`V009`, 14%, EGP, GS1/EGS codes, and registered units are mapped;
- one posted VAT source can enter only one ETA fiscal channel: database guards prevent it from becoming both an eInvoice and an eReceipt or two valid eReceipts;
- a return requires both an existing linked posted VAT credit and the original sale's `valid` ETA preproduction receipt UUID.

This is the separate TAX-06 approval required by TAX-06; it does not broaden the VAT module. TAX-07 remains controlling: configuration, prepared JSON, local tests, or an accepted preproduction sample do not establish Egypt-tax compliance. INV-08 remains intact because the adapter consumes source evidence and never implements operational retail or inventory behavior.

## Selected official contract

Primary ETA material was rechecked on 2026-09-27:

- [Receipt v1.2](https://sdk.preprod.invoicing.eta.gov.eg/documents/receipt-v1-2/) and [Return Receipt v1.2](https://sdk.preprod.invoicing.eta.gov.eg/documents/return-receipt-v1-2/) define `s`/`r`, seller POS identity, buyer, item, payment, exact totals, and the required return reference.
- [Authenticate POS](https://sdk.preprod.invoicing.eta.gov.eg/ereceiptapi/01-authenticate-pos/) requires client credentials plus POS serial, OS version, model framework, and pre-shared key; only B2C-tagged taxpayers may submit.
- [Receipt issuance FAQ](https://sdk.preprod.invoicing.eta.gov.eg/receiptissuancefaq/) requires an active registered POS, a SHA-256 receipt UUID over the official canonical content, the prior receipt UUID for the same device, and a return-to-sale UUID link. It also describes correction through `referenceOldUUID`.
- [Serialization](https://sdk.preprod.invoicing.eta.gov.eg/document-serialization-approach/) applies ETA's uppercase, order-preserving canonical serialization to the entire receipt/batch as appropriate.
- [Submit Receipt Documents](https://sdk.preprod.invoicing.eta.gov.eg/ereceiptapi/02-submit-receipt/) uses `POST /api/v1/receiptsubmissions`, returns `202` plus submission/accepted/rejected identities, and documents an issuer CAdES-BES signature at batch level.
- [Receipt batch signature creation](https://sdk.preprod.invoicing.eta.gov.eg/receipt-batch-signature-creation/) confirms that eReceipt signs the canonical batch, unlike the eInvoice document-signature shape. ETA also states that receipt signature validation is currently not deployed. The adapter nevertheless supplies the documented issuer batch signature; it does not inherit the B2B signer or claim signature validation occurred.
- [Get Receipt Submission](https://sdk.preprod.invoicing.eta.gov.eg/ereceiptapi/06-get-receipt-submission/) defines asynchronous `InProgress`/`Valid`/`Invalid` status evidence.

## Identity, chaining, correction, and delivery

`organization_eta_ereceipt_profiles` is append-only and preproduction-only. OAuth client ID/secret, POS pre-shared key, and eSeal material remain server secrets. The Edge Function additionally compares `ETA_ERECEIPT_ISSUER_RIN` and `ETA_ERECEIPT_POS_SERIAL` to the immutable server snapshot before any network write. Production identity/API URLs fail closed.

Server-only settings are `ETA_ERECEIPT_CLIENT_ID`, `ETA_ERECEIPT_CLIENT_SECRET`, `ETA_ERECEIPT_ISSUER_RIN`, `ETA_ERECEIPT_POS_SERIAL`, `ETA_ERECEIPT_POS_OS_VERSION`, `ETA_ERECEIPT_POS_MODEL_FRAMEWORK`, `ETA_ERECEIPT_POS_PRESHARED_KEY`, `ETA_ERECEIPT_BATCH_SIGNER_URL`, and `ETA_ERECEIPT_BATCH_SIGNER_TOKEN`. Optional `ETA_ERECEIPT_IDENTITY_URL` and `ETA_ERECEIPT_API_BASE_URL` are allowlisted to the official preproduction hosts and cannot select production.

Each POS stream is serialized:

1. `prepare_eta_ereceipt_document` snapshots complete authoritative source data and posted VAT amounts. The first receipt uses an empty `previousUUID`; a later receipt waits until the preceding receipt is `valid` and uses its 64-character content UUID.
2. `eta-ereceipt` revalidates exact amounts, computes the official SHA-256 content UUID, records it, asks the separate HTTPS batch signer for an issuer CAdES-BES signature, and submits one receipt to the official preproduction endpoint.
3. Submission UUID, receipt UUID, long ID, status, errors, and provider payload evidence remain separate from accounting. A viewer can read evidence but cannot prepare or submit.
4. A linked return references the valid sale UUID. An invalid/rejected immutable snapshot may be superseded; the correction retains both the local `supersedes_document_id` and ETA `referenceOldUUID`, while preserving the original `previousUUID` predecessor.
5. Transport throttling/5xx/duplicate-delay errors use bounded retry (maximum five claims). A pending or failed chain blocks later receipts rather than fabricating a predecessor.

This conservative one-at-a-time chain is intentionally narrower than a production POS queue. Batch expansion, offline toolkit storage, unreferenced/international returns, late-submission requests, cancellation commands, QR/printing, notification endpoints, other receipt sectors/types, foreign currency, other taxes, and production are outside LS-EG-003.

## Security and enablement gate

Live enablement is impossible in this change: URL allowlists accept only ETA preproduction, and no deployment or hosted secret is configured. Before any later live authorization, the exact implementation and operating environment require:

1. genuine ETA preproduction authentication, sale, return, invalid/correction, polling, and retry evidence for the registered test POS;
2. independent security review of secret storage, signer isolation, certificate lifecycle, device binding, service-role RPCs, logs/provider payload retention, and incident/revocation handling;
3. current official-contract revalidation, accountant/product acceptance, explicit production authorization, and a separately reviewed production URL/credential change.

No item above has been claimed by this task.

## Verification record — 2026-09-27

| Check actually run | Result |
|---|---|
| `pnpm agent:preflight` | **Failed** before live state reporting (exit 1 wrapping 255); dependencies are absent, so fetch/GitHub state is unverified. No publication was attempted. |
| `git merge-base --is-ancestor 2e3c26b… HEAD` plus scoped tree/patch comparison | Literal ancestry returned 1; integrated ancestor `07dd278` has an identical Ledger tree and matching V2-IMP-013/014/015 patch IDs, satisfying the task's verified-equivalent clause. |
| `deno check` on the two shared eReceipt modules | **Passed**. The full Edge entrypoint check is separately blocked because the worktree lacks the `@supabase/supabase-js` npm dependency used by the existing HTTP helper. |
| `deno test --allow-env …eta-ereceipt-contract_test.ts …eta-ereceipt_test.ts` | **Passed: 8/8** contract and transport tests. |
| `deno lint` on all five new Edge/shared/test TypeScript files | **Passed**. |
| `pnpm check` | **Passed**: canonical design tokens, workspace boundaries, and 80 protected historical migrations. |
| `pnpm --filter @building-suit/ledger-suit typecheck` | **Blocked**: `nuxt: command not found`; the worktree dependency tree is absent. |
| `pnpm db:test:ledger` | **Blocked before database access**: `supabase: command not found`; dependencies and the CLI are absent, and local port 60322 has no responding database. The focused pgTAP fixture therefore remains unexecuted. |
| `git diff --check` and requirements JSON parse | **Passed**. |
| Actual ETA preproduction execution and security review | **Not run / pending**; no credentials, active test device, signer, or authorization was supplied. |

The SQL fixture verifies missing-source rejection, explicit POS/source profile, exact reconciliation, idempotency, sale/return/previous UUID links, invalid correction/supersession links, authorization, and unchanged transaction counts apart from the separately posted VAT return.
