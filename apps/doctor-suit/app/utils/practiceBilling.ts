import { doctorUuid } from './locationContext.ts'
export interface PracticeBillingScope { userId: string; practiceId: string; locationId: string }
export interface ServicePriceVersion { id: string; serviceId: string; revision: number; practiceId: string; locationId: string; doctorId: string; actorId: string; label: string; unitMinor: string; currency: string; exponent: number; effectiveAt: string }
export interface VisitChargeVersion { id: string; chargeId: string; revision: number; previousId: string | null; practiceId: string; locationId: string; doctorId: string; actorId: string; visitId: string; visitVersion: number | null; patientId: string; priceId: string; serviceId: string; label: string; unitMinor: string; quantity: number; amountMinor: string; currency: string; exponent: number; reason: string; createdAt: string }
const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
function invalid(): never { throw Error('DOCTOR_PRACTICE_BILLING_INVALID') }
const integer = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max
function minor(v: unknown): string { if (typeof v !== 'string' || !/^(0|[1-9][0-9]{0,15})$/.test(v) || BigInt(v) > 9007199254740991n) invalid(); return v }
function instant(v: unknown): string { if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(v) || !Number.isFinite(Date.parse(v))) invalid(); return new Date(v).toISOString() }
function text(v: unknown, max: number, min = 1): string { if (typeof v !== 'string' || v.trim() !== v || v.length < min || v.length > max || [...v].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 || c === '<' || c === '>')) invalid(); return v }
function source(v: unknown, scope: PracticeBillingScope): Record<string, unknown> {
 if (!doctorUuid(scope.userId) || !doctorUuid(scope.practiceId) || !doctorUuid(scope.locationId) || !record(v) || v.practice_id !== scope.practiceId || v.location_id !== scope.locationId || v.doctor_user_id !== scope.userId || v.actor_user_id !== scope.userId || !doctorUuid(v.id) || !doctorUuid(v.service_id)
  || !integer(v.revision, 1, 2147483647) || typeof v.currency !== 'string' || !/^[A-Z]{3}$/.test(v.currency) || !integer(v.currency_exponent, 0, 4)
  || v.data_mode !== 'synthetic' || v.tax_applicability !== 'unreviewed' || v.tax_minor !== null || v.live_collection !== false) invalid()
 return v
}
/** Integer multiplication only: no implicit tax treatment, discount or fractional rounding. */
export function practiceChargeMinor(unit: unknown, quantity: unknown): string {
 const amount = BigInt(minor(unit)); if (!integer(quantity, 1, 1000)) invalid()
 const total = amount * BigInt(quantity as number); if (total > 9007199254740991n) invalid(); return String(total)
}
export function parsePracticeMinor(value: unknown, exponent: unknown): string {
 if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,15})(?:\.[0-9]{1,4})?$/.test(value) || !integer(exponent, 0, 4)) invalid()
 const [whole, fraction = ''] = value.split('.'), e = exponent as number
 if (fraction.length > e) invalid()
 return minor(String(BigInt(whole!) * 10n ** BigInt(e) + BigInt(fraction.padEnd(e, '0') || '0')))
}
export function formatPracticeMinor(value: unknown, exponent: unknown): string {
 const amount = BigInt(minor(value)); if (!integer(exponent, 0, 4)) invalid()
 const e = exponent as number, factor = 10n ** BigInt(e)
 return `${amount / factor}${e ? '.' + String(amount % factor).padStart(e, '0') : ''}`
}
export function servicePrice(value: unknown, scope: PracticeBillingScope): ServicePriceVersion {
 const v = source(value, scope)
 if (v.kind !== 'service_price' || v.discount_available !== false) invalid()
 return { id: v.id as string, serviceId: v.service_id as string, revision: v.revision as number, practiceId: scope.practiceId, locationId: scope.locationId, doctorId: scope.userId, actorId: scope.userId,
  label: text(v.label, 160), unitMinor: minor(v.unit_minor), currency: v.currency as string, exponent: v.currency_exponent as number, effectiveAt: instant(v.effective_at) }
}
export function visitCharge(value: unknown, scope: PracticeBillingScope, selected: { price: ServicePriceVersion; visitId: string; patientId: string }): VisitChargeVersion {
 const v = source(value, scope), p = selected.price
 if (v.kind !== 'visit_charge' || v.tax_invoice_available !== false || !doctorUuid(v.charge_id) || v.visit_id !== selected.visitId || v.patient_id !== selected.patientId || !doctorUuid(v.visit_id) || !doctorUuid(v.patient_id)
  || v.price_id !== p.id || v.service_id !== p.serviceId || v.label !== p.label || v.unit_minor !== p.unitMinor || v.currency !== p.currency || v.currency_exponent !== p.exponent
  || p.practiceId !== scope.practiceId || p.locationId !== scope.locationId || p.doctorId !== scope.userId || v.amount_minor !== practiceChargeMinor(v.unit_minor, v.quantity)
  || !(v.visit_version === null || integer(v.visit_version, 1, 2147483647))
  || (v.revision === 1 ? v.previous_id !== null : !doctorUuid(v.previous_id))) invalid()
 return { id: v.id as string, chargeId: v.charge_id as string, revision: v.revision as number, previousId: v.previous_id as string | null, practiceId: scope.practiceId, locationId: scope.locationId, doctorId: scope.userId, actorId: scope.userId,
  visitId: selected.visitId, visitVersion: v.visit_version as number | null, patientId: selected.patientId, priceId: p.id, serviceId: p.serviceId, label: p.label, unitMinor: p.unitMinor, quantity: v.quantity as number, amountMinor: v.amount_minor as string, currency: p.currency, exponent: p.exponent, reason: text(v.reason, 500, 2), createdAt: instant(v.created_at) }
}
export function requireChargeCorrection(previous: VisitChargeVersion, next: VisitChargeVersion): void {
 if (next.previousId !== previous.id || next.revision !== previous.revision + 1 || next.chargeId !== previous.chargeId
  || ['practiceId', 'locationId', 'doctorId', 'visitId', 'patientId', 'serviceId', 'currency', 'exponent'].some(key => next[key as keyof VisitChargeVersion] !== previous[key as keyof VisitChargeVersion])) invalid()
}
