import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope } from 'vue'
import { useExpiringValue } from '../src/composables/useExpiringValue.ts'
test('temporary receipt links expire and clearing prevents late responses restoring them', async () => {
  const scope = effectScope()
  const policy = scope.run(() => useExpiringValue('', 5))
  await policy.load(async () => 'receipt-one')
  assert.equal(policy.value.value, 'receipt-one')
  await new Promise(resolve => setTimeout(resolve, 15))
  assert.equal(policy.value.value, '')
  let finish
  const pending = policy.load(() => new Promise(resolve => { finish = resolve }))
  policy.clear()
  finish('obsolete-receipt')
  await pending
  assert.equal(policy.value.value, '')
  scope.stop()
})
test('disposal invalidates an in-flight signed-link read', async () => {
  const scope = effectScope()
  const policy = scope.run(() => useExpiringValue('', 60000))
  let finish
  const pending = policy.load(() => new Promise(resolve => { finish = resolve }))
  scope.stop()
  finish('late-receipt')
  await pending
  assert.equal(policy.value.value, '')
})
