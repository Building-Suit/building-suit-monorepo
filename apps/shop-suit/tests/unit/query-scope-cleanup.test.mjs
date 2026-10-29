import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia } from 'pinia'
import { createApp, effectScope, nextTick } from 'vue'
import { PiniaColada, useQueryCache } from '@pinia/colada'
import { discardShopQuery } from '../../app/utils/shopQueryCleanup.ts'

function fixture() {
 const app = createApp({});app.use(createPinia());app.use(PiniaColada)
 const cache = app.runWithContext(() => useQueryCache()), key = ['shop-suit','old-actor','old-shop']
 cache.setQueryData(key, { privateCustomer: 'OLD-SCOPE' })
 return { cache, key, entry: cache.get(key) }
}
test('scope cleanup hides active private data before removal and rejects a late response', async () => {
 const { cache, key, entry } = fixture(), consumer = effectScope()
 cache.track(entry, consumer)
 let complete
 const pending = cache.fetch(entry, { query: () => new Promise(resolve => { complete = resolve }) })
 assert.equal(entry.active, true)
 discardShopQuery(cache,entry)
 assert.equal(entry.state.value.data, undefined)
 assert.equal(entry.state.value.error, null)
 assert.equal(cache.get(key), entry)
 cache.untrack(entry,consumer);await nextTick()
 assert.equal(cache.get(key), undefined)
 complete({ privateCustomer: 'LATE-OLD-SCOPE' });await pending
 assert.equal(entry.state.value.data, undefined)
 consumer.stop()
})
test('inactive entries are removed immediately; an active consumer can safely remain empty', async () => {
 const first = fixture();discardShopQuery(first.cache,first.entry);assert.equal(first.cache.get(first.key),undefined)
 const { cache,key,entry } = fixture(),consumer = effectScope();cache.track(entry,consumer)
 discardShopQuery(cache,entry);await nextTick()
 assert.equal(cache.get(key),entry);assert.equal(entry.state.value.data,undefined)
 cache.untrack(entry,consumer);cache.remove(entry);consumer.stop()
})
