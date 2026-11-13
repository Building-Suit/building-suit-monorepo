// DOS-M7-007: bounded, process-local synthetic observation. No transport,
// identifiers, request/error objects, timestamps, payloads or retention policy.
export const doctorFileSignals = Object.freeze([
  'documents.session_rejected', 'documents.access_rejected', 'documents.unavailable',
  'payment_evidence.session_rejected', 'payment_evidence.access_rejected', 'payment_evidence.unavailable',
] as const)
export type DoctorFileSignal = typeof doctorFileSignals[number]
export type DoctorFileSurface = 'documents' | 'payment_evidence'
export type DoctorFileObserver = (signal: DoctorFileSignal) => unknown
export const doctorOperationalSignals = Object.freeze([
  ...doctorFileSignals,
  'outbox.queued_observed', 'outbox.claimed_observed', 'outbox.sent_observed',
  'outbox.delivered_synthetic_observed', 'outbox.failed_observed', 'outbox.unknown_observed',
  'outbox.access_rejected', 'outbox.unavailable',
  'saas_reconciliation.unknown_observed', 'saas_reconciliation.discrepancy_observed',
  'practice_money.pending_observed', 'practice_money.unknown_observed',
  'practice_money.failed_observed', 'practice_money.posted_synthetic_observed',
  'recovery.fixture_completed', 'recovery.fixture_failed',
] as const)
export type DoctorOperationalSignal = typeof doctorOperationalSignals[number]
export type DoctorOperationalObserver = (signal: DoctorOperationalSignal) => unknown

function emit<Signal extends DoctorOperationalSignal>(observer: ((signal: Signal) => unknown) | undefined, signal: Signal): void {
  if (!observer || !doctorOperationalSignals.includes(signal)) return
  try { void Promise.resolve(observer(signal)).catch(() => undefined) }
  catch { /* Observation never decides the business outcome. */ }
}
export function observeDoctorOperation(observer: DoctorOperationalObserver | undefined, signal: DoctorOperationalSignal): void {
  emit(observer, signal)
}

// Observes the existing disposable restore execution, not approved operational
// recovery, RPO/RTO attainment or hosted restoration. Preserve the original error.
export async function observeDoctorSyntheticRecovery(operation: () => Promise<void>, observer?: DoctorOperationalObserver): Promise<void> {
  try { await operation() }
  catch (error) { observeDoctorOperation(observer, 'recovery.fixture_failed'); throw error }
  observeDoctorOperation(observer, 'recovery.fixture_completed')
}

// Observation never decides the request outcome. The handler supplies only its
// already-sanitized HTTP status; unknown faults are availability signals, not
// claims of a storage outage, security breach or rejected financial settlement.
export function observeDoctorFileFailure(observer: DoctorFileObserver | undefined, surface: DoctorFileSurface, status: number): void {
  if (!observer) return
  const outcome = status === 401 ? 'session_rejected' : status === 403 ? 'access_rejected' : status === 503 ? 'unavailable' : null
  if (!outcome || (surface !== 'documents' && surface !== 'payment_evidence')) return
  emit(observer, `${surface}.${outcome}`)
}

function signalBuffer<Signal extends DoctorOperationalSignal>(signals: readonly Signal[], schema: string) {
  const counts = new Map<Signal, number>()
  // Bounded diagnostic counter, not an incident threshold or service objective.
  const maximum = 65535
  let saturated = false
  const record = (signal: Signal) => {
    // Runtime validation does not coerce objects or call untrusted toString.
    if (typeof signal !== 'string' || !signals.includes(signal)) return false
    const previous = counts.get(signal) ?? 0
    if (previous === maximum) { saturated = true; return false }
    counts.set(signal, previous + 1)
    return true
  }
  return Object.freeze({
    record,
    snapshot: () => Object.freeze({
      schema,
      scope: 'process_local_synthetic_observation' as const,
      hostedTelemetry: false as const,
      externalDelivery: false as const,
      saturated,
      counts: Object.freeze(signals.map(signal => Object.freeze({ signal, count: counts.get(signal) ?? 0 }))),
    }),
    clear: () => { counts.clear(); saturated = false },
  })
}
export const createDoctorFileSignalBuffer = () => signalBuffer(doctorFileSignals, 'doctor.file-signals.v1')
export const createDoctorOperationalSignalBuffer = () => signalBuffer(doctorOperationalSignals, 'doctor.operational-signals.v1')
