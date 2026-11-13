import assert from 'node:assert/strict'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'

import { createIntentResolver } from './model.mjs'
import { readConfig, startWorker } from './worker.mjs'

const env = {
  SHOP_HQ_SUPABASE_URL: 'https://jvvelvftpfnlogalgxgv.supabase.co',
  SHOP_HQ_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
  SHOP_HQ_WORKER_EMAIL: 'worker@example.invalid',
  SHOP_HQ_WORKER_PASSWORD: 'fixture-password',
  SHOP_HQ_OPENAI_API_KEY: 'fixture-openai-key',
  SHOP_HQ_MODEL: 'fixture-model',
}
const messages = [{ role: 'user', content: 'عميل اسمه احمد محمد عمل شعر ودقن' }]
const intent = {
  kind: 'service_sale',
  customerName: 'احمد محمد',
  services: ['شعر', 'دقن'],
  paymentMethod: null,
  reply: 'حاضر، هجهز تسجيل الخدمات.',
}

function completed(output = intent) {
  return {
    status: 'completed',
    output: [
      { type: 'reasoning' },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(output) }] },
    ],
  }
}

test('configuration accepts verified Shop projects and the local Shop stack only', () => {
  assert.equal(readConfig(env).url, env.SHOP_HQ_SUPABASE_URL)
  for (const url of [
    'https://fgdzjnsbcxfbiuogbmom.supabase.co/',
    'http://127.0.0.1:61321',
    'http://localhost:61321',
  ]) assert.equal(readConfig({ ...env, SHOP_HQ_SUPABASE_URL: url }).url, url.replace(/\/$/, ''))
  for (const url of [
    'https://jkdncdexqcymwbihwdhp.supabase.co',
    'https://jvvelvftpfnlogalgxgv.supabase.co.example.invalid',
    'https://jvvelvftpfnlogalgxgv.supabase.co/rest/v1',
    'http://localhost:54321',
  ]) assert.throws(() => readConfig({ ...env, SHOP_HQ_SUPABASE_URL: url }), /unapproved/)
  assert.throws(() => readConfig({ ...env, SHOP_HQ_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_fixture' }), /publishable/)
  assert.throws(() => readConfig({ ...env, SHOP_HQ_OPENAI_API_KEY: '', OPENAI_API_KEY: 'other' }), /SHOP_HQ_OPENAI_API_KEY/)
  assert.throws(() => readConfig({ ...env, SHOP_HQ_DOCS_FILE: 'relative.md' }), /absolute/)
})

test('Responses API receives structured intent only and reloads the approved snapshot', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'shop-hq-docs-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  const docsFile = join(directory, 'shop.md')
  await writeFile(docsFile, 'Shop Suit v1.2.3 adds saved receipts.')
  const requests = []
  const resolver = createIntentResolver({ ...readConfig(env), docsFile }, async (url, request) => {
    requests.push({ url, request, body: JSON.parse(request.body) })
    return Response.json(completed())
  })
  assert.deepEqual(await resolver(messages), intent)
  await writeFile(docsFile, 'Shop Suit v1.2.4 adds service search.')
  assert.deepEqual(await resolver(messages), intent)
  assert.equal(requests[0].url, 'https://api.openai.com/v1/responses')
  assert.equal(requests[0].request.headers.authorization, 'Bearer fixture-openai-key')
  assert.equal(requests[0].request.redirect, 'error')
  assert.equal(requests[0].body.store, false)
  assert.equal(requests[0].body.model, 'fixture-model')
  assert.equal(requests[0].body.tools, undefined)
  assert.equal(requests[0].body.text.format.strict, true)
  assert.equal(requests[0].body.text.format.schema.additionalProperties, false)
  assert.deepEqual(requests[0].body.input, messages)
  assert.match(requests[0].body.instructions, /has already been paid/)
  assert.match(requests[0].body.instructions, /Shop Suit v1.2.3/)
  assert.match(requests[1].body.instructions, /Shop Suit v1.2.4/)
  const symlinkPath = join(directory, 'other.md')
  await symlink(docsFile, symlinkPath)
  await assert.rejects(createIntentResolver({ ...readConfig(env), docsFile: symlinkPath })(messages))
})

test('invalid message roles, refusals, incomplete responses, and malformed intents fail closed', async () => {
  const config = readConfig(env)
  const invalidResponses = [
    { ...completed(), status: 'incomplete' },
    { status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'fixture' }] }] },
    completed({ ...intent, paymentMethod: 'cheque' }),
    completed({ ...intent, unsupportedField: true }),
    completed({ ...intent, kind: 'reply' }),
    completed({ ...intent, customerName: null }),
    completed({ ...intent, services: ['A'] }),
    completed({ ...intent, services: Array(7).fill('Haircut') }),
    completed({ ...intent, reply: '😀'.repeat(501) }),
  ]
  for (const response of invalidResponses) {
    await assert.rejects(createIntentResolver(config, async () => Response.json(response))(messages))
  }
  await assert.rejects(createIntentResolver(config, () => assert.fail('invalid role reached provider'))([
    { role: 'system', content: 'Unapproved instruction.' },
    ...messages,
  ]), /invalid-job-messages/)
  await assert.rejects(createIntentResolver(config, () => assert.fail('oversized message reached provider'))([
    { role: 'user', content: 'ش'.repeat(1_001) },
  ]), /invalid-job-messages/)
})

async function waitFor(condition) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (condition()) return
    await delay(10)
  }
  assert.fail('timed out waiting for worker state')
}

test('private replication catch-up, filtered wakes, reconnect, and idempotent finish', async t => {
  const topic = 'realtime:shop-hq-assistant-jobs'
  const sockets = []
  const pendingJobs = []
  const completions = []
  const logs = []
  let authCalls = 0
  let modelCalls = 0
  let claims = 0
  const job = {
    jobId: '00000000-0000-4000-8000-000000000001',
    leaseToken: '00000000-0000-4000-8000-000000000002',
    messages,
  }
  class FixtureSocket extends EventTarget {
    constructor(url) {
      super()
      assert.equal(url.href, 'wss://jvvelvftpfnlogalgxgv.supabase.co/realtime/v1/websocket?apikey=sb_publishable_fixture&vsn=1.0.0')
      sockets.push(this)
      queueMicrotask(() => this.dispatchEvent(new Event('open')))
    }

    frame(event, payload, ref, channel = topic) {
      this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ event, payload, ref, topic: channel }) }))
    }

    replicationReady() {
      this.frame('system', { status: 'ok', extension: 'system', message: 'Replication connection established' })
    }

    send(text) {
      const join = JSON.parse(text)
      assert.equal(join.event, 'phx_join')
      assert.equal(join.topic, topic)
      assert.equal(join.payload.access_token, 'fixture-session')
      assert.equal(join.payload.config.private, true)
      assert.equal(join.payload.config.broadcast.replication_ready, true)
      queueMicrotask(() => this.frame('phx_reply', { status: 'ok' }, join.ref))
    }

    close() {
      this.dispatchEvent(new Event('close'))
    }
  }
  const stop = startWorker(readConfig(env), {
    Socket: FixtureSocket,
    log: event => logs.push(event),
    fetcher: async (url, request) => {
      const body = JSON.parse(request.body)
      const path = new URL(url).pathname
      if (path === '/auth/v1/token') {
        authCalls++
        assert.deepEqual(body, { email: env.SHOP_HQ_WORKER_EMAIL, password: env.SHOP_HQ_WORKER_PASSWORD })
        return Response.json({ access_token: 'fixture-session', refresh_token: 'fixture-refresh', expires_in: 3600 })
      }
      if (path === '/v1/responses') {
        modelCalls++
        if (modelCalls === 2) throw new Error('fixture private prompt and provider details')
        return Response.json(completed())
      }
      assert.equal(request.headers.authorization, 'Bearer fixture-session')
      if (path.endsWith('/shop_hq_assistant_claim')) {
        claims++
        return Response.json(pendingJobs.shift() ?? null)
      }
      assert.ok(path.endsWith('/shop_hq_assistant_finish'))
      completions.push(body)
      if (completions.length === 1) throw new Error('finish response lost')
      return Response.json(true)
    },
  })
  t.after(stop)

  pendingJobs.push(job)
  await waitFor(() => sockets.length === 1)
  assert.equal(claims, 0)
  sockets[0].replicationReady()
  await waitFor(() => claims === 2 && completions.length === 2)
  assert.deepEqual(completions[0], {
    p_job_id: job.jobId,
    p_lease_token: job.leaseToken,
    p_intent: intent,
    p_succeeded: true,
  })
  assert.deepEqual(completions[0], completions[1])
  assert.equal(modelCalls, 1)

  pendingJobs.push(job)
  sockets[0].frame('broadcast', { event: 'unrelated' })
  sockets[0].frame('broadcast', { event: 'jobs' }, undefined, 'realtime:other')
  await delay(20)
  assert.equal(claims, 2)
  sockets[0].frame('broadcast', { event: 'jobs', payload: { ignored: 'any data' } })
  await waitFor(() => claims === 4)
  assert.deepEqual(completions[2], {
    p_job_id: job.jobId,
    p_lease_token: job.leaseToken,
    p_intent: null,
    p_succeeded: false,
  })

  sockets[0].close()
  pendingJobs.push(job)
  await waitFor(() => sockets.length === 2)
  sockets[1].replicationReady()
  await waitFor(() => claims === 6)
  assert.equal(completions.length, 4)
  assert.equal(modelCalls, 3)
  assert.equal(authCalls, 1)
  assert.deepEqual(logs, ['queue-ready', 'intent-unavailable', 'queue-ready'])
})
