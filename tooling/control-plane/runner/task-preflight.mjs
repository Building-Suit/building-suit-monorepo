import { createHash } from 'node:crypto'

import { getProfile } from '../routing/router.mjs'
import {
  profileForAttempt,
  validateRetryPolicy,
} from '../lib/retry-policy.mjs'
import {
  evaluatePublicationBoundaries,
  validPublicationPath,
} from './publication-preflight.mjs'
import {
  evaluatePublicationReadiness,
  publicationReadinessOutcome,
} from './publication-readiness.mjs'
import { completePublicationPolicy } from '../lib/workstream-readiness.mjs'
import { evaluateVerificationReadiness } from './verification-mode.mjs'

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stable(item)]),
  )
}

export function fingerprint(value) {
  return createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex')
}

function outcome(kind, nextAction, failureClass, reason, checks, context = {}) {
  const result = {
    ready: kind === 'ready',
    kind,
    next_action: nextAction,
    failure_class: failureClass,
    reason,
    recoverable: kind !== 'stop',
    checks,
    context,
  }
  return { ...result, fingerprint: fingerprint(result) }
}

function failure(kind, nextAction, failureClass, reason, checks, context) {
  checks.push({ name: reason, status: 'fail' })
  return outcome(kind, nextAction, failureClass, reason, checks, context)
}

function nonEmptyStrings(value) {
  return Array.isArray(value) && value.length > 0 && value.every(item =>
    typeof item === 'string' && item.trim().length > 0,
  )
}

export function evaluateExecutionPreflight({
  packet,
  runtime,
  executions = [],
  serializationConflicts = [],
  purpose = 'implementation',
}) {
  const checks = []
  const task = packet?.task
  const project = packet?.project
  const workstream = packet?.workstream
  const suit = packet?.suit

  if (!task || !project || !workstream || !suit) {
    return failure('stop', 'safety-stop', 'safety-stop', 'incomplete_task_packet', checks)
  }

  const expectedFingerprint = runtime?.control_database?.expected_fingerprint
  const actualFingerprint = runtime?.control_database?.actual_fingerprint
  if (!expectedFingerprint) {
    return failure('wait', 'wait-operator', 'operator-wait', 'control_database_fingerprint_not_configured', checks, {
      actual_fingerprint: actualFingerprint ?? null,
      identity: runtime?.control_database?.identity ?? null,
    })
  }
  if (!actualFingerprint || actualFingerprint !== expectedFingerprint) {
    return failure('stop', 'safety-stop', 'safety-stop', 'control_database_fingerprint_mismatch', checks, {
      expected_fingerprint: expectedFingerprint,
      actual_fingerprint: actualFingerprint ?? null,
      identity: runtime?.control_database?.identity ?? null,
    })
  }
  checks.push({ name: 'control_database_identity', status: 'pass', fingerprint: actualFingerprint })

  const latestExecution = [...executions]
    .sort((left, right) => Number(left.attempt ?? 0) - Number(right.attempt ?? 0))
    .at(-1)
  const repairEligible =
    purpose === 'verification-product-repair' &&
    task.status === 'failed' &&
    latestExecution?.status === 'succeeded'
  const retryEligible =
    purpose === 'retry' &&
    task.status === 'failed' &&
    latestExecution?.status !== 'succeeded'
  if (
    (task.status !== 'in_progress' && !repairEligible && !retryEligible) ||
    project.active !== true || workstream.active !== true || suit.status !== 'active'
  ) {
    return failure('stop', 'safety-stop', 'safety-stop', 'task_not_execution_eligible', checks)
  }
  checks.push({
    name: 'task_lifecycle',
    status: 'pass',
    purpose,
    failed_verification_product_repair: repairEligible,
    failed_execution_retry: retryEligible,
  })

  const hardDependency = (packet.dependencies ?? []).find(dependency =>
    dependency.dependency_type === 'hard' && dependency.status !== 'complete',
  )
  if (hardDependency) {
    return failure('wait', 'wait-external', 'external-wait', 'hard_dependency_unsatisfied', checks, {
      dependency_task_id: hardDependency.task_id,
      dependency_status: hardDependency.status,
    })
  }
  checks.push({ name: 'hard_dependencies', status: 'pass' })

  const blockingDecision = (packet.decisions ?? []).find(decision =>
    decision.blocking === true && decision.status !== 'approved',
  )
  if (blockingDecision) {
    return failure('wait', 'wait-decision', 'decision-wait', 'blocking_decision_unresolved', checks, {
      decision_id: blockingDecision.id,
      decision_status: blockingDecision.status,
    })
  }
  checks.push({ name: 'blocking_decisions', status: 'pass' })

  if (workstream.concurrency_policy?.serialized !== false && serializationConflicts.length > 0) {
    return failure('wait', 'wait-external', 'external-wait', 'workstream_serialization_conflict', checks, {
      conflicting_tasks: serializationConflicts.map(item => item.task_id).sort(),
    })
  }
  checks.push({ name: 'workstream_serialization', status: 'pass' })

  let retryPolicy
  try {
    retryPolicy = validateRetryPolicy(packet.retry_policy)
  }
  catch (error) {
    return failure('wait', 'wait-operator', 'operator-wait', error.message, checks)
  }

  const completedAttempts = executions.filter(execution =>
    ['succeeded', 'failed', 'cancelled'].includes(execution.status),
  ).length
  const nextAttempt = completedAttempts + 1
  if (nextAttempt > retryPolicy.max_attempts) {
    return failure('stop', 'safety-stop', 'safety-stop', 'retry_budget_exhausted', checks, {
      completed_attempts: completedAttempts,
      max_attempts: retryPolicy.max_attempts,
    })
  }

  let profile
  try {
    profile = profileForAttempt(retryPolicy, nextAttempt)
    const configuredProfile = getProfile(profile)
    if (!configuredProfile.uses_codex) throw new Error('implementation_profile_must_use_codex')
    if (task.model_profile) getProfile(task.model_profile)
  }
  catch (error) {
    return failure('wait', 'wait-operator', 'operator-wait', error.message, checks)
  }
  checks.push({ name: 'retry_policy_and_model_profile', status: 'pass', attempt: nextAttempt, profile })

  if (
    typeof task.task_id !== 'string' ||
    typeof task.title !== 'string' || !task.title.trim() ||
    typeof task.description !== 'string' || !task.description.trim() ||
    !nonEmptyStrings(task.acceptance_criteria) ||
    !nonEmptyStrings(task.verification_plan)
  ) {
    return failure('wait', 'wait-operator', 'operator-wait', 'task_contract_incomplete', checks)
  }

  const allowedPaths = project.allowed_publication_paths
  if (!Array.isArray(allowedPaths) || allowedPaths.length === 0 || !allowedPaths.every(validPublicationPath)) {
    return failure('wait', 'wait-operator', 'publication-scope', 'publication_scope_invalid', checks)
  }
  const publicationBoundaries = evaluatePublicationBoundaries({
    taskPaths: packet.publication_boundaries?.task_paths ?? task.allowed_paths ?? [],
    sourcePaths: packet.publication_boundaries?.source_paths ?? [],
    workstreamPaths: packet.publication_boundaries?.workstream_paths ?? [
      `${String(workstream.application_path ?? suit.app_path ?? '').replace(/\/$/, '')}/`,
    ],
    projectPaths: packet.publication_boundaries?.project_paths ?? allowedPaths,
  })
  if (!allowedPaths.some(prefix => String(workstream.application_path ?? suit.app_path ?? '').startsWith(prefix))) {
    return failure('wait', 'wait-operator', 'publication-scope', 'workstream_outside_publication_scope', checks)
  }
  const publicationReadiness = evaluatePublicationReadiness({
    contract: packet.publication_contract,
    taskPaths: publicationBoundaries.task_paths,
    sourcePaths: publicationBoundaries.source_paths,
    workstreamPaths: publicationBoundaries.workstream_paths,
    projectPaths: publicationBoundaries.project_paths,
    ordinaryAuthorizations: packet.publication_authorizations?.ordinary ?? [],
    protectedAuthorizations: packet.publication_authorizations?.protected ?? [],
    runtimeFiles: runtime?.repository?.worktree_target?.changed_files ?? [],
  })
  const publicationOutcome = publicationReadinessOutcome(publicationReadiness)
  if (!publicationReadiness.ready) {
    return failure(
      publicationOutcome.kind,
      publicationOutcome.kind === 'stop' ? 'safety-stop' : 'wait-operator',
      publicationOutcome.kind === 'stop' ? 'safety-stop' : 'publication-scope',
      publicationOutcome.reason,
      checks,
      {
        publication_boundaries: publicationBoundaries,
        publication_readiness: publicationReadiness,
        requested_paths: publicationReadiness.protected_authorization_required.length > 0
          ? publicationReadiness.protected_authorization_required
          : publicationReadiness.exact_authorization_required,
      },
    )
  }
  if (!completePublicationPolicy(workstream.publication_config)) {
    return failure('wait', 'wait-operator', 'publication-scope', 'publication_policy_incomplete', checks)
  }

  const verificationReadiness = evaluateVerificationReadiness(packet)
  if (!verificationReadiness.ready) {
    return failure(
      'wait',
      'wait-operator',
      'verification-configuration',
      verificationReadiness.reason,
      checks,
      { unenforced: verificationReadiness.unenforced ?? [] },
    )
  }
  checks.push({
    name: 'task_contract_publication_and_verification_readiness',
    status: 'pass',
    publication_boundaries: publicationBoundaries,
    publication_readiness: publicationReadiness,
  })

  const missingExecutable = Object.entries(runtime?.executables ?? {})
    .find(([, available]) => available !== true)
  if (missingExecutable) {
    return failure('wait', 'wait-operator', 'operator-wait', 'required_executable_missing', checks, {
      executable: missingExecutable[0],
    })
  }
  if (runtime?.environment?.valid !== true) {
    return failure('wait', 'wait-operator', 'operator-wait', 'required_environment_configuration_missing', checks, {
      missing: [...(runtime?.environment?.missing ?? [])].sort(),
    })
  }
  checks.push({ name: 'runtime_executables_and_environment', status: 'pass' })

  const repository = runtime?.repository
  if (!repository?.root_valid || !repository.integration_sha || !repository.parent?.parent_sha) {
    return failure('wait', 'wait-external', 'repository-state', 'repository_state_unavailable', checks)
  }
  if (!repository.integration_commit_present || !repository.parent_commit_present) {
    return failure('reconcile', 'reconcile-repository', 'repository-state', 'required_upstream_commit_missing', checks)
  }
  if (repository.parent_consistent !== true) {
    return failure('wait', 'wait-operator', 'repository-state', 'parent_branch_sha_pr_inconsistent', checks)
  }
  if (repository.worktree_target?.status === 'missing') {
    return failure('reconcile', 'reconcile-repository', 'repository-state', 'worktree_not_prepared', checks, {
      worktree_path: repository.worktree_target.path,
    })
  }
  if (repository.worktree_target?.status === 'stale') {
    return failure('wait', 'wait-operator', 'repository-state', 'prepared_worktree_stale', checks)
  }
  if (repository.worktree_target?.status === 'invalid') {
    return failure('stop', 'safety-stop', 'safety-stop', 'worktree_target_invalid', checks)
  }
  checks.push({ name: 'repository_parent_and_worktree', status: 'pass' })

  if (runtime?.repository?.dependencies_ready !== true) {
    return failure(
      'reconcile',
      'reconcile-runtime',
      'transient-infrastructure',
      'repository_dependencies_missing',
      checks,
      {
        worktree_path: repository.worktree_target?.path ?? null,
      },
    )
  }
  checks.push({ name: 'repository_dependencies', status: 'pass' })

  return outcome('ready', 'reconcile-runtime', 'transient-infrastructure', 'preflight_ready', checks, {
    attempt: nextAttempt,
    profile,
    parent_sha: repository.parent.parent_sha,
    worktree_path: repository.worktree_target?.path ?? null,
    publication_boundaries: publicationBoundaries,
    publication_readiness: publicationReadiness,
  })
}
