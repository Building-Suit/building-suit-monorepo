import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PROTOCOL_VERSION, REQUEST_ALGORITHM, decodeBase64url, requestSigningInput,
  sha256Hex, signHmac,
} from '../../supabase/functions/_shared/super-admin-bridge.mjs'

const fixtureVariables = [
  'SHOP_EVIDENCE_ANON_KEY',
  'SHOP_EVIDENCE_OWNER_TOKEN',
  'SHOP_EVIDENCE_OUTSIDER_TOKEN',
  'SHOP_EVIDENCE_SUBMISSION_ID',
  'SHOP_EVIDENCE_BRIDGE_KEY_ID',
  'SHOP_EVIDENCE_BRIDGE_HMAC_KEY',
  'SHOP_EVIDENCE_SOURCE_BINDING_ID',
  'SHOP_EVIDENCE_TARGET_BINDING_ID',
  'SHOP_EVIDENCE_TARGET_ENVIRONMENT_ID',
  'SHOP_EVIDENCE_AUDIENCE',
]
const missingFixtureVariables = fixtureVariables.filter(name => !process.env[name])
assert.equal(missingFixtureVariables.length, 0,
  `Disposable local payment-evidence fixture is required; missing: ${missingFixtureVariables.join(', ')}`)
const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required for the disposable local evidence test`)
  return value
}

test('private payment evidence HTTP boundaries and signed expiry', async () => {
const baseUrl = process.env.SHOP_EVIDENCE_SUPABASE_URL ?? 'http://127.0.0.1:61321'
const bridgeUrl = process.env.SHOP_EVIDENCE_BRIDGE_URL
  ?? `${baseUrl}/functions/v1/shop-super-admin-bridge/v1/invoke`
const anonKey = required('SHOP_EVIDENCE_ANON_KEY')
const ownerToken = required('SHOP_EVIDENCE_OWNER_TOKEN')
const outsiderToken = required('SHOP_EVIDENCE_OUTSIDER_TOKEN')
const submissionId = required('SHOP_EVIDENCE_SUBMISSION_ID')
const keyId = required('SHOP_EVIDENCE_BRIDGE_KEY_ID')
const hmacKey = decodeBase64url(required('SHOP_EVIDENCE_BRIDGE_HMAC_KEY'))
const sourceBindingId = required('SHOP_EVIDENCE_SOURCE_BINDING_ID')
const targetBindingId = required('SHOP_EVIDENCE_TARGET_BINDING_ID')
const targetEnvironmentId = required('SHOP_EVIDENCE_TARGET_ENVIRONMENT_ID')
const audience = required('SHOP_EVIDENCE_AUDIENCE')

const authHeaders = (token) => ({
  apikey: anonKey, authorization: `Bearer ${token}`,
})
const bytes = crypto.getRandomValues(new Uint8Array(2048))
const sha256 = await sha256Hex(bytes)

const reserve = await fetch(`${baseUrl}/rest/v1/rpc/reserve_shop_billing_payment_evidence`, {
  method: 'POST', headers: { ...authHeaders(ownerToken), 'content-type': 'application/json' },
  body: JSON.stringify({
    p_submission_id: submissionId, p_original_file_name: 'disposable-evidence.png',
    p_mime_type: 'image/png', p_size_bytes: bytes.byteLength, p_sha256: sha256,
  }),
})
if (!reserve.ok) assert.fail(`reservation failed: ${await reserve.text()}`)
const reserved = await reserve.json()

const objectUrl = `${baseUrl}/storage/v1/object/shop-payment-evidence/${reserved.objectName}`
const upload = await fetch(objectUrl, {
  method: 'POST', headers: {
    ...authHeaders(ownerToken), 'content-type': 'image/png', 'x-upsert': 'false',
  }, body: bytes,
})
assert.equal(upload.ok, true, `owner upload failed: ${await upload.text()}`)

const ownerRead = await fetch(objectUrl, { headers: authHeaders(ownerToken) })
assert.equal(ownerRead.ok, true, 'owner could not read reserved evidence')
assert.deepEqual(new Uint8Array(await ownerRead.arrayBuffer()), bytes)

const outsiderRead = await fetch(objectUrl, { headers: authHeaders(outsiderToken) })
assert.equal(outsiderRead.ok, false, 'outsider read private evidence')
const anonymousRead = await fetch(objectUrl, { headers: { apikey: anonKey } })
assert.equal(anonymousRead.ok, false, 'anonymous user read private evidence')
const replacement = await fetch(objectUrl, {
  method: 'POST', headers: {
    ...authHeaders(ownerToken), 'content-type': 'image/png', 'x-upsert': 'true',
  }, body: bytes,
})
assert.equal(replacement.ok, false, 'owner replaced immutable evidence')
const deletion = await fetch(objectUrl, { method: 'DELETE', headers: authHeaders(ownerToken) })
assert.equal(deletion.ok, false, 'owner deleted retained evidence')

const requestId = crypto.randomUUID()
const correlationId = crypto.randomUUID()
const nonce = crypto.randomUUID()
const envelope = {
  protocolVersion: PROTOCOL_VERSION, operation: 'shop.billing.query', operationVersion: '1.0',
  requestId, correlationId, sourceBindingId, targetBindingId, targetEnvironmentId,
  actor: {
    authorityBindingId: sourceBindingId, subjectId: crypto.randomUUID(),
    roleSnapshot: 'super-admin-reviewer', sessionId: 'local-disposable-evidence-test',
  },
  reason: null,
  payload: { resource: 'evidence', submissionId, evidenceId: reserved.evidenceId, expiresIn: 30 },
}
const bodyBytes = new TextEncoder().encode(JSON.stringify(envelope))
const bodyDigest = await sha256Hex(bodyBytes)
const timestamp = Math.floor(Date.now() / 1000)
const signature = await signHmac(hmacKey, requestSigningInput({
  protocolVersion: PROTOCOL_VERSION, keyId, timestamp, nonce, requestId, correlationId,
  sourceBindingId, targetBindingId, targetEnvironmentId, audience, bodyDigest,
}))
const bridge = await fetch(bridgeUrl, {
  method: 'POST',
  headers: {
    'content-type': 'application/json', 'x-bs-algorithm': REQUEST_ALGORITHM,
    'x-bs-protocol-version': PROTOCOL_VERSION, 'x-bs-key-id': keyId,
    'x-bs-timestamp': String(timestamp), 'x-bs-nonce': nonce,
    'x-bs-request-id': requestId, 'x-bs-correlation-id': correlationId,
    'x-bs-source-binding-id': sourceBindingId, 'x-bs-target-binding-id': targetBindingId,
    'x-bs-target-environment-id': targetEnvironmentId, 'x-bs-audience': audience,
    'x-bs-body-sha256': bodyDigest, 'x-bs-signature': signature,
  },
  body: bodyBytes,
})
if (!bridge.ok) assert.fail(`trusted review failed: ${await bridge.text()}`)
const bridgeResult = await bridge.json()
assert.equal(typeof bridgeResult.data.signedUrl, 'string')
assert.equal(bridgeResult.data.objectName, undefined, 'private object path escaped bridge')
assert.equal((await fetch(bridgeResult.data.signedUrl)).ok, true, 'fresh signed URL did not read evidence')

await new Promise(resolve => setTimeout(resolve, 31_000))
assert.equal((await fetch(bridgeResult.data.signedUrl)).ok, false, 'expired signed URL still read evidence')
console.log('payment-evidence-http: passed against disposable local Shop data')
})
