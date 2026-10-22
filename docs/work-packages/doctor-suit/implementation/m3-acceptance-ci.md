# Doctor M3 actual-service CI continuation

Status: implementation in progress; no new actual-service acceptance claimed.

The owner authorized continued Doctor implementation. The published M3 tasks already have independent PRs. This follow-up closes a verification gap without selecting a mobile platform or changing the canonical milestone contracts.

Doctor stack parent: PR438, `codex/doctor-suit/m4-001-platform-decision`, at `4241d0835c150b9fd4892fa87f6510eb897f86ae`; its worktree was clean. This branch is `codex/doctor-suit/m3-acceptance-ci`. Root PR401 remains blocked by required CI. No shared, Ledger or Shop work is copied into this branch.

The current Doctor workflow never invokes `operations-actual-provider.mjs`, and that runner still accepts a text summary for five tests despite ten M3 cases now existing. Add all ten actual-service journeys to the existing owned CI lifecycle, and require structured evidence for the exact task population with no skipped, missing, retried or failed cases. Retain every existing check and independent clinical/provider gate.

Local execution remains limited to source, unit and boundary diagnostics. Runtime/browser/provider execution belongs to GitHub's disposable runner; the executor's previous Supabase extraction capacity failure is not repeated. Capture only redacted case/status receipts, never Auth state, fixture credentials, mail bodies or raw browser reports.

The historical baseline remains 54 inherited Shop failures, plus separately recorded shared-settings and actual-provider limitations. A synthetic browser pass does not grant provider approval, clinical/legal acceptance, real-patient access, mobile admission, hosted migration or staging/main promotion. M4 platform and offline decisions remain open.
