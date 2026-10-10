const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VERSION = /^\d+\.\d+$/
const HEX_64 = /^[0-9a-f]{64}$/
const BASE64URL = /^[A-Za-z0-9_-]{43}$/

export const PROTOCOL_VERSION = '1.0'
export const REQUEST_ALGORITHM = 'BS-S2S-HMAC-SHA256'
export const RESPONSE_ALGORITHM = 'BS-S2S-RESPONSE-HMAC-SHA256'
export const INVOCATION_PATH = '/functions/v1/shop-super-admin-bridge/v1/invoke'
export const SUPPORTED_OPERATIONS = Object.freeze([
  'adapter.capabilities.read',
  'shop.platform.query',
  'shop.platform.command',
  'shop.billing.query',
  'shop.billing.command',
  'shop.plan.query',
  'shop.plan.command',
])

export class BridgeError extends Error {
  constructor(code, status = 400) {
    super(code)
    this.name = 'BridgeError'
    this.code = code
    this.status = status
  }
}

export function base64url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function decodeBase64url(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new BridgeError('bridge_key_invalid', 500)
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

export async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return [...digest].map(value => value.toString(16).padStart(2, '0')).join('')
}

function importHmacKey(keyBytes) {
  return crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signHmac(keyBytes, input) {
  const key = await importHmacKey(keyBytes)
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(input))))
}

export async function verifyHmac(keyBytes, input, signature) {
  if (typeof signature !== 'string' || !BASE64URL.test(signature)) return false
  const key = await importHmacKey(keyBytes)
  return crypto.subtle.verify('HMAC', key, decodeBase64url(signature), new TextEncoder().encode(input))
}

export function requestSigningInput(fields) {
  return [
    REQUEST_ALGORITHM, fields.protocolVersion, fields.keyId,
    String(fields.timestamp), fields.nonce, fields.requestId,
    fields.correlationId, fields.sourceBindingId, fields.targetBindingId,
    fields.targetEnvironmentId, fields.audience, 'POST', INVOCATION_PATH,
    fields.bodyDigest,
  ].join('\n')
}

export function responseSigningInput(fields) {
  return [
    RESPONSE_ALGORITHM, fields.protocolVersion, fields.keyId,
    fields.requestId, fields.correlationId, fields.sourceBindingId,
    fields.targetBindingId, fields.targetEnvironmentId, fields.audience,
    String(fields.status), fields.requestBodyDigest, fields.responseBodyDigest,
  ].join('\n')
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0')
}

export function parseEnvelope(bytes) {
  let envelope
  try { envelope = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
  catch { throw new BridgeError('request_body_invalid') }
  if (!exactKeys(envelope, [
    'protocolVersion', 'operation', 'operationVersion', 'requestId', 'correlationId',
    'sourceBindingId', 'targetBindingId', 'targetEnvironmentId', 'actor', 'reason', 'payload',
  ]) || !exactKeys(envelope.actor, ['authorityBindingId', 'subjectId', 'roleSnapshot', 'sessionId'])) {
    throw new BridgeError('request_envelope_invalid')
  }
  for (const key of ['requestId', 'correlationId', 'sourceBindingId', 'targetBindingId', 'targetEnvironmentId']) {
    if (!UUID.test(envelope[key])) throw new BridgeError('request_envelope_invalid')
  }
  if (!UUID.test(envelope.actor.authorityBindingId) || !UUID.test(envelope.actor.subjectId)
    || typeof envelope.actor.roleSnapshot !== 'string' || envelope.actor.roleSnapshot.length > 160
    || (envelope.actor.sessionId !== null && (typeof envelope.actor.sessionId !== 'string' || envelope.actor.sessionId.length > 200))
    || envelope.protocolVersion !== PROTOCOL_VERSION || !VERSION.test(envelope.operationVersion)
    || !SUPPORTED_OPERATIONS.includes(envelope.operation)
    || !envelope.payload || typeof envelope.payload !== 'object' || Array.isArray(envelope.payload)
    || (envelope.operation.endsWith('.command') && (typeof envelope.reason !== 'string' || envelope.reason.trim().length < 2))
    || (!envelope.operation.endsWith('.command') && envelope.reason !== null)) {
    throw new BridgeError('request_envelope_invalid')
  }
  return envelope
}

export function parseProtocolHeaders(headers) {
  const required = {
    algorithm: 'x-bs-algorithm', protocolVersion: 'x-bs-protocol-version',
    keyId: 'x-bs-key-id', timestamp: 'x-bs-timestamp',
    nonce: 'x-bs-nonce', requestId: 'x-bs-request-id', correlationId: 'x-bs-correlation-id',
    sourceBindingId: 'x-bs-source-binding-id', targetBindingId: 'x-bs-target-binding-id',
    targetEnvironmentId: 'x-bs-target-environment-id', audience: 'x-bs-audience',
    bodyDigest: 'x-bs-body-sha256', signature: 'x-bs-signature',
  }
  const values = {}
  for (const [field, name] of Object.entries(required)) {
    const value = headers.get(name)
    if (!value || value.includes(',')) throw new BridgeError('authentication_required', 401)
    values[field] = value
  }
  if (values.algorithm !== REQUEST_ALGORITHM || values.protocolVersion !== PROTOCOL_VERSION
    || !/^\d+$/.test(values.timestamp)
    || !UUID.test(values.nonce) || !UUID.test(values.requestId) || !UUID.test(values.correlationId)
    || !UUID.test(values.sourceBindingId) || !UUID.test(values.targetBindingId)
    || !UUID.test(values.targetEnvironmentId) || !HEX_64.test(values.bodyDigest)
    || !BASE64URL.test(values.signature) || values.keyId.length > 120 || values.audience.length > 240) {
    throw new BridgeError('authentication_required', 401)
  }
  values.timestamp = Number(values.timestamp)
  return values
}

export function assertHeaderEnvelopeBinding(headers, envelope, bodyDigest) {
  const pairs = [
    ['requestId', 'requestId'], ['correlationId', 'correlationId'],
    ['sourceBindingId', 'sourceBindingId'], ['targetBindingId', 'targetBindingId'],
    ['targetEnvironmentId', 'targetEnvironmentId'],
  ]
  if (headers.protocolVersion !== envelope.protocolVersion || headers.bodyDigest !== bodyDigest
    || pairs.some(([header, body]) => headers[header] !== envelope[body])) {
    throw new BridgeError('request_binding_mismatch', 401)
  }
}

export function parseKeySet(raw) {
  let value
  try { value = JSON.parse(raw) }
  catch { throw new BridgeError('bridge_configuration_unavailable', 503) }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BridgeError('bridge_configuration_unavailable', 503)
  return value
}

export function readKey(keySet, keyId) {
  const encoded = keySet[keyId]
  if (typeof encoded !== 'string') throw new BridgeError('authentication_required', 401)
  const key = decodeBase64url(encoded)
  if (key.byteLength < 32) throw new BridgeError('bridge_configuration_unavailable', 503)
  return key
}
