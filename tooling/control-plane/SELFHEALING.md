
Existing strict-boundary executables can reconcile stale `planned_test` bindings
without a product repair. Dot checks the exact runner and `--require-strict`
implementation, appends CONFIGURATION evidence, installs the reviewed command
binding, and reverifies the same succeeded execution. Audited non-product or
unknown classifications cannot fall through to a legacy PRODUCT label. A real
failed assertion remains a product failure and uses the existing bounded budget.

Native bounded runs can receive an operator-owned ordinary draft grant with an
exact frozen task set. Dot prepares each current contract without acquiring tasks
out of order; native readiness and dependency selection still choose the next
task. Only authoritative passing ordinary scope may publish. Revocations, scope
changes, protected paths, approvals, merges and deployment gates remain enforced.

Codex prompts use exact stdin transport (`codex exec ... -`), including recovery of private legacy argv receipts. Prompt audit files remain mode 0600; no temporary prompt file or environment secrets are added. Model, reasoning and execution reservations are preserved. Spawn failures (including synchronous E2BIG before a child PID) settle as worker-transport infrastructure. A dead receipt writer is recovered only after PID/start-stamp and kernel-lock checks; a live child is never duplicated. Dot stops an old outer waiter only when its inner handoff demonstrably died before spawn, then resumes the original execution through an infrastructure generation. This does not reserve a product attempt.

Before-first-execution missing bindings are automatically recoverable only through an exact reviewed catalog: approved task/plan, original authorized active run, zero executions, existing runner evidence, and mandatory registered commands. The Shop email-auth catalog registers existing unit/auth-browser runners and typecheck/lint/build; registration never claims PASS. Dot can wake this specific configuration gate, reconcile the bindings idempotently, refresh that run's ordinary publication contract, and dispatch attempt 1. Unknown obligations, approvals, credentials, stopped/revoked runs, conflicting bindings, and tasks with an execution remain gated.

## Operator health

The local `building-suit-dot-health` user service serves `http://127.0.0.1:8787/` and the read-only `/api/status` endpoint. `control.dot_health_current` is the n8n-readable canonical view. Health collection runs every 30 seconds, on persisted `bs_dot_wake` events, and at each BS-31 scan. It uses SQL, PID/start-stamp receipts and deterministic state rules; it never invokes Codex or reserves attempts. Existing workers are reconstructed from receipts without restarting them. New worker receipts persist heartbeat, output progress, deadline and exit state.

The page includes every active run, other pending/active tasks, process/lease details, and deduped actionable alerts. Missing/expired owners, dead workers, overdue expected transitions and stale collection are visible as STUCK. A legitimate future backoff is WAITING_TIMER, while recorded human gates remain WAITING_OPERATOR. A healthy live repair/verifier/publisher has its own state. Completion credit/acquisition gaps and null-current eligible admitted work are diagnosed explicitly. No notification channel is currently configured; alerts remain on the local page. Loopback/Host checks prevent remote exposure, and only sanitized health fields reach the browser; prompts, output and environment secrets are excluded.
