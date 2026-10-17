import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorSaasStatus,doctorSaasFailure,doctorSaasTrialReceipt } from '../../app/utils/saasStatus.ts'
import { doctorSaasRepository } from '../../app/utils/saasRepository.ts'
const id = n => `ae060000-0000-0000-0000-${String(n).padStart(12,'0')}`
const actor = { userId: id(1),sessionId: id(11),practiceId: null }
const terms = () => ({ terms_id: id(51),plan_key: 'synthetic-trial',version: 1,currency: 'USD',currency_exponent: 2,monthly_minor: 1234,yearly_minor: null,trial_days: 2,grace_days: 0,staff: { kind: 'limited',limit: 1 },clinics: { kind: 'limited',limit: 1 },over_limit_policy: 'block_new_allocation',renewal_policy: 'manual',expiry_policy: 'historical_read_only',cancellation_policy: 'period_end',refund_policy: 'manual_review',terms_document_ref: 'synthetic-trials/v1' })
const empty = () => ({ subscriber_user_id: actor.userId,practice_id: null,state: 'unconfigured',revision: 0,period_active: false,period: null,terms: null,data_mode: 'synthetic',paid_activation_available: false,live_activation: false })
const period = () => ({ id: id(61),kind: 'trial',terms_id: id(51),started_at: '2026-10-17T08:00:00-07:00',ends_at: '2026-10-19T08:00:00-07:00',accepted_document_ref: 'synthetic-trials/v1' })
const status = state => ({ ...empty(),state,revision: 1,period_active: state==='trial',period: period(),terms: terms() })
test('status never invents an account or a paid activation from an unconfigured identity', () => {
  const parsed = doctorSaasStatus(empty(),actor)
  assert.equal(parsed.revision,0);assert.equal(parsed.period,null);assert.equal(parsed.paidActivationAvailable,false)
  for(const change of [{ period: period() },{ terms: terms() },{ revision: 1 },{ period_active: true }])assert.throws(() => doctorSaasStatus({ ...empty(),...change },actor),/RESPONSE_INVALID/)
})
test('current and historical state keep the original period and snapshot without trusting the local clock', () => {
  for(const state of ['trial','expired','scheduled','suspended']) {
    const parsed = doctorSaasStatus(status(state),actor)
    assert.equal(parsed.state,state);assert.equal(parsed.period.id,id(61));assert.equal(parsed.period.endsAt,'2026-10-19T15:00:00.000Z')
    assert.equal(parsed.terms.id,id(51));assert.equal(parsed.periodActive,state==='trial');assert.equal(parsed.liveActivation,false)
  }
})
test('foreign identities, mismatched snapshots and forged paid flags fail closed', () => {
  const bad = [{ subscriber_user_id: id(2) },{ practice_id: id(21) },{ revision: 0 },{ state: 'paid' },{ paid_activation_available: true },{ live_activation: true },{ period: { ...period(),kind: 'paid' } },{ period: { ...period(),terms_id: id(52) } },{ period: { ...period(),accepted_document_ref: 'synthetic-other/v1' } },{ period: { ...period(),ends_at: 'not-a-timestamp' } }]
  for(const change of bad)assert.throws(() => doctorSaasStatus({ ...status('trial'),...change },actor),/RESPONSE_INVALID/)
  assert.throws(() => doctorSaasStatus({ ...status('expired'),period_active: true },actor),/RESPONSE_INVALID/)
})
test('trial adapter sends only a versioned terms acceptance and stable command key', async () => {
  const requests = [];const receipt = { period_id: id(61),terms_id: id(51),started_at: period().started_at,ends_at: period().ends_at,revision: 1,paid: true }
  const repository = doctorSaasRepository({ rpc(name,args) { requests.push({ name,args });return { abortSignal: async () => ({ data: receipt,error: null }) } } })
  const result = await repository.startTrial({ termsId: id(51),configurationRevision: 2,documentRef: 'synthetic-trials/v1',trialDays: 9999,subscriberUserId: id(2),paid: true,amount: 1 },id(71),new AbortController().signal)
  assert.deepEqual(requests,[{ name: 'doctor_start_saas_trial',args: { p_terms: id(51),p_configuration_revision: 2,p_document_ref: 'synthetic-trials/v1',p_key: id(71) } }])
  assert.equal(result.periodId,id(61));assert.equal(Object.hasOwn(result,'paid'),false);assert.equal(Object.hasOwn(result,'periodActive'),false)
  assert.throws(() => doctorSaasTrialReceipt({ ...receipt,terms_id: id(52) },id(51)),/RESPONSE_INVALID/)
})
test('known SaaS failures are bounded UI categories without private backend text', () => {
  for(const [code,expected]of Object.entries({ DS001: 'configuration',DS002: 'staff-limit',DS003: 'clinic-limit',DS004: 'trial-used',DS005: 'trial-unavailable',DS006: 'inactive','40001': 'conflict','42501': 'denied','22023': 'invalid' }))assert.equal(doctorSaasFailure({ code,message: 'SYNTHETIC_PRIVATE_BACKEND_DETAIL' }),expected)
  assert.equal(doctorSaasFailure({ code: 'unknown',message: 'SYNTHETIC_PRIVATE_BACKEND_DETAIL' }),'network')
})
