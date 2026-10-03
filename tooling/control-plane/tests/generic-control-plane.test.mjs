import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { runResilienceAcceptance } from '../resilience/acceptance.mjs'
import {
  CONTROL_DATABASE_RETRY_POLICY,
  classifyControlDatabaseFailure,
  controlDatabaseWaitOutcome,
  executeWithControlDatabaseRetry,
} from '../lib/control-database.mjs'
import { inspectWorkflowSnapshot, normalizeWorkflow, validateControllerReplacements, workflowGraphSummary } from '../lib/n8n-workflows.mjs'
import { continuousRunTransition, normalizeSupervisorResult, resumeSchedule } from '../lib/n8n-controller.mjs'
import { validateProjectConfig } from '../lib/project-config.mjs'
import {
  CONSERVATIVE_PUBLICATION_POLICY,
  completePublicationPolicy,
  mergeVerificationConfig,
  publicationPolicyBackfill,
  validateLocalSupabaseLifecycle,
} from '../lib/workstream-readiness.mjs'
import { redact } from '../lib/redaction.mjs'
import { profileForAttempt, retryDecision, validateRetryPolicy } from '../lib/retry-policy.mjs'
import {
  classifySupervisorFailure,
  planSupervisorStep,
  preflightReconciliationAction,
  supervisorStateFingerprint,
  supervisorResumeIdentity,
} from '../runner/task-supervisor.mjs'
import {
  WATCHER_MAX_BACKOFF_MS,
  WATCHER_MIN_BACKOFF_MS,
  boundedWatcherBackoff,
  classifyControlProbe,
  classifyGithubProbe,
  githubProbeCommand,
  githubProbeObservation,
  isDueExternalRecovery,
  normalizeWatchDescriptor,
  watchDescriptorForRecovery,
  watchTransition,
} from '../runner/external-state-watcher.mjs'
import {
  evaluateExecutionPreflight,
  fingerprint,
} from '../runner/task-preflight.mjs'
import {
  acceptanceCriteriaDigest,
  evaluateParentSatisfaction,
} from '../runner/parent-satisfaction.mjs'
import {
  applicationScopeSelected,
  classifyVerificationResults,
  commandResultStatus,
  controlPlaneRootLintSelection,
  customCheckSelection,
  evaluateVerificationReadiness,
  resolveDatabaseVerification,
  resolveVerificationPlan,
  resolveVerificationMode,
} from '../runner/verification-mode.mjs'
import {
  classifyPublicationFiles,
  evaluatePublicationParent,
  evaluateVerificationAuthority,
  planPublicationReconciliation,
  publicationScopeAuthorizationFingerprint,
  publicationStateFingerprint,
  taskPublicationMetadata,
  validateCurrentPublicationAuthorization,
  validatePublicationAuthorization,
} from '../runner/publication-preflight.mjs'
import {
  evaluatePublicationReadiness,
  publicationAuthorizationValidationKind,
  validateProtectedPublicationAuthorization,
} from '../runner/publication-readiness.mjs'

test('control database retry recovers the original operation after a transient failure', () => {
  const results = [
    { code: 2, stderr: 'psql: could not translate host name "db.invalid": Temporary failure in name resolution' },
    { code: 0, stdout: '{"task_id":"CP-TEST-001"}' },
  ]
  const attempts = []
  const delays = []

  const result = executeWithControlDatabaseRetry(attempt => {
    attempts.push(attempt)
    return results.shift()
  }, { sleep: delay => delays.push(delay) })

  assert.equal(result.code, 0)
  assert.deepEqual(attempts, [1, 2])
  assert.deepEqual(delays, [CONTROL_DATABASE_RETRY_POLICY.backoff_ms[0]])
})

test('exhausted transient control database failures become a credential-safe recoverable wait', () => {
  let attempts = 0
  let caught
  try {
    executeWithControlDatabaseRetry(() => {
      attempts++
      return {
        code: 2,
        stderr: 'psql: connection to server at "db.example" failed: Connection timed out postgresql://runtime:secret@db.example/control',
      }
    }, { sleep: () => {} })
  }
  catch (error) {
    caught = error
  }

  assert.equal(attempts, CONTROL_DATABASE_RETRY_POLICY.max_attempts)
  assert.equal(caught?.code, 'CONTROL_DATABASE_CONNECTIVITY_EXHAUSTED')
  const outcome = controlDatabaseWaitOutcome({
    taskId: 'CP-TEST-001',
    command: 'task-supervise',
    error: caught,
    now: new Date('2026-10-03T00:00:00.000Z'),
  })
  assert.equal(outcome.ok, true)
  assert.equal(outcome.status, 'wait')
  assert.equal(outcome.recovery.next_action, 'wait-external')
  assert.equal(outcome.recovery.resume_identity, 'task:CP-TEST-001')
  assert.equal(outcome.recovery.controller_retry.implementation_retry_budget_consumed, 0)
  assert.equal(normalizeSupervisorResult({ runner_ok: true, payload: outcome }).outcome, 'wait')
  assert.equal(normalizeSupervisorResult({ runner_ok: true, payload: outcome }).automatic_resume, true)
  assert.doesNotMatch(JSON.stringify(outcome), /secret|postgresql:\/\//)
})

test('non-transient control database failures are rejected without retry', () => {
  const failures = [
    'FATAL: password authentication failed for user "runtime"',
    'ERROR: permission denied for schema control',
    'ERROR: relation "control.tasks" does not exist',
    'control_database_fingerprint_mismatch',
    'lifecycle_policy_failure',
  ]

  for (const stderr of failures) {
    let attempts = 0
    let sleeps = 0
    const result = executeWithControlDatabaseRetry(() => {
      attempts++
      return { code: 2, stderr }
    }, { sleep: () => sleeps++ })
    assert.equal(result.stderr, stderr)
    assert.equal(attempts, 1)
    assert.equal(sleeps, 0)
    assert.equal(classifyControlDatabaseFailure(result).transient, false)
  }
})

test('execution creation reuses a committed running row after an ambiguous connection loss', async () => {
  const runner = await readFile(new URL('../runner/bs-agent.mjs', import.meta.url), 'utf8')
  const initial = runner.slice(
    runner.indexOf('function startExecution('),
    runner.indexOf('function finishExecution('),
  )
  const retry = runner.slice(
    runner.indexOf('function startRetryExecution('),
    runner.indexOf('function validateRetryWorktree('),
  )

  assert.match(initial, /status = 'running'[\s\S]+control\.start_execution/)
  assert.match(retry, /status = 'running'[\s\S]+control\.start_retry_execution/)
  assert.ok(initial.indexOf("status = 'running'") < initial.indexOf('control.start_execution'))
  assert.ok(retry.indexOf("status = 'running'") < retry.indexOf('control.start_retry_execution'))
})

test('publication preflight uses only explicit task and workstream authority', () => {
  const classification = classifyPublicationFiles({
    files: [
      'tooling/control-plane/runner/task-publisher.mjs',
      'tooling/control-plane/runner/publication-preflight.mjs',
      'docs/shared/publication.md',
      'tooling/control-plane/import/unrelated.md',
      'apps/shop-suit/app.vue',
      'README.md',
    ],
    task: { description: 'Update publication behavior and its documentation.' },
    taskPaths: ['tooling/control-plane/runner/task-publisher.mjs'],
    workstreamPaths: ['tooling/control-plane/'],
    projectPaths: ['apps/', 'packages/', 'tooling/', 'docs/'],
  })

  assert.equal(classification.decisions.find(item => item.file.endsWith('task-publisher.mjs')).boundary, 'workstream')
  assert.deepEqual(classification.repaired, [])
  assert.deepEqual(classification.waiting, ['apps/shop-suit/app.vue', 'docs/shared/publication.md'])
  assert.ok(classification.allowed.includes('tooling/control-plane/import/unrelated.md'))
  assert.ok(classification.allowed.includes('tooling/control-plane/runner/publication-preflight.mjs'))
  assert.deepEqual(classification.blocked, ['README.md'])
})

test('task-create publication metadata persists validated top-level allowed_paths', () => {
  const metadata = taskPublicationMetadata({
    metadata: { source: 'unit-fixture' },
    allowedPaths: ['packages/ui/', 'docs/shared/exact.md', 'packages/ui/'],
    sourcePaths: ['packages/ui/**', 'packages/ui/**'],
    exactRequirementPaths: ['docs/shared/contract.md'],
    workstreamPaths: ['apps/shop-suit/'],
    projectPaths: ['apps/', 'packages/', 'docs/'],
  })
  assert.deepEqual(metadata.allowed_paths, ['docs/shared/exact.md', 'packages/ui/'])
  assert.deepEqual(metadata.source_allowed_paths, ['packages/ui/**'])
  assert.equal(metadata.source, 'unit-fixture')
  assert.throws(() => taskPublicationMetadata({
    allowedPaths: ['README.md'], workstreamPaths: ['apps/shop-suit/'], projectPaths: ['apps/'],
  }), /outside_project/)
  assert.deepEqual(taskPublicationMetadata({
    allowedPaths: ['apps/shop-suit/supabase/migrations/999.sql'],
    workstreamPaths: ['apps/shop-suit/'], projectPaths: ['apps/'],
  }).allowed_paths, ['apps/shop-suit/supabase/migrations/999.sql'])
})

test('publication authorization accepts only exact safe paths inside the project boundary', () => {
  assert.deepEqual(validatePublicationAuthorization({
    requestedPaths: ['packages/ui/src/BsShell.vue'], projectPaths: ['apps/', 'packages/'],
  }), ['packages/ui/src/BsShell.vue'])
  assert.throws(() => validatePublicationAuthorization({
    requestedPaths: ['README.md'], projectPaths: ['apps/', 'packages/'],
  }), /outside_project/)
  assert.throws(() => validatePublicationAuthorization({
    requestedPaths: ['apps/shop-suit/supabase/migrations/999.sql'], projectPaths: ['apps/'],
  }), /protected/)
  assert.throws(() => validatePublicationAuthorization({
    requestedPaths: ['packages/ui/**'], projectPaths: ['packages/'],
  }), /exact_relative_paths/)
  assert.equal(
    publicationScopeAuthorizationFingerprint({ task_id: 'CP-T-001', paths: ['packages/ui/a.vue'] }),
    publicationScopeAuthorizationFingerprint({ task_id: 'CP-T-001', paths: ['packages/ui/a.vue'] }),
  )
  assert.throws(() => validateCurrentPublicationAuthorization({
    requestedPaths: ['packages/ui/a.vue'],
    waitingPaths: ['packages/ui/a.vue', 'packages/ui/b.vue'],
    projectPaths: ['packages/'],
  }), /match_current/)
  const legacyDirectoryAuthorization = classifyPublicationFiles({
    files: ['packages/ui/src/BsShell.vue'],
    workstreamPaths: ['apps/shop-suit/'],
    projectPaths: ['apps/', 'packages/'],
    ordinaryAuthorizedPaths: ['packages/ui/'],
  })
  assert.deepEqual(legacyDirectoryAuthorization.allowed, ['packages/ui/src/BsShell.vue'])
})

test('publication scope repair never authorizes protected or product behavior paths', () => {
  const classification = classifyPublicationFiles({
    files: ['apps/shop-suit/supabase/migrations/999.sql', '.env.production', '.github/workflows/deploy.yml'],
    task: { description: 'Document the control-plane publication flow.' },
    workstreamPaths: ['tooling/control-plane/'],
    projectPaths: ['apps/', 'tooling/', 'docs/'],
  })
  assert.deepEqual(classification.repaired, [])
  assert.equal(classification.blocked.length, 3)
})

test('protected publication authorization is exact, evidenced, validated, and project-bound', () => {
  const path = 'apps/shop-suit/supabase/migrations/999.sql'
  const validations = {
    [path]: { status: 'passed', checks: ['database-change-review'] },
  }
  assert.equal(publicationAuthorizationValidationKind(path), 'database-change-review')
  assert.deepEqual(validateProtectedPublicationAuthorization({
    requestedPaths: [path], requiredPaths: [path], projectPaths: ['apps/'],
    evidence: 'approved change ticket CP-42', validations,
  }), [path])
  assert.throws(() => validateProtectedPublicationAuthorization({
    requestedPaths: [path], requiredPaths: [path], projectPaths: ['apps/'],
    evidence: 'short', validations,
  }), /audit_evidence/)
  assert.throws(() => validateProtectedPublicationAuthorization({
    requestedPaths: ['apps/shop-suit/supabase/migrations/**'], requiredPaths: [path], projectPaths: ['apps/'],
    evidence: 'approved change ticket CP-42', validations,
  }), /exact_relative_paths/)
  assert.throws(() => validateProtectedPublicationAuthorization({
    requestedPaths: ['apps/shop-suit/supabase/migrations/'], requiredPaths: ['apps/shop-suit/supabase/migrations/'], projectPaths: ['apps/'],
    evidence: 'approved change ticket CP-42', validations: {},
  }), /exact_relative_paths/)
})

test('publication readiness never turns runtime files into authority', () => {
  const base = {
    contract: {
      contract_version: 1, contract_id: 7, required_paths: ['package.json'], unresolved_scopes: [],
      task_paths: ['apps/shop-suit/'], source_paths: [], workstream_paths: ['apps/shop-suit/'], project_paths: ['apps/', 'package.json'],
    },
    taskPaths: ['apps/shop-suit/'], sourcePaths: [], workstreamPaths: ['apps/shop-suit/'],
    projectPaths: ['apps/', 'package.json'], ordinaryAuthorizations: [], protectedAuthorizations: [],
  }
  const waiting = evaluatePublicationReadiness(base)
  assert.equal(waiting.classification, 'exact_authorization_required')
  assert.deepEqual(waiting.exact_authorization_required, ['package.json'])
  const invented = evaluatePublicationReadiness({
    ...base,
    contract: { ...base.contract, project_paths: ['apps/', 'package.json', 'packages/'] },
    projectPaths: ['apps/', 'package.json', 'packages/'],
    runtimeFiles: ['packages/invented.mjs'],
  })
  assert.equal(invented.classification, 'unexpected_runtime_change')
  assert.equal(invented.evidence.uses_runtime_files_as_authority, false)
  const outside = evaluatePublicationReadiness({ ...base, runtimeFiles: ['README.md'] })
  assert.equal(outside.classification, 'outside_project_boundary')
  const protectedResult = evaluatePublicationReadiness({
    ...base,
    contract: {
      contract_version: 1, required_paths: ['apps/shop-suit/.env.example'], unresolved_scopes: [],
      task_paths: ['apps/shop-suit/'], source_paths: [], workstream_paths: ['apps/shop-suit/'], project_paths: ['apps/', 'package.json'],
    },
    runtimeFiles: ['apps/shop-suit/.env.example'],
  })
  assert.equal(protectedResult.classification, 'unexpected_runtime_change')
  assert.deepEqual(protectedResult.unexpected_runtime_change, ['apps/shop-suit/.env.example'])
  const protectedReady = evaluatePublicationReadiness({
    ...base,
    contract: {
      contract_version: 1, required_paths: ['apps/shop-suit/.env.example'], unresolved_scopes: [],
      task_paths: ['apps/shop-suit/'], source_paths: [], workstream_paths: ['apps/shop-suit/'], project_paths: ['apps/', 'package.json'],
    },
    protectedAuthorizations: [{ authorization_kind: 'protected', authorized_paths: ['apps/shop-suit/.env.example'] }],
  })
  assert.equal(protectedReady.classification, 'ready')
  const unresolved = evaluatePublicationReadiness({
    ...base,
    contract: { ...base.contract, unresolved_scopes: ['packages/**'] },
  })
  assert.equal(unresolved.classification, 'invalid')
})

test('publication authorization changes the supervisor recovery fingerprint', () => {
  const snapshot = {
    packet: {
      task: { task_id: 'CP-T-001', status: 'in_progress' },
      publication_contract: { contract_id: 7, contract_fingerprint: 'contract-1', updated_at: '2026-10-03T00:00:00Z' },
      publication_authorizations: { ordinary: [], protected: [] },
    },
    executions: [], verification_runs: [], failures: [], publications: [], serialization_conflicts: [],
  }
  const before = supervisorStateFingerprint(snapshot)
  snapshot.packet.publication_authorizations.ordinary.push({
    authorization_id: 9, authorized_paths: ['package.json'], revoked_at: null,
  })
  assert.notEqual(supervisorStateFingerprint(snapshot), before)
})

test('publication reconciliation is idempotent after commit and PR creation', () => {
  const base = '1'.repeat(40)
  const head = '2'.repeat(40)
  assert.equal(planPublicationReconciliation({
    parentSha: base, localSha: head, remoteSha: head,
    localTaskCommits: true, remoteTaskCommits: true,
    existingPrs: [], expectedBase: 'stg',
  }).action, 'create_pr')

  const existing = [{ number: 17, baseRefName: 'stg', isDraft: true }]
  assert.equal(planPublicationReconciliation({
    parentSha: base, localSha: head, remoteSha: head,
    localTaskCommits: true, remoteTaskCommits: true,
    existingPrs: existing, expectedBase: 'stg',
  }).action, 'reuse_existing_pr')
})

test('publication reconciliation fast-forwards unambiguous stale local task state', () => {
  const plan = planPublicationReconciliation({
    parentSha: '1'.repeat(40), localSha: '1'.repeat(40), remoteSha: '2'.repeat(40),
    localTaskCommits: false, remoteTaskCommits: true,
    existingPrs: [{ number: 18, baseRefName: 'stg', isDraft: true }], expectedBase: 'stg',
  })
  assert.equal(plan.action, 'fast_forward_remote_task_branch')
})

test("a task's own draft PR is not mistaken for changed parent state", () => {
  const parentSha = '1'.repeat(40)
  const result = evaluatePublicationParent({
    execution: {
      branch_name: 'codex/control-plane/cp-test-001',
      parent_branch: 'stg',
      parent_sha: parentSha,
    },
    liveParent: {
      parent_branch: 'codex/control-plane/cp-test-001',
      parent_sha: '2'.repeat(40),
      parent_pr: { number: 22, base_branch: 'stg' },
    },
    recordedParentSha: parentSha,
  })
  assert.deepEqual(result, { current: true, reason: 'task_own_pr_is_current_stack_leaf' })
})

test('publication requires the latest passed verification for the exact repository state', () => {
  const state = { base_sha: '1'.repeat(40), files: [{ file: 'tooling/change.mjs', object: 'abc' }] }
  const fingerprint = publicationStateFingerprint(state)
  assert.equal(evaluateVerificationAuthority({
    verification: { execution_id: 41, status: 'passed', state_fingerprint: fingerprint },
    executionId: 41, stateFingerprint: fingerprint,
  }).authoritative, true)
  assert.equal(evaluateVerificationAuthority({
    verification: { execution_id: 41, status: 'passed', state_fingerprint: fingerprint },
    executionId: 41, stateFingerprint: publicationStateFingerprint({ ...state, files: [] }),
  }).reason, 'verified_repository_state_changed')
})

test('retry policy requires one explicit profile per attempt', () => {
  assert.throws(() => validateRetryPolicy({ policy_id:'broken',max_attempts:5,attempt_profiles:['standard','standard','deep'] }), /count/)
  const policy=validateRetryPolicy({ policy_id:'critical-five',max_attempts:5,attempt_profiles:['standard','standard','deep','deep','deep'] })
  assert.equal(profileForAttempt(policy,3),'deep')
  assert.deepEqual(retryDecision(policy,4),{allowed:true,next_attempt:5,next_profile:'deep',max_attempts:5})
  assert.equal(retryDecision(policy,5).allowed,false)
})

test('project registration rejects incomplete and ambiguous config', () => {
  assert.throws(() => validateProjectConfig({slug:'Bad Slug'}), /slug/)
  assert.throws(() => validateProjectConfig({slug:'example',metadata:{api_key:'secret'}}), /secrets are not allowed/)
  const project=validateProjectConfig({slug:'example',display_name:'Example',github_repository:'owner/repo',integration_branch:'stg',production_branch:'main',local_repository_root:'.',worktree_root:'.local/worktrees',workstreams:[{slug:'backend',stack_key:'backend'}]})
  assert.equal(project.active,false)
  assert.equal(project.default_model_profile,'standard')
})

test('diagnostic redaction removes keyed and inline credentials', () => {
  const safe=redact({api_key:'top-secret',message:'Bearer abcdefghijklmnopqrstuvwxyz',url:'postgresql://user:pass@example/db'})
  assert.equal(safe.api_key,'[REDACTED]')
  assert.doesNotMatch(safe.message,/abcdefgh/)
  assert.doesNotMatch(safe.url,/user:pass/)
})

test('n8n exports normalize nodes and render a graph without mutation', () => {
  const workflow={id:'1',name:'Continue',active:true,nodes:[{id:'b',name:'Run',type:'ssh'},{id:'a',name:'Trigger',type:'form'}],connections:{Trigger:{main:[[{node:'Run',type:'main',index:0}]]}}}
  const normalized=normalizeWorkflow(workflow)
  assert.deepEqual(normalized.nodes.map(node=>node.name),['Run','Trigger'])
  assert.match(workflowGraphSummary(workflow),/Trigger -> Run/)
  assert.equal(workflow.nodes[0].name,'Run')
})

test('n8n inspection identifies hard-coded registry options and retry graphs', () => {
  const inspection=inspectWorkflowSnapshot([{name:'Legacy engine',nodes:[{name:'Retry Attempt 02',parameters:{}},{name:'Form',parameters:{fieldName:'suit_slug',fieldOptions:{values:[{option:'ledger-suit'}]}}}]}])
  assert.equal(inspection.compatible,false)
  assert.deepEqual(inspection.findings.map(item=>item.code).sort(),['hardcoded_registry_options','n8n_owned_retry_graph'])
})

test('generated n8n replacements preserve identities and remove legacy ownership', async () => {
  const { readFile, readdir } = await import('node:fs/promises')
  const artifactRoot = new URL('../n8n/artifacts/', import.meta.url)
  const files = (await readdir(artifactRoot)).filter(file => file.endsWith('.json') && file !== 'manifest.json')
  const workflows = await Promise.all(files.map(async file => JSON.parse(await readFile(new URL(file, artifactRoot), 'utf8'))))
  const validation = validateControllerReplacements(workflows)
  assert.deepEqual(validation.errors, [])
  assert.equal(inspectWorkflowSnapshot(workflows).compatible, true)
})

test('sanitized n8n fixture records the verified live baseline', async () => {
  const { readFile } = await import('node:fs/promises')
  const fixture = JSON.parse(await readFile(new URL('../n8n/fixtures/live-2026-10-02.json', import.meta.url), 'utf8'))
  assert.equal(fixture.exported_at, '2026-10-02T14:24:40.777Z')
  assert.deepEqual(fixture.workflows.map(workflow => workflow.id), [
    '9aWPOijyhfmnEtRy', 'pg0BEkbP9E4H4RqB', 'qHGzP3b0PS82IYSw',
  ])
  assert.deepEqual(inspectWorkflowSnapshot(fixture.workflows).findings.map(finding => finding.code), [
    'n8n_owned_retry_graph', 'hardcoded_registry_options', 'hardcoded_registry_options',
  ])
})

test('resilience acceptance covers mandatory crash recovery and emits a strict cutover gate', async () => {
  const { readdir } = await import('node:fs/promises')
  const artifactRoot = new URL('../n8n/artifacts/', import.meta.url)
  const files = (await readdir(artifactRoot)).filter(file => file.endsWith('.json') && file !== 'manifest.json')
  const workflows = await Promise.all(files.map(async file => JSON.parse(await readFile(new URL(file, artifactRoot), 'utf8'))))
  const manifest = JSON.parse(await readFile(new URL('manifest.json', artifactRoot), 'utf8'))
  const baselineFixture = await readFile(new URL('../n8n/fixtures/live-2026-10-02.json', import.meta.url))
  const report = runResilienceAcceptance({ workflows, manifest, baselineFixture })

  assert.equal(report.cutover_ready, true)
  assert.equal(report.summary.failed, 0)
  assert.equal(report.live_n8n_contacted, false)
  assert.equal(report.destructive_faults_used, false)
  assert.ok(report.summary.mandatory >= 25)
  for (const scenario of report.scenarios) {
    assert.equal(scenario.result, 'pass', scenario.id)
    assert.equal(typeof scenario.injected_fault, 'string')
    assert.ok(scenario.expected_recovery_path.length > 0, scenario.id)
    assert.ok(scenario.observed_recovery_path.length > 0, scenario.id)
    assert.deepEqual(Object.keys(scenario.counts), [
      'implementation_attempts',
      'verification_runs',
      'publication_attempts',
      'ai_calls',
      'implementation_retry_budget_consumed',
    ])
  }

  const requiredScenarios = [
    'interrupt-before-implementation-execution',
    'interrupt-during-implementation',
    'interrupt-after-passed-verification',
    'interrupt-after-pr-creation',
    'active-controller-lease-collision',
    'expired-controller-lease-reclamation',
    'fresh-task-auto-reconciliation',
    'focused-repair-exhaustion',
    'milestone-required-check-contract',
    'evidence-backed-parent-satisfaction',
    'ambiguous-publication-scope',
    'stop-request-safe-boundary',
    'generated-n8n-replacement-compatibility',
    'pre-cutover-live-export-integrity',
  ]
  assert.deepEqual(
    requiredScenarios.filter(id => !report.scenarios.some(scenario => scenario.id === id)),
    [],
  )
})

test('thin controller schedules only persisted automatic recovery states', () => {
  const now = new Date('2026-10-02T12:00:00.000Z')
  const external = normalizeSupervisorResult({ payload: { ok: true, task_id: 'CP-X-001', status: 'wait', recovery: { next_action: 'wait-external', reason: 'execution_in_flight', next_wake_at: '2026-10-02T12:05:00.000Z' } } }, now)
  assert.equal(external.outcome, 'wait')
  assert.equal(external.automatic_resume, true)
  assert.equal(external.wake_at, '2026-10-02T12:05:00.000Z')

  const operator = resumeSchedule({ status: 'wait', recovery: { next_action: 'wait-operator', next_wake_at: '2026-10-02T12:05:00.000Z' } }, now)
  assert.equal(operator.automatic_resume, false)

  const reconcile = normalizeSupervisorResult({
    payload: {
      ok: true,
      status: 'reconcile',
      recovery: {
        recoverable: true,
        next_action: 'reconcile-repository',
        reason: 'worktree_not_prepared',
      },
    },
  }, now)
  assert.equal(reconcile.outcome, 'wait')
  assert.equal(reconcile.automatic_resume, false)

  const lease = normalizeSupervisorResult({ payload: { ok: true, status: 'wait', reason: 'supervisor_lease_active', lease_expires_at: '2026-10-02T12:10:00.000Z' } }, now)
  assert.equal(lease.automatic_resume, true)
  assert.equal(lease.lease_active, true)
})

test('external watcher enumerates only due automatic waits and reclaims expired leases', () => {
  const now = new Date('2026-10-02T12:00:00.000Z')
  const recovery = {
    status: 'active', recoverable: true, next_action: 'wait-external',
    next_wake_at: '2026-10-02T11:59:00.000Z',
    condition: { watch: { kind: 'github-reachability', repository: 'Building-Suit/building-suit-monorepo' } },
  }
  assert.equal(isDueExternalRecovery(recovery, now), true)
  assert.equal(isDueExternalRecovery({ ...recovery, lease_expires_at: '2026-10-02T11:59:59.000Z' }, now), true)
  assert.equal(isDueExternalRecovery({ ...recovery, lease_expires_at: '2026-10-02T12:00:01.000Z' }, now), false)
  assert.equal(isDueExternalRecovery({ ...recovery, next_action: 'reconcile-publication' }, now), true)
  assert.equal(isDueExternalRecovery({ ...recovery, next_action: 'reconcile-repository' }, now), true)

  for (const nextAction of ['wait-decision', 'wait-operator', 'safety-stop']) {
    assert.equal(isDueExternalRecovery({ ...recovery, next_action: nextAction }, now), false)
  }
  assert.equal(isDueExternalRecovery({ ...recovery, status: 'resolved' }, now), false)
  assert.equal(isDueExternalRecovery({ ...recovery, condition: {} }, now), false)
})

test('external watcher validates narrow GitHub dependency descriptors and commands', () => {
  const branchRecovery = {
    condition: { watch: {
      kind: 'github-branch', repository: 'Building-Suit/building-suit-monorepo',
      branch: 'codex/control-plane/cp-res-008', expected: 'present',
    } },
  }
  const descriptor = normalizeWatchDescriptor(branchRecovery)
  assert.equal(descriptor.kind, 'github-branch')
  assert.deepEqual(githubProbeCommand(descriptor), [
    'api',
    'repos/Building-Suit/building-suit-monorepo/git/ref/heads/codex%2Fcontrol-plane%2Fcp-res-008',
  ])
  assert.equal(normalizeWatchDescriptor({ condition: { watch: { kind: 'unknown', repository: 'a/b' } } }), null)
})

test('GitHub watcher distinguishes unavailable, missing, pending, and actionable state', () => {
  const reachability = { kind: 'github-reachability', repository: 'Building-Suit/building-suit-monorepo' }
  const unavailable = classifyGithubProbe(reachability, { unavailable: true, error: 'timeout' })
  assert.equal(unavailable.state, 'unavailable')
  assert.equal(
    unavailable.fingerprint,
    classifyGithubProbe(reachability, { unavailable: true, error: 'connection reset' }).fingerprint,
  )
  assert.equal(classifyGithubProbe(reachability, { data: { id: 1 } }).actionable, true)

  const branch = { kind: 'github-branch', repository: reachability.repository, branch: 'codex/example', expected: 'present' }
  assert.equal(classifyGithubProbe(branch, { missing: true }).state, 'missing')
  assert.equal(classifyGithubProbe(branch, { data: { object: { sha: '1'.repeat(40) } } }).actionable, true)

  const pullRequest = { kind: 'github-pull-request', repository: reachability.repository, pull_request: 17 }
  assert.equal(classifyGithubProbe(pullRequest, { missing: true }).actionable, false)
  assert.equal(classifyGithubProbe(pullRequest, { data: { state: 'OPEN', headRefOid: '2'.repeat(40) } }).actionable, true)
  const mergedPullRequest = { ...pullRequest, expected_states: ['MERGED'] }
  assert.equal(classifyGithubProbe(mergedPullRequest, { data: { state: 'OPEN' } }).actionable, false)
  assert.equal(classifyGithubProbe(mergedPullRequest, { data: { state: 'MERGED' } }).actionable, true)

  const checks = { kind: 'github-checks', repository: reachability.repository, pull_request: 17 }
  assert.equal(classifyGithubProbe(checks, { data: [{ name: 'verify', bucket: 'pending' }] }).state, 'pending')
  assert.equal(classifyGithubProbe(checks, { data: [{ name: 'verify', bucket: 'pass' }] }).actionable, true)

  assert.equal(githubProbeObservation(branch, {
    code: 1, stderr: 'Could not resolve host: api.github.com', stdout: '',
  }).state, 'unavailable')
  assert.equal(githubProbeObservation(branch, {
    code: 1, stderr: 'gh: Not Found (HTTP 404)', stdout: '',
  }).state, 'missing')
})

test('external watcher observes only the persisted control-plane dependency', () => {
  const execution = normalizeWatchDescriptor({
    condition: { watch: { kind: 'control-execution', execution_id: 41 } },
  })
  assert.deepEqual(execution, { kind: 'control-execution', execution_id: 41 })
  assert.equal(classifyControlProbe(execution, { status: 'running' }).actionable, false)
  assert.equal(classifyControlProbe(execution, { status: 'succeeded' }).actionable, true)

  const dependencies = normalizeWatchDescriptor({ condition: { watch: {
    kind: 'control-task-dependencies', task_ids: ['CP-TEST-002', 'CP-TEST-001', 'CP-TEST-001'],
  } } })
  assert.deepEqual(dependencies.task_ids, ['CP-TEST-001', 'CP-TEST-002'])
  assert.equal(classifyControlProbe(dependencies, [
    { task_id: 'CP-TEST-001', status: 'complete' },
    { task_id: 'CP-TEST-002', status: 'in_progress' },
  ]).actionable, false)
  assert.equal(classifyControlProbe(dependencies, [
    { task_id: 'CP-TEST-001', status: 'complete' },
    { task_id: 'CP-TEST-002', status: 'complete' },
  ]).actionable, true)
})

test('supervisor persists precise watch descriptors for in-flight and prerequisite waits', () => {
  const executionDescriptor = watchDescriptorForRecovery({}, {
    next_action: 'wait-external', reason: 'execution_in_flight', execution: { execution_id: 41 },
  })
  assert.deepEqual(executionDescriptor, { kind: 'control-execution', execution_id: 41 })

  const dependencyDescriptor = watchDescriptorForRecovery({ packet: { dependencies: [
    { task_id: 'CP-TEST-001', dependency_type: 'hard', status: 'in_progress' },
    { task_id: 'CP-TEST-002', dependency_type: 'soft', status: 'in_progress' },
  ] } }, { next_action: 'wait-external', reason: 'hard_dependency_unsatisfied' })
  assert.deepEqual(dependencyDescriptor, {
    kind: 'control-task-dependencies', task_ids: ['CP-TEST-001'],
  })
})

test('unchanged watcher polls advance only durable wake state with bounded backoff', () => {
  const now = new Date('2026-10-02T12:00:00.000Z')
  const observation = classifyGithubProbe(
    { kind: 'github-checks', repository: 'Building-Suit/building-suit-monorepo', pull_request: 17 },
    { data: [{ name: 'verify', bucket: 'pending' }] },
  )
  const recovery = { metadata: { watcher: { poll_count: 3, observation } } }
  const transition = watchTransition(recovery, structuredClone(observation), now)
  assert.equal(transition.changed, false)
  assert.equal(transition.actionable, false)
  assert.equal(transition.poll_count, 4)
  assert.equal(transition.next_wake_at, '2026-10-02T12:08:00.000Z')
  assert.equal(boundedWatcherBackoff(0), WATCHER_MIN_BACKOFF_MS)
  assert.equal(boundedWatcherBackoff(100), WATCHER_MAX_BACKOFF_MS)
})

test('actionable watcher transition schedules the existing supervisor without an implementation attempt', () => {
  const snapshot = {
    packet: { project: { github_repository: 'Building-Suit/building-suit-monorepo' } },
    publications: [{ pull_request_id: 1, pr_number: 17, state: 'open' }],
  }
  const descriptor = watchDescriptorForRecovery(snapshot, {
    next_action: 'wait-external', reason: 'external_dependency_unavailable',
  }, { metadata: { child_command: 'task-publish' } })
  assert.equal(descriptor.kind, 'github-pull-request')

  const prior = classifyGithubProbe(descriptor, { unavailable: true, error: 'timeout' })
  const available = classifyGithubProbe(descriptor, { data: { state: 'OPEN', headRefOid: '3'.repeat(40) } })
  const transition = watchTransition({ metadata: { watcher: { poll_count: 5, observation: prior } } }, available, new Date('2026-10-02T12:00:00.000Z'))
  assert.equal(transition.changed, true)
  assert.equal(transition.actionable, true)
  assert.equal(transition.poll_count, 0)
  assert.equal(transition.next_wake_at, '2026-10-02T12:00:00.000Z')
})

test('external watcher persistence is leased, crash-safe, idempotent, and retry-budget neutral', async () => {
  const migration = await readFile(new URL('../sql/021_external_state_watcher.sql', import.meta.url), 'utf8')
  const runner = await readFile(new URL('../runner/bs-agent.mjs', import.meta.url), 'utf8')
  const watcher = runner.slice(runner.indexOf('function externalWatcher()'), runner.indexOf('function acquireSupervisorLease'))

  assert.match(migration, /FOR UPDATE SKIP LOCKED/)
  assert.match(migration, /lease_expires_at <= now\(\)/)
  assert.match(migration, /next_action IN \(/)
  assert.match(migration, /'reconcile-repository'/)
  assert.match(migration, /'reconcile-publication'/)
  assert.match(migration, /jsonb_typeof\(condition->'watch'\) = 'object'/)
  assert.match(migration, /IF state_changed THEN/)
  assert.match(migration, /interval '30 seconds'/)
  assert.match(migration, /interval '15 minutes'/)
  assert.match(migration, /'external_recovery_actionable'/)
  assert.doesNotMatch(migration, /UPDATE control\.executions/)
  assert.doesNotMatch(migration, /INSERT INTO control\.executions/)
  assert.match(watcher, /invokeTaskAction\('task-supervise'/)
  assert.doesNotMatch(watcher, /task-run|task-retry|codex/)
})

test('continuous controller preserves bounded run outcomes', () => {
  assert.equal(continuousRunTransition({ gate: { should_continue: true }, task: { task_id: 'CP-X-001' }, supervisor: { outcome: 'success' } }), 'success')
  assert.equal(continuousRunTransition({ gate: { should_continue: true }, task: { task_id: 'CP-X-001' }, supervisor: { outcome: 'wait' } }), 'wait')
  assert.equal(continuousRunTransition({ gate: { should_continue: true }, task: null }), 'no-ready-task')
  assert.equal(continuousRunTransition({ gate: { reason: 'stop_requested' } }), 'stop-requested')
  assert.equal(continuousRunTransition({ gate: { reason: 'limit_reached' } }), 'task-limit')
  assert.equal(continuousRunTransition({ gate: { should_continue: true }, task: { task_id: 'CP-X-001' }, supervisor: { outcome: 'safety-stop' } }), 'safety-stop')
})

test('restricted n8n runner exposes only validated supervisor and registry commands', async () => {
  const { readFile } = await import('node:fs/promises')
  const runner = await readFile(new URL('../runner/bs-agent-ssh.sh', import.meta.url), 'utf8')
  assert.match(runner, /"bs-agent task-supervise "\*/)
  assert.match(runner, /"bs-agent workstream-resolve "\*/)
  assert.match(runner, /invalid_workstream_reference/)
  const supervisor = await readFile(new URL('../runner/bs-agent.mjs', import.meta.url), 'utf8')
  assert.match(supervisor, /recovery\.heartbeat_at/)
  assert.match(supervisor, /lease_expires_at <= now\(\)/)
  assert.match(supervisor, /recovery: \{ \.\.\.plan, \.\.\.persistedRecovery \}/)
})


test('control-plane runner permits configured retries until the policy limit', async () => {
  const { readFile } = await import('node:fs/promises')
  const runner = await readFile(
    new URL('../runner/bs-agent.mjs', import.meta.url),
    'utf8',
  )

  const stoppedMarker = ['automatic', 'repair_stopped'].join('_')
  assert.doesNotMatch(runner, new RegExp(stoppedMarker))
  assert.doesNotMatch(runner, /execution\.metadata\?\.retry === true/)
  assert.match(runner, /maxRepairCycles/)
  assert.match(runner, /maxRepairCycles\s*=\s*1/)
  assert.match(runner, /retry_limit_reached/)
  assert.match(runner, /decision\.allowed/)
  assert.match(runner, /failure_stage/)
  assert.match(runner, /verification_failures/)
  assert.match(runner, /verification_failure_requires_same_execution_reverify/)
  assert.match(runner, /legalActions\.push/)
})

test('worker prompt requires full Shop database regression after database changes', async () => {
  const { readFile } = await import('node:fs/promises')
  const prompt = await readFile(
    new URL('../runner/task-prompt.mjs', import.meta.url),
    'utf8',
  )

  assert.match(prompt, /pnpm db:test:shop/)
  assert.match(prompt, /full locally-safe regression command/)
  assert.match(prompt, /Do not claim a check passed unless/)
})

test('focused browser verification collects all failures before repair', async () => {
  const { readFile } = await import('node:fs/promises')
  const verifier = await readFile(
    new URL('../runner/task-verifier.mjs', import.meta.url),
    'utf8',
  )

  assert.match(verifier, /'--workers=1'/)
  assert.match(verifier, /'--retries=0'/)
  assert.match(verifier, /'--repeat-each=2'/)
  assert.doesNotMatch(verifier, /--max-failures=1/)
})

test('focused control-plane verification ignores unrelated workspace typecheck failures', async () => {
  const verifier = await readFile(
    new URL('../runner/task-verifier.mjs', import.meta.url),
    'utf8',
  )
  const selection = applicationScopeSelected({
    appPath: 'tooling/control-plane',
    changedFiles: ['tooling/control-plane/change.mjs'],
    mode: 'focused',
    verificationPlanText: '',
  })

  assert.equal(selection.selected, true)
  assert.doesNotMatch(verifier, /name:\s*'root-typecheck'/)
  assert.match(verifier, /appPackage\?\.name &&\s*applicationSelection\.selected/)
})

test('control-plane JavaScript changes select the CI-equivalent root lint gate', async () => {
  const verifier = await readFile(
    new URL('../runner/task-verifier.mjs', import.meta.url),
    'utf8',
  )

  assert.deepEqual(controlPlaneRootLintSelection({
    changedFiles: ['tooling/control-plane/runner/publication-preflight.mjs'],
  }), {
    selected: true,
    reason: 'changed_control_plane_javascript',
  })
  assert.deepEqual(controlPlaneRootLintSelection({
    changedFiles: ['tooling/control-plane/README.md', 'apps/shop-suit/app.vue'],
  }), {
    selected: false,
    reason: 'no_changed_control_plane_javascript',
  })
  assert.match(verifier, /name:\s*'root-lint'/)
  assert.match(verifier, /controlPlaneRootLintSelection\(\{\s*changedFiles/)
})

test('focused application verification selects relevant package checks', async () => {
  const verifier = await readFile(
    new URL('../runner/task-verifier.mjs', import.meta.url),
    'utf8',
  )
  const selection = applicationScopeSelected({
    appPath: 'apps/example',
    changedFiles: ['apps/example/src/change.mjs'],
    mode: 'focused',
    verificationPlanText: '',
  })

  assert.deepEqual(selection, {
    selected: true,
    reason: 'changed_file_in_application_scope',
  })
  for (const name of ['app-typecheck', 'app-lint', 'app-unit', 'app-build']) {
    assert.match(verifier, new RegExp(`'${name}'`))
  }
})

test('verification modes select changed-path checks deterministically', () => {
  const optional = {
    name: 'docs-check',
    program: 'node',
    required: false,
    changed_paths: ['docs/'],
  }
  assert.deepEqual(customCheckSelection({
    check: optional,
    changedFiles: ['tooling/control-plane/runner/task-verifier.mjs'],
    mode: 'focused',
  }), {
    selected: false,
    reason: 'optional_check_no_changed_path_match',
  })

  assert.deepEqual(customCheckSelection({
    check: optional,
    changedFiles: [],
    mode: 'focused',
    verificationPlanText: 'run docs-check',
  }), {
    selected: true,
    reason: 'required_by_task_verification_plan',
  })

  const required = { ...optional, required: true }
  assert.deepEqual(customCheckSelection({
    check: required,
    changedFiles: ['tooling/control-plane/runner/task-verifier.mjs'],
    mode: 'milestone',
  }), {
    selected: true,
    reason: 'required_by_milestone_contract',
  })
  assert.equal(resolveVerificationMode({ task: { task_type: 'release' } }), 'release')
  assert.equal(applicationScopeSelected({
    appPath: 'apps/example',
    changedFiles: [],
    mode: 'milestone',
    verificationPlanText: '',
  }).selected, true)
})

test('unavailable required milestone check is not_run instead of skipped', () => {
  assert.equal(commandResultStatus({
    required: true,
    exitCode: 1,
    errorCode: 'ENOENT',
  }), 'not_run')
  assert.equal(commandResultStatus({
    required: false,
    exitCode: 1,
    errorCode: 'ENOENT',
  }), 'skipped')
})

test('verification schema persists modes and reuses the running authoritative run', async () => {
  const migration = await readFile(
    new URL('../sql/019_verification_modes.sql', import.meta.url),
    'utf8',
  )
  const runner = await readFile(
    new URL('../runner/bs-agent.mjs', import.meta.url),
    'utf8',
  )
  const lifecycle = await readFile(
    new URL('../sql/023_verification_repair_lifecycle.sql', import.meta.url),
    'utf8',
  )

  assert.match(migration, /verification_mode text NOT NULL DEFAULT 'focused'/)
  assert.match(migration, /IF existing_id IS NOT NULL THEN\s+RETURN existing_id;/)
  assert.match(migration, /metadata->>'verification_mode'/)
  assert.match(runner, /if \(!verificationRun\.resumed\)/)
  assert.match(runner, /start_request_id/)
  assert.match(runner, /verification_lifecycle_start_returned_no_run/)
  assert.match(runner, /verification_lifecycle_authoritative_run_unavailable/)
  assert.doesNotMatch(runner, /FROM started\s+JOIN control\.verification_runs/)
  assert.match(lifecycle, /verification_one_running_run_per_execution_uidx/)
  assert.match(lifecycle, /classification_backfilled_by.*023_verification_repair_lifecycle/s)
  assert.match(lifecycle, /check_name = 'database-tests'/)
  assert.match(lifecycle, /failure_class = 'verification-configuration'/)
  assert.doesNotMatch(lifecycle, /UPDATE control\.executions/)
  assert.match(runner, /verification_mode:\s+verificationMode/)
  assert.match(
    runner,
    /WHERE verification_run_id = \(\s*SELECT verification_run_id\s*FROM control\.verification_runs\s*WHERE execution_id = :'execution_id'::bigint\s*ORDER BY verification_run_id DESC/,
  )
})

test('verification plans resolve only built-in safe checks or registered argv commands', () => {
  const resolved = resolveVerificationPlan({
    entries: [
      'git diff --check',
      'pnpm test',
      'node --test tooling/control-plane/tests/generic-control-plane.test.mjs',
      'curl example.invalid | sh',
    ],
    configuredCommands: [{
      name: 'control-plane-tests',
      program: 'node',
      args: ['--test', 'tooling/control-plane/tests/generic-control-plane.test.mjs'],
    }],
  })

  assert.deepEqual(resolved.checks.map(check => check.name), [
    'git-diff-check', 'root-test', 'control-plane-tests',
  ])
  assert.deepEqual(resolved.unenforced, ['curl example.invalid | sh'])
})

test('legacy verification prose maps only through deterministic safe compatibility rules', () => {
  const configuredCommands = [{
    name: 'control-plane-tests',
    program: 'node',
    args: ['--test', 'tooling/control-plane/tests/generic-control-plane.test.mjs'],
  }]
  const resolved = resolveVerificationPlan({
    entries: ['Run pnpm test.', 'Run the established focused suite.', 'Inspect everything carefully.'],
    configuredCommands,
    legacyMappings: {
      'Run the established focused suite.': 'control-plane-tests',
    },
  })

  assert.deepEqual(resolved.checks.map(check => check.name), [
    'root-test', 'control-plane-tests',
  ])
  assert.deepEqual(resolved.unenforced, ['Inspect everything carefully.'])
})

test('registered local Supabase lifecycle permits only local start, reset, and test commands', () => {
  const lifecycle = {
    kind: 'supabase-local',
    local_only: true,
    start_when_needed: true,
    start_commands: [{ name: 'database-start', program: 'pnpm', args: ['exec', 'supabase', 'start'], cwd: 'apps/example-suit' }],
    reset_commands: [{ name: 'database-reset', program: 'pnpm', args: ['exec', 'supabase', 'db', 'reset', '--local'], cwd: 'apps/example-suit' }],
    test_commands: [{ name: 'database-tests', program: 'pnpm', args: ['exec', 'supabase', 'test', 'db', '--local'], cwd: 'apps/example-suit' }],
  }
  const valid = validateLocalSupabaseLifecycle(lifecycle)
  assert.equal(valid.valid, true)
  assert.deepEqual(valid.commands.map(command => command.phase), ['start', 'reset', 'test'])

  const remote = structuredClone(lifecycle)
  remote.reset_commands[0].args = ['exec', 'supabase', 'db', 'push', '--linked']
  assert.equal(validateLocalSupabaseLifecycle(remote).valid, false)

  const shellWrapped = structuredClone(lifecycle)
  shellWrapped.test_commands[0] = {
    name: 'database-tests', program: 'bash', args: ['-c', 'supabase test db --local'],
  }
  assert.equal(validateLocalSupabaseLifecycle(shellWrapped).valid, false)

  const resolved = resolveDatabaseVerification({
    verificationConfig: { database: lifecycle },
    suitSlug: 'registered-suit',
    appPath: 'apps/example-suit',
  })
  assert.equal(resolved.source, 'registered_local_supabase_lifecycle')
  assert.deepEqual(resolved.commands.map(command => command.name), [
    'database-start', 'database-reset', 'database-tests',
  ])
})

test('verification readiness requires registered safe checks and unambiguous plan coverage', () => {
  const packet = {
    task: { verification_plan: ['Run focused verification.'] },
    suit: { slug: 'registered-suit', app_path: 'apps/registered-suit' },
    project: { verification_config: {} },
    workstream: { verification_config: {} },
    publication_boundaries: { task_paths: ['apps/registered-suit/'] },
  }
  assert.equal(evaluateVerificationReadiness(packet).reason, 'verification_commands_missing')

  packet.workstream.verification_config = {
    commands: [{ name: 'focused-tests', program: 'node', args: ['--test', 'tests/focused.test.mjs'] }],
  }
  assert.equal(evaluateVerificationReadiness(packet).reason, 'verification_plan_mapping_required')

  packet.workstream.verification_config.legacy_plan_mappings = {
    'Run focused verification.': 'focused-tests',
  }
  assert.equal(evaluateVerificationReadiness(packet).ready, true)

  packet.workstream.verification_config.commands[0] = {
    name: 'focused-tests', program: 'bash', args: ['-c', 'node --test'],
  }
  assert.equal(
    evaluateVerificationReadiness(packet).reason,
    'registered_verification_command_invalid',
  )
})

test('database-scoped readiness waits until a registered local verifier exists', () => {
  const packet = {
    task: { verification_plan: ['pnpm test'] },
    suit: { slug: 'new-suit', app_path: 'apps/new-suit' },
    project: { verification_config: {} },
    workstream: { verification_config: {} },
    publication_boundaries: { task_paths: ['apps/new-suit/supabase/'] },
  }
  assert.equal(
    evaluateVerificationReadiness(packet).reason,
    'database_verification_configuration_missing',
  )

  packet.workstream.verification_config.database = {
    kind: 'supabase-local',
    local_only: true,
    start_when_needed: true,
    start_commands: [{ name: 'database-start', program: 'supabase', args: ['start'], cwd: 'apps/new-suit' }],
    reset_commands: [{ name: 'database-reset', program: 'supabase', args: ['db', 'reset', '--local'], cwd: 'apps/new-suit' }],
    test_commands: [{ name: 'database-tests', program: 'supabase', args: ['test', 'db', '--local'], cwd: 'apps/new-suit' }],
  }
  assert.equal(evaluateVerificationReadiness(packet).ready, true)
})

test('verification config merge preserves project checks and workstream overrides by name', () => {
  const merged = mergeVerificationConfig(
    { commands: [{ name: 'shared', program: 'pnpm', args: ['test'] }] },
    { commands: [{ name: 'shared', program: 'pnpm', args: ['lint'] }, { name: 'local', program: 'node', args: ['--test'] }] },
  )
  assert.deepEqual(merged.commands.map(command => command.args), [['lint'], ['--test']])
})

test('publication readiness requires every explicit boolean and exposes conservative defaults', () => {
  assert.equal(completePublicationPolicy(CONSERVATIVE_PUBLICATION_POLICY), true)
  assert.equal(completePublicationPolicy({
    ...CONSERVATIVE_PUBLICATION_POLICY,
    merge_authorized: 'false',
  }), false)
  assert.equal(completePublicationPolicy({}), false)

  const existing = {
    merge_authorized: true,
    deployment_authorized: false,
    hosted_database_changes_authorized: false,
    review_required_before_integration: true,
    retained_extension: 'exact',
  }
  assert.equal(publicationPolicyBackfill(existing), existing)
  assert.deepEqual(publicationPolicyBackfill({ merge_authorized: true }), {
    ...CONSERVATIVE_PUBLICATION_POLICY,
  })
  assert.deepEqual(
    publicationPolicyBackfill(publicationPolicyBackfill({})),
    CONSERVATIVE_PUBLICATION_POLICY,
  )
})

test('workstream readiness migrations preserve valid policy and repair nullable policy gaps', async () => {
  const readinessMigration = await readFile(
    new URL('../sql/024_workstream_readiness.sql', import.meta.url),
    'utf8',
  )
  const repairMigration = await readFile(
    new URL('../sql/025_workstream_publication_policy_repair.sql', import.meta.url),
    'utf8',
  )
  const repairSmoke = await readFile(
    new URL('./workstream-publication-policy-repair-smoke.sql', import.meta.url),
    'utf8',
  )
  const automation = await readFile(new URL('../automation.mjs', import.meta.url), 'utf8')

  assert.match(readinessMigration, /suit\.status IS DISTINCT FROM/)
  assert.match(readinessMigration, /SAS-M1-BOOT-001 execution 245/)
  assert.match(repairMigration, /jsonb_typeof\(publication_config->'merge_authorized'\) = 'boolean'/)
  assert.match(repairMigration, /\) IS NOT TRUE/)
  assert.match(repairMigration, /'merge_authorized', false/)
  assert.match(repairMigration, /'deployment_authorized', false/)
  assert.match(repairMigration, /'hosted_database_changes_authorized', false/)
  assert.match(repairMigration, /'review_required_before_integration', true/)
  assert.match(repairMigration, /old_config, publication_config/)
  assert.match(repairMigration, /025_workstream_publication_policy_repair/)
  assert.match(repairMigration, /SS-SA-BRIDGE-001/)
  assert.doesNotMatch(repairMigration, /UPDATE control\.executions/)
  assert.doesNotMatch(repairMigration, /INSERT INTO control\.executions/)
  assert.doesNotMatch(repairMigration, /SET verification_config/)
  for (const fixture of [
    "'empty'",
    "'partial'",
    "'explicit-null'",
    "'wrong-type'",
    "'array'",
    "'scalar-null'",
    "'complete'",
  ]) assert.match(repairSmoke, new RegExp(fixture))
  assert.equal((repairSmoke.match(/025_workstream_publication_policy_repair\.sql/g) ?? []).length, 2)
  assert.match(repairSmoke, /old_value IS NULL OR new_value IS DISTINCT FROM conservative_policy/)
  assert.match(automation, /app_path=EXCLUDED\.app_path,status=EXCLUDED\.status/)
  assert.match(automation, /CASE WHEN COALESCE\(\(w->>'active'\)::boolean,true\) THEN 'active' ELSE 'paused' END/)
})

test('forward verification reopen migration restores same-execution lifecycle safely', async () => {
  const historicalMigration = await readFile(
    new URL('../sql/014_generic_automation_platform.sql', import.meta.url),
    'utf8',
  )
  const migration = await readFile(
    new URL('../sql/026_verification_reopen_lifecycle.sql', import.meta.url),
    'utf8',
  )
  const upgradeSmoke = await readFile(
    new URL('./verification-reopen-upgrade-smoke.sql', import.meta.url),
    'utf8',
  )

  assert.match(historicalMigration, /FUNCTION control\.reopen_verification/)
  assert.match(migration, /CREATE OR REPLACE FUNCTION control\.reopen_verification/)
  assert.match(migration, /task_row\.status NOT IN \('failed', 'passed'\)/)
  assert.match(migration, /execution_row\.status <> 'succeeded'/)
  assert.match(migration, /ORDER BY execution\.attempt DESC, execution\.execution_id DESC/)
  assert.match(migration, /SET status = 'verification', engine_stage = 'verification'/)
  assert.match(migration, /'verification_reopened'/)
  assert.match(migration, /'verification_recovery_resolved'/)
  assert.match(migration, /resolved_failure_ids/)
  assert.match(migration, /resolved_recovery_state_ids/)
  assert.match(migration, /GRANT EXECUTE ON FUNCTION control\.reopen_verification\(text, text, text\)/)
  assert.doesNotMatch(migration, /INSERT INTO control\.executions/)
  assert.doesNotMatch(migration, /UPDATE control\.executions/)
  assert.doesNotMatch(migration, /verification-product-defect/)

  assert.match(upgradeSmoke, /DROP FUNCTION IF EXISTS control\.reopen_verification/)
  assert.match(upgradeSmoke, /representative pre-026 state still has reopen_verification/)
  assert.equal((upgradeSmoke.match(/026_verification_reopen_lifecycle\.sql/g) ?? []).length, 2)
  assert.match(upgradeSmoke, /has_function_privilege/)
  assert.match(upgradeSmoke, /source = 'supervisor'/)
  assert.match(upgradeSmoke, /same-execution verification did not complete cleanly/)
  assert.match(upgradeSmoke, /unsucceeded latest execution was incorrectly eligible/)
})

test('database verification prefers registered workstream configuration and preserves compatibility', () => {
  const configured = resolveDatabaseVerification({
    verificationConfig: {
      database: {
        commands: [{ name: 'database-tests', program: 'pnpm', args: ['db:test:super-admin'] }],
      },
    },
    suitSlug: 'super-admin-suit',
    appPath: 'apps/super-admin-suit',
  })
  assert.equal(configured.source, 'registered_verification_config')
  assert.deepEqual(configured.commands[0].args, ['db:test:super-admin'])

  assert.equal(resolveDatabaseVerification({
    verificationConfig: {}, suitSlug: 'shop-suit', appPath: 'apps/shop-suit',
  }).commands[0].args[0], 'db:test:shop')
  assert.equal(resolveDatabaseVerification({
    verificationConfig: {}, suitSlug: 'new-suit', appPath: 'apps/new-suit',
  }).commands.length, 0)
})

test('verification failure classification separates product, configuration, infrastructure, and unavailable checks', () => {
  for (const [failureClass, recoveryAction] of [
    ['verification-product-defect', 'repair'],
    ['verification-configuration', 'wait-operator'],
    ['verification-infrastructure', 'wait-external'],
    ['verification-required-check-unavailable', 'wait-operator'],
    ['verification-lifecycle', 'reverify'],
  ]) {
    assert.deepEqual(classifyVerificationResults([{
      status: 'fail', failure_class: failureClass,
    }]), {
      failure_class: failureClass,
      recovery_action: recoveryAction,
    })
  }
})

test('repair execution is gated by verifier probes', async () => {
  const { readFile } = await import('node:fs/promises')

  const verifier = await readFile(
    new URL('../runner/task-verifier.mjs', import.meta.url),
    'utf8',
  )

  const runner = await readFile(
    new URL('../runner/bs-agent.mjs', import.meta.url),
    'utf8',
  )

  assert.match(verifier, /verificationRunId === 'probe'/)
  assert.match(verifier, /if \(verificationProbe\)/)

  assert.match(runner, /maxRepairCycles/)
  assert.match(runner, /repair-verification-/)
  assert.match(runner, /verification_probe_passed/)
  assert.match(runner, /latestProbe\?\.passed ===/)
  assert.match(runner, /repair_verification_failed/)
})

test('repair acceptance requires a confirmation verifier pass', async () => {
  const { readFile } = await import('node:fs/promises')

  const runner = await readFile(
    new URL('../runner/bs-agent.mjs', import.meta.url),
    'utf8',
  )

  assert.match(runner, /repair-verification-\$\{cycle\}-confirmation/)
  assert.match(runner, /confirmationProbe\?\.passed ===/)
})

test('recovery schema exposes the canonical durable contract consumed by the supervisor', async () => {
  const { readFile } = await import('node:fs/promises')
  const migration = await readFile(
    new URL('../sql/018_failure_recovery_state.sql', import.meta.url),
    'utf8',
  )
  const runner = await readFile(
    new URL('../runner/bs-agent.mjs', import.meta.url),
    'utf8',
  )

  for (const failureClass of [
    'transient-infrastructure',
    'repository-state',
    'verification-product-defect',
    'flaky-verification',
    'publication-scope',
    'publication-reconciliation',
    'no-change',
    'external-wait',
    'decision-wait',
    'operator-wait',
    'safety-stop',
  ]) {
    assert.match(migration, new RegExp(`'${failureClass}'`))
  }

  for (const recoveryAction of [
    'retry',
    'repair',
    'reconcile-runtime',
    'reconcile-repository',
    'reconcile-publication',
    'wait-external',
    'wait-decision',
    'wait-operator',
    'complete-no-changes',
    'safety-stop',
  ]) {
    assert.match(migration, new RegExp(`'${recoveryAction}'`))
  }

  assert.match(migration, /CREATE TABLE IF NOT EXISTS control\.recovery_states/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS control\.recovery_state_events/)
  assert.match(migration, /FUNCTION control\.record_recovery_condition/)
  assert.match(migration, /FUNCTION control\.read_recovery_condition/)
  assert.match(runner, /record_recovery_condition/)
  assert.match(runner, /current_task_recovery_condition/)
  assert.match(runner, /task-supervise/)
})

function supervisorFixture({
  taskStatus = 'in_progress',
  executionStatus = null,
  attempt = 1,
  maxAttempts = 5,
  verificationStatus = null,
  publication = null,
  recovery = null,
  failures = [],
  verificationFailureClass = null,
} = {}) {
  const execution = executionStatus
    ? { execution_id: 41, attempt, status: executionStatus, engine_stage: 'implementation' }
    : null
  return {
    packet: {
      task: { task_id: 'CP-TEST-001', status: taskStatus, engine_stage: 'implementation' },
      retry_policy: { policy_id: 'fixture', max_attempts: maxAttempts, attempt_profiles: Array(maxAttempts).fill('standard') },
    },
    executions: execution ? [execution] : [],
    verification_runs: verificationStatus
      ? [{
          verification_run_id: 71,
          execution_id: 41,
          status: verificationStatus,
          metadata: verificationFailureClass ? { failure_class: verificationFailureClass } : {},
        }]
      : [],
    verification_results: [],
    failures,
    publications: publication ? [{ pull_request_id: 91, state: 'open', ...publication }] : [],
    recovery,
  }
}

test('supervisor deterministically advances implementation, verification, and publication fixtures', () => {
  const implementation = planSupervisorStep(supervisorFixture())
  assert.equal(implementation.command, 'task-run')

  const verification = planSupervisorStep(supervisorFixture({ executionStatus: 'succeeded' }))
  assert.equal(verification.command, 'task-verify')

  const publication = planSupervisorStep(supervisorFixture({
    taskStatus: 'passed', executionStatus: 'succeeded', verificationStatus: 'passed',
  }))
  assert.equal(publication.command, 'task-publish')

  const complete = planSupervisorStep(supervisorFixture({
    taskStatus: 'complete', executionStatus: 'succeeded', verificationStatus: 'passed', publication: { pr_number: 12 },
  }))
  assert.equal(complete.kind, 'terminal')
  assert.equal(complete.reason, 'task_complete')
})

test('supervisor resumes completed stages instead of restarting them', () => {
  assert.equal(
    planSupervisorStep(supervisorFixture({ executionStatus: 'succeeded' })).command,
    'task-verify',
  )
  assert.equal(
    planSupervisorStep(supervisorFixture({ taskStatus: 'failed', executionStatus: 'succeeded', verificationStatus: 'failed' })).command,
    'task-retry',
  )
  assert.equal(
    planSupervisorStep(supervisorFixture({ taskStatus: 'passed', executionStatus: 'succeeded', verificationStatus: 'passed' })).command,
    'task-publish',
  )
  assert.equal(
    planSupervisorStep(supervisorFixture({ taskStatus: 'passed', executionStatus: 'succeeded', verificationStatus: 'passed', publication: { pr_number: 18 } })).next_action,
    'reconcile-publication',
  )
})

test('failed verification routes non-product failures to same-execution reverify or recoverable wait', () => {
  const lifecycle = planSupervisorStep(supervisorFixture({
    taskStatus: 'failed', executionStatus: 'succeeded', verificationStatus: 'failed',
    verificationFailureClass: 'verification-lifecycle',
  }))
  assert.equal(lifecycle.command, 'task-verify')
  assert.equal(lifecycle.next_action, 'reverify')

  const configuration = planSupervisorStep(supervisorFixture({
    taskStatus: 'failed', executionStatus: 'succeeded', verificationStatus: 'failed',
    verificationFailureClass: 'verification-configuration',
  }))
  assert.equal(configuration.kind, 'wait')
  assert.equal(configuration.next_action, 'wait-operator')

  const infrastructure = planSupervisorStep(supervisorFixture({
    taskStatus: 'failed', executionStatus: 'succeeded', verificationStatus: 'failed',
    verificationFailureClass: 'verification-infrastructure',
  }))
  assert.equal(infrastructure.kind, 'wait')
  assert.equal(infrastructure.next_action, 'wait-external')

  const product = planSupervisorStep(supervisorFixture({
    taskStatus: 'failed', executionStatus: 'succeeded', verificationStatus: 'failed',
    verificationFailureClass: 'verification-product-defect',
  }))
  assert.equal(product.command, 'task-retry')
})

test('corrected verifier configuration reverifies the same succeeded execution', () => {
  const fixture = supervisorFixture({
    taskStatus: 'failed', executionStatus: 'succeeded', verificationStatus: 'failed',
    verificationFailureClass: 'verification-configuration',
  })
  fixture.packet.project = { verification_config: {} }
  fixture.packet.workstream = { verification_config: {} }
  const waiting = planSupervisorStep(fixture)
  fixture.recovery = {
    status: 'active',
    failure_class: 'verification-configuration',
    next_action: 'wait-operator',
    condition: { fingerprint: waiting.fingerprint },
  }
  fixture.packet.workstream.verification_config = {
    database: {
      commands: [{ name: 'database-tests', program: 'pnpm', args: ['db:test:super-admin'] }],
    },
  }

  const corrected = planSupervisorStep(fixture)
  assert.equal(corrected.command, 'task-verify')
  assert.equal(corrected.execution.execution_id, 41)
  assert.equal(corrected.next_action, 'reverify')
})

test('supervisor decisions are idempotent for identical persisted state', () => {
  const fixture = supervisorFixture({ executionStatus: 'succeeded' })
  const first = planSupervisorStep(fixture)
  const second = planSupervisorStep(structuredClone(fixture))
  assert.equal(first.fingerprint, second.fingerprint)
  assert.equal(first.command, second.command)
  assert.equal(supervisorResumeIdentity('CP-TEST-001'), 'task:CP-TEST-001')

  const stageRecords = new Set()
  for (const plan of [first, second]) stageRecords.add(`${plan.fingerprint}:${plan.command}`)
  assert.equal(stageRecords.size, 1)
})

test('supervisor respects retry exhaustion and explicit wait or safety routing', () => {
  const exhausted = planSupervisorStep(supervisorFixture({
    taskStatus: 'failed', executionStatus: 'failed', attempt: 5, maxAttempts: 5,
  }))
  assert.equal(exhausted.next_action, 'safety-stop')
  assert.equal(exhausted.kind, 'terminal')

  const inFlight = planSupervisorStep(supervisorFixture({ executionStatus: 'running' }))
  assert.equal(inFlight.next_action, 'wait-external')

  const external = classifySupervisorFailure({
    command: 'task-publish', payload: { error: 'network unavailable' }, attempt: 1, maxAttempts: 5,
  })
  assert.equal(external.next_action, 'wait-external')

  const github = classifySupervisorFailure({
    command: 'task-publish',
    payload: { publication: { error: 'unable_to_find_existing_pr', stderr: 'temporary GitHub API failure' } },
    attempt: 5,
    maxAttempts: 5,
  })
  assert.equal(github.failure_class, 'external-wait')
  assert.equal(github.next_action, 'wait-external')

  const operator = classifySupervisorFailure({
    command: 'task-publish', payload: { error: 'publication scope unauthorized' }, attempt: 1, maxAttempts: 5,
  })
  assert.equal(operator.next_action, 'wait-operator')
  assert.equal(operator.failure_class, 'publication-scope')

  const verifierInfrastructure = classifySupervisorFailure({
    command: 'task-verify', payload: { error: 'network unavailable' }, attempt: 1, maxAttempts: 5,
  })
  assert.equal(verifierInfrastructure.failure_class, 'external-wait')
})

test('supervisor honors persisted wait conditions until their wake or state change', () => {
  const fixture = supervisorFixture({ taskStatus: 'passed', executionStatus: 'succeeded', verificationStatus: 'passed' })
  const planned = planSupervisorStep(fixture)
  fixture.recovery = {
    status: 'active',
    failure_class: 'external-wait',
    next_action: 'wait-external',
    error_code: 'provider_unavailable',
    next_wake_at: new Date(Date.now() + 60_000).toISOString(),
    condition: { fingerprint: planned.fingerprint },
  }
  assert.equal(planSupervisorStep(fixture).kind, 'wait')

  fixture.recovery.next_wake_at = new Date(Date.now() - 60_000).toISOString()
  assert.equal(planSupervisorStep(fixture).command, 'task-publish')
})

test('supervisor reevaluates preflight waits when runtime configuration changes', () => {
  const fixture = supervisorFixture()
  const planned = planSupervisorStep(fixture)
  fixture.recovery = {
    status: 'active',
    failure_class: 'operator-wait',
    next_action: 'wait-operator',
    error_code: 'required_environment_configuration_missing',
    condition: { fingerprint: planned.fingerprint, preflight: true },
  }
  assert.equal(planSupervisorStep(fixture).command, 'task-run')
})

function parentSatisfactionFixture() {
  const criteria = ['The requested behavior is verified.']
  const packet = {
    task: {
      task_id: 'CP-TEST-001',
      status: 'in_progress',
      acceptance_criteria: criteria,
      parent_satisfaction: {
        source_task_id: 'CP-SOURCE-001',
        verification_run_id: 71,
        acceptance_criteria_digest: acceptanceCriteriaDigest(criteria),
        reason: 'The verified source implementation is contained in the resolved parent.',
      },
    },
  }
  const sourceEvidence = {
    task_id: 'CP-SOURCE-001',
    task_status: 'complete',
    execution_id: 41,
    execution_status: 'succeeded',
    commit_sha: '2'.repeat(40),
    verification_run_id: 71,
    verification_status: 'passed',
    checks: [{
      check_name: 'focused-tests', command: 'node --test', status: 'pass',
      exit_code: 0, summary: 'passed', required: true,
    }],
  }
  return {
    packet,
    parent: { parent_branch: 'codex/control-plane/source', parent_sha: '3'.repeat(40) },
    sourceEvidence,
    sourceCommitInParent: true,
    executions: [],
    publications: [],
  }
}

test('parent satisfaction requires deterministic acceptance and passed verification evidence', () => {
  const fixture = parentSatisfactionFixture()
  const evaluation = evaluateParentSatisfaction(fixture)
  assert.equal(evaluation.satisfied, true)
  assert.equal(evaluation.parent_sha, '3'.repeat(40))
  assert.equal(evaluation.source_verification_run_id, 71)
  assert.equal(evaluation.verification_evidence[0].status, 'pass')

  const planFixture = supervisorFixture()
  planFixture.parent_satisfaction = evaluation
  const plan = planSupervisorStep(planFixture)
  assert.equal(plan.command, 'complete-parent-satisfied')
  assert.equal(plan.reason, 'parent_satisfaction_proven')
})

test('empty diff or incomplete evidence never proves parent satisfaction', () => {
  const missingContract = parentSatisfactionFixture()
  delete missingContract.packet.task.parent_satisfaction
  assert.equal(
    evaluateParentSatisfaction(missingContract).reason,
    'parent_satisfaction_contract_missing',
  )

  const failedCheck = parentSatisfactionFixture()
  failedCheck.sourceEvidence.checks[0].status = 'fail'
  assert.equal(
    evaluateParentSatisfaction(failedCheck).reason,
    'required_verification_evidence_not_passed',
  )

  const noChange = classifySupervisorFailure({
    command: 'task-publish', payload: { error: 'no_publishable_changes' }, attempt: 1, maxAttempts: 5,
  })
  assert.equal(noChange.command, 'handle-no-publishable-changes')
})

test('parent advancement reconciles verified source lineage deterministically', () => {
  const absent = parentSatisfactionFixture()
  absent.sourceCommitInParent = false
  assert.equal(
    evaluateParentSatisfaction(absent).reason,
    'source_commit_not_in_resolved_parent',
  )

  const advanced = parentSatisfactionFixture()
  advanced.parent.parent_sha = '4'.repeat(40)
  const first = evaluateParentSatisfaction(advanced)
  const repeated = evaluateParentSatisfaction(structuredClone(advanced))
  assert.equal(first.satisfied, true)
  assert.equal(first.fingerprint, repeated.fingerprint)
})

test('existing task branches, publications, or executions are not parent satisfaction', () => {
  for (const fixture of [
    { taskLineage: { local_branch: true }, reason: 'task_lineage_already_exists' },
    { publications: [{ pull_request_id: 9 }], reason: 'task_lineage_already_exists' },
    { executions: [{ execution_id: 8 }], reason: 'implementation_execution_already_exists' },
  ]) {
    const input = parentSatisfactionFixture()
    Object.assign(input, fixture)
    assert.equal(evaluateParentSatisfaction(input).reason, fixture.reason)
  }
})

test('parent-satisfaction persistence is idempotent and preserves no-change compatibility', async () => {
  const migration = await readFile(
    new URL('../sql/020_parent_satisfaction.sql', import.meta.url),
    'utf8',
  )
  const noChangeMigration = await readFile(
    new URL('../sql/017_no_change_observability.sql', import.meta.url),
    'utf8',
  )
  assert.match(migration, /UNIQUE \(task_id, fingerprint\)/)
  assert.match(migration, /ON CONFLICT \(task_id, fingerprint\) DO NOTHING/)
  assert.match(migration, /parent_satisfaction_evaluated/)
  assert.match(migration, /parent_satisfaction_completed/)
  assert.match(migration, /source evidence is not authoritative/)
  assert.match(migration, /already has implementation or publication lineage/)
  assert.match(migration, /status = 'complete'/)
  assert.match(noChangeMigration, /allow_no_change_completion/)
  assert.match(noChangeMigration, /implementation_no_changes/)
})

test('supervisor records satisfaction before completion and can resume without implementation', async () => {
  const runner = await readFile(new URL('../runner/bs-agent.mjs', import.meta.url), 'utf8')
  const supervisor = runner.slice(runner.indexOf('function taskSupervisor()'), runner.indexOf('function taskEngine()'))
  assert.ok(supervisor.indexOf('evaluateSupervisorParentSatisfaction') < supervisor.indexOf('runExecutionPreflight('))
  assert.match(supervisor, /parent-satisfaction:\$\{plan\.parent_satisfaction\.fingerprint\}/)
  assert.ok(supervisor.indexOf('recordSupervisorRecovery(snapshot, plan') < supervisor.indexOf('completeParentSatisfied(taskId'))
})

function executionPreflightFixture() {
  const identity = {
    database: 'control_test',
    user: 'control_runner',
    server_address: '127.0.0.1',
    server_port: 5432,
    server_version_num: '170000',
    control_schema: 'control',
    task_packet_contract: 'control.generic_task_packet(text)',
  }
  const identityFingerprint = fingerprint(identity)
  return {
    packet: {
      task: {
        task_id: 'CP-TEST-001',
        title: 'Ready task',
        description: 'Exercise deterministic readiness.',
        model_profile: 'standard',
        status: 'in_progress',
        acceptance_criteria: ['Preflight passes.'],
        verification_plan: ['control-plane-tests'],
      },
      suit: { slug: 'control-plane', status: 'active', stack_key: 'control-plane', app_path: 'tooling/control-plane' },
      project: {
        active: true,
        allowed_publication_paths: ['tooling/'],
      },
      workstream: {
        active: true,
        application_path: 'tooling/control-plane',
        concurrency_policy: { serialized: true },
        publication_config: {
          merge_authorized: false,
          deployment_authorized: false,
          hosted_database_changes_authorized: false,
          review_required_before_integration: true,
        },
        verification_config: {
          commands: [{
            name: 'control-plane-tests',
            program: 'node',
            args: ['--test', 'tooling/control-plane/tests/generic-control-plane.test.mjs'],
            required: true,
          }],
        },
      },
      dependencies: [{ task_id: 'CP-TEST-000', dependency_type: 'hard', status: 'complete' }],
      decisions: [{ id: 'CP-D01', blocking: true, status: 'approved' }],
      retry_policy: {
        policy_id: 'critical-five',
        max_attempts: 5,
        attempt_profiles: ['standard', 'standard', 'deep', 'deep', 'deep'],
      },
      publication_contract: {
        contract_id: 1,
        contract_version: 1,
        source: 'unit-fixture',
        required_paths: [],
        unresolved_scopes: [],
        contract_fingerprint: 'fixture',
        task_paths: [],
        source_paths: [],
        workstream_paths: ['tooling/control-plane/'],
        project_paths: ['tooling/'],
      },
      publication_authorizations: { ordinary: [], protected: [] },
    },
    runtime: {
      control_database: {
        identity,
        actual_fingerprint: identityFingerprint,
        expected_fingerprint: identityFingerprint,
      },
      repository: {
        root_valid: true,
        integration_sha: '1'.repeat(40),
        integration_commit_present: true,
        parent: { parent_branch: 'stg', parent_sha: '1'.repeat(40), parent_pr: null },
        parent_commit_present: true,
        parent_consistent: true,
        worktree_target: { status: 'ready', path: '/tmp/control-plane-cp-test-001' },
        dependencies_ready: true,
      },
      executables: { node: true, git: true, gh: true, psql: true, pnpm: true, codex: true },
      environment: { valid: true, missing: [] },
    },
    executions: [],
    serializationConflicts: [],
  }
}

test('execution preflight accepts a coherent ready task deterministically', () => {
  const fixture = executionPreflightFixture()
  const first = evaluateExecutionPreflight(fixture)
  const second = evaluateExecutionPreflight(structuredClone(fixture))
  assert.equal(first.ready, true)
  assert.equal(first.reason, 'preflight_ready')
  assert.equal(first.context.attempt, 1)
  assert.equal(first.fingerprint, second.fingerprint)
  assert.deepEqual(first.checks, second.checks)
})

test('verification product repair has an explicit failed-task preflight without weakening task-run eligibility', () => {
  const fixture = executionPreflightFixture()
  fixture.packet.task.status = 'failed'
  fixture.executions = [{ execution_id: 245, attempt: 1, status: 'succeeded' }]

  assert.equal(evaluateExecutionPreflight(fixture).reason, 'task_not_execution_eligible')
  const repair = evaluateExecutionPreflight({
    ...fixture,
    purpose: 'verification-product-repair',
  })
  assert.equal(repair.ready, true)
  assert.equal(repair.context.attempt, 2)
  assert.equal(
    repair.checks.find(check => check.name === 'task_lifecycle')?.failed_verification_product_repair,
    true,
  )
})

test('failed implementation retry also requires authoritative execution preflight', () => {
  const fixture = executionPreflightFixture()
  fixture.packet.task.status = 'failed'
  fixture.executions = [{ execution_id: 246, attempt: 1, status: 'failed' }]
  const retry = evaluateExecutionPreflight({ ...fixture, purpose: 'retry' })
  assert.equal(retry.ready, true)
  assert.equal(retry.context.attempt, 2)
  assert.equal(retry.checks.find(check => check.name === 'task_lifecycle')?.failed_execution_retry, true)
})

test('direct task-run and task-retry cannot bypass execution preflight', async () => {
  const runner = await readFile(new URL('../runner/bs-agent.mjs', import.meta.url), 'utf8')
  const runBody = runner.slice(runner.indexOf('function taskRun()'), runner.indexOf('function taskRetry()'))
  const retryBody = runner.slice(runner.indexOf('function taskRetry()'), runner.indexOf('function taskPublish()'))
  assert.match(runBody, /runExecutionPreflight\(supervisorSnapshot\(taskId\), 'implementation'\)/)
  assert.match(retryBody, /runExecutionPreflight\(/)
  assert.ok(runBody.indexOf('runExecutionPreflight') < runBody.indexOf('startExecution('))
  assert.ok(retryBody.indexOf('runExecutionPreflight') < retryBody.indexOf('startRetryExecution('))
})

test('execution preflight safety-stops a wrong control database fingerprint', () => {
  const fixture = executionPreflightFixture()
  fixture.runtime.control_database.expected_fingerprint = '0'.repeat(64)
  const result = evaluateExecutionPreflight(fixture)
  const repeated = evaluateExecutionPreflight(structuredClone(fixture))
  assert.equal(result.ready, false)
  assert.equal(result.kind, 'stop')
  assert.equal(result.next_action, 'safety-stop')
  assert.equal(result.reason, 'control_database_fingerprint_mismatch')
  assert.equal(result.fingerprint, repeated.fingerprint)
  assert.equal(fixture.executions.length, 0)
})

test('execution preflight routes repository drift to deterministic reconciliation or wait', () => {
  const behind = executionPreflightFixture()
  behind.runtime.repository.parent_commit_present = false
  assert.equal(evaluateExecutionPreflight(behind).next_action, 'reconcile-repository')

  const staleParent = executionPreflightFixture()
  staleParent.runtime.repository.parent_consistent = false
  const parentResult = evaluateExecutionPreflight(staleParent)
  assert.equal(parentResult.kind, 'wait')
  assert.equal(parentResult.reason, 'parent_branch_sha_pr_inconsistent')

  const staleWorktree = executionPreflightFixture()
  staleWorktree.runtime.repository.worktree_target.status = 'stale'
  assert.equal(evaluateExecutionPreflight(staleWorktree).reason, 'prepared_worktree_stale')

  const missingWorktree = executionPreflightFixture()
  missingWorktree.runtime.repository.worktree_target.status = 'missing'
  assert.equal(evaluateExecutionPreflight(missingWorktree).reason, 'worktree_not_prepared')

  const missingDependencies = executionPreflightFixture()
  missingDependencies.runtime.repository.dependencies_ready = false
  const dependencyResult = evaluateExecutionPreflight(missingDependencies)
  assert.equal(dependencyResult.reason, 'repository_dependencies_missing')
  assert.equal(
    dependencyResult.context.worktree_path,
    '/tmp/control-plane-cp-test-001',
  )
})

test('fresh task reconciliation prepares worktrees and deterministic dependencies', () => {
  assert.equal(
    preflightReconciliationAction({
      kind: 'reconcile',
      reason: 'worktree_not_prepared',
    }),
    'task-prepare',
  )

  assert.equal(
    preflightReconciliationAction({
      kind: 'reconcile',
      reason: 'repository_dependencies_missing',
    }),
    'prepare-dependencies',
  )

  assert.equal(
    preflightReconciliationAction({
      kind: 'wait',
      reason: 'parent_branch_sha_pr_inconsistent',
    }),
    null,
  )
})

test('execution preflight waits for hard dependencies, decisions, and serialized workstreams', () => {
  const dependency = executionPreflightFixture()
  dependency.packet.dependencies[0].status = 'in_progress'
  assert.equal(evaluateExecutionPreflight(dependency).reason, 'hard_dependency_unsatisfied')

  const decision = executionPreflightFixture()
  decision.packet.decisions[0].status = 'open'
  assert.equal(evaluateExecutionPreflight(decision).next_action, 'wait-decision')

  const serialized = executionPreflightFixture()
  serialized.serializationConflicts = [{ task_id: 'CP-TEST-002', status: 'in_progress' }]
  assert.equal(evaluateExecutionPreflight(serialized).reason, 'workstream_serialization_conflict')
})

test('execution preflight rejects incomplete contract, publication, retry, and runtime configuration', () => {
  const contract = executionPreflightFixture()
  contract.packet.task.acceptance_criteria = []
  assert.equal(evaluateExecutionPreflight(contract).reason, 'task_contract_incomplete')

  const publication = executionPreflightFixture()
  publication.packet.project.allowed_publication_paths = []
  assert.equal(evaluateExecutionPreflight(publication).failure_class, 'publication-scope')

  const policy = executionPreflightFixture()
  delete policy.packet.workstream.publication_config.merge_authorized
  assert.equal(evaluateExecutionPreflight(policy).reason, 'publication_policy_incomplete')

  const verification = executionPreflightFixture()
  verification.packet.workstream.verification_config = {}
  const verificationWait = evaluateExecutionPreflight(verification)
  assert.equal(verificationWait.failure_class, 'verification-configuration')
  assert.equal(verificationWait.context.attempt, undefined)

  const changedPath = executionPreflightFixture()
  changedPath.runtime.repository.worktree_target.changed_files = ['apps/shop-suit/app.vue']
  assert.equal(evaluateExecutionPreflight(changedPath).reason, 'publication_path_outside_project_boundary')

  const retry = executionPreflightFixture()
  retry.packet.retry_policy.attempt_profiles = ['standard']
  assert.equal(evaluateExecutionPreflight(retry).reason, 'attempt_profile_count_must_equal_max_attempts')

  const executable = executionPreflightFixture()
  executable.runtime.executables.codex = false
  assert.equal(evaluateExecutionPreflight(executable).reason, 'required_executable_missing')

  const environment = executionPreflightFixture()
  environment.runtime.environment = { valid: false, missing: ['AUTOMATION_CONTROL_DB_FINGERPRINT'] }
  assert.equal(evaluateExecutionPreflight(environment).reason, 'required_environment_configuration_missing')
})

test('execution preflight exposes boundaries and waits for missing cross-workstream authority before attempt one', () => {
  const fixture = executionPreflightFixture()
  fixture.packet.publication_boundaries = {
    task_paths: [],
    source_paths: ['packages/ui/'],
    workstream_paths: ['tooling/control-plane/'],
    project_paths: ['tooling/', 'packages/'],
  }
  fixture.packet.publication_contract.required_paths = ['packages/ui/']
  fixture.packet.publication_contract.task_paths = []
  fixture.packet.publication_contract.source_paths = ['packages/ui/']
  fixture.packet.publication_contract.workstream_paths = ['tooling/control-plane/']
  fixture.packet.publication_contract.project_paths = ['packages/', 'tooling/']
  const waiting = evaluateExecutionPreflight(fixture)
  assert.equal(waiting.kind, 'wait')
  assert.equal(waiting.reason, 'publication_exact_authorization_required')
  assert.deepEqual(waiting.context.requested_paths, ['packages/ui/'])
  assert.equal(waiting.context.publication_boundaries.effective_paths[0], 'tooling/control-plane/')
  assert.equal(waiting.context.attempt, undefined)

  fixture.packet.publication_authorizations.ordinary = [{
    authorization_kind: 'ordinary', authorized_paths: ['packages/ui/'],
  }]
  const approved = evaluateExecutionPreflight(fixture)
  assert.equal(approved.ready, true)
  assert.deepEqual(approved.context.publication_readiness.effective_paths, ['packages/ui/', 'tooling/control-plane/'])
})

test('authoritative publication migration backfills historical tasks without execution churn', async () => {
  const migration = await readFile(new URL('../sql/027_authoritative_publication_readiness.sql', import.meta.url), 'utf8')
  const smoke = await readFile(new URL('./publication-readiness-smoke.sql', import.meta.url), 'utf8')
  assert.match(migration, /publication_readiness_contracts/)
  assert.match(migration, /publication_preexecution_authorizations/)
  assert.match(migration, /SAS-M1-BOOT-001/)
  assert.match(migration, /preserve_execution_id', 245/)
  assert.match(migration, /preserve_verification_run_id', 264/)
  assert.match(migration, /SS-SA-BRIDGE-001|task\.status IN \('planned','ready','in_progress'/)
  assert.match(migration, /worker_output_used', false/)
  assert.match(migration, /project_publication_boundary_amended/)
  assert.match(migration, /protected_publication_paths_authorized/)
  assert.doesNotMatch(migration, /INSERT INTO control\.executions/)
  assert.doesNotMatch(migration, /INSERT INTO control\.verification_runs/)
  assert.match(smoke, /authorize_preexecution_publication_paths/)
  assert.match(smoke, /authorize_protected_publication_paths/)
  assert.match(smoke, /no-secrets-review/)
  assert.match(smoke, /Publication readiness consumed an implementation execution/)
})

test('publication authorization migration binds exact waits and preserves execution verification lineage', async () => {
  const migration = await readFile(new URL('../sql/022_publication_scope_authorization.sql', import.meta.url), 'utf8')
  assert.match(migration, /Authorization must match the exact current publication waiting paths/)
  assert.match(migration, /current_task\.status <> 'passed'/)
  assert.match(migration, /current_execution\.status <> 'succeeded'/)
  assert.match(migration, /latest_verification_status <> 'passed'/)
  assert.match(migration, /old_allowed_paths.*new_allowed_paths/s)
  assert.match(migration, /publication_scope_authorized/)
  assert.match(migration, /idempotency_key text NOT NULL UNIQUE/)
  assert.doesNotMatch(migration, /\bauthorization\s+control\.publication_scope_authorizations%ROWTYPE\s*;/i)
  assert.doesNotMatch(migration, /\bauthorization\s*\.\s*authorization_id\b/i)
  assert.doesNotMatch(migration, /INSERT INTO control\.executions/)
  assert.doesNotMatch(migration, /INSERT INTO control\.verification_runs/)
})

test('execution preflight enforces attempt budget without consuming an attempt', () => {
  const fixture = executionPreflightFixture()
  fixture.packet.retry_policy = {
    policy_id: 'one-shot',
    max_attempts: 1,
    attempt_profiles: ['standard'],
  }
  fixture.executions = [{ execution_id: 1, attempt: 1, status: 'failed' }]
  const before = structuredClone(fixture.executions)
  const result = evaluateExecutionPreflight(fixture)
  assert.equal(result.reason, 'retry_budget_exhausted')
  assert.deepEqual(fixture.executions, before)
})

test('supervisor lease SQL returns the UPDATE target alias safely', async () => {
  const runner = await readFile(new URL('../runner/bs-agent.mjs', import.meta.url), 'utf8')
  const leaseSql = runner.slice(
    runner.indexOf('function acquireSupervisorLease'),
    runner.indexOf('function activeSupervisorLease'),
  )

  assert.match(
    leaseSql,
    /UPDATE control\.recovery_states AS recovery_state/,
  )
  assert.match(
    leaseSql,
    /RETURNING to_jsonb\(recovery_state\) AS recovery/,
  )
  assert.doesNotMatch(
    leaseSql,
    /to_jsonb\(control\.recovery_states\)/,
  )
})

test('supervisor self-heals fresh worktrees, dependencies, and dead local leases', async () => {
  const runner = await readFile(new URL('../runner/bs-agent.mjs', import.meta.url), 'utf8')
  const supervisor = runner.slice(
    runner.indexOf('function taskSupervisor()'),
    runner.indexOf('function taskEngine()'),
  )

  assert.match(runner, /function reclaimDeadLocalSupervisorLease/)
  assert.match(runner, /process\.kill\(pid, 0\)/)
  assert.match(runner, /dead_local_lease_reclaimed_at/)
  assert.match(supervisor, /preflightReconciliationAction\(preflight\)/)
  assert.match(supervisor, /invokeTaskAction\('task-prepare', taskId\)/)
  assert.match(supervisor, /prepareTaskDependencies/)
  assert.match(
    supervisor,
    /snapshot\.packet\?\.preparation\?\.worktree\?\.worktree_path/,
  )
  assert.match(runner, /--frozen-lockfile/)
  assert.match(runner, /--prefer-offline/)
})

test('supervisor gates token-bearing implementation actions with audited preflight', async () => {
  const { readFile } = await import('node:fs/promises')
  const runner = await readFile(new URL('../runner/bs-agent.mjs', import.meta.url), 'utf8')
  const supervisor = runner.slice(runner.indexOf('function taskSupervisor()'), runner.indexOf('function taskEngine()'))
  assert.match(supervisor, /\['task-run', 'task-retry'\]\.includes\(plan\.command\)/)
  assert.ok(supervisor.indexOf('runExecutionPreflight(') < supervisor.indexOf('invokeTaskAction(plan.command, taskId)'))
  assert.match(supervisor, /idempotencyKey: `preflight:\$\{preflight\.fingerprint\}`/)
})
