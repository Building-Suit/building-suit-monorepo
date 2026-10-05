import {
  BridgeError, INVOCATION_PATH, PROTOCOL_VERSION, RESPONSE_ALGORITHM, assertHeaderEnvelopeBinding,
  parseEnvelope, parseKeySet, parseProtocolHeaders, readKey, requestSigningInput,
  responseSigningInput, sha256Hex, signHmac, verifyHmac,
} from '../_shared/super-admin-bridge.mjs'
import {
  isPaymentEvidenceAccess, signPaymentEvidenceAccess,
} from '../_shared/payment-evidence.mjs'

// Kong strips /functions/v1; the HMAC input still uses the public INVOCATION_PATH.
const RUNTIME_INVOCATION_PATH = '/shop-super-admin-bridge/v1/invoke'
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
const responseHeaders = (keyId: string, bodyDigest: string, signature: string) => ({
  ...JSON_HEADERS,
  'x-bs-algorithm': RESPONSE_ALGORITHM,
  'x-bs-protocol-version': PROTOCOL_VERSION,
  'x-bs-key-id': keyId,
  'x-bs-body-sha256': bodyDigest,
  'x-bs-signature': signature,
})

type ProtocolHeaders = {
  algorithm: string
  protocolVersion: string
  keyId: string
  timestamp: number
  nonce: string
  requestId: string
  correlationId: string
  sourceBindingId: string
  targetBindingId: string
  targetEnvironmentId: string
  audience: string
  bodyDigest: string
  signature: string
}

type BridgeEnvelope = {
  protocolVersion: string
  operation: string
  operationVersion: string
  requestId: string
  correlationId: string
  sourceBindingId: string
  targetBindingId: string
  targetEnvironmentId: string
  actor: Record<string, unknown>
  reason: string | null
  payload: Record<string, unknown>
}

function env(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new BridgeError('bridge_configuration_unavailable', 503)
  return value
}

async function rpc(name: string, body: unknown) {
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) {
    const code = (() => { try { return JSON.parse(text).message } catch { return null } })()
    throw new BridgeError(typeof code === 'string' && /^[A-Z0-9_]+$/.test(code) ? code.toLowerCase() : 'target_request_rejected', response.status === 401 ? 401 : response.status === 403 ? 403 : 409)
  }
  return text ? JSON.parse(text) : null
}

function unsignedError(error: unknown) {
  const bridge = error instanceof BridgeError ? error : new BridgeError('bridge_unavailable', 503)
  return new Response(JSON.stringify({ error: { code: bridge.code } }), { status: bridge.status, headers: JSON_HEADERS })
}

Deno.serve(async request => {
  let authenticated: null | {
    headers: ProtocolHeaders
    envelope: BridgeEnvelope
    key: Uint8Array
    requestDigest: string
  } = null
  try {
    const url = new URL(request.url)
    if (request.method !== 'POST'
      || (url.pathname !== INVOCATION_PATH && url.pathname !== RUNTIME_INVOCATION_PATH)) {
      throw new BridgeError('route_not_found', 404)
    }
    if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') throw new BridgeError('content_type_invalid', 415)
    const bytes = new Uint8Array(await request.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > 65536) throw new BridgeError('request_body_invalid', 413)
    const headers = parseProtocolHeaders(request.headers) as ProtocolHeaders
    const envelope = parseEnvelope(bytes) as BridgeEnvelope
    const requestDigest = await sha256Hex(bytes)
    assertHeaderEnvelopeBinding(headers, envelope, requestDigest)

    const principal = await rpc('shop_super_admin_bridge_principal', {
      p_key_id: headers.keyId,
      p_source_binding_id: headers.sourceBindingId,
      p_target_binding_id: headers.targetBindingId,
      p_target_environment_id: headers.targetEnvironmentId,
      p_audience: headers.audience,
    })
    if (!principal || principal.protocolVersion !== envelope.protocolVersion) throw new BridgeError('authentication_required', 401)
    const key = readKey(parseKeySet(env('SHOP_SUPER_ADMIN_BRIDGE_KEYS')), headers.keyId)
    if (!await verifyHmac(key, requestSigningInput(headers), headers.signature)) {
      throw new BridgeError('authentication_required', 401)
    }
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - headers.timestamp) > principal.maxClockSkewSeconds) throw new BridgeError('request_timestamp_invalid', 401)
    authenticated = { headers, envelope, key, requestDigest }

    await rpc('shop_super_admin_bridge_accept_nonce', {
      p_principal_id: principal.principalId, p_key_id: headers.keyId,
      p_nonce: headers.nonce, p_request_id: headers.requestId,
      p_request_timestamp: headers.timestamp, p_body_digest: requestDigest,
    })
    const result = await rpc(isPaymentEvidenceAccess(envelope)
      ? 'shop_super_admin_bridge_evidence_access'
      : 'shop_super_admin_bridge_invoke', {
      p_principal_id: principal.principalId, p_nonce: headers.nonce,
      p_body_digest: requestDigest, p_envelope: envelope,
    })
    if (isPaymentEvidenceAccess(envelope)) {
      result.data = await signPaymentEvidenceAccess({
        data: result.data,
        supabaseUrl: env('SUPABASE_URL'),
        publicSupabaseUrl: Deno.env.get('SHOP_SUPER_ADMIN_PUBLIC_SUPABASE_URL'),
        serviceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY'),
      })
    }
    const responseEnvelope = {
      protocolVersion: PROTOCOL_VERSION, requestId: envelope.requestId,
      correlationId: envelope.correlationId, targetBindingId: envelope.targetBindingId,
      operation: envelope.operation, operationVersion: envelope.operationVersion,
      requestDigest, data: result.data, replayed: result.replayed,
      targetAuditId: result.targetAuditId, targetResultVersion: result.targetResultVersion,
    }
    const responseBytes = new TextEncoder().encode(JSON.stringify(responseEnvelope))
    const responseDigest = await sha256Hex(responseBytes)
    const signature = await signHmac(key, responseSigningInput({
      protocolVersion: PROTOCOL_VERSION, keyId: headers.keyId,
      requestId: envelope.requestId, correlationId: envelope.correlationId,
      sourceBindingId: envelope.sourceBindingId, targetBindingId: envelope.targetBindingId,
      targetEnvironmentId: envelope.targetEnvironmentId, audience: headers.audience,
      status: 200, requestBodyDigest: requestDigest, responseBodyDigest: responseDigest,
    }))
    return new Response(responseBytes, { status: 200, headers: responseHeaders(headers.keyId, responseDigest, signature) })
  }
  catch (error) {
    // Pre-authentication failures are intentionally unsigned and contain only a stable code.
    // Authenticated domain failures remain retryable under the same request ID and a fresh nonce.
    if (!authenticated) return unsignedError(error)
    const bridge = error instanceof BridgeError ? error : new BridgeError('bridge_unavailable', 503)
    const { headers, envelope, key, requestDigest } = authenticated
    const responseEnvelope = {
      protocolVersion: PROTOCOL_VERSION, requestId: envelope.requestId,
      correlationId: envelope.correlationId, targetBindingId: envelope.targetBindingId,
      operation: envelope.operation, operationVersion: envelope.operationVersion,
      requestDigest, error: { code: bridge.code },
    }
    const responseBytes = new TextEncoder().encode(JSON.stringify(responseEnvelope))
    const responseDigest = await sha256Hex(responseBytes)
    const signature = await signHmac(key, responseSigningInput({
      protocolVersion: PROTOCOL_VERSION, keyId: headers.keyId,
      requestId: envelope.requestId, correlationId: envelope.correlationId,
      sourceBindingId: envelope.sourceBindingId, targetBindingId: envelope.targetBindingId,
      targetEnvironmentId: envelope.targetEnvironmentId, audience: headers.audience,
      status: bridge.status, requestBodyDigest: requestDigest, responseBodyDigest: responseDigest,
    }))
    return new Response(responseBytes, { status: bridge.status, headers: responseHeaders(headers.keyId, responseDigest, signature) })
  }
})
