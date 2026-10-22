# Doctor M3 actual-service CI continuation

Status: CI integration implemented; actual-service execution pending GitHub. Review: PR442.

The owner authorized continued Doctor implementation. The published M3 tasks already have independent PRs. This follow-up closes a verification gap without selecting a mobile platform or changing the canonical milestone contracts.

Doctor stack parent: PR438, `codex/doctor-suit/m4-001-platform-decision`, at `4241d0835c150b9fd4892fa87f6510eb897f86ae`; its worktree was clean. This branch is `codex/doctor-suit/m3-acceptance-ci`. Root PR401 remains blocked by required CI. No shared, Ledger or Shop work is copied into this branch.

The parent Doctor workflow never invokes `operations-actual-provider.mjs`, and that runner still accepts a text summary for five tests despite ten M3 cases now existing. Add all ten actual-service journeys to the existing owned CI lifecycle, and require structured evidence for the exact task population with no skipped, missing, retried or failed cases. Retain every existing check and independent clinical/provider gate.

Local execution remains limited to source, unit and boundary diagnostics. Runtime/browser/provider execution belongs to GitHub's disposable runner; the executor's previous Supabase extraction capacity failure is not repeated. Capture only redacted case/status receipts, never Auth state, fixture credentials, mail bodies or raw browser reports.

The historical baseline remains 54 inherited Shop failures, plus separately recorded shared-settings and actual-provider limitations. A synthetic browser pass does not grant provider approval, clinical/legal acceptance, real-patient access, mobile admission, hosted migration or staging/main promotion. M4 platform and offline decisions remain open.

Validation: 473 Doctor unit tests pass, including eight structured-evidence and five pinned-registry regressions. The maintained operations configuration discovers exactly DOS-M3-001–010; its list-only JSON is correctly rejected as execution evidence. `pnpm check` passes for six Suits, 130 templates and 80 unchanged historical migrations; JavaScript syntax and workflow YAML parse pass. No local browser, provider or database service was started. The runner retains only fixed task IDs/status categories and an exact-head/base receipt; private JSON and fixture environments are not uploaded.

The existing workflow builds once. Both owned actual-service runners execute independently of earlier protocol failures and preserve cleanup/resource ownership; any failing mandatory step still fails the job. The timeout is bounded at 60 minutes to include both service lifecycles. No `continue-on-error`, retries, removed cases or reduced assertions were introduced.

Focused registry diagnostics reproduce GHCR throttling for the existing pinned PostgreSQL Meta image. The official ECR mirror returns the identical immutable digest; upstream release metadata confirms both registries. The SQL runner now selects that exact digest on the official mirror only after a transient primary failure, with at most three total pulls. Authentication, permission and policy denials never trigger fallback. Schema/type generation remains mandatory and failed pulls cannot report acceptance. No local database or provider service was started for these diagnostics.

GitHub review on source `39e03576348766dbfc3efe8dba7ed42156d0fb1c` (run39840928157) reports 2,181 tests: 2,104 passed, 54 failed, 23 skipped. All failure products are Shop; its source is unchanged. Doctor run39840928047 reports SQL failure while browser setup is pending; its exact completed archive is still needed. The earlier staging archive run39834273969 confirms SQL/concurrency/recovery passed before the pinned Meta registry failure. Do not infer that the current run has the same cause until its logs are available.
