import assert from 'node:assert/strict'
import { test } from 'node:test'
import { access } from 'node:fs/promises'
import { createSupportSender, processSupportNotification, supportEmail } from '../../supabase/functions/_shared/support-notifications.mjs'

const row = { id: 'outbox-test', lease_token: 'test-lease', request_id: 'request-test', subject: '<script>Help</script>\r\nInjected: header', requester_email: 'safe@example.test', customer_message: '<img src=x onerror=alert(1)> & مرحبا', category: 'technical', priority: 'normal' }
const config = { SHOP_SUPPORT_WORKER_TOKEN: 'synthetic-worker-token-with-at-least-32-characters', RESEND_API_KEY: 're_synthetic_never_sent', SHOP_SUPPORT_FROM: 'shop@building-suit.com', SUPABASE_URL: 'http://127.0.0.1:61321', SUPABASE_SERVICE_ROLE_KEY: 'synthetic' }

test('support email has fixed recipient, trusted reply-to, safe HTML, and a canonical absolute PNG', async () => {
  const payload = supportEmail(row, config.SHOP_SUPPORT_FROM)
  assert.deepEqual(payload.to, ['support@building-suit.com'])
  assert.equal(payload.reply_to, row.requester_email)
  assert.doesNotMatch(payload.subject, /[\r\n]/)
  assert.doesNotMatch(payload.html, /<script>|<img src=x/)
  assert.match(payload.html, /&lt;script&gt;/)
  assert.match(payload.text, /مرحبا/)
  assert.match(payload.html, /https:\/\/shop\.building-suit\.com\/brand\/shop-suit-email-mark\.png/)
  await access(new URL('../../../../packages/brand/assets/shop-suit-email-mark.png', import.meta.url))
})

test('worker rejects browser JWTs and incomplete server configuration without touching the queue', async () => {
  let calls = 0
  const worker = createSupportSender({ env: name => config[name], rpc: async () => { calls++; return null } })
  assert.equal((await worker(new Request('https://test', { method: 'POST', headers: { authorization: 'Bearer browser-jwt' } }))).status, 401)
  assert.equal((await worker(new Request('https://test'))).status, 405)
  assert.equal(calls, 0)
  const missing = createSupportSender({ env: name => name === 'RESEND_API_KEY' ? undefined : config[name], rpc: async () => { calls++; return null } })
  assert.equal((await missing(new Request('https://test', { method: 'POST', headers: { authorization: `Bearer ${config.SHOP_SUPPORT_WORKER_TOKEN}` } }))).status, 503)
  assert.equal(calls, 0)
})

for (const [code, status] of [[429, 'failed'], [500, 'failed'], [409, 'failed'], [422, 'review_required']]) {
  test(`safe mocked Resend ${code} records ${status} without provider body leakage`, async () => {
    let finish
    const result = await processSupportNotification({
      apiKey: config.RESEND_API_KEY, from: config.SHOP_SUPPORT_FROM,
      rpc: async (name, body) => {
        if (name === 'claim_support_notification') return row
        if (name === 'prepare_support_notification') return body.p_payload
        finish = body; return true
      },
      fetchImpl: async (url, init) => {
        assert.equal(url, 'https://api.resend.com/emails')
        assert.equal(init.headers.authorization, `Bearer ${config.RESEND_API_KEY}`)
        assert.equal(init.headers['idempotency-key'], 'shop-support/outbox-test')
        return new Response('secret provider debug body', { status: code })
      },
    })
    assert.equal(result, status)
    assert.equal(finish.p_status, status)
    assert.equal(finish.p_error, `provider_http_${code}`)
    assert.doesNotMatch(JSON.stringify(finish), /secret provider/)
  })
}

test('delivery polling failure preserves sent state and does not send again', async () => {
  let finish
  const result = await processSupportNotification({ apiKey: 'synthetic', from: config.SHOP_SUPPORT_FROM,
    rpc: async (name, body) => { if (name === 'claim_support_notification') return { ...row, provider_email_id: 'provider-id' }; finish = body; return true },
    fetchImpl: async (_url, init) => { assert.equal(init.method, undefined); throw new Error('network') },
  })
  assert.equal(result, 'sent')
  assert.equal(finish.p_status, 'sent')
  assert.equal(finish.p_error, 'provider_poll_failed')
})

for (const [event, expected] of [['delivered', 'delivered'], ['opened', 'delivered'], ['clicked', 'delivered'], ['bounced', 'bounced'], ['failed', 'bounced'], ['sent', 'sent']]) {
  test(`provider observation ${event} becomes ${expected} without resending`, async () => {
    let finish
    const result = await processSupportNotification({ apiKey: 'synthetic', from: config.SHOP_SUPPORT_FROM,
      rpc: async (name, body) => { if (name === 'claim_support_notification') return { ...row, provider_email_id: 'provider-id' }; finish = body; return true },
      fetchImpl: async (_url, init) => { assert.equal(init.method, undefined); return Response.json({ id: 'provider-id', last_event: event }) },
    })
    assert.equal(result, expected)
    assert.equal(finish.p_status, expected)
  })
}

test('worker drains a bounded batch and returns no customer content or secrets', async () => {
  let claims = 0
  const worker = createSupportSender({ env: name => config[name],
    rpc: async (name, body) => {
      if (name === 'claim_support_notification') { claims++; return { ...row, id: `test-${claims}` } }
      if (name === 'prepare_support_notification') return body.p_payload
      return true
    }, fetchImpl: async () => Response.json({ id: 'synthetic-provider-id' }),
  })
  const response = await worker(new Request('https://test', { method: 'POST', headers: { authorization: `Bearer ${config.SHOP_SUPPORT_WORKER_TOKEN}` } }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { processed: 5 })
  assert.equal(claims, 5)
})
