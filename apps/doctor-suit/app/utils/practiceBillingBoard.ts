import { doctorUuid } from './locationContext.ts'
import { doctorEntitlement, type DoctorEntitlement } from './entitlement.ts'
import { doctorEditionMode } from './administrativeEdition.ts'
import { servicePrice, visitCharge, type PracticeBillingScope, type ServicePriceVersion, type VisitChargeVersion } from './practiceBilling.ts'
export interface BillingPages { prices: number; charges: number; visits: number }
export interface BillingVisit { id: string; patientId: string; patientName: string; startsAt: string; state: string; version: number }
export interface BillingChargeSource { sourceMatches: boolean; charge: VisitChargeVersion; price: ServicePriceVersion; visit: BillingVisit }
export interface PracticeBillingBoard { prices: ServicePriceVersion[]; charges: BillingChargeSource[]; visits: BillingVisit[]; pages: BillingPages; totals: BillingPages; canWrite: boolean; locationArchived: boolean; entitlement: DoctorEntitlement }
export interface ChargeHistory { chargeId: string; beforeRevision: number | null; nextBeforeRevision: number | null; total: number; items: { charge: VisitChargeVersion; price: ServicePriceVersion }[] }
const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
const number = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min
function invalid(): never { throw Error('DOCTOR_BILLING_DIRECTORY_INVALID') }
function common(v: unknown, scope: PracticeBillingScope): Record<string, unknown> {
 if (!record(v) || v.actor_user_id !== scope.userId || v.practice_id !== scope.practiceId || v.location_id !== scope.locationId || v.data_mode !== 'synthetic' || v.tax_applicability !== 'unreviewed' || v.live_collection !== false) invalid()
 return v
}
function visit(v: unknown): BillingVisit {
 if (!record(v) || !doctorUuid(v.id) || !doctorUuid(v.patient_id) || typeof v.patient_name !== 'string' || v.patient_name.length > 200 || typeof v.starts_at !== 'string' || !Number.isFinite(Date.parse(v.starts_at))
  || !number(v.version, 1) || typeof v.state !== 'string' || !['booked', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'].includes(v.state)) invalid()
 return { id: v.id as string, patientId: v.patient_id as string, patientName: v.patient_name, startsAt: new Date(v.starts_at).toISOString(), state: v.state, version: v.version as number }
}
function page(rows: unknown, total: unknown, value: unknown, expected: number): unknown[] {
 if (!Array.isArray(rows) || !number(total) || value !== expected || !number(expected, 1) || expected > 1000000 || rows.length !== Math.min(25, Math.max(total - (expected - 1) * 25, 0))) invalid()
 return rows
}
export function practiceBillingBoard(value: unknown, scope: PracticeBillingScope, expected: BillingPages): PracticeBillingBoard {
 const v = common(value, scope)
 if (!doctorEditionMode(v.edition) || typeof v.location_archived !== 'boolean' || typeof v.can_write !== 'boolean') invalid()
 const entitlement = doctorEntitlement(v.entitlement, v.edition)
 if (!entitlement || v.can_write !== (!v.location_archived && entitlement.writesAllowed)) invalid()
 const prices = page(v.prices, v.price_total, v.price_page, expected.prices).map(p => servicePrice(p, scope))
 const charges = page(v.charges, v.charge_total, v.charge_page, expected.charges).map(p => {
  if (!record(p) || typeof p.source_matches !== 'boolean') invalid()
  const price = servicePrice(p.price, scope), source = visit(p.visit)
  return { sourceMatches: p.source_matches, price, visit: source, charge: visitCharge(p.charge, scope, { price, visitId: source.id, patientId: source.patientId }) }
 })
 const visits = page(v.visits, v.visit_total, v.visit_page, expected.visits).map(visit)
 if (new Set(prices.map(p => p.serviceId)).size !== prices.length || new Set(charges.map(c => c.charge.chargeId)).size !== charges.length || new Set(visits.map(v => v.id)).size !== visits.length) invalid()
 return { prices, charges, visits, pages: { ...expected }, totals: { prices: v.price_total as number, charges: v.charge_total as number, visits: v.visit_total as number }, canWrite: v.can_write, locationArchived: v.location_archived, entitlement }
}
export function chargeHistory(value: unknown, scope: PracticeBillingScope, selected: VisitChargeVersion, before: number | null): ChargeHistory {
 const v = common(value, scope)
 if (v.charge_id !== selected.chargeId || v.before_revision !== before || !number(v.total, 1) || !Array.isArray(v.items) || v.items.length > 20 || !(v.next_before_revision === null || number(v.next_before_revision, 2))) invalid()
 const items = v.items.map(p => { if (!record(p)) invalid(); const price = servicePrice(p.price, scope); const charge = visitCharge(p.charge, scope, { price, visitId: selected.visitId, patientId: selected.patientId }); if (charge.chargeId !== selected.chargeId) invalid(); return { charge, price } })
 const first = before === null ? v.total : Math.min(before - 1, v.total)
 if (items.length !== Math.min(20, first) || items.some((x, i) => x.charge.revision !== first - i)) invalid()
 const last = items.at(-1)?.charge.revision ?? 0
 if (v.next_before_revision !== (last > 1 ? last : null)) invalid()
 return { chargeId: selected.chargeId, beforeRevision: before, nextBeforeRevision: v.next_before_revision as number | null, total: v.total, items }
}
