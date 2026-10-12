/** Protocol validation is code; effective operations and connection policy are database records. */
export type ShopOperation = 'adapter.capabilities.read' | `shop.${'platform' | 'billing' | 'plan'}.${'query' | 'command'}`
export type AdapterErrorCode = 'configuration_unavailable' | 'capability_unavailable' | 'environment_mismatch' | 'invalid_request' | 'access_denied' | 'target_rejected' | 'outcome_unknown'
export class AdapterError extends Error {
  code: AdapterErrorCode
  constructor(code: AdapterErrorCode) { super(code); this.code = code }
}
export interface AdapterInput {
  bindingId: string
  operation: ShopOperation
  requestId: string
  correlationId: string
  reason: string | null
  payload: Record<string, unknown>
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function parseAdapterInput(value: unknown): AdapterInput {
  const input = value as AdapterInput
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).sort().join(',') !== 'bindingId,correlationId,operation,payload,reason,requestId'
    || ![input.bindingId, input.requestId, input.correlationId].every(id => typeof id === 'string' && uuid.test(id))
    || typeof input.operation !== 'string' || !/^(adapter\.capabilities\.read|shop\.(platform|billing|plan)\.(query|command))$/.test(input.operation)
    || !input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)
    || (input.operation.endsWith('.command') ? typeof input.reason !== 'string' || input.reason.trim().length < 8 || input.reason.length > 1000 : input.reason !== null)) {
    throw new AdapterError('invalid_request')
  }
  return input
}
export interface SignedAttempt {
  configuration: { bindingId: string; authorityEnvironmentId: string; targetEnvironmentId: string; operation: string; version: string; enabled: boolean; manifestExpiresAt: string; secretReferenceId: string }
  attemptId: string
  url: string
  allowedHosts: string[]
  timeoutMs: number
  maxResponseBytes: number
  body: string
  headers: Record<string, string>
}
export interface WireResponse { status: number; body: string; signature: string; algorithm: string; keyId: string; protocolVersion: string; digest: string }
export interface AdapterDatabase {
  enqueue(input: AdapterInput): Promise<string>
  claim(dispatchId: string): Promise<SignedAttempt>
  complete(attemptId: string, response: WireResponse | null): Promise<unknown>
}
export function validateConfiguredAttempt(attempt: SignedAttempt, input: AdapterInput, authorityEnvironmentId: string) {
  const config = attempt?.configuration
  if (!config || !config.secretReferenceId || !config.enabled || config.bindingId !== input.bindingId) throw new AdapterError('configuration_unavailable')
  if (config.authorityEnvironmentId !== authorityEnvironmentId) throw new AdapterError('environment_mismatch')
  if (config.operation !== input.operation || config.version !== '1.0'
    || !Number.isFinite(Date.parse(config.manifestExpiresAt)) || Date.parse(config.manifestExpiresAt) <= Date.now()) throw new AdapterError('capability_unavailable')
  const envelope = JSON.parse(attempt.body)
  if (envelope.requestId !== input.requestId || envelope.correlationId !== input.correlationId
    || envelope.targetEnvironmentId !== config.targetEnvironmentId || envelope.sourceBindingId !== authorityEnvironmentId
    || envelope.actor.authorityBindingId !== authorityEnvironmentId) throw new AdapterError('environment_mismatch')
}
/** The signer and verifier resolve Vault only inside restricted database functions. */
export async function invokeShopAdapter(input: AdapterInput, authorityEnvironmentId: string, database: AdapterDatabase, transport: (attempt: SignedAttempt) => Promise<WireResponse>) {
  const dispatchId = await database.enqueue(input)
  const attempt = await database.claim(dispatchId)
  let response: WireResponse | null = null
  try { validateConfiguredAttempt(attempt, input, authorityEnvironmentId); response = await transport(attempt) } catch { /* Lost/unsigned outcomes are never treated as domain rejection. */ }
  const verified = await database.complete(attempt.attemptId, response) as { data?: unknown; code?: AdapterErrorCode; targetAuditId?: string; replayed?: boolean; targetResultVersion?: unknown }
  if (verified.code) throw new AdapterError(verified.code)
  return { requestId: input.requestId, correlationId: input.correlationId, data: verified.data, targetAuditId: verified.targetAuditId, replayed: verified.replayed, targetResultVersion: verified.targetResultVersion }
}
