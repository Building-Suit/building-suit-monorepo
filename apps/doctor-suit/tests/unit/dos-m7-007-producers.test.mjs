import test from 'node:test'
import assert from 'node:assert/strict'
import { createDoctorOperationalSignalBuffer, observeDoctorSyntheticRecovery } from '../../supabase/functions/_shared/operational-signals.ts'
import { createMessageOutboxReader, messageOutboxState, messageStates } from '../../app/utils/messageOutbox.ts'
import { createPracticeMoneyController, practiceMoneyControllerState } from '../../app/utils/practiceMoneyController.ts'
import { practiceMoneyState } from '../../app/utils/practiceMoney.ts'
import { createDoctorSubscriptionController, doctorSubscriptionState } from '../../app/utils/saasController.ts'
import { doctorOperationsStatus } from '../../app/utils/operationsReadiness.ts'
import { doctorSaasStatus } from '../../app/utils/saasStatus.ts'
import { verifyDoctorIsolatedRecovery } from '../recovery-isolated.mjs'

const id = n => `77071000-0000-4000-8000-${String(n).padStart(12, '0')}`
const stamp = '2026-10-30T06:00:00Z', privateText = 'Synthetic private detail excluded from signals'
const scope = () => ({ userId: id(1), sessionId: id(2), practiceId: id(3), locationId: id(4), portal: 'doctor', environment: 'local', grantsVersion: 1 })
const count = (buffer, signal) => buffer.snapshot().counts.find(row => row.signal === signal).count
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const outbox = (states = messageStates) => ({ data_mode: 'synthetic', external_delivery: false, page: 0, total: states.length, rows: states.map((state, i) => ({ id: id(100+i), patient_id: id(5), state, version: 3, attempts: 1, blocker: state === 'unknown' ? 'transport_timeout' : null, purpose: 'appointment_reminder', recipient_kind: 'patient', template: 'appointment_reminder_v1', expires_at: stamp, created_at: stamp, data_mode: 'synthetic', external_delivery: false })) })

test('C01 outbox observations preserve each authorized state and never turn unknown/sent into delivery', async () => {
  const buffer = createDoctorOperationalSignalBuffer(), state = messageOutboxState()
  let raw = outbox(['unknown', 'unknown', 'sent'])
  const reader = createMessageOutboxReader(async () => raw, state, scope, buffer.record)
  assert(await reader.read(id(5)))
  assert.equal(count(buffer, 'outbox.unknown_observed'), 1) // snapshot, not two unique deliveries
  assert.equal(count(buffer, 'outbox.sent_observed'), 1)
  assert.equal(count(buffer, 'outbox.delivered_synthetic_observed'), 0)
  raw = outbox(); assert(await reader.read(id(5)))
  for (const value of messageStates) assert(count(buffer, value === 'delivered' ? 'outbox.delivered_synthetic_observed' : `outbox.${value}_observed`) > 0)
  assert(!JSON.stringify(buffer.snapshot()).includes(id(5)))
  reader.clear()
})

test('C01 outbox rejects private/foreign/live input and late scope changes before observations', async () => {
  for (const change of [{ data_mode: 'live' }, { rows: [{ ...outbox().rows[0], patient_id: id(99) }] }, { rows: [{ ...outbox().rows[0], body: privateText }] }]) {
    const buffer = createDoctorOperationalSignalBuffer(), state = messageOutboxState()
    const reader = createMessageOutboxReader(async () => ({ ...outbox(), ...change }), state, scope, buffer.record)
    assert.equal(await reader.read(id(5)), false)
    assert.equal(count(buffer, 'outbox.unavailable'), 1)
    assert(buffer.snapshot().counts.filter(row => row.signal.endsWith('_observed')).every(row => row.count === 0))
  }
  const buffer = createDoctorOperationalSignalBuffer(), pending = deferred(); let current = scope()
  const reader = createMessageOutboxReader(() => pending.promise, messageOutboxState(), () => current, buffer.record)
  const running = reader.read(id(5)); current = { ...current, sessionId: id(99) }; reader.clear(); pending.resolve(outbox())
  assert.equal(await running, false); assert(buffer.snapshot().counts.every(row => row.count === 0))
})

test('C01 denied outbox records only fixed authorization observation even if observer rejects', async () => {
  const signals = [], state = messageOutboxState()
  const reader = createMessageOutboxReader(async () => { throw { code: '42501', message: privateText } }, state, scope, signal => { signals.push(signal); return Promise.reject(new Error(privateText)) })
  assert.equal(await reader.read(id(5)), false); assert.equal(state.error, 'denied')
  assert.deepEqual(signals, ['outbox.access_rejected']); await new Promise(r => setImmediate(r))
})

const moneyScope = { ...scope(), chargeId: id(6), patientId: id(5) }
const flags = { data_mode: 'synthetic', external_transport_enabled: false, live_collection: false, tax_invoice_available: false, tax_applicability: 'unreviewed' }
function moneyRaw(status = 'unknown') {
  const row = { ...flags, id: id(7), practice_id: id(3), location_id: id(4), doctor_user_id: id(1), patient_id: id(5), charge_id: id(6), charge_version_id: id(8), kind: 'collection', original_entry_id: null, original_receipt_label: null, amount_minor: '100', currency: 'EGP', currency_exponent: 2, reason: privateText, actor_user_id: id(1), created_at: stamp, revision: status === 'pending' ? 1 : status === 'unknown' ? 2 : 3, state: status, reason_code: { pending: 'prepared', unknown: 'attempt_reconciliation_required', failed: 'synthetic_rejected', posted: 'synthetic_accepted' }[status], state_at: stamp, entry: null }
  if (status === 'posted') row.entry = { id: id(9), intent_id: row.id, practice_id: id(3), location_id: id(4), patient_id: id(5), kind: 'collection', original_entry_id: null, receipt_number: '1', receipt_label: 'SYN-00000001', amount_minor: '100', currency: 'EGP', currency_exponent: 2, actor_user_id: id(1), created_at: stamp, refundable_minor: '100' }
  return { ...flags, actor_user_id: id(1), practice_id: id(3), location_id: id(4), charge_id: id(6), charge_version_id: id(8), patient_id: id(5), currency: 'EGP', currency_exponent: 2, charge_minor: '1000', charge_label: privateText, patient_name: privateText, charge_recorded_at: stamp, clinic_name: privateText, timezone: 'Etc/UTC', balance: { collected_minor: '0', refunded_minor: '0', net_minor: '0', reserved_collection_minor: '100', reserved_refund_minor: '0' }, page: 1, total: 1, items: [row], edition: 'synthetic_preview', location_archived: false, can_write: true, entitlement: { state: 'preview', revision: 0, writes_allowed: true, can_add_staff: true, can_add_clinic: true, over_limit: false, valid_until: null, observed_at: stamp } }
}
test('C01 practice-money observations use validated current reads, disclose no amounts and initiate no write', async () => {
  const buffer = createDoctorOperationalSignalBuffer(); let raw = moneyRaw(), writes = 0
  const state = practiceMoneyControllerState(), repo = { read: async () => ({ scope: moneyScope, model: practiceMoneyState(raw, moneyScope, 1) }), prepare: async () => { writes++ }, advance: async () => { writes++ } }
  const controller = createPracticeMoneyController(repo, state, scope, 'local', undefined, () => id(30), buffer.record)
  assert(await controller.select(moneyScope)); assert.equal(count(buffer, 'practice_money.unknown_observed'), 1)
  assert.equal(count(buffer, 'practice_money.posted_synthetic_observed'), 0)
  for (const status of ['pending', 'failed', 'posted']) { raw = moneyRaw(status); assert(await controller.refresh()) }
  assert.equal(count(buffer, 'practice_money.posted_synthetic_observed'), 1)
  assert.equal(writes, 0); assert(!JSON.stringify(buffer.snapshot()).includes(privateText)); assert(!JSON.stringify(buffer.snapshot()).includes('EGP'))
  raw = { ...raw, data_mode: 'live' }; assert.equal(await controller.refresh(), false)
  assert.equal(count(buffer, 'practice_money.posted_synthetic_observed'), 1); controller.dispose()
})
test('C01 late practice-money response cannot observe a prior session', async () => {
  const pending = deferred(), buffer = createDoctorOperationalSignalBuffer(); let actor = scope()
  const controller = createPracticeMoneyController({ read: () => pending.promise }, practiceMoneyControllerState(), () => actor, 'local', undefined, () => id(30), buffer.record)
  const running = controller.select(moneyScope); actor = { ...actor, sessionId: id(99) }; controller.clear()
  pending.resolve({ scope: moneyScope, model: practiceMoneyState(moneyRaw(), moneyScope, 1) })
  assert.equal(await running, false); assert(buffer.snapshot().counts.every(row => row.count === 0)); controller.dispose()
})

const readiness = () => doctorOperationsStatus({ subscriber_user_id: id(1), scope: 'own_saas_operations', data_mode: 'synthetic', state: 'diagnostics_only', observed_at: stamp, reconciliation: { held_intents: 2, unknown_review: 1, discrepancy_review: 1 }, privacy_intake: { awaiting_review: 0, fulfillment_available: false }, payment_configuration: 'unconfigured', administration_configuration: 'unconfigured', independent_financial_review: 'pending', independent_security_review: 'pending', security_findings: { assessment: 'not_performed', critical: null, high: null }, recovery: { qualification: 'pending', rpo: null, rto: null, whole_provider_qualified: false }, capacity: { approved_thresholds: null, accepted_measurement: null, provider_quota_cost_review: 'pending' }, incident_ownership: 'unconfigured', support_destination: null, hosted_telemetry_available: false, launch_decisions: ['AE-D02','AE-D03','AE-D04','AE-D05','AE-D06','AE-D07','AE-D08','AE-D09','AE-D10'], patient_payloads_included: false, paid_activation_available: false, live_activation: false }, scope())
const saasStatus = () => doctorSaasStatus({ subscriber_user_id: id(1), practice_id: id(3), state: 'unconfigured', revision: 0, period_active: false, business_writes_allowed: false, observed_at: stamp, period: null, terms: null, data_mode: 'synthetic', paid_activation_available: false, live_activation: false }, scope())
test('C01 subscriber reconciliation observations stay separate from practice money and cannot activate access', async () => {
  const buffer = createDoctorOperationalSignalBuffer(), state = doctorSubscriptionState()
  const controller = createDoctorSubscriptionController({ terms: async () => ({ configured: false, terms: null }), status: async () => saasStatus(), readiness: async () => ({ operations: readiness(), administration: null }) }, state, scope, async () => {}, undefined, () => id(30), buffer.record)
  assert(await controller.load()); assert.equal(count(buffer, 'saas_reconciliation.unknown_observed'), 1); assert.equal(count(buffer, 'saas_reconciliation.discrepancy_observed'), 1)
  assert.equal(count(buffer, 'practice_money.unknown_observed'), 0); assert.equal(controller.canStart(), false); assert.equal(state.status.writesAllowed, false)
  assert(!JSON.stringify(buffer.snapshot()).includes(id(1))); controller.clear()
})
test('C01 late SaaS readiness cannot observe a prior account', async () => {
  const pending = deferred(), buffer = createDoctorOperationalSignalBuffer(); let actor = scope()
  const controller = createDoctorSubscriptionController({ terms: async () => ({ configured: false, terms: null }), status: async () => saasStatus(), readiness: () => pending.promise }, doctorSubscriptionState(), () => actor, async () => {}, undefined, () => id(30), buffer.record)
  const running = controller.load(); actor = { ...actor, userId: id(99), sessionId: id(98) }; controller.clear(); pending.resolve({ operations: readiness(), administration: null })
  assert.equal(await running, false); assert(buffer.snapshot().counts.every(row => row.count === 0))
})
test('C01 recovery observation preserves original failure and reports completion only after the operation', async () => {
  const buffer = createDoctorOperationalSignalBuffer(), failure = new Error(privateText), pending = deferred()
  const running = observeDoctorSyntheticRecovery(() => pending.promise, buffer.record)
  assert.equal(count(buffer, 'recovery.fixture_completed'), 0); pending.resolve(); await running
  assert.equal(count(buffer, 'recovery.fixture_completed'), 1)
  await assert.rejects(observeDoctorSyntheticRecovery(async () => { throw failure }, buffer.record), error => error === failure)
  assert.equal(count(buffer, 'recovery.fixture_failed'), 1); assert(!JSON.stringify(buffer.snapshot()).includes(privateText))
  await assert.rejects(verifyDoctorIsolatedRecovery('not-an-owned-fixture', buffer.record))
  assert.equal(count(buffer, 'recovery.fixture_failed'), 2) // actual guard rejects before Docker/SQL
})
