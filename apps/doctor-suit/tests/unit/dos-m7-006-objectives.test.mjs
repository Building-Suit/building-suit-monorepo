import test from 'node:test'
import assert from 'node:assert/strict'
import {compareDoctorRecoveryObjectives as compare} from '../helpers/recovery-objectives.mjs'

function fixture() {
  const source = {candidateSha: 'a'.repeat(40), baseSha: 'b'.repeat(40), scopeSha256: 'c'.repeat(64)}
  const binding = {...source, executionId: 'synthetic-unit-1'}
  return {binding, objectives: {...source, unit: 'milliseconds', rpoMs: 10, rtoMs: 20},
    measurement: {...binding, recoveryClock: 'monotonic-milliseconds', recoveryStartedMs: 100, recoveryVerifiedMs: 120,
      dataClock: 'unix-milliseconds', disruptionMs: 1000, restoredThroughMs: 990,
      restorationStatus: 'complete', reconciliationStatus: 'verified'}}
}
function noAuthority(result) {
  for (const key of ['measurementProvenanceVerified', 'objectivesApprovalVerified', 'restoreAuthorized', 'restoreExecuted', 'taskAcceptance', 'clinicalApproval']) assert.equal(result[key], false, key)
}
function reject(input, issue) {
  const result = compare(input)
  assert.equal(result.comparisonStatus, 'invalid'); assert.ok(result.issues.includes(issue))
  for (const key of ['recoveryDuration', 'dataLossWindow']) assert.deepEqual(result[key], {status: 'unavailable', measuredMs: null, objectiveMs: null})
  noAuthority(result); return result
}
test('C03 unit subset: inclusive supplied thresholds compare independent clock intervals without granting authority', () => {
  const input = fixture(), before = structuredClone(input), result = compare(input)
  assert.equal(result.comparisonStatus, 'within-supplied-objectives'); assert.equal(result.bindingConsistent, true)
  assert.deepEqual(result.recoveryDuration, {status: 'within', measuredMs: 20, objectiveMs: 20})
  assert.deepEqual(result.dataLossWindow, {status: 'within', measuredMs: 10, objectiveMs: 10})
  noAuthority(result); assert.deepEqual(input, before)
})
test('C03 unit subset: one millisecond overruns fail independently without rounding or changing the supplied objective', () => {
  for (const key of ['rpoMs', 'rtoMs']) {
    const input = fixture(); input.objectives[key]--
    const result = compare(input)
    assert.equal(result.comparisonStatus, 'exceeds-supplied-objectives')
    assert.equal(result.dataLossWindow.status, key === 'rpoMs' ? 'exceeded' : 'within')
    assert.equal(result.recoveryDuration.status, key === 'rtoMs' ? 'exceeded' : 'within'); noAuthority(result)
  }
  const both = fixture(); both.objectives.rpoMs = 0; both.objectives.rtoMs = 0
  assert.equal(compare(both).recoveryDuration.status, 'exceeded'); assert.equal(compare(both).dataLossWindow.status, 'exceeded')
})
test('C03 unit subset: explicit zero objectives and safe integer boundaries have no invented minimum or defaults', () => {
  const zero = fixture(); zero.objectives.rpoMs = 0; zero.objectives.rtoMs = 0
  zero.measurement.recoveryVerifiedMs = zero.measurement.recoveryStartedMs; zero.measurement.restoredThroughMs = zero.measurement.disruptionMs
  assert.equal(compare(zero).comparisonStatus, 'within-supplied-objectives')
  const large = fixture(); large.measurement.recoveryStartedMs = 0; large.measurement.recoveryVerifiedMs = Number.MAX_SAFE_INTEGER
  large.objectives.rtoMs = Number.MAX_SAFE_INTEGER
  assert.equal(compare(large).recoveryDuration.measuredMs, Number.MAX_SAFE_INTEGER)
  large.objectives.rtoMs--; assert.equal(compare(large).recoveryDuration.status, 'exceeded')
})
test('C03 unit subset: absent objectives or measurements are unavailable, never successful comparisons', () => {
  for (const key of ['objectives', 'measurement']) {
    const input = fixture(); input[key] = null
    const result = compare(input); assert.equal(result.comparisonStatus, 'unavailable'); assert.deepEqual(result.issues, ['missing-evidence'])
    assert.equal(result.recoveryDuration.status, 'unavailable'); noAuthority(result)
    delete input[key]; reject(input, 'invalid-input')
  }
  reject(null, 'invalid-input'); reject({}, 'invalid-input')
})
test('C03 unit subset: candidate, base, scope and execution mismatches reject numerically passing evidence', () => {
  for (const group of ['objectives', 'measurement']) for (const key of ['candidateSha', 'baseSha', 'scopeSha256']) {
    const input = fixture(); input[group][key] = 'd'.repeat(key === 'scopeSha256' ? 64 : 40)
    assert.equal(reject(input, 'binding-mismatch').bindingConsistent, false)
  }
  const input = fixture(); input.measurement.executionId = 'another-execution'; reject(input, 'binding-mismatch')
})
test('C03 unit subset: invalid source identifiers and missing binding cannot establish consistency', () => {
  for (const group of ['binding', 'objectives', 'measurement']) {
    const input = fixture(); input[group].candidateSha = 'not-a-sha'
    reject(input, group === 'binding' ? 'invalid-binding' : group === 'objectives' ? 'invalid-objectives' : 'invalid-measurement')
  }
  const missing = fixture(); missing.binding = null; reject(missing, 'invalid-binding')
  const empty = fixture(); empty.binding.executionId = ''; reject(empty, 'invalid-binding')
})
test('C03 unit subset: negative, fractional, nonfinite, unsafe and coerced numbers are rejected', () => {
  for (const value of [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '20', null, true, 20n]) {
    for (const key of ['rpoMs', 'rtoMs']) { const input = fixture(); input.objectives[key] = value; reject(input, 'invalid-objectives') }
    for (const key of ['recoveryStartedMs', 'recoveryVerifiedMs', 'disruptionMs', 'restoredThroughMs']) { const input = fixture(); input.measurement[key] = value; reject(input, 'invalid-measurement') }
  }
})
test('C03 unit subset: wrong or unspecified units and clocks cannot silently change measurement semantics', () => {
  const seconds = fixture(); seconds.objectives.unit = 'seconds'; reject(seconds, 'invalid-objectives')
  const wall = fixture(); wall.measurement.recoveryClock = 'unix-milliseconds'; reject(wall, 'invalid-measurement')
  const mono = fixture(); mono.measurement.dataClock = 'monotonic-milliseconds'; reject(mono, 'invalid-measurement')
  for (const group of ['objectives', 'measurement']) for (const key of Object.keys(fixture()[group])) {
    const input = fixture(); delete input[group][key]; reject(input, group === 'objectives' ? 'invalid-objectives' : 'invalid-measurement')
  }
})
test('C03 unit subset: reversed elapsed time and data cutoffs after disruption are inconsistent', () => {
  const reverse = fixture(); reverse.measurement.recoveryVerifiedMs = 99; reject(reverse, 'inconsistent-measurement')
  const future = fixture(); future.measurement.restoredThroughMs = 1001; reject(future, 'inconsistent-measurement')
})
test('C03 unit subset: corrupt, partial, failed, skipped and unknown restoration or reconciliation cannot pass thresholds', () => {
  for (const key of ['restorationStatus', 'reconciliationStatus']) for (const state of ['partial', 'corrupt', 'failed', 'skipped', 'unknown', null, true]) {
    const input = fixture(); input.measurement[key] = state; reject(input, 'incomplete-restoration')
  }
})
test('C03 unit subset: authority-shaped extras, inherited evidence and accessors fail closed without invoking caller code', () => {
  for (const key of ['binding', 'objectives', 'measurement']) { const input = fixture(); input[key].approved = true; reject(input, `invalid-${key === 'objectives' ? 'objectives' : key === 'measurement' ? 'measurement' : 'binding'}`) }
  const extra = fixture(); extra.restoreAuthorized = true; reject(extra, 'invalid-input')
  const inherited = fixture(); inherited.objectives = Object.create(inherited.objectives); reject(inherited, 'invalid-objectives')
  let invoked = false
  const accessor = fixture(); Object.defineProperty(accessor.measurement, 'recoveryVerifiedMs', {get() { invoked = true; throw Error('private.sentinel') }})
  reject(accessor, 'invalid-measurement'); assert.equal(invoked, false)
})
test('C03 unit subset: receipts contain no caller source identities, arbitrary data or exceptions', () => {
  const input = fixture(), result = compare(input), serialized = JSON.stringify(result)
  for (const value of Object.values(input.binding)) assert.equal(serialized.includes(value), false)
  const hostile = new Proxy({}, {getPrototypeOf() { throw Error('private.sentinel') }})
  assert.equal(JSON.stringify(reject(hostile, 'invalid-input')).includes('private.sentinel'), false)
})
