const sourceKeys = ['candidateSha', 'baseSha', 'scopeSha256']
const bindingKeys = [...sourceKeys, 'executionId']
const objectiveKeys = [...sourceKeys, 'unit', 'rpoMs', 'rtoMs']
const measurementKeys = [...bindingKeys, 'recoveryClock', 'recoveryStartedMs', 'recoveryVerifiedMs',
  'dataClock', 'disruptionMs', 'restoredThroughMs', 'restorationStatus', 'reconciliationStatus']

// Accept data records only, without invoking accessors or coercing values.
function record(value, keys) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null
  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (Reflect.ownKeys(descriptors).length !== keys.length || keys.some(key => !Object.hasOwn(descriptors, key) || !Object.hasOwn(descriptors[key], 'value'))) return null
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]))
}
const milliseconds = value => Number.isSafeInteger(value) && value >= 0
const source = value => sourceKeys.every(key => typeof value[key] === 'string' && (key === 'scopeSha256' ? /^[a-f0-9]{64}$/ : /^[a-f0-9]{40}$/).test(value[key]))
const execution = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)

/**
 * Pure comparison of supplied synthetic measurements, not an operational profile.
 * RTO: elapsed monotonic time from recovery start through completed reconciliation.
 * RPO: disruption epoch minus the last consistently restored data cutoff epoch.
 * The two clocks are never subtracted from each other. All values are explicit
 * integer milliseconds; equality meets a supplied objective, zero is permitted.
 * Matching labels/digests establish input consistency, never provenance or approval.
 */
export function compareDoctorRecoveryObjectives(input) {
  const unavailable = () => ({status: 'unavailable', measuredMs: null, objectiveMs: null})
  const result = {scope: 'supplied-synthetic-recovery-measurements', comparisonStatus: 'invalid',
    issues: [], bindingConsistent: false, recoveryDuration: unavailable(), dataLossWindow: unavailable(),
    measurementProvenanceVerified: false, objectivesApprovalVerified: false,
    restoreAuthorized: false, restoreExecuted: false, taskAcceptance: false, clinicalApproval: false}
  const fail = issue => { result.issues.push(issue); return result }
  try {
    const envelope = record(input, ['binding', 'objectives', 'measurement'])
    if (!envelope) return fail('invalid-input')
    if (envelope.objectives == null || envelope.measurement == null) {
      result.comparisonStatus = 'unavailable'
      return fail('missing-evidence')
    }
    const binding = record(envelope.binding, bindingKeys)
    const objectives = record(envelope.objectives, objectiveKeys)
    const measurement = record(envelope.measurement, measurementKeys)
    if (!binding || !source(binding) || !execution(binding.executionId)) return fail('invalid-binding')
    if (!objectives || !source(objectives) || objectives.unit !== 'milliseconds' || !milliseconds(objectives.rpoMs) || !milliseconds(objectives.rtoMs)) return fail('invalid-objectives')
    if (!measurement || !source(measurement) || !execution(measurement.executionId)
      || measurement.recoveryClock !== 'monotonic-milliseconds' || measurement.dataClock !== 'unix-milliseconds'
      || !['recoveryStartedMs', 'recoveryVerifiedMs', 'disruptionMs', 'restoredThroughMs'].every(key => milliseconds(measurement[key]))) return fail('invalid-measurement')
    if (sourceKeys.some(key => binding[key] !== objectives[key] || binding[key] !== measurement[key]) || binding.executionId !== measurement.executionId) return fail('binding-mismatch')
    result.bindingConsistent = true
    if (measurement.restorationStatus !== 'complete' || measurement.reconciliationStatus !== 'verified') return fail('incomplete-restoration')
    if (measurement.recoveryVerifiedMs < measurement.recoveryStartedMs || measurement.restoredThroughMs > measurement.disruptionMs) return fail('inconsistent-measurement')
    const compare = (measuredMs, objectiveMs) => ({status: measuredMs <= objectiveMs ? 'within' : 'exceeded', measuredMs, objectiveMs})
    result.recoveryDuration = compare(measurement.recoveryVerifiedMs - measurement.recoveryStartedMs, objectives.rtoMs)
    result.dataLossWindow = compare(measurement.disruptionMs - measurement.restoredThroughMs, objectives.rpoMs)
    result.comparisonStatus = result.recoveryDuration.status === 'within' && result.dataLossWindow.status === 'within'
      ? 'within-supplied-objectives' : 'exceeds-supplied-objectives'
    return result
  } catch {
    // Do not leak caller exceptions, arbitrary labels, identifiers or input values.
    result.recoveryDuration = unavailable(); result.dataLossWindow = unavailable()
    result.comparisonStatus = 'invalid'; result.bindingConsistent = false
    return fail('invalid-input')
  }
}
