import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { runResilienceAcceptance } from '../resilience/acceptance.mjs'
import { inspectWorkflowSnapshot, normalizeWorkflow, validateControllerReplacements, workflowGraphSummary } from '../lib/n8n-workflows.mjs'
import { continuousRunTransition, normalizeSupervisorResult, resumeSchedule } from '../lib/n8n-controller.mjs'
import { validateProjectConfig } from '../lib/project-config.mjs'
import { redact } from '../lib/redaction.mjs'
import { profileForAttempt, retryDecision, validateRetryPolicy } from '../lib/retry-policy.mjs'
import {
  classifySupervisorFailure,
  planSupervisorStep,
  preflightReconciliationAction,
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
  commandResultStatus,
  customCheckSelection,
  resolveVerificationMode,
} from '../runner/verification-mode.mjs'
import {
  classifyPublicationFiles,
  evaluatePublicationParent,
  evaluateVerificationAuthority,
  planPublicationReconciliation,
  publicationStateFingerprint,
} from '../runner/publication-preflight.mjs'

test('publication preflight classifies task, workstream, bounded repair, and unrelated scope', () => {
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

  assert.equal(classification.decisions.find(item => item.file.endsWith('task-publisher.mjs')).boundary, 'task')
  assert.deepEqual(classification.repaired, [
    'docs/shared/publication.md',
    'tooling/control-plane/runner/publication-preflight.mjs',
  ])
  assert.deepEqual(classification.waiting, ['apps/shop-suit/app.vue', 'tooling/control-plane/import/unrelated.md'])
  assert.deepEqual(classification.blocked, ['README.md'])
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

  assert.match(migration, /verification_mode text NOT NULL DEFAULT 'focused'/)
  assert.match(migration, /IF existing_id IS NOT NULL THEN\s+RETURN existing_id;/)
  assert.match(migration, /metadata->>'verification_mode'/)
  assert.match(runner, /if \(!verificationRun\.resumed\)/)
  assert.match(runner, /verification_mode:\s+verificationMode/)
  assert.match(
    runner,
    /WHERE verification_run_id = \(\s*SELECT verification_run_id\s*FROM control\.verification_runs\s*WHERE execution_id = :'execution_id'::bigint\s*ORDER BY verification_run_id DESC/,
  )
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
      ? [{ verification_run_id: 71, execution_id: 41, status: verificationStatus }]
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
  assert.ok(supervisor.indexOf('evaluateSupervisorParentSatisfaction') < supervisor.indexOf('runExecutionPreflight(snapshot)'))
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
        verification_plan: ['Run focused tests.'],
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
      },
      dependencies: [{ task_id: 'CP-TEST-000', dependency_type: 'hard', status: 'complete' }],
      decisions: [{ id: 'CP-D01', blocking: true, status: 'approved' }],
      retry_policy: {
        policy_id: 'critical-five',
        max_attempts: 5,
        attempt_profiles: ['standard', 'standard', 'deep', 'deep', 'deep'],
      },
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

  const changedPath = executionPreflightFixture()
  changedPath.runtime.repository.worktree_target.changed_files = ['apps/shop-suit/app.vue']
  assert.equal(evaluateExecutionPreflight(changedPath).reason, 'worktree_change_outside_publication_scope')

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
  assert.ok(supervisor.indexOf('runExecutionPreflight(snapshot)') < supervisor.indexOf('invokeTaskAction(plan.command, taskId)'))
  assert.match(supervisor, /idempotencyKey: `preflight:\$\{preflight\.fingerprint\}`/)
})
