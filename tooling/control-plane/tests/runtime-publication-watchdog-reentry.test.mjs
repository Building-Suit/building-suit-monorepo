import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { classifyHealth } from '../runner/dot-health-state.mjs'
import { needsRecovery } from '../runner/dot-general-recovery.mjs'
import { localReceiptWatchObservation } from '../runner/external-state-watcher.mjs'
import { planSupervisorStep, supervisorStateFingerprint } from '../runner/task-supervisor.mjs'
import { runWakeEligibility } from '../runner/selfhealing.mjs'
import { incidentIdentity } from '../runner/dot.mjs'

const now = Date.now()
const past = new Date(now - 10 * 60_000).toISOString()
const future = new Date(now + 10 * 60_000).toISOString()
const source = readFileSync(new URL('../runner/bs-agent.mjs', import.meta.url), 'utf8')
const entryPoint = source.slice(source.indexOf('async function recoveryWatch()'), source.indexOf('function recoverWorkflowRun()'))

function fixture(reason = 'runtime_operation_in_flight') {
  const run = { run_id: 'cfa4064b-44b7-47bf-a3d9-5382fcc298cf', current_task_id: 'BS-SA-SHELL-001', status: 'running', workstream_slug: 'shared', completed_tasks: 0, max_tasks: 2 }
  return {
    packet: {
      task: { task_id: run.current_task_id, status: 'passed' },
      project: { github_repository: 'Building-Suit/building-suit-monorepo' },
      retry_policy: { max_attempts: 5 },
    },
    workflow_run: run,
    executions: [{ execution_id: 309, attempt: 5, status: 'failed', started_at: past, finished_at: past }],
    verification_runs: [{ verification_run_id: 310, execution_id: 309, status: 'passed', finished_at: past, metadata: { verifier_only_reacceptance: true } }],
    recovery: { status: 'active', recoverable: true, next_action: 'wait-external', error_code: reason, next_wake_at: past, condition: { reason } },
    runtime_operations: [{ operation_id: 'same-publication-operation', action: 'task-publish', execution_id: 309, status: 'pending', infra_retries: 1, next_wake_at: past }],
  }
}

function health(state) {
  return classifyHealth({
    run: state.workflow_run, task: state.packet.task, execution: state.executions.at(-1),
    verification: state.verification_runs.at(-1), recovery: state.recovery,
    operation: state.runtime_operations.at(-1), policy: state.packet.retry_policy,
  }, { worker_alive: false }, now)
}

// Run the actual watchdog orchestration. Every DB write, process launch and
// filesystem action is captured; no product task, credential or provider runs.
async function cycle(state, { observed = health(state), locked = false, scopeHeld = false } = {}) {
  const launches = [], queries = [], outputs = []
  let investigations = 0
  const watch = runInNewContext(`(${entryPoint.trim()})`, {
    process: { execPath: process.execPath, env: {BS_DOT_WATCH_LOCKED: '1'} }, path,
    repoRoot: '/disposable-watchdog-fixture', controlSourceRoot: '/disposable-runtime',
    agentScriptPath: '/disposable-runtime/bs-agent.mjs',
    supervisorSnapshot: () => structuredClone(state),
    parseControlJson: value => value,
    controlQuery: (sql, values) => {
      queries.push({ sql, values })
      if (sql.includes('jsonb_agg(to_jsonb(r))')) return [structuredClone(state.workflow_run)]
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
    needsRecovery, localReceiptWatchObservation, planSupervisorStep, runWakeEligibility,
    dispatchRecovery: async () => { investigations++; return { claimed: false, reason: 'incident_owned' } },
    incidentIdentity,
    mkdirSync: () => {}, receiptLocked: () => locked,
    spawn: (program, args) => { launches.push({ program, args }); return { pid: 1234, unref() {} } },
    output: value => outputs.push(value),
  })
  await watch()
  assert.equal(outputs.length, 1)
  assert.equal(outputs[0].ok, true, outputs[0].error)
  return { investigations, launches, queries, outcomes: outputs[0].outcomes }
}

for (const reason of ['runtime_operation_in_flight', 'runtime_backoff_pending', 'malformed_child_response']) {
  test(`overdue ${reason} polls publication via the ordinary same-run supervisor`, async () => {
    const state = fixture(reason)
    const before = JSON.stringify(state)
    assert.equal(health(state).state, 'STUCK')
    assert.equal(needsRecovery(health(state), now), true)
    // An owned/queued incident previously caused an unconditional continue,
    // preventing receipt consumption on every watchdog cycle and after restart.
    for (let restart = 0; restart < 2; restart++) {
      const result = await cycle(state)
      assert.equal(result.investigations, 0)
      assert.equal(result.launches.length, 1)
      assert.deepEqual(Array.from(result.launches[0].args).slice(-3), ['/disposable-runtime/bs-agent.mjs', 'run-recover', state.workflow_run.run_id])
      assert.equal(result.launches[0].program, 'flock')
      assert.equal(result.launches[0].args[0], '-n')
      assert.ok(result.queries.some(q => q.sql.includes('reconcile_ordinary_run_publication')))
      assert.ok(!result.queries.some(q => /UPDATE control\.(executions|tasks|workflow_runs)|claim_runtime_operation/.test(q.sql)))
    }
    assert.equal(JSON.stringify(state), before)
    assert.equal(planSupervisorStep(state).operation.operation_id, 'same-publication-operation')
    assert.equal(planSupervisorStep(state).execution.execution_id, 309)
  })
}

test('receipt reentry retains backoff, controller lock, worker and run gates', async () => {
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

test('current human/decision/safety gates retain ordinary eligibility and never launch', async () => {
  for (const reason of ['publication_scope_requires_operator', 'runtime_operation_in_flight']) {
    for (const next_action of ['wait-operator', 'wait-decision', 'safety-stop']) {
      const state = fixture(reason)
      state.recovery.next_action = next_action
      state.recovery.condition.fingerprint = supervisorStateFingerprint(state)
      const result = await cycle(state)
      assert.equal(result.investigations, 0)
      assert.equal(result.launches.length, 0)
    }
  }
})

test('unknown waits and missing/consumed/different operations retain incident investigation', async () => {
  for (const change of ['unknown', 'missing', 'consumed', 'different', 'inactive', 'unrecoverable', 'failed-run']) {
    const state = fixture()
    if (change === 'unknown') state.recovery.error_code = 'repository_state_unavailable'
    if (change === 'missing') state.runtime_operations = []
    if (change === 'consumed') state.runtime_operations[0].status = 'consumed'
    if (change === 'different') state.runtime_operations[0].action = 'task-retry'
    if (change === 'inactive') state.recovery.status = 'resolved'
    if (change === 'unrecoverable') state.recovery.recoverable = false
    if (change === 'failed-run') state.workflow_run.status = 'failed'
    const result = await cycle(state)
    assert.equal(result.investigations, 1, change)
    assert.equal(result.launches.length, 0, change)
  }
})
