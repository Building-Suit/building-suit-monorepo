import test from 'node:test'
import assert from 'node:assert/strict'
import { checkoutRpcError } from '../../supabase/functions/_shared/xpay-errors.mjs'
const payload = { code: '55000', message: 'XPAY_HISTORICAL_REVIEW_OPEN', details: 'private detail' }
test('only exact owner-authorized creation domain failure maps; no arbitrary SQL or authorization details leak', () => {
  const safe = checkoutRpcError('shop_xpay_order_create', 400, payload)
  assert.equal(safe.checkoutCode, 'checkout_historical_review_pending')
  assert.equal(safe.message, 'xpay_rpc_failed')
  assert.equal(safe.details, undefined)
  for (const [name, status, data] of [
    ['shop_xpay_order_read', 400, payload], ['shop_xpay_order_create', 403, payload],
    ['shop_xpay_order_create', 400, { ...payload, code: '42501' }],
    ['shop_xpay_order_create', 400, { ...payload, message: `${payload.message}: private` }],
    ['shop_xpay_order_create', 500, null],
  ]) assert.equal(checkoutRpcError(name, status, data).checkoutCode, undefined)
})
