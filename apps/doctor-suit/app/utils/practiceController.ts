import type { DoctorIdentity } from './authController'
import type { doctorPracticeRepository } from './practiceRepository'
import { validDoctorSetupForm, type DoctorPracticeSetup, type DoctorSetupForm } from './practiceSetup.ts'
export type DoctorPracticeError = 'session' | 'unavailable' | 'denied' | 'invalid' | 'conflict' | 'network' | null
export interface DoctorPracticeState { phase: 'idle' | 'loading' | 'ready' | 'denied' | 'error'; pending: boolean; setup: DoctorPracticeSetup | null; error: DoctorPracticeError; saved: boolean }
export function doctorPracticeState(): DoctorPracticeState { return { phase: 'idle', pending: false, setup: null, error: null, saved: false } }
function failure(error: unknown): DoctorPracticeError {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  if (code === '42501') return 'denied'
  if (['40001', '23505', 'P0002'].includes(code)) return 'conflict'
  if (['22023', '23514'].includes(code)) return 'invalid'
  return 'network'
}
export function createDoctorPracticeController(repository: ReturnType<typeof doctorPracticeRepository> | null, state: DoctorPracticeState, session: () => DoctorIdentity | null, key: () => string = () => crypto.randomUUID()) {
  let generation = 0
  let controller = new AbortController()
  let draftKey: string | null = null
  let updateKey: { request: string; key: string } | null = null
  const scope = () => { const actor = session(); return actor ? JSON.stringify([actor.userId, actor.sessionId, actor.practiceId]) : null }
  function clear() { generation++; controller.abort(); controller = new AbortController(); draftKey = null; updateKey = null; Object.assign(state, doctorPracticeState()) }
  async function perform(operation: (signal: AbortSignal) => Promise<boolean>) {
    if (state.pending) return false
    const actor = scope()
    if (!actor || !repository) { state.setup = null; state.phase = 'error'; state.error = actor ? 'unavailable' : 'session'; return false }
    const captured = generation
    state.pending = true; state.error = null; state.saved = false
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
    try {
      const result = await operation(signal)
      if (captured !== generation || actor !== scope()) return false
      state.phase = state.setup?.enrollment === 'delegated-only' ? 'denied' : 'ready'
      return result
    } catch (error) {
      if (captured === generation && actor === scope()) { state.error = failure(error); state.phase = state.error === 'denied' ? 'denied' : 'error' }
      return false
    } finally { if (captured === generation && actor === scope()) state.pending = false }
  }
  async function save(form: DoctorSetupForm, signal: AbortSignal) {
    if (!state.setup || state.setup.enrollment !== 'owner' || state.setup.practice) throw { code: '42501' }
    if (!validDoctorSetupForm(form)) throw { code: '22023' }
    const snapshot = state.setup
    const captured = generation
    const actor = scope()
    draftKey ||= snapshot.draft?.commandKey || key()
    const draft = await repository!.save({ ...form }, draftKey, snapshot.draft?.version || 0, signal)
    if (captured !== generation || actor !== scope() || signal.aborted) return false
    state.setup = { ...snapshot, draft }; state.saved = true
    return true
  }
  return {
    state, clear,
    load() {
      return perform(async signal => {
        const captured = generation
        const actor = scope()
        state.phase = 'loading'; state.setup = null
        const result = await repository!.load(signal)
        if (captured !== generation || actor !== scope() || signal.aborted) return false
        state.setup = result; draftKey = result.draft?.commandKey || null
        return true
      })
    },
    saveDraft(form: DoctorSetupForm) { return perform(signal => save(form, signal)) },
    complete(form: DoctorSetupForm) {
      return perform(async signal => {
        if (!validDoctorSetupForm(form, true)) throw { code: '22023' }
        if (!await save(form, signal)) return false
        const draft = state.setup!.draft!
        await repository!.complete(draft.commandKey, draft.version, signal)
        return true
      })
    },
    updateProfile(form: DoctorSetupForm) {
      return perform(async signal => {
        const practice = state.setup?.practice
        if (!practice || state.setup?.enrollment !== 'owner') throw { code: '42501' }
        if (!validDoctorSetupForm(form, true, true)) throw { code: '22023' }
        const request = JSON.stringify([practice.id, practice.version, form.displayName, form.practiceName])
        if (updateKey?.request !== request) updateKey = { request, key: key() }
        await repository!.update(practice, { ...form }, updateKey.key, signal)
        return true
      })
    },
  }
}
