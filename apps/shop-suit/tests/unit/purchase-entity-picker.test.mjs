import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'

function fixture() {
  const requests = []
  const shopId = vue.ref('shop-one')
  const user = vue.ref({ id: 'user-one' })
  const rpc = (_name, args) => new Promise(resolve => requests.push({ args, resolve }))
  const code = ts.transpileModule(readFileSync(new URL('../../app/composables/usePurchaseEntityPicker.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  const globals = {
    ref: vue.ref, computed: vue.computed, watch: vue.watch, onScopeDispose: vue.onScopeDispose,
    useSupabaseClient: () => ({ schema: () => ({ rpc }) }),
    useShop: () => ({ currentId: shopId }), useSupabaseUser: () => user,
    useI18n: () => ({ locale: vue.ref('en') }),
  }
  new Function('exports', ...Object.keys(globals), code)(module.exports, ...Object.values(globals))
  const scope = vue.effectScope()
  const adapter = scope.run(() => module.exports.usePurchaseEntityPicker('product'))
  return { adapter, requests, shopId, user, stop: () => scope.stop() }
}
const flush = async () => { await Promise.resolve(); await vue.nextTick(); await Promise.resolve() }
const result = (items, total = items.length) => ({ data: { items, total }, error: null })

test('lazy purchase search discards stale results and clears choices when identity or shop changes', async () => {
  const f = fixture()
  try {
    f.adapter.query('new query')
    assert.equal(f.requests[1].args.p_search, 'new query')
    f.requests[1].resolve(result([{ id: 'new', name: 'New choice' }]))
    await flush()
    f.requests[0].resolve(result([{ id: 'stale', name: 'Stale choice' }]))
    await flush()
    assert.deepEqual(f.adapter.items.value.map(item => item.id), ['new'])
    f.shopId.value = 'shop-two'
    await flush()
    assert.deepEqual(f.adapter.items.value, [])
    assert.equal(f.requests[2].args.p_shop_id, 'shop-two')
    f.user.value = { id: 'user-two' }
    await flush()
    f.requests[2].resolve(result([{ id: 'old-user', name: 'Old user choice' }]))
    await flush()
    assert.deepEqual(f.adapter.items.value, [])
  } finally { f.stop() }
})

test('failed load-more retries the same page without dropping previously fetched or selected entities', async () => {
  const f = fixture()
  try {
    f.requests[0].resolve(result([{ id: 'one', name: 'One' }], 2))
    await flush()
    f.adapter.more()
    assert.equal(f.requests[1].args.p_page, 2)
    f.requests[1].resolve({ data: null, error: { message: 'synthetic failure' } })
    await flush()
    assert.equal(f.adapter.error.value, 'Could not load choices.')
    const retry = f.adapter.retry()
    assert.equal(f.requests[2].args.p_page, 2)
    f.requests[2].resolve(result([{ id: 'two', name: 'Two' }], 2))
    await retry
    assert.deepEqual(f.adapter.items.value.map(item => item.id), ['one', 'two'])
    assert.equal(f.adapter.hasMore.value, false)
    assert.deepEqual(f.adapter.options({ id: 'selected', name: 'Selected' }).map(item => item.id), ['selected', 'one', 'two'])
  } finally { f.stop() }
})
