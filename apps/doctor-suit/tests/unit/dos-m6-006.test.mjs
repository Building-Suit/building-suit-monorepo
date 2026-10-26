import test from 'node:test'
import assert from 'node:assert/strict'
import { practiceChargeMinor, formatPracticeMinor, servicePrice, visitCharge, requireChargeCorrection } from '../../app/utils/practiceBilling.ts'
const id = n => `d2060006-0000-4000-8000-${String(n).padStart(12,'0')}`
const scope = { userId: id(1), practiceId: id(21), locationId: id(31) }
const price = () => ({ id: id(51), service_id: id(50), revision: 1, practice_id: scope.practiceId, location_id: scope.locationId, doctor_user_id: scope.userId, actor_user_id: scope.userId, label: 'Synthetic entered visit fee', unit_minor: '29900', currency: 'EGP', currency_exponent: 2, effective_at: '2026-10-26T10:00:00Z', kind: 'service_price', data_mode: 'synthetic', tax_applicability: 'unreviewed', tax_minor: null, discount_available: false, live_collection: false })
const charge = () => ({ ...price(), id: id(61), charge_id: id(60), previous_id: null, visit_id: id(41), patient_id: id(42), price_id: id(51), quantity: 2, amount_minor: '59800', reason: 'Synthetic explicit charge', created_at: '2026-10-26T10:00:01Z', kind: 'visit_charge', tax_invoice_available: false })
const selected = () => ({ price: servicePrice(price(), scope), visitId: id(41), patientId: id(42) })
test('exact entered price times integer quantity uses decimal strings without rounding or floating-point loss', () => {
 assert.equal(practiceChargeMinor('29900', 2), '59800'); assert.equal(practiceChargeMinor('9007199254740991', 1), '9007199254740991'); assert.equal(practiceChargeMinor('0', 1000), '0')
 assert.equal(formatPracticeMinor('29900', 2), '299.00'); assert.equal(formatPracticeMinor('1', 4), '0.0001'); assert.equal(formatPracticeMinor('9007199254740991', 4), '900719925474.0991')
 for (const unit of ['01', '-1', '1.5', '1e2', ' 1', 1, '9007199254740992']) assert.throws(() => practiceChargeMinor(unit, 1), /BILLING_INVALID/)
 for (const quantity of [0, -1, 1.5, 1001, '2']) assert.throws(() => practiceChargeMinor('1', quantity), /BILLING_INVALID/)
 assert.throws(() => practiceChargeMinor('9007199254740991', 2), /BILLING_INVALID/)
})
test('later service prices do not rewrite a decoded historical charge or its original price reference', () => {
 const original = selected(), issued = visitCharge(charge(), scope, original), saved = structuredClone(issued)
 const newer = servicePrice({ ...price(), id: id(52), revision: 2, unit_minor: '40000', label: 'Synthetic new fee' }, scope)
 assert.equal(newer.unitMinor, '40000'); assert.deepEqual(issued, saved); assert.equal(issued.priceId, id(51)); assert.equal(issued.amountMinor, '59800')
 assert.throws(() => visitCharge(charge(), scope, { ...original, price: newer }), /BILLING_INVALID/)
})
test('price and charge projections reject cross-practice/location/doctor authority and forged tax/live claims', () => {
 for (const patch of [{ practice_id: id(22) }, { location_id: id(32) }, { doctor_user_id: id(2) }, { actor_user_id: id(2) }, { tax_applicability: 'exempt' }, { tax_minor: '0' }, { live_collection: true }, { discount_available: true }]) assert.throws(() => servicePrice({ ...price(), ...patch }, scope), /BILLING_INVALID/)
 for (const patch of [{ visit_id: id(43) }, { patient_id: id(44) }, { price_id: id(52) }, { unit_minor: '1' }, { amount_minor: '1' }, { currency: 'USD' }, { currency_exponent: 0 }, { tax_invoice_available: true }]) assert.throws(() => visitCharge({ ...charge(), ...patch }, scope, selected()), /BILLING_INVALID/)
})
test('correction appends an attributable new revision and preserves original visit/patient/service/currency', () => {
 const previous = visitCharge(charge(), scope, selected()), nextPrice = servicePrice({ ...price(), id: id(52), revision: 2, unit_minor: '40000' }, scope)
 const next = visitCharge({ ...charge(), id: id(62), revision: 2, previous_id: previous.id, price_id: nextPrice.id, unit_minor: nextPrice.unitMinor, amount_minor: '80000', reason: 'Synthetic reasoned correction' }, scope, { ...selected(), price: nextPrice })
 requireChargeCorrection(previous, next); assert.equal(previous.amountMinor, '59800'); assert.equal(next.amountMinor, '80000')
 for (const patch of [{ previousId: null }, { revision: 1 }, { revision: 3 }, { chargeId: id(63) }, { visitId: id(43) }, { patientId: id(44) }, { currency: 'USD' }, { exponent: 0 }]) assert.throws(() => requireChargeCorrection(previous, { ...next, ...patch }), /BILLING_INVALID/)
})
test('malformed identifiers, clocks, policy claims and unentered reason fail closed without projecting private fields', () => {
 for (const patch of [{ id: 'invalid' }, { effective_at: 'tomorrow' }, { currency_exponent: 1.5 }, { label: '<script>' }, { label: ' ' }, { currency: 'egp' }]) assert.throws(() => servicePrice({ ...price(), ...patch }, scope), /BILLING_INVALID/)
 for (const patch of [{ reason: '' }, { created_at: '2026-10-26' }, { previous_id: id(62) }]) assert.throws(() => visitCharge({ ...charge(), ...patch }, scope, selected()), /BILLING_INVALID/)
 const parsed = visitCharge({ ...charge(), secret: 'PRIVATE_SENSITIVE_SENTINEL', provider_body: 'PRIVATE_PROVIDER_BODY' }, scope, selected()); assert(!JSON.stringify(parsed).includes('PRIVATE_'))
})
