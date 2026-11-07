import test from 'node:test'
import assert from 'node:assert/strict'
import { lifecycleRequest, lifecycleRequestView } from '../../app/utils/subscriptionLifecycleRequest.ts'
import { doctorSaasStatus } from '../../app/utils/saasStatus.ts'
const id = n => `d2060005-0000-4000-8000-${String(n).padStart(12,'0')}`
const actor = { userId: id(1), sessionId: id(11), practiceId: id(21) }
const raw = () => ({ request_id: id(31), subscriber_user_id: actor.userId, period_id: id(61), terms_id: id(51), account_revision: 1, action: 'cancellation', document_ref: 'synthetic-lifecycle/v1', observed_state: 'paid', original_period_ends_at: '2026-11-25T10:00:00Z', requested_at: '2026-10-25T11:00:00Z', status: 'requested', effective_at: null, provider_confirmation: null, execution_available: false, entitlement_changed: false, charge_created: false, data_mode: 'synthetic', live_activation: false })
function status(state = 'paid', revision = 1, period = id(61)) {
 return doctorSaasStatus({ subscriber_user_id: actor.userId, practice_id: actor.practiceId, state, revision, period_active: state === 'paid', data_mode: 'synthetic', paid_activation_available: false, live_activation: false,
  period: { id: period, kind: 'manual_paid', terms_id: id(51), started_at: '2026-10-25T10:00:00Z', ends_at: raw().original_period_ends_at, accepted_document_ref: raw().document_ref },
  terms: { terms_id: id(51), plan_key: 'synthetic-lifecycle', version: 1, currency: 'EGP', currency_exponent: 2, monthly_minor: 29900, yearly_minor: 243984, trial_days: 0, grace_days: 0, staff: { kind: 'limited', limit: 4 }, clinics: { kind: 'limited', limit: 1 }, over_limit_policy: 'block_new_allocation', renewal_policy: 'manual', expiry_policy: 'historical_read_only', cancellation_policy: 'period_end', refund_policy: 'manual_review', terms_document_ref: raw().document_ref } }, actor)
}
test('a requested cancellation retains current paid period and never invents effective expiry or provider confirmation', () => {
 const before = status(), copy = structuredClone(before), request = lifecycleRequest(raw(), actor), view = lifecycleRequestView(before, [request])
 assert.equal(view.currentState, 'paid'); assert.equal(view.currentPeriodEndsAt, copy.period.endsAt); assert.deepEqual(view.pendingActions, ['cancellation']); assert.equal(view.effectiveCancellation, false); assert.equal(view.providerConfirmation, null); assert.equal(view.chargeCreated, false); assert.equal(view.executionAvailable, false); assert.deepEqual(before, copy)
})
test('forged executed/provider/paid flags and foreign subscribers cannot enter request intake projections', () => {
 for (const patch of [{ subscriber_user_id: id(2) }, { status: 'cancelled' }, { effective_at: '2026-10-25T11:00:00Z' }, { provider_confirmation: 'forged browser redirect' }, { execution_available: true }, { entitlement_changed: true }, { charge_created: true }, { live_activation: true }, { account_revision: 0 }, { observed_state: 'unconfigured' }]) assert.throws(() => lifecycleRequest({ ...raw(), ...patch }, actor), /REQUEST_INVALID/)
})
test('opposite renewal/cancellation order requires review in both orders and never chooses a timestamp winner', () => {
 const cancel = lifecycleRequest(raw(), actor), renew = lifecycleRequest({ ...raw(), request_id: id(32), action: 'renewal', requested_at: '2026-10-25T10:59:59Z' }, actor)
 for (const requests of [[cancel, renew], [renew, cancel]]) { const view = lifecycleRequestView(status(), requests); assert.equal(view.contradictoryRequests, true); assert.equal(view.requiresIndependentReview, true); assert.equal(view.executionAvailable, false); assert.equal(view.effectiveCancellation, false); assert.equal(view.requests.length, 2) }
})
test('historical accepted request never rewinds a newer period or account revision', () => {
 const request = lifecycleRequest(raw(), actor)
 for (const newer of [status('paid', 2), status('paid', 2, id(62))]) { const view = lifecycleRequestView(newer, [request]); assert.deepEqual(view.pendingActions, []); assert.deepEqual(view.historicalRequestIds, [request.id]); assert.equal(view.currentPeriodId, newer.period.id); assert.equal(view.currentState, 'paid'); assert.equal(view.executionAvailable, false) }
})
test('expiry and suspension come from trusted status without interpreting a request as an execution or deleting history', () => {
 const request = lifecycleRequest(raw(), actor)
 for (const state of ['expired', 'suspended']) { const view = lifecycleRequestView(status(state), [request]); assert.equal(view.currentState, state); assert.equal(view.requests.length, 1); assert.equal(view.currentPeriodId, id(61)); assert.equal(view.chargeCreated, false); assert.equal(view.effectiveCancellation, false) }
})
test('duplicate/foreign request rows fail closed and malformed policy identifiers or clocks are rejected', () => {
 const request = lifecycleRequest(raw(), actor)
 assert.throws(() => lifecycleRequestView(status(), [request, request]), /REQUEST_INVALID/)
 assert.throws(() => lifecycleRequestView(status(), [{ ...request, subscriberId: id(2) }]), /REQUEST_INVALID/)
 for (const patch of [{ request_id: 'invalid' }, { terms_id: 'invalid' }, { action: 'charge' }, { account_revision: 1.1 }, { document_ref: 'https://unapproved.example.test' }, { requested_at: 'yesterday' }, { original_period_ends_at: '2026-10-25' }]) assert.throws(() => lifecycleRequest({ ...raw(), ...patch }, actor), /REQUEST_INVALID/)
})
test('returned review view cannot mutate input history and keeps literal entered policy reference only', () => {
 const request = lifecycleRequest({ ...raw(), provider_secret: 'PRIVATE_NEVER_PROJECTED', error_body: 'PRIVATE_ERROR_BODY' }, actor), view = lifecycleRequestView(status(), [request])
 view.requests[0].action = 'renewal'; assert.equal(request.action, 'cancellation'); assert(!JSON.stringify(request).includes('PRIVATE_')); assert.equal(request.documentRef, raw().document_ref)
})
