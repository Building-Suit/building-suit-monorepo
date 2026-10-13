const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const states = new Set(['creating', 'open', 'pending', 'expired', 'failed', 'paid', 'requires_review'])
export const isXPayOrderId = value => typeof value === 'string' && uuid.test(value)
export function xpayHostedUrl(value, sessionId) {
  if (typeof value !== 'string' || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId || '')) throw new Error('invalid_checkout_url')
  const url = new URL(value)
  if (url.origin !== 'https://checkout.xpay.app' || url.pathname !== `/c/${sessionId}` || url.username || url.password || url.search || url.hash) throw new Error('invalid_checkout_url')
  return url.href
}
export function parseXPayOrder(value) {
  if (!value || !isXPayOrderId(value.orderId) || !states.has(value.state) || value.currency !== 'EGP'
    || !Number.isSafeInteger(value.amountMinor) || value.amountMinor <= 0 || typeof value.planName !== 'string' || !value.planName
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) throw new Error('invalid_checkout_order')
  return { orderId: value.orderId, state: value.state, amountMinor: value.amountMinor, currency: value.currency, planName: value.planName,
    sessionId: value.sessionId ?? null, url: value.url == null ? null : xpayHostedUrl(value.url, value.sessionId),
    expiresAt: typeof value.expiresAt === 'string' ? value.expiresAt : null, createdAt: value.createdAt }
}
export function parseXPayDatabaseOrders(value) {
  if (!Array.isArray(value) || value.length > 20) throw new Error('invalid_checkout_history')
  return value.map(order => parseXPayOrder({ orderId: order.id, state: order.state, amountMinor: order.amountMinor, currency: order.currency,
    planName: order.description, sessionId: order.sessionId, url: order.state === 'open' ? order.url : null, expiresAt: order.expiresAt, createdAt: order.createdAt }))
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
