export const AUTO_CLASSES = new Set(['transient-infrastructure', 'verification-infrastructure', 'repository-state', 'publication-reconciliation', 'flaky-verification', 'verification-lifecycle'])
export const HUMAN_ACTIONS = new Set(['wait-operator', 'wait-decision', 'safety-stop'])
export function recoveryBackoff(retries = 0) { return Math.min(15 * 60_000, 30_000 * 2 ** Math.min(Math.max(retries, 0), 5)) }
export function retryWithoutProductAttempt(classification) {
  return AUTO_CLASSES.has(classification?.failure_class)
}
export function runWakeEligibility(run, recovery, operation, now = Date.now()) {
  if (run.status !== 'running') return { eligible: false, reason: 'run_not_running' }
  if (run.stop_requested) return { eligible: false, reason: 'stop_requested' }
  if (run.maintenance_requested) return { eligible: false, reason: 'maintenance_requested' }
  if (run.completed_tasks >= run.max_tasks) return { eligible: false, reason: 'limit_reached' }
  if (recovery?.status === 'active' && HUMAN_ACTIONS.has(recovery.next_action)) return { eligible: false, reason: recovery.error_code ?? recovery.next_action }
  if (operation && Date.parse(operation.next_wake_at) > now) return { eligible: false, reason: 'backoff_pending' }
  if (!operation && recovery?.status === 'active' && Date.parse(recovery.next_wake_at ?? '') > now) return { eligible: false, reason: 'backoff_pending' }
  return { eligible: true, reason: 'existing_run_reentry' }
}
export function acquisitionStatus(acquisition = {}) {
  if (acquisition.acquired) return acquisition.action === 'resume' ? 'resumed' : 'acquired'
  if (acquisition.action === 'wait_for_owner') return 'owner-wait'
  if (acquisition.reason === 'no_admitted_task' || acquisition.reason === 'no_ready_task') return 'no-ready-task'
  if (acquisition.action === 'safety_stop') return 'safety-stop'
  return 'wait'
}
export function taskStatusEvidence(snapshot, route = null) {
  const task = snapshot.packet?.task
  const execution = [...(snapshot.executions ?? [])].sort((a,b) => a.attempt-b.attempt).at(-1)
  const recovery = snapshot.recovery
  const failures = [...(snapshot.failures ?? [])].filter(f => !f.resolved_at && f.execution_id === execution?.execution_id)
  return { task_id: task?.task_id, task_status: task?.status, stage: task?.engine_stage,
    execution_id: execution?.execution_id, product_attempt: execution?.attempt,
    product_retry_budget: snapshot.packet?.retry_policy?.max_attempts,
    profile: execution?.model_profile ?? task?.model_profile, actual_model: execution?.model_name,
    future_route: route, run_id: snapshot.workflow_run?.run_id,
    failure_class: recovery?.failure_class, next_action: recovery?.next_action,
    reason: recovery?.error_code, next_wake_at: recovery?.next_wake_at,
    lease_owner: recovery?.lease_owner, lease_expires_at: recovery?.lease_expires_at,
    operator_action_required: recovery?.status === 'active' && HUMAN_ACTIONS.has(recovery?.next_action),
    last_verifier_failures: [...(execution?.metadata?.verification_probe_failures ?? []), ...failures.flatMap(f => (f.metadata?.verification_probe?.checks ?? f.metadata?.checks ?? []).filter(c=>c.status==='fail'||c.status==='not_run'))],
    publication_gate: task?.status === 'passed' ? recovery?.error_code : null,
    required_operator_evidence: recovery?.condition?.required_evidence ?? recovery?.condition?.reason ?? recovery?.error_code ?? null,
    runtime_operations: snapshot.runtime_operations ?? [],
  }
}
