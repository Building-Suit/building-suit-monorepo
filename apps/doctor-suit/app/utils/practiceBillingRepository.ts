import { doctorLocationDirectory } from './locations.ts'
import { servicePrice, visitCharge, requireChargeCorrection, type PracticeBillingScope, type ServicePriceVersion, type VisitChargeVersion } from './practiceBilling.ts'
import { practiceBillingBoard, chargeHistory, type BillingPages } from './practiceBillingBoard.ts'
/** Feature-owned RPC boundary until CI-generated schema files can be acquired; generated files are never handwritten. */
export interface PracticeBillingClient { rpc(name: 'doctor_locations' | 'doctor_practice_billing_board' | 'doctor_visit_charge_history' | 'doctor_write_service_price' | 'doctor_write_visit_charge', args: Record<string, unknown>): { abortSignal(signal: AbortSignal): PromiseLike<{ data: unknown; error: unknown }> } }
export interface PriceWrite { serviceId: string | null; revision: number; label: string; unitMinor: string; currency: string; exponent: number }
export interface ChargeWrite { visitId: string; visitVersion: number; patientId: string; price: ServicePriceVersion; quantity: number; chargeId: string | null; revision: number; reason: string; previous: VisitChargeVersion | null }
export function practiceBillingRepository(client: PracticeBillingClient) {
 async function rpc(name: Parameters<PracticeBillingClient['rpc']>[0], args: Record<string, unknown>, signal: AbortSignal) { const { data, error } = await client.rpc(name, args).abortSignal(signal); if (error) throw error; return data }
 return {
  async locations(practiceId: string, page: number, signal: AbortSignal) {
   if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) throw Error('DOCTOR_BILLING_QUERY_INVALID')
   // The billing view is one-based; the established directory RPC is zero-based.
   const result = doctorLocationDirectory(await rpc('doctor_locations', { p_practice: practiceId, p_page: page - 1, p_size: 25, p_search: '' }, signal), practiceId)
   if (result.rows.length !== Math.min(25, Math.max(result.total - (page - 1) * 25, 0))) throw Error('DOCTOR_BILLING_QUERY_INVALID')
   return result
  },
  async board(scope: PracticeBillingScope, pages: BillingPages, signal: AbortSignal) { const owner = Object.freeze({ ...scope }), selected = Object.freeze({ ...pages }); const data = await rpc('doctor_practice_billing_board', { p_practice: owner.practiceId, p_location: owner.locationId, p_price_page: selected.prices, p_charge_page: selected.charges, p_visit_page: selected.visits }, signal); return practiceBillingBoard(data, owner, selected) },
  async history(scope: PracticeBillingScope, selected: VisitChargeVersion, before: number | null, signal: AbortSignal) { const owner = Object.freeze({ ...scope }), charge = Object.freeze({ ...selected }); const data = await rpc('doctor_visit_charge_history', { p_practice: owner.practiceId, p_location: owner.locationId, p_charge: charge.chargeId, p_before_revision: before }, signal); return chargeHistory(data, owner, charge, before) },
  async price(scope: PracticeBillingScope, input: PriceWrite, key: string, signal: AbortSignal) {
   const owner = Object.freeze({ ...scope }), expected = Object.freeze({ ...input })
   const data = await rpc('doctor_write_service_price', { p_practice: owner.practiceId, p_location: owner.locationId, p_service: expected.serviceId, p_revision: expected.revision, p_label: expected.label, p_minor: expected.unitMinor, p_currency: expected.currency, p_exponent: expected.exponent, p_key: key }, signal), result = servicePrice(data, owner)
   if ((expected.serviceId !== null && result.serviceId !== expected.serviceId) || result.revision !== expected.revision + 1 || result.label !== expected.label.trim() || result.unitMinor !== expected.unitMinor || result.currency !== expected.currency || result.exponent !== expected.exponent) throw Error('DOCTOR_PRACTICE_BILLING_INVALID')
   return result
  },
  async charge(scope: PracticeBillingScope, input: ChargeWrite, key: string, signal: AbortSignal) {
   const owner = Object.freeze({ ...scope }), expected = Object.freeze({ ...input, price: Object.freeze({ ...input.price }), previous: input.previous ? Object.freeze({ ...input.previous }) : null })
   if ((expected.previous === null) !== (expected.chargeId === null) || (expected.previous && (expected.previous.chargeId !== expected.chargeId || expected.previous.revision !== expected.revision))) throw Error('DOCTOR_PRACTICE_BILLING_INVALID')
   const data = await rpc('doctor_write_visit_charge', { p_practice: owner.practiceId, p_location: owner.locationId, p_visit: expected.visitId, p_visit_version: expected.visitVersion, p_patient: expected.patientId, p_price: expected.price.id, p_quantity: expected.quantity, p_charge: expected.chargeId, p_revision: expected.revision, p_reason: expected.reason, p_key: key }, signal), result = visitCharge(data, owner, { price: expected.price, visitId: expected.visitId, patientId: expected.patientId })
   if (result.revision !== expected.revision + 1 || result.visitVersion !== expected.visitVersion || result.quantity !== expected.quantity || result.reason !== expected.reason.trim() || (expected.chargeId !== null && result.chargeId !== expected.chargeId)) throw Error('DOCTOR_PRACTICE_BILLING_INVALID')
   if (expected.previous) requireChargeCorrection(expected.previous, result)
   return result
  },
 }
}
export type PracticeBillingRepository = ReturnType<typeof practiceBillingRepository>
