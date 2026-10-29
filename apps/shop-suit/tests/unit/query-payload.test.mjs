import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { PiniaColada, serializeQueryCache, useQueryCache } from '@pinia/colada'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { shopQueryPayload } from '../../app/utils/shopQueryPayload.ts'

const { stringify, parse } = await import(pathToFileURL(createRequire(import.meta.resolve('nuxt/package.json')).resolve('devalue')).href)

test('actual Colada failed-read payload hydrates without provider instances or private causes', () => {
  const app = createApp({}); app.use(createPinia()); app.use(PiniaColada)
  const cache = app.runWithContext(() => useQueryCache())
  const key = ['shop-suit', 'public-plans']
  cache.setQueryData(key, [{ id: 'published-plan' }])
  const entry = cache.get(key)
  const failure = Object.assign(new Error('SYNTHETIC-PRIVATE-PROVIDER'), { cause: new TypeError('SYNTHETIC-PRIVATE-CAUSE'), shopResponse: { requestBody: 'SYNTHETIC-PRIVATE-REQUEST' } })
  cache.setEntryState(entry, { status: 'error', data: entry.state.value.data, error: failure })
  const original = serializeQueryCache(cache)
  assert.throws(() => stringify(original), /non-POJOs/)
  const text = stringify(shopQueryPayload(original))
  assert.doesNotMatch(text, /SYNTHETIC-PRIVATE|shopResponse|requestBody/)
  const [hydrated] = Object.values(parse(text))
  assert.deepEqual(hydrated[0], [{ id: 'published-plan' }])
  assert.deepEqual(hydrated[1], { message: 'Shop query failed' })
  assert.equal(entry.state.value.error, failure)
})

test('successful, empty and pending query payloads retain their data, age and metadata', () => {
  const payload = { success: [{ amount: '9007199254740993.25' }, null, 12, { shopResource: 'plans' }], pending: [undefined, null, -1, {}] }
  assert.deepEqual(shopQueryPayload(payload), payload)
  assert.notEqual(shopQueryPayload(payload), payload)
})
