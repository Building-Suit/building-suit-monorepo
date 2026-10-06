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
import { currentExecution } from '../runner/recovery-evidence.mjs'
import { operationHasAuthoritativeSuccess } from '../runner/bounded-publication.mjs'
import { requiresSameAttemptVerification } from '../runner/binding-recovery.mjs'

const now = Date.now()
const past = new Date(now - 20 * 60_000).toISOString()
const future = new Date(now + 20 * 60_000).toISOString()
const source = readFileSync(new URL('../runner/bs-agent.mjs', import.meta.url), 'utf8')
const watchSource = source.slice(source.indexOf('async function recoveryWatch()'), source.indexOf('function recoverWorkflowRun()'))
const actionSource = source.slice(source.indexOf('function invokeTaskAction('), source.indexOf('function handleNoPublishableChanges('))

function fixture(reason = 'runtime_operation_in_flight') {
  const run = { run_id: '06124632-a51d-4d08-bb62-ee4e8cedb9dc', current_task_id: 'SS-LAUNCH-TEAM-001', status: 'running', workstream_slug: 'shop-suit', completed_tasks: 2, max_tasks: 14 }
  return {
    workflow_run: run,
    packet: { task: { task_id: run.current_task_id, status: 'in_progress' }, retry_policy: { max_attempts: 3 } },
    executions: [{ execution_id: 312, attempt: 1, status: 'succeeded', started_at: past, finished_at: past }],
    verification_runs: [],
    recovery: { status: 'active', recoverable: true, next_action: 'wait-external', failure_class: 'transient-infrastructure', error_code: reason, next_wake_at: past, condition: { reason }, metadata: { child_command: 'task-run', child_exit_code: 0 } },
    runtime_operations: [{ operation_id: 'implementation-receipt', action: 'task-run', execution_id: 312, status: 'pending', infra_retries: 0, next_wake_at: past, descriptor: { previous_execution_id: 311 } }],
  }
}

function health(state) {
  return classifyHealth({ run: state.workflow_run, task: state.packet.task, execution: state.executions.at(-1), recovery: state.recovery, operation: state.runtime_operations.at(-1), policy: state.packet.retry_policy }, { worker_alive: false }, now)
}

// Evaluate the real watchdog with inert adapters. All writes and launches are
// captured: no database, credentials, product tasks or receipt files are used.
async function cycle(state, { observed = health(state), locked = false, scopeHeld = false } = {}) {
  const queries = [], launches = [], outputs = []
  let investigations = 0
  const watch = runInNewContext(`(${watchSource.trim()})`, {
    process: { execPath: process.execPath, env: { BS_DOT_WATCH_LOCKED: '1' } }, path,
    repoRoot: '/fixture', controlSourceRoot: '/runtime', agentScriptPath: '/runtime/bs-agent.mjs',
    supervisorSnapshot: () => structuredClone(state), parseControlJson: value => value,
    controlQuery: (sql, values) => {
      queries.push({ sql, values })
      if (sql.includes('jsonb_agg(to_jsonb(r))')) return [structuredClone(state.workflow_run)]
      if (sql.includes('reconcile_native_reacceptance_gate')) return { reconciled: false }
      if (sql.includes('SELECT snapshot FROM control.dot_health_current')) return observed
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
  test(`overdue implementation ${reason} polls the same run across watchdog restarts`, async () => {
    const state = fixture(reason)
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
      assert.ok(result.queries.some(q => q.sql.includes('reconcile_ordinary_run_publication')))
      assert.ok(!result.queries.some(q => /UPDATE control\.(executions|tasks|workflow_runs)|claim_runtime_operation/.test(q.sql)))
    }
    const plan = planSupervisorStep(state)
    assert.equal(plan.command, 'task-run')
    assert.equal(plan.execution.execution_id, 312)
    assert.equal(plan.operation.operation_id, 'implementation-receipt')
    assert.equal(JSON.stringify(state), before)
  })
}

test('implementation polling preserves timers, live worker, run lock and ordinary run gates', async () => {
  for (const change of ['backoff', 'lock', 'worker', 'stop', 'maintenance', 'limit', 'scope']) {
    const state = fixture()
    const options = {}
    if (change === 'backoff') state.runtime_operations[0].next_wake_at = future
    if (change === 'lock') options.locked = true
    if (change === 'worker') options.observed = { ...health(state), worker_alive: true }
    if (change === 'stop') state.workflow_run.stop_requested = true
    if (change === 'maintenance') state.workflow_run.maintenance_requested = true
    if (change === 'limit') state.workflow_run.completed_tasks = 14
    if (change === 'scope') options.scopeHeld = true
    const result = await cycle(state, options)
    assert.equal(result.investigations, 0, change)
    assert.equal(result.launches.length, 0, change)
  }
})

test('human, decision and safety waits never launch implementation polling', async () => {
  for (const next_action of ['wait-operator', 'wait-decision', 'safety-stop']) {
    const state = fixture()
    state.recovery.next_action = next_action
    state.recovery.condition.fingerprint = supervisorStateFingerprint(state)
    const result = await cycle(state)
    assert.equal(result.investigations, 0)
    assert.equal(result.launches.length, 0)
  }
})

test('unknown or missing receipts and product retry operations retain investigation', async () => {
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

test('settled implementation replay consumes only the receipt and retains product failure evidence', () => {
  for (const passed of [false, true]) {
    const state = fixture()
    state.executions[0].status = passed ? 'succeeded' : 'failed'
    state.packet.task.status = passed ? 'in_progress' : 'failed'
    const classification = { failure_class: 'verification-product-defect', recovery_action: 'repair' }
    if (!passed) state.failures = [{ failure_id: 313, execution_id: 312, resolved_at: null, metadata: { classification } }]
    const before = JSON.stringify(state)
    const writes = []
    const invoke = runInNewContext(`(${actionSource.trim()})`, {
      supervisorSnapshot: () => structuredClone(state), operationHasAuthoritativeSuccess, requiresSameAttemptVerification,
      currentExecution, retryWithoutProductAttempt,
      controlQuery: (sql, values) => { writes.push({ sql, values }) },
    })
    const outcome = invoke('task-run', state.packet.task.task_id)
    assert.equal(outcome.payload.ok, passed)
    assert.equal(outcome.payload.replayed_authoritative_state, true)
    assert.equal(outcome.result.code, passed ? 0 : 1)
    if (!passed) assert.deepEqual(outcome.payload.classification, classification)
    assert.equal(writes.length, 1)
    assert.match(writes[0].sql, /UPDATE control\.runtime_operations SET status='consumed'/)
    assert.equal(writes[0].values.id, 'implementation-receipt')
    assert.equal(JSON.stringify(state), before)
  }
})
