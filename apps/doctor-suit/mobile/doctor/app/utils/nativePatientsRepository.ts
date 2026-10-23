import {doctorPatientDirectory, doctorPatientProfile, doctorDocumentDirectory, type DoctorMobileContext, type DoctorMobileIdentity} from '@building-suit/contracts'
import type {NativeContextChoice, NativeContextPort} from './nativeContext.ts'
import {nativePatientScopeKey, type NativePatientsPort} from './nativePatients.ts'
import {nativeSessionConfiguration, type NativeSessionConfiguration, type NativeAuthTransport} from './nativeSessionBackend.ts'
const denied = () => Object.assign(new Error('Patient access unavailable'), {code: '42501'})
export function createNativePatientsRepository(configuration: NativeSessionConfiguration, transport: NativeAuthTransport,
  session: {identity(): DoctorMobileIdentity | null; accessToken(): string | null}, current: () => NativeContextChoice | null, contexts: NativeContextPort, rejectScope: () => void): NativePatientsPort {
  const config = nativeSessionConfiguration(configuration)
  if (!config) throw denied()
  async function rpc(name: 'doctor_patients' | 'doctor_patient_profile' | 'doctor_patient_documents', args: Record<string, unknown>, scope: DoctorMobileContext, signal: AbortSignal, capability = 'patients.read') {
    const choice = current(), actor = session.identity(), token = session.accessToken(), key = nativePatientScopeKey(scope)
    if (!choice || !actor || !token || signal.aborted || nativePatientScopeKey(choice.context) !== key || actor.userId !== scope.userId || actor.sessionId !== scope.sessionId || actor.environment !== 'local' || !scope.capabilities.includes(capability)) throw denied()
    const fresh = await contexts.resolve(choice, actor, signal)
    if (nativePatientScopeKey(fresh.context) !== key) { rejectScope(); throw denied() }
    if (signal.aborted || session.accessToken() !== token || nativePatientScopeKey(current()?.context ?? null) !== key) throw denied()
    const response = await transport({url: config!.url + '/rest/v1/rpc/' + name, method: 'POST', signal,
      headers: {apikey: config!.publicKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
      body: {p_practice: scope.practiceId, p_location: scope.locationId, ...args}})
    if (signal.aborted || session.accessToken() !== token || nativePatientScopeKey(current()?.context ?? null) !== key) throw denied()
    if ([401,403].includes(response.status)) throw denied()
    if (!Number.isInteger(response.status) || response.status < 200 || response.status >= 300 || JSON.stringify(response.data ?? null).length > 262144) throw new Error('Patient service unavailable')
    return response.data
  }
  return {
    async directory(scope, query, signal) {
      const raw = await rpc('doctor_patients', {p_page: query.page, p_size: query.size, p_search: query.search, p_status: query.status}, scope, signal)
      return doctorPatientDirectory(raw, scope.practiceId)
    },
    async profile(scope, patientId, signal) {
      return doctorPatientProfile(await rpc('doctor_patient_profile', {p_patient: patientId}, scope, signal), scope.practiceId, patientId)
    },
    async documents(scope, patientId, signal) {
      return doctorDocumentDirectory(await rpc('doctor_patient_documents', {p_patient: patientId, p_page: 0, p_size: 25}, scope, signal, 'documents.read'), scope.practiceId, patientId)
    },
    // A read capability alone does not approve device custody or a file cache.
    async download() { throw Object.assign(new Error('Document delivery requires approved device policy'), {code: 'DEVICE_POLICY_REQUIRED'}) },
  }
}
