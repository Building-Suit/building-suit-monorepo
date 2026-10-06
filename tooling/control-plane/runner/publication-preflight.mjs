import { createHash } from 'node:crypto'
import path from 'node:path'

function normalize(value) {
  return String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, '')
}

function uniquePaths(values = []) {
  return [...new Set(values.map(normalize).filter(Boolean))].sort()
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

const protectedPublicationPaths = [
  /^\.env(?:\.|$)/,
  /(^|\/)\.env(?:\.|$)/,
  /(^|\/)(?:secrets?|credentials?)(?:\/|\.|$)/i,
  /(^|\/)supabase\/migrations\//,
  /(^|\/)supabase\/(?:config\.toml|seed\.sql)$/,
  /(^|\/)\.github\/workflows\//,
  /(^|\/)(?:vercel|deploy)(?:\/|\.|-)/i,
]

export function protectedPublicationPath(value) {
  const candidate = normalize(value)
  // An n8n-named Nuxt UI component is not an executable workflow. Keep all
  // other protected categories, and n8n directories/configuration, gated.
  const n8nUi = /^apps\/[^/]+\/app\/(?:pages|components)\/(?:[^/]+\/)*n8n(?:-[^/]+)?\.vue$/i.test(candidate) &&
    !/(^|\/)n8n(?:\/|\.|-)/i.test(path.posix.dirname(candidate))
  return protectedPublicationPaths.some(pattern => pattern.test(candidate)) ||
    /(^|\/)n8n(?:\/|\.|-)/i.test(candidate) && !n8nUi
}

export function evaluatePublicationBoundaries({
  taskPaths = [],
  sourcePaths = [],
  workstreamPaths = [],
  projectPaths = [],
}) {
  const boundaries = {
    task_paths: uniquePaths(taskPaths),
    source_paths: uniquePaths(sourcePaths),
    workstream_paths: uniquePaths(workstreamPaths),
    project_paths: uniquePaths(projectPaths),
  }
  const invalid = Object.entries(boundaries).flatMap(([boundary, paths]) =>
    paths.filter(item => !validPublicationPath(item)).map(path => ({ boundary, path })),
  )
  const protectedTaskPaths = boundaries.task_paths.filter(protectedPublicationPath)
  const taskOutsideProject = boundaries.task_paths.filter(item =>
    !pathInScope(item.replace(/[?*[{].*$/, ''), boundaries.project_paths),
  )
  const effectivePaths = uniquePaths([
    ...boundaries.workstream_paths,
    ...boundaries.task_paths,
  ])
  const requestedCrossWorkstream = boundaries.source_paths.filter(item =>
    !pathInScope(item.replace(/[?*[{].*$/, ''), boundaries.workstream_paths),
  )
  const missingAuthority = requestedCrossWorkstream.filter(item =>
    !pathInScope(item.replace(/[?*[{].*$/, ''), boundaries.task_paths),
  )

  return {
    ...boundaries,
    effective_paths: effectivePaths,
    invalid,
    protected_task_paths: protectedTaskPaths,
    task_paths_outside_project: taskOutsideProject,
    requested_cross_workstream_paths: requestedCrossWorkstream,
    missing_authority: missingAuthority,
  }
}

export function validatePublicationAuthorization({ requestedPaths, projectPaths }) {
  if (!Array.isArray(requestedPaths) || !Array.isArray(projectPaths)) {
    throw new Error('publication_paths_must_be_arrays')
  }
  const paths = uniquePaths(requestedPaths)
  if (paths.length === 0) throw new Error('publication_paths_required')
  if (paths.some(item => !validPublicationPath(item) || /[*?[{]/.test(item))) {
    throw new Error('publication_authorization_requires_exact_relative_paths')
  }
  if (paths.some(protectedPublicationPath)) throw new Error('protected_publication_path')
  if (paths.some(item => !pathInScope(item, projectPaths))) {
    throw new Error('publication_path_outside_project_boundary')
  }
  return paths
}

export function validateCurrentPublicationAuthorization({
  requestedPaths,
  waitingPaths,
  projectPaths,
}) {
  const paths = validatePublicationAuthorization({ requestedPaths, projectPaths })
  const waiting = uniquePaths(waitingPaths)
  if (JSON.stringify(paths) !== JSON.stringify(waiting)) {
    throw new Error('authorization_must_match_current_publication_waiting_paths')
  }
  return paths
}

export function taskPublicationMetadata({
  metadata = {},
  allowedPaths = [],
  sourcePaths = [],
  exactRequirementPaths = [],
  workstreamPaths = [],
  projectPaths = [],
}) {
  if (![allowedPaths, sourcePaths, exactRequirementPaths].every(Array.isArray)) {
    throw new Error('task_publication_paths_must_be_arrays')
  }
  const boundaries = evaluatePublicationBoundaries({
    taskPaths: [...allowedPaths, ...exactRequirementPaths],
    sourcePaths,
    workstreamPaths,
    projectPaths,
  })
  if (boundaries.invalid.length > 0) throw new Error('invalid_task_allowed_paths')
  if (exactRequirementPaths.some(item => /[*?[{]/.test(item))) {
    throw new Error('publication_requirements_must_be_exact_paths')
  }
  if (boundaries.task_paths_outside_project.length > 0) {
    throw new Error('task_allowed_path_outside_project_boundary')
  }
  if (boundaries.source_paths.some(item =>
    !pathInScope(item.replace(/[?*[{].*$/, ''), boundaries.project_paths),
  )) {
    throw new Error('task_source_path_outside_project_boundary')
  }
  return {
    ...metadata,
    allowed_paths: uniquePaths(allowedPaths),
    source_allowed_paths: uniquePaths(sourcePaths),
  }
}

export function classifyPublicationFiles({
  files = [],
  sourcePaths = [],
  workstreamPaths = [],
  projectPaths = [],
  requiredPaths = [],
  ordinaryAuthorizedPaths = [],
  protectedAuthorizedPaths = [],
}) {
  const decisions = [...new Set(files)].sort().map(file => {
    const normalized = normalize(file)
    if (protectedPublicationPath(normalized)) {
      if (
        requiredPaths.map(normalize).includes(normalized) &&
        protectedAuthorizedPaths.map(normalize).includes(normalized)
      ) {
        return { file: normalized, decision: 'allow', boundary: 'protected-exact', reason: 'protected_exact_human_authorization' }
      }
      return { file: normalized, decision: 'safety-stop', reason: 'protected_publication_area' }
    }
    if (pathInScope(normalized, workstreamPaths)) {
      return { file: normalized, decision: 'allow', boundary: 'workstream', reason: 'workstream_publication_path' }
    }
    if (pathInScope(normalized, ordinaryAuthorizedPaths)) {
      return { file: normalized, decision: 'allow', boundary: 'task-exact', reason: 'exact_human_authorization' }
    }
    if (pathInScope(normalized, projectPaths)) {
      return {
        file: normalized,
        decision: 'wait',
        boundary: pathInScope(normalized, sourcePaths) ? 'task-source' : 'project',
        reason: pathInScope(normalized, sourcePaths)
          ? 'source_path_requires_explicit_task_authorization'
          : 'project_scope_requires_explicit_task_authorization',
      }
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

export function publicationScopeAuthorizationFingerprint({ task_id, paths = [] }) {
  return createHash('sha256').update(JSON.stringify({
    task_id,
    paths: uniquePaths(paths),
  })).digest('hex')
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

export function evaluatePublicationParent({ liveParent, execution, recordedParentSha = null, parentDescendant = false }) {
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
  if(parentDescendant && (liveParent?.parent_branch===execution?.parent_branch || liveParent?.parent_branch===execution?.branch_name && liveParent?.parent_pr?.base_branch===execution?.parent_branch)) return {current:true,reason:'actual_parent_advanced_preserved_base'}
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
