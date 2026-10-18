// Only this authorized RPC's exact domain failure may cross the API boundary.
export function checkoutRpcError(name, status, payload) {
  const error = new Error('xpay_rpc_failed')
  if ((name === 'shop_xpay_order_create' || name.startsWith('shop_xpay_proration_')) && [400, 409, 500].includes(status)
    && payload?.code === '55000' && payload?.message === 'XPAY_HISTORICAL_REVIEW_OPEN') {
    error.checkoutCode = 'checkout_historical_review_pending'
  }
  const codes = {
    SHOP_CHANGE_AT_PERIOD_END: 'checkout_change_at_period_end',
    XPAY_ACTIVE_PERIOD_EXISTS: 'checkout_active_period_exists',
    SHOP_PRORATION_QUOTE_STALE: 'checkout_quote_stale', SHOP_PRORATION_QUOTE_OPEN: 'checkout_quote_open',
    SHOP_PRORATION_PERIOD_UNSUPPORTED: 'checkout_period_unsupported', XPAY_CURRENCY_UNSUPPORTED: 'checkout_currency_unsupported',
    SHOP_PRORATION_CREDIT_CONFIRMATION_REQUIRED: 'checkout_credit_confirmation_required', SHOP_PRORATION_PAYMENT_UNRESOLVED: 'checkout_payment_unresolved',
    SHOP_PRORATION_REFUND_REVIEW_REQUIRED: 'checkout_payment_unresolved',
    SHOP_PRORATION_NOT_ENABLED: 'checkout_proration_unavailable', SHOP_PRORATION_CURRENCY_MISMATCH: 'checkout_currency_unsupported',
    XPAY_OFFER_EXPIRING: 'checkout_offer_expiring', PLAN_CHANGE_BLOCKED: 'checkout_plan_change_blocked', SHOP_PRORATION_QUOTE_REQUIRED: 'checkout_quote_required',
  }
  if ((name === 'shop_xpay_order_create' || name.startsWith('shop_xpay_proration_')) && [400,409,500].includes(status)
    && ['55000','22023','23514'].includes(payload?.code) && Object.hasOwn(codes, payload?.message || '')) error.checkoutCode = codes[payload.message]
  return error
}
