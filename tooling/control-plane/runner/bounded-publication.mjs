// These receipts are supplied by PostgreSQL, not worker-generated task metadata.
export function ordinaryRunAuthority(authority, taskId) {
  return authority?.authorized === true && authority.mode === 'ordinary-draft' &&
    authority.task_id === taskId && Boolean(authority.run_id) && Boolean(authority.contract_fingerprint)
}
export function supersededPublicationHold(snapshot) {
  return snapshot.packet?.task?.status === 'passed' &&
    snapshot.recovery?.next_action === 'wait-operator' &&
    snapshot.recovery?.error_code === 'publication_operator_hold' &&
    ordinaryRunAuthority(snapshot.run_publication_authority, snapshot.packet.task.task_id)
}
// Repair only the historical nested-publisher classification bug. Re-enter
// publication, which must enforce the current scope, verification and gates;
// never treat a typed operator wait as publication authorization.
export function publicationStopNeedsReclassification(snapshot) {
  const recovery = snapshot.recovery
  const execution = [...(snapshot.executions ?? [])].sort((a, b) => a.attempt - b.attempt).at(-1)
  const verification = [...(snapshot.verification_runs ?? [])]
    .filter(v => Number(v.execution_id) === Number(execution?.execution_id))
    .sort((a, b) => a.verification_run_id - b.verification_run_id).at(-1)
  // A previously rejected eligibility guard is superseded only by current DB
  // proof of the exact latest execution and a current ordinary run grant. The
  // publisher still performs every protected-path/scope/verification preflight.
  if(snapshot.packet?.task?.status==='passed' && verification?.status==='passed' && snapshot.publication_execution_eligible===true
    && ordinaryRunAuthority(snapshot.run_publication_authority,snapshot.packet.task.task_id)
    && recovery?.next_action==='safety-stop' && recovery.metadata?.child_command==='task-publish'
    && /^Latest execution lacks successful implementation or exact guarded reacceptance\.?$/.test(recovery.error_code??''))return true
  const failure = snapshot.failures?.find(f => Number(f.failure_id) === Number(recovery?.failure_id))
  return snapshot.packet?.task?.status === 'passed' && execution?.status === 'succeeded' && verification?.status === 'passed' &&
    recovery?.next_action === 'safety-stop' && recovery.failure_class === 'safety-stop' &&
    recovery.error_code === 'publication_protected_path_operator_wait' && recovery.metadata?.child_command === 'task-publish' &&
    Number(recovery.execution_id) === Number(execution.execution_id) &&
    failure?.resolved_at == null && failure?.stage === 'publication' &&
    Number(failure.execution_id) === Number(execution.execution_id) && failure.error_code === recovery.error_code &&
    failure.failure_class === 'operator-wait' && failure.recovery_action === 'wait-operator' &&
    failure.metadata?.classification?.failure_class === 'operator-wait' && failure.metadata.classification.recovery_action === 'wait-operator'
}
export function operationHasAuthoritativeSuccess(snapshot, op) {
  const task = snapshot.packet?.task
  if (task?.status === 'complete') return true
  const execution = snapshot.executions?.find(e => Number(e.execution_id) === Number(op.execution_id))
  if(op.action==='task-reaccept') return task?.status==='passed' && snapshot.verification_runs?.filter(v=>Number(v.execution_id)===Number(op.execution_id) && v.status==='passed' && v.metadata?.verifier_only_reacceptance===true).length>0
  if (!execution || execution.status !== 'succeeded') return false
  if (['task-run','task-retry'].includes(op.action)) {
    return ['passed','verification'].includes(task?.status) ||
      op.descriptor?.previous_execution_id != null && Number(op.descriptor.previous_execution_id) !== Number(execution.execution_id)
  }
  if (op.action === 'task-prepare') return task?.status === 'passed'
  return op.action === 'task-verify' && task?.status === 'passed' &&
    snapshot.verification_runs?.filter(v => Number(v.execution_id) === Number(execution.execution_id)).at(-1)?.status === 'passed'
}
