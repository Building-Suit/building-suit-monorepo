import assert from 'node:assert/strict'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'

import { readApprovedDocs, validateIntent, validateMessages, validateReview } from './model.mjs'
import { createOllamaAdapter } from './ollama.mjs'
import { publishApprovedDocs } from './publish-docs.mjs'
import { readConfig, startWorker } from './worker.mjs'

const env = {
  SHOP_HQ_SUPABASE_URL: 'https://jvvelvftpfnlogalgxgv.supabase.co',
  SHOP_HQ_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
  SHOP_HQ_WORKER_EMAIL: 'worker@example.invalid',
  SHOP_HQ_WORKER_PASSWORD: 'fixture-password',
  SHOP_HQ_INFERENCE_ADAPTER: 'ollama',
  SHOP_HQ_OLLAMA_MODEL: 'fixture:tag',
  SHOP_HQ_OLLAMA_MODEL_DIGEST: 'a'.repeat(64),
}
const messages = [{ role: 'user', content: 'عميل اسمه احمد محمد عمل شعر ودقن ودفع ٣٠٠ كاش' }]
const intent = {
  kind: 'service_sale',
  customerName: 'احمد محمد',
  customerPhone: null,
  services: ['شعر', 'دقن'],
  paymentMethod: 'cash',
  paymentReceived: true,
  paidAmount: 300,
  reply: 'حاضر، هسجل الخدمات.',
}

test('configuration requires verified Shop projects and an explicitly approved inference backend', () => {
  assert.equal(readConfig(env).url, env.SHOP_HQ_SUPABASE_URL)
  assert.equal(readConfig(env).model, env.SHOP_HQ_OLLAMA_MODEL)
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
  assert.throws(() => readConfig({ ...env, SHOP_HQ_INFERENCE_ADAPTER: '', OPENAI_API_KEY: 'unused' }), /SHOP_HQ_INFERENCE_ADAPTER/)
  assert.throws(() => readConfig({ ...env, SHOP_HQ_OLLAMA_MODEL: 'fixture:cloud' }), /approved-local-model/)
  assert.throws(() => readConfig({ ...env, SHOP_HQ_OLLAMA_MODEL_DIGEST: 'unused' }), /approved-local-model/)
  assert.throws(() => readConfig({ ...env, SHOP_HQ_DOCS_FILE: 'relative.md' }), /absolute/)
  const moduleConfig = readConfig({ ...env, SHOP_HQ_INFERENCE_ADAPTER: 'module', SHOP_HQ_INFERENCE_MODULE: '/approved/inference.mjs' })
  assert.equal(moduleConfig.inferenceModule, '/approved/inference.mjs')
  assert.equal(moduleConfig.model, undefined)
})

test('the operator-approved docs snapshot is re-read without following links', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'shop-hq-docs-'))
  t.after(() => rm(directory, { force: true, recursive: true }))
  const docsFile = join(directory, 'shop.md')
  const sourceFile = join(directory, 'export.md')
  await writeFile(sourceFile, 'Shop Suit v1.2.3 adds saved receipts.')
  await publishApprovedDocs(sourceFile, docsFile)
  assert.match(await readApprovedDocs(docsFile), /v1.2.3/)
  await writeFile(sourceFile, 'Shop Suit v1.2.4 adds service search.')
  await publishApprovedDocs(sourceFile, docsFile)
  assert.match(await readApprovedDocs(docsFile), /v1.2.4/)
  const symlinkPath = join(directory, 'other.md')
  await symlink(docsFile, symlinkPath)
  await assert.rejects(readApprovedDocs(symlinkPath))
  await assert.rejects(publishApprovedDocs(symlinkPath, docsFile))
  await writeFile(sourceFile, Buffer.alloc(24_001))
  await assert.rejects(publishApprovedDocs(sourceFile, docsFile))
  assert.match(await readApprovedDocs(docsFile), /v1.2.4/)
})

test('worker validates employee proposals, head review, and input bounds', () => {
  assert.deepEqual(validateIntent(intent), intent)
  assert.deepEqual(validateReview({ approved: true, feedback: null }), { approved: true, feedback: null })
  assert.throws(() => validateReview({ approved: false, feedback: null }), /invalid-head-review/)
  for (const invalid of [
    { ...intent, paymentMethod: 'cheque' },
    { ...intent, paymentReceived: false },
    { ...intent, paidAmount: -1 },
    { ...intent, paidAmount: 10.015 },
    { ...intent, customerPhone: '123456' },
    { ...intent, unsupportedField: true },
    { ...intent, kind: 'reply' },
    { ...intent, customerName: null },
    { ...intent, services: ['A'] },
    { ...intent, services: Array(7).fill('Haircut') },
    { ...intent, reply: '😀'.repeat(501) },
  ]) assert.throws(() => validateIntent(invalid), /invalid-employee-intent/)
  assert.throws(() => validateMessages([{ role: 'system', content: 'invalid' }, ...messages]), /invalid-job-messages/)
  assert.throws(() => validateMessages([{ role: 'user', content: 'ش'.repeat(1_001) }]), /invalid-job-messages/)
})

test('Ollama uses only the installed pinned loopback model and structured prompts', async () => {
  const config = readConfig(env)
  const requests = []
  let digest = config.modelDigest
  const adapter = await createOllamaAdapter(config, async (url, request) => {
    assert.equal(new URL(url).origin, 'http://127.0.0.1:11434')
    assert.equal(request.redirect, 'error')
    if (url.endsWith('/api/tags')) return Response.json({ models: [{ name: config.model, digest }] })
    assert.equal(new URL(url).pathname, '/api/chat')
    const body = JSON.parse(request.body)
    requests.push(body)
    const content = JSON.stringify(requests.length === 1 ? intent : { approved: true, feedback: null })
    return Response.json({ done: true, done_reason: 'stop', model: config.model, message: { role: 'assistant', content } })
  })
  const signal = AbortSignal.timeout(1_000)
  const docs = 'Shop Suit v1.2.4 adds service search.'
  const employee = { id: 'local-employee', template: 'shop-suit-agent-v1' }
  assert.deepEqual(await adapter.inferEmployee({ employee, messages, feedback: null, docs, signal }), intent)
  assert.deepEqual(await adapter.reviewEmployee({ messages, intent, outcome: null, docs, signal }), { approved: true, feedback: null })
  assert.equal(requests[0].tools, undefined)
  assert.equal(requests[0].stream, false)
  assert.equal(requests[0].truncate, false)
  assert.equal(requests[0].shift, false)
  assert.equal(requests[0].format.additionalProperties, false)
  assert.deepEqual(requests[0].messages.slice(1), messages)
  assert.doesNotMatch(requests[0].messages[0].content, /local-employee/)
  assert.match(requests[1].messages[0].content, /Mariam/)
  digest = 'b'.repeat(64)
  await assert.rejects(adapter.inferEmployee({ employee, messages, feedback: null, docs, signal }), /approved-local-model-not-installed/)
  assert.equal(requests.length, 2)
})

async function waitFor(condition) {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (condition()) return
    await delay(10)
  }
  assert.fail('timed out waiting for worker state')
}

const identity = {
  employeeId: '00000000-0000-4000-8000-000000000003',
  employeeTemplate: 'shop-suit-agent-v1',
  headId: '00000000-0000-4000-8000-000000000004',
  headAgentId: 'AG-SHOP-001',
}

function jobFor(sequence) {
  return {
    jobId: '00000000-0000-4000-8000-00000000001' + sequence,
    leaseToken: '00000000-0000-4000-8000-00000000002' + sequence,
    ...identity,
    messages,
    feedback: null,
    state: 'queued',
  }
}

test('Head assigns, employee publishes, executes, then Head batch reviews and requests one fix', async t => {
  const topic = 'realtime:shop-hq-assistant-jobs'
  const sockets = []
  const logs = []
  const lifecycle = []
  const jobs = [jobFor(1)]
  const receipt = { sequence: 2, kind: 'receipt', invoiceId: '00000000-0000-4000-8000-000000000005' }
  let finishRetry

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

    ready() {
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
    inference: {
      async inferEmployee(input) {
        lifecycle.push('employee')
        assert.deepEqual(input.employee, { id: identity.employeeId, template: identity.employeeTemplate })
        assert.deepEqual(input.messages, messages)
        if (input.feedback) {
          assert.equal(input.feedback, 'Clarify the confirmation.')
          assert.deepEqual(input.outcome, { kind: 'receipt' })
        }
        return input.feedback ? {
          kind: 'reply', customerName: null, customerPhone: null, services: [],
          paymentMethod: null, paymentReceived: false, paidAmount: null, reply: 'تم تحديث الرد.',
        } : intent
      },
      async reviewEmployee(input) {
        lifecycle.push('head-review')
        assert.deepEqual(input.head, { id: identity.headId, agentId: identity.headAgentId })
        assert.deepEqual(input.messages, messages)
        assert.deepEqual(input.outcome, { kind: 'receipt' })
        const approve = input.intent.reply !== intent.reply
        return { approved: approve, feedback: approve ? null : 'Clarify the confirmation.' }
      },
    },
    fetcher: async (url, request) => {
      const body = JSON.parse(request.body)
      const path = new URL(url).pathname
      if (path === '/auth/v1/token') {
        assert.deepEqual(body, { email: env.SHOP_HQ_WORKER_EMAIL, password: env.SHOP_HQ_WORKER_PASSWORD })
        return Response.json({ access_token: 'fixture-session', refresh_token: 'fixture-refresh', expires_in: 3600 })
      }
      assert.equal(request.headers.authorization, 'Bearer fixture-session')
      const name = path.split('shop_hq_assistant_').at(-1)
      let job
      switch (name) {
        case 'dispatch':
          job = jobs.find(row => row.state === 'queued')
          if (!job) return Response.json(null)
          lifecycle.push('head-dispatch')
          job.state = 'assigned'
          return Response.json(job)
        case 'claim':
          job = jobs.find(row => row.state === 'assigned')
          if (!job) return Response.json(null)
          job.state = 'working'
          return Response.json(job)
        case 'finish':
          job = jobs.find(row => row.jobId === body.p_job_id)
          assert.ok(body.p_succeeded)
          if (finishRetry) {
            assert.deepEqual(body, finishRetry)
            finishRetry = undefined
            return Response.json(true)
          }
          lifecycle.push('employee-publish')
          job.intent = body.p_intent
          job.state = job.outcome ? 'review' : 'sale_pending'
          if (!job.outcome && job === jobs[0]) {
            finishRetry = body
            throw new Error('finish response lost')
          }
          return Response.json(true)
        case 'sale_claim':
          job = jobs.find(row => row.state === 'sale_pending')
          return Response.json(job ?? null)
        case 'execute_sale':
          job = jobs.find(row => row.jobId === body.p_job_id)
          assert.deepEqual(body, { p_job_id: job.jobId, p_lease_token: job.leaseToken })
          lifecycle.push('worker-execute')
          job.outcome = receipt
          job.state = 'review'
          return Response.json(receipt)
        case 'review_claim':
          return Response.json(jobs.filter(row => row.state === 'review'))
        case 'review_finish':
          job = jobs.find(row => row.jobId === body.p_job_id)
          job.state = body.p_approved ? 'completed' : 'assigned'
          job.feedback = body.p_feedback
          return Response.json(true)
        default: assert.fail('unexpected RPC')
      }
    },
  })
  t.after(stop)

  await waitFor(() => sockets.length === 1)
  assert.deepEqual(lifecycle, [])
  sockets[0].ready()
  await waitFor(() => jobs[0].state === 'completed')
  const steps = ['head-dispatch', 'employee', 'employee-publish', 'worker-execute', 'head-review', 'employee', 'employee-publish', 'head-review']
  assert.deepEqual(lifecycle, steps)

  jobs.push(jobFor(2))
  sockets[0].frame('broadcast', { event: 'unrelated' })
  sockets[0].frame('broadcast', { event: 'jobs' }, undefined, 'realtime:other')
  await delay(20)
  assert.deepEqual(lifecycle, steps)
  sockets[0].frame('broadcast', { event: 'jobs', payload: { ignored: 'any data' } })
  await waitFor(() => jobs[1].state === 'completed')
  assert.deepEqual(lifecycle, [...steps, ...steps])

  sockets[0].close()
  jobs.push({ ...jobFor(3), state: 'sale_pending', intent })
  await waitFor(() => sockets.length === 2)
  sockets[1].ready()
  await waitFor(() => jobs[2].state === 'completed')
  assert.deepEqual(lifecycle.slice(-5), steps.slice(-5))
  assert.deepEqual(logs, ['queue-ready', 'queue-ready'])
})
