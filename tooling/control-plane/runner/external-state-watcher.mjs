import { createHash } from 'node:crypto'

export const WATCHER_MIN_BACKOFF_MS = 30_000
export const WATCHER_MAX_BACKOFF_MS = 15 * 60_000
export const WATCHER_LEASE_MS = 2 * 60_000
export const WATCHER_MAX_BATCH = 25

const githubKinds = new Set([
  'github-reachability',
  'github-branch',
  'github-pull-request',
  'github-checks',
])

const controlKinds = new Set([
  'control-execution',
  'control-task-dependencies',
  'control-workstream-serialization',
])

const watchableActions = new Set([
  'wait-external',
  'reconcile-repository',
  'reconcile-publication',
])

function digest(value) {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
}

export function boundedWatcherBackoff(pollCount, {
  minimumMs = WATCHER_MIN_BACKOFF_MS,
  maximumMs = WATCHER_MAX_BACKOFF_MS,
} = {}) {
  const minimum = Math.max(1_000, Number(minimumMs) || WATCHER_MIN_BACKOFF_MS)
  const maximum = Math.max(minimum, Number(maximumMs) || WATCHER_MAX_BACKOFF_MS)
  const exponent = Math.min(30, Math.max(0, Number(pollCount) || 0))
  return Math.min(maximum, minimum * (2 ** exponent))
}

export function nextWatcherWake(now, pollCount, bounds) {
  return new Date(
    new Date(now).getTime() + boundedWatcherBackoff(pollCount, bounds),
  ).toISOString()
}

export function normalizeWatchDescriptor(recovery) {
  const watch = recovery?.condition?.watch
  if (!watch || typeof watch !== 'object' || Array.isArray(watch)) return null
  if (!githubKinds.has(watch.kind) && !controlKinds.has(watch.kind)) return null

  if (watch.kind === 'control-execution') {
    const executionId = Number(watch.execution_id)
    return Number.isSafeInteger(executionId) && executionId > 0
      ? { kind: watch.kind, execution_id: executionId }
      : null
  }

  if (watch.kind === 'control-task-dependencies') {
    const taskIds = [...new Set((watch.task_ids ?? []).map(String))].sort()
    return taskIds.length > 0 && taskIds.every(taskId => /^[A-Z][A-Z0-9-]{2,63}$/.test(taskId))
      ? { kind: watch.kind, task_ids: taskIds }
      : null
  }

  if (watch.kind === 'control-workstream-serialization') {
    const projectId = String(watch.project_id ?? '')
    const workstream = String(watch.workstream_slug ?? '')
    const taskId = String(watch.task_id ?? '')
    return /^[0-9a-f-]{36}$/i.test(projectId) && /^[a-z][a-z0-9-]+$/.test(workstream) && /^[A-Z][A-Z0-9-]{2,63}$/.test(taskId)
      ? { kind: watch.kind, project_id: projectId, workstream_slug: workstream, task_id: taskId }
      : null
  }

  const repository = String(watch.repository ?? '').trim()
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) return null

  if (watch.kind === 'github-branch') {
    const branch = String(watch.branch ?? '').trim()
    if (!branch || branch.startsWith('-')) return null
    return { kind: watch.kind, repository, branch, expected: watch.expected ?? 'present' }
  }

  if (watch.kind === 'github-pull-request' || watch.kind === 'github-checks') {
    const pullRequest = Number(watch.pull_request)
    if (!Number.isSafeInteger(pullRequest) || pullRequest < 1) return null
    const normalized = { kind: watch.kind, repository, pull_request: pullRequest }
    if (watch.kind === 'github-pull-request' && Array.isArray(watch.expected_states)) {
      const expectedStates = [...new Set(watch.expected_states.map(value => String(value).toUpperCase()))].sort()
      if (expectedStates.length === 0 || expectedStates.some(value => !['OPEN', 'CLOSED', 'MERGED'].includes(value))) return null
      normalized.expected_states = expectedStates
    }
    return normalized
  }

  return { kind: watch.kind, repository }
}

export function classifyControlProbe(descriptor, data) {
  if (descriptor.kind === 'control-execution') {
    const state = String(data?.status ?? 'missing')
    return observation(state, ['succeeded', 'failed', 'blocked', 'cancelled'].includes(state), {
      kind: descriptor.kind,
      execution_id: descriptor.execution_id,
      status: data?.status ?? null,
    })
  }

  if (descriptor.kind === 'control-task-dependencies') {
    const tasks = Array.isArray(data) ? data : []
    const complete = tasks.length === descriptor.task_ids.length &&
      tasks.every(task => task.status === 'complete')
    return observation(complete ? 'satisfied' : 'pending', complete, {
      kind: descriptor.kind,
      tasks: tasks.map(task => ({ task_id: task.task_id, status: task.status })),
    })
  }

  const conflicts = Array.isArray(data) ? data : []
  return observation(conflicts.length === 0 ? 'available' : 'contended', conflicts.length === 0, {
    kind: descriptor.kind,
    conflicts: conflicts.map(task => ({
      task_id: task.task_id,
      status: task.status,
      engine_stage: task.engine_stage,
    })),
  })
}

export function isDueExternalRecovery(recovery, now = new Date()) {
  if (
    recovery?.status !== 'active' ||
    recovery?.recoverable !== true ||
    !watchableActions.has(recovery?.next_action) ||
    !normalizeWatchDescriptor(recovery)
  ) return false

  const wake = Date.parse(recovery.next_wake_at ?? '')
  const leaseExpiry = Date.parse(recovery.lease_expires_at ?? '')
  return Number.isFinite(wake) && wake <= new Date(now).getTime() &&
    (!Number.isFinite(leaseExpiry) || leaseExpiry <= new Date(now).getTime())
}

function observation(state, actionable, evidence, identity = evidence) {
  const normalizedEvidence = evidence && typeof evidence === 'object'
    ? evidence
    : { detail: String(evidence ?? '') }
  return {
    state,
    actionable,
    evidence: normalizedEvidence,
    fingerprint: digest({ state, actionable, identity }),
  }
}

export function classifyGithubProbe(descriptor, result) {
  if (result?.unavailable) {
    return observation(
      'unavailable',
      false,
      {
        kind: descriptor.kind,
        repository: descriptor.repository,
        error: String(result.error ?? 'github_unavailable').slice(0, 500),
      },
      { kind: descriptor.kind, repository: descriptor.repository },
    )
  }

  if (descriptor.kind === 'github-reachability') {
    return observation('available', true, {
      kind: descriptor.kind,
      repository: descriptor.repository,
    })
  }

  if (descriptor.kind === 'github-branch') {
    const present = result?.missing !== true
    const actionable = descriptor.expected === 'missing' ? !present : present
    return observation(present ? 'present' : 'missing', actionable, {
      kind: descriptor.kind,
      repository: descriptor.repository,
      branch: descriptor.branch,
      oid: result?.data?.object?.sha ?? null,
    })
  }

  if (descriptor.kind === 'github-pull-request') {
    if (result?.missing) {
      return observation('missing', false, {
        kind: descriptor.kind,
        repository: descriptor.repository,
        pull_request: descriptor.pull_request,
      })
    }
    const state = String(result?.data?.state ?? 'UNKNOWN').toUpperCase()
    const actionable = !descriptor.expected_states || descriptor.expected_states.includes(state)
    return observation(state.toLowerCase(), actionable, {
      kind: descriptor.kind,
      repository: descriptor.repository,
      pull_request: descriptor.pull_request,
      state: result?.data?.state ?? null,
      head_sha: result?.data?.headRefOid ?? result?.data?.head?.sha ?? null,
    })
  }

  const checks = Array.isArray(result?.data) ? result.data : []
  const pending = checks.filter(check =>
    ['pending', 'queued', 'in_progress', 'waiting', 'requested'].includes(
      String(check.bucket ?? check.state ?? '').toLowerCase(),
    ),
  )
  return observation(pending.length > 0 ? 'pending' : 'terminal', pending.length === 0, {
    kind: descriptor.kind,
    repository: descriptor.repository,
    pull_request: descriptor.pull_request,
    checks: checks.map(check => ({
      name: check.name ?? null,
      state: check.state ?? null,
      bucket: check.bucket ?? null,
    })),
  })
}

export function watchTransition(recovery, currentObservation, now = new Date()) {
  const prior = recovery?.metadata?.watcher?.observation ?? null
  const changed = prior?.fingerprint !== currentObservation.fingerprint
  const previousPollCount = Number(recovery?.metadata?.watcher?.poll_count ?? 0)
  const pollCount = currentObservation.actionable ? 0 : previousPollCount + 1
  return {
    changed,
    actionable: currentObservation.actionable,
    observation: currentObservation,
    poll_count: pollCount,
    next_wake_at: currentObservation.actionable
      ? new Date(now).toISOString()
      : nextWatcherWake(now, pollCount),
  }
}

export function githubProbeCommand(descriptor) {
  const repoArgs = ['--repo', descriptor.repository]
  if (descriptor.kind === 'github-reachability') {
    return ['api', `repos/${descriptor.repository}`, '--jq', '{id,name,full_name}']
  }
  if (descriptor.kind === 'github-branch') {
    return ['api', `repos/${descriptor.repository}/git/ref/heads/${encodeURIComponent(descriptor.branch)}`]
  }
  if (descriptor.kind === 'github-pull-request') {
    return ['pr', 'view', String(descriptor.pull_request), ...repoArgs, '--json', 'number,state,headRefOid']
  }
  return ['pr', 'checks', String(descriptor.pull_request), ...repoArgs, '--json', 'name,state,bucket,link']
}

export function githubProbeObservation(descriptor, result) {
  let data
  try {
    data = result?.stdout ? JSON.parse(result.stdout) : null
  }
  catch {
    data = null
  }
  const diagnostic = `${result?.stderr ?? ''} ${result?.stdout ?? ''}`
  const missing = Number(result?.code) !== 0 &&
    /(?:HTTP 404|not found|could not resolve to a pullrequest|no pull requests)/i.test(diagnostic) &&
    !/could not resolve host/i.test(diagnostic)
  const usableChecks = descriptor.kind === 'github-checks' && Array.isArray(data)
  return classifyGithubProbe(descriptor, {
    data,
    missing,
    unavailable: !missing && Number(result?.code) !== 0 && !usableChecks,
    error: result?.stderr || result?.error || `gh_exit_${result?.code}`,
  })
}

export function watchDescriptorForRecovery(snapshot, plan, options = {}) {
  if (plan?.next_action !== 'wait-external') return null
  if (plan.reason === 'execution_in_flight' && plan.execution?.execution_id) {
    return { kind: 'control-execution', execution_id: Number(plan.execution.execution_id) }
  }
  if (plan.reason === 'hard_dependency_unsatisfied') {
    const taskIds = (snapshot?.packet?.dependencies ?? [])
      .filter(item => item.dependency_type === 'hard' && item.status !== 'complete')
      .map(item => item.task_id)
    if (taskIds.length > 0) return { kind: 'control-task-dependencies', task_ids: taskIds }
  }
  if (plan.reason === 'workstream_serialization_conflict') {
    const task = snapshot?.packet?.task
    const project = snapshot?.packet?.project
    const workstream = snapshot?.packet?.workstream
    if (task?.task_id && project?.project_id && workstream?.slug) {
      return {
        kind: 'control-workstream-serialization',
        project_id: project.project_id,
        workstream_slug: workstream.slug,
        task_id: task.task_id,
      }
    }
  }
  const repository = snapshot?.packet?.project?.github_repository
  if (!repository) return null

  const publication = plan.publication ?? [...(snapshot?.publications ?? [])].at(-1)
  const childCommand = options?.metadata?.child_command
  if (publication?.pr_number && childCommand === 'task-publish') {
    return {
      kind: 'github-pull-request',
      repository,
      pull_request: Number(publication.pr_number),
    }
  }

  const branch = plan.execution?.branch_name
  if (branch && /remote_branch|branch.*missing/i.test(String(plan.reason))) {
    return { kind: 'github-branch', repository, branch, expected: 'present' }
  }

  if (
    childCommand === 'task-publish' ||
    /github|repository_state_unavailable|external_dependency_unavailable/i.test(String(plan.reason))
  ) {
    return { kind: 'github-reachability', repository }
  }

  return null
}
