
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

## General recovery ownership

BS-31 dispatches every fresh unowned STUCK/non-human bounded-run observation through `dot-general-recovery.mjs`. A private incident/job is persisted before any child launch; run-row locks, token fencing and kernel incident/run locks prevent duplicate actions. Dead processes expire and restart on the same incident. Live product/verifier workers are left alone.

Known semantic families use the normal same-run supervisor: authoritative PASS (normal, reopened, infrastructure recovered, reaccepted and replay) enters the ordinary guarded publication state machine, then idempotent completion credit and dependency-based acquisition. Recovery never creates a product execution itself. The existing supervisor and audited product-slot guard own genuine repairs.

Unknown or repeatedly unsuccessful deterministic handlers invoke Codex in an isolated control-runtime checkout using stdin and durable receipts. The host validates scope, a new regression and the full control suite, then commits and atomically pins only a compatible clean runtime. Product files, SQL, providers and safety guard edits cannot pass the incident installer. Such extensions become explicit human gates. Learned semantic families retain their tested runtime commit and regression in the private catalog. Historical executions and product budgets are immutable.

Health exposes persisted owner/action/incident/start/next check; Codex-established human gates are shown as NEEDS_ME=YES. No merge, deployment, protected publication or business decision is authorized by recovery ownership.

Authoritative lifecycle wakes remain durable identifiers in `dot_wake_events`.
Operator approvals now enter that outbox in the same transaction as the authority
record, including an exact incident identity. Compact scans prefer a current,
unconsumed incident approval over unrelated historical incident gates. The
runtime claims that incident through `claim_approved_dot_incident`; its run lock,
claim lease and invocation ledger prevent duplicate investigation starts. Claiming
does not consume an extension: the existing model-launch receipt consumes it.
The two-minute periodic scan can recover a missed webhook without a browser.

A passing check's receipt is not failed evidence. Retry auditing selects required
failed checks from the completed verification generation and preserves internal
verifier failures as non-product. Existing local verification operations resume
through their original execution before any new incident investigation. A stale
incident report with no current actionable operator gate does not require a human.
Relay debounce retains an observed authoritative identifier even if a later outbox
poll is empty; only successful delivery advances the relay watermark. Audit-only
events and recovery heartbeats continue to be suppressed.

Built-in and registered checks can name the same command (for example
`git-diff-check`). The verifier reuses that exact command/cwd/required identity
once per verification run, preserving its receipt. A conflicting registration
fails as configuration evidence without overwriting the first check. Verifier
process receipts bind the actual verification run ID across infrastructure polls;
a failed verifier process is not blindly restarted inside a generation whose
checks already have immutable receipts.
