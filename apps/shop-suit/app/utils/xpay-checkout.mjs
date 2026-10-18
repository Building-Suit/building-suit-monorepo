const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const states = new Set(['creating', 'open', 'pending', 'expired', 'failed', 'paid', 'requires_review'])
export const isXPayOrderId = value => typeof value === 'string' && uuid.test(value)
export function xpayHostedUrl(value, sessionId) {
  if (typeof value !== 'string' || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId || '')) throw new Error('invalid_checkout_url')
  const url = new URL(value)
  if (url.origin !== 'https://checkout.xpay.app' || url.pathname !== `/c/${sessionId}` || url.username || url.password || url.search || url.hash) throw new Error('invalid_checkout_url')
  return url.href
}
function parseMoneyTracks(value, order) {
  if (value == null) return null // Historical EGP receipts predate paired snapshots.
  const p = value.processing, c = value.presentment, fx = value.exchangeRate
  if (p?.currency !== 'EGP' || !Number.isSafeInteger(p.amountMinor) || p.amountMinor <= 0
    || c?.currency !== order.currency || c.amountMinor !== order.amountMinor
    || (order.currency === 'EGP' ? p.amountMinor !== c.amountMinor || fx != null
      : typeof fx?.id !== 'string' || !fx.id || fx.id.length > 255 || typeof fx.rate !== 'number' || !Number.isFinite(fx.rate) || fx.rate <= 0)) throw new Error('invalid_checkout_money')
  return { processing: { currency: 'EGP', amountMinor: p.amountMinor }, presentment: { currency: c.currency, amountMinor: c.amountMinor }, exchangeRate: fx == null ? null : { id: fx.id, rate: fx.rate } }
}
export function parseXPayOrder(value) {
  if (!value || !isXPayOrderId(value.orderId) || !states.has(value.state) || !['EGP','USD'].includes(value.currency)
    || !Number.isSafeInteger(value.amountMinor) || value.amountMinor <= 0 || typeof value.planName !== 'string' || !value.planName
    || (value.refundedAmountMinor != null && (!Number.isSafeInteger(value.refundedAmountMinor) || value.refundedAmountMinor < 0 || value.refundedAmountMinor > value.amountMinor))
    || (value.quoteId != null && !isXPayOrderId(value.quoteId)) || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) throw new Error('invalid_checkout_order')
  return { orderId: value.orderId, state: value.state, amountMinor: value.amountMinor, currency: value.currency, planName: value.planName,
    moneyTracks: parseMoneyTracks(value.moneyTracks, value), refundedAmountMinor: value.refundedAmountMinor ?? 0,
    sessionId: value.sessionId ?? null, url: value.url == null ? null : xpayHostedUrl(value.url, value.sessionId),
    expiresAt: typeof value.expiresAt === 'string' ? value.expiresAt : null, createdAt: value.createdAt, ...(value.quoteId ? { quoteId: value.quoteId } : {}) }
}
export function parseXPayDatabaseOrders(value) {
  if (!Array.isArray(value) || value.length > 20) throw new Error('invalid_checkout_history')
  return value.map(order => parseXPayOrder({ orderId: order.id, state: order.state, amountMinor: order.amountMinor, currency: order.currency,
    planName: order.description, sessionId: order.sessionId, url: order.state === 'open' ? order.url : null, expiresAt: order.expiresAt, createdAt: order.createdAt, quoteId: order.quote?.prorationQuoteId, moneyTracks: order.moneyTracks, refundedAmountMinor: order.refundedAmountMinor }))
}
export function checkoutAttemptKey(userId, shopId) { return `shop-xpay-attempt:${userId}:${shopId}` }
export function checkoutAttempt(storage, key, selection, createId) {
  try {
    const previous = JSON.parse(storage.getItem(key) || 'null')
    if (previous?.selection === selection && isXPayOrderId(previous.requestId)) return previous.requestId
  } catch { /* Storage is a convenience, never payment authority. */ }
  const requestId = createId()
  try { storage.setItem(key, JSON.stringify({ requestId, selection })) } catch { /* Safe server order recovery still works. */ }
  return requestId
}

export async function checkoutFailureCode(data, error) {
  let payload = data
  if (error?.context instanceof Response) {
    try { payload = await error.context.clone().json() } catch { /* Generic safe fallback. */ }
  }
  return ['checkout_change_at_period_end', 'checkout_active_period_exists','checkout_historical_review_pending','checkout_quote_stale','checkout_quote_open','checkout_credit_confirmation_required','checkout_payment_unresolved','checkout_proration_unavailable','checkout_currency_unsupported','checkout_offer_expiring','checkout_plan_change_blocked','checkout_quote_required','checkout_payment_method_unsupported','checkout_period_unsupported'].includes(payload?.error) ? payload.error : null
}
