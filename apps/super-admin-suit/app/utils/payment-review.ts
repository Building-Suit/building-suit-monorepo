/** Shop-owned billing projection. Missing frozen values never fall back to today's catalog. */
import type { TransferRequest } from './manual-transfer'
export type ReviewAction = 'mark_under_review' | 'reject' | 'approve'
export const paymentStatuses = ['submitted', 'under_review', 'approved', 'rejected'] as const
export interface Payment {
  id: string; shopId: string; shopName: string; status: typeof paymentStatuses[number]
  requestedPlanName: string; requestedPlanSlug: string; billingInterval: string; currency: string
  listPriceAmount: number; effectivePriceAmount: number; paidAmount: number
  transferDate: string; transferReference: string; priceSource: string
  resourceLimits: Record<string, number | null> | null
  privateOfferId: string | null
  usageBlockers: { resource: string; usage: number; limit: number }[]
  evidence: { id: string; originalFileName: string; mimeType: string; sizeBytes: number; sha256: string }[] | null
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function isUuid(value: unknown): value is string { return typeof value === 'string' && uuidPattern.test(value) }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_projection')
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  if (typeof value !== 'string' || value.length > 4000) throw new Error('invalid_projection')
  return value
}
const resourceKeys = ['active_locations', 'active_members', 'active_products', 'active_services', 'active_customers', 'active_suppliers']
function money(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 9999999999.99 || Math.abs(value * 100 - Math.round(value * 100)) > 0.0001) throw new Error('invalid_amount')
  return value
}
export function parsePaymentQueue(value: unknown) {
  const q = object(value)
  if (!Array.isArray(q.items) || q.items.length > 100 || !Number.isSafeInteger(q.total) || Number(q.total) < q.items.length
    || !Number.isSafeInteger(q.page) || Number(q.page) < 1 || !Number.isSafeInteger(q.pageSize) || Number(q.pageSize) < 1 || Number(q.pageSize) > 100 || q.items.length > Number(q.pageSize)) throw new Error('invalid_projection')
  const items = q.items.map((raw): Payment => {
    const r = object(raw)
    if (typeof r.currency !== 'string' || !/^[A-Z]{3}$/.test(r.currency) || !isUuid(r.id) || !isUuid(r.shopId) || !paymentStatuses.includes(r.status as Payment['status']) || !Array.isArray(r.usageBlockers)) throw new Error('invalid_projection')
    let resourceLimits: Payment['resourceLimits'] = null
    if (r.resourceLimits !== undefined && r.resourceLimits !== null) {
      const limits = object(r.resourceLimits)
      if (Object.keys(limits).some(key => !resourceKeys.includes(key)) || Object.values(limits).some(v => v !== null && (!Number.isSafeInteger(v) || Number(v) < 1))) throw new Error('invalid_projection')
      // Legacy frozen terms remain visible; absent limits are unavailable, never
      // inferred from a newer catalog. Approval stays blocked for incomplete terms.
      if (resourceKeys.every(key => key in limits)) resourceLimits = Object.fromEntries(Object.entries(limits)) as Payment['resourceLimits']
    }
    const evidence = r.evidence === undefined || r.evidence === null ? null : (Array.isArray(r.evidence) && r.evidence.length <= 10 ? r.evidence.map(raw => {
      const e = object(raw)
      if (!isUuid(e.id) || !Number.isSafeInteger(e.sizeBytes) || Number(e.sizeBytes) < 1 || !/^[a-f0-9]{64}$/.test(String(e.sha256))) throw new Error('invalid_projection')
      return { id: e.id, originalFileName: text(e.originalFileName), mimeType: text(e.mimeType), sizeBytes: Number(e.sizeBytes), sha256: text(e.sha256) }
    }) : (() => { throw new Error('invalid_projection') })())
    return { id: r.id, shopId: r.shopId, shopName: text(r.shopName), status: r.status as Payment['status'], requestedPlanName: text(r.requestedPlanName), requestedPlanSlug: text(r.requestedPlanSlug),
      billingInterval: text(r.billingInterval), currency: text(r.currency), listPriceAmount: money(r.listPriceAmount), effectivePriceAmount: money(r.effectivePriceAmount), paidAmount: money(r.paidAmount),
      transferDate: text(r.transferDate), transferReference: text(r.transferReference), priceSource: text(r.priceSource), resourceLimits, evidence,
      privateOfferId: r.privateOfferId === undefined || r.privateOfferId === null ? null : isUuid(r.privateOfferId) ? r.privateOfferId : (() => { throw new Error('invalid_projection') })(),
      usageBlockers: r.usageBlockers.map(raw => { const b = object(raw); return { resource: text(b.resource), usage: money(b.used), limit: money(b.limit) } }) }
  })
  if (new Set(items.map(r => r.id)).size !== items.length) throw new Error('invalid_projection')
  return { items, total: Number(q.total), page: Number(q.page), pageSize: Number(q.pageSize) }
}
export function approvalBlocked(payment: Payment) {
  return !payment.resourceLimits || resourceKeys.some(key => !(key in payment.resourceLimits!)) || !['monthly', 'quarterly', 'annual'].includes(payment.billingInterval) || payment.usageBlockers.length > 0
}
export interface ReviewDraft { action: ReviewAction; reason: string; receivedAmount: string; receivedReference: string; receivedDate: string; amountOverrideReason: string; externallyVerified: boolean }
export function emptyReview(): ReviewDraft { return { action: 'mark_under_review', reason: '', receivedAmount: '', receivedReference: '', receivedDate: '', amountOverrideReason: '', externallyVerified: false } }
export function paymentCommand(bindingId: string, payment: Payment, draft: ReviewDraft, uuid: () => string, today = new Date().toISOString().slice(0, 10)): TransferRequest {
  if (!isUuid(bindingId) || !isUuid(payment.id) || !['mark_under_review', 'reject', 'approve'].includes(draft.action) || draft.reason.trim().length < 8 || draft.reason.length > 1000
    || !['submitted', 'under_review'].includes(payment.status) || (draft.action === 'mark_under_review' && payment.status !== 'submitted')) throw new Error('invalid_request')
  const payload: Record<string, unknown> = {}
  if (draft.action === 'approve') {
    if (approvalBlocked(payment) || !draft.externallyVerified || !/^\d{1,10}(\.\d{1,2})?$/.test(draft.receivedAmount)) throw new Error('approval_blocked')
    const received = money(Number(draft.receivedAmount))
    const date = Date.parse(draft.receivedDate + 'T00:00:00Z')
    const now = Date.parse(today + 'T00:00:00Z')
    if (received <= 0 || draft.receivedReference.trim().length < 2 || draft.receivedReference.length > 200
      || !/^\d{4}-\d{2}-\d{2}$/.test(draft.receivedDate) || !Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== draft.receivedDate || date > now || date < now - 365 * 86400000) throw new Error('invalid_request')
    if ((received !== payment.effectivePriceAmount || payment.paidAmount !== payment.effectivePriceAmount) && draft.amountOverrideReason.trim().length < 8) throw new Error('amount_override_required')
    if (draft.amountOverrideReason.length > 1000) throw new Error('invalid_request')
    Object.assign(payload, { receivedAmount: received, receivedReference: draft.receivedReference.trim(), receivedDate: draft.receivedDate,
      ...(draft.amountOverrideReason.trim() ? { amountOverrideReason: draft.amountOverrideReason.trim() } : {}) })
  }
  return { bindingId, operation: 'shop.billing.command', requestId: uuid(), correlationId: uuid(), reason: draft.reason.trim(), payload: { action: draft.action, submissionId: payment.id, payload } }
}
export interface PaymentReceipt { requestId: string; correlationId: string; targetAuditId: string; targetResultVersion: number; replayed: boolean; submissionId: string; status: string; subscriptionId: string | null; periodEnd: string | null; commercialPeriodId: string | null }
export function confirmPaymentResult(request: TransferRequest, value: unknown): PaymentReceipt {
  const r = object(value), d = object(r.data)
  const status = request.payload.action === 'approve' ? 'approved' : request.payload.action === 'reject' ? 'rejected' : 'under_review'
  if (r.requestId !== request.requestId || r.correlationId !== request.correlationId || !isUuid(r.targetAuditId) || r.targetResultVersion !== 1 || typeof r.replayed !== 'boolean' || d.id !== request.payload.submissionId || d.status !== status) throw new Error('outcome_unknown')
  const s = d.subscription ? object(d.subscription) : null
  if (status === 'approved' && (!s || !isUuid(s.id) || s.status !== 'active' || typeof s.periodEnd !== 'string' || !Number.isFinite(Date.parse(s.periodEnd)) || s.periodEnd !== d.approved_subscription_end)) throw new Error('outcome_unknown')
  return { requestId: request.requestId, correlationId: request.correlationId, targetAuditId: r.targetAuditId, targetResultVersion: 1, replayed: r.replayed,
    submissionId: String(d.id), status, subscriptionId: s && isUuid(s.id) ? s.id : null, periodEnd: s && typeof s.periodEnd === 'string' ? s.periodEnd : null,
    commercialPeriodId: isUuid(d.commercialPeriodId) ? d.commercialPeriodId : null }
}
export function evidenceAccessRequest(bindingId: string, submissionId: string, evidenceId: string, uuid: () => string): TransferRequest {
  if (![bindingId, submissionId, evidenceId].every(isUuid)) throw new Error('invalid_request')
  return { bindingId, operation: 'shop.billing.query', requestId: uuid(), correlationId: uuid(), reason: null, payload: { resource: 'evidence', submissionId, evidenceId, expiresIn: 60 } }
}
export function parseEvidenceAccess(value: unknown, submissionId: string, evidenceId: string) {
  const e = object(value)
  const url = new URL(text(e.signedUrl)), expiry = Date.parse(text(e.expiresAt))
  if (e.submissionId !== submissionId || e.evidenceId !== evidenceId || url.protocol !== 'https:' || url.username || url.password
    || !url.pathname.startsWith('/storage/v1/object/sign/shop-payment-evidence/') || !url.searchParams.get('token') || !Number.isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + 300000) throw new Error('invalid_evidence')
  return { signedUrl: url.href, expiresAt: expiry }
}
