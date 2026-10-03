import { createHash } from 'node:crypto'

const explicitWaitClasses = new Map([
  ['external-wait', 'wait-external'],
  ['decision-wait', 'wait-decision'],
  ['operator-wait', 'wait-operator'],
  ['safety-stop', 'safety-stop'],
])

function latest(items, field) {
  return [...(items ?? [])].sort((left, right) =>
    Number(left?.[field] ?? 0) - Number(right?.[field] ?? 0),
  ).at(-1) ?? null
}

function latestExecution(snapshot) {
  return [...(snapshot.executions ?? [])].sort((left, right) =>
    Number(left?.attempt ?? 0) - Number(right?.attempt ?? 0),
  ).at(-1) ?? null
}

export function supervisorResumeIdentity(taskId) {
  return `task:${taskId}`
}

export function preflightReconciliationAction(preflight) {
  if (preflight?.kind !== 'reconcile') return null

  if (preflight.reason === 'worktree_not_prepared') {
    return 'task-prepare'
  }

  if (preflight.reason === 'repository_dependencies_missing') {
    return 'prepare-dependencies'
  }

  return null
}

export function supervisorStateFingerprint(snapshot) {
  const task = snapshot.packet?.task ?? null
  const execution = latestExecution(snapshot)
  const verification = latest(
    (snapshot.verification_runs ?? []).filter(run =>
      execution && Number(run.execution_id) === Number(execution.execution_id),
    ),
    'verification_run_id',
  )
  const failure = latest(
    (snapshot.failures ?? []).filter(item => item.resolved_at == null),
    'failure_id',
  )
  const publication = latest(snapshot.publications, 'pull_request_id')

  return createHash('sha256').update(JSON.stringify({
    task: task && [
      task.task_id, task.status, task.engine_stage, task.model_profile,
      task.title, task.description, task.acceptance_criteria, task.verification_plan,
      task.verification_mode,
      task.allowed_paths,
    ],
    dependencies: snapshot.packet?.dependencies?.map(item =>
      [item.task_id, item.dependency_type, item.status],
    ),
    decisions: snapshot.packet?.decisions?.map(item =>
      [item.id, item.blocking, item.status],
    ),
    project: snapshot.packet?.project && [
      snapshot.packet.project.active,
      snapshot.packet.project.allowed_publication_paths,
      snapshot.packet.project.environment_routing,
    ],
    workstream: snapshot.packet?.workstream && [
      snapshot.packet.workstream.active,
      snapshot.packet.workstream.application_path,
      snapshot.packet.workstream.concurrency_policy,
      snapshot.packet.workstream.publication_config,
    ],
    publication_boundaries: snapshot.packet?.publication_boundaries ?? null,
    serialization_conflicts: snapshot.serialization_conflicts?.map(item =>
      [item.task_id, item.status, item.engine_stage],
    ),
    execution: execution && [execution.execution_id, execution.attempt, execution.status, execution.engine_stage],
    verification: verification && [
      verification.verification_run_id,
      verification.status,
      verification.verification_mode ?? 'focused',
    ],
    failure: failure && [failure.failure_id, failure.failure_class, failure.recovery_action, failure.resolved_at],
    publication: publication && [publication.pull_request_id, publication.pr_number, publication.state, publication.head_sha],
    parent_satisfaction: snapshot.parent_satisfaction && [
      snapshot.parent_satisfaction.fingerprint,
      snapshot.parent_satisfaction.satisfied,
      snapshot.parent_satisfaction.parent_branch,
      snapshot.parent_satisfaction.parent_sha,
      snapshot.parent_satisfaction.reason,
    ],
  })).digest('hex')
}

function decision(kind, nextAction, failureClass, reason, extra = {}) {
  return {
    kind,
    next_action: nextAction,
    failure_class: failureClass,
    reason,
    recoverable: kind !== 'terminal',
    ...extra,
  }
}

export function planSupervisorStep(snapshot) {
  const task = snapshot.packet?.task
  if (!task) throw new Error('supervisor_snapshot_missing_task')

  const fingerprint = supervisorStateFingerprint(snapshot)
  const execution = latestExecution(snapshot)
  const verificationRuns = (snapshot.verification_runs ?? []).filter(run =>
    execution && Number(run.execution_id) === Number(execution.execution_id),
  )
  const verification = latest(verificationRuns, 'verification_run_id')
  const publication = latest(snapshot.publications, 'pull_request_id')
  const recovery = snapshot.recovery

  if (
    recovery?.status === 'active' &&
    recovery.condition?.preflight !== true &&
    recovery.condition?.fingerprint === fingerprint &&
    ['wait-external', 'wait-decision', 'wait-operator', 'safety-stop'].includes(recovery.next_action) &&
    (
      recovery.next_action !== 'wait-external' ||
      !recovery.next_wake_at ||
      Date.parse(recovery.next_wake_at) > Date.now()
    )
  ) {
    return decision(
      recovery.next_action === 'safety-stop' ? 'terminal' : 'wait',
      recovery.next_action,
      recovery.failure_class,
      recovery.error_code ?? 'persisted_recovery_condition',
      { execution, verification, publication, fingerprint, persisted: true },
    )
  }

  if (task.status === 'complete') {
    return decision('terminal', publication ? 'reconcile-publication' : 'complete-no-changes', publication ? 'publication-reconciliation' : 'no-change', 'task_complete', {
      execution, verification, publication, fingerprint, recoverable: false,
    })
  }

  if (task.status === 'cancelled') {
    return decision('terminal', 'safety-stop', 'safety-stop', 'task_cancelled', {
      execution, verification, publication, fingerprint, recoverable: false,
    })
  }

  if (task.status === 'blocked') {
    return decision('wait', 'wait-operator', 'operator-wait', 'task_blocked', {
      execution, verification, publication, fingerprint,
    })
  }

  if (['planned', 'ready'].includes(task.status)) {
    return decision('wait', 'wait-operator', 'operator-wait', 'task_not_claimed', {
      execution, verification, publication, fingerprint,
    })
  }

  if (execution && ['queued', 'running'].includes(execution.status)) {
    return decision('wait', 'wait-external', 'external-wait', 'execution_in_flight', {
      execution, verification, publication, fingerprint,
    })
  }

  if (task.status === 'in_progress') {
    if (!execution) {
      if (snapshot.parent_satisfaction?.satisfied === true) {
        return decision('act', 'complete-no-changes', 'no-change', 'parent_satisfaction_proven', {
          command: 'complete-parent-satisfied',
          execution,
          verification,
          publication,
          parent_satisfaction: snapshot.parent_satisfaction,
          fingerprint,
        })
      }
      return decision('act', 'retry', 'transient-infrastructure', 'implementation_required', {
        command: 'task-run', execution, verification, publication, fingerprint,
      })
    }
    if (execution.status === 'succeeded') {
      return decision('act', 'reconcile-runtime', 'transient-infrastructure', 'verification_required', {
        command: 'task-verify', execution, verification, publication, fingerprint,
      })
    }
    return decision('terminal', 'safety-stop', 'safety-stop', 'inconsistent_in_progress_execution', {
      execution, verification, publication, fingerprint, recoverable: false,
    })
  }

  if (task.status === 'verification') {
    if (execution?.status !== 'succeeded') {
      return decision('terminal', 'safety-stop', 'safety-stop', 'verification_without_succeeded_execution', {
        execution, verification, publication, fingerprint, recoverable: false,
      })
    }
    return decision('act', 'reconcile-runtime', 'transient-infrastructure', 'verification_resume', {
      command: 'task-verify', execution, verification, publication, fingerprint,
    })
  }

  if (task.status === 'failed') {
    const explicitFailure = latest(
      (snapshot.failures ?? []).filter(item => item.resolved_at == null),
      'failure_id',
    )
    const explicitWait = explicitWaitClasses.get(explicitFailure?.failure_class)
    if (explicitWait && explicitFailure?.metadata?.supervisor_classified === true) {
      return decision(explicitWait === 'safety-stop' ? 'terminal' : 'wait', explicitWait, explicitFailure.failure_class, explicitFailure.error_code ?? 'classified_failure', {
        execution, verification, publication, fingerprint, recoverable: explicitWait !== 'safety-stop',
      })
    }

    const policy = snapshot.packet.retry_policy ?? {}
    const attemptsRemain = execution && Number(execution.attempt) < Number(policy.max_attempts ?? 0)
    if (!attemptsRemain) {
      return decision('terminal', 'safety-stop', 'safety-stop', 'retry_budget_exhausted', {
        execution, verification, publication, fingerprint, recoverable: false,
      })
    }
    const verificationFailure = execution.status === 'succeeded'
    return decision('act', verificationFailure ? 'repair' : 'retry', verificationFailure ? 'verification-product-defect' : 'transient-infrastructure', verificationFailure ? 'verification_failed' : 'implementation_failed', {
      command: 'task-retry', execution, verification, publication, fingerprint,
    })
  }

  if (task.status === 'passed') {
    if (publication) {
      return decision('act', 'reconcile-publication', 'publication-reconciliation', 'publication_record_requires_reconciliation', {
        command: 'task-publish', execution, verification, publication, fingerprint,
      })
    }
    return decision('act', 'reconcile-publication', 'publication-reconciliation', 'publication_pending', {
      command: 'task-publish', execution, verification, publication, fingerprint,
    })
  }

  return decision('terminal', 'safety-stop', 'safety-stop', 'unsupported_task_state', {
    execution, verification, publication, fingerprint, recoverable: false,
  })
}

export function classifySupervisorFailure({ command, payload, attempt, maxAttempts }) {
  const error = String(payload?.publication?.error ?? payload?.error ?? 'task_action_failed')
  const lower = `${error} ${JSON.stringify(payload ?? {})}`.toLowerCase()

  if (lower.includes('no_publishable_changes')) {
    return decision('act', 'complete-no-changes', 'no-change', 'no_publishable_changes', {
      command: 'handle-no-publishable-changes', recoverable: false,
    })
  }
  if (/publication_scope|publication scope|allowed path|unauthorized/.test(lower)) {
    return decision('wait', 'wait-operator', 'publication-scope', 'publication_scope_requires_operator')
  }
  if (/permission|authorization|credential|authentication/.test(lower)) {
    return decision('wait', 'wait-operator', 'operator-wait', 'operator_authorization_required')
  }
  if (/timeout|network|fetch|connect|temporar|unavailable|pr_create_failed|unable_to_find_existing_pr|unable_to_inspect_remote_branch|unable_to_read_created_pr|stack_parent_resolution_failed/.test(lower)) {
    return decision('wait', 'wait-external', 'external-wait', 'external_dependency_unavailable')
  }
  if (command === 'task-verify' || lower.includes('verification_failed')) {
    if (Number(attempt ?? 0) >= Number(maxAttempts ?? 0)) {
      return decision('terminal', 'safety-stop', 'safety-stop', 'retry_budget_exhausted', { recoverable: false })
    }
    return decision('act', 'repair', 'verification-product-defect', 'verification_failed', { command: 'task-retry' })
  }
  if (/parent|worktree|branch mismatch|dirty|upstream/.test(lower)) {
    return decision('wait', 'wait-operator', 'repository-state', 'repository_reconciliation_requires_operator')
  }
  if (/decision|requirement/.test(lower)) {
    return decision('wait', 'wait-decision', 'decision-wait', 'decision_required')
  }
  return decision('terminal', 'safety-stop', 'safety-stop', error.slice(0, 160), { recoverable: false })
}
