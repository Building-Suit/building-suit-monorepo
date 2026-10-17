import { createDoctorEntitlementDeadline,doctorEntitlementKey,type DoctorEntitlementTimers } from './entitlement.ts'
import { doctorScopeKey, type DoctorContextScope } from './contextScope.ts'
import { validDoctorLocationForm, type DoctorLocationDirectory, type DoctorLocationForm, type DoctorLocationQuery, type DoctorLocationRow } from './locations.ts'
import type { doctorLocationsRepository } from './locationsRepository'
export type DoctorLocationError = 'denied' | 'invalid' | 'conflict' | 'dependencies' | 'network' | null
export interface DoctorLocationsState { loading: boolean; pending: boolean; directory: DoctorLocationDirectory | null; error: DoctorLocationError }
export function doctorLocationsState(): DoctorLocationsState { return { loading: false, pending: false, directory: null, error: null } }
export function doctorLocationFailure(error: unknown): DoctorLocationError {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
  if (['42501','DS001','DS002','DS003','DS006','DS007'].includes(code)) return 'denied'
  if (code === '23503') return 'dependencies'
  if (['22023', '23514'].includes(code)) return 'invalid'
  if (['40001', '23505'].includes(code)) return 'conflict'
  return 'network'
}
export function createDoctorLocationsController(repository: ReturnType<typeof doctorLocationsRepository> | null, state: DoctorLocationsState, scope: () => DoctorContextScope | null, key = () => crypto.randomUUID(),timers?: DoctorEntitlementTimers,onExpired?: ()=>void) {
  const expiry=createDoctorEntitlementDeadline(timers);const policyListeners=new Set<()=>void>();let policy: string|null=null
  let generation = 0; let controller = new AbortController()
  let command: { input: string; key: string } | null = null
  const scopeKey = () => { const value = scope(); return value ? doctorScopeKey(value, 'locations') : null }
  function clear() { expiry.clear();policy=null;generation++; controller.abort(); controller = new AbortController(); command = null; Object.assign(state, doctorLocationsState()) }
  async function load(query: DoctorLocationQuery) {
    if (state.pending) return false
    generation++; controller.abort(); controller = new AbortController()
    const captured = generation; const selected = scope(); const expectedScope = scopeKey()
    state.directory = null; state.loading = true; state.error = null
    if (!selected || !repository) { state.loading = false; state.error = 'denied'; return false }
    try {
      const sentAt=timers?.now()??0
      const result = await repository.load(selected.practiceId, { ...query }, AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]))
      if (captured !== generation || expectedScope !== scopeKey()) return false
      if(selected.edition==='administrative_candidate' && (result.edition!=='administrative_candidate' || !result.entitlement))throw {code:'42501'}
      const nextPolicy=JSON.stringify([result.edition,doctorEntitlementKey(result.entitlement)])
      if(policy && policy!==nextPolicy)for(const listener of policyListeners)listener()
      policy=nextPolicy;state.directory = result
      expiry.arm(result.entitlement,sentAt,()=>{for(const listener of policyListeners)listener();clear();onExpired?.();if(expectedScope===scopeKey())void load({...query})},()=>captured===generation && expectedScope===scopeKey())
      return true
    } catch (error) { if (captured === generation && expectedScope === scopeKey()) state.error = doctorLocationFailure(error); return false }
    finally { if (captured === generation && expectedScope === scopeKey()) state.loading = false }
  }
  async function mutate(kind: 'write' | 'archive', row: DoctorLocationRow | null, form: DoctorLocationForm | null) {
    if (state.pending) return false
    const selected = scope(); const expectedScope = scopeKey(); const captured = generation
    if (!selected || !repository || !state.directory || (row && (row.practiceId !== selected.practiceId || !row.canManage || row.archivedAt))
      || (!row && !state.directory.canCreate)) { state.error = 'denied'; return false }
    if(kind==='write' && (state.directory.entitlement?.writesAllowed===false || row?.canEdit===false)){state.error='denied';return false}
    if (kind === 'write' && (!form || !validDoctorLocationForm(form))) { state.error = 'invalid'; return false }
    state.pending = true; state.error = null
    const input = JSON.stringify([expectedScope, kind, row?.id, row?.version, form])
    if (command?.input !== input) command = { input, key: key() }
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])
    try {
      if (kind === 'archive') await repository.archive(selected.practiceId, row!, command.key, signal)
      else await repository.write(selected.practiceId, row, { ...form! }, command.key, signal)
      const accepted = captured === generation && expectedScope === scopeKey()
      if (accepted) command = null
      return accepted
    } catch (error) { if (captured === generation && expectedScope === scopeKey()) state.error = doctorLocationFailure(error); return false }
    finally { if (captured === generation && expectedScope === scopeKey()) state.pending = false }
  }
  return { state, clear, load,registerPolicyChange:(listener:()=>void)=>{policyListeners.add(listener);return()=>{policyListeners.delete(listener)}}, write: (row: DoctorLocationRow | null, form: DoctorLocationForm) => mutate('write', row, form), archive: (row: DoctorLocationRow) => mutate('archive', row, null) }
}
