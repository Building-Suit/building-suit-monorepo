import test from 'node:test'
import assert from 'node:assert/strict'
import { checkoutSnapshot } from '../../app/utils/checkout-state.mjs'
const order = (state, extra = {}) => ({ orderId: 'order-1', state, createdAt: '2026-10-13T18:44:00Z', sessionId: 'cs_test_saved', url: state === 'open' ? 'https://checkout.xpay.app/c/cs_test_saved' : null, ...extra })
const state = (orders, extra = {}) => checkoutSnapshot({ orders, current: null, historyKnown: true, accessState: 'trialing', checking: false, error: false, ...extra })
test('two legitimately paid terms show active success and cannot create an accidental third purchase', () => {
  const result = state([order('paid', { orderId: 'order-2', createdAt: '2026-10-13T20:06:44Z' }), order('paid')], { accessState: 'active' })
  assert.equal(result.phase, 'confirmed'); assert.equal(result.canStart, false); assert.equal(result.latestPaid.orderId, 'order-2')
})
test('unresolved payment always blocks a NEW purchase, even with prior active access', () => {
  for (const status of ['creating', 'open', 'pending', 'requires_review']) {
    const result = state([order(status), order('paid', { orderId: 'earlier', createdAt: '2026-10-12T00:00:00Z' })], { accessState: 'active' })
    assert.equal(result.canStart, false); assert.notEqual(result.phase, 'confirmed')
  }
})
test('a paid order cannot be shown as active until canonical subscription access is active', () => {
  assert.equal(state([order('paid')]).phase, 'confirming')
  assert.equal(state([order('pending')], { accessState: 'active' }).phase, 'confirming')
})
test('late paid history wins over stale open response; paid response wins over stale history', () => {
  assert.equal(state([order('paid')], { current: order('open'), accessState: 'active' }).phase, 'confirmed')
  assert.equal(state([order('open')], { current: order('paid'), accessState: 'active' }).phase, 'confirmed')
})
test('return/reload uncertainty never defaults to another purchase; verified terminal failure can retry', () => {
  assert.equal(state([], { historyKnown: false }).canStart, false)
  assert.equal(state([], { error: true }).canStart, false)
  for (const status of ['failed', 'expired']) assert.equal(state([order(status)]).canStart, true)
})
test('resume requires a verified current open session; readiness rechecks do not erase confirmed access', () => {
  assert.equal(state([order('open')]).phase, 'confirming')
  assert.equal(state([order('open')], { current: order('open') }).phase, 'resume')
  assert.equal(state([order('paid')], { accessState: 'active', checking: true, error: true }).phase, 'confirmed')
})
test('an expired historical paid term can renew; a recent paid result with stale expired access cannot repurchase', () => {
  const expired = { accessState: 'read_only', periodEnd: '2026-10-01T00:00:00Z', now: Date.parse('2026-10-13T00:00:00Z') }
  assert.equal(state([order('paid', { createdAt: '2025-10-01T00:00:00Z' })], expired).canStart, true)
  assert.equal(state([order('paid')], expired).canStart, false)
})
