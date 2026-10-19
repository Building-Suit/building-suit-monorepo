import { doctorScopeKey } from './contextScope.ts'
import type { DoctorLocationContext } from './locationContext.ts'
import { doctorScheduleInput,validDoctorSchedule,doctorScheduleDate,type DoctorSchedule,type DoctorScheduleInput,type DoctorAvailability } from './availability.ts'
import { doctorPatientFailure,type DoctorPatientError } from './patientsController.ts'
import type { doctorAvailabilityRepository } from './availabilityRepository'
export interface DoctorAvailabilityState { config: DoctorSchedule | null; slots: DoctorAvailability | null; loading: boolean; slotsLoading: boolean; pending: boolean; error: DoctorPatientError; slotsError: DoctorPatientError; actionError: DoctorPatientError }
export const doctorAvailabilityState = (): DoctorAvailabilityState => ({ config: null,slots: null,loading: false,slotsLoading: false,pending: false,error: null,slotsError: null,actionError: null })
export function createDoctorAvailabilityController(repository: ReturnType<typeof doctorAvailabilityRepository> | null,state: DoctorAvailabilityState,scope: () => DoctorLocationContext | null,key = () => crypto.randomUUID()) {
  let generation = 0; let slotRevision = 0; let controller = new AbortController(); let command: { material: string; key: string } | null = null
  const scopeKey = () => { const selected = scope(); return selected ? doctorScopeKey(selected,'availability') : null }
  const capture = () => ({ revision: generation,key: scopeKey() }); const accepts = (value: ReturnType<typeof capture>) => value.revision===generation && value.key===scopeKey()
  const signal = () => AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])
  function clear() { generation++; slotRevision++; controller.abort(); controller = new AbortController(); command = null; Object.assign(state,doctorAvailabilityState()) }
  function discard() { command = null; state.actionError = null }
  function version(config: DoctorSchedule) { const selected = scope(); if (!selected || config.locationVersion!==selected.locationVersion || config.timezone!==selected.timezone) throw { code: '40001' } }
  function failure(error: unknown) { const result = doctorPatientFailure(error); if (result==='denied') { state.config = null; state.slots = null; command = null } return result }
  async function slots(date: string) {
    if (state.pending) return false
    const expected = capture(); const selected = scope(); const revision = ++slotRevision; state.slots = null; state.slotsError = null; state.slotsLoading = true
    if (!repository || !selected || !doctorScheduleDate(date)) { state.slotsLoading = false; state.slotsError = 'invalid'; return false }
    try {
      const result = await repository.slots(selected.practiceId,selected.locationId,date,signal())
      if (!accepts(expected) || revision!==slotRevision) return false
      if (result.locationVersion!==selected.locationVersion || result.timezone!==selected.timezone || (state.config && result.scheduleVersion!==state.config.version)) throw { code: '40001' }
      state.slots = result; return true
    } catch (error) { if (accepts(expected) && revision===slotRevision) state.slotsError = failure(error); return false }
    finally { if (accepts(expected) && revision===slotRevision) state.slotsLoading = false }
  }
  async function load() {
    if (state.pending) return false
    clear(); const expected = capture(); const selected = scope(); state.loading = true
    if (!repository || !selected) { state.loading = false; state.error = 'denied'; return false }
    try { const result = await repository.load(selected.practiceId,selected.locationId,signal()); if (!accepts(expected)) return false; version(result); state.config = result; return true }
    catch (error) { if (accepts(expected)) state.error = failure(error); return false }
    finally { if (accepts(expected)) state.loading = false }
  }
  async function write(raw: DoctorScheduleInput,expectedVersion: number) {
    if (state.pending || state.loading) return false
    const selected = scope(); const config = state.config; const expected = capture()
    if (!repository || !selected || !config?.canManage || !selected.capabilities.includes('availability.manage')) { state.actionError = 'denied'; return false }
    if (config.locationVersion!==selected.locationVersion || config.timezone!==selected.timezone || config.version!==expectedVersion) { state.actionError = 'conflict'; return false }
    if (!validDoctorSchedule(raw)) { state.actionError = 'invalid'; return false }
    const input = doctorScheduleInput(raw); const material = JSON.stringify([scopeKey(),expectedVersion,config.locationVersion,input]); if (command?.material!==material) command = { material,key: key() }
    state.pending = true; state.actionError = null
    try { const result = await repository.write(selected.practiceId,selected.locationId,expectedVersion,config.locationVersion,input,command.key,signal()); if (!accepts(expected)) return false; version(result); state.config = result; state.slots = null; discard(); return true }
    catch (error) { if (accepts(expected)) { state.actionError = failure(error); if (state.actionError!=='network') command = null } return false }
    finally { if (accepts(expected)) state.pending = false }
  }
  return { state,clear,discard,scopeKey,load,slots,write }
}
