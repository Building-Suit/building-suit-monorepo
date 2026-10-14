import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isDueExternalRecovery,
  localReceiptWatchObservation,
  normalizeWatchDescriptor,
  watchDescriptorForRecovery,
  watchTransition,
} from '../runner/external-state-watcher.mjs'
import { planSupervisorStep, supervisorStateFingerprint } from '../runner/task-supervisor.mjs'

const repository = 'Building-Suit/building-suit-monorepo'
const now = new Date('2026-10-06T19:35:54.007Z')
function snapshot() {
  return {
    packet: {
      task: { task_id: 'BS-SA-SHELL-001', status: 'passed' },
      project: { github_repository: repository },
      retry_policy: { max_attempts: 5 },
    },
    executions: [{ execution_id: 309, attempt: 5, status: 'failed' }],
    verification_runs: [{ execution_id: 309, verification_run_id: 310, status: 'passed' }],
    workflow_run: { run_id: 'same-bounded-run', status: 'running', max_tasks: 2, completed_tasks: 0 },
    runtime_operations: [{ operation_id: 'same-publication-operation', action: 'task-publish', execution_id: 309, status: 'pending', infra_retries: 1 }],
  }
}

for (const reason of ['runtime_operation_in_flight', 'runtime_backoff_pending']) {
  test(`${reason} uses receipt timers without a GitHub watch, even with an existing PR`, () => {
    for (const publications of [[], [{ pr_number: 194, state: 'open' }]]) {
      const state = { ...snapshot(), publications }
      const before = JSON.stringify(state)
      assert.equal(watchDescriptorForRecovery(state, { next_action: 'wait-external', reason }, {
        metadata: { child_command: 'task-publish' },
      }), null)
      const next = planSupervisorStep(state)
      assert.equal(next.command, 'task-publish')
      assert.equal(next.operation.operation_id, 'same-publication-operation')
      assert.equal(next.execution.execution_id, 309)
      assert.equal(JSON.stringify(state), before)
    }
  })

  test(`persisted ${reason} releases its watcher lease and routes locally without a GitHub probe`, () => {
    for (const kind of ['github-reachability', 'github-pull-request']) {
      const recovery = {
        status: 'active', recoverable: true, next_action: 'wait-external',
        error_code: reason, next_wake_at: '2026-10-06T19:35:14.737Z',
        condition: { reason, watch: { kind, repository, pull_request: 194 } },
      }
      const before = JSON.stringify(recovery)
      assert.equal(normalizeWatchDescriptor(recovery).kind, kind)
      assert.equal(isDueExternalRecovery(recovery, now), true)
      const local = localReceiptWatchObservation(recovery)
      assert.equal(local.actionable, true)
      assert.equal(local.state, 'local-runtime')
      assert.deepEqual(local.evidence, { kind: 'runtime-receipt', reason })
      const transition = watchTransition(recovery, local, now)
      assert.equal(transition.next_wake_at, now.toISOString())
      assert.equal(transition.poll_count, 0)
      // Older records may carry only the condition reason.
      assert.deepEqual(localReceiptWatchObservation({ ...recovery, error_code: undefined }), local)
      // No human wait or safety stop is converted to automatic routing.
      for (const next_action of ['wait-operator', 'wait-decision', 'safety-stop']) {
        assert.equal(localReceiptWatchObservation({ ...recovery, next_action }), null)
      }
      assert.equal(JSON.stringify(recovery), before)
    }
  })
}

test('actual GitHub unavailability still has its ordinary due external watcher', () => {
  const reason = 'repository_state_unavailable'
  const watch = watchDescriptorForRecovery(snapshot(), { next_action: 'wait-external', reason }, {
    metadata: { child_command: 'task-publish' },
  })
  assert.deepEqual(watch, { kind: 'github-reachability', repository })
  const recovery = {
    status: 'active', recoverable: true, next_action: 'wait-external', error_code: reason,
    next_wake_at: '2026-10-06T19:35:14.737Z', condition: { reason, watch },
  }
  assert.deepEqual(normalizeWatchDescriptor(recovery), watch)
  assert.equal(localReceiptWatchObservation(recovery), null)
  assert.equal(isDueExternalRecovery(recovery, now), true)
})

test('a current publication scope gate remains an operator wait on the same run', () => {
  const state = snapshot()
  state.recovery = {
    status: 'active', next_action: 'wait-operator', failure_class: 'publication-scope',
    error_code: 'publication_scope_requires_operator',
    condition: { fingerprint: supervisorStateFingerprint(state) },
  }
  const before = JSON.stringify(state)
  const next = planSupervisorStep(state)
  assert.equal(next.kind, 'wait')
  assert.equal(next.next_action, 'wait-operator')
  assert.equal(next.reason, 'publication_scope_requires_operator')
  assert.equal(next.command, undefined)
  assert.equal(JSON.stringify(state), before)
})
