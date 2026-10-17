import type { DoctorIdentity } from './authController'
import type { doctorAccountRepository } from './accountRepository'
import { validDoctorAccountForm,type DoctorAccountForm,type DoctorAccountSettings } from './accountSettings.ts'
export type DoctorAccountError = 'session'|'unavailable'|'denied'|'invalid'|'conflict'|'network'|'reauthenticate'|null
export interface DoctorAccountState { settings: DoctorAccountSettings|null; pending: boolean; error: DoctorAccountError; saved: boolean }
export function doctorAccountState(): DoctorAccountState { return { settings: null,pending: false,error: null,saved: false } }
export function createDoctorAccountController(repository: ReturnType<typeof doctorAccountRepository>|null,state: DoctorAccountState,identity: () => DoctorIdentity|null,environment: string,key: () => string = () => crypto.randomUUID()) {
  let generation = 0;let controller = new AbortController();let attempt: { material: string;key: string }|null = null
  const scope = () => { const actor = identity();return actor ? JSON.stringify(['doctor-suit',environment,actor.userId,actor.sessionId]) : null }
  function clear() { generation++;controller.abort();controller = new AbortController();attempt = null;Object.assign(state,doctorAccountState()) }
  async function perform(operation: (signal: AbortSignal) => Promise<DoctorAccountSettings>,saving: boolean) {
    if(state.pending)return false
    const captured = generation;const actor = scope()
    if(!actor || !repository) { clear();state.error = actor ? 'unavailable' : 'session';return false }
    const signal = AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])
    state.pending = true;state.error = null;state.saved = false
    try {
      const result = await operation(signal)
      if(captured!==generation || actor!==scope() || signal.aborted)return false
      state.settings = result;state.saved = saving && result.inAppConfirmations
      if(saving)attempt = null
      return true
    } catch(error) {
      if(captured!==generation || actor!==scope())return false
      const code = error && typeof error==='object' && 'code' in error ? String(error.code) : ''
      if(code==='42501') { clear();state.error = 'denied' }
      else state.error = code==='28000' ? 'reauthenticate' : code==='40001' ? 'conflict' : ['22023','23514'].includes(code) ? 'invalid' : 'network'
      return false
    } finally { if(captured===generation && actor===scope())state.pending = false }
  }
  return { state,clear,load: () => perform(signal => repository!.load(signal),false),
    update(form: DoctorAccountForm) {
      const version = state.settings?.version;const value = { ...form }
      return perform(signal => {
        if(version===undefined || !validDoctorAccountForm(value))throw { code: '22023' }
        const material = JSON.stringify([scope(),version,value.personalName,value.contactPhone,value.inAppConfirmations])
        if(attempt?.material!==material)attempt = { material,key: key() }
        return repository!.update(value,version,attempt.key,signal)
      },true)
    },
  }
}
