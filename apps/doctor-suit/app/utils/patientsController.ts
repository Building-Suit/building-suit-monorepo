import { doctorScopeKey,type DoctorContextScope } from './contextScope.ts'
import { doctorPatientForm,doctorPatientToday,validDoctorPatientForm,type DoctorPatientDirectory,type DoctorPatientDuplicates,type DoctorPatientForm,type DoctorPatientQuery,type DoctorPatientRow } from './patients.ts'
import type { doctorPatientsRepository } from './patientsRepository'
export type DoctorPatientError = 'denied' | 'invalid' | 'conflict' | 'archived' | 'review' | 'network' | null
export interface DoctorPatientsState { loading: boolean; pending: boolean; directory: DoctorPatientDirectory | null; duplicates: DoctorPatientDuplicates | null; error: DoctorPatientError }
export function doctorPatientsState(): DoctorPatientsState { return { loading: false,pending: false,directory: null,duplicates: null,error: null } }
export function doctorPatientFailure(error: unknown): DoctorPatientError {
  const code = error && typeof error==='object' && 'code' in error ? String(error.code) : ''
  const message = error && typeof error==='object' && 'message' in error ? String(error.message) : ''
  if (code==='42501') return 'denied'
  if (code==='40001') return message==='DOCTOR_PATIENT_DUPLICATE_REVIEW' ? 'review' : 'conflict'
  if (code==='22023') return message==='DOCTOR_PATIENT_ARCHIVED' ? 'archived' : 'invalid'
  return 'network'
}
export function createDoctorPatientsController(repository: ReturnType<typeof doctorPatientsRepository> | null,state: DoctorPatientsState,
  scope: () => (DoctorContextScope & { timezone: string }) | null,key = () => crypto.randomUUID(),today = doctorPatientToday) {
  let generation = 0; let controller = new AbortController()
  let command: { fingerprint: string; key: string; reviewKey: string | null } | null = null
  let reviewInput: string | null = null
  const scopeKey = () => { const selected = scope(); return selected ? doctorScopeKey(selected,'patients') : null }
  const accepts = (revision: number,expected: string | null) => revision===generation && expected===scopeKey()
  function discard() { command = null; reviewInput = null; state.duplicates = null; state.error = null }
  function clear() { generation++; controller.abort(); controller = new AbortController(); discard(); Object.assign(state,doctorPatientsState()) }
  async function load(query: DoctorPatientQuery) {
    if (state.pending) return false
    generation++; controller.abort(); controller = new AbortController()
    const revision = generation; const expected = scopeKey(); const selected = scope()
    state.directory = null; state.loading = true; state.error = null
    if (!selected?.locationId || !repository) { state.loading = false; state.error = 'denied'; return false }
    try {
      const result = await repository.load(selected.practiceId,selected.locationId,{ ...query },AbortSignal.any([controller.signal,AbortSignal.timeout(10000)]))
      if (!accepts(revision,expected)) return false
      state.directory = result; return true
    } catch (error) { if (accepts(revision,expected)) state.error = doctorPatientFailure(error); return false }
    finally { if (accepts(revision,expected)) state.loading = false }
  }
  function fingerprint(row: DoctorPatientRow | null,form: DoctorPatientForm | null) { return JSON.stringify([scopeKey(),row?.id,row?.version,form && doctorPatientForm(form)]) }
  function changed(row: DoctorPatientRow | null,form: DoctorPatientForm) {
    if (fingerprint(row,form)!==reviewInput) { state.duplicates = null; reviewInput = null; if (state.error==='review') state.error = null }
    if (command && command.fingerprint!==JSON.stringify(['write',fingerprint(row,form)])) command = null
  }
  async function mutate(kind: 'write' | 'archive',row: DoctorPatientRow | null,raw: DoctorPatientForm | null,acknowledged: boolean) {
    if (state.pending || state.loading) return false
    const selected = scope(); const expected = scopeKey(); const revision = generation; const directory = state.directory
    if (!selected?.locationId || !repository || !directory?.canWrite
      || (row && (row.practiceId!==selected.practiceId || row.archivedAt || !directory.rows.some(item => item.id===row.id && item.version===row.version)))) {
      state.error = 'denied'; return false
    }
    const form = raw && doctorPatientForm(raw)
    if (kind==='write' && (!form || !validDoctorPatientForm(form,today(selected.timezone)))) { state.error = 'invalid'; return false }
    state.pending = true; state.error = null
    const material = fingerprint(row,form); const intent = JSON.stringify([kind,material])
    const signal = AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])
    try {
      if (command?.fingerprint!==intent) {
        let reviewKey: string | null = null
        if (kind==='write') {
          if (reviewInput!==material) {
            const duplicates = await repository.duplicates(selected.practiceId,selected.locationId,form!,row,signal)
            if (!accepts(revision,expected)) return false
            state.duplicates = duplicates; reviewInput = material
            // Every newly fetched matching set requires an explicit second submit.
            if (duplicates.total>0) { state.error = 'review'; return false }
          }
          if (state.duplicates && state.duplicates.total>0) {
            if (!acknowledged) { state.error = 'review'; return false }
            reviewKey = state.duplicates.reviewKey
          }
        }
        command = { fingerprint: intent,key: key(),reviewKey }
      }
      const current = command!
      if (kind==='write') await repository.write(selected.practiceId,selected.locationId,form!,row,current.key,current.reviewKey,signal)
      else await repository.archive(selected.practiceId,selected.locationId,row!,current.key,signal)
      if (!accepts(revision,expected)) return false
      discard(); return true
    } catch (error) {
      if (accepts(revision,expected)) {
        state.error = doctorPatientFailure(error)
        // Unknown transport outcomes retain the exact command, including reviewed
        // evidence, so a committed create is not mistaken for its own duplicate.
        if (state.error!=='network') command = null
        if (state.error==='review') { state.duplicates = null; reviewInput = null }
      }
      return false
    } finally { if (accepts(revision,expected)) state.pending = false }
  }
  return { state,clear,discard,load,changed,
    write: (row: DoctorPatientRow | null,form: DoctorPatientForm,acknowledged = false) => mutate('write',row,form,acknowledged),
    archive: (row: DoctorPatientRow) => mutate('archive',row,null,false),
  }
}
