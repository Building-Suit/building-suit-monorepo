import { validDoctorAuditQuery,type DoctorAuditQuery,type DoctorAuditScope,type DoctorAuditResult } from './administrativeAudit.ts'
import type { doctorAuditRepository } from './auditRepository'
export interface DoctorAuditState { result: DoctorAuditResult|null; pending: boolean; error: 'denied'|'unavailable'|'invalid'|'network'|null }
export function doctorAuditState(): DoctorAuditState { return { result: null,pending: false,error: null } }
export function createDoctorAuditController(repository: ReturnType<typeof doctorAuditRepository>|null,state: DoctorAuditState,scope: () => DoctorAuditScope|null) {
  let generation = 0;let controller = new AbortController()
  function clear() { generation++;controller.abort();controller = new AbortController();Object.assign(state,doctorAuditState()) }
  async function load(query: DoctorAuditQuery = { search: '',page: 0 }) {
    clear();const captured = generation;const current = scope();const value = { ...query }
    if(!current || !repository) { state.error = current ? 'unavailable' : 'denied';return false }
    if(!validDoctorAuditQuery(value)) { state.error = 'invalid';return false }
    state.pending = true;const signal = AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])
    try {
      const result = await repository.load({ ...current },value,signal)
      if(captured!==generation || current.key!==scope()?.key || signal.aborted)return false
      if(result.page!==value.page)throw { code: '22023' }
      state.result = result;return true
    } catch(error) {
      if(captured!==generation || current.key!==scope()?.key)return false
      const code = error && typeof error==='object' && 'code'in error ? String(error.code) : ''
      state.result = null;state.error = code==='42501' ? 'denied' : code==='22023' ? 'invalid' : 'network';return false
    } finally { if(captured===generation && current.key===scope()?.key)state.pending = false }
  }
  return { state,clear,load }
}
