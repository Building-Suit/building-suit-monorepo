# Durable unattended recovery

PostgreSQL owns run attribution, admissions, transitions, executions, gates and runtime_operations. BS-10 and task-supervise use one state machine. BS-31 wakes existing bounded runs every minute; it creates no runs. BS-00 uses persisted n8n Wait for transport/control-database retry.

One unfinished operation per task has a stable operation ID and separate infrastructure generation. Detached workers hold kernel flock and persist request, PID/start-time identity, state and result receipts. Re-entry consumes settled receipts, waits for live children or retries infrastructure on the same product execution. Authoritative completed execution/verification reconciles a lost outer receipt. Only a typed product failure reserves a new repair attempt.

Backoff starts at 30 seconds, doubles and caps at 15 minutes. SQL and worker re-entry respect stop, maintenance, task limits, ownership and human gates. Controller leases remain admission-checked. ensure_workflow_run returns incomplete attributed terminal runs instead of empty successors.

Structured classification outranks typed child/verifier outcomes and narrow error-code fallback. Unknown outcomes stop safely. Actual repair-probe checks and fingerprints flow through execution metadata/failures to the next failure packet and prompt. Formal verification remains authoritative. Task-owned missing checks are product defects; executable registered checks run; external evidence waits at its legitimate gate.

The installed runtime keeps BS_CONTROL_PUBLICATION_HOLD=1. Merge, deployment, hosted migrations, providers/secrets and required advisor/security evidence retain authorization boundaries. task-status exposes actual historical model/attempt separately from future routing, run, stage, reason, wake, ownership and required evidence.

Do not remove active receipt directories. Reboot recovery relies on persistent receipts and process identity disappearance; the user's computer is not rebooted for fault injection. Source must be committed and match the forced SSH adapter pin. Keep historical executions and product budgets unchanged.

BS-31 also wakes a running admitted run with no current task after completion credit. Authoritative phase success consumes an unfinished operation before consulting its old backoff timer. Restart recovery reuses existing task commits/PRs and the unique run/task credit. Migration 031 creates read-only runtime authority; only an operator may write its grants. This authority never creates runs or changes task scope.

## Dot installation

BS-31 is the sole recovery owner. Its two-minute fallback and loopback webhook
both delegate to `recovery-watch`. The enabled local `dot-event-relay.mjs` service
LISTENs on `bs_dot_wake` using the existing database environment and authentication;
it never supervises tasks or calls a model. Forward migration 032 persists the
wake outbox, scan history and restart-stable incident identities. Heartbeats do
not create event loops. The fallback scans every active run.

Only typed product failures may reserve a product repair. Known unexecuted
binding failures are configuration even when historical metadata charged them
as product defects. Migration 033 can reaccept the latest failed execution
inside existing explicit bounded authority after a full passing probe and exact
source preservation; it retains executions, failures and attempt history.

Migration 034 allows configuration-only admission renewal against operator-frozen
paths and requirement/acceptance scope. Task workers cannot write these frozen
grants. Changed scope, protected paths, stopped runs, revoked run grants and
revoked current derived authorizations stop recovery. The `human` authorization
source denotes its inherited frozen human authority; the refresh is attributed
to Dot and does not invent a new human decision. Existing ordinary draft policy,
manual protected publication, merge and deployment gates remain authoritative.

Preparation uses the actual stored stack parent. A descendant parent advance
can continue against its preserved preparation base without touching a dirty
worktree. Diverged lineage remains an ambiguity gate. Missing worktrees can be
restored from an existing unattached task branch without deleting unique work.
Cleanup scans at most every fifteen minutes and removes only clean, integrated,
published worktrees with no active references, workers, open PR or dependent PR.
Branches use Git's non-force deletion; prune follows successful checked removal.

Run all control-plane tests with required disposable PostgreSQL and published
n8n fixtures, lint, workspace check, generated workflow validation and the
resilience harness before committing and repinning the local forced adapter.

## Shared foundation product budget

`shared-foundation-five` resolves slots 1/2 to standard Sol medium, 3/4 to
deep Sol high, and 5 to review Astra high. Shared imports still carrying
`foundation-three` resolve to this policy. Other workstreams retain their policy.
Historical execution ordinals, routes, snapshots and failures are never rewritten.

`product_attempt_classifications` is an append-only ledger outside execution
history. Dot audits structured blocking receipts and known missing bindings.
Exact operator-reviewed test/fixture classifications override the original
misclassification for that receipt. New failed reverification receipts receive
a new audit; an old infrastructure correction cannot mask a later product defect.
Unknown evidence stays guarded. Non-product failures require same-execution
recovery; they cannot reserve a new product execution. Product routing uses the
chargeable slot, and physical execution ordinals remain unique.

Each normal Dot cycle includes failed Shared runs stopped solely by retry
exhaustion. Reconciliation locks the original run, requires the frozen bounded
authority and current scope, respects maintenance/stop/leases and other active
runs, and preserves task counts and execution history. Five genuine product
failures require human intervention; the runner rejects any budget above five.
Guarded reacceptance runs all registered mandatory checks. Only exact reviewed
test paths may differ; product hashes, parent lineage and original failed checks
remain enforced. No merge, deployment or protected publication gate is waived.
