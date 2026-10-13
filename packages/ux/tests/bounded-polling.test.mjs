import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope } from 'vue'
import { useBoundedPolling } from '../src/composables/useBoundedPolling.ts'
test('bounded polling stops on confirmation or at its exact retry budget', async () => {
  const scope = effectScope()
  let calls = 0
  const policy = scope.run(() => useBoundedPolling(async () => ++calls === 3, { attempts: 10, delay: 1 }))
  assert.equal(await policy.start(), 'completed')
  assert.equal(calls, 3)
  calls = 10
  assert.equal(await policy.start(), 'exhausted')
  assert.equal(calls, 20)
  assert.equal(policy.pending.value, false)
  scope.stop()
})
test('disposal releases a pending delay and prevents subsequent requests', async () => {
  const scope = effectScope()
  let calls = 0
  const policy = scope.run(() => useBoundedPolling(async () => { calls++; return false }, { attempts: 10, delay: 60000 }))
  const result = policy.start()
  await Promise.resolve()
  scope.stop()
  assert.equal(await result, 'cancelled')
  assert.equal(calls, 1)
  assert.equal(policy.pending.value, false)
})
