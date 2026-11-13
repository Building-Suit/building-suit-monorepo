import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { PiniaColada, useMutationCache } from '@pinia/colada'
import { useShopMutation } from '../../app/composables/useShopMutation.ts'

function fixture() {
  const app = createApp({}); app.use(createPinia()); app.use(PiniaColada)
  const cache = app.runWithContext(() => useMutationCache())
  const execute = app.runWithContext(() => useShopMutation())
  const remove = cache.remove
  let removed
  cache.remove = entry => { removed = entry; remove(entry) }
  return { cache, execute, removed: () => removed }
}

test('failed commands return the original error only to the caller and retain no private cause in cache', async () => {
  const f = fixture()
  const privateFailure = Object.assign(new Error('Synthetic provider failure'), { requestBody: 'SYNTHETIC-PRIVATE-REQUEST' })
  await assert.rejects(f.execute(async () => { throw privateFailure }), error => error === privateFailure)
  const entry = f.removed()
  assert.equal(entry.state.value.error.message, 'Shop command failed')
  assert.notEqual(entry.state.value.error, privateFailure)
  assert.equal(entry.state.value.error.cause, undefined)
  assert.equal(entry.state.value.error.requestBody, undefined)
  assert.equal(entry.vars, undefined)
  assert.equal(f.cache.getEntries().length, 0)
})

test('successful commands execute once, return their value and release cached closures', async () => {
  const f = fixture(); let calls = 0
  const value = { result: 'synthetic-result' }
  assert.equal(await f.execute(async () => { calls++; return value }), value)
  assert.equal(calls, 1)
  assert.equal(f.removed().vars, undefined)
  assert.equal(f.cache.getEntries().length, 0)
})
