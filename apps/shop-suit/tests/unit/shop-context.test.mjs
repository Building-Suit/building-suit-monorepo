import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { ref } from 'vue'

const source = stripTypeScriptTypes(await readFile(new URL('../../app/composables/useShop.ts', import.meta.url), 'utf8'))
let fixtureId = 0
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
async function fixture() {
  const state = new Map()
  const cookies = new Map()
  const user = ref({ id: 'account-a' })
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
    schema() { return { rpc: async (_, args) => {
      calls.push(args.p_shop_id)
      const next = locations.shift()
      assert.ok(next, 'missing location response')
      return await next
    } } },
  }
  const env = {
    useCookie: key => { if (!cookies.has(key)) cookies.set(key, ref(null)); return cookies.get(key) },
    useState: (key, init) => { if (!state.has(key)) state.set(key, ref(init())); return state.get(key) },
    useSupabaseClient: () => client, useSupabaseUser: () => user,
    useNuxtApp: () => ({ runWithContext: fn => fn() }),
    clearNuxtData: predicate => clear.push(predicate), refreshNuxtData: async () => {},
  }
  const key = `__shopContextFixture${fixtureId++}`
  globalThis[key] = env
  const code = source.replace(/import\s*\{([\s\S]*?)\}\s*from '#imports'/, `const {$1} = globalThis['${key}']`)
    .replace("from 'vue'", `from '${import.meta.resolve('vue')}'`)
  const { useShop } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  delete globalThis[key]
  const shop = useShop()
  function membership(shopIds = ['shop-a', 'shop-b']) {
    for (const data of [{ id: 'portal' }, { id: 'profile', status: 'active' }, shopIds.map(id => ({ id, shop_id: id, role: 'owner' })), shopIds.map(id => ({ id, name: id, status: 'active' }))]) responses.push(Promise.resolve({ data }))
  }
  function location(id) { return { data: [{ id, status: 'active', is_default: true }] } }
  return { shop, user, membership, responses, locations, location, calls, clear, state }
}

test('account replacement hides tenant data before membership resolves and ignores the old account location response', async () => {
  const f = await fixture()
  f.membership(); f.locations.push(Promise.resolve(f.location('old-location')))
  await f.shop.loadShops()
  const late = deferred()
  f.locations.push(late.promise)
  const pendingLocation = f.shop.loadLocations()
  f.user.value = { id: 'account-b' }
  const portal = deferred()
  f.responses.push(portal.promise)
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

test('A → B → A ignores delayed earlier locations and reports only the latest switch failure', async () => {
  const f = await fixture()
  f.membership(); f.locations.push(Promise.resolve(f.location('initial')))
  await f.shop.loadShops()
  const oldA = deferred(); f.locations.push(oldA.promise)
  const first = f.shop.loadLocations()
  const oldB = deferred(); f.locations.push(oldB.promise)
  const second = f.shop.selectShop('shop-b')
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

test('sign-out invalidates in-flight membership reads', async () => {
  const f = await fixture()
  const profile = deferred()
  f.responses.push(Promise.resolve({ data: { id: 'portal' } }), profile.promise)
  const loading = f.shop.loadShops()
  await new Promise(resolve => setImmediate(resolve))
  f.user.value = null
  await f.shop.loadShops()
  profile.resolve({ data: { id: 'profile', status: 'active' } })
  await loading
  assert.deepEqual(f.shop.shops.value, [])
  assert.deepEqual(f.shop.memberships.value, [])
  assert.equal(f.shop.loading.value, false)
  assert.equal(f.state.get('shop:loaded-user-id').value, null)
})
