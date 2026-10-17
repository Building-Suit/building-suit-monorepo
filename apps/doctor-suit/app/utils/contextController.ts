import { createDoctorContextLifecycle, type DoctorContextScope } from './contextScope.ts'
import { doctorContextId, doctorContextPreference, doctorLocationContext, doctorLocationContexts, type DoctorLocationContext, type DoctorContextPreference } from './locationContext.ts'
import type { DoctorIdentity } from './authController'
import type { doctorContextRepository } from './contextRepository'
export type DoctorContextError = 'session' | 'unavailable' | 'denied' | 'stale' | 'network' | 'cleanup' | null
export interface DoctorContextState {
  phase: 'idle' | 'loading' | 'choosing' | 'switching' | 'ready' | 'error'
  options: DoctorLocationContext[]
  current: DoctorLocationContext | null
  error: DoctorContextError
}
export function doctorContextState(): DoctorContextState { return { phase: 'idle', options: [], current: null, error: null } }
function failure(error: unknown): DoctorContextError {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  if (code === '42501') return 'denied'
  if (code === '40001') return 'stale'
  if (error instanceof Error && error.message === 'DOCTOR_CONTEXT_CLEANUP_FAILED') return 'cleanup'
  return 'network'
}
export function createDoctorContextController(repository: ReturnType<typeof doctorContextRepository> | null, state: DoctorContextState,
  actor: () => DoctorIdentity | null, environment: DoctorContextScope['environment'], preferences: { read(): unknown; write(value: DoctorContextPreference | null): void }) {
  const lifecycle = createDoctorContextLifecycle()
  let generation = 0
  let controller = new AbortController()
  let initialCleanup = Promise.resolve()
  let requiresSelection = false
  const identity = () => { const value = actor(); return value ? `${value.userId}:${value.sessionId}` : null }
  function invalidate() { generation++; controller.abort(); controller = new AbortController(); state.current = null }
  function clear() {
    invalidate(); requiresSelection = false; state.options = []; state.phase = 'idle'; state.error = null
    refreshFlight = null; refreshQueued = false
    const captured = generation
    initialCleanup = lifecycle.transition(null).catch(() => { if (captured === generation) { state.phase = 'error'; state.error = 'cleanup' } })
    return initialCleanup
  }
  async function choose(value: string): Promise<boolean> {
    const option = state.options.find(item => doctorContextId(item) === value)
    invalidate(); state.phase = 'switching'; state.error = null
    const captured = generation; const expectedActor = identity(); const currentActor = actor()
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])
    try {
      await Promise.all([initialCleanup, lifecycle.transition(null)])
      if (captured !== generation || expectedActor !== identity()) return false
      if (!repository || !currentActor || !option) { state.phase = 'choosing'; state.error = !currentActor ? 'session' : !repository ? 'unavailable' : 'denied'; preferences.write(null); return false }
      const result = doctorLocationContext(await repository.resolve(option.practiceId, option.locationId, option.grantsVersion, signal), currentActor, environment)
      if (captured !== generation || expectedActor !== identity() || signal.aborted) return false
      if (doctorContextId(result) !== value) throw Object.assign(new Error('Context mismatch'), { code: '42501' })
      await lifecycle.transition(result)
      if (captured !== generation || expectedActor !== identity() || signal.aborted) return false
      state.current = result; requiresSelection = false; state.phase = 'ready'
      preferences.write({ userId: currentActor.userId, sessionId: currentActor.sessionId, practiceId: result.practiceId, locationId: result.locationId })
      return true
    } catch (error) {
      if (captured === generation && expectedActor === identity()) { state.current = null; state.error = failure(error); state.phase = 'error'; preferences.write(null) }
      return false
    }
  }
  let refreshFlight: Promise<boolean> | null = null
  let refreshQueued = false
  async function refreshOnce(): Promise<boolean> {
    const captured = generation; const expectedActor = identity(); const currentActor = actor()
    if (!repository || !currentActor) { void clear(); state.error = currentActor ? 'unavailable' : 'session'; state.phase = 'error'; return Promise.resolve(false) }
    if (!state.current) state.phase = 'loading'
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])
    try {
      const options = doctorLocationContexts(await repository.load(signal), currentActor, environment)
      if (captured !== generation || expectedActor !== identity() || signal.aborted) return false
      const previous = state.current
      state.options = options; state.error = null
      if (previous) {
        const retained = options.find(item => doctorContextId(item) === doctorContextId(previous))
        if (retained && JSON.stringify(retained) === JSON.stringify(previous)) { state.phase = 'ready'; return true }
        if (retained) return choose(doctorContextId(retained))
        // A revoked/archived scope must not silently switch to another doctor's context.
        requiresSelection = true
        invalidate(); const invalidated = generation; preferences.write(null); await lifecycle.transition(null)
        if (invalidated === generation && expectedActor === identity()) state.phase = 'choosing'
        return false
      }
      if (requiresSelection) { preferences.write(null); state.phase = 'choosing'; return false }
      const preferred = doctorContextPreference(preferences.read(), currentActor)
      const matching = preferred && options.find(item => doctorContextId(item) === doctorContextId(preferred))
      if (matching) return choose(doctorContextId(matching))
      preferences.write(null)
      if (options.length === 1) return choose(doctorContextId(options[0]!))
      state.phase = 'choosing'; return false
    } catch (error) {
      if (captured === generation && expectedActor === identity()) {
        invalidate(); state.options = []; const invalidated = generation
        let reason = failure(error)
        try { await lifecycle.transition(null) } catch { reason = 'cleanup' }
        if (invalidated === generation && expectedActor === identity()) { state.error = reason; state.phase = 'error' }
      }
      return false
    }
  }
  function refresh(): Promise<boolean> {
    if (refreshFlight) { refreshQueued = true; return refreshFlight }
    // A foreground request made during an older read must observe a new
    // authority snapshot before its caller resumes. Coalesce concurrent callers
    // into one trailing read, and never revive a cleared session's flight.
    const flight: Promise<boolean> = Promise.resolve().then(async () => {
      let result: boolean
      do { refreshQueued = false; result = await refreshOnce() }
      while (refreshQueued && refreshFlight === flight)
      return result
    }).finally(() => { if (refreshFlight === flight) refreshFlight = null })
    refreshFlight = flight
    return flight
  }
  return { state, clear, refresh, choose, forgetPreference: () => preferences.write(null),
    capture(feature: string, query: unknown = null) {
      if (state.phase !== 'ready' || !state.current) throw new Error('DOCTOR_CONTEXT_REQUIRED')
      return lifecycle.capture(feature, query)
    },
    registerClear: lifecycle.registerClear,
  }
}
