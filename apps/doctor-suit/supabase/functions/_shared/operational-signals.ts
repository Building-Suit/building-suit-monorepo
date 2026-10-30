// DOS-M7-007: bounded, process-local synthetic observation. No transport,
// identifiers, request/error objects, timestamps, payloads or retention policy.
export const doctorFileSignals = Object.freeze([
  'documents.session_rejected', 'documents.access_rejected', 'documents.unavailable',
  'payment_evidence.session_rejected', 'payment_evidence.access_rejected', 'payment_evidence.unavailable',
] as const)
export type DoctorFileSignal = typeof doctorFileSignals[number]
export type DoctorFileSurface = 'documents' | 'payment_evidence'
export type DoctorFileObserver = (signal: DoctorFileSignal) => unknown

// Observation never decides the request outcome. The handler supplies only its
// already-sanitized HTTP status; unknown faults are availability signals, not
// claims of a storage outage, security breach or rejected financial settlement.
export function observeDoctorFileFailure(observer: DoctorFileObserver | undefined, surface: DoctorFileSurface, status: number): void {
  if (!observer) return
  const outcome = status === 401 ? 'session_rejected' : status === 403 ? 'access_rejected' : status === 503 ? 'unavailable' : null
  if (!outcome || (surface !== 'documents' && surface !== 'payment_evidence')) return
  try {
    // Contain both synchronous observer errors and asynchronous rejection. Never
    // await telemetry or retry a business operation because observation failed.
    void Promise.resolve(observer(`${surface}.${outcome}`)).catch(() => undefined)
  } catch { /* Observation must not change authorization or delivery. */ }
}

export function createDoctorFileSignalBuffer() {
  const counts = new Map<DoctorFileSignal, number>()
  // Bounded diagnostic counter, not an incident threshold or service objective.
  const maximum = 65535
  let saturated = false
  const record: DoctorFileObserver = (signal) => {
    // Runtime validation does not coerce objects or call untrusted toString.
    if (typeof signal !== 'string' || !doctorFileSignals.includes(signal)) return false
    const previous = counts.get(signal) ?? 0
    if (previous === maximum) { saturated = true; return false }
    counts.set(signal, previous + 1)
    return true
  }
  return Object.freeze({
    record,
    snapshot: () => Object.freeze({
      schema: 'doctor.file-signals.v1' as const,
      scope: 'process_local_synthetic_observation' as const,
      hostedTelemetry: false as const,
      externalDelivery: false as const,
      saturated,
      counts: Object.freeze(doctorFileSignals.map(signal => Object.freeze({ signal, count: counts.get(signal) ?? 0 }))),
    }),
    clear: () => { counts.clear(); saturated = false },
  })
}
