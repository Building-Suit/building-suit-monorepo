import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { test } from 'node:test'
import { processSupportNotification } from '../../supabase/functions/_shared/support-notifications.mjs'

const row = { id: 'outbox-1', lease_token: 'lease-1', request_id: 'request-1', requester_email: 'customer@example.test', subject: 'Help', category: 'general', priority: 'normal', customer_message: 'Hello' }
function harness() {
  let claimable = true
  const state = { status: 'not_configured', payload: null, providerId: null, finishes: [] }
  return {
    state, retry() { claimable = true },
    async rpc(name, body) {
      if (name === 'claim_support_notification') {
        if (!claimable) return null
        claimable = false
        return { ...row, provider_email_id: state.providerId, email_payload: state.payload }
      }
      if (name === 'prepare_support_notification') return state.payload ||= body.p_payload
      state.status = body.p_status
      state.providerId ||= body.p_provider_email_id
      state.finishes.push(body)
      return true
    },
  }
}

test('uncertain send retries use identical key and committed payload; sent is only polled', async () => {
  const h = harness()
  const calls = []
  let failure = true
  const fetchImpl = async (url, init) => {
    assert.ok(h.state.payload, 'payload must be persisted before external delivery')
    calls.push({ url, init })
    if (failure) throw new Error('timeout after provider acceptance')
    return Response.json({ id: 'provider-1', last_event: 'delivered' })
  }
  const run = from => processSupportNotification({ rpc: h.rpc, apiKey: 'fake-key', from, fetchImpl })
  assert.equal(await run('shop@building-suit.com'), 'failed')
  failure = false
  h.retry()
  assert.equal(await run('changed@building-suit.com'), 'sent')
  assert.equal(calls[0].init.body, calls[1].init.body)
  assert.equal(calls[0].init.headers['idempotency-key'], calls[1].init.headers['idempotency-key'])
  assert.equal(h.state.providerId, 'provider-1')
  assert.equal(await run('shop@building-suit.com'), 'idle')
  h.retry()
  assert.equal(await run('shop@building-suit.com'), 'delivered')
  assert.equal(calls[2].init.method, undefined, 'poll must not POST another email')
  assert.equal(calls[2].url, 'https://api.resend.com/emails/provider-1')
})

test('failure to prepare the durable payload never calls Resend', async () => {
  let calls = 0
  await assert.rejects(processSupportNotification({
    rpc: async name => { if (name === 'claim_support_notification') return row; throw new Error('lease expired') },
    apiKey: 'fake-key', from: 'shop@building-suit.com', fetchImpl: async () => { calls++; return Response.json({ id: 'x' }) },
  }), /lease expired/)
  assert.equal(calls, 0)
})

test('provider success followed by failed database acknowledgement leaves recovery to the lease', async () => {
  const calls = []
  await assert.rejects(processSupportNotification({
    rpc: async (name, body) => {
      calls.push(name)
      if (name === 'claim_support_notification') return row
      if (name === 'prepare_support_notification') return body.p_payload
      throw new Error('database unavailable')
    },
    apiKey: 'fake', from: 'shop@building-suit.com', fetchImpl: async () => Response.json({ id: 'provider-1' }),
  }), /database unavailable/)
  assert.deepEqual(calls, ['claim_support_notification', 'prepare_support_notification', 'finish_support_notification'])
})

test('browser-reachable source has no Resend/worker secrets or sender imports', async () => {
  async function inspect(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir)
      if (entry.isDirectory()) await inspect(url)
      else if (/\.(vue|ts|mjs|js)$/.test(entry.name)) {
        assert.doesNotMatch(await readFile(url, 'utf8'), /RESEND_API_KEY|SHOP_SUPPORT_WORKER_TOKEN|support-notifications|SUPABASE_SERVICE_ROLE_KEY/)
      }
    }
  }
  await inspect(new URL('../../app/', import.meta.url))
  const config = await readFile(new URL('../../nuxt.config.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(config, /RESEND_API_KEY|SHOP_SUPPORT_WORKER_TOKEN/)
})
