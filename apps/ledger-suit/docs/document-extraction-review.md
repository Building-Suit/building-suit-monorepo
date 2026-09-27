# LS-GROWTH-001 — provider-neutral document extraction review

Status: **IMPLEMENTED LOCALLY / PROVIDER DISABLED**, 2026-09-27.

This delta defines `ledger.document-extraction.v1` as an ingestion boundary for optional document extraction. An authorized importer selects a PDF/image and a JSON proposal, sees every candidate-level error and field-level confidence/evidence value, edits the proposed fields, and explicitly attests that all required fields were compared with the source. Rejecting clears the local proposal. Accepting moves string values into the existing import mapping; it does not post anything.

No OCR or AI provider, endpoint, SDK, paid service, background transfer, or automatic extraction is configured. Both selected files remain in the browser until the user explicitly stages the reviewed rows. At that point the source document uses the existing private `attachments` bucket and reservation/commit RPCs with `entity_type = 'import'` and the server-created import-batch ID. The proposal rows use the existing `create_csv_import_batch`, `validate_csv_import_batch`, and `confirm_csv_import_batch` contracts. Only the final, separate confirmation can invoke the ordinary balanced posting engine.

## Contract and provenance

The proposal is JSON with `contract: "ledger.document-extraction.v1"`, optional source filename/SHA-256 metadata, and 1–100 candidates per document. Each known import field is `{ "value": "...", "confidence": 0..1 | null, "evidence": "..." }`; candidate errors are explicit code/message objects. Values, including amounts and exchange rates, must be strings. Numeric JSON monetary values are rejected rather than rounded. Field and error lengths are bounded so every provenance-rich row remains below the existing staged-row payload limit.

The browser computes the selected document's SHA-256 digest. When source metadata is supplied, filename and digest must match before acceptance. Each staged raw import row preserves the contract version, actual filename/MIME/size/digest, candidate number, extraction errors, field confidence/evidence, corrected-field list, and original values for corrected fields. These unmapped provenance cells are retained by the existing import evidence model but cannot become ledger fields.

## Acceptance traceability

| Acceptance criterion | Implementation evidence |
|---|---|
| Existing tenant-safe attachments and posting contracts are reused | Source upload uses `reserve_attachment_upload`, private Storage, and `commit_attachment_upload` against the import batch; reviewed rows use the unchanged CSV batch validation/confirmation and shared posting engine. |
| Confidence/errors and editable proposed fields are clear | Every known field is editable and shows high/medium/low/not-supplied confidence plus optional evidence; candidate errors remain visible. Low confidence never blocks correction or silently substitutes a value. |
| User validates all required fields before normal financial approval | Acceptance is disabled until type, date, amount, account, and category are nonempty for every candidate and the explicit source-comparison attestation is checked. Server validation and the existing separate post confirmation still follow. |
| No paid provider, data transfer, or auto-posting without approval | No provider integration exists. The UI states the boundary, performs only local parsing/hash/review before explicit staging, and exposes no extraction-to-post path. |
| CORE-03 / CORE-07 | Backend validation, balanced posting, tenant/capability checks, attachment isolation, exact string money, import audit evidence, currencies, and immutable posted history remain owned by their existing contracts. No migration or posting function changed. |

## Verification

- PASS — complete Ledger unit suite: 24 test files, zero failures/skips, including the 4 focused document-extraction cases.
- PASS — English and Arabic locale JSON parsing.
- PASS — Ledger Nuxt typecheck, full app lint, and production build.
- PASS — design-token and workspace-boundary checks; 80 historical migrations unchanged.
- PASS — `git diff --check`.
- BLOCKED BEFORE BROWSER COLLECTION — focused Playwright coverage was added for human correction, exact money/provenance, private attachment reservation/upload/commit, and normal import validation, but the sandbox rejects the required local server bind with `listen EPERM 127.0.0.1:3210`.
- Provider execution is intentionally impossible: no provider is selected or approved by LS-D-OCR-SCOPE.

No migration, hosted database operation, provider transfer, paid service, deployment, push, merge, commit, or accountant UAT occurred.
