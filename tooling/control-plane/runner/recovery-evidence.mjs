import { ordinaryRunAuthority } from './bounded-publication.mjs'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { validPublicationPath, publicationStateFingerprint } from './publication-preflight.mjs'

export function currentExecution(snapshot) {
  return [...(snapshot.executions ?? [])].sort((a, b) => Number(a.attempt) - Number(b.attempt)).at(-1) ?? null
}

export function executionFailure(snapshot, execution = currentExecution(snapshot)) {
  return [...(snapshot.failures ?? [])]
    .filter(f => f.resolved_at == null && Number(f.execution_id) === Number(execution?.execution_id))
    .sort((a, b) => Number(a.failure_id) - Number(b.failure_id)).at(-1) ?? null
}

export function failedVerificationEvidence(snapshot) {
  const execution = currentExecution(snapshot)
  if (!execution) return null
  const failure = executionFailure(snapshot, execution)
  const probe = failure?.metadata?.verification_probe
  if (execution.status === 'failed' && probe?.verified_state && probe.passed === false && probe.ok === true) return probe
  return [...(snapshot.verification_runs ?? [])]
    .filter(v => Number(v.execution_id) === Number(execution.execution_id) && v.status === 'failed')
    .sort((a, b) => Number(a.verification_run_id) - Number(b.verification_run_id))
    .at(-1)?.metadata ?? null
}

export function retryPurpose(snapshot) {
  const execution = currentExecution(snapshot)
  const failure = executionFailure(snapshot, execution)
  const failureClass = failure?.failure_class ?? execution?.metadata?.verification_probe_classification?.failure_class
  return execution?.status === 'succeeded' || failureClass === 'verification-product-defect'
    ? 'verification-product-repair' : 'retry'
}

// The exact latest failed verifier fingerprint is evidence for repair only.
// Publication continues to inspect every changed file and its authorizations.
export function verifiedRepairBaselineFiles(snapshot, runtime, purpose) {
  if (purpose !== 'verification-product-repair') return []
  const execution = currentExecution(snapshot)
  const state = failedVerificationEvidence(snapshot)?.verified_state
  const root = runtime?.repository?.worktree_target?.path
  const changed = new Set(runtime?.repository?.worktree_target?.changed_files ?? [])
  if (!state || state.base_sha !== execution?.parent_sha || !Array.isArray(state.files) || !root) return []
  if (state.fingerprint !== publicationStateFingerprint(state)) return []
  return state.files.filter(item => {
    if (!validPublicationPath(item?.file) || !changed.has(item.file) || !item.object) return false
    const file = path.resolve(root, item.file)
    if (!file.startsWith(path.resolve(root) + path.sep)) return false
    const object = existsSync(file)
      ? spawnSync('git', ['hash-object', '--', item.file], { cwd: root, encoding: 'utf8' }).stdout?.trim()
      : 'deleted'
    return object === item.object
  }).map(item => item.file).sort()
}

export function repairFailureChecks({ execution, failure, formalChecks = [] }) {
  const probe = failure?.metadata?.verification_probe
  const checks = formalChecks.length ? formalChecks : probe?.checks ?? execution?.metadata?.verification_probe_failures ?? []
  const classification = failure?.failure_class ?? probe?.classification?.failure_class ?? execution?.metadata?.verification_probe_classification?.failure_class
  return checks.filter(c => ['fail', 'not_run', 'unavailable'].includes(c.status)).map(c => ({
    check_name: c.check_name ?? c.name,
    status: c.status, summary: c.summary ?? '', log_path: c.log_path ?? '', exit_code: c.exit_code ?? null,
    failure_class: c.failure_class ?? classification ?? null,
  }))
}

export function preserveAttributedRun(run, plan) {
  if (!run?.admitted_repair_id || !run.current_task_id) return false
  return !(plan?.kind === 'terminal' && plan.recoverable === false &&
    ['retry_budget_exhausted', 'task_cancelled'].includes(plan.reason))
}

// An operator may authorize repair/verification while withholding Git publication.
export function publicationHoldOutcome(env = process.env, authority = null, taskId = null) {
  if (env.BS_CONTROL_PUBLICATION_HOLD !== '1') return null
  if (ordinaryRunAuthority(authority, taskId)) return null
  return {
    ok: false, error: 'publication_operator_hold',
    classification: { failure_class: 'operator-wait', recovery_action: 'wait-operator' },
    reason: 'Operator has authorized local recovery and verification only; publication requires separate authorization.',
  }
}
