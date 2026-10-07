import { effectiveFailureClass, legacyClassification } from './dot.mjs'
import { supersededPublicationHold, operationHasAuthoritativeSuccess, publicationStopNeedsReclassification } from './bounded-publication.mjs'
import { executionFailure, failedVerificationEvidence, reviewedFailureClass } from './recovery-evidence.mjs'
import { AUTO_CLASSES } from './selfhealing.mjs'
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
      snapshot.packet.project.verification_config,
    ],
    workstream: snapshot.packet?.workstream && [
      snapshot.packet.workstream.active,
      snapshot.packet.workstream.application_path,
      snapshot.packet.workstream.concurrency_policy,
      snapshot.packet.workstream.publication_config,
      snapshot.packet.workstream.verification_config,
    ],
    publication_execution_eligible:snapshot.publication_execution_eligible??null,
    run_publication_authority: snapshot.run_publication_authority ?? null,
    publication_boundaries: snapshot.packet?.publication_boundaries ?? null,
    publication_contract: snapshot.packet?.publication_contract && [
      snapshot.packet.publication_contract.contract_id,
      snapshot.packet.publication_contract.contract_fingerprint,
      snapshot.packet.publication_contract.updated_at,
    ],
    publication_authorizations: snapshot.packet?.publication_authorizations && [
      snapshot.packet.publication_authorizations.ordinary?.map(item =>
        [item.authorization_id, item.authorized_paths ?? item.requested_paths, item.revoked_at],
      ),
      snapshot.packet.publication_authorizations.protected?.map(item =>
        [item.authorization_id, item.authorized_paths, item.revoked_at],
      ),
    ],
    serialization_conflicts: snapshot.serialization_conflicts?.map(item =>
      [item.task_id, item.status, item.engine_stage],
    ),
    retry_accounting: snapshot.retry_accounting,
    binding_recovery: snapshot.binding_recovery,
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

  const run = snapshot.workflow_run
  if (run && (run.stop_requested || run.maintenance_requested || run.status !== 'running' || run.completed_tasks >= run.max_tasks)) {
    return decision('wait', 'wait-operator', 'operator-wait', run.stop_requested ? 'stop_requested' : run.maintenance_requested ? 'maintenance_requested' : run.completed_tasks >= run.max_tasks ? 'limit_reached' : 'run_not_running', { execution, fingerprint })
  }
  if(task.status==='failed'&&snapshot.exhaustion_audit?.action==='investigate'&&(!snapshot.authoritative_failure||snapshot.authoritative_failure.classification==='UNKNOWN')&&!['operator-wait','decision-wait'].includes(executionFailure(snapshot,execution)?.failure_class))return decision('wait','wait-external','transient-infrastructure','retry_audit_investigation_required',{execution,fingerprint,exhaustion_audit:snapshot.exhaustion_audit})
  const reclassifyPublicationStop = publicationStopNeedsReclassification(snapshot)
  if (recovery?.next_action === 'safety-stop' && !reclassifyPublicationStop && recovery.condition?.fingerprint === fingerprint) {
    return decision('terminal','safety-stop',recovery.failure_class ?? 'safety-stop',recovery.error_code ?? 'persisted_safety_stop',{execution,verification,publication,fingerprint,persisted:true,recoverable:false})
  }
  const operation = snapshot.runtime_operations?.find(op => op.status !== 'consumed')
  if (operation && !(recovery?.status === 'active' && ['wait-operator','wait-decision','safety-stop'].includes(recovery.next_action))) {
    if (!operationHasAuthoritativeSuccess(snapshot, operation) && Date.parse(operation.next_wake_at) > Date.now()) return decision('wait','wait-external','transient-infrastructure','runtime_backoff_pending',{ operation, execution, fingerprint })
    return decision('act','reconcile-runtime','transient-infrastructure','runtime_operation_resume',{ command: operation.action, operation, execution, fingerprint })
  }
  if (
    recovery?.status === 'active' &&
    !(recovery.next_action === 'wait-external' && ['VERIFIER_INFRA','CONFIGURATION'].includes(snapshot.authoritative_failure?.classification)) &&
    !reclassifyPublicationStop &&
    !supersededPublicationHold(snapshot) &&
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

  if(task.status==='failed'&&snapshot.recovery_readiness?.allowed===false&&['VERIFIER_INFRA','CONFIGURATION'].includes(snapshot.authoritative_failure?.classification))return decision('wait','reverify',snapshot.authoritative_failure.classification==='VERIFIER_INFRA'?'verification-infrastructure':'verification-configuration','verifier_repair_required',{execution,fingerprint})
  if(task.status==='failed'&&snapshot.recovery_readiness?.allowed===false)return decision('wait','wait-external','unknown-outcome','verifier_repair_without_progress',{execution,fingerprint})

  if(task.status==='failed'&&snapshot.recovery_readiness?.allowed===true&&['VERIFIER_INFRA','CONFIGURATION'].includes(snapshot.authoritative_failure?.classification)&&!snapshot.authoritative_failure?.evidence?.adoption_materialization)return decision('act','reverify',snapshot.authoritative_failure.classification==='VERIFIER_INFRA'?'verification-infrastructure':'verification-configuration','current_trusted_verifier_recovery',{command:'task-verify',execution,verification,fingerprint})

  if (task.status==='failed' && snapshot.authoritative_failure?.evidence?.adoption_materialization===true && Number(snapshot.authoritative_failure.evidence.verification_run_id)===Number(verification?.verification_run_id) && snapshot.recovery_readiness?.allowed===true) {
    return decision('act','reverify','verification-infrastructure','legacy_trusted_evidence_materialization',{command:'task-verify',execution,verification,fingerprint})
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
    const originalFailure = executionFailure(snapshot, execution)
    const explicitFailure = originalFailure && { ...originalFailure, failure_class: effectiveFailureClass(snapshot, originalFailure.failure_class) }
    if (['verification-configuration','verification-infrastructure'].includes(explicitFailure?.failure_class) && execution?.status==='failed' && snapshot.run_publication_authority?.authorized) {
      return decision('act','reverify',explicitFailure.failure_class,'same_attempt_verifier_reacceptance',{command:'task-reaccept',execution,verification,publication,fingerprint})
    }
    if (['verification-configuration','verification-infrastructure'].includes(explicitFailure?.failure_class) && execution?.status==='succeeded' && snapshot.exhaustion_audit?.entries?.some(e=>e.execution_id===execution.execution_id&&e.proof?.length&&e.proof.every(p=>p.version===2)))return decision('act','reverify',explicitFailure.failure_class,'reviewed_existing_verifier_recovery',{command:'task-verify',execution,verification,publication,fingerprint})
    if (explicitFailure?.failure_class==='verification-configuration' && execution?.status==='succeeded' && snapshot.binding_recovery) {
      return decision('act','reverify','verification-configuration','existing_executable_binding_recovery',{command:'task-verify',execution,verification,publication,fingerprint})
    }
    // An audited unknown is a safety gate, never fall through to legacy PRODUCT.
    if (explicitFailure?.failure_class==='unknown-outcome') return decision('wait','wait-external','unknown-outcome','retry_classification_review_required',{execution,verification,publication,fingerprint})
    if (explicitFailure?.failure_class==='safety-stop') return decision('wait','wait-operator','operator-wait','retry_classification_review_required',{execution,verification,publication,fingerprint})
    const explicitWait = explicitWaitClasses.get(explicitFailure?.failure_class)
    const typedFailure = explicitFailure?.metadata?.classification?.failure_class === explicitFailure?.failure_class
    if (explicitWait && (explicitFailure?.metadata?.supervisor_classified === true || typedFailure)) {
      return decision(explicitWait === 'safety-stop' ? 'terminal' : 'wait', explicitWait, explicitFailure.failure_class, explicitFailure.error_code ?? 'classified_failure', {
        execution, verification, publication, fingerprint, recoverable: explicitWait !== 'safety-stop',
      })
    }

    if (AUTO_CLASSES.has(explicitFailure?.failure_class) && !String(explicitFailure.failure_class).startsWith('verification-')) {
      return decision('wait','wait-external',explicitFailure.failure_class,'same_execution_infrastructure_recovery',{ execution, verification, publication, fingerprint })
    }
    const verificationFailureClass =
      reviewedFailureClass(snapshot,execution) ??
      (String(explicitFailure?.failure_class ?? '').startsWith('verification-')
        ? explicitFailure.failure_class
        : null) ??
      failedVerificationEvidence(snapshot)?.classification?.failure_class ??
      verification?.metadata?.failure_class ??
      latest(
        (snapshot.verification_results ?? []).filter(result =>
          verification && Number(result.verification_run_id) === Number(verification.verification_run_id),
        ),
        'verification_id',
      )?.metadata?.failure_class ??
      (execution?.status === 'succeeded' && verification?.status === 'failed' ? 'unknown-outcome' : null)

    if (verificationFailureClass && verificationFailureClass !== 'verification-product-defect') {
      if(reviewedFailureClass(snapshot,execution)&&['verification-infrastructure','verification-configuration'].includes(verificationFailureClass))return decision('act','reverify',verificationFailureClass,'trusted_reviewed_same_execution_reverification',{command:'task-verify',execution,verification,publication,fingerprint})
      if (verificationFailureClass === 'unknown-outcome') return decision('wait','wait-external','unknown-outcome','retry_audit_investigation_required',{execution,verification,publication,fingerprint})
      if (verificationFailureClass === 'verification-lifecycle') {
        return decision('act', 'reverify', verificationFailureClass, 'verification_lifecycle_reverify', {
          command: 'task-verify', execution, verification, publication, fingerprint,
        })
      }

      const retryAfterWait =
        recovery?.failure_class === verificationFailureClass &&
        recovery?.next_wake_at &&
        Date.parse(recovery.next_wake_at) <= Date.now()
      const configurationChanged =
        recovery?.failure_class === verificationFailureClass &&
        recovery?.condition?.fingerprint &&
        recovery.condition.fingerprint !== fingerprint
      if (retryAfterWait || configurationChanged) {
        return decision('act', 'reverify', verificationFailureClass, 'verification_condition_changed', {
          command: 'task-verify', execution, verification, publication, fingerprint,
        })
      }

      if (verificationFailureClass === 'verification-infrastructure') {
        return decision('wait', 'wait-external', verificationFailureClass, 'verification_infrastructure_unavailable', {
          execution, verification, publication, fingerprint,
        })
      }
      return decision('wait', 'wait-operator', verificationFailureClass, 'verification_configuration_required', {
        execution, verification, publication, fingerprint,
      })
    }

    if (verificationFailureClass !== 'verification-product-defect' && explicitFailure?.failure_class !== 'verification-product-defect') {
      return decision('wait','wait-external','unknown-outcome','unknown_failure_outcome',{execution,verification,publication,fingerprint})
    }
    const policy = snapshot.packet.retry_policy ?? {}
    const attemptsRemain = execution && (Number(snapshot.retry_accounting?.consumed ?? execution.attempt) < Number(policy.max_attempts ?? 0) || Number.isSafeInteger(policy.one_invocation_extension?.grant_id))
    if (!attemptsRemain&&!snapshot.exhaustion_audit)return decision('wait','wait-external','transient-infrastructure','retry_audit_required',{execution,fingerprint})
    if (!attemptsRemain && snapshot.retry_accounting && snapshot.retry_accounting.all_product !== true) {
      return decision('wait', 'wait-operator', 'operator-wait', 'retry_classification_review_required', { execution, verification, publication, fingerprint })
    }
    if (!attemptsRemain) {
      return decision('wait', 'wait-operator', 'operator-wait', 'retry_budget_exhausted', {
        execution, verification, publication, fingerprint, recoverable: false,
      })
    }
    const verificationFailure = verificationFailureClass === 'verification-product-defect'
    return decision('act', verificationFailure ? 'repair' : 'retry', verificationFailure ? 'verification-product-defect' : 'transient-infrastructure', verificationFailure ? 'verification_failed' : 'implementation_failed', {
      command: 'task-retry', execution, verification, publication, fingerprint,
    })
  }

  if (task.status === 'passed') {
    if (Array.isArray(snapshot.verification_results)) {
      const selected=snapshot.verification_results.filter(check=>Number(check.verification_run_id)===Number(verification?.verification_run_id) && check.metadata?.required!==false && check.status!=='skipped')
      if (!selected.length || selected.some(check=>check.trusted_receipt?.version!==2 || !check.trusted_registration)) {
        return decision('act','reverify','verification-lifecycle','trusted_pass_reverification_required',{command:'task-verify',execution,verification,publication,fingerprint})
      }
    }
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
  const lower = error.toLowerCase()
  if(/unchanged_recovery_action_forbidden|classified_verifier_repair_required/.test(error)){
    const failureClass = legacyClassification(payload?.classification?.failure_class)
    if (['verification-infrastructure', 'verification-configuration'].includes(failureClass)) return decision('wait', 'reverify', failureClass, 'verifier_repair_required', {recoverable:true})
    return decision('wait','wait-external','unknown-outcome','verifier_repair_without_progress',{recoverable:true})
  }
  const verificationClass = legacyClassification(payload?.classification?.failure_class ?? payload?.recovery?.failure_class ?? payload?.failure_class ?? payload?.publication?.classification?.failure_class ?? payload?.probe?.classification?.failure_class)
  const explicitWait = explicitWaitClasses.get(verificationClass)
  if (explicitWait) {
    return decision(explicitWait === 'safety-stop' ? 'terminal' : 'wait', explicitWait, verificationClass, error.slice(0, 160), { recoverable: explicitWait !== 'safety-stop' })
  }

  if (['transient-infrastructure', 'repository-state', 'publication-reconciliation', 'flaky-verification', 'unknown-outcome'].includes(verificationClass)) {
    return decision('wait','wait-external',verificationClass,error.slice(0,160))
  }

  if (verificationClass === 'verification-lifecycle') {
    return decision('act', 'reverify', verificationClass, 'verification_lifecycle_reverify', { command: 'task-verify' })
  }
  if (verificationClass === 'verification-product-defect') {
    if (Number(attempt ?? 0) >= Number(maxAttempts ?? 0)) {
      return decision('wait', 'wait-operator', 'operator-wait', 'retry_budget_exhausted', { recoverable: false })
    }
    return decision('act', 'repair', verificationClass, 'repair_verification_failed', { command: 'task-retry' })
  }
  if (verificationClass === 'verification-configuration') {
    return decision('wait', 'wait-operator', verificationClass, 'verification_configuration_required')
  }
  if (verificationClass === 'verification-infrastructure') {
    return decision('wait', 'wait-external', verificationClass, 'verification_infrastructure_unavailable')
  }
  if (verificationClass === 'verification-required-check-unavailable') {
    return decision('wait', 'wait-operator', verificationClass, 'required_verification_check_unavailable')
  }

  if ((payload?.classification?.recovery_action ?? payload?.publication?.classification?.recovery_action) === 'wait-operator') {
    return decision(
      'wait',
      'wait-operator',
      verificationClass ?? 'operator-wait',
      error.slice(0, 160),
    )
  }

  if (verificationClass) return decision('terminal','safety-stop','safety-stop','unknown_explicit_failure_class',{ recoverable: false })

  if (command === 'task-publish' && ['git_commit_failed','git_push_failed','gh_pr_create_failed','pr_create_failed'].includes(lower)) {
    return decision('wait','wait-external','publication-reconciliation','publication_response_lost_or_unavailable')
  }

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
  if (lower === 'verification_failed' || lower === 'repair_verification_failed') {
    return decision('wait','wait-external','unknown-outcome','retry_audit_investigation_required')
  }
  if (command === 'task-verify' || /malformed_child_response|durable_operation_pending|worker_process_interrupted|runtime_operation_in_flight/.test(lower)) return decision('wait','wait-external','transient-infrastructure','process_recovery_required')
  if (/parent|worktree|branch mismatch|dirty|upstream/.test(lower)) {
    return decision('wait', 'wait-operator', 'repository-state', 'repository_reconciliation_requires_operator')
  }
  if (/decision|requirement/.test(lower)) {
    return decision('wait', 'wait-decision', 'decision-wait', 'decision_required')
  }
  return decision('wait','wait-external','unknown-outcome',error.slice(0,160))
}
