# Shop B2B eInvoice submission follow-up

Status: in progress. B2C PR #316 stays independently reviewable; no staging merge or hosted changes owned here.
Branch/worktree: `codex/shop-suit/eta-b2b-submission`, `/workspace/shop-eta-b2b`.
Same-stack parent: returns PR #317, committed checkpoint `e9e3058afd5bee6980fcadfe92f155e53516446c`; inherited changes remain separately owned. No dirty/unpublished parent files copied. B2C CI mirror fix `4421c93d` incorporated explicitly into this child. Actual stg remains `4b4c3ca5ffed96e7d61f6eb5a60d04a52862aa0c` at initial preflight.

Scope: complete the missing B2B code path: immutable business receiver/queue contract; invoice-specific prepared/signed payload and provider-assigned document IDs; ERP OAuth transport; configured server CAdES-BES signing-provider adapter; asynchronous submission/status/reconciliation with the existing durable lease/audit/retry invariants; shared EN/AR queue/status UX; deterministic signing/provider, replay, authorization and concurrency tests. No fabricated signature or provider success. Credentials, signing material/provider service deployment and external ETA acceptance stay external, fail-closed setup. No live activation, production/main promotion or hosted writes.

Returns #317 owns return business commands. This follow-up will provide a read-only authorized original-document reference projection with channel, frozen source ID and provider document ID, so the returns owner can distinguish receipt returns from future invoice credit-note adapters. It does not implement return/refund commands or credit-note business logic.

Sources rechecked 2026-10-15: ETA invoice v1.0, signature creation, document serialization, eInvoice Submit Documents and Get Submission, common authentication, integration practices. Receipt/POS transport will remain separate from invoice/ERP transport.

Current B2B code is only the pure `buildEinvoice` envelope and injected signer contract. Completion will be assessed against actual final-head tests and published PR evidence, not possession of external credentials.
