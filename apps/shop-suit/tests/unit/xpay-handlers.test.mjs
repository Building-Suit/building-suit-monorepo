import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { createXPayCheckout, createXPayWebhook, createXPayReconciliation } from '../../supabase/functions/_shared/xpay-handlers.mjs'
const id = '11111111-1111-4111-8111-111111111111'
const shop = '22222222-2222-4222-8222-222222222222'
const terms = '33333333-3333-4333-8333-333333333333'
const vars = { XPAY_ENABLED: 'true', XPAY_API_VERSION: '1.0', XPAY_MODE: 'test', XPAY_SECRET_KEY: 'sk_test_fixture', XPAY_MERCHANT_ID: 'merchant-fixture', XPAY_WEBHOOK_SECRET: 'whsec_fixture', SHOP_BILLING_RETURN_ORIGIN: 'https://stg.shop.building-suit.com', SUPABASE_URL: 'https://jvvelvftpfnlogalgxgv.supabase.co' }
const env = name => vars[name]
const baseOrder = { id, idempotencyKey: id, shopId: shop, merchantId: 'merchant-fixture', mode: 'test', currency: 'EGP', amountMinor: 34900, description: 'Solo', state: 'creating', sessionId: null, createdAt: new Date().toISOString() }
const session = { id: 'cs_test_fixture', object: 'checkout.session', merchantId: 'merchant-fixture', livemode: false, metadata: { orderId: id }, currency: 'EGP', amountTotal: 34900, status: 'open', paymentStatus: 'unpaid', paymentIntentId: 'pi_test_fixture', isExpired: false, expiresAt: new Date(Date.now() + 1800000).toISOString(), url: 'https://checkout.xpay.app/c/cs_test_fixture', clientSecret: 'not-for-rpc', customer: { email: 'must-not-log@example.test' } }
const paid = { ...session, status: 'complete', paymentStatus: 'paid' }
const checkoutRequest = patch => new Request('https://edge.example/checkout', { method: 'POST', headers: { origin: vars.SHOP_BILLING_RETURN_ORIGIN, authorization: 'Bearer user-token', 'content-type': 'application/json' }, body: JSON.stringify({ requestId: id, shopId: shop, catalogTermsId: terms, locale: 'en', ...patch }) })
function fixture({ providerSession = session, failedRpc, dedup = false } = {}) {
  const calls = [], providerCalls = []
  let order = { ...baseOrder }
  const rpc = async (name, args, caller) => {
    calls.push({ name, args, caller })
    if (name === failedRpc) throw new Error('private SQL/provider body')
    if (name === 'shop_xpay_checkout_status') return { enabled: true, mode: 'test', merchantId: 'merchant-fixture' }
    if (name === 'shop_xpay_order_create' || name === 'shop_xpay_server_order') return order
    if (name === 'shop_xpay_order_read') return [order]
    if (name === 'shop_xpay_prepare_session') { order = { ...order, sessionRequest: args.p_body }; return order }
    if (name === 'shop_xpay_bind_session') { order = { ...order, sessionId: session.id, url: session.url, state: 'open' }; return order }
    if (name === 'shop_xpay_apply_session') { order = { ...order, sessionId: session.id, state: args.p_session.paymentStatus === 'paid' ? 'paid' : args.p_session.status === 'complete' ? 'pending' : 'open' }; return order }
    if (name === 'shop_xpay_inbox_receive') return { processed: dedup }
    if (name === 'shop_xpay_reconcile_candidates') return [order]
    throw new Error('unexpected rpc')
  }
  const fetchImpl = async (url, options) => { providerCalls.push({ url, options }); return Response.json(url.endsWith('/account') ? { id: 'merchant-fixture', livemode: false, livePaymentsEnabled: false, supportedCurrencies: [{ code: 'EGP', decimals: 2, paymentMethodTypes: ['card'] }], apiKey: { type: 'SECRET', mode: 'test', permissions: ['CHECKOUT_SESSIONS_READ', 'CHECKOUT_SESSIONS_WRITE'] } } : providerSession) }
  return { env, rpc, fetchImpl, authenticate: async () => true, authorizeServer: async () => true, calls, providerCalls }
}
function webhook(event = { id: 'evt_fixture', type: 'checkout.session.completed', data: { object: paid } }) {
  const body = JSON.stringify(event), timestamp = Math.floor(Date.now() / 1000)
  const signature = createHmac('sha256', vars.XPAY_WEBHOOK_SECRET).update(`${timestamp}.${body}`).digest('hex')
  return new Request('https://edge.example/webhook', { method: 'POST', headers: { 'xpay-signature': `t=${timestamp},v1=${signature}` }, body })
}

test('missing merchant setup does no Auth, RPC or provider I/O', async () => {
  const f = fixture(), handler = createXPayCheckout({ ...f, env: () => undefined })
  assert.equal((await handler(checkoutRequest())).status, 503)
  assert.equal(f.calls.length + f.providerCalls.length, 0)
})
test('cross-origin checkout, unauthenticated caller and client amount tampering fail closed', async () => {
  const f = fixture()
  const hostile = new Request('https://edge.example', { method: 'POST', headers: { origin: 'https://evil.example' }, body: '{}' })
  assert.equal((await createXPayCheckout(f)(hostile)).status, 403)
  assert.equal((await createXPayCheckout({ ...f, authenticate: async () => false })(checkoutRequest())).status, 401)
  assert.equal((await createXPayCheckout(f)(checkoutRequest({ amount: 1 }))).status, 409)
  assert.equal(f.calls.length + f.providerCalls.length, 0)
})
test('checkout forwards user token to quote RPC, persists provider body and strips private response fields', async () => {
  const f = fixture(), result = await createXPayCheckout(f)(checkoutRequest())
  assert.equal(result.status, 200)
  const body = await result.json()
  assert.equal(body.url, session.url)
  assert.equal(body.orderId, id)
  assert.equal(f.calls[0].caller, 'Bearer user-token')
  assert.equal(f.calls.find(c => c.name === 'shop_xpay_prepare_session').args.p_body.expiresAfterMinutes, 30)
  const bind = f.calls.find(c => c.name === 'shop_xpay_bind_session')
  assert.equal('clientSecret' in bind.args.p_session, false)
  assert.equal('customer' in bind.args.p_session, false)
  assert.equal('clientSecret' in body, false)
  assert.equal(f.providerCalls.find(c => c.options.method === 'POST').options.headers['Idempotency-Key'], id)
})
test('lost bind retries the persisted order key, not a second logical checkout', async () => {
  const f = fixture({ failedRpc: 'shop_xpay_bind_session' })
  const handler = createXPayCheckout(f)
  assert.equal((await handler(checkoutRequest())).status, 409)
  assert.equal((await handler(checkoutRequest())).status, 409)
  assert.deepEqual(f.providerCalls.filter(c => c.options.method === 'POST').map(c => c.options.headers['Idempotency-Key']), [id, id])
})
test('paid replay of an uncertain creation is fulfilled from authenticated GET, never return-page JSON', async () => {
  const f = fixture({ providerSession: paid })
  assert.equal((await createXPayCheckout(f)(checkoutRequest())).status, 200)
  assert.equal(f.calls.some(c => c.name === 'shop_xpay_apply_session'), true)
  assert.equal(f.providerCalls.some(c => c.url.endsWith(session.id)), true)
})
test('forged webhook does not enqueue or grant anything', async () => {
  const f = fixture()
  const request = new Request('https://edge.example', { method: 'POST', headers: { 'xpay-signature': 't=1,v1=bad' }, body: '{}' })
  assert.equal((await createXPayWebhook(f)(request)).status, 400)
  assert.equal(f.calls.length + f.providerCalls.length, 0)
})
test('signed paid event with provider unpaid result remains pending', async () => {
  const f = fixture({ providerSession: { ...session, status: 'complete' } })
  assert.equal((await createXPayWebhook(f)(webhook())).status, 200)
  const apply = f.calls.find(c => c.name === 'shop_xpay_apply_session')
  assert.equal(apply.args.p_session.paymentStatus, 'unpaid')
  assert.equal('clientSecret' in apply.args.p_session, false)
})
test('duplicate durable event acknowledges without additional provider lookup or grant', async () => {
  const f = fixture({ dedup: true })
  assert.equal((await createXPayWebhook(f)(webhook())).status, 200)
  assert.equal(f.providerCalls.length, 0)
  assert.equal(f.calls.some(c => c.name === 'shop_xpay_apply_session'), false)
})
test('fulfillment failure returns retry status after durable inbox, never falsely acknowledges success', async () => {
  const f = fixture({ providerSession: paid, failedRpc: 'shop_xpay_apply_session' })
  const result = await createXPayWebhook(f)(webhook())
  assert.equal(result.status, 503)
  assert.equal(f.calls.some(c => c.name === 'shop_xpay_inbox_receive'), true)
  assert.doesNotMatch(await result.text(), /private SQL|clientSecret|sk_test/)
})
test('paid amount, merchant and environment mismatches are never applied', async () => {
  for (const patch of [{ amountTotal: 1 }, { merchantId: 'other' }, { livemode: true }]) {
    const f = fixture({ providerSession: { ...paid, ...patch } })
    assert.equal((await createXPayWebhook(f)(webhook())).status, 503)
    assert.equal(f.calls.some(c => c.name === 'shop_xpay_apply_session'), false)
  }
})
test('late expiry event retrieves paid current state and delegates idempotent fulfillment', async () => {
  const f = fixture({ providerSession: paid })
  const event = { id: 'evt_expired', type: 'checkout.session.expired', data: { object: { ...session, status: 'expired' } } }
  assert.equal((await createXPayWebhook(f)(webhook(event))).status, 200)
  assert.equal(f.calls.find(c => c.name === 'shop_xpay_apply_session').args.p_session.paymentStatus, 'paid')
})
test('server reconciliation rejects customer credentials before reading candidates', async () => {
  const f = fixture(), handler = createXPayReconciliation({ ...f, authorizeServer: async () => false })
  assert.equal((await handler(new Request('https://edge.example', { method: 'POST' }))).status, 403)
  assert.equal(f.calls.length, 0)
})
test('uncertain old creation is reported unresolved without a blind provider POST', async () => {
  const f = fixture()
  const rpc = async (name, ...args) => name === 'shop_xpay_reconcile_candidates'
    ? [{ ...baseOrder, sessionRequest: {}, createdAt: '2020-01-01' }] : f.rpc(name, ...args)
  const result = await createXPayReconciliation({ ...f, rpc })(new Request('https://edge.example', { method: 'POST' }))
  assert.equal(result.status, 503)
  assert.deepEqual(await result.json(), { processed: 0, unresolved: 1 })
  assert.equal(f.providerCalls.length, 0)
})

test('other merchant-account checkouts without a Shop order are ignored after signature verification', async () => {
  const f = fixture()
  const event = { id: 'evt_other_product', type: 'checkout.session.completed', data: { object: { ...paid, metadata: {} } } }
  assert.equal((await createXPayWebhook(f)(webhook(event))).status, 200)
  assert.equal(f.calls.length + f.providerCalls.length, 0)
})
test('a held payment is reported unresolved by server reconciliation', async () => {
  const f = fixture({ providerSession: paid })
  const rpc = async (name, ...args) => name === 'shop_xpay_reconcile_candidates'
    ? [{ ...baseOrder, sessionId: session.id }] : name === 'shop_xpay_apply_session' ? { ...baseOrder, state: 'requires_review' } : f.rpc(name, ...args)
  const result = await createXPayReconciliation({ ...f, rpc })(new Request('https://edge.example', { method: 'POST' }))
  assert.equal(result.status, 503)
  assert.deepEqual(await result.json(), { processed: 0, unresolved: 1 })
})

test('unknown private-offer creation near expiry never opens a late provider session', async () => {
  const f = fixture()
  const rpc = async (name, ...args) => name === 'shop_xpay_reconcile_candidates'
    ? [{ ...baseOrder, sessionRequest: {}, quote: { offerBinding: { expiresAt: '2020-01-01' } } }] : f.rpc(name, ...args)
  const result = await createXPayReconciliation({ ...f, rpc })(new Request('https://edge.example', { method: 'POST' }))
  assert.equal(result.status, 503)
  assert.equal(f.providerCalls.length, 0)
})
test('server-only dashboard session recovery uses authenticated provider GET and verifies order binding', async () => {
  const f = fixture({ providerSession: paid })
  const result = await createXPayReconciliation(f)(new Request('https://edge.example', { method: 'POST', body: JSON.stringify({ orderId: id, sessionId: session.id }) }))
  assert.equal(result.status, 200)
  assert.equal(f.providerCalls.length, 1)
  assert.equal(f.providerCalls[0].options.method, undefined)
  assert.equal(f.calls.find(call => call.name === 'shop_xpay_apply_session').args.p_session.paymentStatus, 'paid')
  const other = await createXPayReconciliation(f)(new Request('https://edge.example', { method: 'POST', body: JSON.stringify({ orderId: shop, sessionId: session.id }) }))
  assert.equal(other.status, 503)
})

test('availability verifies merchant capabilities without preparing or charging', async () => {
 const f=fixture(), result=await createXPayCheckout(f)(checkoutRequest({action:'status'}))
 assert.equal(result.status,200)
 assert.equal((await result.json()).ready,true)
 assert.deepEqual(f.providerCalls.map(c=>c.url),['https://api.xpay.app/account'])
 assert.equal(f.calls.some(c=>/order_create|prepare|apply/.test(c.name)),false)
})
test('disabled database capability prevents provider I/O and creation', async () => {
 const f=fixture(), rpc=async(name,...args)=>name==='shop_xpay_checkout_status'?{enabled:false}:f.rpc(name,...args)
 assert.equal((await createXPayCheckout({...f,rpc})(checkoutRequest())).status,409)
 assert.equal(f.providerCalls.length,0)
 assert.equal(f.calls.length,0)
})
test('wrong merchant or unsupported currency/permissions fails before a quote or charge', async () => {
 for(const account of [{id:'other'}, {id:'merchant-fixture',livemode:false,apiKey:{type:'SECRET',mode:'test',permissions:[]},supportedCurrencies:[{code:'EGP',decimals:2,paymentMethodTypes:['card']}]}]) {
 const f=fixture(), result=await createXPayCheckout({...f,fetchImpl:async()=>Response.json(account)})(checkoutRequest())
 assert.equal(result.status,409)
 assert.equal(f.calls.some(c=>c.name==='shop_xpay_order_create'),false)
 }
})
test('production origin cannot credit test-mode payments or cross-project results',async()=>{
 const f=fixture()
 for(const patch of [{SHOP_BILLING_RETURN_ORIGIN:'https://shop.building-suit.com'}, {SUPABASE_URL:'https://fgdzjnsbcxfbiuogbmom.supabase.co'}]) {
 assert.equal((await createXPayCheckout({...f,env:name=>patch[name]??vars[name]})(checkoutRequest())).status,503)
 }
 assert.equal(f.calls.length+f.providerCalls.length,0)
})
test('reconciliation recovers a quote before dispatch died while keeping its original key',async()=>{
 const f=fixture()
 const result=await createXPayCheckout(f)(checkoutRequest({orderId:id}))
 assert.equal(result.status,200)
 assert.equal(f.calls.some(c=>c.name==='shop_xpay_prepare_session'),true)
 assert.equal(f.providerCalls.find(c=>c.options.method==='POST').options.headers['Idempotency-Key'],id)
})

test('unconfigured checkout preflight and POST preserve pinned CORS without enabling payment', async () => {
  for (const missing of ['XPAY_SECRET_KEY', 'SHOP_BILLING_RETURN_ORIGIN']) {
    const f = fixture()
    const handler = createXPayCheckout({ ...f, env: name => name === missing ? undefined : vars[name] })
    const preflight = await handler(new Request('https://edge.example/checkout', { method: 'OPTIONS', headers: { origin: vars.SHOP_BILLING_RETURN_ORIGIN, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,apikey,content-type,x-client-info' } }))
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers.get('access-control-allow-origin'), vars.SHOP_BILLING_RETURN_ORIGIN)
    for (const header of ['authorization', 'apikey', 'content-type', 'x-client-info']) assert.ok(preflight.headers.get('access-control-allow-headers').includes(header))
    const result = await handler(checkoutRequest({ action: 'status' }))
    assert.equal(result.status, 503)
    assert.equal(result.headers.get('access-control-allow-origin'), vars.SHOP_BILLING_RETURN_ORIGIN)
    assert.equal(result.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await result.json(), { error: 'checkout_unavailable' })
    assert.deepEqual(f.calls, [])
    assert.deepEqual(f.providerCalls, [])
  }
})

test('unconfigured CORS rejects foreign origins and mismatched project/origin pins', async () => {
  const f = fixture()
  const handler = createXPayCheckout({ ...f, env: name => name === 'XPAY_SECRET_KEY' ? undefined : vars[name] })
  const denied = await handler(new Request('https://edge.example', { method: 'OPTIONS', headers: { origin: 'https://attacker.example' } }))
  assert.equal(denied.status, 403)
  assert.equal(denied.headers.get('access-control-allow-origin'), null)
  for (const patch of [{ SUPABASE_URL: 'https://other-project.supabase.co' }, { SHOP_BILLING_RETURN_ORIGIN: 'https://shop.building-suit.com' }, { SHOP_BILLING_RETURN_ORIGIN: 'https://stg.shop.building-suit.com/unsafe' }]) {
    const invalid = createXPayCheckout({ ...f, env: name => name in patch ? patch[name] : vars[name] })
    const result = await invalid(new Request('https://edge.example', { method: 'OPTIONS', headers: { origin: vars.SHOP_BILLING_RETURN_ORIGIN } }))
    assert.equal(result.status, 503)
    assert.equal(result.headers.get('access-control-allow-origin'), null)
  }
  assert.deepEqual(f.calls, [])
  assert.deepEqual(f.providerCalls, [])
})

test('historical manual review returns actionable409without creating a provider session', async () => {
  const f = fixture()
  const rpc = async (...args) => {
    if (args[0] === 'shop_xpay_order_create') throw Object.assign(new Error('xpay_rpc_failed'), { checkoutCode: 'checkout_historical_review_pending' })
    return f.rpc(...args)
  }
  const response = await createXPayCheckout({ ...f, rpc })(checkoutRequest({ requestId: id, shopId: shop, catalogTermsId: terms, locale: 'en' }))
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: 'checkout_historical_review_pending', retrySafe: false })
  assert.equal(f.providerCalls.some(call => call.url.includes('/checkout/sessions')), false)
})
