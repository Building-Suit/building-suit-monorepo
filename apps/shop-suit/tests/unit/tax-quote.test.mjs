import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { ref, computed } from 'vue'
const source = stripTypeScriptTypes(readFileSync(new URL('../../app/composables/useSaleTaxQuote.ts', import.meta.url), 'utf8'), { mode: 'strip' }).replace('export function', 'function')
function fixture({ online = true, cached = false, trade = false, delayed = false } = {}) {
 const shop = ref('shop-1'), location = ref('location-1'), user = ref({ id: 'user-1' }), customer = ref(null), draft = ref(null)
 const calls = [], writes = []
 let resolve
 const response = delayed ? new Promise(done => { resolve = done }) : Promise.resolve({ data: { total: 114, net: 100, tax: 14, calculationEnabled: true, tradePricingEnabled: false }, error: null })
 const factory = new Function('useSupabaseUser', 'useShopClient', 'computed', 'useShopQuery', `${source}; return useSaleTaxQuote`)
 const composable = factory(() => user, () => ({ schema: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return response } }) }), computed, (key, run) => ({ key, run, pending: ref(false), isLoading: ref(false) }))
 const offline = { online: ref(online), cached: async key => key === 'trade-pricing-enabled' ? trade : cached, cache: async (...args) => { writes.push(args) } }
 const api = composable(shop, location, computed(() => [{ item_type: 'product', source_id: 'product-1', quantity: 1 }]), offline, false, customer, draft)
 return { api, calls, writes, shop, location, user, customer, draft, resolve }
}
test('sale quote uses server totals and scopes cache identity', async () => {
 const f = fixture(); const quote = await f.api.run()
 assert.equal(quote.total, 114); assert.equal(quote.net, 100)
 assert.equal(f.calls[0].name, 'quote_customer_sale')
 assert.deepEqual(f.calls[0].args, { p_shop_id: 'shop-1', p_location_id: 'location-1', p_customer_id: null, p_bundles: false, p_invoice_id: null, p_lines: [{ item_type: 'product', source_id: 'product-1', quantity: 1 }] })
 assert.match(f.api.key.value, /user-1:shop-1:location-1/)
 assert.deepEqual(f.writes, [['tax-calculation-enabled', true], ['trade-pricing-enabled', false]])
})
test('offline allows confirmed disabled calculation and rejects enabled or unknown state', async () => {
 const disabled = fixture({ online: false }); assert.equal(await disabled.api.run(), null); assert.equal(disabled.calls.length, 0)
 for (const cached of [true, null]) {
  const f = fixture({ online: false, cached }); await assert.rejects(f.api.run(), /TAX_OFFLINE_QUOTE_REQUIRED/); assert.equal(f.calls.length, 0)
 }
})
test('delayed quote cannot overwrite tax state after account or location changes', async () => {
 for (const field of ['user', 'shop', 'location', 'customer', 'draft']) {
  const f = fixture({ delayed: true }); const pending = f.api.run()
  f[field].value = field === 'user' ? { id: 'user-2' } : 'changed'
  f.resolve({ data: { total: 114, calculationEnabled: true, tradePricingEnabled: false }, error: null })
  await pending; assert.deepEqual(f.writes, [])
 }
})

test('offline refuses negotiated or unknown trade pricing before using cached catalog totals', async () => {
 for (const trade of [true, null, undefined]) {
  const f = fixture({ online: false, trade: trade === undefined ? null : trade })
  await assert.rejects(f.api.run(), /TRADE_OFFLINE_QUOTE_REQUIRED/)
  assert.equal(f.calls.length, 0)
 }
})

test('customer and approved-draft context travel to the authoritative quote and its cache identity', async () => {
 const f = fixture(); f.customer.value = 'customer-1'; f.draft.value = 'draft-1'; await f.api.run()
 assert.equal(f.calls[0].args.p_customer_id, 'customer-1')
 assert.equal(f.calls[0].args.p_invoice_id, 'draft-1')
 const first = f.api.key.value; f.customer.value = 'customer-2'; assert.notEqual(f.api.key.value, first)
})
