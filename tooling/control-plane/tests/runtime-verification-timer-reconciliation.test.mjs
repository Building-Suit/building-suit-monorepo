import {requiresWatchdogAction,cycleEvidenceCache} from '../runner/dot-current-state.mjs'
import {isolateRecoveryCandidates,recoveryErrorEnvelope} from '../runner/recovery-error.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { classifyHealth } from '../runner/dot-health-state.mjs'
import { needsRecovery } from '../runner/dot-general-recovery.mjs'
import { localReceiptWatchObservation } from '../runner/external-state-watcher.mjs'
import { planSupervisorStep, supervisorStateFingerprint } from '../runner/task-supervisor.mjs'
import { runWakeEligibility, retryWithoutProductAttempt } from '../runner/selfhealing.mjs'
import { incidentIdentity } from '../runner/dot.mjs'
import { currentExecution, reviewedProductFailure } from '../runner/recovery-evidence.mjs'
import { operationHasAuthoritativeSuccess } from '../runner/bounded-publication.mjs'
import { requiresSameAttemptVerification } from '../runner/binding-recovery.mjs'

const now = Date.now()
const past = new Date(now - 20 * 60_000).toISOString()
const future = new Date(now + 20 * 60_000).toISOString()
const source = readFileSync(new URL('../runner/bs-agent.mjs', import.meta.url), 'utf8')
const watchSource = source.slice(source.indexOf('async function recoveryWatch()'), source.indexOf('function recoverWorkflowRun()'))
const actionSource = source.slice(source.indexOf('function invokeTaskAction('), source.indexOf('function handleNoPublishableChanges('))

function fixture(reason = 'runtime_operation_in_flight', status = 'in_progress') {
  const run = { run_id: 'cfa4064b-44b7-47bf-a3d9-5382fcc298cf', current_task_id: 'BS-LAUNCH-ACCESS-UI-001', status: 'running', workstream_slug: 'shared', completed_tasks: 1, max_tasks: 2 }
  return {
    workflow_run: run,
    packet: { task: { task_id: run.current_task_id, status }, retry_policy: { max_attempts: 3 } },
    executions: [{ execution_id: 310, attempt: 1, status: 'succeeded', started_at: past, finished_at: past }],
    verification_runs: status === 'failed' ? [{ verification_run_id: 311, execution_id: 310, status: 'failed', finished_at: past }] : [],
    recovery: { status: 'active', recoverable: true, next_action: 'wait-external', failure_class: 'transient-infrastructure', error_code: reason, next_wake_at: past, condition: { reason } },
    runtime_operations: [{ operation_id: '6301f1a0-7777-4188-b498-8779fe408241', action: 'task-verify', execution_id: 310, status: 'pending', infra_retries: 0, next_wake_at: past }],
  }
}

function health(state) {
  return classifyHealth({ run: state.workflow_run, task: state.packet.task, execution: state.executions.at(-1), verification: state.verification_runs.at(-1), recovery: state.recovery, operation: state.runtime_operations.at(-1), policy: state.packet.retry_policy }, { worker_alive: false }, now)
}

// Evaluate the actual orchestration with inert adapters. No control database,
// product task, credential file, receipt directory or provider is accessed.
async function cycle(state, { observed = health(state), locked = false, scopeHeld = false } = {}) {
  const queries = [], launches = [], outputs = []
  let investigations = 0
  const watch = runInNewContext(`(${watchSource.trim()})`, {
    isolateRecoveryCandidates,recoveryErrorEnvelope,requiresWatchdogAction,cycleEvidenceCache,recordEgress:()=>{},fetch:async()=>({ok:true}),AbortSignal,
    currentStateSql:()=> 'SELECT compact_state',classifyCurrent:()=>[observed],
    process: { execPath: process.execPath, env: {BS_DOT_WATCH_LOCKED: '1'} }, path,
    repoRoot: '/fixture', controlSourceRoot: '/runtime', agentScriptPath: '/runtime/bs-agent.mjs',
    supervisorSnapshot: () => structuredClone(state), parseControlJson: value => value,
    controlQuery: (sql, values) => {
      queries.push({ sql, values })
      if (sql.includes('WITH ready')) return {inputs:[{run:structuredClone(state.workflow_run),task:state.packet.task,verification:state.verification_runs?.at(-1)}],event_watermark:0,cleanup_due:false}
      if (sql.includes('reconcile_native_reacceptance_gate')) return { reconciled: false }
      if (sql.includes('SELECT snapshot FROM control.dot_health_current')) return observed
      if (sql.includes('reconcile_shared_retry_exhaustion')) return {}
      if (sql.includes('SELECT to_jsonb(r) FROM control.workflow_runs')) return structuredClone(state.workflow_run)
      if (sql.includes('reconcile_ordinary_run_publication') && scopeHeld) throw Error('publication_scope_requires_operator')
      if (sql.includes("jsonb_build_object('due'")) return { due: false }
      return null
    },
    execute: (program, args) => {
      assert.equal(program, process.execPath)
      assert.ok(args[0].endsWith('/dot-health-collector.mjs'))
      return { code: 0 }
    },
    needsRecovery, localReceiptWatchObservation, planSupervisorStep, runWakeEligibility, incidentIdentity,
    dispatchRecovery: async () => { investigations++; return { claimed: false, reason: 'incident_owned' } },
    mkdirSync: () => {}, receiptLocked: () => locked,
    spawn: (program, args) => { launches.push({ program, args: Array.from(args) }); return { pid: 1234, unref() {} } },
    output: value => outputs.push(value),
  })
  await watch()
  assert.equal(outputs.length, 1)
  assert.equal(outputs[0].ok, true, outputs[0].error)
  return { investigations, launches, queries }
}

for (const reason of ['runtime_operation_in_flight', 'runtime_backoff_pending', 'malformed_child_response']) {
  for (const status of ['in_progress', 'verification', 'failed']) {
    test(`overdue ${reason} at ${status} reenters verification on the same run after restart`, async () => {
      const state = fixture(reason, status)
      const before = JSON.stringify(state)
      assert.equal(health(state).state, 'STUCK')
      assert.equal(needsRecovery(health(state), now), true)
      for (let restart = 0; restart < 2; restart++) {
        const result = await cycle(state)
        assert.equal(result.investigations, 0)
        assert.equal(result.launches.length, 1)
        assert.equal(result.launches[0].program, 'flock')
        assert.equal(result.launches[0].args[0], '-n')
        assert.deepEqual(result.launches[0].args.slice(-3), ['/runtime/bs-agent.mjs', 'run-recover', state.workflow_run.run_id])
        assert.ok(!result.queries.some(q => /UPDATE control\.(executions|tasks|workflow_runs)|claim_runtime_operation/.test(q.sql)))
      }
      const plan = planSupervisorStep(state)
      assert.equal(plan.command, 'task-verify')
      assert.equal(plan.execution.execution_id, 310)
      assert.equal(plan.operation.operation_id, state.runtime_operations[0].operation_id)
      assert.equal(JSON.stringify(state), before)
    })
  }
}

test('verification receipt routing retains timers, locks, worker, scope and bounded-run gates', async () => {
  for (const change of ['backoff', 'lock', 'worker', 'stop', 'maintenance', 'limit', 'scope']) {
    const state = fixture()
    const options = {}
    if (change === 'backoff') state.runtime_operations[0].next_wake_at = future
    if (change === 'lock') options.locked = true
    if (change === 'worker') options.observed = { ...health(state), worker_alive: true }
    if (change === 'stop') state.workflow_run.stop_requested = true
    if (change === 'maintenance') state.workflow_run.maintenance_requested = true
    if (change === 'limit') state.workflow_run.completed_tasks = 2
    if (change === 'scope') options.scopeHeld = true
    const result = await cycle(state, options)
    assert.equal(result.investigations, 0, change)
    assert.equal(result.launches.length, 0, change)
  }
})

test('human, decision and safety waits never become automatic verification', async () => {
  for (const next_action of ['wait-operator', 'wait-decision', 'safety-stop']) {
    const state = fixture()
    state.recovery.next_action = next_action
    state.recovery.condition.fingerprint = supervisorStateFingerprint(state)
    const result = await cycle(state)
    assert.equal(result.investigations, 0)
    assert.equal(result.launches.length, 0)
  }
})

test('unknown waits and absent or unrelated operations still use incident investigation', async () => {
  for (const change of ['unknown', 'missing', 'consumed', 'retry', 'inactive', 'unrecoverable', 'failed-run']) {
    const state = fixture()
    if (change === 'unknown') state.recovery.error_code = 'unknown_receipt_state'
    if (change === 'missing') state.runtime_operations = []
    if (change === 'consumed') state.runtime_operations[0].status = 'consumed'
    if (change === 'retry') state.runtime_operations[0].action = 'task-retry'
    if (change === 'inactive') state.recovery.status = 'resolved'
    if (change === 'unrecoverable') state.recovery.recoverable = false
    if (change === 'failed-run') {
      state.workflow_run.status = 'failed'
      state.packet.task.status = 'failed'
    }
    const result = await cycle(state)
    assert.equal(result.investigations, 1, change)
    assert.equal(result.launches.length, 0, change)
  }
})

test('ordinary receipt reconciliation consumes settled verification without rewriting history or accepting failures', () => {
  for (const passed of [false, true]) {
    const state = fixture('runtime_operation_in_flight', passed ? 'passed' : 'failed')
    state.verification_runs = [{ verification_run_id: 311, execution_id: 310, status: passed ? 'passed' : 'failed' }]
    const classification = { failure_class: 'verification-product-defect', recovery_action: 'repair' }
    if (!passed) state.failures = [{ failure_id: 312, execution_id: 310, resolved_at: null, metadata: { classification } }]
    const before = JSON.stringify(state)
    const writes = []
    const invoke = runInNewContext(`(${actionSource.trim()})`, {
      supervisorSnapshot: () => structuredClone(state), operationHasAuthoritativeSuccess, requiresSameAttemptVerification, reviewedProductFailure,
      currentExecution, retryWithoutProductAttempt,
      controlQuery: (sql, values) => { writes.push({ sql, values }) },
    })
    const outcome = invoke('task-verify', state.packet.task.task_id)
    assert.equal(outcome.payload.ok, passed)
    assert.equal(outcome.payload.replayed_authoritative_state, true)
    assert.equal(outcome.result.code, passed ? 0 : 1)
    if (!passed) assert.deepEqual(outcome.payload.classification, classification)
    assert.equal(writes.length, 1)
    assert.match(writes[0].sql, /control\.set_runtime_operation_outcome\([^;]+,'consumed'/)
    assert.equal(writes[0].values.id, state.runtime_operations[0].operation_id)
    assert.equal(JSON.stringify(state), before)
  }
})
