# DOS-AE-005 manual-payment reconciliation

Starting candidate: `stg` `9d00cc7cdf4438090afe55be65cd8f691d093ba3` (2026-10-18), after PR398 (auth entry, DOS-M1-006) and PR397 (manual notices, private receipts, independent bank review and separate synthetic activation, DOS-AE-004). Both source and post-merge checks passed. This extends the separate manual ledger; the older held-intent synthetic-event report remains historical evidence.

The read-only RPC derives notice rows, immutable evidence links and full filtered totals in one statement snapshot. Dates select **notice creation in UTC**, inclusive start/exclusive end. Latest review status is observed when the report runs; receipt, verification and activation may occur later than notice creation. This is a notice cohort report, not a bank cash-flow statement. Currencies and minor-unit exponents remain separate; exact numeric totals are decimal strings. Submitted/rejected claims, independently verified funds, activated funds and verified funds awaiting activation have distinct totals. Attention and binding discrepancies remain visible. No payment image or claim establishes funds or entitlement.

Owner mode includes only that subscriber's notices; practice delegation and editable metadata grant no financial access. Review mode requires the existing independently approved, unexpired Doctor reviewer grant. Every read revalidates the actual Auth session and synthetic admission. Raw ledger tables, anonymous and service-role report calls remain denied. The report grants no mutation or evidence-download authority.

## Current implementation boundary and remaining tasks

| Canonical task/requirement | Current safe implementation / remaining gate |
|---|---|
| DOS-M1 foundation; DOS-M1-006 | Administrative/auth implementation on stg; synthetic CI acceptance only. No real-patient admission or production readiness implied. |
| DOS-AE-004; M6-004 | Synthetic manual instruction/claim, private evidence, independent received-funds review and separate inactive-account activation implemented by PR397. Actual beneficiary, merchant eligibility, accountable reviewer grants and policy evidence remain required for live operation. |
| DOS-AE-005; M6-009 | This task adds manual-ledger reconciliation and stable source navigation. Exact candidate independent financial review remains pending. No SaaS/patient-revenue mixing or currency netting. |
| M6-005 lifecycle | Existing versioned policy/status and historical read access can be displayed; actual renewal/grace/expiry/downgrade/cancellation/refund execution needs approved Doctor policy and effective dates. Do not invent financial outcomes. |
| DOS-M2 clinical tasks | Held PR366 remains unchanged. Qualified clinician signoff, governed catalogue/licence evidence and clinical/legal requirements remain unresolved. Administrative engineering does not satisfy them. |
| Original DOS-M3 tasks | Original milestone depends on M2. Administrative availability/appointments/queue can be verified independently without declaring M3 complete. Consent-bearing communications, providers, imports and clinical documents retain their own gates. |
| AE-D05–D10 / M6-010 | Qualified privacy/hosting/retention review, independent security/financial review, actual recovery objectives/custody, administrative user acceptance and exact-candidate go/no-go remain external inputs. Main promotion is outside authorization. |

This is an implementation reconciliation, not a change to the nine authoritative plans at PR345 head `4ca7110f4d6efa828e0b41213e5c059bf02ba9db` or their verified Automation records (104 tasks / 117 requirements / 37 decisions / 244 edges). Automation was neither imported nor activated. Earlier dated tracker entries are historical; no acceptance or original milestone state is inferred from this document.

## Exact operator inputs for live payment configuration

The approved introductory catalogue is Starter **EGP 299/month or 2,990/year**, one clinic/five named users including owner; Clinic **599/5,990**, three clinics/ten users; Group **999/9,990**, five clinics/25 users. Annual periods cover twelve calendar months for ten monthly payments; setup fee is zero. Future standard features are included as released within capacity, without a feature-addon charge, lifetime price, unlimited usage, provider-cost or release-date promise. These price/capacity approvals do not supply the following missing inputs:

- Verified actual InstaPay recipient IPA or registered mobile, beneficiary legal name, merchant/legal entity and jurisdictions, Doctor eligibility/currency/cost/refund/custody evidence.
- Actual independent Doctor reviewer user UUIDs, accountable approval reference and grant expiry; approved activation policy/version.
- Versioned trial enablement/duration (if any), renewal/grace/expiry/downgrade, cancellation/refund effective dates and qualified SaaS tax/legal documents. No universal fourteen-day trial was approved.
- User-managed Doctor Vercel/Supabase connections and qualified privacy/security/financial/recovery/launch acceptance.

No credential belongs in chat, source, browser props, logs or this document. Until these inputs and acceptance gates are resolved, configuration remains disabled/unconfigured and fixtures remain synthetic. No hosted migration, manual deployment, provider provisioning or main promotion is part of this task.
