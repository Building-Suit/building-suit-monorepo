import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { trialActivationCommand, enqueueTrialActivation } from '../../server/utils/trial-activation.ts'

const input = () => ({ bindingId: randomUUID(), shopId: randomUUID(), subscriptionId: randomUUID(), planId: randomUUID(), requestId: randomUUID(), correlationId: randomUUID(), reason: 'Owner approved early activation' })
const actor = randomUUID()
const session = { userId: actor, role: 'owner', authorityEnvironmentId: randomUUID() }
function client(sessionResult = session, commandResult = randomUUID()) {
  const calls = []
  return {
    calls,
    auth: { getUser: async () => ({ data: { user: { id: actor } }, error: null }) },
    rpc: async (name, args) => {
      calls.push({ name, args })
      return { data: name === 'super_admin_session' ? sessionResult : commandResult, error: null }
    },
  }
}

test('activation uses a bounded target-owned command with exact selected account/plan', () => {
  const request = input()
  const result = trialActivationCommand(request)
  assert.equal(result.operation, 'shop.plan.command')
  assert.deepEqual(result.payload, { action: 'activate_trial', shopId: request.shopId, planId: request.planId, payload: { subscriptionId: request.subscriptionId } })
  assert.deepEqual(trialActivationCommand(request), result)
  assert.equal(result.requestId, request.requestId)
  assert.doesNotMatch(JSON.stringify(result), /paid|payment|trialEnd|price|duration|actor|email/)
})
test('client cannot inject actor, dates, payment evidence, endpoint or trial policy', () => {
  for (const key of ['actor', 'effectiveAt', 'trialDays', 'paid', 'endpoint', 'email', 'activationDays']) assert.throws(() => trialActivationCommand({ ...input(), [key]: 'injected' }))
  for (const key of ['bindingId', 'shopId', 'subscriptionId', 'planId', 'requestId', 'correlationId']) assert.throws(() => trialActivationCommand({ ...input(), [key]: 'invalid' }))
  for (const reason of ['', 'short', 'x'.repeat(1001)]) assert.throws(() => trialActivationCommand({ ...input(), reason }))
})
test('unauthorized or cross-user authority never enqueues a target command', async () => {
  for (const result of [null, { ...session, role: 'operator' }, { ...session, userId: randomUUID() }]) {
    const c = client(result)
    await assert.rejects(enqueueTrialActivation(c, input()))
    assert.equal(c.calls.length, 1)
  }
})
test('valid authority queues the same request id and does not claim activation success', async () => {
  const c = client()
  const request = input()
  const result = await enqueueTrialActivation(c, request)
  assert.equal(result.state, 'queued')
  assert.equal(result.requestId, request.requestId)
  assert.equal(c.calls[1].args.p_input.payload.payload.subscriptionId, request.subscriptionId)
})
test('unavailable enqueue and malformed dispatch identity fail closed', async () => {
  for (const value of [null, {}, 'not-a-uuid']) await assert.rejects(enqueueTrialActivation(client(session, value), input()))
})
