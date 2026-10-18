# DOS-AE-011 — finite administrative-foundation candidate

This packet follows the normal merge of PR388 into `stg` at `ece702a4784dfd9f2712f6f720b76d23ccf5de2a`. The parent confirmed its post-merge CI and publication passed. Historical diagnosis in the earlier reconciliation record is retained; it does not describe this candidate's current acceptance.

The immutable source remains PR345 `4ca7110f4d6efa828e0b41213e5c059bf02ba9db`, with all nine plans unchanged. The independently verified Automation import (104 tasks, 117 requirements, 37 decisions, 244 edges) is untouched: no re-import, activation or task-state mutation is performed. Clinical PR366 at `f2df37d031a8192da8b7a23afc83f0977debec6b` remains excluded and held. Original M2 requires qualified clinical-policy acceptance; M3 depends on M2 acceptance. Original M6/M7 and a clinical or selling product are not completed by this synthetic edition.

## Preserved source checkpoints

The root review target is PR391. Integrate the committed child history into that existing root, preserve all branches and source work, and run full combined CI on the final root head before parent review/integration. This is a source-branch aggregation, not a protected `stg` merge or deployment. The parent remains the staging-merge coordinator.

| Task | Focused PR/checkpoint | Eligible technical result | Genuine gated remainder |
|---|---|---|---|
| AE-001 | scope through merged PR388 | finite administrative scope and dependency separation | no original clinical/commercial gate waived |
| AE-002 | foundations/admission through PR388 | nonclinical routes/RLS/Storage/Realtime exclusions, synthetic admission and independent grants | real-user admission and qualified policies |
| AE-003 | terms/trials/quotas through PR388 | immutable version/document, explicit trial and atomic allocation/expiry/owner UI | genuine prices/currencies/intervals/limits/lifecycle policy; no real offer seeded |
| AE-004 | [PR391](https://github.com/Building-Suit/building-suit-monorepo/pull/391), `19edfc817925649b483d5698812ea90ce9a87197` | exact owner-bound quotes, held intents, strict input/route closure | approved merchant/provider/manual route, custody and SaaS tax applicability |
| AE-005 | [PR392](https://github.com/Building-Suit/building-suit-monorepo/pull/392), `65ee4d4b92c89ed08febe24fad491cf751d99209` | immutable synthetic evidence/replay/conflict reconciliation, exact currency-separated reports and consistent snapshot | authenticated actual settlement, invoice/tax artifacts and configured renewal/cancel/reactivate implementation after approved inputs |
| AE-006 | [PR393](https://github.com/Building-Suit/building-suit-monorepo/pull/393), `36d49d1fb1ff9ae95c42acd0c1eb384c908862b3` | signed synthetic reads, committed nonce/audit, signed schema/replay denials and unavailable target projection | genuine binding/manifest/signing/operator policy, operational source/target adapters and separately approved account/grant commands |
| AE-007 | own-account intake through PR388 | coded review requests and independent own-account history | qualified rights/retention/holds/export/erasure policy and execution |
| AE-008 | isolated recovery through PR388, extended by migrations | encrypted isolated application-database restore, tamper rejection and ACL/RLS/history proof | approved objectives/custody and supported whole-provider/Auth/Storage recovery acceptance |
| AE-009 | [PR394](https://github.com/Building-Suit/building-suit-monorepo/pull/394), `955e2bfc64108193dcf762b55cfe8f57b18c9fad` | redacted coherent own-subscriber signals, review register and incident procedure | independent financial/security closure, thresholds/quota/costs/support and actual operational acceptance |
| AE-010 | [PR395](https://github.com/Building-Suit/building-suit-monorepo/pull/395), `d0d386706c3d63b1afb8e711c0d1cb124878acb3` | shared EN/AR subscription availability, scope-cleared diagnostics and privacy-review access | approved real-user presentation/acceptance; all live actions remain unavailable |
| AE-011 | this packet and final root PR391 | bounded provenance, aggregate automation and precise gate handoff | exact-final-head passing CI, parent technical review/stg merge and genuine launch acceptance |

These are preserved implementation checkpoints, not a claim that every gated acceptance case is complete. In particular, synthetic confirmation does not settle money, an operator grant is not payment, a database restore is not whole-service recovery, and CI is not qualified legal/security/financial approval.

## Review corrections retained

The report-snapshot finding has parent technical acceptance for exact source `65ee4d4b` and its deterministic old-code negative/fixed-code positive control. Full-population counts, currency groups and page rows now share one materialized statement snapshot across a real concurrent preparation commit.

The authenticated schema-denial correction is in `36d49d1f`: HMAC and envelope identity validation precede a committed nonce; operation/schema checks then produce a signed audited denial. Identical replay returns a signed 409 without another schema denial/domain read. Safe operation/version echoes and unknown nonce outcomes are covered. Its independent technical retest remains pending until the parent accepts it. Audit labels changed, while the executable three-read allowlist, absent endpoint/configuration and false operator/payment/live authority remain intact.

The [review register](review-register.v1.json) keeps these technical findings separate from unperformed independent financial/security reviews. Missing critical/high assessments remain null, with no self-issued closure or certificate.

## Automated acceptance contract

Use the existing maintained runners. Final receipts must be tied to the final root commit's GitHub check runs, not substituted from a prior checkpoint or an unrelated metadata/cancelled job. Record failures, expected skips and unrun scope distinctly in the root PR body after completion. This file deliberately makes no circular assertion about its own commit's future CI outcome.

| Required evidence | Maintained command/source | Recorded local scope before final root CI |
|---|---|---|
| Units and cross-product invariants | `pnpm test` | 1,952 pass; 23 explicit optional-infrastructure skips |
| SQL/RLS/real transactions | `node apps/doctor-suit/tests/disposable-postgres.mjs` | 1,276 assertions; 87 transaction/protocol-storage scenarios |
| Generated schema types | same runner `--types` / pinned PGMeta | generated from migrated disposable database; later constraint-only fixes change no type shape |
| Isolated encrypted restore | SQL runner recovery phase | 45 table fingerprints, schema/ACL/RLS/history and tamper rejection; no whole-provider qualification |
| Auth/adversarial browser protocol | Doctor workflow ordinary suite plus four slower-CPU/RPC cases | final-head CI required; focused subscription EN desktop/light and AR mobile/dark-preference cases pass locally |
| Actual disposable provider | `node apps/doctor-suit/tests/disposable-provider.mjs` | final-head GoTrue/Mailpit/PostgREST/Storage/Functions/Realtime and actual browser receipts required; SQL scaffolds do not replace this |
| Shared consumers | workspace verify, ordinary browsers, shared Shop and deployed-only changelog checks | Doctor/Docs type/lint/build and shared-template lint pass locally; full final root CI required |
| Ownership/provenance | `pnpm check`, `pnpm release:check`, preflight and PR policy | 108 complete templates, zero local components/debt, 80 historical migrations unchanged; no Doctor operational registration |

The actual-provider runner additionally covers exact quote transport and rejection of browser totals/currency/identity/URLs, held-intent replay, operator hold/clock-expiry staleness, synthetic financial report transport/source links, subscriber/delegated isolation, unchanged subscription and redacted unavailable readiness/operations. Actual payment-provider/merchant acceptance is **unrun**. Clinical/paid/live authority remains unavailable throughout.

All UI composition remains in `packages/ui`; apps own authorized projections, business rules and props. Existing shared root/auth fixes, product session isolation, clinical/legal exclusions and all planning/other work are preserved. No new Doctor asset or independent marketing work is included.

## Exact remaining launch inputs and blocked actions

- **AE-D02:** accountable commercial plan/version, price/currency/interval, trial, staff/location limits, renewal/grace/expiry/downgrade/history/refund/cancellation/effective-date policy. Publishing a real offer or implementing real paid lifecycle under guessed policy remains blocked.
- **AE-D03/D04:** actual merchant/entity/jurisdictions, approved provider or audited manual route, Doctor eligibility/currencies/costs/refunds, custody and qualified current SaaS tax-document applicability. Provider-dependent live checkout/settlement, account/credential/charge/callback activation and tax-compliance claims remain blocked.
- **AE-D05/D06:** qualified privacy/controller-processor/legal review, purposes/basis/consent/minors/caregivers, rights/retention/holds, providers/regions/subprocessors/transfers/support access. Real data admission, final legal text and broad export/retention/erasure execution remain blocked.
- **AE-D07:** genuine RPO/RTO, scope/custody/retention/permissions and supported actual recovery evidence. Whole-service recovery readiness cannot be claimed.
- **AE-D08/D09:** independent exact-candidate financial/security reviews and launch-blocker closure/retest, approved workloads/quotas/costs/incident/support ownership and limited administrative-user acceptance. No capacity/security/financial certification is supplied by these tests.
- **AE-D10:** approved public destinations, operational release registration/baseline, actual deployment/payment/recovery acceptance, residual risks and exact-candidate owner go/no-go. Real-user activation and paid/live-sale claims remain blocked. Main promotion remains outside authorization.

Doctor target/source bindings, secret-store/signing adapters, verified manifest and operator capability approval are also genuinely unconfigured. The user handles Vercel/Supabase connections; this packet does not create credentials, hosted migrations, manual deployments, DNS/security changes or provider resources. CI deployment/migration and hosted acceptance are separate from source merge. No home network/n8n access, external incident messaging or Automation activation occurs.
