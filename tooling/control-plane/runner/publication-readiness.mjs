import {
  pathInScope,
  protectedPublicationPath,
  validPublicationPath,
} from './publication-preflight.mjs'

function normalize(value) {
  return String(value ?? '').trim().replaceAll('\\', '/').replace(/^\.\//, '')
}

function unique(values = []) {
  return [...new Set(values.map(normalize).filter(Boolean))].sort()
}

function hasGlob(value) {
  return /[*?[{]/.test(value)
}

function exactPaths(values = []) {
  return unique(values).filter(value => validPublicationPath(value) && !hasGlob(value))
}

function requirementPaths(contract = {}) {
  const requirements = Array.isArray(contract?.required_paths) ? contract.required_paths : []
  return unique(requirements.map(item => typeof item === 'string' ? item : item?.path))
}

function authorizedPaths(authorizations = [], kind) {
  return unique(authorizations.flatMap(authorization => {
    if (authorization?.authorization_kind && authorization.authorization_kind !== kind) return []
    if (authorization?.revoked_at) return []
    return Array.isArray(authorization?.authorized_paths)
      ? authorization.authorized_paths
      : Array.isArray(authorization?.requested_paths)
        ? authorization.requested_paths
        : []
  }))
}

function fullyAuthorized(path, authorizations) {
  return authorizations.some(authorized => normalize(authorized) === normalize(path))
}

export function publicationAuthorizationValidationKind(path) {
  const candidate = normalize(path)
  if (/(^|\/)\.env(?:\.|$)/.test(candidate)) return 'no-secrets-review'
  if (/(^|\/)supabase\/migrations\//.test(candidate)) return 'database-change-review'
  if (/(^|\/)supabase\/(?:config\.toml|seed\.sql)$/.test(candidate)) return 'supabase-config-review'
  if (/(^|\/)\.github\/workflows\//.test(candidate)) return 'workflow-risk-review'
  if (/(^|\/)n8n(?:\/|\.|-)/i.test(candidate)) return 'workflow-risk-review'
  if (/(^|\/)(?:vercel|deploy)(?:\/|\.|-)/i.test(candidate)) return 'deployment-risk-review'
  return 'protected-content-review'
}

export function validateProtectedPublicationAuthorization({
  requestedPaths,
  requiredPaths,
  projectPaths,
  evidence,
  validations,
}) {
  const paths = exactPaths(requestedPaths)
  if (
    !Array.isArray(requestedPaths) || paths.length === 0 || paths.length !== requestedPaths.length ||
    paths.some(path => path.endsWith('/'))
  ) {
    throw new Error('protected_authorization_requires_exact_relative_paths')
  }
  if (paths.some(path => !protectedPublicationPath(path))) {
    throw new Error('protected_authorization_requires_protected_paths')
  }
  const required = exactPaths(requiredPaths)
  if (paths.some(path => !required.includes(path))) {
    throw new Error('protected_authorization_must_match_approved_requirement')
  }
  if (paths.some(path => !pathInScope(path, projectPaths))) {
    throw new Error('protected_authorization_path_outside_project_boundary')
  }
  if (typeof evidence !== 'string' || evidence.trim().length < 8) {
    throw new Error('protected_authorization_requires_audit_evidence')
  }
  if (!validations || typeof validations !== 'object' || Array.isArray(validations)) {
    throw new Error('protected_authorization_requires_content_risk_validation')
  }
  for (const path of paths) {
    const validation = validations[path]
    const expected = publicationAuthorizationValidationKind(path)
    if (validation?.status !== 'passed' || !Array.isArray(validation.checks) || !validation.checks.includes(expected)) {
      throw new Error(`protected_authorization_validation_missing:${path}:${expected}`)
    }
  }
  return paths
}

export function evaluatePublicationReadiness({
  contract,
  taskPaths = [],
  sourcePaths = [],
  workstreamPaths = [],
  projectPaths = [],
  ordinaryAuthorizations = [],
  protectedAuthorizations = [],
  runtimeFiles = [],
}) {
  const normalized = {
    task_paths: unique(taskPaths),
    source_paths: unique(sourcePaths),
    workstream_paths: unique(workstreamPaths),
    project_paths: unique(projectPaths),
    required_paths: requirementPaths(contract),
  }
  const allDeclared = unique([
    ...normalized.task_paths,
    ...normalized.source_paths,
    ...normalized.required_paths,
    ...normalized.workstream_paths,
    ...normalized.project_paths,
  ])
  const contractBoundaryMismatch = !contract || [
    ['task_paths', normalized.task_paths],
    ['source_paths', normalized.source_paths],
    ['workstream_paths', normalized.workstream_paths],
    ['project_paths', normalized.project_paths],
  ].some(([key, current]) =>
    !Array.isArray(contract?.[key]) || JSON.stringify(unique(contract[key])) !== JSON.stringify(current),
  )
  const invalid = allDeclared.filter(path => !validPublicationPath(path))
  const derivedUnresolvedScopes = unique([
    ...normalized.task_paths,
    ...normalized.source_paths,
  ]).filter(path => hasGlob(path) && !pathInScope(path.replace(/[?*[{].*$/, ''), normalized.workstream_paths))
  const unresolvedScopes = Array.isArray(contract?.unresolved_scopes)
    ? unique(contract.unresolved_scopes)
    : derivedUnresolvedScopes
  const required = exactPaths(normalized.required_paths)
  const approvedExact = exactPaths([
    ...normalized.task_paths,
    ...normalized.source_paths,
    ...required,
  ])
  const outsideProject = approvedExact.filter(path => !pathInScope(path, normalized.project_paths))
  const protectedRequired = required.filter(protectedPublicationPath)
  const ordinaryRequired = required.filter(path =>
    !protectedPublicationPath(path) && !pathInScope(path, normalized.workstream_paths),
  )
  const ordinaryAuthorized = authorizedPaths(ordinaryAuthorizations, 'ordinary')
  const protectedAuthorized = authorizedPaths(protectedAuthorizations, 'protected')
  const exactAuthorizationRequired = ordinaryRequired.filter(path => !fullyAuthorized(path, ordinaryAuthorized))
  const protectedAuthorizationRequired = protectedRequired.filter(path => !fullyAuthorized(path, protectedAuthorized))

  const runtime = unique(runtimeFiles)
  const runtimeOutsideProject = runtime.filter(path => !validPublicationPath(path) || !pathInScope(path, normalized.project_paths))
  const unexpectedRuntime = runtime.filter(path => {
    if (!validPublicationPath(path) || runtimeOutsideProject.includes(path)) return false
    if (protectedPublicationPath(path)) {
      return !required.includes(path) || !fullyAuthorized(path, protectedAuthorized)
    }
    if (pathInScope(path, normalized.workstream_paths)) return false
    return !pathInScope(path, required) || !pathInScope(path, ordinaryAuthorized)
  })

  let classification = 'ready'
  if (!contract || Number(contract.contract_version ?? contract.version) !== 1 || contractBoundaryMismatch || invalid.length || unresolvedScopes.length) {
    classification = 'invalid'
  }
  else if (outsideProject.length || runtimeOutsideProject.length) classification = 'outside_project_boundary'
  else if (unexpectedRuntime.length) classification = 'unexpected_runtime_change'
  else if (protectedAuthorizationRequired.length) classification = 'protected_authorization_required'
  else if (exactAuthorizationRequired.length) classification = 'exact_authorization_required'

  return {
    ready: classification === 'ready',
    classification,
    contract_id: contract?.contract_id ?? null,
    contract_fingerprint: contract?.contract_fingerprint ?? null,
    boundaries: normalized,
    invalid,
    contract_boundary_mismatch: contractBoundaryMismatch,
    unresolved_scopes: unresolvedScopes,
    outside_project_boundary: unique([...outsideProject, ...runtimeOutsideProject]),
    exact_authorization_required: exactAuthorizationRequired,
    protected_authorization_required: protectedAuthorizationRequired,
    unexpected_runtime_change: unexpectedRuntime,
    effective_paths: unique([
      ...normalized.workstream_paths,
      ...ordinaryAuthorized,
      ...protectedAuthorized,
    ]),
    evidence: {
      contract_source: contract?.source ?? null,
      uses_runtime_files_as_authority: false,
    },
  }
}

export function publicationReadinessOutcome(readiness) {
  if (readiness.ready) return { kind: 'ready', reason: 'publication_readiness_ready' }
  if (readiness.classification === 'exact_authorization_required') {
    return { kind: 'wait', reason: 'publication_exact_authorization_required' }
  }
  if (readiness.classification === 'protected_authorization_required') {
    return { kind: 'wait', reason: 'publication_protected_authorization_required' }
  }
  if (readiness.classification === 'outside_project_boundary') {
    return { kind: 'stop', reason: 'publication_path_outside_project_boundary' }
  }
  if (readiness.classification === 'unexpected_runtime_change') {
    return { kind: 'stop', reason: 'publication_unexpected_runtime_change' }
  }
  return { kind: 'wait', reason: 'publication_contract_invalid' }
}
