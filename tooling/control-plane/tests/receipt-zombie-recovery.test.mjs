import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { atomicJson, processStamp, readJson, receiptLocked, receiptPaths, receiptProcessAlive, startReceipt } from '../runner/durable-process.mjs'
import { processAlive } from '../runner/dot-health-collector.mjs'
import { retryWithoutProductAttempt } from '../runner/selfhealing.mjs'
import { planSupervisorStep } from '../runner/task-supervisor.mjs'

const pause = milliseconds => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
function stat(pid) {
  const value = readFileSync(`/proc/${pid}/stat`, 'utf8')
  return value.slice(value.lastIndexOf(')') + 2).split(' ')
}
function zombie() {
  // Keep the parent's event loop blocked until exit so libuv cannot reap this
  // disposable child yet. Its PID/start stamp still exists, but it cannot work.
  const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' })
  const closed = once(child, 'close')
  const identity = { pid: child.pid, start_stamp: stat(child.pid)[19] }
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (stat(child.pid)[0] === 'Z') return { identity, closed }
    pause(10)
  }
  child.kill('SIGKILL')
  throw Error('zombie_fixture_timeout')
}

for (const role of ['writer', 'child']) test(`exited unreaped ${role} settles the original receipt and resumes the same operation`, async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'cp-zombie-'))
  const { identity, closed } = zombie()
  try {
    assert.equal(processAlive(identity), false)
    const original = receiptPaths(root, 'same-publication-operation', 0)
    const state = role === 'writer' ? identity : { pid: 2147483647, start_stamp: 'missing', child: identity }
    atomicJson(original.state, state)
    assert.equal(receiptLocked(original), false)
    assert.equal(receiptProcessAlive(identity), false)
    assert.equal(processStamp(identity.pid), null)
    // No replacement child may start in the interrupted generation.
    const marker = path.join(root, 'recovered')
    const request = { program: process.execPath, args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'RECOVERED')`], cwd: root, timeout: 3000 }
    assert.deepEqual(startReceipt(original, request), { started: false, settled: true })
    const result = readJson(original.result)
    assert.equal(result.error, 'receipt_writer_interrupted')
    assert.equal(retryWithoutProductAttempt(result.classification), true)
    assert.deepEqual(readJson(original.state), state)

    const snapshot = {
      packet: { task: { task_id: 'BS-SA-SHELL-001', status: 'passed' }, retry_policy: { max_attempts: 5 } },
      executions: [{ execution_id: 309, attempt: 5, status: 'failed' }],
      verification_runs: [{ verification_run_id: 310, execution_id: 309, status: 'passed', metadata: { verifier_only_reacceptance: true } }],
      workflow_run: { run_id: 'original-bounded-run', status: 'running', completed_tasks: 0, max_tasks: 2 },
      runtime_operations: [{ operation_id: 'same-publication-operation', action: 'task-publish', execution_id: 309, infra_retries: 1, status: 'pending' }],
    }
    const before = JSON.stringify(snapshot)
    assert.equal(planSupervisorStep(snapshot).command, 'task-publish')
    assert.equal(JSON.stringify(snapshot), before)
    const recovered = receiptPaths(root, 'same-publication-operation', 1)
    startReceipt(recovered, request)
    const deadline = Date.now() + 5000
    while (!readJson(recovered.result) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20))
    assert.equal(readJson(recovered.result)?.code, 0)
    assert.equal(readFileSync(marker, 'utf8'), 'RECOVERED')
    assert.deepEqual(readJson(original.result), result)
    assert.deepEqual(startReceipt(original, request), { started: false, settled: true })
  } finally {
    await closed
    rmSync(root, { recursive: true, force: true })
  }
})

test('live stamped writer or child still prevents a duplicate receipt invocation', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'cp-live-receipt-'))
  try {
    const identity = { pid: process.pid, start_stamp: processStamp(process.pid) }
    assert.equal(receiptProcessAlive(identity), true)
    assert.equal(receiptProcessAlive({ ...identity, start_stamp: 'different-process' }), false)
    for (const role of ['writer', 'child']) {
      const paths = receiptPaths(root, role)
      atomicJson(paths.state, role === 'writer' ? identity : { child: identity })
      assert.deepEqual(startReceipt(paths, { program: 'must-not-run', args: [], cwd: root }),
        role === 'writer' ? { started: false, writer_alive: true } : { started: false, child_alive: true })
      assert.equal(readJson(paths.result), null)
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
