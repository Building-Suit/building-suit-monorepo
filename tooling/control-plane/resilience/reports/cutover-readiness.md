# Control-plane resilience acceptance

Task: CP-RES-014

Cutover ready: **YES**

Mandatory scenarios: 37/37 passed. The deterministic harness used no destructive faults and did not contact or mutate live n8n.

| Scenario | Fault | Expected recovery | Observed recovery | Impl | Verify | Publish | Result |
|---|---|---|---|---:|---:|---:|---|
| interrupt-before-implementation-execution | controller exits after planning implementation but before execution creation | task-run → persist one execution → task-verify | task-run → task-run → task-verify | 1 | 0 | 0 | PASS |
| interrupt-during-implementation | controller exits while the persisted implementation execution is running | wait-external → task-verify | wait-external → task-verify | 1 | 0 | 0 | PASS |
| interrupt-after-implementation-success | controller exits after implementation success is persisted | task-verify | task-verify | 1 | 0 | 0 | PASS |
| interrupt-before-verification | controller exits immediately before verification invocation | task-verify | task-verify | 1 | 0 | 0 | PASS |
| interrupt-after-failed-verification | controller exits after a failed focused verification is persisted | task-retry → task-verify | task-retry → task-verify | 2 | 1 | 0 | PASS |
| interrupt-after-repaired-verification | controller exits after repair succeeds and before its confirmation verification | task-verify | task-verify | 2 | 1 | 0 | PASS |
| interrupt-after-passed-verification | controller exits after the authoritative verification pass is persisted | task-publish | task-publish | 1 | 1 | 1 | PASS |
| interrupt-before-commit | publisher exits before creating the task commit | create one commit → push-and-create-pr | resume publication → push_and_create_pr | 1 | 1 | 1 | PASS |
| interrupt-after-commit | publisher exits after the local task commit is created | reuse commit → push-and-create-pr | existing local commit → push_and_create_pr | 1 | 1 | 1 | PASS |
| interrupt-before-pr-creation | publisher exits after the remote branch is created but before draft PR creation | reuse remote branch → create-pr | matching remote branch → create_pr | 1 | 1 | 1 | PASS |
| interrupt-after-pr-creation | publisher exits after draft PR creation but before local publication completion | reuse-existing-pr | reuse_existing_pr | 1 | 1 | 1 | PASS |
| repeat-publication-reconciliation | publisher is invoked repeatedly against identical persisted remote state | reuse-existing-pr → reuse-existing-pr | reuse_existing_pr → reuse_existing_pr | 1 | 1 | 2 | PASS |
| transient-github-failure | GitHub API is temporarily unavailable during publication | wait-external → watch → resume supervisor | wait-external → watch → resume supervisor | 1 | 1 | 1 | PASS |
| transient-repository-failure | repository fetch is temporarily unavailable | wait-external → watch → resume supervisor | wait-external → watch → resume supervisor | 1 | 0 | 0 | PASS |
| fresh-task-auto-reconciliation | a freshly claimed task has no worktree and then no installed dependencies | task-prepare → prepare-dependencies | task-prepare → prepare-dependencies | 0 | 0 | 0 | PASS |
| active-controller-lease-collision | a second controller attempts ownership before the current lease expires | leave lease owner unchanged → wait | wait | 0 | 0 | 0 | PASS |
| expired-controller-lease-reclamation | the controller crashes and its durable lease expires | reclaim lease → probe dependency | reclaim lease → probe dependency | 0 | 0 | 0 | PASS |
| external-poll-retry-neutrality | the same unavailable dependency is polled twice | watch → watch | watch → watch | 0 | 0 | 0 | PASS |
| repeat-watcher-invocation | the watcher observes identical external state repeatedly | unchanged observation → bounded next wake | unchanged observation → 2026-10-02T12:01:00.000Z | 0 | 0 | 0 | PASS |
| focused-verification-isolation | an unrelated workspace check is failing outside the focused changed scope | skip unrelated check → preserve implementation retry budget | outside_focused_changed_scope → retry budget unchanged | 0 | 0 | 0 | PASS |
| focused-repair-exhaustion | focused verification keeps failing through the final allowed attempt | bounded repair → safety-stop | repair attempts 1-4 → safety-stop | 5 | 5 | 0 | PASS |
| milestone-required-check-contract | changed paths do not match a required milestone check | select required check | required_by_milestone_contract | 0 | 0 | 0 | PASS |
| evidence-backed-parent-satisfaction | task is already satisfied by verified parent lineage | complete without implementation | complete without implementation | 0 | 0 | 0 | PASS |
| unexplained-empty-diff | publication discovers an empty diff without parent-satisfaction evidence | bounded no-change review | handle-no-publishable-changes | 1 | 1 | 1 | PASS |
| publication-scope-before-implementation | a Shop task requests the shared UI path used by the BS-UI-ZN-PUBLIC-CHROME-001 class without explicit authority | wait before implementation → authorize exact shared path | wait before implementation → packages/ui/ | 0 | 0 | 0 | PASS |
| publication-scope-authorization-resume | a passed and verified task waits on the exact shared UI publication path | merge exact task scope → resume publication | packages/ui/ → task-publish | 1 | 1 | 1 | PASS |
| ambiguous-publication-scope | an unrelated product behavior file appears in the publication diff | wait-operator | apps/shop-suit/app.vue | 0 | 0 | 0 | PASS |
| authoritative-publication-readiness | an approved root structural path lacks exact task authorization before implementation | exact authorization required → ready without execution | exact_authorization_required → ready | 0 | 0 | 0 | PASS |
| protected-publication-readiness | a protected migration is approved but lacks distinct human authorization | protected authorization required → unexpected runtime file safety-stop | protected_authorization_required → unexpected_runtime_change | 0 | 0 | 0 | PASS |
| stop-request-safe-boundary | a stop request arrives after the current task reaches its persistence boundary | stop-requested → no new claim | stop-requested → no new claim | 0 | 0 | 0 | PASS |
| bounded-continuous-run | the configured task limit is reached after one completed task | success → task-limit | success → task-limit | 1 | 1 | 1 | PASS |
| repeat-supervisor-invocation | the supervisor is invoked twice against identical persisted state | task-verify → task-verify | task-verify → task-verify | 1 | 0 | 0 | PASS |
| control-database-transient-then-success | the first control-database connection attempt encounters a transient DNS failure | bounded backoff → repeat original command → continue same lifecycle | bounded backoff → attempt 2 → continue same lifecycle | 0 | 0 | 0 | PASS |
| control-database-transient-retries-exhausted | every bounded control-database connection attempt times out | bounded retries → wait-external → preserve task and run | 3 attempts → wait-external → preserve task and run | 0 | 0 | 0 | PASS |
| control-database-non-transient-rejection | the control database rejects authentication immediately | no retry → safety handling | 1 attempt → safety handling | 0 | 0 | 0 | PASS |
| generated-n8n-replacement-compatibility | generated BS-10, BS-20, and BS-21 fixtures are evaluated as cutover candidates | validate identities → reject retry graph → reject hardcoded registry | identities valid → no retry graph → no hardcoded registry | 0 | 0 | 0 | PASS |
| pre-cutover-live-export-integrity | the full acceptance suite runs beside the sanitized live-export baseline | same fixture digest before and after → no runtime mutation | 068636531fa71de2fb37944bc6b896dca827ab9f7268ee3dad6b1ecf87f460d7 → no runtime mutation | 0 | 0 | 0 | PASS |

The machine-readable companion records AI-call and retry-budget counts, failed assertions, and integrity evidence for every scenario.
