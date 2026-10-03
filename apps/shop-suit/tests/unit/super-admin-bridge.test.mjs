import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  INVOCATION_PATH, PROTOCOL_VERSION, REQUEST_ALGORITHM, SUPPORTED_OPERATIONS,
  assertHeaderEnvelopeBinding, parseEnvelope, parseKeySet, parseProtocolHeaders,
  readKey, requestSigningInput, sha256Hex, signHmac, verifyHmac,
} from '../../supabase/functions/_shared/super-admin-bridge.mjs'

const ids = {
  requestId: '10000000-0000-4000-a000-000000000001',
  correlationId: '10000000-0000-4000-a000-000000000002',
  sourceBindingId: '10000000-0000-4000-a000-000000000003',
  targetBindingId: '10000000-0000-4000-a000-000000000004',
  targetEnvironmentId: '10000000-0000-4000-a000-000000000005',
  nonce: '10000000-0000-4000-a000-000000000006',
}

function envelope(overrides = {}) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    operation: 'shop.platform.command',
    operationVersion: '1.0',
    requestId: ids.requestId,
    correlationId: ids.correlationId,
    sourceBindingId: ids.sourceBindingId,
    targetBindingId: ids.targetBindingId,
    targetEnvironmentId: ids.targetEnvironmentId,
    actor: {
      authorityBindingId: ids.sourceBindingId,
      subjectId: '10000000-0000-4000-a000-000000000007',
      roleSnapshot: 'platform-operator',
      sessionId: 'safe-session-reference',
    },
    reason: 'Verified support action',
    payload: { shopId: '10000000-0000-4000-a000-000000000008', action: 'add_support_note', payload: { note: 'Checked' } },
    ...overrides,
  }
}

test('request signatures bind exact bytes, route, environment and nonce', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(envelope()))
  const bodyDigest = await sha256Hex(bytes)
  const fields = {
    ...ids, protocolVersion: PROTOCOL_VERSION, keyId: 'shop-staging-v1',
    timestamp: 1791054000, audience: 'shop-suit:staging', bodyDigest,
  }
  const key = crypto.getRandomValues(new Uint8Array(32))
  const signature = await signHmac(key, requestSigningInput(fields))
  assert.equal(await verifyHmac(key, requestSigningInput(fields), signature), true)
  assert.equal(await verifyHmac(key, requestSigningInput({ ...fields, targetEnvironmentId: ids.sourceBindingId }), signature), false)
  assert.equal(await verifyHmac(key, requestSigningInput({ ...fields, nonce: ids.requestId }), signature), false)
  assert.match(requestSigningInput(fields), new RegExp(`${REQUEST_ALGORITHM}\\n${PROTOCOL_VERSION}`))
  assert.match(requestSigningInput(fields), new RegExp(`${INVOCATION_PATH.replaceAll('/', '\\/')}\\n${bodyDigest}$`))
})

test('closed envelope and headers reject extra fields and binding changes', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(envelope()))
  const parsed = parseEnvelope(bytes)
  assert.equal(parsed.operation, 'shop.platform.command')
  assert.throws(() => parseEnvelope(new TextEncoder().encode(JSON.stringify(envelope({ rpc: 'arbitrary_sql' })))), /request_envelope_invalid/)
  assert.throws(() => parseEnvelope(new TextEncoder().encode(JSON.stringify(envelope({ operation: 'shop.sales.command' })))), /request_envelope_invalid/)

  const digest = await sha256Hex(bytes)
  const headers = new Headers({
    'x-bs-algorithm': REQUEST_ALGORITHM, 'x-bs-protocol-version': PROTOCOL_VERSION,
    'x-bs-key-id': 'shop-staging-v1',
    'x-bs-timestamp': '1791054000', 'x-bs-nonce': ids.nonce,
    'x-bs-request-id': ids.requestId, 'x-bs-correlation-id': ids.correlationId,
    'x-bs-source-binding-id': ids.sourceBindingId, 'x-bs-target-binding-id': ids.targetBindingId,
    'x-bs-target-environment-id': ids.targetEnvironmentId, 'x-bs-audience': 'shop-suit:staging',
    'x-bs-body-sha256': digest, 'x-bs-signature': 'A'.repeat(43),
  })
  const protocol = parseProtocolHeaders(headers)
  assert.doesNotThrow(() => assertHeaderEnvelopeBinding(protocol, parsed, digest))
  assert.throws(() => assertHeaderEnvelopeBinding({ ...protocol, targetEnvironmentId: ids.sourceBindingId }, parsed, digest), /request_binding_mismatch/)
})

test('key configuration is explicit, server-only and capability surface is bounded', async () => {
  const key = crypto.getRandomValues(new Uint8Array(32))
  const encoded = Buffer.from(key).toString('base64url')
  assert.deepEqual(readKey(parseKeySet(JSON.stringify({ 'shop-staging-v1': encoded })), 'shop-staging-v1'), key)
  assert.throws(() => readKey(parseKeySet('{}'), 'shop-staging-v1'), /authentication_required/)
  assert.deepEqual(SUPPORTED_OPERATIONS, [
    'adapter.capabilities.read', 'shop.platform.query', 'shop.platform.command',
    'shop.billing.query', 'shop.billing.command', 'shop.plan.query', 'shop.plan.command',
  ])

  const index = await readFile(new URL('../../supabase/functions/shop-super-admin-bridge/index.ts', import.meta.url), 'utf8')
  const migration = await readFile(new URL('../../supabase/migrations/20261003210000_super_admin_server_bridge.sql', import.meta.url), 'utf8')
  const shopClientFiles = await Promise.all([
    '../../nuxt.config.ts', '../../app/composables/usePlans.ts', '../../app/pages/platform-admin.vue',
  ].map(path => readFile(new URL(path, import.meta.url), 'utf8')))
  assert.match(index, /SHOP_SUPER_ADMIN_BRIDGE_KEYS/)
  assert.match(index, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(shopClientFiles.join('\n'), /SHOP_SUPER_ADMIN_BRIDGE_KEYS|SUPABASE_SERVICE_ROLE_KEY|x-bs-signature/)
  assert.doesNotMatch(migration, /execute\s+format|query_to_xml|dblink|arbitrary_sql/i)
  assert.match(migration, /public\.platform_admin_command/)
  assert.match(migration, /public\.platform_admin_billing_command/)
  assert.match(migration, /public\.platform_plan_command/)
  assert.match(migration, /not in \('suspend_shop','reactivate_shop','add_support_note'\)/)
  assert.doesNotMatch(migration, /shop\.platform\.command'[\s\S]{0,300}activate_subscription/)
})
