import assert from 'node:assert/strict'
import test from 'node:test'
import { createSSRApp, ref, watch } from 'vue'
import { createPinia, disposePinia } from 'pinia'
import { PiniaColada, useQueryCache } from '@pinia/colada'
import { shopModuleLoader } from '../fixtures/load-shop-module.mjs'

const fixtures = []
test.afterEach(() => { for (const { pinia, cache } of fixtures.splice(0)) { disposePinia(pinia);for (const entry of cache.getEntries()) { cache.cancel(entry);cache.remove(entry) } } })
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
async function fixture() {
  const state = new Map()
  const cookies = new Map()
  const user = ref(null)
  const responses = []
  const locations = []
  const calls = []
  const clear = []
  const client = {
    from(table) {
      const result = responses.shift()
      calls.push(table)
      assert.ok(result, `missing fixture for ${table}`)
      const query = new Proxy({}, { get: (_, key) => key === 'then' ? result.then.bind(result) : () => query })
      return query
    },
    schema() { return { rpc: (_, args) => {
      const promise = (async () => {
      calls.push(args.p_shop_id)
      const next = locations.shift()
      assert.ok(next, 'missing location response')
      return await next
      })()
      promise.abortSignal = () => promise
      return promise
    } } },
  }
  const env = {
    watch, defineNuxtPlugin: config => config, usePinia: () => pinia,
    useSupabaseSession: () => ref(null),
    useCookie: key => { if (!cookies.has(key)) cookies.set(key, ref(null)); return cookies.get(key) },
    useState: (key, init) => { if (!state.has(key)) state.set(key, ref(init())); return state.get(key) },
    useShopClient: () => client,
    useRuntimeConfig: () => ({ public: { supabase: { url: 'http://fixture.invalid' }, appEnvironment: 'test' } }), useSupabaseUser: () => user,
    useNuxtApp: () => ({ runWithContext: fn => fn() }),
    clearNuxtData: predicate => clear.push(predicate), refreshNuxtData: async () => {},
  }
  const app = createSSRApp({});const pinia = createPinia();app.use(pinia);app.use(PiniaColada);fixtures.push({ pinia, cache: app.runWithContext(() => useQueryCache()) })
  const load = shopModuleLoader(env)
  app.runWithContext(() => load('plugins/query-scope.ts').default.setup())
  const shop = app.runWithContext(() => load('composables/useShop.ts').useShop())
  function membership(shopIds = ['shop-a', 'shop-b']) {
    for (const data of [{ id: 'portal' }, { id: 'profile', status: 'active' }, shopIds.map(id => ({ id, shop_id: id, role: 'owner' })), shopIds.map(id => ({ id, name: id, status: 'active' }))]) responses.push(Promise.resolve({ data }))
    user.value = { id: 'account-a' }
  }
  function location(id) { return { data: [{ id, status: 'active', is_default: true }] } }
  return { shop, user, membership, responses, locations, location, calls, clear, state }
}

test('account replacement hides tenant data before membership resolves and ignores the old account location response', { timeout: 5000 }, async () => {
  const f = await fixture()
  f.membership(); f.locations.push(Promise.resolve(f.location('old-location')))
  await f.shop.loadShops()
  const late = deferred()
  f.locations.push(late.promise)
  const pendingLocation = f.shop.loadLocations()
  const portal = deferred()
  f.responses.push(portal.promise)
  f.user.value = { id: 'account-b' }
  const loading = f.shop.loadShops()
  assert.equal(f.shop.currentId.value, null)
  assert.deepEqual(f.shop.shops.value, [])
  late.resolve(f.location('sensitive-old-location'))
  await pendingLocation
  assert.deepEqual(f.shop.locations.value, [])
  portal.resolve({ error: new Error('unavailable') })
  await loading
  assert.equal(f.shop.loading.value, false)
  assert.equal(f.shop.currentLocationId.value, null)
  assert.ok(f.shop.loadError.value)
})

test('A → B → A ignores delayed earlier locations and reports only the latest switch failure', { timeout: 5000 }, async () => {
  const f = await fixture()
  f.membership(); f.locations.push(Promise.resolve(f.location('initial')))
  await f.shop.loadShops()
  const oldA = deferred(); f.locations.push(oldA.promise)
  const first = f.shop.loadLocations()
  const oldB = deferred(); f.locations.push(oldB.promise)
  const second = f.shop.selectShop('shop-b')
  // Let B dispatch so both earlier requests are in flight before switching to A.
  await new Promise(resolve => setImmediate(resolve))
  f.locations.push(Promise.resolve(f.location('latest-a')))
  await f.shop.selectShop('shop-a')
  oldA.resolve(f.location('old-a')); oldB.resolve({ error: new Error('stale failure') })
  await Promise.all([first, second])
  assert.equal(f.shop.currentLocationId.value, 'latest-a')
  assert.equal(f.shop.loadError.value, null)
  assert.equal(f.shop.loading.value, false)
  assert.ok(f.clear.every(predicate => predicate('shop-data:sales')))
  f.locations.push(Promise.resolve({ error: new Error('latest failure') }))
  await f.shop.selectShop('shop-b')
  assert.equal(f.shop.currentLocationId.value, null)
  assert.ok(f.shop.loadError.value)
})

test('sign-out invalidates in-flight membership reads', { timeout: 5000 }, async () => {
  const f = await fixture()
  const profile = deferred()
  f.responses.push(Promise.resolve({ data: { id: 'portal' } }), profile.promise)
  f.user.value = { id: 'account-a' }
  const loading = f.shop.loadShops()
  await new Promise(resolve => setImmediate(resolve))
  f.user.value = null
  await f.shop.loadShops()
  profile.resolve({ data: { id: 'profile', status: 'active' } })
  await loading
  assert.deepEqual(f.shop.shops.value, [])
  assert.deepEqual(f.shop.memberships.value, [])
  assert.equal(f.shop.loading.value, false)
  assert.equal(f.shop.currentId.value, null)
  assert.equal(f.shop.currentLocationId.value, null)
})
