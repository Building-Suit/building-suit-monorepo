import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { recoveryErrorEnvelope } from '../runner/recovery-error.mjs'
import { planSupervisorStep } from '../runner/task-supervisor.mjs'
import { runSupervisorLifecycle } from '../runner/lifecycle-policy.mjs'
import { handoffRecovery } from '../runner/dot-general-recovery.mjs'

// Evaluate the actual entry points with inert database/process adapters. No
// credential file, database, product process or provider is accessed.
const source = readFileSync(new URL('../runner/bs-agent.mjs', import.meta.url), 'utf8')
const start = source.indexOf('function recoverWorkflowRun() {')
const middle = source.indexOf('async function superviseWorkflowRun()', start)
const end = source.indexOf('\nfunction reserveVerificationRecovery(', middle)
assert.ok(start >= 0 && middle > start && end > middle)
const recoveryEntry = source.slice(start, middle)
const supervisorEntry = source.slice(middle, end)
const runId = '06124632-a51d-4d08-bb62-ee4e8cedb9dc'
const taskId = 'SS-LAUNCH-CASH-POLICY-001'

function request({ id = runId, locked = false, fail = false, inbox = new Map() } = {}) {
  const queries = [], outputs = []
  let inline = 0
  runInNewContext(`${recoveryEntry}\nrecoverWorkflowRun()`, {
    args: [id], process: { env: locked ? { BS_RUN_SUPERVISOR_LOCKED: '1' } : {} },
    validRunId: value => /^[0-9a-f-]{36}$/.test(value ?? ''),
    superviseWorkflowRun: () => { inline++ }, recoveryErrorEnvelope,
    controlQuery: (sql, bindings) => {
      queries.push({ sql, bindings })
      assert.equal(sql, "SELECT control.enqueue_supervisor_wake(:'run'::uuid);")
      assert.equal(bindings.run, runId)
      if (fail) throw Error('control_database_unavailable')
      inbox.set(bindings.run, { pending: true })
    },
    output: (value, code = 0) => outputs.push({ value, code }),
  })
  return { queries, outputs, inline, inbox }
}

function snapshot(allowed) {
  return {
    workflow_run: { run_id: runId, status: 'running', current_task_id: taskId, completed_tasks: 3, max_tasks: 14 },
    packet: { task: { task_id: taskId, status: 'failed' }, retry_policy: { max_attempts: 3 } },
    executions: [{ execution_id: 316, attempt: 1, status: 'failed' }],
    verification_runs: [{ execution_id: 316, verification_run_id: 346, status: 'failed' }],
    authoritative_failure: { execution_id: 316, classification: 'VERIFIER_INFRA', fingerprint: 'reviewed-generation', evidence: { verification_run_id: 346 } },
    recovery_readiness: { allowed },
    recovery: { status: 'active', recoverable: true, next_action: 'reverify', failure_class: 'verification-infrastructure', error_code: 'verifier_repair_required' },
  }
}

async function dispatchCurrentIncident(outcome) {
  const worker = readFileSync(new URL('../runner/dot-recovery-worker.mjs', import.meta.url), 'utf8')
  const begin = worker.indexOf('  const handoff=await handoffRecovery(job,query)')
  const end = worker.indexOf('\n }catch(error)', begin)
  assert.ok(begin >= 0 && end > begin)
  assert.doesNotMatch(worker, /const runLocks=|'run-recover',job\.run_id/)
  const job = {
    incident_id: '3c8a3b9e-6c00-4951-b44c-77f103b15ed5',
    claim_token: 'aaccda08-42ff-4bab-aabb-7207e28fac3d',
    run_id: runId, task_id: taskId, execution_id: 316,
  }
  const queries = [], finishes = [], before = JSON.stringify(job)
  await runInNewContext(`(async()=>{${worker.slice(begin, end)}})()`, {
    job, handoffRecovery,
    query: sql => {
      queries.push(sql)
      assert.equal(sql, `SELECT control.handoff_dot_recovery('${job.incident_id}'::uuid,'${job.claim_token}'::uuid);`)
      return outcome
    },
    finish: (status, evidence) => finishes.push({ status, evidence }),
  })
  assert.equal(JSON.stringify(job), before, 'handoff cannot replace the run, task or execution')
  assert.equal(queries.length, 1)
  return { finishes }
}

test('current Dot uses durable SQL handoff while the legacy recovery entry enqueues the same run', async () => {
  const dispatched = await dispatchCurrentIncident({ handed_off: true, wake_enqueued: true })
  assert.equal(dispatched.finishes.length, 0, 'SQL owns the atomic incident resolution and wake')
  const result = request()
  assert.equal(result.inline, 0)
  assert.equal(result.queries.length, 1)
  assert.equal(result.outputs[0].value.reason, 'supervisor_wake_enqueued')
  assert.equal(result.outputs[0].value.run_id, runId)
  assert.equal(result.outputs[0].value.status, 'wait')
  assert.equal(result.inbox.get(runId).pending, true)
})

test('current Dot preserves a refused authority handoff instead of advancing task lifecycle', async () => {
  const { finishes } = await dispatchCurrentIncident({ handed_off: false, reason: 'authoritative_human_gate' })
  assert.equal(finishes.length, 1)
  assert.equal(finishes[0].status, 'queued')
  assert.equal(finishes[0].evidence.reason, 'authoritative_human_gate')
})

test('restart replays coalesce onto the original run without rewriting history', () => {
  const state = snapshot(false), before = JSON.stringify(state), inbox = new Map()
  for (let restart = 0; restart < 3; restart++) {
    const result = request({ inbox })
    assert.equal(result.inline, 0)
    assert.equal(result.outputs[0].code, 0)
  }
  assert.equal(inbox.size, 1)
  assert.equal(JSON.stringify(state), before)
})

test('a failed wake write never reports a successful handoff', () => {
  const result = request({ fail: true })
  assert.equal(result.inbox.size, 0)
  assert.equal(result.outputs[0].code, 1)
  assert.equal(result.outputs[0].value.ok, false)
  assert.equal(result.inline, 0)
})

test('invalid run identity cannot enqueue or supervise', () => {
  for (const id of [undefined, '', 'new-run', `${runId}'`]) {
    const result = request({ id: id ?? '' })
    assert.equal(result.queries.length, 0)
    assert.equal(result.inline, 0)
    assert.equal(result.outputs[0].code, 64)
  }
})

test('internal recovery already inside the supervisor retains its existing lifecycle', () => {
  const result = request({ locked: true })
  assert.equal(result.inline, 1)
  assert.equal(result.queries.length, 0)
})

test('the ordinary supervisor still refuses to run when its flock is contended', async () => {
  const outputs = [], invocations = []
  await runInNewContext(`${supervisorEntry}\nsuperviseWorkflowRun()`, {
    args: [runId], validRunId: value => value === runId,
    process: { execPath: '/inert/node', env: {} }, path, repoRoot: '/inert',
    agentScriptPath: '/inert/bs-agent.mjs', mkdirSync: () => {},
    execute: (program, argv, options) => {
      invocations.push({ program, argv, options })
      return { code: 1, stdout: '' }
    },
    parseJson: (_value, fallback) => fallback,
    output: (value, code) => outputs.push({ value, code }),
    runSupervisorLifecycle: () => assert.fail('contended lock cannot dispatch lifecycle work'),
  })
  assert.equal(invocations.length, 1)
  assert.equal(invocations[0].program, 'flock')
  assert.equal(invocations[0].argv[0], '-n')
  assert.equal(invocations[0].options.env.BS_RUN_SUPERVISOR_LOCKED, '1')
  assert.equal(outputs[0].value.reason, 'supervisor_lease_contended')
})

test('queued recovery resumes ordinary supervision and keeps verifier repair readiness authoritative', async () => {
  for (const allowed of [false, true]) {
    const state = snapshot(allowed), before = JSON.stringify(state), inbox = new Map()
    request({ inbox })
    const calls = [], outputs = []
    assert.equal(inbox.get(runId).pending, true)
    await runInNewContext(`${supervisorEntry}\nsuperviseWorkflowRun()`, {
      args: [runId], validRunId: value => value === runId,
      process: { execPath: '/inert/node', env: { BS_RUN_SUPERVISOR_LOCKED: '1' } },
      path, repoRoot: '/inert', agentScriptPath: '/inert/bs-agent.mjs', mkdirSync: () => {},
      runSupervisorLifecycle, recoveryErrorEnvelope,
      parseControlJson: value => value, parseJson: value => JSON.parse(value),
      adoptRunRecovery: () => {}, reconcileNativeAdmission: () => {},
      controlQuery: (sql, bindings) => {
        if (sql.includes('workflow_run_gate')) return { should_continue: true }
        if (sql.includes('acquire_workflow_run_task')) {
          assert.equal(bindings.id, runId)
          return { acquired: true, task_id: taskId }
        }
        if (/reconcile_lifecycle_incidents|reconcile_ordinary_run_publication/.test(sql)) return {}
        assert.fail(`unexpected control mutation: ${sql}`)
      },
      execute: (program, argv) => {
        assert.equal(program, '/inert/node')
        assert.deepEqual(Array.from(argv), ['/inert/bs-agent.mjs', 'task-supervise', taskId])
        const plan = planSupervisorStep(state)
        calls.push(plan)
        return { stdout: JSON.stringify({ ok: true, status: plan.kind, recovery: plan }) }
      },
      output: value => outputs.push(value),
    })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].execution.execution_id, 316)
    assert.equal(calls[0].next_action, 'reverify')
    assert.equal(calls[0].kind, allowed ? 'act' : 'wait')
    assert.equal(calls[0].command, allowed ? 'task-verify' : undefined)
    assert.equal(calls[0].reason, allowed ? 'current_trusted_verifier_recovery' : 'verifier_repair_required')
    assert.equal(outputs[0].run_id, runId)
    assert.equal(JSON.stringify(state), before)
  }
})
