import {nativeOperationSignal} from './nativeWebCapabilities.ts'
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
    if (typeof value !== 'string' || !value.trim() || value.length > 200 || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new Error('Context unavailable')
  }
  return {context, practiceName: raw.practiceName, doctorName: raw.doctorName, locationName: raw.locationName}
}

/** Choices are memory-only projections of current server grants, never authority. */
export function createNativeContext(port: NativeContextPort | null, identity: () => DoctorMobileIdentity | null,
  state = nativeContextState(), clearProtected: () => void | Promise<void> = () => {}, dirty: () => boolean = () => false) {
  let generation = 0, controller = new AbortController()
  let cleanupTail = Promise.resolve()
  const clearers = new Set<() => void | Promise<void>>([clearProtected])
  const dirtyReaders = new Set<() => boolean>([dirty])
  function invalidate() {
    generation++; controller.abort(); controller = new AbortController()
    state.current = null; state.pending = null
    const previous = cleanupTail
    const pending = Promise.allSettled([...clearers].map(clear => { try { return Promise.resolve(clear()) } catch (error) { return Promise.reject(error) } }))
    cleanupTail = Promise.all([previous.catch(() => {}), pending]).then(([, results]) => {
      if (results.some(result => result.status === 'rejected')) throw new Error('Context cleanup failed')
    })
    return cleanupTail
  }
  async function clear() {
    const cleanup = invalidate(), revision = generation; state.options = []; state.phase = 'signed-out'; state.error = null
    try { await cleanup } catch { if (revision === generation) { state.phase = 'error'; state.error = 'cleanup' } }
  }
  async function choose(id: string, confirmed = false): Promise<boolean> {
    const option = state.options.find(item => nativeContextId(item.context) === id)
    if (!option || !identity()) return false
    if (!confirmed && [...dirtyReaders].some(read => read())) { state.pending = id; return false }
    const cleanup = invalidate(), revision = generation, actor = identity(), key = actorKey(actor)
    state.phase = 'switching'; state.error = null
    try {
      await cleanup
      if (revision !== generation || actorKey(identity()) !== key || !actor || !port) return false
      const result = nativeContextChoice(await port.resolve(option, actor, nativeOperationSignal(controller.signal)), actor)
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
      const result = await port.list(actor, nativeOperationSignal(controller.signal))
      if (revision !== generation || actorKey(identity()) !== key) return false
      if (!Array.isArray(result) || result.length > 200) throw new Error('Context unavailable')
      const options = result.map(item => nativeContextChoice(item, actor))
      if (new Set(options.map(item => nativeContextId(item.context))).size !== options.length) throw new Error('Duplicate scope')
      const previous = state.current
      state.options = options; state.error = null
      if (previous) {
        const retained = options.find(item => nativeContextId(item.context) === nativeContextId(previous.context))
        if (retained && JSON.stringify(retained) === JSON.stringify(previous)) return true
        const cleanup = invalidate()
        state.phase = 'choosing'
        try { await cleanup } catch { if (generation === revision + 1 && actorKey(identity()) === key) { state.phase = 'error'; state.error = 'cleanup' }; return false }
        if (generation !== revision + 1 || actorKey(identity()) !== key) return false
        state.phase = 'choosing'
        // Revocation or changed grants never silently selects another scope.
        return false
      }
      state.phase = 'choosing'; return true
    } catch {
      if (revision === generation && actorKey(identity()) === key) {
        const cleanup = clear(), cleared = generation
        state.phase = 'error'; state.error = 'unavailable'
        await cleanup
        if (generation !== cleared || actorKey(identity()) !== key) return false
      }
      return false
    }
  }
  return {state, clear, refresh, choose,
    registerClear: (callback: () => void | Promise<void>) => { clearers.add(callback); return () => clearers.delete(callback) },
    registerDirty: (callback: () => boolean) => { dirtyReaders.add(callback); return () => dirtyReaders.delete(callback) }, discardAndChoose: () => state.pending ? choose(state.pending, true) : Promise.resolve(false), cancel: () => { state.pending = null },
    selection: (): DoctorMobileSelection | null => state.phase === 'ready' && state.current && actorKey(state.current.context) === actorKey(identity()) ? {doctorId: state.current.context.doctorId, practiceId: state.current.context.practiceId, locationId: state.current.context.locationId} : null}
}
