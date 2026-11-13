import assert from 'node:assert/strict'
import { chmod, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'

import {
  readShopConnectorConfig, startShopConnector,
  validateIntent, validateMessages, validateReview,
} from './departmentWorkflow.mjs'
import { shopBrainReader, shopConnectorSettings } from './worker.mjs'

const config = {
  url: 'https://jvvelvftpfnlogalgxgv.supabase.co',
  key: 'sb_publishable_fixture',
  email: 'worker@example.invalid',
  password: 'fixture-password',
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

test('the HQ connector requires a verified Shop origin and an explicitly supplied inference adapter', () => {
  assert.deepEqual(readShopConnectorConfig(config), config)
  for (const url of [
    'https://fgdzjnsbcxfbiuogbmom.supabase.co/',
    'http://127.0.0.1:61321',
    'http://localhost:61321',
  ]) assert.equal(readShopConnectorConfig({ ...config, url }).url, url.replace(/\/$/, ''))
  for (const url of [
    'https://dpruoncalmwicrqhqelu.supabase.co',
    'https://jvvelvftpfnlogalgxgv.supabase.co.example.invalid',
    'https://jvvelvftpfnlogalgxgv.supabase.co/rest/v1',
    'http://localhost:54321',
  ]) assert.throws(() => readShopConnectorConfig({ ...config, url }), /unapproved/)
  assert.throws(() => readShopConnectorConfig({ ...config, key: 'sb_secret_fixture' }), /publishable/)
  assert.throws(() => readShopConnectorConfig({ ...config, password: '' }), /credentials/)
  assert.throws(() => startShopConnector(config), /inference-adapter-required/)
})

test('the private Shop identity is mapped to its HQ environment and fails closed', async t => {
  const state = await mkdtemp(join(tmpdir(), 'shop-hq-config-'))
  t.after(() => rm(state, { force: true, recursive: true }))
  const hq = { state, url: 'https://dpruoncalmwicrqhqelu.supabase.co', email: 'hq@example.invalid', password: 'hq-fixture-long-password-123' }
  const { key, email } = config
  const shop = { key, email, password: 'shop-fixture-long-password-123' }
  const path = join(state, 'shop-connector.json')
  assert.equal(await shopConnectorSettings(hq), null)
  await writeFile(path, JSON.stringify(shop), { mode: 0o600 })
  assert.deepEqual(await shopConnectorSettings(hq), { ...shop, url: config.url })
  assert.equal((await shopConnectorSettings({ ...hq, url: 'https://nkpvskyugnnnozepbwzb.supabase.co' })).url,
    'https://fgdzjnsbcxfbiuogbmom.supabase.co')
  await assert.rejects(shopConnectorSettings({ ...hq, email }), /configuration-invalid/)
  await assert.rejects(shopConnectorSettings({ ...hq, url: config.url }), /configuration-invalid/)
  await chmod(path, 0o644)
  await assert.rejects(shopConnectorSettings(hq), /configuration-invalid/)
  await rm(path)
  await symlink('not-an-approved-target', path)
  await assert.rejects(shopConnectorSettings(hq), /configuration-invalid/)
})

test('the existing Brain reader only supplies the approved Shop references at their current revisions', async () => {
  let revision = 'current Shop guidance'
  let badSource = false
  const controller = new AbortController()
  const read = shopBrainReader(async ({ brain_files }, signal) => {
    assert.equal(signal, controller.signal)
    assert.equal(brain_files.length, 6)
    assert.equal(new Set(brain_files.map(file => file.id)).size, 6)
    return brain_files.map(({ id }, index) => ({
      id: badSource && index === 0 ? 'unexpected-id' : id, name: 'Shop reference', text: revision,
    }))
  })
  assert.match(await read({ signal: controller.signal }), /current Shop guidance/)
  revision = 'updated Shop guidance'
  assert.match(await read({ signal: controller.signal }), /updated Shop guidance/)
  badSource = true
  await assert.rejects(read({ signal: controller.signal }), /shop-brain-unavailable/)
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

test('staff-only sync pages metadata, coalesces calls, and reports only real overflow', async t => {
  const calls = []
  const snapshots = []
  const shopId = '00000000-0000-4000-8000-000000000001'
  const rows = Array.from({ length: 2_001 }, (_, index) => ({
    employeeId: '00000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'),
    employeeTemplate: 'shop-suit-agent-v1',
    shopId,
    shopName: 'Shop ' + String(index + 1),
    state: index === 0 ? 'busy' : 'idle',
  }))
  let count = 2_000
  let repeatCursor = false
  let stopped = false
  let staffSignals = 0
  const sockets = []
  class StaffSocket extends EventTarget {
    constructor() {
      super()
      sockets.push(this)
      queueMicrotask(() => this.dispatchEvent(new Event('open')))
    }

    frame(event, payload, ref, topic = 'realtime:shop-hq-assistant-jobs') {
      this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ event, payload, ref, topic }) }))
    }

    send(text) {
      const join = JSON.parse(text)
      assert.equal(join.event, 'phx_join')
      assert.equal(join.payload.config.private, true)
      assert.equal(join.payload.access_token, 'staff-fixture-session')
      queueMicrotask(() => this.frame('phx_reply', { status: 'ok' }, join.ref))
    }

    close() { this.dispatchEvent(new Event('close')) }
  }
  const connector = startShopConnector(config, {
    api: {
      async access() { return { accessToken: 'staff-fixture-session', expiresAt: Date.now() + 3_600_000 } },
      async rpc(name, { p_after_employee_id: after, p_limit: limit }) {
        assert.equal(name, 'shop_hq_assistant_staff')
        assert.equal(limit, 100)
        calls.push(after)
        const from = after === null ? 0 : rows.findIndex(row => row.employeeId === after) + 1
        const start = repeatCursor && after !== null ? from - 1 : from
        return rows.slice(start, Math.min(start + limit, count))
      },
      async stop() { stopped = true },
    },
    Socket: StaffSocket,
    admit() { assert.fail('staff-only mode checked job admission') },
    run() { assert.fail('staff-only mode attempted to drain jobs') },
    publishStaff: async staff => { snapshots.push(staff) },
    staffChanged() { staffSignals++ },
  })
  t.after(connector.stop)

  await waitFor(() => sockets.length === 1)
  const [socket] = sockets
  socket.frame('broadcast', { event: 'staff' })
  assert.equal(staffSignals, 0)
  socket.frame('system', { status: 'ok', extension: 'system', message: 'Replication connection established' })
  await waitFor(() => staffSignals === 1)
  socket.frame('broadcast', { event: 'staff' })
  socket.frame('broadcast', { event: 'jobs' })
  socket.frame('broadcast', { event: 'staff' }, undefined, 'realtime:other')
  socket.frame('broadcast', { event: 'unrelated' })
  connector.wake()
  assert.equal(staffSignals, 3)
  assert.equal(calls.length, 0)

  const first = connector.syncStaff()
  assert.equal(connector.syncStaff(), first)
  assert.equal(await first, true)
  assert.equal(calls.length, 21)
  assert.equal(calls[0], null)
  assert.equal(calls[20], rows[1_999].employeeId)
  assert.equal(snapshots[0].length, 2_000)
  assert.deepEqual(snapshots[0][0], { employeeId: rows[0].employeeId, shopName: 'Shop 1', state: 'busy' })

  count = 2_001
  assert.equal(await connector.syncStaff(), true)
  assert.equal(snapshots[1], null)
  repeatCursor = true
  await assert.rejects(connector.syncStaff(), /invalid-Shop-staff-row/)
  assert.equal(snapshots.length, 2)
  await connector.stop()
  assert.equal(stopped, true)
  assert.equal(await connector.syncStaff(), false)
  socket.frame('broadcast', { event: 'staff' })
  assert.equal(staffSignals, 3)
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
  let admitted = false
  let schedulingAllowed = false
  let schedulerCalls = 0

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

  const connector = startShopConnector(config, {
    admit: () => admitted,
    async run(action) {
      schedulerCalls++
      if (!schedulingAllowed) return false
      await action()
      return true
    },
    readDocs: async ({ signal }) => {
      assert.equal(signal.aborted, false)
      return 'Shop Suit v1.2.4 adds service search.'
    },
    Socket: FixtureSocket,
    log: event => logs.push(event),
    inference: {
      async inferEmployee(input) {
        lifecycle.push('employee')
        assert.deepEqual(input.employee, { id: identity.employeeId, template: identity.employeeTemplate })
        assert.deepEqual(input.messages, messages)
        assert.equal(input.docs, 'Shop Suit v1.2.4 adds service search.')
        assert.equal(input.schema.additionalProperties, false)
        assert.equal(input.signal.aborted, false)
        assert.match(input.instructions, /original script/)
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
        assert.equal(input.docs, 'Shop Suit v1.2.4 adds service search.')
        assert.equal(input.schema.additionalProperties, false)
        assert.equal(input.signal.aborted, false)
        assert.deepEqual(input.outcome, { kind: 'receipt' })
        assert.match(input.instructions, /Mariam/)
        const approve = input.intent.reply !== intent.reply
        return { approved: approve, feedback: approve ? null : 'Clarify the confirmation.' }
      },
    },
    fetcher: async (url, request) => {
      const body = JSON.parse(request.body)
      const path = new URL(url).pathname
      if (path === '/auth/v1/token') {
        assert.deepEqual(body, { email: config.email, password: config.password })
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
  t.after(connector.stop)

  await waitFor(() => sockets.length === 1)
  assert.deepEqual(lifecycle, [])
  sockets[0].ready()
  await delay(20)
  assert.equal(schedulerCalls, 0)
  assert.deepEqual(lifecycle, [])
  admitted = true
  connector.wake()
  await waitFor(() => schedulerCalls === 1)
  await delay(20)
  assert.equal(schedulerCalls, 1)
  assert.deepEqual(lifecycle, [])
  schedulingAllowed = true
  connector.wake()
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
