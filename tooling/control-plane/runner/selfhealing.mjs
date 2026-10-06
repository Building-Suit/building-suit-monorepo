import { preexecutionBindingWake } from './preexecution-binding-recovery.mjs'
import { supersededPublicationHold, operationHasAuthoritativeSuccess, publicationStopNeedsReclassification } from './bounded-publication.mjs'
export const AUTO_CLASSES = new Set(['transient-infrastructure', 'verification-infrastructure', 'repository-state', 'publication-reconciliation', 'flaky-verification', 'verification-lifecycle'])
export const HUMAN_ACTIONS = new Set(['wait-operator', 'wait-decision', 'safety-stop'])
export function recoveryBackoff(retries = 0) { return Math.min(15 * 60_000, 30_000 * 2 ** Math.min(Math.max(retries, 0), 5)) }
export function retryWithoutProductAttempt(classification) {
  return AUTO_CLASSES.has(classification?.failure_class)
}
export function runWakeEligibility(run, recovery, operation, now = Date.now(), snapshot = null) {
  if (run.status !== 'running') return { eligible: false, reason: 'run_not_running' }
  if (run.stop_requested) return { eligible: false, reason: 'stop_requested' }
  if (run.maintenance_requested) return { eligible: false, reason: 'maintenance_requested' }
  if (run.completed_tasks >= run.max_tasks) return { eligible: false, reason: 'limit_reached' }
  const reaccepted=snapshot?.packet?.task?.status==='passed' && snapshot.verification_runs?.some(v=>v.status==='passed' && v.metadata?.verifier_only_reacceptance===true && Number(v.execution_id)===Number(snapshot.executions?.at(-1)?.execution_id))
  if(reaccepted && recovery?.error_code==='retry_budget_exhausted') recovery=null
  const reclassifyPublicationStop = publicationStopNeedsReclassification(snapshot ?? {})
  if (recovery?.next_action === 'safety-stop' && !reclassifyPublicationStop) return { eligible: false, reason: recovery.error_code ?? 'safety-stop' }
  if (snapshot?.watchdog_plan?.kind === 'act' && snapshot.watchdog_plan.fingerprint !== recovery?.condition?.fingerprint) recovery = null
  if (recovery?.status === 'active' && !preexecutionBindingWake(snapshot,recovery) && HUMAN_ACTIONS.has(recovery.next_action) && !reclassifyPublicationStop && !supersededPublicationHold(snapshot ?? {})) return { eligible: false, reason: recovery.error_code ?? recovery.next_action }
  const settled = snapshot && (snapshot.packet?.task?.status === 'complete' || snapshot.packet?.task?.status === 'passed' && (!operation || operationHasAuthoritativeSuccess(snapshot, operation)))
  if (!settled && operation && Date.parse(operation.next_wake_at) > now) return { eligible: false, reason: 'backoff_pending' }
  if (!settled && !operation && recovery?.status === 'active' && Date.parse(recovery.next_wake_at ?? '') > now) return { eligible: false, reason: 'backoff_pending' }
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
  const exhausted = task?.status === 'failed' && (snapshot.retry_accounting?.consumed ?? execution?.attempt) >= snapshot.packet?.retry_policy?.max_attempts
  const probeClass = execution?.metadata?.verification_probe_classification
  const failures = [...(snapshot.failures ?? [])].filter(f => !f.resolved_at && f.execution_id === execution?.execution_id)
  return { task_id: task?.task_id, task_status: task?.status, stage: task?.engine_stage,
    execution_id: execution?.execution_id, product_attempt: snapshot.retry_accounting?.consumed ?? execution?.attempt, physical_attempt: execution?.attempt,
    product_retry_budget: snapshot.packet?.retry_policy?.max_attempts,
    profile: execution?.model_profile ?? task?.model_profile, actual_model: execution?.model_name,
    future_route: route, run_id: snapshot.workflow_run?.run_id,
    failure_class: recovery?.failure_class ?? probeClass?.failure_class, next_action: recovery?.next_action ?? (exhausted ? 'safety-stop' : probeClass?.recovery_action),
    reason: recovery?.error_code ?? (exhausted ? 'retry_budget_exhausted' : undefined), next_wake_at: recovery?.next_wake_at,
    lease_owner: recovery?.lease_owner ?? snapshot.workflow_run?.controller_lease_token, lease_expires_at: recovery?.lease_expires_at ?? snapshot.workflow_run?.controller_lease_expires_at,
    run_status: snapshot.workflow_run?.status, maintenance_requested: snapshot.workflow_run?.maintenance_requested, stop_requested: snapshot.workflow_run?.stop_requested,
    operator_action_required: exhausted || recovery?.status === 'active' && HUMAN_ACTIONS.has(recovery?.next_action),
    last_verifier_failures: [...(execution?.metadata?.verification_probe_failures ?? []), ...failures.flatMap(f => (f.metadata?.verification_probe?.checks ?? f.metadata?.checks ?? []).filter(c=>c.status==='fail'||c.status==='not_run'))],
    publication_gate: task?.status === 'passed' ? recovery?.error_code : null,
    required_operator_evidence: recovery?.condition?.required_evidence ?? recovery?.condition?.reason ?? recovery?.error_code ?? null,
    runtime_operations: snapshot.runtime_operations ?? [],
  }
}
