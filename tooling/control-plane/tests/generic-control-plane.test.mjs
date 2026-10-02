import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { inspectWorkflowSnapshot, normalizeWorkflow, workflowGraphSummary } from '../lib/n8n-workflows.mjs'
import { validateProjectConfig } from '../lib/project-config.mjs'
import { redact } from '../lib/redaction.mjs'
import { profileForAttempt, retryDecision, validateRetryPolicy } from '../lib/retry-policy.mjs'
import {
  classifySupervisorFailure,
  planSupervisorStep,
  supervisorResumeIdentity,
} from '../runner/task-supervisor.mjs'
import {
  evaluateExecutionPreflight,
  fingerprint,
} from '../runner/task-preflight.mjs'
import {
  applicationScopeSelected,
  commandResultStatus,
  customCheckSelection,
  resolveVerificationMode,
} from '../runner/verification-mode.mjs'

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

test('supervisor gates token-bearing implementation actions with audited preflight', async () => {
  const { readFile } = await import('node:fs/promises')
  const runner = await readFile(new URL('../runner/bs-agent.mjs', import.meta.url), 'utf8')
  const supervisor = runner.slice(runner.indexOf('function taskSupervisor()'), runner.indexOf('function taskEngine()'))
  assert.match(supervisor, /\['task-run', 'task-retry'\]\.includes\(plan\.command\)/)
  assert.ok(supervisor.indexOf('runExecutionPreflight(snapshot)') < supervisor.indexOf('invokeTaskAction(plan.command, taskId)'))
  assert.match(supervisor, /idempotencyKey: `preflight:\$\{preflight\.fingerprint\}`/)
})
