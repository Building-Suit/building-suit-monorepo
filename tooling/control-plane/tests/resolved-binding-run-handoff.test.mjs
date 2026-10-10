import {runSupervisorLifecycle} from '../runner/lifecycle-policy.mjs'
import path from 'node:path'
import {isolateRecoveryCandidates,recoveryErrorEnvelope} from '../runner/recovery-error.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

// Exercise the real run-recover entry point with inert database/process adapters.
// No SQL, credential access or product process is executed by this regression.
const source = readFileSync(new URL('../runner/bs-agent.mjs', import.meta.url), 'utf8')
const start = source.indexOf('function recoverWorkflowRun() {')
const end = source.indexOf('\nfunction taskReaccept()', start)
assert.ok(start >= 0 && end > start)
const entryPoint = source.slice(start, end)
const runId = 'cfa4064b-44b7-47bf-a3d9-5382fcc298cf'
const taskId = 'BS-SA-SHELL-001'

async function recover({ runGate = 'continue', authority = 'current', acquisitionGate = null } = {}) {
  const history = {
    run: { run_id: runId, current_task_id: taskId, completed_tasks: 0, max_tasks: 2 },
    task: { task_id: taskId, status: 'in_progress' },
    executions: [],
    recovery: { status: 'resolved', error_code: 'executable_bindings_reconciled', next_action: 'retry' },
    max_attempts: 5,
  }
  const before = JSON.stringify(history)
  const calls = []
  const responses = []
  let contractCurrent = false
  const context = {
    path,mkdirSync:()=>{},runSupervisorLifecycle,recoveryErrorEnvelope, args: [runId],
    adoptRunRecovery: () => calls.push('adopt'),
    reconcileNativeAdmission: () => null,
    validRunId: value => value === runId,
    parseControlJson: value => value,
    parseJson: value => JSON.parse(value),
    isolateRecoveryCandidates,
    process: { execPath: '/inert/node', env: {BS_RUN_SUPERVISOR_LOCKED:'1'} },
    agentScriptPath: '/inert/bs-agent.mjs',
    repoRoot: '/inert/repository',
    output: (value, code = 0) => responses.push({ value, code }),
    controlQuery(sql, bindings) {
      if(sql.includes('control.reconcile_lifecycle_incidents(')){assert.equal(bindings.run,runId);return {resolved:0}}
      if (sql.includes('control.workflow_run_gate(')) {
        assert.equal(bindings.id, runId)
        calls.push('gate')
        return { should_continue: runGate === 'continue', reason: runGate }
      }
      if (sql.includes('control.reconcile_ordinary_run_publication(')) {
        assert.equal(bindings.run, runId)
        calls.push('reconcile')
        if (authority === 'scope_changed') throw new Error('Frozen task scope changed or unauthorized task')
        contractCurrent = authority === 'current'
        return { authorized: contractCurrent }
      }
      if (sql.includes('control.acquire_workflow_run_task(')) {
        assert.equal(bindings.id, runId)
        assert.equal(bindings.token, `selfheal:${runId}`)
        calls.push('acquire')
        if (acquisitionGate) return acquisitionGate
        if (!contractCurrent) return { acquired: false, action: 'safety_stop', reason: 'ordinary_claim_missing_or_stale' }
        return { acquired: true, action: 'resume', task_id: taskId }
      }
      if(sql.includes('control.park_unattended_queue_task('))return false
      throw new Error(`Unexpected database operation: ${sql}`)
    },
    execute(program, argv) {
      calls.push('supervise')
      assert.equal(program, '/inert/node')
      assert.deepEqual(Array.from(argv), ['/inert/bs-agent.mjs', 'task-supervise', taskId])
      // The ordinary supervisor retains ownership of preflight and execution.
      return { stdout: JSON.stringify({ ok: true, status: 'wait', recovery: { reason: 'preflight_pending' } }) }
    },
  }
  await runInNewContext(`${entryPoint}\nrecoverWorkflowRun()`, context)
  assert.equal(JSON.stringify(history), before, 'run, task, execution and retry history must remain intact')
  return { calls, responses }
}

test('resolved bindings refresh existing run contracts before acquisition and ordinary supervision', async () => {
  for (let replay = 0; replay < 2; replay++) {
    const result = await recover()
    assert.deepEqual(result.calls, ['gate', 'adopt', 'reconcile', 'acquire', 'supervise'])
    assert.equal(result.responses[0].value.run_id, runId)
    assert.equal(result.responses[0].value.task_id, taskId)
    assert.equal(result.responses[0].value.response.recovery.reason, 'preflight_pending')
  }
})

test('stopped, held, terminal and limit-reached runs never reconcile or dispatch', async () => {
  for (const runGate of ['stop_requested', 'maintenance_requested', 'failed', 'limit_reached']) {
    const result = await recover({ runGate })
    assert.deepEqual(result.calls, ['gate'])
    assert.equal(result.responses[0].value.status, runGate)
  }
})

test('absent or revoked ordinary authority cannot dispatch through reconciliation', async () => {
  for (const authority of ['absent', 'revoked']) {
    const result = await recover({ authority })
    assert.deepEqual(result.calls, ['gate', 'adopt', 'reconcile', 'acquire'])
    assert.equal(result.responses[0].value.acquisition.action, 'safety_stop')
  }
  const changed = await recover({ authority: 'scope_changed' })
  assert.deepEqual(changed.calls, ['gate', 'adopt', 'reconcile'])
  assert.equal(changed.responses[0].code, 1)
  assert.equal(changed.responses[0].value.error, 'Frozen task scope changed or unauthorized task')
})

test('controller contention, dependency and decision gates remain authoritative after refresh', async () => {
  for (const acquisitionGate of [
    { acquired: false, action: 'wait_for_owner', reason: 'controller_lease_active' },
    { acquired: false, action: 'wait', reason: 'dependency_wait' },
    { acquired: false, action: 'wait', reason: 'decision_wait' },
    { acquired: false, action: 'safety_stop', reason: 'attributed_claim_missing_or_stale' },
  ]) {
    const result = await recover({ acquisitionGate })
    assert.deepEqual(result.calls, ['gate', 'adopt', 'reconcile', 'acquire'])
    assert.equal(result.responses[0].value.acquisition.reason, acquisitionGate.reason)
  }
})
