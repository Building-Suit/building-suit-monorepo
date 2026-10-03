import { createHash } from 'node:crypto'

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stable(item)]),
  )
}

export function parentSatisfactionFingerprint(value) {
  return createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex')
}

export function acceptanceCriteriaDigest(criteria) {
  return parentSatisfactionFingerprint(criteria ?? [])
}

function result(satisfied, reason, evidence) {
  const evaluation = {
    satisfied,
    reason,
    parent_branch: evidence.parent_branch ?? null,
    parent_sha: evidence.parent_sha ?? null,
    acceptance_criteria_digest: evidence.acceptance_criteria_digest,
    verification_evidence: evidence.verification_evidence ?? [],
    source_task_id: evidence.source_task_id ?? null,
    source_execution_id: evidence.source_execution_id ?? null,
    source_verification_run_id: evidence.source_verification_run_id ?? null,
    source_commit_sha: evidence.source_commit_sha ?? null,
    source_lineage_sha: evidence.source_lineage_sha ?? null,
  }
  return {
    ...evaluation,
    fingerprint: parentSatisfactionFingerprint(evaluation),
  }
}

export function evaluateParentSatisfaction({
  packet,
  parent,
  taskLineage = {},
  sourceEvidence = null,
  sourceCommitInParent = false,
  executions = [],
  publications = [],
}) {
  const task = packet?.task ?? {}
  const contract = task.parent_satisfaction
  const digest = acceptanceCriteriaDigest(task.acceptance_criteria)
  const baseEvidence = {
    parent_branch: parent?.parent_branch,
    parent_sha: parent?.parent_sha,
    acceptance_criteria_digest: digest,
    source_task_id: contract?.source_task_id,
  }

  if (task.status !== 'in_progress') {
    return result(false, 'task_not_parent_satisfaction_eligible', baseEvidence)
  }
  if (executions.length > 0) {
    return result(false, 'implementation_execution_already_exists', baseEvidence)
  }
  if (publications.length > 0 || taskLineage.local_branch || taskLineage.remote_branch || taskLineage.pull_request) {
    return result(false, 'task_lineage_already_exists', baseEvidence)
  }
  if (!parent?.parent_branch || !/^[0-9a-f]{40}$/i.test(parent?.parent_sha ?? '')) {
    return result(false, 'resolved_parent_unavailable', baseEvidence)
  }
  if (!contract || typeof contract !== 'object') {
    return result(false, 'parent_satisfaction_contract_missing', baseEvidence)
  }
  if (typeof contract.reason !== 'string' || !contract.reason.trim()) {
    return result(false, 'satisfaction_reason_missing', baseEvidence)
  }
  if (contract.acceptance_criteria_digest !== digest) {
    return result(false, 'acceptance_criteria_digest_mismatch', baseEvidence)
  }
  if (typeof contract.source_task_id !== 'string' || !contract.source_task_id.trim()) {
    return result(false, 'source_task_missing', baseEvidence)
  }
  if (!sourceEvidence || sourceEvidence.task_id !== contract.source_task_id) {
    return result(false, 'source_verification_evidence_missing', baseEvidence)
  }
  if (sourceEvidence.task_status !== 'complete') {
    return result(false, 'source_task_not_complete', baseEvidence)
  }
  if (sourceEvidence.execution_status !== 'succeeded' || !sourceEvidence.commit_sha) {
    return result(false, 'source_execution_not_publishable', baseEvidence)
  }
  if (
    contract.verification_run_id != null &&
    Number(contract.verification_run_id) !== Number(sourceEvidence.verification_run_id)
  ) {
    return result(false, 'source_verification_run_mismatch', baseEvidence)
  }
  if (sourceEvidence.verification_status !== 'passed') {
    return result(false, 'source_verification_not_passed', baseEvidence)
  }

  const checks = sourceEvidence.checks ?? []
  const requiredChecks = checks.filter(check => check.required !== false)
  if (
    requiredChecks.length === 0 ||
    requiredChecks.some(check => check.status !== 'pass')
  ) {
    return result(false, 'required_verification_evidence_not_passed', baseEvidence)
  }
  if (!sourceCommitInParent) {
    return result(false, 'source_commit_not_in_resolved_parent', baseEvidence)
  }

  return result(true, contract.reason.trim(), {
    ...baseEvidence,
    source_execution_id: sourceEvidence.execution_id,
    source_verification_run_id: sourceEvidence.verification_run_id,
    source_commit_sha: sourceEvidence.commit_sha,
    source_lineage_sha: sourceEvidence.lineage_sha ?? sourceEvidence.commit_sha,
    verification_evidence: requiredChecks.map(check => ({
      check_name: check.check_name,
      command: check.command ?? null,
      status: check.status,
      exit_code: check.exit_code ?? null,
      summary: check.summary ?? null,
    })),
  })
}
