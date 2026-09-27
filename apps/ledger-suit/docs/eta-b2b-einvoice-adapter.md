# ETA B2B eInvoice adapter (LS-EG-002)

Status: **implemented locally for separately authorized preproduction verification; native SQL and actual ETA preproduction execution pending**, 2026-09-27. Not deployed, production-enabled, accountant/UAT accepted, or evidence of regulatory compliance.

## Approved boundary

LS-D-ETA-SCOPE authorizes one bounded adapter from Ledger's existing posted Egyptian output-VAT evidence to the Egyptian Tax Authority (ETA) domestic B2B eInvoice contract. The implemented document types are ETA invoice `i` v1.0 and a linked full credit note `c` v1.0. B2C eReceipts, export/import documents, debit notes, partial credits, cancellation/rejection commands, return filing/payment, production ETA access, intermediaries, and registration changes remain outside this task.

The accounting boundary is unchanged:

- `vat_documents` and its linked posted journal remain the sole recognized amounts. Preparing, signing, submitting, retrying, polling, rejecting, or validating an ETA document creates no transaction and changes no posted VAT evidence.
- A posted aggregate receivable or VAT obligation is not a fiscal invoice. `prepare_eta_b2b_document` requires receiver identity/address plus at least one GS1/EGS-coded fiscal line with unit, exact quantity, unit value, sales, discount, net and VAT amounts. Line net and VAT must equal the immutable posted source exactly.
- Only output VAT invoices and their existing exact full credits are eligible. A credit can be prepared only after its source invoice has a recorded `valid` ETA preproduction UUID.
- The adapter uses only `T1` / `V009`, 14%, EGP, Egyptian business issuer and receiver, reflecting the already approved standard-domestic VAT boundary. It does not broaden tax applicability.

This is a TAX-06 external integration approved separately from V2-IMP-013. TAX-07 remains controlling: fields, a prepared payload, a local test, or even one accepted preproduction document does not establish complete Egypt-tax compliance.

## Authentic prerequisites before an ETA write

`configure_eta_preproduction` requires append-only evidence for the exact organization and effective date:

- an existing effective `organization_vat_profiles` registration whose number is the ETA issuer identity;
- ETA preproduction onboarding evidence and verification date;
- registered issuer name, ETA branch code and address, and current ETA taxpayer activity code;
- a reference to the issuer signing certificate/eSeal. The reference is audit metadata only; no certificate or private key is stored in PostgreSQL;
- server-only OAuth client ID/secret and a server-side HTTPS signer holding the authorized CAdES-BES material.

The Edge Function additionally compares `ETA_ISSUER_REGISTRATION_NUMBER` with the immutable snapshot before signing. This prevents a deployment configured for one taxpayer from submitting another organization's document.

Runtime secrets are server-only: `ETA_CLIENT_ID`, `ETA_CLIENT_SECRET`, `ETA_ISSUER_REGISTRATION_NUMBER`, `ETA_SIGNER_URL`, and `ETA_SIGNER_TOKEN`. Optional URL settings cannot select production: the code accepts only `https://id.preprod.eta.gov.eg/connect/token` and `https://api.preprod.invoicing.eta.gov.eg`. Production URLs fail closed with `ETA_PRODUCTION_NOT_AUTHORIZED`.

## Adapter flow and recovery

1. Prepare an immutable fiscal snapshot with `prepare_eta_b2b_document`. Exact amounts remain decimal strings/integer minor units through reconciliation; ETA JSON numbers use raw exact serialization rather than JavaScript `Number` coercion.
2. Call `eta-einvoice` with `action: "submit"`. The authenticated RPC checks `eta.submit`, claims the document once, and returns only its server snapshot.
3. The Edge Function validates the complete snapshot again, sends it to the configured HTTPS signer, and accepts only a returned CAdES-BES signature value. The signer cannot return or mutate document fields.
4. The adapter caches the OAuth client-credentials token for its lifetime, submits one signed JSON document to `POST /api/v1.0/documentsubmissions/`, and records the `202` submission/document IDs. It never resubmits after a 20x response.
5. `action: "poll"` calls the submission-level `GET /api/v1.0/documentsubmissions/{uuid}` endpoint after asynchronous processing. It records `processing`, `valid`, `invalid`, `rejected`, or an externally caused `cancelled` status in the separate delivery state/event stream.
6. Network/429/5xx/ETA duplicate-delay responses enter bounded `retry_wait` with provider `Retry-After` capped at one hour. A document has at most five claims. Local schema/source/signing errors are terminal `failed`; ETA `invalid`/`rejected` results are terminal for that immutable snapshot. A corrected snapshot may explicitly supersede only one of those failed results while retaining both histories. Posted books are never altered.

Provider payloads are retained as bounded operational evidence, but credentials, access tokens and signing material are never persisted. Users read status through tenant-scoped RLS; only the service-role worker RPC can record provider results. This task implements official submission polling, not the optional public ERP callback endpoints.

## Official contract snapshot

Rechecked on 2026-09-27 against ETA primary material:

- [ETA preproduction endpoints and root-certificate prerequisite](https://sdk.invoicing.eta.gov.eg/faq/): preproduction uses the separate identity and System API hosts; its test root certificate is required by the executing environment.
- [OAuth taxpayer-system authentication](https://sdk.invoicing.eta.gov.eg/api/01-login-as-taxpayer-system/): OAuth 2.0 client credentials, bearer token, and token reuse for its reported lifetime.
- [Invoice v1.0](https://sdk.invoicing.eta.gov.eg/documents/invoice-v1-0/) and [credit note v1.0](https://sdk.invoicing.eta.gov.eg/documents/credit-note-v1-0/): issuer/receiver, activity, coded lines, totals, prior-invoice references, and signatures.
- [Tax types](https://sdk.invoicing.eta.gov.eg/codes/tax-types/) and [unit types](https://sdk.invoicing.eta.gov.eg/codes/unit-types/): ETA code-table values used by submitted lines. A caller must supply an actually published GS1/EGS item code and valid unit code; local syntax validation does not claim ETA publication.
- [Signature creation](https://sdk.invoicing.eta.gov.eg/signature-creation/): canonicalization, SHA-256, issuer CAdES-BES signature, and embedding the Base64 signature.
- [Submit Documents](https://sdk.invoicing.eta.gov.eg/einvoicingapi/01-submit-documents/): `202`, submission/document identifiers, synchronous rejection, duplicate delay, and no resubmission after accepted processing.
- [Get Submission](https://sdk.invoicing.eta.gov.eg/einvoicingapi/09-get-submission/) and [integration practices](https://sdk.invoicing.eta.gov.eg/integrationpractices/): asynchronous submission-level polling and final document status; token reuse and avoidance of document-by-document polling/repeated submissions.

ETA's SDK landing page displays an older “Last Update” label while individual pages/files have newer publication metadata. Actual preproduction execution must query/confirm then-active document schemas and code-table values; this local snapshot is not a substitute.

## Verification assets and remaining evidence

- Deno contracts: `eta-einvoice-contract_test.ts` verifies exact large amounts, line reconciliation, credit references and request boundaries; `eta-einvoice_test.ts` verifies the signer boundary, OAuth token reuse, asynchronous `202`, throttling/retry classification and production fail-closed behavior.
- SQL: `71_eta_b2b_einvoice_adapter_test.sql` covers prerequisites, refusal of aggregate-only input, exact snapshot reconciliation, idempotency, server-only state transitions, no adapter-created journals, B2B credit linking, capabilities and tenant isolation.
- The Edge Function type-check depends on the workspace npm dependency tree. The pure contract and transport modules can be checked independently with Deno.

Actual ETA preproduction evidence is intentionally still missing: no taxpayer onboarding artifacts, client credentials, signer/eSeal, ETA-valid item codes, preproduction trust setup, or designated test document were supplied. Therefore no external submission was attempted. Separately authorized live enablement must follow successful preproduction evidence, security review, operational ownership and an explicit production/deployment decision.

## Checks actually run

| Check | Result |
|---|---|
| `deno test --no-lock --allow-env ...eta-einvoice-contract_test.ts ...eta-einvoice_test.ts` | **Passed:** 8 tests, 0 failures. |
| `deno check --no-lock ...eta-einvoice.ts ...eta-einvoice-contract.ts` | **Passed.** The complete Edge entrypoint additionally imports `@supabase/supabase-js`; its check was attempted and blocked because this worktree has no installed npm dependencies. |
| `deno lint` for the five new function/contract/test files | **Passed.** |
| `pnpm check` | **Passed:** canonical tokens, workspace boundaries, and 80 protected historical migrations unchanged. |
| Requirements JSON parse, trailing-whitespace scan, `git diff --check` | **Passed.** |
| `pnpm db ledger-suit start` | **Blocked before startup:** the Supabase CLI is absent because `node_modules` is not installed. Direct Docker inspection also failed with permission denied on `/var/run/docker.sock`; therefore `71_eta_b2b_einvoice_adapter_test.sql` remains unexecuted. |
| ETA preproduction submission/poll | **Not run:** authentic onboarding, OAuth, eSeal/signer, code-table data, trust setup and an authorized fixture are absent. |
