import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  INVOCATION_PATH, PROTOCOL_VERSION, REQUEST_ALGORITHM, SUPPORTED_OPERATIONS,
  assertHeaderEnvelopeBinding, parseEnvelope, parseKeySet, parseProtocolHeaders,
  readKey, requestSigningInput, responseSigningInput, sha256Hex, signHmac, verifyHmac,
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
  const canonicalInput = [
    'BS-S2S-HMAC-SHA256', '1.0', fields.keyId, String(fields.timestamp),
    ids.nonce, ids.requestId, ids.correlationId, ids.sourceBindingId,
    ids.targetBindingId, ids.targetEnvironmentId, fields.audience, 'POST',
    '/functions/v1/shop-super-admin-bridge/v1/invoke', bodyDigest,
  ].join('\n')
  assert.equal(INVOCATION_PATH, '/functions/v1/shop-super-admin-bridge/v1/invoke')
  assert.equal(requestSigningInput(fields), canonicalInput)
  assert.equal(await verifyHmac(key, requestSigningInput(fields), signature), true)
  assert.equal(await verifyHmac(key, canonicalInput.replace(INVOCATION_PATH, '/shop-super-admin-bridge/v1/invoke'), signature), false)
  assert.equal(await verifyHmac(key, canonicalInput.replace('\nPOST\n', '\nGET\n'), signature), false)
  assert.equal(await verifyHmac(key, requestSigningInput({ ...fields, bodyDigest: await sha256Hex(new TextEncoder().encode(`${JSON.stringify(envelope())} `)) }), signature), false)
  assert.equal(await verifyHmac(key, requestSigningInput({ ...fields, targetEnvironmentId: ids.sourceBindingId }), signature), false)
  assert.equal(await verifyHmac(key, requestSigningInput({ ...fields, nonce: ids.requestId }), signature), false)
  assert.match(requestSigningInput(fields), new RegExp(`${REQUEST_ALGORITHM}\\n${PROTOCOL_VERSION}`))
  assert.match(requestSigningInput(fields), new RegExp(`${INVOCATION_PATH.replaceAll('/', '\\/')}\\n${bodyDigest}$`))
})

test('handler routes only exact POST invocation paths through authentication', async t => {
  let handler
  const environmentReads = []
  const previousDeno = Object.getOwnPropertyDescriptor(globalThis, 'Deno')
  Object.defineProperty(globalThis, 'Deno', {
    configurable: true,
    value: {
      serve(callback) { handler = callback },
      env: { get(name) { environmentReads.push(name); throw new Error('Environment access forbidden in routing tests') } },
    },
  })
  t.after(() => {
    if (previousDeno) Object.defineProperty(globalThis, 'Deno', previousDeno)
    else delete globalThis.Deno
  })
  const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('RPC/network access forbidden in routing tests') })
  await import('../../supabase/functions/shop-super-admin-bridge/index.ts')
  assert.equal(typeof handler, 'function')

  const paths = ['/shop-super-admin-bridge/v1/invoke', '/functions/v1/shop-super-admin-bridge/v1/invoke']
  async function expectError(path, method, status, code, headers = {}) {
    const response = await handler(new Request(`https://bridge.invalid${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      ...(['GET', 'HEAD'].includes(method) ? {} : { body: JSON.stringify(envelope()) }),
    }))
    assert.equal(response.status, status, `${method} ${path}`)
    assert.deepEqual(await response.json(), { error: { code } }, `${method} ${path}`)
    assert.equal(response.headers.get('x-bs-signature'), null)
  }

  await t.test('public and gateway-stripped paths reach header authentication', async () => {
    for (const path of paths) await expectError(path, 'POST', 401, 'authentication_required')
  })

  await t.test('prefixes, suffixes, extra segments and encoded variants fail closed', async () => {
    const invalidPaths = [
      '/', '/v1/invoke', '/functions/v1/v1/invoke',
      '/another-function/v1/invoke', '/shop-super-admin-bridge/v2/invoke',
      '/shop-super-admin-bridge/v1/Invoke', '/shop-super-admin-bridge/v1/%69nvoke',
      ...paths.flatMap(path => [
        `/prefix${path}`, `${path}/`, `${path}/extra`, `${path}-extra`,
        path.replace('/v1/invoke', '/v1/extra/invoke'),
        path.replace('/v1/invoke', '//v1/invoke'),
      ]),
    ]
    for (const path of invalidPaths) await expectError(path, 'POST', 404, 'route_not_found')
  })

  await t.test('other methods remain rejected on both exact paths', async () => {
    for (const path of paths) {
      for (const method of ['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
        await expectError(path, method, 404, 'route_not_found')
      }
    }
  })

  await t.test('both exact paths preserve header/envelope binding before RPC', async () => {
    const bodyDigest = await sha256Hex(new TextEncoder().encode(JSON.stringify(envelope())))
    const headers = {
      'x-bs-algorithm': REQUEST_ALGORITHM, 'x-bs-protocol-version': PROTOCOL_VERSION,
      'x-bs-key-id': 'routing-test-key', 'x-bs-timestamp': '1791054000',
      'x-bs-nonce': ids.nonce, 'x-bs-request-id': ids.nonce,
      'x-bs-correlation-id': ids.correlationId, 'x-bs-source-binding-id': ids.sourceBindingId,
      'x-bs-target-binding-id': ids.targetBindingId, 'x-bs-target-environment-id': ids.targetEnvironmentId,
      'x-bs-audience': 'shop-suit:staging', 'x-bs-body-sha256': bodyDigest,
      'x-bs-signature': 'A'.repeat(43),
    }
    for (const path of paths) await expectError(path, 'POST', 401, 'request_binding_mismatch', headers)
  })

  assert.deepEqual(environmentReads, [])
  assert.equal(fetchMock.mock.callCount(), 0)
})

test('authenticated evidence handler uses trusted public configuration and fails closed on signing errors', async t => {
  let handler
  const key = crypto.getRandomValues(new Uint8Array(32))
  const keyId = 'evidence-test-key'
  const environment = {
    SUPABASE_URL: 'http://kong:8000', SUPABASE_SERVICE_ROLE_KEY: 'server-only-test-key',
    SHOP_SUPER_ADMIN_BRIDGE_KEYS: JSON.stringify({ [keyId]: Buffer.from(key).toString('base64url') }),
    SHOP_SUPER_ADMIN_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:61321',
  }
  const environmentReads = []
  const previousDeno = Object.getOwnPropertyDescriptor(globalThis, 'Deno')
  Object.defineProperty(globalThis, 'Deno', {
    configurable: true,
    value: {
      serve(callback) { handler = callback },
      env: { get(name) { environmentReads.push(name); return environment[name] } },
    },
  })
  t.after(() => {
    if (previousDeno) Object.defineProperty(globalThis, 'Deno', previousDeno)
    else delete globalThis.Deno
  })
  // Load the actual Edge Function with a fresh registration, without rewriting its logic.
  await import('../../supabase/functions/shop-super-admin-bridge/index.ts?evidence-signing-test')
  assert.equal(typeof handler, 'function')

  const evidence = {
    evidenceId: ids.requestId, submissionId: ids.correlationId,
    bucket: 'shop-payment-evidence', objectName: `${ids.sourceBindingId}/${ids.correlationId}/receipt.png`,
    originalFileName: 'receipt.png', mimeType: 'image/png', sizeBytes: 1024,
    expiresIn: 60, expiresAt: '2026-10-05T12:01:00Z',
  }
  const storagePath = `/object/sign/${evidence.bucket}/${evidence.objectName}`
  const tokenQuery = '?token=header.payload.test_signature'
  let signedPath = `${storagePath}${tokenQuery}`
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options })
    assert.equal(new URL(url).origin, 'http://kong:8000')
    assert.equal(options.headers.apikey, environment.SUPABASE_SERVICE_ROLE_KEY)
    assert.equal(options.headers.authorization, `Bearer ${environment.SUPABASE_SERVICE_ROLE_KEY}`)
    let result
    switch (new URL(url).pathname) {
      case '/rest/v1/rpc/shop_super_admin_bridge_principal':
        result = { protocolVersion: PROTOCOL_VERSION, principalId: ids.sourceBindingId, maxClockSkewSeconds: 60 }
        break
      case '/rest/v1/rpc/shop_super_admin_bridge_accept_nonce': result = null; break
      case '/rest/v1/rpc/shop_super_admin_bridge_evidence_access':
        result = { data: { ...evidence }, replayed: false, targetAuditId: ids.nonce, targetResultVersion: '1.0' }
        break
      case `/storage/v1${storagePath}`:
        assert.deepEqual(JSON.parse(options.body), { expiresIn: 60 })
        result = { signedURL: signedPath }
        break
      default: assert.fail(`unexpected fetch path: ${new URL(url).pathname}`)
    }
    return new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } })
  })

  async function invoke() {
    requests.length = 0
    const body = JSON.stringify(envelope({
      operation: 'shop.billing.query', reason: null,
      payload: { resource: 'evidence', submissionId: evidence.submissionId, evidenceId: evidence.evidenceId, expiresIn: 60 },
    }))
    const bodyDigest = await sha256Hex(new TextEncoder().encode(body))
    const fields = {
      ...ids, protocolVersion: PROTOCOL_VERSION, keyId,
      timestamp: Math.floor(Date.now() / 1000), audience: 'shop-suit:staging', bodyDigest,
    }
    const signature = await signHmac(key, requestSigningInput(fields))
    const response = await handler(new Request(`https://request-origin.attacker.invalid${INVOCATION_PATH}`, {
      method: 'POST', body,
      headers: {
        'content-type': 'application/json',
        origin: 'https://origin.attacker.invalid', host: 'host.attacker.invalid',
        'x-forwarded-host': 'forwarded.attacker.invalid', 'x-forwarded-proto': 'https',
        forwarded: 'host=forwarded.attacker.invalid;proto=https',
        'x-bs-algorithm': REQUEST_ALGORITHM, 'x-bs-protocol-version': PROTOCOL_VERSION,
        'x-bs-key-id': keyId, 'x-bs-timestamp': String(fields.timestamp),
        'x-bs-nonce': ids.nonce, 'x-bs-request-id': ids.requestId,
        'x-bs-correlation-id': ids.correlationId, 'x-bs-source-binding-id': ids.sourceBindingId,
        'x-bs-target-binding-id': ids.targetBindingId, 'x-bs-target-environment-id': ids.targetEnvironmentId,
        'x-bs-audience': fields.audience, 'x-bs-body-sha256': bodyDigest, 'x-bs-signature': signature,
      },
    }))
    const responseText = await response.text()
    const responseDigest = await sha256Hex(new TextEncoder().encode(responseText))
    assert.equal(response.headers.get('x-bs-body-sha256'), responseDigest, responseText)
    assert.equal(await verifyHmac(key, responseSigningInput({
      ...fields, status: response.status, requestBodyDigest: bodyDigest, responseBodyDigest: responseDigest,
    }), response.headers.get('x-bs-signature')), true)
    assert.equal(responseText.includes(environment.SUPABASE_SERVICE_ROLE_KEY), false)
    assert.deepEqual(requests.slice(0, 3).map(({ url }) => new URL(url).pathname), [
      '/rest/v1/rpc/shop_super_admin_bridge_principal',
      '/rest/v1/rpc/shop_super_admin_bridge_accept_nonce',
      '/rest/v1/rpc/shop_super_admin_bridge_evidence_access',
    ])
    return { status: response.status, payload: JSON.parse(responseText) }
  }

  await t.test('public URL comes from server environment despite hostile request headers and origin', async () => {
    const { status, payload } = await invoke()
    assert.equal(status, 200)
    const metadata = { ...evidence }
    delete metadata.bucket
    delete metadata.objectName
    delete metadata.expiresIn
    assert.deepEqual(payload.data, {
      ...metadata, signedUrl: `http://127.0.0.1:61321/storage/v1${storagePath}${tokenQuery}`,
    })
    assert.equal(requests.length, 4)
    assert.ok(environmentReads.includes('SHOP_SUPER_ADMIN_PUBLIC_SUPABASE_URL'))
  })

  await t.test('omitted public configuration defaults to the server Supabase URL', async () => {
    delete environment.SHOP_SUPER_ADMIN_PUBLIC_SUPABASE_URL
    const { status, payload } = await invoke()
    assert.equal(status, 200)
    assert.equal(payload.data.signedUrl, `http://kong:8000/storage/v1${storagePath}${tokenQuery}`)
  })

  await t.test('invalid public configuration stays a signed failure without a signing fetch', async () => {
    for (const value of ['', 'https://user:password@public.invalid', 'https://public.invalid/../']) {
      environment.SHOP_SUPER_ADMIN_PUBLIC_SUPABASE_URL = value
      const { status, payload } = await invoke()
      assert.equal(status, 503)
      assert.deepEqual(payload.error, { code: 'bridge_unavailable' })
      assert.equal(payload.data, undefined)
      assert.equal(requests.length, 3)
    }
  })

  await t.test('Storage cannot supply another host or object and signing failures remain signed', async () => {
    environment.SHOP_SUPER_ADMIN_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:61321'
    for (const value of [
      `https://storage-host.attacker.invalid/storage/v1${storagePath}${tokenQuery}`,
      `${storagePath.replace('receipt.png', 'different.png')}${tokenQuery}`,
      `${storagePath}?token=`,
    ]) {
      signedPath = value
      const { status, payload } = await invoke()
      assert.equal(status, 503)
      assert.deepEqual(payload.error, { code: 'bridge_unavailable' })
      assert.equal(payload.data, undefined)
      assert.equal(requests.length, 4)
    }
  })
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
