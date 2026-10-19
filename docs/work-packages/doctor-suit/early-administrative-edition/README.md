# Early administrative edition

This is a new, owner-authorized edition before the full clinical roadmap. Its reference is [scope.v1.json](scope.v1.json): **11 new DOS-AE tasks and 46 new acceptance cases**. It starts from stg `8cabe8c57b9a6c682bba4868b3af0b0f3a640af3`, with verified M1 and follow-ups #367/#368. The nine original plans remain byte-identical to PR345 head `4ca7110f4d6efa828e0b41213e5c059bf02ba9db`. Nothing here imports or activates Automation or marks original M2/M3/M6/M7 requirements complete.

The edition includes appointments, private administrative queues, staff/location permissions and basic patient administration. It brings forward the minimum Doctor SaaS subscription, privacy, recovery and operational controls. It excludes clinical records/prescribing, document uploads/access, clinical/free-text notes, imports, outbound messages, patient charges/collection and mobile apps. Historical code and data are retained. Clinical review #366 remains separate and unapproved. Administrative appointment/patient information still needs its own qualified privacy, hosting, security and real-user acceptance.

## Source and dependency separation

| Source | Early edition extraction | Boundary retained |
|---|---|---|
| M1-006–020 | Existing independent Doctor identity, owner practice, secretary grants, locations, patient administration, scheduling, audit and tested administrative journeys | Fresh session/tenant/location checks, private queue, scoped Realtime, booking exclusion/idempotency and history remain authoritative |
| M6-001 → 002 | AE-003 Doctor commercial contract and server entitlement/quota enforcement | No copied Shop prices, trial, quota, expiry or refund defaults; doctor is subscriber, secretary remains independent staff |
| M6-003 → 004 → 005 | AE-004/005 SaaS quote/payment route, authenticated evidence, reconciliation, lifecycle and settings | Missing terms/merchant/provider approval keeps payment unavailable; pending/redirect/unknown state cannot activate access |
| M6-006/007 | Deferred | No patient service prices, visit charges, patient collections, allocations or receipts |
| M6-008 | AE-004 qualified tax applicability for this SaaS entity/business model | No assumed exemption, Shop tax-policy reuse, compliance badge or tax submission adapter |
| M6-009/010 | AE-005/011 SaaS-only settlement/discrepancy reporting and financial acceptance | Patient revenue remains deferred; exact amounts/currencies, immutable entries and independent financial review remain required |
| M7-001/002/004 | AE-007 qualified edition privacy/data-flow review and identity-verified rights workflows | No guessed lawful basis, consent text, retention duration, transfer permission, automatic erasure or unrestricted export |
| M7-003/009 | AE-002/010/011 administrative real-user boundary and limited user acceptance | No clinical gate waiver or fabricated participant/pilot approval; administrative live use has its own accountable acceptance |
| M7-005 | AE-009 independent security assessment and remediation | Synthetic tests and developer review are not security certification; no developer waiver of critical/high launch blockers |
| M7-006 | AE-008 supported backup/restore qualification | Functional disposable restoration, approved objectives and actual hosted recovery are separate evidence |
| M7-007/008/010 | AE-009/011 redacted operations, incident handling, measured limits and exact-candidate go/no-go | No invented thresholds/cost/capacity, manual deployment, hosted mutation, production activation or main promotion |

Original M6-001 depends on M3-010. M7-001 depends on M1-020, M2-014, M3-010 and M6-010; M7-010 requires the complete original web milestone set. Those dependencies are **not satisfied or removed** here. New AE tasks have new edition-specific dependencies, acceptance and approval scopes. M6-009 is only a source for reconciliation principles; its practice-revenue acceptance is not claimed.

## Implementation order and genuine gates

1. **AE-001:** this scope/source/dependency reference and operator decision packet.
2. **AE-002:** server-enforced edition, capability/data projections and excluded-feature denial. Current M1 reschedule/cancel free-text reason must become a fixed administrative reason code for this edition, preserving attributed historical records.
3. **AE-003:** versioned configurable Doctor terms, subscription/entitlement state and atomic quota admission. Missing commercial terms remain unset.
4. **AE-004/005:** exact SaaS quote/intents, approved route interface, verified settlement/replay/reconciliation and configured renewal/cancellation settings. A test provider is not actual merchant/provider evidence.
5. **AE-006:** Doctor-isolated signed control-plane account/plan operations. No Shop identity, subscription or financial data is migrated or reset.
6. **AE-007/008:** privacy request/consent-policy boundaries, supported backup and isolated restore verification.
7. **AE-009/010:** operational/security review evidence and honest EN/AR administrative onboarding/billing presentation, with shared UI ownership.
8. **AE-011:** one exact-candidate aggregate and independent acceptance. Parent coordinates its reviewed passing merge into stg. A merge is not deployment, real-data admission or readiness to sell.

[Operator decisions](operator-decisions.md) are deliberately unresolved. Code can implement generic, synthetic, fail-closed foundations while those inputs are collected. Do not invent a provider-specific merchant contract, execute held live operations or change a pending approval to approved merely because its schema or tests exist.

## Reuse and isolation

The shared administration protocol in `packages/contracts/src/administration.ts` and [trust/adapter contract](../../../architecture/super-admin-trust-adapter-contract.md) provide the signed binding/manifest, operator authorization, exact request replay and audit model. Existing SAS account helpers and target payment/account RPCs are Shop-specific; they are reference implementations, not a Doctor API. Doctor needs its own target-owned capabilities and verified environment binding, without importing another app or sharing Auth sessions/keys. Any shared extension must retain Shop behavior, original trial/paid periods, immutable receipts and subscription history under regressions.

Existing owner onboarding is Doctor-owned and may be reused without linking identities by email. An operator activation/grant remains distinct from verified payment; a source UI may never manufacture a paid receipt or confirmed identity. User manages Vercel/Supabase connections; their actual configuration/eligibility remains unverified here.

The supported recovery design distinguishes database rows from Storage bytes and Auth/function/provider settings. Supabase's [backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) and [restore scope](https://supabase.com/docs/guides/self-hosting/restore-from-platform) require separate treatment of provider-managed customization and Storage objects/configuration. Existing Shop disposable restore fingerprints are useful mechanics, not Doctor hosted recovery evidence. No backup source, hosted target, custody key, RPO or RTO is guessed.

## Verification and release handling

The scope verifier checks source hashes, new IDs/dependencies, source references, exclusions, unset commercial terms and pending live gates. It verifies the reference, not implementation or a domain approval. Later tasks need real stateful unit/SQL/concurrency/browser/provider checks and exact-candidate receipts, with failed/skipped/unrun obligations kept visible.

Keep all templates/components in `packages/ui`, interactions in `packages/ux`, and app logic/props in Doctor. Append new task fragments; preserve accepted fragments and unrelated work. Do not activate Doctor release registration or invent an operational baseline to satisfy provenance. Prepare one aggregate after agreed code and checks pass; keep paid/live activation unavailable until all exact-candidate evidence and owner go/no-go exist. Independent marketing work is outside this stack.
