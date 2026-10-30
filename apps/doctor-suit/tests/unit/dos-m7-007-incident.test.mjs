import test from 'node:test'
import assert from 'node:assert/strict'
import { createDoctorIncidentTrace, doctorIncidentReceipt, beginDoctorIncidentEvidence, incidentChecks, incidentInputs } from '../incident-evidence.mjs'

const binding = () => ({ head: 'a'.repeat(40), base: 'b'.repeat(40), executionId: '1:1:doctor-browser', sourceVerified: true,
  inputHashes: Object.fromEntries(incidentInputs.map(file => [file, 'c'.repeat(64)])), secret: 'must-not-serialize' })
const complete = () => {
  const trace = createDoctorIncidentTrace()
  for (const id of incidentChecks) trace.check(id, true)
  for (const signal of ['outbox.unknown_observed', 'outbox.sent_observed', 'outbox.access_rejected']) trace.record(signal)
  return trace
}

test('C03 captured-alert fixture accepts only fixed strings, is bounded and immutable', () => {
  const trace = createDoctorIncidentTrace()
  assert.equal(trace.record({ toString() { throw Error('must not coerce') } }), false)
  assert.equal(trace.record('private patient payload'), false)
  for (let i = 0; i < 64; i++) assert.equal(trace.record('outbox.unknown_observed'), true)
  assert.equal(trace.record('outbox.unknown_observed'), false)
  const snapshot = trace.snapshot()
  assert.equal(snapshot.alerts.length, 64); assert.equal(snapshot.rejected, true)
  assert.throws(() => snapshot.alerts.push('outbox.sent_observed'))
  assert(!JSON.stringify(snapshot).includes('private patient'))
  assert.equal(createDoctorIncidentTrace().snapshot().alerts.length, 0)
})
test('C03 failed, missing and duplicate assertions cannot become passing evidence', () => {
  const trace = createDoctorIncidentTrace()
  assert.throws(() => trace.check('known.timeout_unknown', false))
  assert.throws(() => trace.check('known.timeout_unknown', true))
  assert.throws(() => trace.check('unknown.assertion', true))
  const receipt = doctorIncidentReceipt(binding(), trace.snapshot(), 1)
  assert.equal(receipt.accepted, false)
  assert.equal(receipt.checks[0].status, 'failed')
  assert(receipt.checks.slice(1).every(row => row.status === 'unrun'))
})
test('C03 receipt schema binds every input and rejects incomplete execution while preserving authority holds', () => {
  const snapshot = complete().snapshot()
  // Pure receipt-validation test only; these invented hashes are not an actual CI receipt.
  const receipt = doctorIncidentReceipt(binding(), snapshot, 0)
  assert.equal(receipt.accepted, true); assert.equal(receipt.fullTaskAccepted, false)
  assert.equal(receipt.accountableIncidentReview, 'unavailable'); assert.equal(receipt.externalDelivery, false)
  assert(!JSON.stringify(receipt).includes('must-not-serialize'))
  for (const changed of [{ head: 'invalid' }, { base: '' }, { executionId: 'local' }, { inputHashes: {} }]) assert.throws(() => doctorIncidentReceipt({ ...binding(), ...changed }, snapshot, 0))
  assert.equal(doctorIncidentReceipt({ ...binding(), sourceVerified: false }, snapshot, 0).accepted, false)
  assert.equal(doctorIncidentReceipt(binding(), snapshot, 1).accepted, false)
  assert.equal(doctorIncidentReceipt(binding(), { ...snapshot, alerts: [] }, 0).accepted, false)
  assert.equal(doctorIncidentReceipt(binding(), { ...snapshot, rejected: true }, 0).accepted, false)
  assert.throws(() => doctorIncidentReceipt(binding(), { ...snapshot, alerts: ['unapproved-recipient'] }, 0))
})
test('C03 source receipt cannot start outside the owned GitHub execution context', async () => {
  await assert.rejects(beginDoctorIncidentEvidence('/not-a-repository', {}), /owned GitHub job/)
})
