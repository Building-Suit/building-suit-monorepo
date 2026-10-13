import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { checkoutBody, createCheckout, egpMinorUnits, paidSessionEvent, retrieveSession, validateSession, verifyXPayEvent } from '../../supabase/functions/_shared/xpay.mjs'

const order = { id: 'order-1', idempotencyKey: 'operation-1', merchantId: 'merchant-1', currency: 'EGP', amountMinor: 19990, description: 'Shop monthly' }
const session = { id: 'cs_test_abc', object: 'checkout.session', merchantId: 'merchant-1', livemode: false, metadata: { orderId: order.id }, currency: 'EGP', amountTotal: 19990, status: 'open', paymentStatus: 'unpaid', isExpired: false, url: 'https://checkout.xpay.app/c/cs_test_abc', clientSecret: 'do-not-return' }
const config = { returnUrl: 'https://shop.example/billing', cancelUrl: 'https://shop.example/billing?cancelled=1', locale: 'ar' }
const raw = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: session } })
const secret = 'whsec_testfixture'
const sign = (body = raw, timestamp = 1000) => `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`

test('Shop decimal EGP converts exactly; no precision loss, free or negative payment', () => {
  assert.equal(egpMinorUnits('199.90'), 19990)
  assert.equal(egpMinorUnits(0.01), 1)
  for (const value of [0, -1, '1.001', '1e5', NaN, Infinity, '9007199254740992']) assert.throws(() => egpMinorUnits(value))
})
test('quote fixes price, quantity, currency, fees, metadata and locale', () => {
  const body = checkoutBody(order, config)
  assert.equal(body.lineItems[0].priceData.unitAmount, order.amountMinor)
  assert.equal(body.lineItems[0].quantity, 1)
  assert.equal(body.locale, 'ar')
  assert.equal(body.mode, 'payment')
  assert.equal(body.allowPromotionCodes, false)
  assert.deepEqual(body.metadata, { orderId: order.id })
  assert.deepEqual(body.feeConfig, { feesPassThrough: false, vatCollectionEnabled: false })
  for (const returnUrl of ['http://shop.example', 'https://user:pass@shop.example', 'https://shop.example/#secret']) assert.throws(() => checkoutBody(order, { ...config, returnUrl }))
})
test('create uses official endpoint with stable persisted request key and strips secret', async () => {
  let called = 0
  const fetchImpl = async (url, request) => {
    called++
    assert.equal(url, 'https://api.xpay.app/checkout/sessions')
    assert.equal(request.headers['Idempotency-Key'], order.idempotencyKey)
    assert.equal(request.redirect, 'error')
    return Response.json(session)
  }
  const result = await createCheckout({ order, secretKey: 'sk_test_fixture', mode: 'test', ...config, fetchImpl })
  assert.equal(called, 1)
  assert.equal(result.sessionId, session.id)
  assert.equal('clientSecret' in result, false)
})
test('create rejects mode mismatch, provider errors and hostile redirects', async () => {
  await assert.rejects(createCheckout({ order, secretKey: 'sk_live_fixture', mode: 'test', ...config }))
  await assert.rejects(createCheckout({ order, secretKey: 'sk_test_fixture', mode: 'test', ...config, fetchImpl: async () => new Response('sensitive error', { status: 409 }) }), /xpay_session_create_failed/)
  for (const url of ['https://evil.example/c/cs_test_abc', 'https://checkout.xpay.app/c/other', 'https://user:pass@checkout.xpay.app/c/cs_test_abc']) {
    await assert.rejects(createCheckout({ order, secretKey: 'sk_test_fixture', mode: 'test', ...config, fetchImpl: async () => Response.json({ ...session, url }) }))
  }
})
test('payment must match bound order, merchant, environment, session, amount and currency', () => {
  const paid = { ...session, status: 'complete', paymentStatus: 'paid', paymentIntentId: 'pi_test_abc' }
  assert.equal(validateSession(paid, order, 'test', { paid: true }), paid)
  for (const patch of [{ amountTotal: 1 }, { currency: 'USD' }, { merchantId: 'other' }, { livemode: true }, { id: 'cs_live_abc' }, { metadata: { orderId: 'other' } }, { paymentStatus: 'unpaid' }, { paymentStatus: 'no_payment_required' }, { status: 'open' }, { paymentIntentId: null }]) assert.throws(() => validateSession({ ...paid, ...patch }, order, 'test', { paid: true }))
  assert.throws(() => validateSession(paid, { ...order, sessionId: 'cs_test_other' }, 'test', { paid: true }))
})
test('retrieve rejects session path injection before making a network call', async () => {
  for (const sessionId of ['cs_test_abc/other', 'cs_live_abc', '../keys', 'cs_test_abc?secret']) await assert.rejects(retrieveSession({ sessionId, secretKey: 'sk_test_fixture', mode: 'test' }))
})
test('signature verifies exact raw bytes and fresh delivery timestamp', async () => {
  assert.equal((await verifyXPayEvent(raw, sign(), secret, 1000)).id, 'evt_1')
  await assert.rejects(verifyXPayEvent(raw + ' ', sign(), secret, 1000))
  await assert.rejects(verifyXPayEvent(raw, sign(), 'whsec_wrong', 1000))
  await assert.rejects(verifyXPayEvent(raw, sign(), secret, 1301))
  await assert.rejects(verifyXPayEvent(raw, sign(), secret, 699))
  assert.equal((await verifyXPayEvent(raw, sign(raw, 5000), secret, 5000)).id, 'evt_1')
})
test('malformed, duplicate headers and signed invalid JSON fail closed', async () => {
  for (const header of [null, '', 't=1000,v1=abc', sign() + ',t=1000', sign().replace('1000', '1000junk')]) await assert.rejects(verifyXPayEvent(raw, header, secret, 1000))
  await assert.rejects(verifyXPayEvent('{', sign('{'), secret, 1000), /xpay_invalid_event/)
  await assert.rejects(verifyXPayEvent('{}', sign('{}'), secret, 1000), /xpay_invalid_event/)
})
test('completed unpaid local-method event and unrelated paid events never authorize fulfillment', () => {
  assert.equal(paidSessionEvent(JSON.parse(raw)), false)
  assert.equal(paidSessionEvent({ type: 'checkout.session.async_payment_succeeded', data: { object: { paymentStatus: 'paid' } } }), true)
  assert.equal(paidSessionEvent({ type: 'charge.succeeded', data: { object: { paymentStatus: 'paid' } } }), false)
})

test('documented opaque intent accepts flat, expanded, nullable and matching dual representations', () => {
  for (const fields of [{ paymentIntentId: 'pi_ABC123' }, { paymentIntent: { id: 'pi_ABC123' } },
    { paymentIntentId: null, paymentIntent: { id: 'pi_ABC123' } },
    { paymentIntentId: 'pi_ABC123', paymentIntent: { id: 'pi_ABC123' } }]) {
    validateSession({ ...session, status: 'complete', paymentStatus: 'paid', ...fields }, order, 'test', { paid: true })
  }
})
test('ambiguous or absent payment proof fails closed; intent text never overrides mode', () => {
  for (const fields of [{}, { paymentIntentId: null }, { paymentIntentId: 'pi_A', paymentIntent: { id: 'pi_B' } },
    { paymentIntentId: 5 }, { paymentIntent: { id: 'pi_' } }, { paymentIntentId: 'pi_a/evil' },
    { paymentIntentId: `pi_${'a'.repeat(256)}` }, { paymentIntentId: 'pi_test_valid', livemode: true },
    { paymentIntentId: 'pi_valid', status: 'open' }]) {
    assert.throws(() => validateSession({ ...session, status: 'complete', paymentStatus: 'paid', ...fields }, order, 'test', { paid: true }))
  }
})
