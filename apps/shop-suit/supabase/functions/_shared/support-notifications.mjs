// Server/Edge only. No browser configuration or client imports.
const RECIPIENT = 'support@building-suit.com'
const LOGO = 'https://shop.building-suit.com/brand/shop-suit-email-mark.png'
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])

export function supportEmail(row, from) {
  return {
    from, to: [RECIPIENT], reply_to: row.requester_email,
    subject: `Shop Suit support: ${row.subject.replace(/[\r\n]/g, ' ')}`,
    text: `Shop Suit support request ${row.request_id}\nCategory: ${row.category}\nPriority: ${row.priority}\nReply to: ${row.requester_email}\n\n${row.customer_message}`,
    html: `<img src="${LOGO}" alt="Shop Suit by Building Suit" width="64"><h1>${escapeHtml(row.subject)}</h1><p>Request: ${escapeHtml(row.request_id)}<br>Category: ${escapeHtml(row.category)}<br>Priority: ${escapeHtml(row.priority)}<br>Reply to: ${escapeHtml(row.requester_email)}</p><div style="white-space:pre-wrap">${escapeHtml(row.customer_message)}</div>`,
  }
}

export async function processSupportNotification({ rpc, apiKey, from, fetchImpl = fetch }) {
  const row = await rpc('claim_support_notification', {})
  if (!row) return 'idle'
  const finish = (status, providerId = row.provider_email_id, error = null) => rpc('finish_support_notification', {
    p_id: row.id, p_lease_token: row.lease_token, p_status: status,
    p_provider_email_id: providerId, p_error: error,
  })
  if (row.provider_email_id) {
    // A provider-accepted message is only polled; it can never be sent again.
    try {
      const response = await fetchImpl(`https://api.resend.com/emails/${encodeURIComponent(row.provider_email_id)}`, {
        headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error('poll_failed')
      const email = await response.json()
      if (email.id !== row.provider_email_id || typeof email.last_event !== 'string') throw new Error('poll_result_invalid')
      const status = ['delivered', 'opened', 'clicked'].includes(email.last_event) ? 'delivered'
        : ['bounced', 'failed'].includes(email.last_event) ? 'bounced' : 'sent'
      await finish(status)
      return status
    }
    catch {
      await finish('sent', row.provider_email_id, 'provider_poll_failed')
      return 'sent'
    }
  }

  // This RPC commits the frozen payload before the external side effect.
  const payload = await rpc('prepare_support_notification', {
    p_id: row.id, p_lease_token: row.lease_token,
    p_payload: row.email_payload || supportEmail(row, from),
  })
  let providerId
  try {
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', 'idempotency-key': `shop-support/${row.id}` },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      // Never persist or return provider bodies (they may contain customer data).
      const retryable = response.status === 429 || response.status === 409 || response.status >= 500
      await finish(retryable ? 'failed' : 'review_required', null, `provider_http_${response.status}`)
      return retryable ? 'failed' : 'review_required'
    }
    const result = await response.json()
    if (typeof result.id !== 'string' || !result.id) throw new Error('provider_result_invalid')
    providerId = result.id
  }
  catch {
    await finish('failed', null, 'provider_result_uncertain')
    return 'failed'
  }
  // If this write fails, the lease expires and the same key/payload recovers the
  // provider result. Do not classify a persistence failure as a rejected email.
  if (!await finish('sent', providerId)) throw new Error('support_lease_lost')
  return 'sent'
}

export function createSupportSender({ env, rpc, fetchImpl = fetch }) {
  return async request => {
    const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' })
    const token = env('SHOP_SUPPORT_WORKER_TOKEN')
    if (!token || token.length < 32) return reply(503, { error: 'sender_not_configured' })
    if (request.headers.get('authorization') !== `Bearer ${token}`) return reply(401, { error: 'unauthorized' })
    const apiKey = env('RESEND_API_KEY')
    const from = env('SHOP_SUPPORT_FROM')
    if (!apiKey || !from || !/^[a-zA-Z0-9._+-]+@building-suit\.com$/.test(from)
      || !env('SUPABASE_URL') || !env('SUPABASE_SERVICE_ROLE_KEY')) return reply(503, { error: 'sender_not_configured' })
    try {
      // Bounded to keep an invocation comfortably within the Edge runtime budget.
      const results = []
      for (let i = 0; i < 5; i++) {
        const result = await processSupportNotification({ rpc, apiKey, from, fetchImpl })
        if (result === 'idle') break
        results.push(result)
      }
      return reply(200, { processed: results.length })
    }
    catch { return reply(503, { error: 'sender_unavailable' }) }
  }
}
