import { createHash } from 'node:crypto'
import path from 'node:path'

function normalize(value) {
  return String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '')
}

export function validPublicationPath(value) {
  const candidate = normalize(value)
  return Boolean(candidate) && !path.isAbsolute(candidate) && !candidate.split('/').includes('..')
}

export function pathInScope(file, scopes = []) {
  const candidate = normalize(file)
  return scopes.some(value => {
    const scope = normalize(value)
    if (!validPublicationPath(scope)) return false
    if (/[*?[{]/.test(scope)) return path.matchesGlob(candidate, scope)
    const exact = scope.endsWith('/') ? scope.slice(0, -1) : scope
    return candidate === exact || candidate.startsWith(`${exact}/`)
  })
}

const neverRepair = [
  /^\.env(?:\.|$)/,
  /(^|\/)\.env(?:\.|$)/,
  /(^|\/)(?:secrets?|credentials?)(?:\/|\.|$)/i,
  /(^|\/)supabase\/migrations\//,
  /(^|\/)n8n(?:\/|\.|-)/i,
  /(^|\/)\.github\/workflows\//,
  /(^|\/)(?:vercel|deploy)(?:\/|\.|-)/i,
]

function contractExplicitlyRequiresDocumentation(task) {
  return /\b(documentation|document|docs|readme|agent guidance)\b/i.test(JSON.stringify({
    title: task?.title,
    description: task?.description,
    acceptance_criteria: task?.acceptance_criteria,
    verification_plan: task?.verification_plan,
  }))
}

function boundedControlPlaneRepair(file, task) {
  if (!file.startsWith('tooling/control-plane/')) return false
  const contract = JSON.stringify({
    title: task?.title,
    description: task?.description,
    acceptance_criteria: task?.acceptance_criteria,
    verification_plan: task?.verification_plan,
  }).toLowerCase()
  if (file.startsWith('tooling/control-plane/tests/') && /\b(test|verification|verify)\b/.test(contract)) {
    return true
  }
  return ['publication', 'preflight', 'reconciliation', 'reconcile', 'recovery']
    .some(keyword => contract.includes(keyword) && file.toLowerCase().includes(keyword))
}

export function classifyPublicationFiles({
  files = [],
  task = {},
  taskPaths = [],
  sourcePaths = [],
  workstreamPaths = [],
  projectPaths = [],
}) {
  const hasTaskBoundary = taskPaths.length > 0 || sourcePaths.length > 0
  const decisions = [...new Set(files)].sort().map(file => {
    const normalized = normalize(file)
    if (pathInScope(normalized, taskPaths)) {
      return { file: normalized, decision: 'allow', boundary: 'task', reason: 'task_specific_path' }
    }
    if (pathInScope(normalized, sourcePaths)) {
      return { file: normalized, decision: 'allow', boundary: 'task-source', reason: 'source_task_path' }
    }
    if (pathInScope(normalized, workstreamPaths)) {
      if (!hasTaskBoundary) {
        return { file: normalized, decision: 'allow', boundary: 'workstream', reason: 'workstream_is_effective_task_boundary' }
      }
      if (boundedControlPlaneRepair(normalized, task)) {
        return { file: normalized, decision: 'repair', boundary: 'workstream', reason: 'control_plane_companion_directly_implied_by_task_contract' }
      }
      return { file: normalized, decision: 'wait', boundary: 'workstream', reason: 'workstream_path_not_in_task_boundary' }
    }
    if (neverRepair.some(pattern => pattern.test(normalized))) {
      return { file: normalized, decision: 'safety-stop', reason: 'protected_publication_area' }
    }
    if (
      normalized.startsWith('docs/') &&
      pathInScope(normalized, projectPaths) &&
      contractExplicitlyRequiresDocumentation(task)
    ) {
      return {
        file: normalized,
        decision: 'repair',
        boundary: 'project',
        reason: 'documentation_directly_required_by_task_contract',
      }
    }
    if (pathInScope(normalized, projectPaths)) {
      return { file: normalized, decision: 'wait', boundary: 'project', reason: 'project_scope_requires_explicit_task_authorization' }
    }
    return { file: normalized, decision: 'safety-stop', reason: 'outside_project_publication_boundary' }
  })

  return {
    decisions,
    allowed: decisions.filter(item => item.decision === 'allow').map(item => item.file),
    repaired: decisions.filter(item => item.decision === 'repair').map(item => item.file),
    waiting: decisions.filter(item => item.decision === 'wait').map(item => item.file),
    blocked: decisions.filter(item => item.decision === 'safety-stop').map(item => item.file),
  }
}

export function publicationStateFingerprint({ base_sha, files = [] }) {
  const normalized = files.map(item => ({
    file: normalize(item.file),
    object: item.object ?? 'deleted',
  })).sort((left, right) => left.file.localeCompare(right.file))
  return createHash('sha256').update(JSON.stringify({ base_sha, files: normalized })).digest('hex')
}

export function evaluateVerificationAuthority({ verification, executionId, stateFingerprint }) {
  if (!verification || Number(verification.execution_id) !== Number(executionId)) {
    return { authoritative: false, reason: 'verification_not_for_latest_execution' }
  }
  if (verification.status !== 'passed') {
    return { authoritative: false, reason: 'latest_verification_not_passed' }
  }
  if (!verification.state_fingerprint) {
    return { authoritative: false, reason: 'verification_state_fingerprint_missing' }
  }
  if (verification.state_fingerprint !== stateFingerprint) {
    return { authoritative: false, reason: 'verified_repository_state_changed' }
  }
  return { authoritative: true, reason: 'latest_passed_verification_matches_repository_state' }
}

export function evaluatePublicationParent({ liveParent, execution, recordedParentSha = null }) {
  if (
    liveParent?.parent_branch === execution?.parent_branch &&
    liveParent?.parent_sha === execution?.parent_sha
  ) {
    return { current: true, reason: 'resolved_parent_unchanged' }
  }
  if (
    liveParent?.parent_branch === execution?.branch_name &&
    liveParent?.parent_pr?.base_branch === execution?.parent_branch &&
    recordedParentSha === execution?.parent_sha
  ) {
    return { current: true, reason: 'task_own_pr_is_current_stack_leaf' }
  }
  return { current: false, reason: 'parent_changed_since_execution' }
}

export function planPublicationReconciliation({
  parentSha,
  localSha,
  remoteSha = null,
  localTaskCommits = false,
  remoteTaskCommits = false,
  existingPrs = [],
  expectedBase,
}) {
  if (existingPrs.length > 1) return { action: 'wait', reason: 'multiple_open_prs_for_branch' }
  const pr = existingPrs[0] ?? null
  if (pr && pr.baseRefName !== expectedBase) return { action: 'wait', reason: 'existing_pr_has_wrong_base', pr }
  if (remoteSha && localSha === parentSha && remoteTaskCommits) return { action: 'fast_forward_remote_task_branch', pr }
  if (remoteSha && remoteSha !== localSha) return { action: 'wait', reason: 'remote_branch_sha_mismatch', pr }
  if (localSha !== parentSha && !localTaskCommits) return { action: 'safety-stop', reason: 'unexpected_existing_commits', pr }
  if (pr) return { action: 'reuse_existing_pr', pr }
  return { action: remoteSha ? 'create_pr' : 'push_and_create_pr', pr: null }
}
