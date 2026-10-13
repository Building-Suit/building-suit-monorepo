// Contract: https://docs.xpay.app/en/integrate/integration-patterns/hosted-checkout
// This server-only adapter does not authorize a tenant or grant entitlements.
const API = 'https://api.xpay.app'
const encoder = new TextEncoder()

function requiredText(value) {
  if (typeof value !== 'string' || !value || value.length > 255) throw new Error('xpay_invalid_input')
  return value
}

export function egpMinorUnits(amount) {
  // Shop prices are decimal EGP; never silently round an invalid price.
  const text = String(amount)
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(text)) throw new Error('xpay_invalid_amount')
  const [whole, fraction = ''] = text.split('.')
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(minor) || minor <= 0) throw new Error('xpay_invalid_amount')
  return minor
}

function secureReturnUrl(value) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('xpay_invalid_return_url')
  return value
}

export function checkoutBody(order, { returnUrl, cancelUrl, locale = 'en' }) {
  // order MUST be a persisted server-authorized quote, never browser JSON.
  if (!order || order.currency !== 'EGP' || !Number.isSafeInteger(order.amountMinor) || order.amountMinor <= 0
    || !['en', 'ar'].includes(locale)) throw new Error('xpay_invalid_quote')
  return {
    mode: 'payment', uiMode: 'hosted', currency: 'EGP', locale,
    expiresAfterMinutes: 30,
    afterCompletion: { type: 'redirect', redirect: { url: secureReturnUrl(returnUrl) } },
    cancelUrl: secureReturnUrl(cancelUrl),
    allowPromotionCodes: false,
    lineItems: [{ priceData: { currency: 'EGP', unitAmount: order.amountMinor,
      productData: { name: requiredText(order.description) } }, quantity: 1 }],
    metadata: { orderId: requiredText(order.id) },
    // Freeze the exact quote: account defaults must not add customer fees/VAT.
    feeConfig: { feesPassThrough: false, vatCollectionEnabled: false },
  }
}

function validKey(secretKey, mode) {
  if (!['test', 'live'].includes(mode) || typeof secretKey !== 'string'
    || !secretKey.startsWith(`sk_${mode}_`)) throw new Error('xpay_not_configured')
}

// API 1.0 permits a nullable flat ID and an expanded PaymentIntent. IDs are
// opaque pi_* values; environment authority comes from authenticated livemode.
export function paymentIntentId(session) {
  const flat = session.paymentIntentId
  const nested = session.paymentIntent?.id
  const present = value => value !== undefined && value !== null
  const valid = value => typeof value === 'string' && value.length <= 255 && /^pi_[A-Za-z0-9_]+$/.test(value)
  if ((present(flat) && !valid(flat)) || (present(nested) && !valid(nested))
    || (present(flat) && present(nested) && flat !== nested)) throw new Error('xpay_payment_not_verified')
  return flat ?? nested ?? null
}

export function validateSession(session, order, mode, { paid = false } = {}) {
  if (!order || typeof order.id !== 'string' || !order.id
    || typeof order.merchantId !== 'string' || !order.merchantId
    || order.currency !== 'EGP' || !Number.isSafeInteger(order.amountMinor) || order.amountMinor <= 0
    || !session || !['test', 'live'].includes(mode) || session.object !== 'checkout.session'
    || typeof session.id !== 'string' || !session.id.startsWith(`cs_${mode}_`)
    || session.livemode !== (mode === 'live') || session.merchantId !== order.merchantId
    || session.metadata?.orderId !== order.id || session.currency !== order.currency
    || session.amountTotal !== order.amountMinor || !Number.isSafeInteger(session.amountTotal)
    || (order.sessionId && session.id !== order.sessionId)) throw new Error('xpay_session_mismatch')
  const intentId = paymentIntentId(session)
  if (paid && (session.status !== 'complete' || session.paymentStatus !== 'paid'
    || intentId === null)) {
    throw new Error('xpay_payment_not_verified')
  }
  return session
}

export async function createProviderSession({ order, secretKey, mode, returnUrl, cancelUrl, locale, fetchImpl = fetch }) {
  validKey(secretKey, mode)
  const body = order.sessionRequest ?? checkoutBody(order, { returnUrl, cancelUrl, locale })
  const response = await fetchImpl(`${API}/checkout/sessions`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { authorization: `Bearer ${secretKey}`, 'content-type': 'application/json',
      'Idempotency-Key': requiredText(order.idempotencyKey) }, body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('xpay_session_create_failed')
  return validateSession(await response.json(), order, mode)
}

export async function createCheckout(options) {
  const session = await createProviderSession(options)
  const url = new URL(session.url)
  if (url.origin !== 'https://checkout.xpay.app' || url.username || url.password
    || url.pathname !== `/c/${session.id}` || session.status !== 'open' || session.isExpired !== false) {
    throw new Error('xpay_checkout_unavailable')
  }
  // Deliberately omit clientSecret, customer details and full provider responses.
  return { sessionId: session.id, url: url.href, expiresAt: session.expiresAt }
}

export async function retrieveSession({ sessionId, secretKey, mode, fetchImpl = fetch }) {
  validKey(secretKey, mode)
  if (typeof sessionId !== 'string' || !new RegExp(`^cs_${mode}_[A-Za-z0-9]+$`).test(sessionId)) throw new Error('xpay_invalid_session')
  const response = await fetchImpl(`${API}/checkout/sessions/${sessionId}`, {
    redirect: 'error', signal: AbortSignal.timeout(15000), headers: { authorization: `Bearer ${secretKey}` },
  })
  if (!response.ok) throw new Error('xpay_session_read_failed')
  return response.json()
}

// Official API 1.0 AccountResponse: mode, activation, key permissions and actual
// chargeable currency/method capabilities. No key/customer fields reach clients.
export async function verifyMerchantReadiness({ secretKey, mode, merchantId, fetchImpl = fetch }) {
  validKey(secretKey, mode)
  const response = await fetchImpl(`${API}/account`, { redirect: 'error', signal: AbortSignal.timeout(10000), headers: { authorization: `Bearer ${secretKey}` } })
  if (!response.ok) throw new Error('xpay_account_unavailable')
  const account = await response.json()
  const currency = account.supportedCurrencies?.find(value => value.code === 'EGP')
  if (account.id !== merchantId || account.livemode !== (mode === 'live') || account.apiKey?.mode !== mode || !['SECRET', 'RESTRICTED'].includes(account.apiKey?.type)
    || (mode === 'live' && account.livePaymentsEnabled !== true) || currency?.decimals !== 2 || !Array.isArray(currency.paymentMethodTypes)
    || !currency.paymentMethodTypes.some(method => ['card', 'fawry', 'valu', 'apple_pay'].includes(method))
    || !['CHECKOUT_SESSIONS_READ', 'CHECKOUT_SESSIONS_WRITE'].every(permission => account.apiKey?.permissions?.includes(permission))) throw new Error('xpay_account_not_ready')
  return { ready: true, mode }
}

// Contract: https://docs.xpay.app/en/integrate/webhooks/verifying-signatures
export async function verifyXPayEvent(rawBody, header, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof rawBody !== 'string' || encoder.encode(rawBody).length > 262144
    || typeof header !== 'string' || typeof secret !== 'string' || !secret.startsWith('whsec_')
    || !Number.isSafeInteger(nowSeconds)) throw new Error('xpay_invalid_signature')
  const match = /^t=(\d{1,12}),v1=([a-fA-F0-9]{64})$/.exec(header)
  if (!match || Math.abs(nowSeconds - Number(match[1])) > 300) throw new Error('xpay_invalid_signature')
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const signature = Uint8Array.from(match[2].match(/../g), value => Number.parseInt(value, 16))
  if (!await crypto.subtle.verify('HMAC', key, signature, encoder.encode(`${match[1]}.${rawBody}`))) {
    throw new Error('xpay_invalid_signature')
  }
  let event
  try { event = JSON.parse(rawBody) } catch { throw new Error('xpay_invalid_event') }
  if (!event || typeof event.id !== 'string' || !event.id || event.id.length > 255
    || typeof event.type !== 'string' || !event.data?.object) throw new Error('xpay_invalid_event')
  return event
}

export function paidSessionEvent(event) {
  return ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)
    && event.data?.object?.paymentStatus === 'paid'
}
