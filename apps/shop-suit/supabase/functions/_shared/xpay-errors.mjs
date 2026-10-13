// Only this authorized RPC's exact domain failure may cross the API boundary.
export function checkoutRpcError(name, status, payload) {
  const error = new Error('xpay_rpc_failed')
  if (name === 'shop_xpay_order_create' && [400, 409, 500].includes(status)
    && payload?.code === '55000' && payload?.message === 'XPAY_HISTORICAL_REVIEW_OPEN') {
    error.checkoutCode = 'checkout_historical_review_pending'
  }
  return error
}
