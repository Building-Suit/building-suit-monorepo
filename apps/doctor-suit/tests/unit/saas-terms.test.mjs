import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorSaasTerms } from '../../app/utils/saasTerms.ts'
const id = n => `ae050000-0000-0000-0000-${String(n).padStart(12,'0')}`
const identity = { userId: id(1),sessionId: id(11),practiceId: id(21) }
const projection = () => ({ subscriber_user_id: identity.userId,practice_id: identity.practiceId,configuration_revision: 1,configured: false,terms: null,data_mode: 'synthetic',payment_route: 'unconfigured',purchase_available: false,live_activation: false })
const fixture = () => ({ terms_id: id(52),plan_key: 'synthetic-fixture',version: 2,currency: 'USD',currency_exponent: 2,monthly_minor: 1234,yearly_minor: null,trial_days: 0,grace_days: 0,staff: { kind: 'limited',limit: 0 },clinics: { kind: 'unlimited' },over_limit_policy: 'block_new_allocation',renewal_policy: 'manual',expiry_policy: 'historical_read_only',cancellation_policy: 'period_end',refund_policy: 'manual_review',terms_document_ref: 'synthetic-fixture/terms-v1' })
test('unconfigured terms stay absent without inferred prices trials or unlimited quotas', () => {
  const parsed = doctorSaasTerms(projection(),identity)
  assert.equal(parsed.configured,false);assert.equal(parsed.terms,null);assert.equal(parsed.purchaseAvailable,false)
  for(const invalid of [{ configured: true },{ terms: fixture() },{ terms: undefined },{ configuration_revision: 0 }])assert.throws(() => doctorSaasTerms({ ...projection(),...invalid },identity),/DOCTOR_SAAS_TERMS_RESPONSE_INVALID/)
})
test('approved synthetic projection preserves exact zero/absent and explicit unlimited distinctions', () => {
  const parsed = doctorSaasTerms({ ...projection(),configured: true,terms: fixture() },identity)
  assert.equal(parsed.terms.monthlyMinor,1234);assert.equal(parsed.terms.yearlyMinor,null);assert.equal(parsed.terms.trialDays,0)
  assert.deepEqual(parsed.terms.staff,{ kind: 'limited',limit: 0 });assert.deepEqual(parsed.terms.clinics,{ kind: 'unlimited' })
  assert.equal(parsed.purchaseAvailable,false);assert.equal(parsed.liveActivation,false)
})
test('identity and closed operational flags cannot be forged by a response or cached foreign projection', () => {
  for(const invalid of [{ subscriber_user_id: id(2) },{ practice_id: id(22) },{ data_mode: 'real' },{ payment_route: 'approved_merchant' },{ purchase_available: true },{ live_activation: true }])assert.throws(() => doctorSaasTerms({ ...projection(),...invalid },identity),/DOCTOR_SAAS_TERMS_RESPONSE_INVALID/)
  assert.equal(doctorSaasTerms({ ...projection(),practice_id: null },{ ...identity,practiceId: null }).practiceId,null)
})
test('missing precision, unknown policies, unsafe references and ambiguous quotas fail closed', () => {
  const invalid = [{ monthly_minor: Number.MAX_SAFE_INTEGER+1 },{ monthly_minor: 1.5 },{ monthly_minor: null,yearly_minor: null },{ currency_exponent: null },{ trial_days: null },{ staff: { kind: 'unlimited',limit: 0 } },{ clinics: { kind: 'limited',limit: null } },{ staff: null },{ expiry_policy: 'delete_history' },{ renewal_policy: 'implicit_charge' },{ over_limit_policy: null },{ terms_document_ref: 'https://unapproved.example.test/terms' }]
  for(const change of invalid)assert.throws(() => doctorSaasTerms({ ...projection(),configured: true,terms: { ...fixture(),...change } },identity),/DOCTOR_SAAS_TERMS_RESPONSE_INVALID/)
  const parsed = doctorSaasTerms({ ...projection(),configured: true,terms: { ...fixture(),commercial_approval_ref: 'SYNTHETIC_INTERNAL_EVIDENCE' },service_role: true },identity)
  assert.equal(Object.hasOwn(parsed.terms,'commercial_approval_ref'),false);assert.equal(Object.hasOwn(parsed,'service_role'),false)
})
