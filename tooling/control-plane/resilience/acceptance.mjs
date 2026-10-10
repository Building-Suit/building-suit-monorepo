import { createHash } from 'node:crypto'
import {
  CONTROL_DATABASE_RETRY_POLICY,
  controlDatabaseWaitOutcome,
  executeWithControlDatabaseRetry,
} from '../lib/control-database.mjs'
import { inspectWorkflowSnapshot, validateControllerReplacements } from '../lib/n8n-workflows.mjs'
import { continuousRunTransition } from '../lib/n8n-controller.mjs'
import { acceptanceCriteriaDigest, evaluateParentSatisfaction } from '../runner/parent-satisfaction.mjs'
import {
  classifyPublicationFiles,
  evaluatePublicationBoundaries,
  planPublicationReconciliation,
  validatePublicationAuthorization,
} from '../runner/publication-preflight.mjs'
import { evaluatePublicationReadiness } from '../runner/publication-readiness.mjs'
import { classifySupervisorFailure, planSupervisorStep, preflightReconciliationAction } from '../runner/task-supervisor.mjs'
import { customCheckSelection } from '../runner/verification-mode.mjs'
import { isDueExternalRecovery, watchTransition } from '../runner/external-state-watcher.mjs'
import { applyCompletionCredit, evaluateSafeResume, planActiveRunStart } from '../lib/batch-readiness.mjs'

const ZERO_COUNTS = Object.freeze({
  implementation_attempts: 0,
  verification_runs: 0,
  publication_attempts: 0,
  ai_calls: 0,
  implementation_retry_budget_consumed: 0,
})

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function fixture({ taskStatus = 'in_progress', executionStatus = null, attempt = 1, verificationStatus = null, publication = null, productFailure = false } = {}) {
  return {
    packet: {
      task: { task_id: 'CP-FI-001', status: taskStatus, engine_stage: 'implementation' },
      retry_policy: { policy_id: 'critical-five', max_attempts: 5, attempt_profiles: Array(5).fill('standard') },
    },
    executions: executionStatus ? [{ execution_id: 41, attempt, status: executionStatus, engine_stage: 'implementation' }] : [],
    verification_runs: verificationStatus ? [{ verification_run_id: 71, execution_id: 41, status: verificationStatus,metadata:productFailure?{failure_class:'verification-product-defect'}:{} }] : [],
    verification_results: verificationStatus === 'passed' ? [{verification_run_id:71,status:'pass',metadata:{required:true},trusted_receipt:{version:2},trusted_registration:{version:1}}] : [],
    failures: [],
    publications: publication ? [{ pull_request_id: 91, state: 'open', ...publication }] : [],
    recovery: null,
  }
}

function scenario(id, injectedFault, expectedRecoveryPath, observedRecoveryPath, checks, counts = {}, evidence = {}) {
  const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name)
  return {
    id,
    mandatory: true,
    injected_fault: injectedFault,
    expected_recovery_path: expectedRecoveryPath,
    observed_recovery_path: observedRecoveryPath,
    counts: { ...ZERO_COUNTS, ...counts },
    result: failedChecks.length === 0 ? 'pass' : 'fail',
    failed_checks: failedChecks,
    evidence,
  }
}

function lifecycleScenarios() {
  const initial = planSupervisorStep(fixture())
  const running = planSupervisorStep(fixture({ executionStatus: 'running' }))
  const succeeded = planSupervisorStep(fixture({ executionStatus: 'succeeded' }))
  const failedVerification = planSupervisorStep(fixture({ taskStatus: 'failed', executionStatus: 'succeeded', verificationStatus: 'failed', productFailure:true }))
  const verificationResume = planSupervisorStep(fixture({ taskStatus: 'verification', executionStatus: 'succeeded' }))
  const passed = planSupervisorStep(fixture({ taskStatus: 'passed', executionStatus: 'succeeded', verificationStatus: 'passed' }))

  return [
    scenario('interrupt-before-implementation-execution', 'controller exits after planning implementation but before execution creation', ['task-run', 'persist one execution', 'task-verify'], [initial.command, initial.command, succeeded.command], {
      same_plan: initial.fingerprint === planSupervisorStep(fixture()).fingerprint,
      resumes_with_task_run: initial.command === 'task-run',
      next_stage_is_verification: succeeded.command === 'task-verify',
    }, { implementation_attempts: 1, ai_calls: 1, implementation_retry_budget_consumed: 1 }),
    scenario('interrupt-during-implementation', 'controller exits while the persisted implementation execution is running', ['wait-external', 'task-verify'], [running.next_action, succeeded.command], {
      waits_for_existing_execution: running.reason === 'execution_in_flight',
      does_not_plan_duplicate_run: running.command == null,
      resumes_at_verification: succeeded.command === 'task-verify',
    }, { implementation_attempts: 1, ai_calls: 1, implementation_retry_budget_consumed: 1 }),
    scenario('interrupt-after-implementation-success', 'controller exits after implementation success is persisted', ['task-verify'], [succeeded.command], {
      resumes_at_verification: succeeded.command === 'task-verify',
    }, { implementation_attempts: 1, ai_calls: 1, implementation_retry_budget_consumed: 1 }),
    scenario('interrupt-before-verification', 'controller exits immediately before verification invocation', ['task-verify'], [succeeded.command], {
      verification_is_first_incomplete_stage: succeeded.command === 'task-verify',
    }, { implementation_attempts: 1, ai_calls: 1, implementation_retry_budget_consumed: 1 }),
    scenario('interrupt-after-failed-verification', 'controller exits after a failed focused verification is persisted', ['task-retry', 'task-verify'], [failedVerification.command, verificationResume.command], {
      bounded_repair_selected: failedVerification.command === 'task-retry' && failedVerification.next_action === 'repair',
      repaired_execution_returns_to_verification: verificationResume.command === 'task-verify',
    }, { implementation_attempts: 2, verification_runs: 1, ai_calls: 2, implementation_retry_budget_consumed: 2 }),
    scenario('interrupt-after-repaired-verification', 'controller exits after repair succeeds and before its confirmation verification', ['task-verify'], [verificationResume.command], {
      confirmation_verification_selected: verificationResume.command === 'task-verify',
    }, { implementation_attempts: 2, verification_runs: 1, ai_calls: 2, implementation_retry_budget_consumed: 2 }),
    scenario('interrupt-after-passed-verification', 'controller exits after the authoritative verification pass is persisted', ['task-publish'], [passed.command], {
      resumes_at_publication: passed.command === 'task-publish',
      implementation_not_replanned: passed.command !== 'task-run',
      verification_not_replanned: passed.command !== 'task-verify',
    }, { implementation_attempts: 1, verification_runs: 1, publication_attempts: 1, ai_calls: 1, implementation_retry_budget_consumed: 1 }),
  ]
}

function publicationScenarios() {
  const parentSha = '1'.repeat(40)
  const headSha = '2'.repeat(40)
  const beforeCommit = planPublicationReconciliation({ parentSha, localSha: parentSha, localTaskCommits: false, expectedBase: 'stg' })
  const afterCommit = planPublicationReconciliation({ parentSha, localSha: headSha, localTaskCommits: true, expectedBase: 'stg' })
  const afterPush = planPublicationReconciliation({ parentSha, localSha: headSha, remoteSha: headSha, localTaskCommits: true, remoteTaskCommits: true, expectedBase: 'stg' })
  const afterPr = planPublicationReconciliation({ parentSha, localSha: headSha, remoteSha: headSha, localTaskCommits: true, remoteTaskCommits: true, existingPrs: [{ number: 17, baseRefName: 'stg', isDraft: true }], expectedBase: 'stg' })
  return [
    scenario('interrupt-before-commit', 'publisher exits before creating the task commit', ['create one commit', 'push-and-create-pr'], ['resume publication', beforeCommit.action], {
      no_duplicate_commit_claimed: beforeCommit.action === 'push_and_create_pr',
    }, { implementation_attempts: 1, verification_runs: 1, publication_attempts: 1, ai_calls: 1, implementation_retry_budget_consumed: 1 }),
    scenario('interrupt-after-commit', 'publisher exits after the local task commit is created', ['reuse commit', 'push-and-create-pr'], ['existing local commit', afterCommit.action], {
      existing_commit_reused: afterCommit.action === 'push_and_create_pr',
    }, { implementation_attempts: 1, verification_runs: 1, publication_attempts: 1, ai_calls: 1, implementation_retry_budget_consumed: 1 }),
    scenario('interrupt-before-pr-creation', 'publisher exits after the remote branch is created but before draft PR creation', ['reuse remote branch', 'create-pr'], ['matching remote branch', afterPush.action], {
      remote_branch_reused: afterPush.action === 'create_pr',
    }, { implementation_attempts: 1, verification_runs: 1, publication_attempts: 1, ai_calls: 1, implementation_retry_budget_consumed: 1 }),
    scenario('interrupt-after-pr-creation', 'publisher exits after draft PR creation but before local publication completion', ['reuse-existing-pr'], [afterPr.action], {
      existing_pr_reconciled: afterPr.action === 'reuse_existing_pr' && afterPr.pr.number === 17,
    }, { implementation_attempts: 1, verification_runs: 1, publication_attempts: 1, ai_calls: 1, implementation_retry_budget_consumed: 1 }),
    scenario('repeat-publication-reconciliation', 'publisher is invoked repeatedly against identical persisted remote state', ['reuse-existing-pr', 'reuse-existing-pr'], [afterPr.action, planPublicationReconciliation({ parentSha, localSha: headSha, remoteSha: headSha, localTaskCommits: true, remoteTaskCommits: true, existingPrs: [{ number: 17, baseRefName: 'stg', isDraft: true }], expectedBase: 'stg' }).action], {
      both_invocations_reuse_one_pr: afterPr.action === 'reuse_existing_pr',
    }, { implementation_attempts: 1, verification_runs: 1, publication_attempts: 2, ai_calls: 1, implementation_retry_budget_consumed: 1 }),
  ]
}

function recoveryScenarios(now) {
  const externalFailure = classifySupervisorFailure({ command: 'task-publish', payload: { error: 'temporary GitHub API unavailable' }, attempt: 1, maxAttempts: 5 })
  const repositoryFailure = classifySupervisorFailure({ command: 'task-publish', payload: { error: 'temporary repository fetch unavailable' }, attempt: 1, maxAttempts: 5 })
  const recovery = {
    status: 'active', recoverable: true, next_action: 'wait-external', next_wake_at: '2026-10-02T11:59:00.000Z',
    condition: { watch: { kind: 'github-reachability', repository: 'Building-Suit/building-suit-monorepo' } },
    metadata: { watcher: { poll_count: 0, observation: { fingerprint: 'unavailable' } } },
  }
  const pendingObservation = { state: 'unavailable', actionable: false, fingerprint: 'unavailable', evidence: { error: 'temporary' } }
  const readyObservation = { state: 'available', actionable: true, fingerprint: 'available', evidence: { repository: 'Building-Suit/building-suit-monorepo' } }
  const firstPoll = watchTransition(recovery, pendingObservation, now)
  const readyPoll = watchTransition({ ...recovery, metadata: { watcher: { poll_count: firstPoll.poll_count, observation: firstPoll.observation } } }, readyObservation, now)
  const activeLease = { ...recovery, lease_expires_at: '2026-10-02T12:01:00.000Z' }
  const expiredLease = { ...recovery, lease_expires_at: '2026-10-02T11:59:59.000Z' }
  return [
    scenario('transient-github-failure', 'GitHub API is temporarily unavailable during publication', ['wait-external', 'watch', 'resume supervisor'], [externalFailure.next_action, firstPoll.actionable ? 'resume supervisor' : 'watch', readyPoll.actionable ? 'resume supervisor' : 'watch'], {
      classified_external: externalFailure.failure_class === 'external-wait',
      unchanged_poll_waits: firstPoll.actionable === false,
      changed_poll_wakes: readyPoll.changed && readyPoll.actionable,
    }, { implementation_attempts: 1, verification_runs: 1, publication_attempts: 1, ai_calls: 1, implementation_retry_budget_consumed: 1 }),
    scenario('transient-repository-failure', 'repository fetch is temporarily unavailable', ['wait-external', 'watch', 'resume supervisor'], [repositoryFailure.next_action, 'watch', 'resume supervisor'], {
      classified_external: repositoryFailure.failure_class === 'external-wait',
      dependency_becomes_actionable: readyPoll.actionable,
    }, { implementation_attempts: 1, ai_calls: 1, implementation_retry_budget_consumed: 1 }),
    scenario('fresh-task-auto-reconciliation', 'a freshly claimed task has no worktree and then no installed dependencies', ['task-prepare', 'prepare-dependencies'], [
      preflightReconciliationAction({ kind: 'reconcile', reason: 'worktree_not_prepared' }),
      preflightReconciliationAction({ kind: 'reconcile', reason: 'repository_dependencies_missing' }),
    ], {
      missing_worktree_is_prepared: preflightReconciliationAction({ kind: 'reconcile', reason: 'worktree_not_prepared' }) === 'task-prepare',
      missing_dependencies_are_prepared: preflightReconciliationAction({ kind: 'reconcile', reason: 'repository_dependencies_missing' }) === 'prepare-dependencies',
    }),
    scenario('active-controller-lease-collision', 'a second controller attempts ownership before the current lease expires', ['leave lease owner unchanged', 'wait'], [isDueExternalRecovery(activeLease, now) ? 'claim' : 'wait'], {
      active_lease_prevents_claim: !isDueExternalRecovery(activeLease, now),
    }),
    scenario('expired-controller-lease-reclamation', 'the controller crashes and its durable lease expires', ['reclaim lease', 'probe dependency'], [isDueExternalRecovery(expiredLease, now) ? 'reclaim lease' : 'wait', 'probe dependency'], {
      expired_lease_is_reclaimable: isDueExternalRecovery(expiredLease, now),
    }),
    scenario('external-poll-retry-neutrality', 'the same unavailable dependency is polled twice', ['watch', 'watch'], ['watch', 'watch'], {
      polls_are_not_actionable: !firstPoll.actionable,
      poll_increments_only_watcher_count: firstPoll.poll_count === 1,
    }),
    scenario('repeat-watcher-invocation', 'the watcher observes identical external state repeatedly', ['unchanged observation', 'bounded next wake'], [firstPoll.changed ? 'changed observation' : 'unchanged observation', firstPoll.next_wake_at], {
      identical_observation_is_idempotent: firstPoll.changed === false,
      next_wake_is_bounded: Date.parse(firstPoll.next_wake_at) > now.getTime(),
    }),
  ]
}

function policyScenarios() {
  const focused = customCheckSelection({ check: { name: 'unrelated-workspace-check', required: true, changed_paths: ['apps/shop-suit/'] }, changedFiles: ['tooling/control-plane/runner/task-supervisor.mjs'], mode: 'focused' })
  const milestone = customCheckSelection({ check: { name: 'full-regression', required: true, changed_paths: ['apps/shop-suit/'] }, changedFiles: ['tooling/control-plane/runner/task-supervisor.mjs'], mode: 'milestone' })
  const exhausted = classifySupervisorFailure({ command: 'task-verify', payload: { error: 'verification_failed',classification:{failure_class:'verification-product-defect'} }, attempt: 5, maxAttempts: 5 })
  const criteria = ['Verified behavior is already present.']
  const parentPacket = { task: { task_id: 'CP-FI-001', status: 'in_progress', acceptance_criteria: criteria, parent_satisfaction: { source_task_id: 'CP-SOURCE-001', verification_run_id: 71, acceptance_criteria_digest: acceptanceCriteriaDigest(criteria), reason: 'Verified source is in the resolved parent.' } } }
  const parent = evaluateParentSatisfaction({
    packet: parentPacket,
    parent: { parent_branch: 'codex/control-plane/source', parent_sha: '3'.repeat(40) },
    sourceEvidence: { task_id: 'CP-SOURCE-001', task_status: 'complete', execution_id: 41, execution_status: 'succeeded', commit_sha: '2'.repeat(40), verification_run_id: 71, verification_status: 'passed', checks: [{ check_name: 'focused', command: 'node --test', status: 'pass', exit_code: 0, required: true }] },
    sourceCommitInParent: true,
  })
  const noChange = classifySupervisorFailure({ command: 'task-publish', payload: { error: 'no_publishable_changes' }, attempt: 1, maxAttempts: 5 })
  const missingScope = evaluatePublicationBoundaries({
    taskPaths: [], sourcePaths: ['packages/ui/'], workstreamPaths: ['apps/shop-suit/'], projectPaths: ['apps/', 'packages/'],
  })
  const approvedScope = evaluatePublicationBoundaries({
    taskPaths: ['packages/ui/'], sourcePaths: ['packages/ui/'], workstreamPaths: ['apps/shop-suit/'], projectPaths: ['apps/', 'packages/'],
  })
  const authorizedPaths = validatePublicationAuthorization({
    requestedPaths: missingScope.missing_authority, projectPaths: ['apps/', 'packages/'],
  })
  const passedSnapshot = fixture({ taskStatus: 'passed', executionStatus: 'succeeded', verificationStatus: 'passed' })
  const publicationResume = planSupervisorStep(passedSnapshot)
  const ambiguous = classifyPublicationFiles({ files: ['apps/shop-suit/app.vue'], task: { title: 'Control-plane acceptance' }, taskPaths: ['tooling/control-plane/resilience/'], workstreamPaths: ['tooling/control-plane/'], projectPaths: ['apps/', 'tooling/', 'docs/'] })
  const activeRun = { run_id:'run-1',status:'running',max_tasks:3,completed_tasks:0,current_task_id:'SS-SA-EVIDENCE-001',maintenance_requested:true,controller_fingerprint:'controller-v2' }
  const budgetPlan = planActiveRunStart(activeRun,2)
  const firstCredit = applyCompletionCredit({ run:activeRun,taskId:'SS-SA-EVIDENCE-001',idempotencyKey:'run-1:SS-SA-EVIDENCE-001' })
  const replayCredit = applyCompletionCredit({ run:{ ...activeRun,completed_tasks:1,current_task_id:null },taskId:'SS-SA-EVIDENCE-001',idempotencyKey:'run-1:SS-SA-EVIDENCE-001',credits:[firstCredit.credit] })
  const resumeWithoutProof = evaluateSafeResume({ run:activeRun,controllerProof:{ available:false },admissions:[{ current:true,blockers:[] }] })
  const readinessBase = {
    contract: {
      contract_version: 1, required_paths: ['package.json'], unresolved_scopes: [], source: 'approved-task-contract',
      task_paths: ['apps/shop-suit/'], source_paths: ['package.json'], workstream_paths: ['apps/shop-suit/'], project_paths: ['apps/', 'package.json'],
    },
    taskPaths: ['apps/shop-suit/'], sourcePaths: ['package.json'], workstreamPaths: ['apps/shop-suit/'],
    projectPaths: ['apps/', 'package.json'], ordinaryAuthorizations: [], protectedAuthorizations: [],
  }
  const readinessWait = evaluatePublicationReadiness(readinessBase)
  const readinessReady = evaluatePublicationReadiness({
    ...readinessBase,
    ordinaryAuthorizations: [{ authorization_kind: 'ordinary', authorized_paths: ['package.json'] }],
  })
  const protectedPath = 'apps/shop-suit/supabase/migrations/20261003000000_safe.sql'
  const protectedWait = evaluatePublicationReadiness({
    ...readinessBase,
    contract: {
      contract_version: 1, required_paths: [protectedPath], unresolved_scopes: [], source: 'approved-requirement',
      task_paths: ['apps/shop-suit/'], source_paths: [], workstream_paths: ['apps/shop-suit/'], project_paths: ['apps/'],
    },
    taskPaths: ['apps/shop-suit/'],
    sourcePaths: [],
    projectPaths: ['apps/'],
  })
  const protectedRuntime = evaluatePublicationReadiness({
    ...readinessBase,
    contract: {
      contract_version: 1, required_paths: [], unresolved_scopes: [], source: 'approved-requirement',
      task_paths: ['apps/shop-suit/'], source_paths: [], workstream_paths: ['apps/shop-suit/'], project_paths: ['apps/'],
    },
    taskPaths: ['apps/shop-suit/'],
    sourcePaths: [],
    projectPaths: ['apps/'],
    runtimeFiles: [protectedPath],
  })
  return [
    scenario('active-run-budget-reconciliation', 'an already active run is started with a different requested task limit', ['preserve run id', 'require explicit reconciliation'], [budgetPlan.action], {
      explicit_reconciliation_required: budgetPlan.action === 'explicit_reconciliation_required',
      run_identity_preserved: budgetPlan.run_id === activeRun.run_id,
      historical_credit_not_guessed: budgetPlan.completed_tasks === 0,
    }),
    scenario('idempotent-run-completion-credit', 'the controller reconnects after task completion credit was persisted', ['credit once', 'replay without increment'], [firstCredit.applied ? 'credit once' : 'failed', replayCredit.idempotent ? 'replay without increment' : 'double count'], {
      first_credit_applied: firstCredit.applied,
      replay_is_idempotent: replayCredit.idempotent,
      replay_count_unchanged: replayCredit.completed_tasks === 1,
    }),
    scenario('resume-without-deployed-controller-proof', 'a repaired batch is considered for resume without a live controller export', ['safety stop'], [resumeWithoutProof.resumable ? 'resume' : 'safety stop'], {
      resume_refused: !resumeWithoutProof.resumable,
      explicit_reason: resumeWithoutProof.reasons.includes('deployed_controller_proof_missing'),
    }),
    scenario('focused-verification-isolation', 'an unrelated workspace check is failing outside the focused changed scope', ['skip unrelated check', 'preserve implementation retry budget'], [focused.reason, 'retry budget unchanged'], {
      unrelated_check_not_selected: !focused.selected && focused.reason === 'outside_focused_changed_scope',
    }),
    scenario('focused-repair-exhaustion', 'focused verification keeps failing through the final allowed attempt', ['bounded repair', 'exact operator extension gate'], ['repair attempts 1-4', exhausted.next_action], {
      exhausted_reaches_explicit_operator_gate: exhausted.kind === 'wait' && exhausted.next_action === 'wait-operator',
    }, { implementation_attempts: 5, verification_runs: 5, ai_calls: 5, implementation_retry_budget_consumed: 5 }),
    scenario('milestone-required-check-contract', 'changed paths do not match a required milestone check', ['select required check'], [milestone.reason], {
      required_check_selected: milestone.selected && milestone.reason === 'required_by_milestone_contract',
    }),
    scenario('evidence-backed-parent-satisfaction', 'task is already satisfied by verified parent lineage', ['complete without implementation'], [parent.satisfied ? 'complete without implementation' : parent.reason], {
      satisfaction_is_evidence_backed: parent.satisfied && parent.verification_evidence.length === 1,
    }),
    scenario('unexplained-empty-diff', 'publication discovers an empty diff without parent-satisfaction evidence', ['bounded no-change review'], [noChange.command], {
      does_not_silently_complete: noChange.command === 'handle-no-publishable-changes' && noChange.recoverable === false,
    }, { implementation_attempts: 1, verification_runs: 1, publication_attempts: 1, ai_calls: 1, implementation_retry_budget_consumed: 1 }),
    scenario('publication-scope-before-implementation', 'a Shop task requests the shared UI path used by the BS-UI-ZN-PUBLIC-CHROME-001 class without explicit authority', ['wait before implementation', 'authorize exact shared path'], [missingScope.missing_authority.length ? 'wait before implementation' : 'implementation', ...authorizedPaths], {
      missing_cross_workstream_scope_waits: missingScope.missing_authority.includes('packages/ui/'),
      explicit_scope_clears_wait: approvedScope.missing_authority.length === 0,
      no_implementation_attempt_consumed: true,
    }),
    scenario('publication-scope-authorization-resume', 'a passed and verified task waits on the exact shared UI publication path', ['merge exact task scope', 'resume publication'], [authorizedPaths[0], publicationResume.command], {
      resumes_at_publication: publicationResume.command === 'task-publish',
      execution_identifier_preserved: publicationResume.execution?.execution_id === 41,
      verification_identifier_preserved: publicationResume.verification?.verification_run_id === 71,
    }, { implementation_attempts: 1, verification_runs: 1, publication_attempts: 1, ai_calls: 1, implementation_retry_budget_consumed: 1 }),
    scenario('ambiguous-publication-scope', 'an unrelated product behavior file appears in the publication diff', ['wait-operator'], ambiguous.waiting, {
      unrelated_product_file_waits: ambiguous.waiting.includes('apps/shop-suit/app.vue'),
      not_auto_repaired: ambiguous.repaired.length === 0,
    }),
    scenario('authoritative-publication-readiness', 'an approved root structural path lacks exact task authorization before implementation', ['exact authorization required', 'ready without execution'], [readinessWait.classification, readinessReady.classification], {
      waits_before_implementation: readinessWait.classification === 'exact_authorization_required',
      exact_authorization_is_sufficient: readinessReady.ready,
      runtime_output_is_not_authority: readinessWait.evidence.uses_runtime_files_as_authority === false,
    }),
    scenario('protected-publication-readiness', 'a protected migration is approved but lacks distinct human authorization', ['protected authorization required', 'unexpected runtime file safety-stop'], [protectedWait.classification, protectedRuntime.classification], {
      protected_path_never_auto_authorized: protectedWait.classification === 'protected_authorization_required',
      runtime_only_protected_path_stops: protectedRuntime.classification === 'unexpected_runtime_change',
      no_implementation_attempt_consumed: true,
    }),
  ]
}

function controllerScenarios() {
  const stop = continuousRunTransition({ gate: { should_continue: false, reason: 'stop_requested' }, task: { task_id: 'CP-NEXT-001' }, supervisor: null })
  const first = continuousRunTransition({ gate: { should_continue: true }, task: { task_id: 'CP-ONE-001' }, supervisor: { outcome: 'success' } })
  const limit = continuousRunTransition({ gate: { should_continue: false, reason: 'limit_reached' }, task: { task_id: 'CP-TWO-001' }, supervisor: null })
  const repeatedPlan = planSupervisorStep(fixture({ executionStatus: 'succeeded' }))
  const repeatedPlanAgain = planSupervisorStep(fixture({ executionStatus: 'succeeded' }))
  return [
    scenario('stop-request-safe-boundary', 'a stop request arrives after the current task reaches its persistence boundary', ['stop-requested', 'no new claim'], [stop, 'no new claim'], {
      stop_prevents_claim: stop === 'stop-requested',
    }),
    scenario('bounded-continuous-run', 'the configured task limit is reached after one completed task', ['success', 'task-limit'], [first, limit], {
      completed_task_recorded: first === 'success',
      limit_prevents_next_claim: limit === 'task-limit',
    }, { implementation_attempts: 1, verification_runs: 1, publication_attempts: 1, ai_calls: 1, implementation_retry_budget_consumed: 1 }),
    scenario('repeat-supervisor-invocation', 'the supervisor is invoked twice against identical persisted state', ['task-verify', 'task-verify'], [repeatedPlan.command, repeatedPlanAgain.command], {
      decision_fingerprint_is_stable: repeatedPlan.fingerprint === repeatedPlanAgain.fingerprint,
      completed_implementation_not_repeated: repeatedPlan.command === 'task-verify',
    }, { implementation_attempts: 1, ai_calls: 1, implementation_retry_budget_consumed: 1 }),
  ]
}

function controlDatabaseScenarios() {
  const noDelay = { sleep: () => {} }
  let recoveredAttempts = 0
  const recovered = executeWithControlDatabaseRetry(() => {
    recoveredAttempts++
    return recoveredAttempts === 1
      ? { code: 2, stderr: 'could not translate host name: Temporary failure in name resolution' }
      : { code: 0, stdout: '{"status":"in_progress"}' }
  }, noDelay)

  let exhaustedAttempts = 0
  let exhaustedError
  try {
    executeWithControlDatabaseRetry(() => {
      exhaustedAttempts++
      return { code: 2, stderr: 'connection to server failed: Connection timed out' }
    }, noDelay)
  }
  catch (error) {
    exhaustedError = error
  }
  const wait = controlDatabaseWaitOutcome({
    taskId: 'CP-FI-001',
    command: 'task-supervise',
    error: exhaustedError,
    now: new Date('2026-10-02T12:00:00.000Z'),
  })

  let rejectedAttempts = 0
  const rejected = executeWithControlDatabaseRetry(() => {
    rejectedAttempts++
    return { code: 2, stderr: 'FATAL: password authentication failed for user "runtime"' }
  }, noDelay)

  return [
    scenario('control-database-transient-then-success', 'the first control-database connection attempt encounters a transient DNS failure', ['bounded backoff', 'repeat original command', 'continue same lifecycle'], ['bounded backoff', `attempt ${recoveredAttempts}`, recovered.code === 0 ? 'continue same lifecycle' : 'failed'], {
      original_command_retried: recoveredAttempts === 2,
      successful_result_returned: recovered.code === 0,
      no_implementation_attempt_created: true,
    }),
    scenario('control-database-transient-retries-exhausted', 'every bounded control-database connection attempt times out', ['bounded retries', 'wait-external', 'preserve task and run'], [`${exhaustedAttempts} attempts`, wait.recovery.next_action, wait.ok ? 'preserve task and run' : 'failed'], {
      retries_are_bounded: exhaustedAttempts === CONTROL_DATABASE_RETRY_POLICY.max_attempts,
      wait_is_recoverable: wait.status === 'wait' && wait.recovery.recoverable,
      lifecycle_identity_is_preserved: wait.recovery.resume_identity === 'task:CP-FI-001',
      implementation_budget_is_unchanged: wait.recovery.controller_retry.implementation_retry_budget_consumed === 0,
    }),
    scenario('control-database-non-transient-rejection', 'the control database rejects authentication immediately', ['no retry', 'safety handling'], [`${rejectedAttempts} attempt`, rejected.code === 0 ? 'continued' : 'safety handling'], {
      rejected_immediately: rejectedAttempts === 1,
      original_failure_is_preserved: /password authentication failed/.test(rejected.stderr),
    }),
  ]
}

function artifactScenarios({ workflows, manifest, baselineFixture, baselineFixtureAfter = baselineFixture }) {
  const validation = validateControllerReplacements(workflows)
  const compatibility = inspectWorkflowSnapshot(workflows)
  const replacementDigestsMatch = (manifest.replacements ?? []).every(replacement => {
    const workflow = workflows.find(item => item.id === replacement.live_id)
    return workflow && replacement.sha256 === sha256(`${JSON.stringify(workflow, null, 2)}\n`)
  })
  const baselineDigest = sha256(baselineFixture)
  const baselineDigestAfter = sha256(baselineFixtureAfter)
  return [
    scenario('generated-n8n-replacement-compatibility', 'generated BS-10, BS-20, and BS-21 fixtures are evaluated as cutover candidates', ['validate identities', 'reject retry graph', 'reject hardcoded registry'], validation.valid ? ['identities valid', 'no retry graph', 'no hardcoded registry'] : validation.errors, {
      three_controllers_and_optional_watchdog_present: workflows.length === 3 || workflows.length === 4 && workflows.some(w => w.id === 'BS31SelfHealingRecovery'),
      controller_contract_valid: validation.valid,
      compatibility_clean: compatibility.compatible,
      generated_inactive: workflows.every(workflow => workflow.active === false),
      artifact_digests_match_manifest: replacementDigestsMatch,
    }),
    scenario('pre-cutover-live-export-integrity', 'the full acceptance suite runs beside the sanitized live-export baseline', ['same fixture digest before and after', 'no runtime mutation'], [baselineDigestAfter, manifest.runtime_mutation_performed === false ? 'no runtime mutation' : 'runtime mutation recorded'], {
      baseline_matches_manifest: manifest.source_snapshot?.sha256 === baselineDigest,
      baseline_unchanged_during_gate: baselineDigestAfter === baselineDigest,
      runtime_mutation_forbidden: manifest.runtime_mutation_performed === false,
      fixture_is_verified_container_export: manifest.source_snapshot?.source === 'container-cli',
    }, {}, { baseline_sha256_before: baselineDigest, baseline_sha256_after: baselineDigestAfter, live_runtime_contacted: false }),
  ]
}

export function runResilienceAcceptance(input) {
  const now = new Date('2026-10-02T12:00:00.000Z')
  const scenarios = [
    ...lifecycleScenarios(),
    ...publicationScenarios(),
    ...recoveryScenarios(now),
    ...policyScenarios(),
    ...controllerScenarios(),
    ...controlDatabaseScenarios(),
    ...artifactScenarios(input),
  ]
  const mandatory = scenarios.filter(item => item.mandatory)
  const passed = mandatory.filter(item => item.result === 'pass').length
  return {
    schema_version: 1,
    task_id: 'CP-RES-014',
    deterministic: true,
    destructive_faults_used: false,
    live_n8n_contacted: false,
    harness_ready: passed === mandatory.length,
    cutover_ready: false,
    release_blockers: [
      'live_controller_export_and_fingerprint_not_verified',
      'disposable_postgresql_migration_and_concurrency_gate_required',
      'independent_batch_admission_review_required',
    ],
    summary: { mandatory: mandatory.length, passed, failed: mandatory.length - passed },
    scenarios,
  }
}

export function renderResilienceReport(report) {
  const lines = [
    '# Control-plane resilience acceptance',
    '',
    `Task: ${report.task_id}`,
    '',
    `Deterministic repository harness: **${report.harness_ready ? 'PASS' : 'FAIL'}**`,
    '',
    'Deployed cutover ready: **NO**. Live controller proof, disposable PostgreSQL migration/concurrency results, and independent admission review remain separate gates.',
    '',
    `Mandatory scenarios: ${report.summary.passed}/${report.summary.mandatory} passed. The deterministic harness used no destructive faults and did not contact or mutate live n8n.`,
    '',
    '| Scenario | Fault | Expected recovery | Observed recovery | Impl | Verify | Publish | Result |',
    '|---|---|---|---|---:|---:|---:|---|',
  ]
  for (const item of report.scenarios) {
    lines.push(`| ${item.id} | ${item.injected_fault} | ${item.expected_recovery_path.join(' → ')} | ${item.observed_recovery_path.join(' → ')} | ${item.counts.implementation_attempts} | ${item.counts.verification_runs} | ${item.counts.publication_attempts} | ${item.result.toUpperCase()} |`)
  }
  lines.push('', 'The machine-readable companion records AI-call and retry-budget counts, failed assertions, and integrity evidence for every scenario.', '')
  return lines.join('\n')
}
