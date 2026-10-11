import assert from 'node:assert/strict'
import test from 'node:test'
import { AdapterError, parseAdapterInput, validateConfiguredAttempt, invokeShopAdapter } from '../../server/utils/shop-adapter.ts'
import { isPublicAddress, sendAdapterAttempt } from '../../server/utils/adapter-transport.ts'
const bindingId = '11111111-1111-4111-8111-111111111111'
const authority = '22222222-2222-4222-8222-222222222222'
const target = '33333333-3333-4333-8333-333333333333'
const input = { bindingId, operation: 'shop.platform.query', requestId: '44444444-4444-4444-8444-444444444444', correlationId: '55555555-5555-4555-8555-555555555555', reason: null, payload: { resource: 'dashboard' } }
function configured() {
  return {
    attemptId: 'fixture-attempt', url: 'https://bridge.example.invalid/functions/v1/shop-super-admin-bridge/v1/invoke', allowedHosts: ['bridge.example.invalid'], timeoutMs: 500, maxResponseBytes: 4096,
    configuration: { bindingId, authorityEnvironmentId: authority, targetEnvironmentId: target, operation: input.operation, version: '1.0', enabled: true, manifestExpiresAt: new Date(Date.now() + 60000).toISOString(), secretReferenceId: 'vault-reference-metadata' },
    body: JSON.stringify({ ...input, sourceBindingId: authority, targetEnvironmentId: target, actor: { authorityBindingId: authority, subjectId: 'database-actor' } }), headers: {},
  }
}
const throwsCode = (fn, code) => assert.throws(fn, error => error instanceof AdapterError && error.code === code)

test('configured database dispatch carries actor/request/correlation and accepts only verified result', async () => {
  const attempt = configured()
  let completed = false
  const result = await invokeShopAdapter(input, authority, {
    enqueue: async value => { assert.deepEqual(value, input); return 'dispatch' },
    claim: async id => { assert.equal(id, 'dispatch'); return attempt },
    complete: async (id, response) => { completed = true; assert.equal(id, attempt.attemptId); assert.equal(response.status, 200); return { data: { total: 1 }, targetAuditId: 'target-audit', replayed: false } },
  }, async value => { assert.deepEqual(value, attempt); return { status: 200, body: 'signed' } })
  assert.equal(completed, true)
  assert.deepEqual(result.data, { total: 1 })
  assert.equal(result.requestId, input.requestId)
  assert.equal(result.correlationId, input.correlationId)
  assert.equal(result.targetAuditId, 'target-audit')
  assert.equal('headers' in result, false)
})
for (const [name, mutate, code] of [
  ['missing', a => delete a.configuration, 'configuration_unavailable'],
  ['disabled', a => a.configuration.enabled = false, 'configuration_unavailable'],
  ['missing secret reference', a => delete a.configuration.secretReferenceId, 'configuration_unavailable'],
  ['wrong-version', a => a.configuration.version = '2.0', 'capability_unavailable'],
  ['wrong capability', a => a.configuration.operation = 'shop.plan.command', 'capability_unavailable'],
  ['wrong-environment', a => a.configuration.authorityEnvironmentId = target, 'environment_mismatch'],
  ['expired manifest', a => a.configuration.manifestExpiresAt = '2000-01-01', 'capability_unavailable'],
]) {
  test(`${name} configured records fail closed before transport`, () => {
    const attempt = configured(); mutate(attempt)
    throwsCode(() => validateConfiguredAttempt(attempt, input, authority), code)
  })
}
test('endpoint, actor, environment, version and key are not browser inputs', () => {
  assert.deepEqual(parseAdapterInput(input), input)
  for (const key of ['endpoint', 'actor', 'targetEnvironmentId', 'operationVersion', 'secretReferenceId']) throwsCode(() => parseAdapterInput({ ...input, [key]: 'injected' }), 'invalid_request')
  throwsCode(() => parseAdapterInput({ ...input, operation: 'shop.sql.command' }), 'invalid_request')
  throwsCode(() => parseAdapterInput({ ...input, operation: 'shop.billing.command' }), 'invalid_request')
  assert.equal(parseAdapterInput({ ...input, operation: 'shop.billing.command', reason: 'Reviewed by operator' }).reason, 'Reviewed by operator')
})
test('network loss records an ambiguous outcome without changing request IDs', async () => {
  let completions = 0
  await assert.rejects(() => invokeShopAdapter(input, authority, {
    enqueue: async () => 'dispatch', claim: async () => configured(),
    complete: async (_id, response) => { completions++; assert.equal(response, null); return { code: 'outcome_unknown' } },
  }, async () => { throw new Error('private endpoint and credential details') }), error => error.code === 'outcome_unknown' && !error.message.includes('private'))
  assert.equal(completions, 1)
})
test('verified target errors use a normalized code and discard target infrastructure detail', async () => {
  await assert.rejects(() => invokeShopAdapter(input, authority, {
    enqueue: async () => 'dispatch', claim: async () => configured(), complete: async () => ({ code: 'target_rejected', error: 'private SQL' }),
  }, async () => ({ status: 409 })), error => error.message === 'target_rejected')
})
test('public egress excludes local, metadata, private, reserved and IPv6 addresses', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '198.18.0.1', '224.0.0.1', '::1', '::ffff:127.0.0.1']) assert.equal(isPublicAddress(address), false, address)
  assert.equal(isPublicAddress('8.8.8.8'), true)
})
test('unapproved hosts/schemes/paths are rejected without networking', async () => {
  for (const url of ['http://bridge.example.invalid/', 'https://unapproved.example.invalid/', 'https://bridge.example.invalid/other', 'https://bridge.example.invalid:444/functions/v1/shop-super-admin-bridge/v1/invoke']) {
    await assert.rejects(() => sendAdapterAttempt({ ...configured(), url }), error => error.code === 'configuration_unavailable')
  }
})
