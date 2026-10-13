import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { isPublicAddress, resolveAttempt, dispatchRequest } from '../../server/utils/adapter-dispatch.ts'
import { accountQuery, activateAccount } from '../../server/utils/account-workflow.ts'

const bindingId = randomUUID(), userId = randomUUID(), environment = randomUUID()
const attempt = () => ({ attemptId: randomUUID(), url: 'https://adapter.example/functions/v1/shop-super-admin-bridge/v1/invoke', allowedHosts: ['adapter.example'], timeoutMs: 1000, maxResponseBytes: 2048, body: '{}', headers: { 'x-bs-signature': 'task-test-signature' } })
const command = () => ({ bindingId, shopId: randomUUID(), subscriptionId: randomUUID(), planId: randomUUID(), reason: 'Early activation approved', requestId: randomUUID(), correlationId: randomUUID() })
function runtime({ modules = [{ module: 'accounts', bindingId, label: { en: 'Accounts' } }], result = null, claimError = null, completeError = null } = {}) {
  const calls = []
  const actor = {
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    rpc: async (name, args) => {
      calls.push({ name, args })
      if (name === 'super_admin_session') return { data: { userId, role: 'owner', authorityEnvironmentId: environment }, error: null }
      if (name === 'super_admin_configuration_read') return { data: { suits: [{ label: { en: 'Fixture' }, items: modules }] }, error: null }
      return { data: randomUUID(), error: null }
    },
  }
  const worker = { rpc: async (name, args) => {
    calls.push({ name, args })
    const payload = calls.find(call => call.name === 'super_admin_adapter_enqueue')?.args.p_input.payload
    return name === 'super_admin_adapter_claim' ? { data: attempt(), error: claimError } : { data: result ?? { data: { status: 'active', id: payload?.payload?.subscriptionId, planId: payload?.planId, periodStart: '2026-10-13T08:00:00Z', periodEnd: '2026-11-13T08:00:00Z' }, targetAuditId: randomUUID() }, error: completeError }
  } }
  return { actor, worker, calls }
}
const response = async () => ({ status: 200, headers: {}, body: JSON.stringify({ data: 'unverified HTTP data' }) })

test('private/reserved addresses and transition IPv6 cannot be used for adapter egress', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '0.0.0.0', '100.64.0.1', '169.254.1.1', '172.16.0.1', '192.168.0.1', '192.0.2.1', '198.18.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001::1', '2002:7f00:1::', '3fff::1', 'garbage']) assert.equal(isPublicAddress(address), false, address)
  for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isPublicAddress(address), true, address)
})
test('claimed host, HTTPS path and public DNS answers are enforced before transport', async () => {
  let resolves = 0
  const resolve = async () => { resolves++; return [{ address: '8.8.8.8', family: 4 }] }
  assert.equal((await resolveAttempt(attempt(), resolve)).address.address, '8.8.8.8')
  assert.equal(resolves, 1)
  for (const value of [
    { url: 'http://adapter.example/functions/v1/shop-super-admin-bridge/v1/invoke' },
    { url: 'https://adapter.example/other' }, { allowedHosts: ['other.example'] },
    { url: 'https://adapter.example:8443/functions/v1/shop-super-admin-bridge/v1/invoke' },
    { url: 'https://person@adapter.example/functions/v1/shop-super-admin-bridge/v1/invoke' },
    { timeoutMs: 999999 }, { maxResponseBytes: 99999999 }, { body: 'x'.repeat(65537) },
  ]) await assert.rejects(resolveAttempt({ ...attempt(), ...value }, resolve))
  await assert.rejects(resolveAttempt(attempt(), async () => [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }]))
})
test('only the database-verified projection/audit reaches the caller, never raw HTTP or signing material', async () => {
  const r = runtime()
  const input = command()
  const result = await activateAccount(r.actor, r.worker, input, response)
  assert.equal(result.state, 'success')
  assert.deepEqual(result.data, { status: 'active', id: input.subscriptionId, planId: input.planId, periodStart: '2026-10-13T08:00:00Z', periodEnd: '2026-11-13T08:00:00Z' })
  assert.doesNotMatch(JSON.stringify(result), /signature|adapter\.example|unverified HTTP/)
  assert.equal(r.calls.find(call => call.name === 'super_admin_adapter_enqueue').args.p_input.requestId, input.requestId)
  assert.match(r.calls.find(call => call.name === 'super_admin_adapter_complete').args.p_response.body, /unverified HTTP/)
})
test('timeout/lost response completes as unknown and exact retry retains logical request ID', async () => {
  const r = runtime({ result: { code: 'outcome_unknown' } })
  const input = command()
  const lost = async () => { throw new Error('response lost after commit') }
  assert.equal((await activateAccount(r.actor, r.worker, input, lost)).state, 'outcome_unknown')
  assert.equal((await activateAccount(r.actor, r.worker, input, lost)).requestId, input.requestId)
  const enqueues = r.calls.filter(call => call.name === 'super_admin_adapter_enqueue')
  assert.deepEqual(enqueues[0].args, enqueues[1].args)
  assert.equal(r.calls.find(call => call.name === 'super_admin_adapter_complete').args.p_response, null)
})
test('missing verification, signed target rejection, busy claim and finalize failure do not become success', async () => {
  for (const options of [{ result: { data: { status: 'active' } } }, { result: { code: 'outcome_unknown' } }, { claimError: {} }, { completeError: {} }]) {
    const r = runtime(options)
    assert.equal((await activateAccount(r.actor, r.worker, command(), response)).state, 'outcome_unknown')
  }
  const r = runtime({ result: { code: 'target_rejected' } })
  assert.equal((await activateAccount(r.actor, r.worker, command(), response)).state, 'target_rejected')
})
test('disabled/unconfigured/other environment binding never signs or contacts the target', async () => {
  for (const modules of [[], [{ module: 'accounts', bindingId: randomUUID() }], [{ module: 'other', bindingId }]]) {
    const r = runtime({ modules })
    await assert.rejects(activateAccount(r.actor, r.worker, command(), response))
    assert.equal(r.calls.some(call => call.name === 'super_admin_adapter_claim'), false)
  }
})
test('invalid query pages and shop identities never enqueue', async () => {
  for (const input of [{ bindingId, page: 0 }, { bindingId, page: '1 OR 1' }, { bindingId, shopId: 'invalid' }]) {
    const r = runtime()
    await assert.rejects(accountQuery(r.actor, r.worker, input, response))
    assert.equal(r.calls.some(call => call.name === 'super_admin_adapter_enqueue'), false)
  }
})
test('enqueue rejection produces no target request', async () => {
  const r = runtime()
  const actor = { rpc: async () => ({ error: {}, data: null }) }
  await assert.rejects(dispatchRequest(actor, r.worker, { requestId: randomUUID() }, response))
  assert.equal(r.calls.length, 0)
})

test('a verified but semantically mismatched result is never reported as activation', async () => {
  const input = command()
  const snapshot = { id: input.subscriptionId, planId: input.planId, status: 'active', periodStart: '2026-10-13T08:00:00Z', periodEnd: '2026-11-13T08:00:00Z' }
  for (const change of [{ id: randomUUID() }, { planId: randomUUID() }, { status: 'trialing' }, { periodStart: 'invalid' }, { periodEnd: snapshot.periodStart }]) {
    const r = runtime({ result: { data: { ...snapshot, ...change }, targetAuditId: randomUUID() } })
    assert.equal((await activateAccount(r.actor, r.worker, input, response)).state, 'outcome_unknown')
  }
})
