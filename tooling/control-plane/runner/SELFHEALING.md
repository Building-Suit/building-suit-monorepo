# Durable unattended recovery

PostgreSQL owns run attribution, admissions, transitions, executions, gates and runtime_operations. BS-10 and task-supervise use one state machine. BS-31 wakes existing bounded runs every minute; it creates no runs. BS-00 uses persisted n8n Wait for transport/control-database retry.

One unfinished operation per task has a stable operation ID and separate infrastructure generation. Detached workers hold kernel flock and persist request, PID/start-time identity, state and result receipts. Re-entry consumes settled receipts, waits for live children or retries infrastructure on the same product execution. Authoritative completed execution/verification reconciles a lost outer receipt. Only a typed product failure reserves a new repair attempt.

Backoff starts at 30 seconds, doubles and caps at 15 minutes. SQL and worker re-entry respect stop, maintenance, task limits, ownership and human gates. Controller leases remain admission-checked. ensure_workflow_run returns incomplete attributed terminal runs instead of empty successors.

Structured classification outranks typed child/verifier outcomes and narrow error-code fallback. Unknown outcomes stop safely. Actual repair-probe checks and fingerprints flow through execution metadata/failures to the next failure packet and prompt. Formal verification remains authoritative. Task-owned missing checks are product defects; executable registered checks run; external evidence waits at its legitimate gate.

The installed runtime keeps BS_CONTROL_PUBLICATION_HOLD=1. Merge, deployment, hosted migrations, providers/secrets and required advisor/security evidence retain authorization boundaries. task-status exposes actual historical model/attempt separately from future routing, run, stage, reason, wake, ownership and required evidence.

Do not remove active receipt directories. Reboot recovery relies on persistent receipts and process identity disappearance; the user's computer is not rebooted for fault injection. Source must be committed and match the forced SSH adapter pin. Keep historical executions and product budgets unchanged.
