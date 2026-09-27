import path from 'node:path'

const slugPattern = /^[a-z][a-z0-9-]{1,63}$/
const profiles = new Set(['no_ai', 'fast', 'standard', 'deep', 'review'])
const sensitiveKey = /^(?:password|passwd|secret|token|api[_-]?key|authorization|cookie|private[_-]?key|database_url)$/i

function findSensitiveKey(value, prefix = '') {
  if (!value || typeof value !== 'object') return null
  for (const [key, item] of Object.entries(value)) {
    const location = prefix ? `${prefix}.${key}` : key
    if (sensitiveKey.test(key)) return location
    const nested = findSensitiveKey(item, location)
    if (nested) return nested
  }
  return null
}

export function validateProjectConfig(input, { requireId = false } = {}) {
  const errors = []
  const sensitiveLocation = findSensitiveKey(input)
  if (sensitiveLocation) errors.push(`secrets are not allowed in project configuration: ${sensitiveLocation}`)
  if (requireId && !input.project_id) errors.push('project_id is required')
  if (!slugPattern.test(String(input.slug ?? ''))) errors.push('slug is invalid')
  if (!String(input.display_name ?? '').trim()) errors.push('display_name is required')
  if (!String(input.github_repository ?? '').match(/^[^/\s]+\/[^/\s]+$/)) errors.push('github_repository must be owner/repository')
  if (!String(input.integration_branch ?? '').trim()) errors.push('integration_branch is required')
  if (!String(input.production_branch ?? '').trim()) errors.push('production_branch is required')
  if (!String(input.local_repository_root ?? '').trim()) errors.push('local_repository_root is required')
  if (!String(input.worktree_root ?? '').trim()) errors.push('worktree_root is required')
  if (path.isAbsolute(String(input.worktree_root ?? '')) && input.allow_absolute_worktree_root !== true) {
    errors.push('absolute worktree_root requires allow_absolute_worktree_root=true')
  }
  if (!profiles.has(input.default_model_profile ?? 'standard')) errors.push('default_model_profile is invalid')
  if (!Array.isArray(input.workstreams) || input.workstreams.length === 0) errors.push('at least one workstream is required')
  for (const workstream of input.workstreams ?? []) {
    if (!slugPattern.test(String(workstream.slug ?? ''))) errors.push(`invalid workstream slug: ${workstream.slug ?? ''}`)
    if (!slugPattern.test(String(workstream.stack_key ?? ''))) errors.push(`invalid stack_key: ${workstream.stack_key ?? ''}`)
  }
  if (errors.length) throw new Error(errors.join('; '))
  return {
    ...input,
    active: input.active === true,
    default_model_profile: input.default_model_profile ?? 'standard',
    application_paths: input.application_paths ?? {},
    allowed_publication_paths: input.allowed_publication_paths ?? [],
    verification_config: input.verification_config ?? {},
    local_database_strategy: input.local_database_strategy ?? { type: 'none' },
    concurrency_policy: input.concurrency_policy ?? { max_parallel: 1, serialize_workstreams: true, max_run_tasks: 20 },
    n8n_metadata: input.n8n_metadata ?? {},
    environment_routing: input.environment_routing ?? {},
    stack_strategy: input.stack_strategy ?? { type: 'stacked-pr' },
  }
}
