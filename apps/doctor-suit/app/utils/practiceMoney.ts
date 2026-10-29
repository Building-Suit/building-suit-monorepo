import { doctorUuid } from './locationContext.ts'
import { doctorEditionMode } from './administrativeEdition.ts'
import { doctorEntitlement, type DoctorEntitlement } from './entitlement.ts'
import type { PracticeBillingScope } from './practiceBilling.ts'
export interface PracticeMoneyScope extends PracticeBillingScope { chargeId: string; patientId: string }
export type PaymentState = 'pending' | 'unknown' | 'failed' | 'posted'
export interface PracticeLedgerEntry { id: string; intentId: string; originalEntryId: string | null; receiptNumber: string; receiptLabel: string; amountMinor: string; currency: string; exponent: number; kind: 'collection' | 'refund'; refundableMinor: string | null; createdAt: string }
export interface PracticePaymentIntent { originalReceipt: string | null; id: string; chargeVersionId: string; kind: 'collection' | 'refund'; originalEntryId: string | null; amountMinor: string; currency: string; exponent: number; reason: string; createdAt: string; revision: number; state: PaymentState; reasonCode: string; stateAt: string; entry: PracticeLedgerEntry | null }
export interface PracticeMoneyBalance { collectedMinor: string; refundedMinor: string; netMinor: string; reservedCollectionMinor: string; reservedRefundMinor: string }
export interface PracticeMoneyState { chargeLabel: string; patientName: string; chargeRecordedAt: string; clinicName: string; timezone: string; chargeVersionId: string; chargeMinor: string; currency: string; exponent: number; balance: PracticeMoneyBalance; availableMinor: string; items: PracticePaymentIntent[]; page: number; total: number; canWrite: boolean; locationArchived: boolean; entitlement: DoctorEntitlement }
const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
function invalid(): never { throw Error('DOCTOR_PRACTICE_MONEY_INVALID') }
const integer = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min
export function practiceMoneyMinor(v: unknown, individual = true): string {
 if (typeof v !== 'string' || !/^(0|[1-9][0-9]{0,39})$/.test(v) || (individual && BigInt(v) > 9007199254740991n)) invalid()
 return v
}
/** Display full-population gross/refund totals without narrowing them to one movement's bound. */
export function formatPracticeMoneyMinor(value: unknown, exponent: unknown): string {
 const minor = BigInt(practiceMoneyMinor(value, false))
 if (!integer(exponent) || exponent > 4) invalid()
 const factor = 10n ** BigInt(exponent)
 return `${minor / factor}${exponent ? '.' + String(minor % factor).padStart(exponent, '0') : ''}`
}
function positive(v: unknown): string { const n = practiceMoneyMinor(v); if (n === '0') invalid(); return n }
function instant(v: unknown): string { if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(v) || !Number.isFinite(Date.parse(v))) invalid(); return new Date(v).toISOString() }
function flags(v: Record<string, unknown>) { if (v.data_mode !== 'synthetic' || v.external_transport_enabled !== false || v.live_collection !== false || v.tax_invoice_available !== false || v.tax_applicability !== 'unreviewed') invalid() }
function currency(v: Record<string, unknown>) { if (typeof v.currency !== 'string' || !/^[A-Z]{3}$/.test(v.currency) || !integer(v.currency_exponent) || v.currency_exponent > 4) invalid() }
function scopeValid(scope: PracticeMoneyScope) { if (![scope.userId, scope.practiceId, scope.locationId, scope.chargeId, scope.patientId].every(doctorUuid)) invalid() }
function ownership(v: Record<string, unknown>, scope: PracticeMoneyScope) { if (v.practice_id !== scope.practiceId || v.location_id !== scope.locationId || v.patient_id !== scope.patientId || v.actor_user_id !== scope.userId) invalid() }
export function practicePaymentIntent(value: unknown, scope: PracticeMoneyScope): PracticePaymentIntent {
 scopeValid(scope); if (!record(value)) invalid(); const v = value
 flags(v); currency(v); ownership(v, scope)
 if (v.doctor_user_id !== scope.userId || v.charge_id !== scope.chargeId || !doctorUuid(v.id) || !doctorUuid(v.charge_version_id) || !['collection', 'refund'].includes(String(v.kind)) || !(v.original_entry_id === null || doctorUuid(v.original_entry_id))
  || (v.kind === 'collection') !== (v.original_entry_id === null) || !integer(v.revision, 1) || typeof v.reason !== 'string' || v.reason !== v.reason.trim() || v.reason.length < 2 || v.reason.length > 500 || [...v.reason].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 || c === '<' || c === '>')) invalid()
 const reasons: Record<PaymentState, string[]> = { pending: ['prepared'], unknown: ['attempt_reconciliation_required'], failed: ['synthetic_rejected', 'cancelled_before_attempt'], posted: ['synthetic_accepted'] }
 if (!Object.hasOwn(reasons, String(v.state)) || !reasons[v.state as PaymentState].includes(String(v.reason_code)) || (v.state === 'pending' ? v.revision !== 1 : v.state === 'unknown' ? v.revision !== 2 : v.reason_code === 'cancelled_before_attempt' ? v.revision !== 2 : v.revision !== 3)) invalid()
 if (v.kind === 'collection' ? v.original_receipt_label !== null : typeof v.original_receipt_label !== 'string' || !/^SYN-[0-9]{8,16}$/.test(v.original_receipt_label)) invalid()
 const amount = positive(v.amount_minor)
 let entry: PracticeLedgerEntry | null = null
 if (v.state === 'posted') {
  if (!record(v.entry)) invalid(); const e = v.entry; ownership(e, scope)
  if (!doctorUuid(e.id) || e.intent_id !== v.id || e.kind !== v.kind || e.original_entry_id !== v.original_entry_id || e.amount_minor !== amount || e.currency !== v.currency || e.currency_exponent !== v.currency_exponent) invalid()
  const receipt = positive(e.receipt_number)
  if (e.receipt_label !== 'SYN-' + receipt.padStart(8, '0')) invalid()
  const refundable = v.kind === 'collection' ? practiceMoneyMinor(e.refundable_minor) : null
  if (v.kind === 'collection' ? BigInt(refundable!) > BigInt(amount) : e.refundable_minor !== null) invalid()
  entry = { id: e.id as string, intentId: v.id as string, originalEntryId: v.original_entry_id as string | null, kind: v.kind as 'collection' | 'refund', receiptNumber: receipt, receiptLabel: e.receipt_label as string, amountMinor: amount, currency: v.currency as string, exponent: v.currency_exponent as number, refundableMinor: refundable, createdAt: instant(e.created_at) }
 } else if (v.entry !== null) invalid()
 return { originalReceipt: v.original_receipt_label as string | null, id: v.id as string, chargeVersionId: v.charge_version_id as string, kind: v.kind as 'collection' | 'refund', originalEntryId: v.original_entry_id as string | null, amountMinor: amount, currency: v.currency as string, exponent: v.currency_exponent as number, reason: v.reason, createdAt: instant(v.created_at), revision: v.revision, state: v.state as PaymentState, reasonCode: v.reason_code as string, stateAt: instant(v.state_at), entry }
}
export function practiceMoneyState(value: unknown, scope: PracticeMoneyScope, page: number): PracticeMoneyState {
 scopeValid(scope); if (!record(value)) invalid(); const v = value
 flags(v); currency(v)
 if (v.actor_user_id !== scope.userId || v.practice_id !== scope.practiceId || v.location_id !== scope.locationId || v.patient_id !== scope.patientId || v.charge_id !== scope.chargeId || !doctorUuid(v.charge_version_id) || v.page !== page || !integer(page, 1) || page > 1000000 || !integer(v.total) || !Array.isArray(v.items) || v.items.length !== Math.min(20, Math.max(v.total - (page - 1) * 20, 0)) || !record(v.balance) || typeof v.can_write !== 'boolean' || typeof v.location_archived !== 'boolean' || !doctorEditionMode(v.edition)) invalid()
 if (['charge_label', 'patient_name', 'clinic_name'].some(k => typeof v[k] !== 'string' || String(v[k]).length < 1 || String(v[k]).length > 200) || typeof v.timezone !== 'string') invalid()
 try { new Intl.DateTimeFormat('en', { timeZone: v.timezone }) } catch { invalid() }
 const entitlement = doctorEntitlement(v.entitlement, v.edition)
 if (!entitlement || v.can_write !== (!v.location_archived && entitlement.writesAllowed)) invalid()
 const b = v.balance, balance = { collectedMinor: practiceMoneyMinor(b.collected_minor, false), refundedMinor: practiceMoneyMinor(b.refunded_minor, false), netMinor: practiceMoneyMinor(b.net_minor, false), reservedCollectionMinor: practiceMoneyMinor(b.reserved_collection_minor, false), reservedRefundMinor: practiceMoneyMinor(b.reserved_refund_minor, false) }
 if (BigInt(balance.collectedMinor) - BigInt(balance.refundedMinor) !== BigInt(balance.netMinor) || BigInt(balance.reservedRefundMinor) > BigInt(balance.netMinor)) invalid()
 const amount = practiceMoneyMinor(v.charge_minor), available = BigInt(amount) - BigInt(balance.netMinor) - BigInt(balance.reservedCollectionMinor)
 if (available < 0n) invalid()
 const items = v.items.map(item => practicePaymentIntent(item, scope))
 if (new Set(items.map(i => i.id)).size !== items.length || items.some(i => i.currency !== v.currency || i.exponent !== v.currency_exponent)) invalid()
 return { chargeLabel: v.charge_label as string, patientName: v.patient_name as string, chargeRecordedAt: instant(v.charge_recorded_at), clinicName: v.clinic_name as string, timezone: v.timezone as string, chargeVersionId: v.charge_version_id as string, chargeMinor: amount, currency: v.currency as string, exponent: v.currency_exponent as number, balance, availableMinor: String(available), items, page, total: v.total, canWrite: v.can_write, locationArchived: v.location_archived, entitlement }
}
