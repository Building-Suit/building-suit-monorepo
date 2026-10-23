import type {DoctorMobileContext, DoctorPatientDirectory, DoctorPatientProfile, DoctorPatientQuery, DoctorDocumentDirectory} from '@building-suit/contracts'
export interface NativePatientsPort {
  directory(context: DoctorMobileContext, query: DoctorPatientQuery, signal: AbortSignal): Promise<DoctorPatientDirectory>
  profile(context: DoctorMobileContext, patientId: string, signal: AbortSignal): Promise<DoctorPatientProfile>
  documents?(context: DoctorMobileContext, patientId: string, signal: AbortSignal): Promise<DoctorDocumentDirectory>
  download?(): Promise<never>
}
export interface NativePatientsState {
  phase: 'idle' | 'loading' | 'ready' | 'denied' | 'error'
  directory: DoctorPatientDirectory | null
  profile: DoctorPatientProfile | null
  documents: DoctorDocumentDirectory | null
  documentError: 'denied' | 'error' | null
}
export const nativePatientsState = (): NativePatientsState => ({phase: 'idle', directory: null, profile: null, documents: null, documentError: null})
export const nativePatientScopeKey = (context: DoctorMobileContext | null) => context ? JSON.stringify(['doctor-suit', context.environment, context.portal, context.userId, context.sessionId, context.doctorId, context.practiceId, context.locationId, context.grantsVersion, context.locationVersion, [...context.capabilities].sort()]) : null
/** Online-only read state. No chart persistence, service worker or automatic retry. */
export function createNativePatients(port: NativePatientsPort | null, context: () => DoctorMobileContext | null, state = nativePatientsState()) {
  let generation = 0, controller = new AbortController()
  function clear() {
    generation++; controller.abort(); controller = new AbortController()
    state.directory = null; state.profile = null; state.documents = null; state.documentError = null; state.phase = 'idle'
  }
  async function read(query: DoctorPatientQuery | string): Promise<boolean> {
    clear()
    const selected = context(), key = nativePatientScopeKey(selected), revision = generation
    if (!port || !selected || !selected.capabilities.includes('patients.read')) { state.phase = 'denied'; return false }
    if (typeof query === 'string' ? !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query) :
      !Number.isSafeInteger(query.page) || query.page < 0 || ![10,25,50].includes(query.size) || query.search.length > 160 || !['active','archived','all'].includes(query.status)) { state.phase = 'error'; return false }
    state.phase = 'loading'
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])
    try {
      const result = typeof query === 'string' ? await port.profile(selected, query, signal) : await port.directory(selected, {...query}, signal)
      if (revision !== generation || signal.aborted || nativePatientScopeKey(context()) !== key) return false
      if (typeof query === 'string') {
        state.profile = result as DoctorPatientProfile
        if (state.profile.documentsRead && selected.capabilities.includes('documents.read') && port.documents) {
          try {
            const documents = await port.documents(selected, query, signal)
            if (revision !== generation || signal.aborted || nativePatientScopeKey(context()) !== key) return false
            state.documents = documents
          } catch (error) {
            if (revision !== generation || signal.aborted || nativePatientScopeKey(context()) !== key) return false
            state.documentError = error && typeof error === 'object' && 'code' in error && error.code === '42501' ? 'denied' : 'error'
          }
        }
      }
      else state.directory = result as DoctorPatientDirectory
      state.phase = 'ready'; return true
    } catch (error) {
      if (revision === generation && nativePatientScopeKey(context()) === key) state.phase = error && typeof error === 'object' && 'code' in error && error.code === '42501' ? 'denied' : 'error'
      return false
    }
  }
  return {state, clear, directory: (query: DoctorPatientQuery) => read(query), profile: (id: string) => read(id), dispose: clear}
}
