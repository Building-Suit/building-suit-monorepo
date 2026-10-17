import { doctorScopeKey,type DoctorContextScope } from './contextScope.ts'
import { doctorUuid } from './locationContext.ts'
import { doctorPatientFailure,type DoctorPatientError } from './patientsController.ts'
import type { doctorPatientProfileRepository,DoctorProfileScope } from './patientProfileRepository'
import type { DoctorPatientProfile,DoctorDocumentDirectory,DoctorDocumentRow,DoctorDocumentVersion,DoctorDocumentHistory } from './patientProfile.ts'
export interface DoctorProfileState { patientId: string | null; profile: DoctorPatientProfile | null; documents: DoctorDocumentDirectory | null; history: DoctorDocumentHistory | null; historyDocumentId: string | null; page: number; size: number; historyPage: number; loading: boolean; documentsLoading: boolean; historyLoading: boolean; pending: boolean; available: boolean; serviceWrite: boolean; file: File | null; replacement: DoctorDocumentRow | null; error: DoctorPatientError; documentsError: DoctorPatientError; historyError: DoctorPatientError; actionError: DoctorPatientError }
export function doctorProfileState(): DoctorProfileState { return { patientId: null,profile: null,documents: null,history: null,historyDocumentId: null,page: 0,size: 20,historyPage: 0,loading: false,documentsLoading: false,historyLoading: false,pending: false,available: false,serviceWrite: false,file: null,replacement: null,error: null,documentsError: null,historyError: null,actionError: null } }
export function createDoctorProfileController(repository: ReturnType<typeof doctorPatientProfileRepository> | null,state: DoctorProfileState,scope: () => DoctorContextScope | null,key = () => crypto.randomUUID()) {
  let generation = 0; let controller = new AbortController(); let documentsRevision = 0; let historyRevision = 0
  let uploadKey: string | null = null; let archiveIntent: { id: string; version: number; key: string } | null = null
  const scopeKey = () => { const value = scope(); return value ? doctorScopeKey(value,'patient-profile') : null }
  const current = (): DoctorProfileScope | null => { const value = scope(); return value?.locationId && state.patientId ? { practiceId: value.practiceId,locationId: value.locationId,patientId: state.patientId } : null }
  const capture = () => ({ revision: generation,scope: scopeKey(),patient: state.patientId })
  const accepts = (value: ReturnType<typeof capture>) => value.revision===generation && value.scope===scopeKey() && value.patient===state.patientId
  const signal = () => AbortSignal.any([controller.signal,AbortSignal.timeout(30000)])
  function discard() { uploadKey = null; state.file = null; state.replacement = null; state.actionError = null }
  function clear() { generation++; documentsRevision++; historyRevision++; controller.abort(); controller = new AbortController(); uploadKey = null; archiveIntent = null; Object.assign(state,doctorProfileState()) }
  function failure(field: 'documentsError' | 'historyError' | 'actionError',error: unknown) {
    const result = doctorPatientFailure(error)
    if (result==='denied') {
      // A known denial immediately removes private file state, even before the
      // broader context refresh discovers which grants/session changed.
      state.documents = null; state.history = null; state.historyDocumentId = null
      state.file = null; state.replacement = null; uploadKey = null; archiveIntent = null
      state.available = false; state.serviceWrite = false
      if (state.profile) { state.profile.documentsRead = false; state.profile.documentsWrite = false }
    }
    state[field] = result
  }
  function writable() { return Boolean(state.profile?.documentsWrite && state.documents?.canWrite && state.available && state.serviceWrite && !state.loading && !state.documentsLoading) }
  function selected(id: string) { return state.documents?.rows.find(item => item.id===id) || null }
  async function documents(page = state.page,size = state.size) {
    const expected = capture(); const revision = ++documentsRevision; const selectedScope = current()
    state.documents = null; state.documentsError = null; state.documentsLoading = true; state.available = false; state.serviceWrite = false; state.page = page; state.size = size
    if (!selectedScope || !repository || !state.profile?.documentsRead) { state.documentsLoading = false; return false }
    try {
      const directory = await repository.documents(selectedScope,page,size,signal())
      if (!accepts(expected) || revision!==documentsRevision) return false
      state.documents = directory
      try {
        const service = await repository.status(selectedScope,key(),signal())
        if (!accepts(expected) || revision!==documentsRevision) return false
        state.available = true; state.serviceWrite = service.canWrite
      } catch (error) { if (accepts(expected) && revision===documentsRevision) failure('documentsError',error) }
      return true
    } catch (error) { if (accepts(expected) && revision===documentsRevision) failure('documentsError',error); return false }
    finally { if (accepts(expected) && revision===documentsRevision) state.documentsLoading = false }
  }
  async function load(patientId: string) {
    clear(); state.patientId = patientId; const selectedScope = current(); const expected = capture(); state.loading = true
    if (!repository || !selectedScope || !doctorUuid(patientId)) { state.loading = false; state.error = 'denied'; return false }
    try {
      const profile = await repository.profile(selectedScope,signal())
      if (!accepts(expected)) return false
      state.profile = profile; state.loading = false
      if (profile.documentsRead) await documents()
      return accepts(expected)
    } catch (error) { if (accepts(expected)) state.error = doctorPatientFailure(error); return false }
    finally { if (accepts(expected)) state.loading = false }
  }
  function choose(file: File | null,replacementId: string | null) {
    if (state.pending || !writable()) return false
    const row = replacementId ? selected(replacementId) : null
    if (replacementId && (!row || row.archivedAt)) return false
    discard(); state.replacement = row ? { ...row,current: { ...row.current } } : null
    if (file && (file.size<1 || file.size>5242880 || !['application/pdf','image/png','image/jpeg'].includes(file.type))) { state.actionError = 'invalid'; return false }
    state.file = file; return true
  }
  async function upload() {
    if (state.pending || !writable() || !state.file || !repository) return false
    const selectedScope = current(); if (!selectedScope) return false
    const expected = capture(); const file = state.file; const row = state.replacement
    if (row && !state.documents?.rows.some(item => item.id===row.id && item.version===row.version && !item.archivedAt)) { state.actionError = 'conflict'; return false }
    state.pending = true; state.actionError = null; uploadKey ||= key()
    try {
      await repository.upload(selectedScope,row,file,uploadKey,signal())
      if (!accepts(expected)) return false
      discard(); return true
    } catch (error) { if (accepts(expected)) { failure('actionError',error); if (state.actionError!=='network') uploadKey = null } return false }
    finally { if (accepts(expected)) state.pending = false }
  }
  async function archive(id: string,expectedVersion: number) {
    if (state.pending || !writable() || !repository) return false
    const selectedScope = current(); const row = selected(id); if (!selectedScope || !row || row.archivedAt) return false
    if (row.version!==expectedVersion) { state.actionError = 'conflict'; return false }
    const expected = capture(); state.pending = true; state.actionError = null
    if (archiveIntent?.id!==id || archiveIntent?.version!==row.version) archiveIntent = { id,version: row.version,key: key() }
    try { await repository.archive(selectedScope,row,archiveIntent.key,signal()); if (!accepts(expected)) return false; archiveIntent = null; return true }
    catch (error) { if (accepts(expected)) { failure('actionError',error); if (state.actionError!=='network') archiveIntent = null } return false }
    finally { if (accepts(expected)) state.pending = false }
  }
  function closeHistory() { historyRevision++; state.history = null; state.historyDocumentId = null; state.historyLoading = false; state.historyError = null; state.historyPage = 0 }
  async function history(id: string,page = 0) {
    if (state.pending) return false
    const row = selected(id); const selectedScope = current(); if (!row || !repository || !selectedScope || !state.profile?.documentsRead) return false
    const expected = capture(); const revision = ++historyRevision; state.history = null; state.historyDocumentId = id; state.historyPage = page; state.historyLoading = true; state.historyError = null
    try { const result = await repository.history(selectedScope,row,page,20,signal()); if (!accepts(expected) || revision!==historyRevision) return false; state.history = result; return true }
    catch (error) { if (accepts(expected) && revision===historyRevision) failure('historyError',error); return false }
    finally { if (accepts(expected) && revision===historyRevision) state.historyLoading = false }
  }
  async function download(documentId: string,versionId: string) {
    if (state.pending || !state.profile?.documentsRead || !state.available || !repository) return null
    const row = selected(documentId); const version = row?.current.id===versionId ? row.current : state.historyDocumentId===documentId ? state.history?.versions.find(item => item.id===versionId) : null
    const selectedScope = current(); if (!row || !version || !selectedScope) return null
    const expected = capture(); state.pending = true; state.actionError = null
    try { const blob = await repository.download(selectedScope,row,version,key(),signal()); return accepts(expected) ? { blob,version: { ...version } as DoctorDocumentVersion } : null }
    catch (error) { if (accepts(expected)) failure('actionError',error); return null }
    finally { if (accepts(expected)) state.pending = false }
  }
  return { state,clear,discard,load,documents,choose,upload,archive,history,closeHistory,download,writable,scopeKey }
}
