import {decodeDoctorMobileContext, type DoctorMobileContext, type DoctorMobileIdentity, type DoctorMobileSelection} from '@building-suit/contracts'

export interface NativeContextChoice {
  context: DoctorMobileContext
  practiceName: string
  doctorName: string
  locationName: string
}
export interface NativeContextPort {
  list(identity: DoctorMobileIdentity, signal: AbortSignal): Promise<NativeContextChoice[]>
  resolve(choice: NativeContextChoice, identity: DoctorMobileIdentity, signal: AbortSignal): Promise<NativeContextChoice>
}
export interface NativeContextState {
  phase: 'signed-out' | 'loading' | 'choosing' | 'switching' | 'ready' | 'error'
  options: NativeContextChoice[]
  current: NativeContextChoice | null
  pending: string | null
  error: 'unavailable' | 'denied' | 'cleanup' | null
}
export const nativeContextState = (): NativeContextState => ({phase: 'signed-out', options: [], current: null, pending: null, error: null})
export const nativeContextId = (selection: DoctorMobileSelection) => `${selection.doctorId}:${selection.practiceId}:${selection.locationId}`
const actorKey = (actor: DoctorMobileIdentity | null) => actor ? `${actor.environment}:${actor.userId}:${actor.sessionId}` : null
export function nativeContextChoice(raw: NativeContextChoice, identity: DoctorMobileIdentity): NativeContextChoice {
  const context = decodeDoctorMobileContext(raw?.context, identity, raw?.context)
  for (const value of [raw.practiceName, raw.doctorName, raw.locationName]) {
    if (typeof value !== 'string' || !value.trim() || value.length > 200 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Context unavailable')
  }
  return {context, practiceName: raw.practiceName, doctorName: raw.doctorName, locationName: raw.locationName}
}

/** Choices are memory-only projections of current server grants, never authority. */
export function createNativeContext(port: NativeContextPort | null, identity: () => DoctorMobileIdentity | null,
  state = nativeContextState(), clearProtected: () => void | Promise<void> = () => {}, dirty: () => boolean = () => false) {
  let generation = 0, controller = new AbortController()
  function invalidate() {
    generation++; controller.abort(); controller = new AbortController()
    state.current = null; state.pending = null
    return Promise.resolve().then(clearProtected)
  }
  async function clear() {
    const cleanup = invalidate(); state.options = []; state.phase = 'signed-out'; state.error = null
    try { await cleanup } catch { state.phase = 'error'; state.error = 'cleanup' }
  }
  async function choose(id: string, confirmed = false): Promise<boolean> {
    const option = state.options.find(item => nativeContextId(item.context) === id)
    if (!option || !identity()) return false
    if (!confirmed && dirty()) { state.pending = id; return false }
    const cleanup = invalidate(), revision = generation, actor = identity(), key = actorKey(actor)
    state.phase = 'switching'; state.error = null
    try {
      await cleanup
      if (revision !== generation || actorKey(identity()) !== key || !actor || !port) return false
      const result = nativeContextChoice(await port.resolve(option, actor, AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])), actor)
      if (revision !== generation || actorKey(identity()) !== key) return false
      if (nativeContextId(result.context) !== id) throw new Error('Context mismatch')
      state.current = result; state.phase = 'ready'; return true
    } catch (error) {
      if (revision === generation && actorKey(identity()) === key) {
        state.phase = 'error'; state.error = error && typeof error === 'object' && 'code' in error && error.code === '42501' ? 'denied' : 'unavailable'
      }
      return false
    }
  }
  async function refresh(): Promise<boolean> {
    const actor = identity(), key = actorKey(actor), revision = generation
    if (!actor || !port) { await clear(); return false }
    if (!state.current) state.phase = 'loading'
    try {
      const result = await port.list(actor, AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]))
      if (revision !== generation || actorKey(identity()) !== key) return false
      if (!Array.isArray(result) || result.length > 200) throw new Error('Context unavailable')
      const options = result.map(item => nativeContextChoice(item, actor))
      if (new Set(options.map(item => nativeContextId(item.context))).size !== options.length) throw new Error('Duplicate scope')
      const previous = state.current
      state.options = options; state.error = null
      if (previous) {
        const retained = options.find(item => nativeContextId(item.context) === nativeContextId(previous.context))
        if (retained && JSON.stringify(retained) === JSON.stringify(previous)) return true
        await invalidate()
        if (generation !== revision + 1 || actorKey(identity()) !== key) return false
        state.phase = 'choosing'
        // Revocation or changed grants never silently selects another scope.
        return false
      }
      state.phase = 'choosing'; return true
    } catch {
      if (revision === generation && actorKey(identity()) === key) {
        await clear(); state.phase = 'error'; state.error = 'unavailable'
      }
      return false
    }
  }
  return {state, clear, refresh, choose, confirm: () => state.pending ? choose(state.pending, true) : Promise.resolve(false), cancel: () => { state.pending = null },
    selection: (): DoctorMobileSelection | null => state.phase === 'ready' && state.current && identity() ? {...state.current.context} : null}
}
