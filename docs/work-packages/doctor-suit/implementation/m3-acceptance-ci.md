# Doctor M3 actual-service CI continuation

Status: CI integration implemented; actual-service execution pending GitHub. Review: PR442.

The owner authorized continued Doctor implementation. The published M3 tasks already have independent PRs. This follow-up closes a verification gap without selecting a mobile platform or changing the canonical milestone contracts.

Doctor stack parent: PR438, `codex/doctor-suit/m4-001-platform-decision`, at `4241d0835c150b9fd4892fa87f6510eb897f86ae`; its worktree was clean. This branch is `codex/doctor-suit/m3-acceptance-ci`. Root PR401 remains blocked by required CI. No shared, Ledger or Shop work is copied into this branch.

The parent Doctor workflow never invokes `operations-actual-provider.mjs`, and that runner still accepts a text summary for five tests despite ten M3 cases now existing. Add all ten actual-service journeys to the existing owned CI lifecycle, and require structured evidence for the exact task population with no skipped, missing, retried or failed cases. Retain every existing check and independent clinical/provider gate.

Local execution remains limited to source, unit and boundary diagnostics. Runtime/browser/provider execution belongs to GitHub's disposable runner; the executor's previous Supabase extraction capacity failure is not repeated. Capture only redacted case/status receipts, never Auth state, fixture credentials, mail bodies or raw browser reports.

The historical baseline remains 54 inherited Shop failures, plus separately recorded shared-settings and actual-provider limitations. A synthetic browser pass does not grant provider approval, clinical/legal acceptance, real-patient access, mobile admission, hosted migration or staging/main promotion. M4 platform and offline decisions remain open.

Validation: 468 Doctor unit tests pass, including eight structured-evidence regressions. The maintained operations configuration discovers exactly DOS-M3-001–010; its list-only JSON is correctly rejected as execution evidence. `pnpm check` passes for six Suits, 130 templates and 80 unchanged historical migrations; JavaScript syntax and workflow YAML parse pass. No local browser, provider or database service was started. The runner retains only fixed task IDs/status categories and an exact-head/base receipt; private JSON and fixture environments are not uploaded.

The existing workflow builds once. Both owned actual-service runners execute independently of earlier protocol failures and preserve cleanup/resource ownership; any failing mandatory step still fails the job. The timeout is bounded at 60 minutes to include both service lifecycles. No `continue-on-error`, retries, removed cases or reduced assertions were introduced.
