import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorEntitlement, createDoctorEntitlementDeadline } from '../../app/utils/entitlement.ts'
import { doctorScopeKey, createDoctorContextLifecycle } from '../../app/utils/contextScope.ts'
import { doctorSaasFailure, doctorSaasTrialReceipt } from '../../app/utils/saasStatus.ts'
const epoch = Date.parse('2026-10-25T10:00:00Z')
const stamp = n => new Date(epoch + n).toISOString()
const active = () => ({ state: 'trial', revision: 1, writes_allowed: true, can_add_staff: false, can_add_clinic: false, over_limit: false, valid_until: stamp(1000), observed_at: stamp(0) })
const expired = () => ({ ...active(), state: 'expired', writes_allowed: false, observed_at: stamp(1000) })
const scope = entitlement => ({ environment: 'local', portal: 'doctor', userId: 'synthetic-owner', sessionId: 'synthetic-session', practiceId: 'synthetic-practice', locationId: 'synthetic-location', grantsVersion: 1, edition: 'administrative_candidate', editionRevision: 2, entitlement })
test('expired/held metadata cannot manufacture writes or allocations; unapproved lifecycle states are rejected without guessed mappings', () => {
 for (const state of ['expired', 'suspended', 'scheduled']) { const raw = { ...expired(), state }; assert.equal(doctorEntitlement(raw, 'administrative_candidate').writesAllowed, false); for (const field of ['writes_allowed', 'can_add_staff', 'can_add_clinic']) assert.throws(() => doctorEntitlement({ ...raw, [field]: true }, 'administrative_candidate')) }
 for (const state of ['past_due', 'cancelled', 'cancellation_requested']) assert.throws(() => doctorEntitlement({ ...active(), state }, 'administrative_candidate'))
 const minimal = doctorEntitlement({ ...expired(), paid: true, plan: 'unlimited', staff_limit: 9999 }, 'administrative_candidate'); assert.equal(minimal.writesAllowed, false); for (const key of ['paid', 'plan', 'staff_limit']) assert.equal(key in minimal, false)
})
test('same-revision server expiry changes scope epoch and invalidates captured work while preserving independent doctor/location keys', async () => {
 const before = scope(doctorEntitlement(active(), 'administrative_candidate')), after = scope(doctorEntitlement(expired(), 'administrative_candidate'))
 const lifecycle = createDoctorContextLifecycle(); let draft; lifecycle.registerClear(() => { draft = '' }); await lifecycle.transition(before); draft = 'synthetic pending draft'; const capture = lifecycle.capture('patients'); await lifecycle.transition(after); assert.equal(draft, ''); assert.equal(capture.accepts(), false); assert.equal(capture.signal.aborted, true); assert.notEqual(doctorScopeKey(before, 'patients'), doctorScopeKey(after, 'patients'))
 for (const patch of [{ practiceId: 'other-doctor-practice' }, { userId: 'other-owner' }, { sessionId: 'new-session' }, { locationId: 'other-location' }, { portal: 'secretary' }]) assert.notEqual(doctorScopeKey(before, 'patients'), doctorScopeKey({ ...before, ...patch }, 'patients'))
})
test('server expiry deadline removes paid/trial read-model authority once and never renews from a local trial receipt', () => {
 for (const state of ['trial', 'paid']) { let at = 0, callback, expiredCount = 0; const clock = { now: () => at, set: fn => { callback = fn; return 1 }, clear() {} }, deadline = createDoctorEntitlementDeadline(clock); deadline.arm(doctorEntitlement({ ...active(), state }, 'administrative_candidate'), 0, () => expiredCount++, () => true); at = 1000; callback(); callback(); assert.equal(expiredCount, 1)
 const receipt = doctorSaasTrialReceipt({ period_id: 'd2060000-0000-4000-8000-000000000061', terms_id: 'd2060000-0000-4000-8000-000000000051', started_at: stamp(0), ends_at: stamp(1000), revision: 1, paid: true, period_active: true }, 'd2060000-0000-4000-8000-000000000051'); assert.equal('paid' in receipt, false); assert.equal('periodActive' in receipt, false) }
})
test('usage flags at capacity preserve ordinary writes but cannot acquire another staff/clinic allocation', () => {
 const view = doctorEntitlement(active(), 'administrative_candidate'); assert.equal(view.writesAllowed, true); assert.equal(view.canAddStaff, false); assert.equal(view.canAddClinic, false)
 for (const patch of [{ can_add_staff: true, over_limit: true }, { can_add_clinic: true, writes_allowed: false }]) assert.throws(() => doctorEntitlement({ ...active(), ...patch }, 'administrative_candidate'))
})
test('explicit server entitlement/quota errors return bounded UI categories without backend financial or identity text', () => {
 for (const [code, value] of Object.entries({ DS002: 'staff-limit', DS003: 'clinic-limit', DS006: 'inactive', DS007: 'over-limit-read-only', '40001': 'conflict', '42501': 'denied' })) { const result = doctorSaasFailure({ code, message: 'private financial and subscriber body', details: 'private actor' }); assert.equal(result, value); assert(!result.includes('private')) }
})
