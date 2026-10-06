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
export function operationHasAuthoritativeSuccess(snapshot, op) {
  const task = snapshot.packet?.task
  if (task?.status === 'complete') return true
  const execution = snapshot.executions?.find(e => Number(e.execution_id) === Number(op.execution_id))
  if (!execution || execution.status !== 'succeeded') return false
  if (['task-run','task-retry'].includes(op.action)) {
    return ['passed','verification'].includes(task?.status) ||
      op.descriptor?.previous_execution_id != null && Number(op.descriptor.previous_execution_id) !== Number(execution.execution_id)
  }
  if (op.action === 'task-prepare') return task?.status === 'passed'
  return op.action === 'task-verify' && task?.status === 'passed' &&
    snapshot.verification_runs?.filter(v => Number(v.execution_id) === Number(execution.execution_id)).at(-1)?.status === 'passed'
}
