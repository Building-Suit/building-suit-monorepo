import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { atomicJson, readJson, receiptPaths, startReceipt } from '../runner/durable-process.mjs'
import { classifySupervisorFailure, planSupervisorStep } from '../runner/task-supervisor.mjs'
import { operationHasAuthoritativeSuccess } from '../runner/bounded-publication.mjs'
import { recoveryBackoff, retryWithoutProductAttempt } from '../runner/selfhealing.mjs'
import {
  localReceiptWatchObservation, watchDescriptorForRecovery, watchTransition,
} from '../runner/external-state-watcher.mjs'

const now = new Date('2026-10-06T19:44:30.749Z')
function snapshot() {
  return {
    packet: {
      task: { task_id: 'BS-SA-SHELL-001', status: 'passed' },
      project: { github_repository: 'Building-Suit/building-suit-monorepo' },
      retry_policy: { max_attempts: 5 },
    },
    executions: [{ execution_id: 309, attempt: 5, status: 'failed' }],
    verification_runs: [{ verification_run_id: 310, execution_id: 309, status: 'passed', metadata: { verifier_only_reacceptance: true } }],
    workflow_run: { run_id: 'same-bounded-run', status: 'running', completed_tasks: 0, max_tasks: 2 },
    runtime_operations: [{ operation_id: 'same-publication-operation', action: 'task-publish', execution_id: 309, status: 'pending', infra_retries: 1 }],
  }
}

// Exercise the installed receipt consumer without loading the CLI entry point,
// invoking a product action, or connecting to a database. Its SQL writes are
// captured as arguments; only disposable receipt files are real.
const source = readFileSync(new URL('../runner/bs-agent.mjs', import.meta.url), 'utf8')
const actionSource = source.slice(source.indexOf('function invokeTaskAction('), source.indexOf('function handleNoPublishableChanges('))
function consumeReceipt(root, state) {
  const writes = []
  let launches = 0
  const invoke = runInNewContext(`(${actionSource.trim()})`, {
    process: { execPath: process.execPath, env: {}, pid: process.pid },
    path, repoRoot: root, agentScriptPath: 'fixture-must-not-execute.mjs',
    supervisorSnapshot: () => state,
    currentExecution: () => state.executions.at(-1),
    operationHasAuthoritativeSuccess, recoveryBackoff, retryWithoutProductAttempt,
    requiresSameAttemptVerification: () => false,
    receiptPaths, readJson,
    startReceipt: (paths, request, env) => {
      const value = startReceipt(paths, request, env)
      if (value.started) launches++
      return value
    },
    parseJson: (text, fallback) => { try { return JSON.parse(text) } catch { return fallback } },
    controlQuery: (sql, values) => { writes.push({ sql, values }); return '' },
    execute: () => { throw Error('product_action_forbidden') },
    randomUUID: () => { throw Error('new_operation_forbidden') },
  })
  return { child: invoke('task-publish', 'BS-SA-SHELL-001'), writes, launches }
}

for (const kind of ['interrupted-writer', 'empty-output', 'invalid-json']) {
  test(`${kind} publication receipt resumes the same operation on local timers`, () => {
    const root = mkdtempSync(path.join(tmpdir(), 'cp-publication-transport-'))
    try {
      const state = snapshot()
      const before = JSON.stringify(state)
      const paths = receiptPaths(path.join(root, '.local/runtime-operations'), 'same-publication-operation', 1)
      if (kind === 'interrupted-writer') {
        atomicJson(paths.state, { pid: 2147483647, start_stamp: 'absent' })
      } else {
        atomicJson(paths.result, { code: 1, stdout: kind === 'invalid-json' ? '{' : '', stderr: '', error: null })
      }
      const { child, writes, launches } = consumeReceipt(root, state)
      assert.equal(launches, 0)
      assert.equal(child.payload.error, 'malformed_child_response')
      assert.equal(writes.length, 1)
      assert.equal(writes[0].values.id, 'same-publication-operation')
      assert.equal(writes[0].values.status, 'pending')
      assert.equal(writes[0].values.increment, '1')
      assert.equal(writes[0].values.backoff, String(recoveryBackoff(1)))
      const receipt = readJson(paths.result)
      if (kind === 'interrupted-writer') assert.equal(receipt.error, 'receipt_writer_interrupted')
      const plan = classifySupervisorFailure({ command: 'task-publish', payload: child.payload, attempt: 5, maxAttempts: 5 })
      assert.equal(plan.kind, 'wait')
      assert.equal(plan.failure_class, 'transient-infrastructure')
      assert.equal(watchDescriptorForRecovery(state, plan, { metadata: { child_command: 'task-publish' } }), null)
      const next = planSupervisorStep(state)
      assert.equal(next.command, 'task-publish')
      assert.equal(next.operation.operation_id, 'same-publication-operation')
      assert.equal(next.execution.execution_id, 309)
      assert.equal(JSON.stringify(state), before)
      assert.deepEqual(readJson(paths.result), receipt)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
}

test('persisted malformed-response GitHub watches return locally without asserting publication success', () => {
  const recovery = {
    status: 'active', recoverable: true, next_action: 'wait-external',
    error_code: 'malformed_child_response',
    condition: { reason: 'malformed_child_response', watch: { kind: 'github-reachability', repository: 'Building-Suit/building-suit-monorepo' } },
  }
  const before = JSON.stringify(recovery)
  const local = localReceiptWatchObservation(recovery)
  assert.equal(local?.state, 'local-runtime')
  assert.equal(local?.actionable, true)
  assert.deepEqual(local.evidence, { kind: 'runtime-receipt', reason: 'malformed_child_response' })
  assert.equal(watchTransition(recovery, local, now).next_wake_at, now.toISOString())
  assert.deepEqual(localReceiptWatchObservation({ ...recovery, error_code: undefined }), local)
  assert.equal(JSON.stringify(recovery), before)
})

test('actual GitHub dependencies and publication human gates retain their routes', () => {
  const state = snapshot()
  const external = classifySupervisorFailure({ command: 'task-publish', payload: { error: 'repository_state_unavailable', classification: { failure_class: 'transient-infrastructure' } } })
  assert.equal(watchDescriptorForRecovery(state, external, { metadata: { child_command: 'task-publish' } }).kind, 'github-reachability')
  assert.equal(localReceiptWatchObservation({ next_action: 'wait-external', error_code: external.reason }), null)
  for (const next_action of ['wait-operator', 'wait-decision', 'safety-stop']) {
    assert.equal(localReceiptWatchObservation({ next_action, error_code: 'malformed_child_response' }), null)
  }
  const gate = classifySupervisorFailure({ command: 'task-publish', payload: { publication: { error: 'publication_scope_operator_wait' } } })
  assert.equal(gate.next_action, 'wait-operator')
  assert.equal(watchDescriptorForRecovery(state, gate, { metadata: { child_command: 'task-publish' } }), null)
})
