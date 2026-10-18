import test from 'node:test'
import assert from 'node:assert/strict'
import { checkoutAttempt, checkoutAttemptKey, parseXPayOrder, parseXPayDatabaseOrders, xpayHostedUrl } from '../../app/utils/xpay-checkout.mjs'
const order = { orderId: '11111111-1111-4111-8111-111111111111', state: 'open', currency: 'EGP', amountMinor: 34900, planName: 'Solo', createdAt: '2026-10-13T12:00:00Z', sessionId: 'cs_test_fixture', url: 'https://checkout.xpay.app/c/cs_test_fixture' }
test('only the exact provider session URL may leave the app', () => {
  assert.equal(xpayHostedUrl(order.url, order.sessionId), order.url)
  for (const url of ['https://checkout.xpay.app.evil.test/c/cs_test_fixture', 'https://evil.test/c/cs_test_fixture', `${order.url}?redirect=evil`, `${order.url}#token`, 'https://u:p@checkout.xpay.app/c/cs_test_fixture', 'javascript:alert(1)', 'https://checkout.xpay.app/c/cs_test_other']) assert.throws(() => parseXPayOrder({ ...order, url }))
})
test('invalid payment authority fails closed and response secrets are never retained', () => {
  for (const patch of [{ state: 'success' }, { amountMinor: -1 }, { amountMinor: 1.5 }, { currency: 'EUR' }, { orderId: 'redirect-success' }, { createdAt: 'invalid' }]) assert.throws(() => parseXPayOrder({ ...order, ...patch }))
  assert.equal('clientSecret' in parseXPayOrder({ ...order, clientSecret: 'secret', customer: { email: 'private' } }), false)
  assert.throws(() => parseXPayDatabaseOrders(new Array(21).fill(order)))
})
test('retries persist the same request identity, scoped to owner/shop and selection', () => {
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }
  let created = 0
  const create = () => { created++; return order.orderId }
  const key = checkoutAttemptKey('owner', 'shop')
  assert.equal(checkoutAttempt(storage, key, 'terms:monthly', create), order.orderId)
  assert.equal(checkoutAttempt(storage, key, 'terms:monthly', create), order.orderId)
  assert.equal(created, 1)
  checkoutAttempt(storage, key, 'terms:annual', create)
  checkoutAttempt(storage, checkoutAttemptKey('owner', 'other-shop'), 'terms:annual', create)
  assert.equal(created, 3)
  assert.match(values.get(key), /requestId/)
  assert.doesNotMatch(values.get(key), /redemptionToken|secret|customer/)
})

test('safe historical-review code survives function HTTP errors without forwarding SQL details', async () => {
  const { checkoutFailureCode } = await import('../../app/utils/xpay-checkout.mjs')
  const context = Response.json({ error: 'checkout_historical_review_pending', details: 'must never display' }, { status: 409 })
  assert.equal(await checkoutFailureCode(null, { context }), 'checkout_historical_review_pending')
  assert.equal(await checkoutFailureCode({ error: 'XPAY_HISTORICAL_REVIEW_OPEN' }, null), null)
  assert.equal(await checkoutFailureCode(null, { context: new Response('private SQL text', { status: 500 }) }), null)
})
