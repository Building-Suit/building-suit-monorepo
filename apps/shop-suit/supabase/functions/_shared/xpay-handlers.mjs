import { checkoutBody, createProviderSession, paidSessionEvent, paymentIntentId, retrieveSession, validateSession, verifyXPayEvent, verifyMerchantReadiness } from './xpay.mjs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const textEncoder = new TextEncoder()
const sessionEvent = type => ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired'].includes(type)

function checkoutOrigin(env, requireReturnOrigin = false) {
  const targets = {
    'https://stg.shop.building-suit.com': { url: 'https://jvvelvftpfnlogalgxgv.supabase.co', mode: 'test' },
    'https://shop.building-suit.com': { url: 'https://fgdzjnsbcxfbiuogbmom.supabase.co', mode: 'live' },
  }
  // Preflight/error responses can use only the existing canonical origin pinned
  // to this server's project. This never enables checkout or reflects input.
  const configured = env('SHOP_BILLING_RETURN_ORIGIN')
  if (requireReturnOrigin && !configured) throw new Error('xpay_not_configured')
  const canonical = Object.keys(targets).find(origin => targets[origin].url === env('SUPABASE_URL'))
  const origin = new URL(configured || canonical || 'https://invalid.example')
  const target = targets[origin.origin]
  if (origin.protocol !== 'https:' || origin.username || origin.password
    || origin.pathname !== '/' || origin.search || origin.hash || !target || target.url !== env('SUPABASE_URL')) throw new Error('xpay_environment_mismatch')
  return { origin: origin.origin, mode: target.mode }
}
function config(env) {
  const mode = env('XPAY_MODE')
  const secretKey = env('XPAY_SECRET_KEY')
  const merchantId = env('XPAY_MERCHANT_ID')
  const target = checkoutOrigin(env, true)
  if (env('XPAY_ENABLED') !== 'true' || env('XPAY_API_VERSION') !== '1.0'
    || !['test', 'live'].includes(mode) || !secretKey?.startsWith(`sk_${mode}_`) || !merchantId
    ) throw new Error('xpay_not_configured')
  // Production must never grant real access from test-mode provider results.
  if (target.mode !== mode) throw new Error('xpay_environment_mismatch')
  return { mode, secretKey, merchantId, origin: target.origin, usdEnabled: env('XPAY_USD_ENABLED') === 'true' }
}

function response(data, status = 200, origin) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store', ...(origin ? {
    'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS',
  } : {}) } })
}
async function json(request) {
  const body = await request.text()
  if (textEncoder.encode(body).length > 8192) throw new Error('xpay_invalid_request')
  const value = JSON.parse(body)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('xpay_invalid_request')
  return value
}
const publicOrder = order => ({ orderId: order.id, state: order.state, sessionId: order.sessionId, url: order.state === 'open' ? order.url : null, expiresAt: order.expiresAt,
  amountMinor: order.amountMinor, currency: order.currency, planName: order.description, createdAt: order.createdAt, moneyTracks: order.moneyTracks ?? null, refundedAmountMinor: order.refundedAmountMinor ?? 0, ...(order.quote?.prorationQuoteId ? { quoteId: order.quote.prorationQuoteId, calculation: order.quote.proration } : {}) })
const databaseSession = session => ({
  id: session.id, object: session.object, merchantId: session.merchantId, livemode: session.livemode,
  currency: session.currency, amountTotal: session.amountTotal, status: session.status, paymentStatus: session.paymentStatus,
  paymentIntentId: paymentIntentId(session), metadata: { orderId: session.metadata?.orderId },
  url: session.url, expiresAt: session.expiresAt, isExpired: session.isExpired,
  presentmentDetails: session.presentmentDetails == null ? null : { currency: session.presentmentDetails.currency, amountTotal: session.presentmentDetails.amountTotal, exchangeRate: session.presentmentDetails.exchangeRate, exchangeRateId: session.presentmentDetails.exchangeRateId },
  processingFeeDetails: { totalDetails: session.totalDetails == null ? null : Object.fromEntries(['amountDiscount','amountShipping','amountTax','amountPlatformFee','amountCollectedVat'].filter(key => Number.isSafeInteger(session.totalDetails[key]) && session.totalDetails[key] >= 0).map(key => [key,session.totalDetails[key]])), fees: session.fees == null ? null : Object.fromEntries(['feeAmount','vatAmount','totalAmount','feePercentage'].filter(key => typeof session.fees[key] === 'number' && Number.isFinite(session.fees[key]) && session.fees[key] >= 0).map(key => [key,session.fees[key]])) },
})
function canRetryCreation(order) {
  if (order.quote?.prorationQuoteId && Date.now() - Date.parse(order.createdAt) > 5 * 60000) throw Object.assign(new Error('xpay_reconciliation_required'), { checkoutCode: 'checkout_payment_unresolved' })
  const expiry = order.quote?.offerBinding?.expiresAt
  if (expiry && Date.parse(expiry) < Date.now() + 31 * 60000) throw new Error('xpay_reconciliation_required')
  if (Date.now() - Date.parse(order.createdAt) >= 23 * 3600000) throw new Error('xpay_reconciliation_required')
}

async function providerOrder(sessionId, settings, rpc, fetchImpl) {
  const session = await retrieveSession({ sessionId, ...settings, fetchImpl })
  const id = session.metadata?.orderId
  if (!UUID.test(id || '') || session.merchantId !== settings.merchantId || session.livemode !== (settings.mode === 'live')) throw new Error('xpay_session_mismatch')
  const order = await rpc('shop_xpay_server_order', { p_order_id: id })
  if (order) validateSession(session, order, settings.mode)
  return { session, order }
}

async function reconcileOrder(order, settings, rpc, fetchImpl, locale = 'en') {
  if (order.merchantId !== settings.merchantId || order.mode !== settings.mode) throw new Error('xpay_session_mismatch')
  if (!order.sessionId) {
    // Provider request dedup expires after 24h. Never create blindly after it.
    canRetryCreation(order)
    if (order.currency === 'USD' && !settings.usdEnabled) throw Object.assign(new Error('xpay_currency_unsupported'), { checkoutCode: 'checkout_currency_unsupported' })
    await verifyMerchantReadiness({ ...settings, fetchImpl, chargeCurrency: order.currency, requireCard: !!order.quote?.prorationQuoteId })
    const body = order.sessionRequest ?? checkoutBody(order, { returnUrl: `${settings.origin}/billing?xpayOrder=${order.id}`, cancelUrl: `${settings.origin}/billing?xpayOrder=${order.id}&cancelled=1`, locale })
    order = await rpc('shop_xpay_prepare_session', { p_order_id: order.id, p_body: body })
    const created = await createProviderSession({ order, ...settings, fetchImpl })
    order = { ...order, sessionId: created.id }
  }
  const session = await retrieveSession({ sessionId: order.sessionId, ...settings, fetchImpl })
  validateSession(session, order, settings.mode)
  return rpc('shop_xpay_apply_session', { p_session: databaseSession(session), p_event_id: null })
}

// Dependencies are injected so contract tests never need credentials or network.
export function createXPayCheckout({ env, rpc, authenticate, fetchImpl = fetch }) {
  return async request => {
    let allowedOrigin
    try { allowedOrigin = checkoutOrigin(env).origin } catch { return response({ error: 'checkout_unavailable' }, 503) }
    const requestOrigin = request.headers.get('origin')
    if (requestOrigin && requestOrigin !== allowedOrigin) return response({ error: 'origin_denied' }, 403)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': allowedOrigin, 'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'Origin' } })
    let settings
    try { settings = config(env) } catch { return response({ error: 'checkout_unavailable' }, 503, allowedOrigin) }
    if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405, settings.origin)
    const token = request.headers.get('authorization')
    try {
      if (!await authenticate(token)) return response({ error: 'sign_in_required' }, 401, settings.origin)
      const body = await json(request)
      if (Object.keys(body).some(key => !['action', 'requestId', 'shopId', 'catalogTermsId', 'privateOffer', 'locale', 'orderId', 'quoteId', 'purchaseIntent', 'priorPaidOrderId'].includes(key))
        || !UUID.test(body.shopId || '') || !['en', 'ar'].includes(body.locale)) throw new Error('xpay_invalid_request')
      if (body.action === 'status') {
        const capability = await rpc('shop_xpay_checkout_status', { p_shop_id: body.shopId }, token)
        if (!capability.enabled || capability.merchantId !== settings.merchantId || capability.mode !== settings.mode) return response({ ready: false, orders: [] }, 200, settings.origin)
        const verified = await verifyMerchantReadiness({ ...settings, fetchImpl })
        const currencies = ['EGP']
        if (settings.usdEnabled && capability.usdEnabled) {
          try { await verifyMerchantReadiness({ ...settings, fetchImpl, chargeCurrency: 'USD' }); currencies.push('USD') } catch { /* Currency remains unavailable; EGP stays usable. */ }
        }
        const orders = await rpc('shop_xpay_order_read', { p_shop_id: body.shopId, p_order_id: null }, token)
        const proration = await rpc('shop_xpay_proration_status', { p_shop_id: body.shopId }, token)
        return response({ ...verified, currencies, creditCurrency: proration.currency, creditBalances: proration.creditBalances ?? {}, prorationEnabled: proration.enabled === true, creditBalanceMinor: proration.creditBalanceMinor, orders: orders.map(publicOrder) }, 200, settings.origin)
      }
      if (body.action === 'quote') {
        if (!UUID.test(body.requestId || '') || (body.catalogTermsId != null && !UUID.test(body.catalogTermsId)) || body.quoteId || body.orderId) throw new Error('xpay_invalid_request')
        const quote = await rpc('shop_xpay_proration_quote', { p_request_id: body.requestId, p_shop_id: body.shopId, p_catalog_terms_id: body.catalogTermsId ?? null, p_private_offer: body.privateOffer ?? null }, token)
        return response(quote, 200, settings.origin)
      }
      if (['read_quote', 'abandon_quote', 'apply_credit'].includes(body.action)) {
        if (!UUID.test(body.quoteId || '') || body.orderId || body.privateOffer || body.catalogTermsId) throw new Error('xpay_invalid_request')
        const name = body.action === 'read_quote' ? 'shop_xpay_proration_read' : body.action === 'abandon_quote' ? 'shop_xpay_proration_abandon' : 'shop_xpay_proration_credit_confirm'
        return response(await rpc(name, { p_shop_id: body.shopId, p_quote_id: body.quoteId }, token), 200, settings.origin)
      }
      if (body.action != null && body.action !== 'pay_quote') throw new Error('xpay_invalid_request')
      if (body.action === 'pay_quote' && (!UUID.test(body.quoteId || '') || body.orderId || body.privateOffer || body.catalogTermsId)) throw new Error('xpay_invalid_request')
      if (body.action == null && body.quoteId) throw new Error('xpay_invalid_request')
      if (body.orderId) {
        if (!UUID.test(body.orderId)) throw new Error('xpay_invalid_request')
        const orders = await rpc('shop_xpay_order_read', { p_shop_id: body.shopId, p_order_id: body.orderId }, token)
        if (orders.length !== 1) return response({ error: 'order_unavailable' }, 404, settings.origin)
        const order = await reconcileOrder(orders[0], settings, rpc, fetchImpl, body.locale)
        return response(publicOrder(order), 200, settings.origin)
      }
      if (!['subscribe', 'renew', 'change'].includes(body.purchaseIntent ?? 'subscribe') || (body.priorPaidOrderId != null && !UUID.test(body.priorPaidOrderId))) throw new Error('xpay_invalid_request')
      if (body.action !== 'pay_quote' && (!UUID.test(body.requestId || '') || (body.catalogTermsId != null && !UUID.test(body.catalogTermsId)))) throw new Error('xpay_invalid_request')
      const capability = await rpc('shop_xpay_checkout_status', { p_shop_id: body.shopId }, token, { purchaseIntent: body.purchaseIntent ?? 'subscribe', priorPaidOrderId: body.priorPaidOrderId ?? null })
      if (!capability.enabled || capability.merchantId !== settings.merchantId || capability.mode !== settings.mode) throw new Error('xpay_not_configured')
      await verifyMerchantReadiness({ ...settings, fetchImpl, requireCard: body.action === 'pay_quote' })
      let order = body.action === 'pay_quote' ? await rpc('shop_xpay_proration_order', { p_shop_id: body.shopId, p_quote_id: body.quoteId }, token) : await rpc('shop_xpay_order_create', { p_request_id: body.requestId, p_shop_id: body.shopId, p_catalog_terms_id: body.catalogTermsId ?? null, p_private_offer: body.privateOffer ?? null }, token, { purchaseIntent: body.purchaseIntent ?? 'subscribe', priorPaidOrderId: body.priorPaidOrderId ?? null })
      if (order.merchantId !== settings.merchantId || order.mode !== settings.mode) throw new Error('xpay_session_mismatch')
      if (order.sessionId) {
        // Refresh authoritative state before returning a previously bound URL.
        order = await reconcileOrder(order, settings, rpc, fetchImpl)
        return response(publicOrder(order), 200, settings.origin)
      }
      if (order.currency === 'USD' && (!settings.usdEnabled || !capability.usdEnabled)) throw Object.assign(new Error('xpay_currency_unsupported'), { checkoutCode: 'checkout_currency_unsupported' })
      if (order.currency !== 'EGP') await verifyMerchantReadiness({ ...settings, fetchImpl, chargeCurrency: order.currency })
      const sessionRequest = checkoutBody(order, { returnUrl: `${settings.origin}/billing?xpayOrder=${order.id}`, cancelUrl: `${settings.origin}/billing?xpayOrder=${order.id}&cancelled=1`, locale: body.locale })
      order = await rpc('shop_xpay_prepare_session', { p_order_id: order.id, p_body: sessionRequest })
      canRetryCreation(order)
      const created = await createProviderSession({ order, ...settings, fetchImpl })
      const session = await retrieveSession({ sessionId: created.id, ...settings, fetchImpl })
      validateSession(session, order, settings.mode)
      order = session.status === 'open' && session.paymentStatus !== 'paid'
        ? await rpc('shop_xpay_bind_session', { p_order_id: order.id, p_session: databaseSession(session) })
        : await rpc('shop_xpay_apply_session', { p_session: databaseSession(session), p_event_id: null })
      return response(publicOrder(order), 200, settings.origin)
    } catch (error) {
      if (['checkout_change_at_period_end', 'checkout_active_period_exists', 'checkout_historical_review_pending', 'checkout_quote_stale', 'checkout_quote_open', 'checkout_credit_confirmation_required', 'checkout_payment_unresolved', 'checkout_proration_unavailable', 'checkout_currency_unsupported', 'checkout_offer_expiring', 'checkout_plan_change_blocked', 'checkout_quote_required', 'checkout_payment_method_unsupported', 'checkout_period_unsupported'].includes(error?.checkoutCode)) return response({ error: error.checkoutCode, retrySafe: false }, 409, settings.origin)
      // No raw provider/SQL error, key, customer payload or clientSecret in logs.
      return response({ error: 'checkout_not_completed', retrySafe: true }, 409, settings.origin)
    }
  }
}

export function createXPayWebhook({ env, rpc, fetchImpl = fetch }) {
  return async request => {
    if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405)
    let event, settings, digest
    try {
      settings = config(env)
      const raw = await request.text()
      event = await verifyXPayEvent(raw, request.headers.get('xpay-signature'), env('XPAY_WEBHOOK_SECRET'))
      digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', textEncoder.encode(raw))), b => b.toString(16).padStart(2, '0')).join('')
    } catch { return response({ error: 'invalid_webhook' }, 400) }
    if (!sessionEvent(event.type)) return response({ received: true })
    const object = event.data.object
    if (object.merchantId !== settings.merchantId || object.livemode !== (settings.mode === 'live')
      || !new RegExp(`^cs_${settings.mode}_[A-Za-z0-9]+$`).test(object.id || '')) return response({ error: 'invalid_webhook' }, 400)
    if (!UUID.test(object.metadata?.orderId || '')) return response({ received: true })
    try {
      const receipt = await rpc('shop_xpay_inbox_receive', { p_event_id: event.id, p_type: event.type, p_session_id: object.id, p_merchant_id: settings.merchantId, p_mode: settings.mode, p_digest: digest })
      if (receipt.processed) return response({ received: true })
      // Signed data is a wakeup; authenticated GET supplies current payment state.
      const { session, order } = await providerOrder(object.id, settings, rpc, fetchImpl)
      if (order && paidSessionEvent({ ...event, data: { object: session } })) validateSession(session, order, settings.mode, { paid: true })
      await rpc('shop_xpay_apply_session', { p_session: databaseSession(session), p_event_id: event.id })
      return response({ received: true })
    } catch { return response({ error: 'webhook_retry_required' }, 503) }
  }
}

export function createXPayReconciliation({ env, rpc, authorizeServer, fetchImpl = fetch }) {
  return async request => {
    if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405)
    if (!await authorizeServer(request.headers.get('authorization'))) return response({ error: 'server_required' }, 403)
    try {
      const settings = config(env)
      const input = await request.text()
      if (textEncoder.encode(input).length > 8192) throw new Error('xpay_invalid_request')
      if (input.trim()) {
        const target = JSON.parse(input)
        if (!target || Object.keys(target).some(key => !['orderId', 'sessionId'].includes(key)) || !UUID.test(target.orderId || '')) throw new Error('xpay_invalid_request')
        // An operator may locate the original session in XPay's dashboard after
        // an uncertain creation exceeds the request-key retention window.
        // The supplied ID is only a lookup hint, never proof of received funds.
        const { session, order } = await providerOrder(target.sessionId, settings, rpc, fetchImpl)
        if (!order || order.id !== target.orderId) throw new Error('xpay_session_mismatch')
        const result = await rpc('shop_xpay_apply_session', { p_session: databaseSession(session), p_event_id: null })
        return response({ processed: result.state === 'requires_review' ? 0 : 1, unresolved: result.state === 'requires_review' ? 1 : 0 }, result.state === 'requires_review' ? 503 : 200)
      }
      const orders = await rpc('shop_xpay_reconcile_candidates', {})
      let processed = 0, unresolved = 0
      // Bound work for Supabase's 150s free-plan lifetime, including retries.
      for (let offset = 0; offset < orders.length; offset += 2) {
        const results = await Promise.allSettled(orders.slice(offset, offset + 2).map(order => reconcileOrder(order, settings, rpc, fetchImpl)))
        for (const result of results) {
          if (result.status === 'rejected' || result.value.state === 'requires_review') unresolved++
          else processed++
        }
      }
      return response({ processed, unresolved }, unresolved ? 503 : 200)
    } catch { return response({ error: 'reconciliation_unavailable' }, 503) }
  }
}
