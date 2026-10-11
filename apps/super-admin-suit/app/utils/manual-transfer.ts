/** Versioned manual-transfer presentation contract; no payment values or defaults. */
export interface TransferConfiguration {
  version: number
  enabled: boolean | null
  recipientAlias: string
  recipientDetails: string
  instructions: { en: string; ar: string }
  paymentLink: string
  qr: { assetUrl: string; alt: { en: string; ar: string } }
}
export function emptyTransfer(): TransferConfiguration {
  return { version: 0, enabled: null, recipientAlias: '', recipientDetails: '', instructions: { en: '', ar: '' }, paymentLink: '', qr: { assetUrl: '', alt: { en: '', ar: '' } } }
}
export function safeTransferUrl(value: string) {
  if (!value) return true
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password } catch { return false }
}
export function parseTransfer(value: unknown): TransferConfiguration | null {
  if (value === null) return null
  const c = value as TransferConfiguration
  if (!c || !Number.isSafeInteger(c.version) || c.version < 1 || typeof c.enabled !== 'boolean'
    || ![c.recipientAlias, c.recipientDetails, c.instructions?.en, c.instructions?.ar, c.paymentLink, c.qr?.assetUrl, c.qr?.alt?.en, c.qr?.alt?.ar].every(v => typeof v === 'string' && v.length <= 4000)
    || !safeTransferUrl(c.paymentLink) || !safeTransferUrl(c.qr.assetUrl)) throw new Error('configuration_unavailable')
  // Explicit projection drops any unknown/privileged fields.
  return { version: c.version, enabled: c.enabled, recipientAlias: c.recipientAlias, recipientDetails: c.recipientDetails,
    instructions: { en: c.instructions.en, ar: c.instructions.ar }, paymentLink: c.paymentLink,
    qr: { assetUrl: c.qr.assetUrl, alt: { en: c.qr.alt.en, ar: c.qr.alt.ar } } }
}
export function transferState(c: TransferConfiguration | null) {
  if (!c || c.enabled === null) return 'empty'
  if (!c.enabled) return 'disabled'
  if (![c.recipientAlias, c.recipientDetails, c.instructions.en, c.instructions.ar].every(v => v.trim())
    || !safeTransferUrl(c.paymentLink) || !safeTransferUrl(c.qr.assetUrl)
    || (c.qr.assetUrl && (!c.qr.alt.en.trim() || !c.qr.alt.ar.trim()))) return 'incomplete'
  return 'configured'
}
export interface TransferRequest {
  bindingId: string; operation: 'shop.billing.query' | 'shop.billing.command'; requestId: string; correlationId: string; reason: string | null; payload: Record<string, unknown>
}
/** An ambiguous retry retains identical IDs, reason, version and payload. */
export function transferCommand(bindingId: string, configuration: TransferConfiguration, reason: string, uuid: () => string): TransferRequest {
  if (typeof configuration.enabled !== 'boolean' || reason.trim().length < 8 || reason.length > 1000
    || !safeTransferUrl(configuration.paymentLink) || !safeTransferUrl(configuration.qr.assetUrl)
    || (configuration.enabled && transferState(configuration) !== 'configured')) throw new Error('invalid_request')
  return { bindingId, operation: 'shop.billing.command', requestId: uuid(), correlationId: uuid(), reason: reason.trim(),
    payload: { action: 'configure-manual-transfer', expectedVersion: configuration.version, configuration: JSON.parse(JSON.stringify(configuration)) } }
}

export async function confirmTransferCommand(request: TransferRequest, send: (request: TransferRequest) => Promise<{ data: { configuration: unknown }; targetAuditId?: string }>) {
  const result = await send(request)
  if (!result.targetAuditId) throw new Error('outcome_unknown')
  const configuration = parseTransfer(result.data.configuration)
  if (!configuration || configuration.version <= Number(request.payload.expectedVersion)) throw new Error('outcome_unknown')
  return configuration
}
